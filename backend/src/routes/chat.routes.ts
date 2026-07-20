import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { graphService } from '../services/graph.service.js';
import { agentWrapper, extractSuggestedActions, estimateTokens } from '../services/agent-wrapper.js';
import { calculateCost } from '../config/pricing.js';
import { vectorService } from '../services/vector.service.js';
import { memoryService } from '../services/memory.service.js';
import { budgetService } from '../services/budget.service.js';
import { errors } from '../middleware/error.middleware.js';
import { ChatContext } from '../models/types.js';
import { logger } from '../utils/logger.js';

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(), // Session ID for working memory
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  context: z.object({
    currentView: z.string().optional(),
    selectedMember: z.string().optional(),
  }).optional(),
});

const extractSchema = z.object({
  content: z.string().min(1),
  sourceType: z.enum(['conversation', 'story', 'note']).optional(),
});

// POST /api/v1/chat
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { message, sessionId, history = [] } = chatSchema.parse(req.body);

    // Use provided sessionId or generate a new one
    const chatSessionId = sessionId || uuid();

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Get family info
    const family = await graphService.getFamily(user.familyId);
    if (!family) {
      throw errors.notFound('Family');
    }

    // Get current user
    const currentUser = await graphService.getPerson(user.id);
    if (!currentUser) {
      throw errors.notFound('User');
    }

    // Load supplemental family context in parallel so chat can reference
    // the family tree and memory graph instead of guessing from the prompt.
    const [
      memoryResultsResult,
      memoriesResult,
      storiesResult,
      familyTreeResult,
      memoryContextResult,
      membersResult,
      eventsResult,
    ] = await Promise.allSettled([
      vectorService.searchMemories(message, user.familyId, 5),
      graphService.getMemories(user.familyId),
      graphService.getStories(user.familyId, user.id, 1, 0),
      graphService.getFamilyTree(user.familyId),
      memoryService.getOptimizedContext(user.familyId, message),
      graphService.getFamilyMembers(user.familyId),
      graphService.getUpcomingEvents(user.familyId, 365),
    ]);

    const memoryResults = memoryResultsResult.status === 'fulfilled' ? memoryResultsResult.value : [];
    const memories = memoriesResult.status === 'fulfilled' ? memoriesResult.value : [];
    const relevantMemories = memories.filter(m =>
      memoryResults.some(r => r.memoryId === m.id)
    );
    const stories = storiesResult.status === 'fulfilled' ? storiesResult.value : [];
    const familyTree = familyTreeResult.status === 'fulfilled' ? familyTreeResult.value : undefined;
    const memoryContext = memoryContextResult.status === 'fulfilled'
      ? memoryContextResult.value.context
      : '';
    const members = membersResult.status === 'fulfilled'
      ? membersResult.value.map(m => ({
          name: m.name,
          nickname: m.nickname,
          birthDate: m.birthDate,
          isDeceased: m.isDeceased,
        }))
      : undefined;
    const upcomingEvents = eventsResult.status === 'fulfilled'
      ? eventsResult.value.map(e => ({ title: e.title, date: e.date, type: e.type }))
      : undefined;

    // Find gallery photos relevant to the question so we can both let the agent
    // reference them and show them inline under its reply.
    const relevantPhotos = await graphService.searchPhotos(user.familyId, message, 3).catch(() => []);

    // Build context with history from client
    const context: ChatContext = {
      familyId: user.familyId,
      familyName: family.name,
      userName: currentUser.name,
      memberCount: family.memberCount || 0,
      storyCount: stories.length,
      memoryCount: memories.length,
      relevantMemories,
      familyTree,
      memoryContext,
      members,
      upcomingEvents,
      relevantPhotos,
      history: history.slice(-10), // Keep last 10 messages for context
    };

    // Fail fast with a clean 429 when the deployment's AI budget is exhausted
    await budgetService.assertWithinBudget();

    // Get AI response with token tracking
    const wrappedResponse = await agentWrapper.chat(message, context);
    const response = wrappedResponse.output;

    if (relevantPhotos.length > 0) response.relatedPhotos = relevantPhotos;

    // Search for related stories if relevant
    const storyResults = await vectorService.searchStories(message, user.familyId, user.id, 3);
    if (storyResults.length > 0) {
      const relatedStories = await Promise.all(
        storyResults.slice(0, 3).map(async (r) => {
          const story = await graphService.getStory(r.storyId, user.id);
          return story ? { id: story.id, summary: story.summary || '' } : null;
        })
      );
      response.relatedStories = relatedStories.filter(Boolean) as any;
    }

    // Process conversation for memory extraction (non-blocking)
    memoryService.processConversation(
      chatSessionId,
      message,
      response.response,
      user.familyId,
      user.id
    ).then(({ extractedFacts, activityLog }) => {
      if (extractedFacts.length > 0) {
        logger.info({
          operation: 'processConversation',
          sessionId: chatSessionId,
          familyId: user.familyId,
          extractedFacts: extractedFacts.length,
        }, 'Extracted facts from conversation');
      }
    }).catch(error => {
      logger.error({
        operation: 'processConversation',
        error: (error as Error).message,
        sessionId: chatSessionId,
      }, 'Failed to process conversation for memory extraction');
    });

    // Include sessionId and usage data in response
    res.json({
      ...response,
      sessionId: chatSessionId,
      usage: {
        model: wrappedResponse.model,
        tokenUsage: wrappedResponse.tokenUsage,
        costEstimate: wrappedResponse.costEstimate,
        latencyMs: wrappedResponse.latencyMs,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/chat/stream — same as POST /api/v1/chat but relays the AI
// response token-by-token as Server-Sent Events. The non-streaming endpoint
// above is kept untouched as a fallback.
router.post('/stream', async (req: Request, res: Response, next: NextFunction) => {
  let clientClosed = false;

  try {
    const user = req.user!;
    const { message, sessionId, history = [] } = chatSchema.parse(req.body);
    const chatSessionId = sessionId || uuid();

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    const family = await graphService.getFamily(user.familyId);
    if (!family) {
      throw errors.notFound('Family');
    }

    const currentUser = await graphService.getPerson(user.id);
    if (!currentUser) {
      throw errors.notFound('User');
    }

    // Same supplemental family context assembly as POST /api/v1/chat
    const [
      memoryResultsResult,
      memoriesResult,
      storiesResult,
      familyTreeResult,
      memoryContextResult,
      membersResult,
      eventsResult,
    ] = await Promise.allSettled([
      vectorService.searchMemories(message, user.familyId, 5),
      graphService.getMemories(user.familyId),
      graphService.getStories(user.familyId, user.id, 1, 0),
      graphService.getFamilyTree(user.familyId),
      memoryService.getOptimizedContext(user.familyId, message),
      graphService.getFamilyMembers(user.familyId),
      graphService.getUpcomingEvents(user.familyId, 365),
    ]);

    const memoryResults = memoryResultsResult.status === 'fulfilled' ? memoryResultsResult.value : [];
    const memories = memoriesResult.status === 'fulfilled' ? memoriesResult.value : [];
    const relevantMemories = memories.filter(m =>
      memoryResults.some(r => r.memoryId === m.id)
    );
    const stories = storiesResult.status === 'fulfilled' ? storiesResult.value : [];
    const familyTree = familyTreeResult.status === 'fulfilled' ? familyTreeResult.value : undefined;
    const memoryContext = memoryContextResult.status === 'fulfilled'
      ? memoryContextResult.value.context
      : '';
    const members = membersResult.status === 'fulfilled'
      ? membersResult.value.map(m => ({
          name: m.name,
          nickname: m.nickname,
          birthDate: m.birthDate,
          isDeceased: m.isDeceased,
        }))
      : undefined;
    const upcomingEvents = eventsResult.status === 'fulfilled'
      ? eventsResult.value.map(e => ({ title: e.title, date: e.date, type: e.type }))
      : undefined;
    const relevantPhotos = await graphService.searchPhotos(user.familyId, message, 3).catch(() => []);

    const context: ChatContext = {
      familyId: user.familyId,
      familyName: family.name,
      userName: currentUser.name,
      memberCount: family.memberCount || 0,
      storyCount: stories.length,
      memoryCount: memories.length,
      relevantMemories,
      familyTree,
      memoryContext,
      members,
      upcomingEvents,
      relevantPhotos,
      history: history.slice(-10),
    };

    // Fail fast with a clean 429 when the deployment's AI budget is exhausted
    await budgetService.assertWithinBudget();

    const startTime = Date.now();
    const { stream, model, promptText } = await agentWrapper.chatStream(message, context);

    // Switch to SSE — from here on, errors must be sent as events, not next()
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      if (!clientClosed) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    req.on('close', () => {
      clientClosed = true;
      try {
        stream.controller.abort();
      } catch {
        // already finished
      }
    });

    let fullText = '';
    let streamUsage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
    let aborted = false;

    try {
      for await (const chunk of stream) {
        if (chunk.usage) streamUsage = chunk.usage;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          sendEvent({ type: 'token', content: delta });
        }
      }
    } catch (streamError) {
      if (clientClosed) {
        aborted = true; // client went away; keep whatever tokens we already have
      } else {
        throw streamError;
      }
    }

    // The fetch-level budget accounting skips event-stream bodies, so record
    // spend here — from the provider-reported usage when available, otherwise
    // from a token estimate of the prompt and the generated text.
    const inputTokens = streamUsage?.prompt_tokens ?? estimateTokens(promptText);
    const outputTokens = streamUsage?.completion_tokens ?? estimateTokens(fullText);
    const costEstimate = { ...calculateCost(model, inputTokens, outputTokens), currency: 'USD' as const };
    budgetService.recordSpend(costEstimate.totalCost);

    // Process conversation for memory extraction (non-blocking)
    if (fullText.length > 0) {
      memoryService.processConversation(
        chatSessionId,
        message,
        fullText,
        user.familyId,
        user.id
      ).then(({ extractedFacts }) => {
        if (extractedFacts.length > 0) {
          logger.info({
            operation: 'processConversation',
            sessionId: chatSessionId,
            familyId: user.familyId,
            extractedFacts: extractedFacts.length,
          }, 'Extracted facts from conversation');
        }
      }).catch(error => {
        logger.error({
          operation: 'processConversation',
          error: (error as Error).message,
          sessionId: chatSessionId,
        }, 'Failed to process conversation for memory extraction');
      });
    }

    if (aborted || clientClosed) {
      res.end();
      return;
    }

    const suggestedActions = extractSuggestedActions(fullText, message);

    // Search for related stories if relevant (same block as POST /api/v1/chat)
    let relatedStories: { id: string; summary: string }[] | undefined;
    try {
      const storyResults = await vectorService.searchStories(message, user.familyId, user.id, 3);
      if (storyResults.length > 0) {
        const resolved = await Promise.all(
          storyResults.slice(0, 3).map(async (r) => {
            const story = await graphService.getStory(r.storyId, user.id);
            return story ? { id: story.id, summary: story.summary || '' } : null;
          })
        );
        const filtered = resolved.filter(Boolean) as { id: string; summary: string }[];
        if (filtered.length > 0) relatedStories = filtered;
      }
    } catch (error) {
      logger.warn({
        operation: 'chatStream',
        error: (error as Error).message,
      }, 'Related story lookup failed for streamed chat');
    }

    sendEvent({
      type: 'done',
      response: fullText,
      relatedStories,
      relatedPhotos: relevantPhotos.length > 0 ? relevantPhotos : undefined,
      suggestedActions,
      sessionId: chatSessionId,
      usage: {
        model,
        tokenUsage: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        costEstimate,
        latencyMs: Date.now() - startTime,
      },
    });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      next(error);
      return;
    }
    logger.error({
      operation: 'chatStream',
      error: (error as Error).message,
    }, 'Chat stream failed after headers were sent');
    if (!clientClosed) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: 'Chat stream failed. Please try again.',
      })}\n\n`);
    }
    res.end();
  }
});

// POST /api/v1/chat/extract
router.post('/extract', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { content } = extractSchema.parse(req.body);

    if (!user.familyId) {
      throw errors.badRequest('User is not a member of any family');
    }

    // Extract entities with token tracking
    const extractionResult = await agentWrapper.extractEntities(content);
    const entities = extractionResult.output;

    // Match to family members
    const familyMembers = await graphService.getFamilyMembers(user.familyId);
    const matchResult = await agentWrapper.matchPeopleToFamily(
      entities.people,
      familyMembers.map(m => ({ id: m.id, name: m.name, nickname: m.nickname }))
    );
    const matches = matchResult.output;

    // Aggregate token usage
    const totalUsage = {
      input: extractionResult.tokenUsage.input + matchResult.tokenUsage.input,
      output: extractionResult.tokenUsage.output + matchResult.tokenUsage.output,
      total: extractionResult.tokenUsage.total + matchResult.tokenUsage.total,
    };
    const totalCost = {
      inputCost: extractionResult.costEstimate.inputCost + matchResult.costEstimate.inputCost,
      outputCost: extractionResult.costEstimate.outputCost + matchResult.costEstimate.outputCost,
      totalCost: extractionResult.costEstimate.totalCost + matchResult.costEstimate.totalCost,
      currency: 'USD' as const,
    };

    res.json({
      extractedMemories: entities.facts.map(fact => {
        const match = matches.find(m =>
          m.extractedName.toLowerCase() === fact.about.toLowerCase()
        );
        return {
          fact: fact.fact,
          about: match?.matchedId || fact.about,
          confidence: fact.confidence,
        };
      }),
      extractedEntities: matches,
      usage: {
        models: [extractionResult.model, matchResult.model],
        tokenUsage: totalUsage,
        costEstimate: totalCost,
        latencyMs: extractionResult.latencyMs + matchResult.latencyMs,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
