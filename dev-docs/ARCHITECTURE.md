# Rememberkin - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REMEMBERKIN                                     │
│                   AI-Powered Family Memory Preservation                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    FRONTEND (React + TypeScript)                     │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │    │
│  │  │   Chat    │ │  Family   │ │  Stories  │ │  Memory   │           │    │
│  │  │ Interface │ │   Tree    │ │  Gallery  │ │ Dashboard │           │    │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                         │    │
│  │  │  Events   │ │Simulation │ │  Search   │                         │    │
│  │  │ Calendar  │ │ Dashboard │ │   Page    │                         │    │
│  │  └───────────┘ └───────────┘ └───────────┘                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   BACKEND (Node.js + TypeScript)                     │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │   REST API  │  │  WebSocket  │  │     SSE     │                  │    │
│  │  │  /api/v1/*  │  │  Real-time  │  │ Simulation  │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  │         │                │                │                          │    │
│  │         └────────────────┼────────────────┘                          │    │
│  │                          ▼                                           │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │                    CORE SERVICES                             │    │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │    │
│  │  │  │  Memory  │ │  Graph   │ │  Agent   │ │  Image   │        │    │    │
│  │  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │        │    │    │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │    │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │    │
│  │  │  │ Privacy  │ │  Event   │ │ Vector   │ │Simulation│        │    │    │
│  │  │  │ Service  │ │Scheduler │ │ Service  │ │ Service  │        │    │    │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                 ┌──────────────────┼──────────────────┐                     │
│                 ▼                  ▼                  ▼                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │    GRAPH DB     │  │   VECTOR DB     │  │   QWEN CLOUD    │             │
│  │    (Neo4j)      │  │   (Qdrant)      │  │   (LLM API)     │             │
│  │                 │  │                 │  │                 │             │
│  │  • Family tree  │  │  • Embeddings   │  │  • Chat (Plus)  │             │
│  │  • Memories     │  │  • Semantic     │  │  • Extraction   │             │
│  │  • Episodes     │  │    search       │  │  • Embeddings   │             │
│  │  • Patterns     │  │  • Episodic     │  │  • Images       │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cloud Deployment Architecture (Alibaba Cloud)

```
                 ┌───────────────────────── Alibaba Cloud ─────────────────────────┐
                 │                                                                  │
  Browser ─────▶ │  OSS Static Hosting ── React build (Vite)                        │
                 │        │  /api/v1/* + /ws                                        │
                 │        ▼                                                         │
                 │  Function Compute 3.0 ── custom container (Serverless Devs)     │
                 │    Express API · WebSocket · cron consolidation jobs            │
                 │    1 warm instance (working memory + cron live in-process)      │
                 │        │                                                         │
                 │        ├──────────────▶ Model Studio / DashScope                │
                 │        │                qwen-plus (chat) · qwen-turbo (extract) │
                 │        │                text-embedding-v3 · qwen-image-2.0      │
                 └────────┼─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     Neo4j Aura (managed)        Qdrant Cloud (managed)
     family graph +              embeddings +
     memory layers 2-4           semantic search
```

- Deployed with the official **Serverless Devs** CLI — see [`s.yaml`](../s.yaml) and [DEPLOYMENT.md](./DEPLOYMENT.md).
- The backend is stateless on disk; all durable memory (layers 2–4) lives in Neo4j + Qdrant, so the container can be rebuilt/redeployed freely.
- Layer 1 (working memory) is intentionally in-process for latency; the deployment pins one warm Function Compute instance so it never fragments and scheduled consolidation always runs.
- An alternative single-ECS Docker Compose topology (self-hosted Neo4j + Qdrant) is documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## 4-Layer Memory System

The core innovation of Rememberkin is its cognitive memory architecture that mimics human memory consolidation:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: WORKING MEMORY (Ephemeral - In-Memory/Session)        │
│  • Current conversation context                                  │
│  • Active entities being discussed                               │
│  • Pending facts awaiting consolidation                          │
│  • TTL: Session duration                                         │
└─────────────────────────────────────────────────────────────────┘
                              │ After each message
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: EPISODIC MEMORY (Short-term - Neo4j + Qdrant)         │
│  • Conversation sessions as episodes                             │
│  • Importance scoring (emotional valence, participants)          │
│  • Access tracking (how often recalled)                          │
│  • TTL: 7-30 days before consolidation                           │
└─────────────────────────────────────────────────────────────────┘
                              │ Consolidation job
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: SEMANTIC MEMORY (Long-term - Neo4j + Qdrant)          │
│  • Consolidated facts with confidence                            │
│  • Reinforcement counting (repeated mentions)                    │
│  • Decay factor for relevance                                    │
│  • TTL: Permanent (with decay)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │ Pattern detection
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: PROCEDURAL MEMORY (Patterns - Neo4j)                  │
│  • Learned behaviors and routines                                │
│  • Trigger-action patterns                                       │
│  • Family preferences                                            │
│  • TTL: Permanent                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Memory Flow Example

```
User says: "Grandma loves apple pie"
         │
         ▼
┌─────────────────────────────┐
│ WORKING MEMORY              │
│ pendingFacts: [{            │
│   fact: "loves apple pie",  │
│   about: "Grandma",         │
│   confidence: 0.9           │
│ }]                          │
└─────────────────────────────┘
         │ Conversation ends
         ▼
┌─────────────────────────────┐
│ EPISODIC MEMORY             │
│ Episode: "Family chat"      │
│ extractedFacts: [...]       │
│ importance: 0.7             │
│ emotionalValence: 0.8       │
└─────────────────────────────┘
         │ Consolidation (manual or scheduled)
         ▼
┌─────────────────────────────┐
│ SEMANTIC MEMORY             │
│ Fact: "Grandma loves apple  │
│        pie"                 │
│ factType: "preference"      │
│ confidence: 0.85            │
│ reinforcementCount: 1       │
└─────────────────────────────┘
         │ If mentioned again
         ▼
┌─────────────────────────────┐
│ REINFORCEMENT               │
│ confidence: 0.85 → 0.92     │
│ reinforcementCount: 1 → 2   │
└─────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript + Vite | SPA with real-time updates |
| UI Library | Tailwind CSS + shadcn/ui | Modern, accessible components |
| State | Zustand + TanStack Query | Client state + server cache |
| Backend | Node.js + Express + TypeScript | REST API + WebSocket + SSE |
| Graph DB | Neo4j Aura (Free) | Family relationships, memories |
| Vector DB | Qdrant (Cloud) | Semantic memory search |
| LLM | Qwen Cloud API | Chat, extraction, embeddings |
| Image Gen | Qwen Image 2.0 | AI-generated family images |
| Auth | JWT + bcrypt | Session management |

## Data Flow

### 1. Story Ingestion Flow
```
User Input (text)
    → Backend API
    → Qwen (extract entities, summarize, detect mood)
    → Graph DB (store story, relationships)
    → Vector DB (store embeddings)
    → Memory Service (extract to working memory)
    → Response to user
```

### 2. Chat Query Flow
```
User Question
    → Backend API
    → Memory Service (get working memory context)
    → Vector DB (semantic search)
    → Graph DB (find relevant facts)
    → Privacy Service (filter by access)
    → Qwen (generate response with context)
    → Memory Service (extract new facts)
    → Response to user
```

### 3. Memory Consolidation Flow
```
Trigger (manual or scheduled)
    → Get unconsolidated episodes
    → Calculate importance scores
    → Extract facts with confidence
    → Check for existing semantic memories
    → If exists: reinforce (increase confidence)
    → If new: create semantic memory
    → Detect patterns → create procedural memory
    → Log activity
```

### 4. Proactive Agent Flow
```
Event Scheduler (cron)
    → Check upcoming events
    → Graph DB (find related people)
    → Privacy Service (check permissions)
    → Send notifications via WebSocket
```

## Directory Structure

```
rememberkin/
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # This file
│   ├── API.md               # API endpoints
│   ├── BACKEND.md           # Backend guide
│   ├── FRONTEND.md          # Frontend guide
│   └── DATABASE.md          # Database schema
├── backend/                 # Node.js + TypeScript backend
│   ├── src/
│   │   ├── config/          # Database and service configs
│   │   ├── middleware/      # Auth, error handling
│   │   ├── models/          # TypeScript types
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utilities
│   │   ├── websocket/       # WebSocket handler
│   │   └── index.ts         # Server entry point
│   └── package.json
├── frontend/                # React + TypeScript frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API clients
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   └── App.tsx          # Root component
│   └── package.json
├── test-scripts/            # Test scripts and simulations
│   └── simulation/
│       └── family/          # Family test scenarios
└── README.md
```

## Key Features

### 1. Multi-Layer Memory System
- **Working**: Current conversation context
- **Episodic**: Conversation sessions as episodes
- **Semantic**: Consolidated facts with confidence
- **Procedural**: Learned patterns and routines

### 2. Memory Consolidation
- Automatic fact extraction from conversations
- Confidence scoring based on repetition
- Decay over time for unused memories
- Pattern detection for procedural memory

### 3. Privacy Compartments
- Role-based access control on graph nodes
- Inheritance through family tree
- Explicit visibility rules per story/memory

### 4. Proactive Agent
- Birthday/event reminders
- Connection suggestions
- Memory reinforcement prompts

### 5. Real-time Features
- WebSocket for live updates
- SSE for simulation streaming
- Activity feeds

### 6. AI-Powered Features
- Natural language chat with memory context
- Automatic entity extraction
- Story summarization and mood detection
- AI image generation for family portraits

## Qwen AI Models Used

| Task | Model | Cost |
|------|-------|------|
| Chat | qwen-plus | $0.8/M input, $2/M output |
| Extraction | qwen-plus | $0.8/M input, $2/M output |
| Embeddings | text-embedding-v3 | $0.35/M tokens |
| Images | qwen-image-2.0 | $0.035/image |
| Scoring | qwen-turbo | $0.3/M input, $0.6/M output |

### Scaling notes

The current design is intentionally **single-instance**: working memory (per-session pending facts) and the rate-limit counters live in process memory, so two backend replicas would neither share sessions nor enforce a combined rate limit. Long-term state (Neo4j graph, Qdrant vectors, budget meter) is already external, so the path to horizontal scale-out is moving working memory and rate limiting to Redis (or making sessions sticky), after which the API layer is stateless and can run N replicas behind a load balancer. For the hackathon demo scale (one family, a few concurrent users), the single-instance trade-off is deliberate — it keeps the memory pipeline simple and observable.
