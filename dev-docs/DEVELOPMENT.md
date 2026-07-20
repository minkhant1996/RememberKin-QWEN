# Development Guide

This guide covers development setup, workflows, and best practices for the Rememberkin project.

## Prerequisites

- Node.js 18+ and npm
- Neo4j database (local or cloud)
- Qdrant vector database
- Qwen Cloud API key

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd QWEN-hackathon

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

#### Neo4j

Option A: Neo4j Aura (Cloud - Recommended)
1. Create a free account at https://neo4j.com/cloud/aura/
2. Create a new database
3. Copy the connection URI and credentials

Option B: Local Neo4j
```bash
# Using Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

#### Qdrant

```bash
# Using Docker
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  qdrant/qdrant:latest
```

### 3. Environment Variables

Backend `.env`:
```env
PORT=3000
NODE_ENV=development

NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

QDRANT_URL=http://localhost:6333

QWEN_API_KEY=your-qwen-api-key
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

JWT_SECRET=development-secret-key
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:6101
```

Frontend `.env`:
```env
VITE_API_URL=http://localhost:6100/api/v1
VITE_WS_URL=ws://localhost:6100/ws
```

### 4. Start Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Project Structure

### Backend

```
backend/src/
├── config/             # Configuration and database clients
│   ├── index.ts        # Environment config loader
│   ├── neo4j.ts        # Neo4j driver setup
│   ├── qdrant.ts       # Qdrant client setup
│   └── qwen.ts         # Qwen API client (OpenAI-compatible)
│
├── middleware/         # Express middleware
│   ├── auth.middleware.ts    # JWT verification
│   └── error.middleware.ts   # Error handling
│
├── models/            # TypeScript type definitions
│   └── types.ts       # All data types
│
├── routes/            # API route handlers
│   ├── auth.routes.ts      # /auth endpoints
│   ├── family.routes.ts    # /family endpoints
│   ├── member.routes.ts    # /members endpoints
│   ├── story.routes.ts     # /stories endpoints
│   ├── chat.routes.ts      # /chat endpoints
│   ├── memory.routes.ts    # /memories endpoints
│   ├── event.routes.ts     # /events endpoints
│   └── search.routes.ts    # /search endpoints
│
├── services/          # Business logic
│   ├── graph.service.ts    # Neo4j operations
│   ├── vector.service.ts   # Qdrant operations
│   ├── agent.service.ts    # Qwen AI operations
│   └── scheduler.service.ts # Cron jobs
│
├── websocket/         # WebSocket handler
│   └── handler.ts     # Real-time events
│
├── utils/             # Utilities
│   └── logger.ts      # Pino logger
│
└── index.ts           # Server entry point
```

### Frontend

```
frontend/src/
├── components/        # React components
│   ├── chat/          # Chat UI components
│   ├── events/        # Event components
│   ├── family/        # Family tree components
│   ├── layout/        # Layout components
│   ├── stories/       # Story components
│   └── ui/            # Reusable UI components
│
├── hooks/             # Custom React hooks
│   └── useWebSocket.ts
│
├── pages/             # Page components
│   ├── Home.tsx
│   ├── Chat.tsx
│   ├── Family.tsx
│   ├── Stories.tsx
│   ├── Events.tsx
│   ├── Search.tsx
│   ├── Login.tsx
│   └── Register.tsx
│
├── services/          # API client services
│   ├── api.ts              # Axios instance
│   ├── auth.service.ts
│   ├── chat.service.ts
│   ├── event.service.ts
│   ├── family.service.ts
│   ├── search.service.ts
│   ├── story.service.ts
│   └── websocket.service.ts
│
├── store/             # Zustand state stores
│   ├── authStore.ts
│   ├── chatStore.ts
│   └── notificationStore.ts
│
├── types/             # TypeScript types
│   └── index.ts
│
├── App.tsx            # Main app with routing
└── main.tsx           # Entry point
```

## Code Style

### TypeScript

- Use strict TypeScript with no `any` where possible
- Prefer interfaces over types for object shapes
- Use Zod for runtime validation

### React

- Use functional components with hooks
- Use TanStack Query for server state
- Use Zustand for client state
- Prefer composition over inheritance

### API Design

- RESTful endpoints
- Zod validation on all inputs
- Consistent error response format
- JWT authentication on protected routes

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Common Tasks

### Adding a New API Endpoint

1. Define types in `models/types.ts`
2. Add database operation in appropriate service
3. Create route handler in `routes/`
4. Register route in `index.ts`

### Adding a New Page

1. Create page component in `pages/`
2. Add route in `App.tsx`
3. Add navigation link in `Sidebar.tsx`
4. Create any needed services in `services/`

### Working with Neo4j

```typescript
// Example: Creating a new node type
const session = getSession();
try {
  await session.run(
    `CREATE (n:NewNode {id: $id, name: $name})`,
    { id, name }
  );
} finally {
  await session.close();
}
```

### Working with Qdrant

```typescript
// Example: Adding vectors
const embedding = await agentService.getEmbedding(text);
await client.upsert(COLLECTION_NAME, {
  points: [{
    id: uuid,
    vector: embedding,
    payload: { ... }
  }]
});
```

## Debugging

### Backend Logs

Logs are written using Pino logger. Set `LOG_LEVEL=debug` for verbose output.

### Neo4j Browser

Access Neo4j browser at http://localhost:7474 (local) or via Aura console.

Useful queries:
```cypher
# View all nodes
MATCH (n) RETURN n LIMIT 100

# View family tree
MATCH (f:Family)<-[:MEMBER_OF]-(p:Person)
RETURN f, p

# View stories with mentions
MATCH (s:Story)-[:MENTIONS]->(p:Person)
RETURN s, p
```

### Frontend DevTools

- React DevTools for component inspection
- TanStack Query DevTools for cache inspection
- Network tab for API debugging

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.
