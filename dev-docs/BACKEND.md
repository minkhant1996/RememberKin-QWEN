# Rememberkin - Backend Implementation Guide

## Overview

The Rememberkin backend is built with Node.js, Express, and TypeScript. It provides REST APIs, WebSocket connections, and integrates with Neo4j, Qdrant, and Qwen Cloud.

## Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── index.ts           # Environment config
│   │   ├── neo4j.ts           # Neo4j connection
│   │   ├── qdrant.ts          # Qdrant connection
│   │   └── qwen.ts            # Qwen API config
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── family.controller.ts
│   │   ├── member.controller.ts
│   │   ├── story.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── memory.controller.ts
│   │   ├── event.controller.ts
│   │   └── search.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── graph.service.ts    # Neo4j operations
│   │   ├── vector.service.ts   # Qdrant operations
│   │   ├── agent.service.ts    # Qwen integration
│   │   ├── memory.service.ts   # Memory extraction
│   │   ├── privacy.service.ts  # Access control
│   │   └── scheduler.service.ts # Event reminders
│   ├── models/
│   │   ├── person.model.ts
│   │   ├── story.model.ts
│   │   ├── event.model.ts
│   │   └── memory.model.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── rateLimit.middleware.ts
│   ├── routes/
│   │   └── index.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   ├── websocket/
│   │   └── handler.ts
│   └── index.ts
├── package.json
├── tsconfig.json
├── .env.example
└── Dockerfile
```

## Core Services

### 1. Graph Service (Neo4j)

Handles all family relationship operations.

```typescript
// src/services/graph.service.ts

import neo4j, { Driver, Session } from 'neo4j-driver';

