# Test Checklist

Comprehensive testing guide for Rememberkin.

## Test Categories

1. [API Tests](#api-tests) - Backend endpoint testing
2. [Database Tests](#database-tests) - Neo4j and Qdrant operations
3. [Integration Tests](#integration-tests) - End-to-end flows
4. [Frontend Tests](#frontend-tests) - UI component testing
5. [WebSocket Tests](#websocket-tests) - Real-time features
6. [Performance Tests](#performance-tests) - Load and stress testing

---

## API Tests

### Authentication (`/api/v1/auth`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| Register new user | POST /auth/register | 201, returns user + token |
| Register duplicate email | POST /auth/register | 409, conflict error |
| Register invalid email | POST /auth/register | 400, validation error |
| Register short password | POST /auth/register | 400, validation error |
| Login valid credentials | POST /auth/login | 200, returns user + token |
| Login wrong password | POST /auth/login | 401, unauthorized |
| Login non-existent user | POST /auth/login | 401, unauthorized |
| Access protected route without token | GET /family | 401, unauthorized |
| Access protected route with invalid token | GET /family | 401, unauthorized |
| Access protected route with expired token | GET /family | 401, unauthorized |

### Family (`/api/v1/family`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| Get family (has family) | GET /family | 200, returns family |
| Get family (no family) | GET /family | 200, returns null |
| Create family | POST /family | 201, returns family |
| Get family tree | GET /family/tree | 200, returns nodes + edges |
| Get empty family tree | GET /family/tree | 200, returns empty arrays |
| Invite existing user | POST /family/invite | 200, member added |
| Invite non-existent user | POST /family/invite | 404, user not found |
| Invite already member | POST /family/invite | 400, already member |

### Members (`/api/v1/members`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| List members | GET /members | 200, returns member array |
| Get member by ID | GET /members/:id | 200, returns member |
| Get non-existent member | GET /members/:id | 404, not found |
| Update own profile | PUT /members/:id | 200, returns updated |
| Update other's profile | PUT /members/:id | 403, forbidden |
| Get relationship path | GET /members/:id/relationship | 200, returns path |

### Stories (`/api/v1/stories`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| List stories | GET /stories | 200, returns paginated |
| List stories page 2 | GET /stories?page=2 | 200, returns page 2 |
| Get single story | GET /stories/:id | 200, returns story |
| Get non-existent story | GET /stories/:id | 404, not found |
| Create story | POST /stories | 201, returns story with AI summary |
| Create story extracts mentions | POST /stories | 201, mentions populated |
| Create story extracts memories | POST /stories | 201, memories created |
| Delete own story | DELETE /stories/:id | 204, no content |
| Delete other's story | DELETE /stories/:id | 403, forbidden |
| React to story | POST /stories/:id/react | 200, reaction added |
| Remove reaction | DELETE /stories/:id/react | 204, no content |
| Get story reactions | GET /stories/:id/reactions | 200, returns reactions |

### Chat (`/api/v1/chat`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| Send message | POST /chat | 200, returns AI response |
| Send message with history | POST /chat | 200, context-aware response |
| Send empty message | POST /chat | 400, validation error |
| Extract entities | POST /chat/extract | 200, returns entities |
| Extract entities matches family | POST /chat/extract | 200, matched IDs present |

### Memories (`/api/v1/memories`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| List memories | GET /memories | 200, returns memories |
| Filter by person | GET /memories?about=:id | 200, filtered results |
| Filter by confidence | GET /memories?minConfidence=0.9 | 200, filtered results |
| Create memory | POST /memories | 201, returns memory |
| Delete own family memory | DELETE /memories/:id | 204, no content |
| Delete other family memory | DELETE /memories/:id | 403, forbidden |

### Events (`/api/v1/events`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| List upcoming events | GET /events | 200, returns events |
| Filter by days | GET /events?days=7 | 200, filtered results |
| Filter by type | GET /events?type=birthday | 200, filtered results |
| Create event | POST /events | 201, returns event |
| Update event | PUT /events/:id | 200, returns updated |
| Delete event | DELETE /events/:id | 204, no content |
| Event has daysUntil | GET /events | 200, daysUntil calculated |

### Search (`/api/v1/search`)

| Test | Endpoint | Expected Result |
|------|----------|-----------------|
| Search all | GET /search?q=grandma | 200, returns results |
| Search stories only | GET /search?q=grandma&types=stories | 200, only stories |
| Search memories only | GET /search?q=grandma&types=memories | 200, only memories |
| Search short query | GET /search?q=a | 400, min 2 chars |
| Search returns relevance | GET /search?q=test | 200, relevance scores |

---

## Database Tests

### Neo4j Operations

| Test | Description |
|------|-------------|
| Create person node | Person created with all properties |
| Create family node | Family created with timestamp |
| Create MEMBER_OF relationship | Person linked to family |
| Create PARENT_OF relationship | Parent-child link created |
| Create SPOUSE_OF relationship | Spouse link created |
| Create SIBLING_OF relationship | Sibling link created |
| Query family tree | Returns correct graph structure |
| Story visibility filtering | Hidden stories not returned |
| Cascade delete | Deleting story removes relationships |

### Qdrant Operations

| Test | Description |
|------|-------------|
| Index story vector | Vector stored with metadata |
| Index memory vector | Vector stored with metadata |
| Search by similarity | Returns relevant results |
| Delete vector | Vector removed from collection |
| Filter by family | Only family vectors returned |

---

## Integration Tests

### User Registration Flow

1. Register new user
2. Verify JWT token valid
3. Create family
4. Verify user linked to family
5. Logout and login again
6. Verify family still linked

### Story Creation Flow

1. Login as user
2. Create story with content
3. Verify AI summary generated
4. Verify mood and topics extracted
5. Verify mentions extracted and linked
6. Verify memories created
7. Verify story searchable

### Family Invitation Flow

1. User A creates family
2. User B registers
3. User A invites User B
4. User B now in family
5. User B can see family stories
6. Family tree shows both users

### Chat Context Flow

1. Create stories about grandma
2. Create memories about grandma
3. Ask "tell me about grandma"
4. Verify response includes story/memory context
5. Verify related stories returned

---

## Frontend Tests

### Components

| Component | Tests |
|-----------|-------|
| LoginForm | Valid submission, validation errors, loading state |
| RegisterForm | Valid submission, validation errors, password match |
| ChatWindow | Send message, display response, suggested prompts |
| ChatInput | Input handling, submit on enter, disabled state |
| StoryCard | Display content, author, mentions, reactions |
| StoryCreateModal | Form validation, submit, close |
| EventCard | Display details, countdown, involved people |
| EventCreateModal | Form validation, type selection, date picker |
| FamilyTreeVisualization | Render nodes, render edges, zoom/pan |
| SearchResults | Display results, filter tabs, relevance indicator |
| Modal | Open/close, escape key, backdrop click |

### Pages

| Page | Tests |
|------|-------|
| Home | Load stats, recent stories, upcoming events |
| Chat | Send/receive messages, history persistence |
| Family | Tree visualization, member list, add member |
| Stories | Pagination, create modal, empty state |
| Events | Month grouping, create modal, empty state |
| Search | Query input, results display, filtering |
| Login | Form submission, error display, redirect |
| Register | Form submission, error display, redirect |

### State Management

| Store | Tests |
|-------|-------|
| authStore | Login, logout, token persistence |
| chatStore | Add message, clear, loading state |
| notificationStore | Add, mark read, clear |

---

## WebSocket Tests

| Test | Description |
|------|-------------|
| Connect with valid token | Connection established |
| Connect without token | Connection rejected (4001) |
| Connect with invalid token | Connection rejected (4001) |
| Join family room | Successfully joins room |
| Receive member:online | Notification when member joins |
| Receive member:offline | Notification when member leaves |
| Receive story:created | Notification for new story |
| Receive reminder | Event reminder notification |
| Send presence update | Other members receive update |
| Send typing indicator | Other members see typing |
| Reconnect on disconnect | Auto-reconnect with backoff |
| Heartbeat keeps alive | Connection maintained |

---

## Performance Tests

| Test | Target |
|------|--------|
| API response time | < 200ms for simple queries |
| Story creation time | < 3s (includes AI processing) |
| Search response time | < 500ms |
| WebSocket message latency | < 100ms |
| Concurrent users | 100 simultaneous connections |
| Story load time | < 1s for 20 stories |
| Family tree render | < 500ms for 50 nodes |

---

## Test Scripts

Run test scripts from the `test-scripts` directory:

```bash
# API tests
./run-api-tests.sh

# WebSocket tests
node test-websocket.js

# Database tests
./run-db-tests.sh

# Full test suite
npm test
```

---

## Manual Testing Checklist

### Before Release

- [ ] All API endpoints return correct status codes
- [ ] Authentication flow works (register, login, logout)
- [ ] Story creation extracts entities correctly
- [ ] Chat responds with relevant context
- [ ] Search returns relevant results
- [ ] WebSocket connects and receives messages
- [ ] Family tree renders correctly
- [ ] Events show countdown correctly
- [ ] Mobile responsive design works
- [ ] Error messages are user-friendly
- [ ] Loading states display correctly
- [ ] Empty states display correctly
