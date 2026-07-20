# Rememberkin - API Documentation

## Base URL

```
Development: http://localhost:6100/api/v1
Production: https://api.rememberkin.com/api/v1
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### Auth

#### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@email.com",
  "password": "securepassword123",
  "name": "John Smith"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "p-004",
    "email": "user@email.com",
    "name": "John Smith"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /auth/login
Login with email and password.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "p-004",
    "email": "user@email.com",
    "name": "John Smith",
    "familyId": "fam-001"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /auth/logout
Logout and invalidate token.

**Response:** `200 OK`

---

### Family

#### GET /family
Get current user's family.

**Response:** `200 OK`
```json
{
  "id": "fam-001",
  "name": "The Smith Family",
  "memberCount": 4,
  "createdAt": "2026-01-15T10:30:00Z"
}
```

#### POST /family
Create a new family.

**Request:**
```json
{
  "name": "The Smith Family"
}
```

#### POST /family/invite
Invite a member to the family.

**Request:**
```json
{
  "email": "relative@email.com",
  "relationship": "uncle",
  "relatedTo": "p-004"
}
```

#### GET /family/tree
Get the family tree graph.

**Response:** `200 OK`
```json
{
  "nodes": [
    {
      "id": "p-001",
      "name": "Mary Smith",
      "nickname": "Grandma Mary",
      "birthDate": "1945-03-15",
      "avatar": "https://..."
    }
  ],
  "edges": [
    {
      "from": "p-001",
      "to": "p-002",
      "relationship": "PARENT_OF"
    }
  ]
}
```

---

### Members

#### GET /members
Get all family members.

#### GET /members/:id
Get a specific family member with their stories and memories count.

#### PUT /members/:id
Update a family member's profile.

#### GET /members/:id/relationship
Get relationship path from current user to member.

---

### Stories

#### GET /stories
Get stories (paginated).

**Query Params:**
- `page` (default: 1)
- `limit` (default: 20)
- `author` (optional): Filter by author ID
- `mentions` (optional): Filter by mentioned person ID
- `topic` (optional): Filter by topic

#### POST /stories
Create a new story. AI automatically extracts entities, summarizes, and detects mood.

**Request:**
```json
{
  "content": "Today grandma told me about her first job at the bakery...",
  "authorId": "p-001",
  "visibility": {
    "type": "specific",
    "allowedUsers": ["p-002", "p-004"]
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "s-002",
  "content": "Today grandma told me about her first job...",
  "summary": "Grandma's memories of working at a bakery",
  "mood": "happy",
  "topics": ["work", "bakery", "youth"],
  "mentions": [],
  "createdAt": "2026-01-15T10:30:00Z"
}
```

#### GET /stories/:id
Get a specific story.

#### DELETE /stories/:id
Delete a story.

#### POST /stories/:id/react
React to a story with an emoji.

---

### Chat (AI Agent)

#### POST /chat
Send a message to the Rememberkin AI agent.

**Request:**
```json
{
  "message": "What stories did grandma tell about Uncle Joe?",
  "history": [],
  "sessionId": "optional-session-id"
}
```

**Response:** `200 OK`
```json
{
  "response": "Grandma Mary told 3 stories mentioning Uncle Joe...",
  "sessionId": "session-123",
  "relatedStories": [
    {
      "id": "s-003",
      "summary": "Uncle Joe's bike accident when he was 8"
    }
  ],
  "suggestedActions": [
    {
      "type": "view_story",
      "storyId": "s-003",
      "label": "Read full story"
    }
  ],
  "usage": {
    "model": "qwen-plus",
    "tokenUsage": { "input": 150, "output": 80, "total": 230 },
    "costEstimate": { "totalCost": 0.0002 },
    "latencyMs": 1200
  }
}
```

#### POST /chat/extract
Extract entities and facts from text.

**Request:**
```json
{
  "content": "Grandma said her favorite pie is apple and she likes calls on Sunday afternoons",
  "sourceType": "conversation"
}
```

**Response:** `200 OK`
```json
{
  "extractedMemories": [
    {
      "fact": "Grandma's favorite pie is apple",
      "about": "p-001",
      "confidence": 0.95
    }
  ],
  "extractedEntities": [
    { "name": "Grandma", "matchedPerson": "p-001" }
  ]
}
```

---

### Memories

#### GET /memories
Get extracted memories/facts.

**Query Params:**
- `about` (optional): Person ID
- `minConfidence` (default: 0.7)

#### POST /memories
Manually add a memory.

#### DELETE /memories/:id
Delete a memory.

---

### Events

#### GET /events
Get upcoming events.

**Query Params:**
- `days` (default: 30): How many days ahead to look
- `type` (optional): Filter by event type (`birthday`, `anniversary`, `surgery`, `custom`)

#### POST /events
Create a new event.

**Request:**
```json
{
  "type": "birthday",
  "title": "Grandma Mary's Birthday",
  "date": "2026-03-15",
  "involves": ["p-001"],
  "recurring": true,
  "reminderDays": [7, 3, 1, 0]
}
```

#### PUT /events/:id
Update an event.

#### DELETE /events/:id
Delete an event.

---

### Search

#### GET /search
Semantic search across stories and memories.

**Query Params:**
- `q` (required): Search query (min 2 characters)
- `types` (optional): Comma-separated list (`stories,memories`)
- `limit` (optional, default: 10, max: 50)

**Response:** `200 OK`
```json
{
  "results": [
    {
      "type": "story",
      "id": "s-005",
      "content": "Your grandfather served in Korea in 1952...",
      "relevance": 0.94
    },
    {
      "type": "memory",
      "id": "m-012",
      "fact": "Grandpa received a Purple Heart",
      "relevance": 0.87
    }
  ]
}
```

---

### Memory Dashboard (4-Layer Memory System)

#### GET /memory-dashboard/stats
Get statistics for all memory layers.

**Response:** `200 OK`
```json
{
  "working": {
    "count": 2,
    "pendingFacts": 5,
    "activeEntities": 3
  },
  "episodic": {
    "count": 24,
    "unconsolidated": 8,
    "avgImportance": 0.72
  },
  "semantic": {
    "count": 156,
    "avgConfidence": 0.85,
    "totalReinforcements": 45
  },
  "procedural": {
    "count": 8,
    "avgConfidence": 0.78
  },
  "lastUpdated": "2026-01-15T10:30:00Z"
}
```

#### GET /memory-dashboard/working
Get current working memory state.

**Response:** `200 OK`
```json
{
  "sessions": 2,
  "pendingFacts": [
    {
      "id": "pf-001",
      "fact": "Grandma likes apple pie",
      "aboutName": "Mary",
      "confidence": 0.9,
      "extractedAt": "2026-01-15T10:30:00Z"
    }
  ],
  "activeEntities": [
    {
      "id": "p-001",
      "name": "Mary",
      "type": "person",
      "mentionCount": 3
    }
  ],
  "currentTopics": ["recipes", "family traditions"]
}
```

#### GET /memory-dashboard/episodic
Get episodic memories (conversation episodes).

**Query Params:**
- `limit` (default: 20)
- `unconsolidatedOnly` (default: false)
- `minImportance` (optional)

#### GET /memory-dashboard/semantic
Get semantic memories (consolidated facts).

**Query Params:**
- `limit` (default: 20)
- `aboutId` (optional): Filter by person
- `factType` (optional): `preference`, `trait`, `biographical`, `relationship`
- `minConfidence` (optional)

#### GET /memory-dashboard/procedural
Get procedural memories (learned patterns).

#### GET /memory-dashboard/activity
Get recent memory activity feed.

**Query Params:**
- `limit` (default: 20)

**Response:** `200 OK`
```json
{
  "activities": [
    {
      "id": "act-001",
      "type": "extracted",
      "description": "Extracted: Grandma's favorite pie is apple",
      "fromLayer": "working",
      "confidence": 0.9,
      "timestamp": "2026-01-15T10:30:00Z"
    },
    {
      "id": "act-002",
      "type": "consolidated",
      "description": "Consolidated to semantic memory",
      "fromLayer": "episodic",
      "toLayer": "semantic",
      "confidence": 0.95,
      "timestamp": "2026-01-15T10:25:00Z"
    }
  ]
}
```

#### POST /memory-dashboard/consolidate
Manually trigger memory consolidation.

**Response:** `200 OK`
```json
{
  "processed": 10,
  "consolidated": 5,
  "reinforced": 3,
  "skipped": 2
}
```

---

### Simulation (Testing)

#### GET /simulation/scenarios
Get all available test scenarios.

**Response:** `200 OK`
```json
{
  "scenarios": [
    {
      "id": "family-memory-recall",
      "name": "Family Memory Recall",
      "description": "Tests if agent remembers family facts",
      "userPersona": {
        "id": "grandma-mary",
        "name": "Grandma Mary",
        "description": "75-year-old grandmother"
      },
      "conversationTurns": 4,
      "evaluationCriteria": [
        "Agent remembers family member names",
        "Agent recalls relationships correctly"
      ]
    }
  ]
}
```

#### GET /simulation/state
Get current simulation state.

#### GET /simulation/results
Get simulation results.

#### POST /simulation/run
Run all test scenarios.

#### POST /simulation/run/:scenarioId
Run a specific test scenario.

#### GET /simulation/events
Server-Sent Events (SSE) for live simulation updates.

**Event Types:**
- `state`: Current simulation state
- `turn`: New conversation turn
- `scenario:complete`: Scenario finished
- `simulation:complete`: All scenarios finished

#### DELETE /simulation/clear
Clear all simulation data.

---

### Images (AI Generation)

#### POST /images/generate
Generate an image from a text prompt.

**Request:**
```json
{
  "prompt": "A warm family gathering around a dinner table",
  "model": "qwen-image-2.0",
  "size": "1024x1024"
}
```

**Response:** `200 OK`
```json
{
  "images": [
    { "url": "https://..." }
  ],
  "model": "qwen-image-2.0",
  "cost": 0.035,
  "latencyMs": 6000
}
```

#### POST /images/memory
Generate an image for a family memory.

**Request:**
```json
{
  "description": "Grandma teaching grandson to ride a bike",
  "style": "photorealistic"
}
```

#### POST /images/portrait
Generate a family portrait.

**Request:**
```json
{
  "members": "grandmother, mother, and young grandson",
  "location": "in a sunny backyard"
}
```

#### POST /images/celebration
Generate a celebration image.

**Request:**
```json
{
  "event": "80th Birthday",
  "members": "grandmother surrounded by family"
}
```

#### POST /images/template
Generate from a template.

**Request:**
```json
{
  "category": "family",
  "template": "portrait",
  "variables": {
    "members": "three generations",
    "location": " at the beach"
  }
}
```

#### GET /images/templates
Get available prompt templates.

#### GET /images/models
Get available image generation models with pricing.

---

### Usage Tracking

#### GET /usage/pricing
Get model pricing information.

**Response:** `200 OK`
```json
{
  "models": [
    {
      "id": "qwen-plus",
      "name": "Qwen Plus",
      "inputPricePerMillion": 0.8,
      "outputPricePerMillion": 2.0,
      "category": "chat"
    },
    {
      "id": "qwen-image-2.0",
      "name": "Qwen Image 2.0",
      "pricePerImage": 0.035,
      "category": "image"
    }
  ]
}
```

---

## WebSocket Events

Connect to: `ws://localhost:6100/ws`

### Client → Server

```json
// Join family room
{ "type": "join", "familyId": "fam-001" }

// Send presence update
{ "type": "presence", "status": "online" }

// Typing indicator
{ "type": "typing", "storyId": "s-001" }
```

### Server → Client

```json
// New story added
{ "type": "story:created", "story": { ... } }

// Member came online
{ "type": "member:online", "memberId": "p-002" }

// Event reminder
{ "type": "reminder", "event": { ... }, "message": "Grandma's birthday is tomorrow!" }

// Proactive agent suggestion
{ "type": "agent:suggestion", "message": "You haven't talked to Uncle Joe in 2 weeks..." }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "details": {}
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Invalid or missing auth token |
| FORBIDDEN | 403 | User doesn't have permission |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request body |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