class GraphService {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
    );
  }

  async getFamilyTree(familyId: string): Promise<FamilyTree> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (f:Family {id: $familyId})<-[:MEMBER_OF]-(p:Person)
        OPTIONAL MATCH (p)-[r:PARENT_OF|SPOUSE_OF|SIBLING_OF]-(related:Person)
        WHERE (related)-[:MEMBER_OF]->(f)
        RETURN p, collect({person: related, relation: type(r)}) as relations
      `, { familyId });

      return this.transformToTree(result.records);
    } finally {
      await session.close();
    }
  }

  async getRelationshipPath(fromId: string, toId: string): Promise<RelationshipPath> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (a:Person {id: $fromId}), (b:Person {id: $toId})
        MATCH path = shortestPath((a)-[:PARENT_OF|SPOUSE_OF|SIBLING_OF*]-(b))
        RETURN [node in nodes(path) | node.id] as nodeIds,
               [rel in relationships(path) | type(rel)] as relations
      `, { fromId, toId });

      return this.describeRelationship(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async addStory(story: StoryInput, authorId: string): Promise<Story> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (author:Person {id: $authorId})
        CREATE (s:Story {
          id: randomUUID(),
          content: $content,
          summary: $summary,
          mood: $mood,
          topics: $topics,
          createdAt: datetime()
        })
        CREATE (author)-[:TOLD_STORY {date: datetime()}]->(s)
        WITH s
        UNWIND $mentionedIds as mentionId
        MATCH (mentioned:Person {id: mentionId})
        CREATE (s)-[:MENTIONS]->(mentioned)
        RETURN s
      `, { ...story, authorId });

      return result.records[0].get('s').properties;
    } finally {
      await session.close();
    }
  }
}
```

### 2. Vector Service (Qdrant)

Handles semantic search and embeddings.

```typescript
// src/services/vector.service.ts

import { QdrantClient } from '@qdrant/js-client-rest';
import { getEmbedding } from './agent.service';

class VectorService {
  private client: QdrantClient;
  private collectionName = 'stories';

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY
    });
  }

  async initCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: 1536, distance: 'Cosine' }
      });
    }
  }

  async indexStory(story: Story): Promise<void> {
    const embedding = await getEmbedding(story.content);

    await this.client.upsert(this.collectionName, {
      points: [{
        id: story.id,
        vector: embedding,
        payload: {
          story_id: story.id,
          author_id: story.authorId,
          family_id: story.familyId,
          topics: story.topics,
          created_at: story.createdAt,
          visible_to: story.visibleTo || []
        }
      }]
    });
  }

  async semanticSearch(
    query: string,
    familyId: string,
    userId: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const queryEmbedding = await getEmbedding(query);

    const results = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      filter: {
        must: [
          { key: 'family_id', match: { value: familyId } }
        ],
        should: [
          { is_empty: { key: 'visible_to' } },
          { key: 'visible_to', match: { value: userId } }
        ]
      },
      limit
    });

    return results.map(r => ({
      storyId: r.payload?.story_id as string,
      relevance: r.score
    }));
  }
}
```

### 3. Agent Service (Qwen)

Handles LLM interactions for chat, extraction, and summarization.

```typescript
// src/services/agent.service.ts

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.QWEN_API_KEY!,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-v3',
    input: text
  });
  return response.data[0].embedding;
}

export async function chat(
  message: string,
  context: ChatContext
): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(context);

  const response = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: systemPrompt },
      ...context.history,
      { role: 'user', content: message }
    ],
    temperature: 0.7
  });

  return {
    response: response.choices[0].message.content!,
    usage: response.usage
  };
}

export async function extractEntities(text: string): Promise<ExtractedEntities> {
  const response = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: [
      {
        role: 'system',
        content: `You are an entity extraction assistant. Extract:
1. People mentioned (names, nicknames, relationships)
2. Facts/preferences about people
3. Events with dates
4. Locations mentioned

Return as JSON:
{
  "people": [{"name": "", "relationship": "", "attributes": []}],
  "facts": [{"about": "", "fact": "", "confidence": 0.0-1.0}],
  "events": [{"title": "", "date": "", "involves": []}],
  "locations": []
}`
      },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content!);
}

export async function summarizeStory(content: string): Promise<StorySummary> {
  const response = await client.chat.completions.create({
    model: 'qwen-turbo',
    messages: [
      {
        role: 'system',
        content: `Summarize the story in one sentence. Also determine:
- mood: happy/sad/nostalgic/funny/serious
- topics: array of keywords

Return as JSON: {"summary": "", "mood": "", "topics": []}`
      },
      { role: 'user', content: content }
    ],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content!);
}

function buildSystemPrompt(context: ChatContext): string {
  return `You are a warm, helpful family memory assistant for the ${context.familyName} family.

You have access to:
- Family tree with ${context.memberCount} members
- ${context.storyCount} family stories
- ${context.memoryCount} extracted memories/facts

Current user: ${context.userName}

When answering:
1. Be warm and personal - use family members' nicknames
2. Reference specific stories and memories when relevant
3. Respect privacy - only share what the user can access
4. Suggest follow-up actions (record a story, set a reminder, etc.)

Available memories about family members:
${context.relevantMemories.map(m => `- ${m.fact}`).join('\n')}
`;
}
```

### 4. Privacy Service

Handles access control.

```typescript
// src/services/privacy.service.ts

class PrivacyService {
  constructor(private graphService: GraphService) {}

  async canAccessStory(userId: string, storyId: string): Promise<boolean> {
    const session = this.graphService.getSession();
    try {
      const result = await session.run(`
        MATCH (s:Story {id: $storyId}), (u:Person {id: $userId})

        // Check if explicitly hidden
        OPTIONAL MATCH (s)-[:HIDDEN_FROM]->(u)
        WITH s, u, count(*) > 0 as isHidden
        WHERE NOT isHidden

        // Check if has visibility rules
        OPTIONAL MATCH (s)-[:VISIBLE_TO]->(allowed:Person)
        WITH s, u, collect(allowed) as allowedList

        RETURN
          CASE
            WHEN size(allowedList) = 0 THEN true  // No rules = family visible
            WHEN u IN allowedList THEN true
            ELSE false
          END as canAccess
      `, { userId, storyId });

      return result.records[0]?.get('canAccess') ?? false;
    } finally {
      await session.close();
    }
  }

  async filterStoriesByAccess(
    userId: string,
    storyIds: string[]
  ): Promise<string[]> {
    const session = this.graphService.getSession();
    try {
      const result = await session.run(`
        UNWIND $storyIds as storyId
        MATCH (s:Story {id: storyId}), (u:Person {id: $userId})
        WHERE NOT (s)-[:HIDDEN_FROM]->(u)
        AND (
          NOT EXISTS((s)-[:VISIBLE_TO]->())
          OR (s)-[:VISIBLE_TO]->(u)
        )
        RETURN s.id as storyId
      `, { userId, storyIds });

      return result.records.map(r => r.get('storyId'));
    } finally {
      await session.close();
    }
  }
}
```

### 5. Scheduler Service

Handles proactive reminders.

```typescript
// src/services/scheduler.service.ts

import cron from 'node-cron';
import { WebSocketServer } from '../websocket/handler';

class SchedulerService {
  constructor(
    private graphService: GraphService,
    private wsServer: WebSocketServer
  ) {}

  start(): void {
    // Check for events daily at 9 AM
    cron.schedule('0 9 * * *', () => this.checkUpcomingEvents());

    // Check for inactive connections weekly
    cron.schedule('0 10 * * 0', () => this.checkInactiveConnections());
  }

  private async checkUpcomingEvents(): Promise<void> {
    const session = this.graphService.getSession();
    try {
      const result = await session.run(`
        MATCH (e:Event)-[:INVOLVES]->(p:Person)
        MATCH (p)-[:MEMBER_OF]->(f:Family)<-[:MEMBER_OF]-(member:Person)
        WHERE e.date >= date()
        AND e.date <= date() + duration('P7D')
        AND ANY(d IN e.reminderDays WHERE
          e.date - duration('P' + toString(d) + 'D') = date()
        )
        RETURN e, p, collect(distinct member) as notifyMembers
      `);

      for (const record of result.records) {
        const event = record.get('e').properties;
        const involves = record.get('p').properties;
        const members = record.get('notifyMembers');

        for (const member of members) {
          this.wsServer.sendToUser(member.properties.id, {
            type: 'reminder',
            event: {
              id: event.id,
              title: event.title,
              date: event.date,
              involves: involves.name
            },
            message: this.formatReminderMessage(event, involves)
          });
        }
      }
    } finally {
      await session.close();
    }
  }

  private async checkInactiveConnections(): Promise<void> {
    const session = this.graphService.getSession();
    try {
      const result = await session.run(`
        MATCH (user:Person {id: $userId})-[:MEMBER_OF]->(f:Family)
        MATCH (f)<-[:MEMBER_OF]-(member:Person)
        WHERE member.id <> $userId
        OPTIONAL MATCH (user)-[c:LAST_CONTACTED]->(member)
        WITH member, c.date as lastContact
        WHERE lastContact IS NULL
           OR lastContact < date() - duration('P14D')
        RETURN member, lastContact
        ORDER BY lastContact ASC
        LIMIT 3
      `);

      // Send suggestions to reconnect
    } finally {
      await session.close();
    }
  }

  private formatReminderMessage(event: any, involves: any): string {
    const daysUntil = /* calculate */;
    if (daysUntil === 0) {
      return `Today is ${involves.name}'s ${event.type}!`;
    }
    return `${involves.name}'s ${event.type} is in ${daysUntil} day(s)!`;
  }
}
```

## Environment Variables

```env
# .env.example

# Server
PORT=6100
NODE_ENV=development

# Neo4j
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key

# Qwen Cloud
QWEN_API_KEY=your-qwen-api-key

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
```

## Running the Backend

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Production
npm start

# Tests
npm test
```
