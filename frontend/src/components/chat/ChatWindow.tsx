import { useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChatStore } from '../../store/chatStore';
import { useUsageStore } from '../../store/usageStore';
import { useAuthStore } from '../../store/authStore';
import { chatService } from '../../services/chat.service';
import { familyService } from '../../services/family.service';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import type { UsageInfo } from '../../types';

const FALLBACK_PROMPTS = [
  "Tell me a story about a family member",
  "When is a family member's birthday?",
  "Tell me about our family history",
  "Who should I call today?",
];

export default function ChatWindow() {
  const { messages, sessionId, isLoading, addMessage, updateLastMessage, setSessionId, setLoading, ensureOwner } = useChatStore();
  const { summary, trackUsage } = useUsageStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUsageRef = useRef<UsageInfo | null>(null);

  // Persisted history belongs to one user — reset it if someone else logs in
  useEffect(() => {
    if (user?.id) ensureOwner(user.id);
  }, [user?.id, ensureOwner]);

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: familyService.getMembers,
    enabled: !!user?.familyId,
  });

  const suggestedPrompts = useMemo(() => {
    const members = membersData?.members ?? [];
    if (members.length === 0) return FALLBACK_PROMPTS;
    const first = members[0].nickname ?? members[0].name.split(' ')[0];
    const second = members[1]
      ? members[1].nickname ?? members[1].name.split(' ')[0]
      : null;
    return [
      `Tell me a story about ${first}`,
      second ? `When is ${second}'s birthday?` : "When is a family member's birthday?",
      "Tell me about our family history",
      "Who should I call today?",
    ];
  }, [membersData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (message: string) => {
    // Get current messages for history before adding new user message
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    addMessage({ role: 'user', content: message });
    setLoading(true);

    // Include current messages plus the new user message in history
    // Pass sessionId to maintain working memory context
    const fullHistory = [...history, { role: 'user' as const, content: message }];

    const finalize = (response: Awaited<ReturnType<typeof chatService.sendMessage>>, assistantAdded: boolean) => {
      // Store the session ID from the response
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }

      // Track usage if available
      if (response.usage) {
        trackUsage('chat', response.usage);
        lastUsageRef.current = response.usage;
      }

      const extras = {
        relatedStories: response.relatedStories,
        relatedPhotos: response.relatedPhotos,
        suggestedActions: response.suggestedActions,
      };
      if (assistantAdded) {
        updateLastMessage(response.response, extras);
      } else {
        addMessage({ role: 'assistant', content: response.response, ...extras });
      }
    };

    let streamedText = '';
    let assistantAdded = false;

    try {
      // Stream tokens into a growing assistant message
      const response = await chatService.sendMessageStream(
        message,
        sessionId || undefined,
        fullHistory,
        (token) => {
          streamedText += token;
          if (!assistantAdded) {
            assistantAdded = true;
            setLoading(false);
            addMessage({ role: 'assistant', content: streamedText });
          } else {
            updateLastMessage(streamedText);
          }
        }
      );
      finalize(response, assistantAdded);
    } catch (streamError) {
      console.warn('[Chat] streaming failed, falling back to non-streaming:', streamError);
      try {
        const response = await chatService.sendMessage(message, fullHistory, sessionId || undefined);
        finalize(response, assistantAdded);
      } catch (error) {
        console.error('[Chat] sendMessage failed:', error);
        const errorMessage =
          (error as any)?.response?.data?.error?.message ||
          (error as any)?.message ||
          'Sorry, I encountered an error. Please try again.';
        if (assistantAdded) {
          updateLastMessage(errorMessage);
        } else {
          addMessage({ role: 'assistant', content: errorMessage });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">RK</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to Rememberkin
            </h2>
            <p className="text-gray-600 mb-6">
              Ask me about your family stories, or tell me something new!
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} onSendMessage={handleSend} />
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Usage indicator */}
      {summary.requests > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Session: {summary.requests} requests | {formatTokens(summary.totalTokens)} tokens
            </span>
            <span className="text-green-600 font-medium">
              ${summary.totalCost.toFixed(6)}
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      {!user?.familyId && (
        <p className="text-center text-sm text-gray-500 px-4 py-2 border-t border-gray-100">
          Create a family to start chatting.
        </p>
      )}
      <ChatInput onSend={handleSend} disabled={isLoading || !user?.familyId} />
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}
