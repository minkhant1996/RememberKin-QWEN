# Rememberkin - Database Schema & Design

## Overview

Rememberkin uses a **hybrid database architecture**:
- **Neo4j (Graph DB)**: Family relationships, permissions, events
- **Qdrant (Vector DB)**: Story embeddings for semantic search
- **Redis (Cache)**: Session data, rate limiting

## Neo4j Graph Schema

### Node Types

```cypher
// Person Node
(:Person {
  id: string,           // UUID
  name: string,
  nickname: string?,
  birthDate: date?,
  email: string?,
  phone: string?,
  avatar: string?,      // URL to image
  preferences: map,     // { "pie": "apple", "callTime": "Sunday" }
  createdAt: datetime,
  updatedAt: datetime
})

// Story Node
(:Story {
  id: string,           // UUID
  content: string,      // Full text content
  summary: string?,     // AI-generated summary
  mood: string?,        // "happy", "nostalgic", "funny"
  topics: [string],     // ["wedding", "childhood", "war"]
  mediaUrls: [string],  // Attached photos/audio
  vectorId: string,     // Reference to Qdrant vector
  createdAt: datetime,
  updatedAt: datetime
})

// Event Node
(:Event {
  id: string,
  type: string,         // "birthday", "anniversary", "surgery", "custom"
  title: string,
  description: string?,
  date: date,
  recurring: boolean,   // For birthdays, anniversaries
  reminderDays: [int],  // [7, 1, 0] = remind 7 days, 1 day, and day of
  createdAt: datetime
})

// Memory Node (extracted facts)
(:Memory {
  id: string,
  fact: string,         // "Grandma's favorite color is blue"
  confidence: float,    // 0.0 - 1.0
  source: string,       // Story ID or "direct_input"
  createdAt: datetime
})

// Family Node (family group)
(:Family {
  id: string,
  name: string,         // "The Smith Family"
  createdAt: datetime
})
```

### Relationship Types

```cypher
// Family Relationships
(:Person)-[:PARENT_OF]->(:Person)
(:Person)-[:SPOUSE_OF]->(:Person)
(:Person)-[:SIBLING_OF]->(:Person)
(:Person)-[:MEMBER_OF]->(:Family)

// Story Relationships
(:Person)-[:TOLD_STORY { date: datetime }]->(:Story)
(:Story)-[:MENTIONS]->(:Person)
(:Story)-[:ABOUT_EVENT]->(:Event)
(:Person)-[:REACTED_TO { emoji: string, date: datetime }]->(:Story)

// Memory Relationships
(:Memory)-[:ABOUT]->(:Person)
(:Memory)-[:EXTRACTED_FROM]->(:Story)

// Event Relationships
(:Event)-[:INVOLVES]->(:Person)
(:Person)-[:REMINDED_OF]->(:Event)

// Privacy Relationships
(:Story)-[:VISIBLE_TO]->(:Person)
(:Story)-[:HIDDEN_FROM]->(:Person)
(:Memory)-[:VISIBLE_TO]->(:Person)

// Interaction Tracking
(:Person)-[:LAST_CONTACTED { date: datetime, method: string }]->(:Person)
```

### Indexes

```cypher
// Create indexes for performance
CREATE INDEX person_id FOR (p:Person) ON (p.id);
CREATE INDEX person_email FOR (p:Person) ON (p.email);
CREATE INDEX story_id FOR (s:Story) ON (s.id);
CREATE INDEX event_date FOR (e:Event) ON (e.date);
CREATE INDEX memory_id FOR (m:Memory) ON (m.id);

// Full-text search index
CREATE FULLTEXT INDEX story_content FOR (s:Story) ON EACH [s.content, s.summary];
```

## Common Queries

### 1. Get Family Tree
```cypher
MATCH (root:Person {id: $personId})
MATCH path = (root)-[:PARENT_OF|SPOUSE_OF|SIBLING_OF*1..4]-(relative)
RETURN path
```

### 2. Get Stories Mentioning a Person
```cypher
MATCH (p:Person {id: $personId})<-[:MENTIONS]-(s:Story)
MATCH (author:Person)-[:TOLD_STORY]->(s)
WHERE (s)-[:VISIBLE_TO]->(:Person {id: $currentUserId})
   OR NOT EXISTS((s)-[:VISIBLE_TO]->())
RETURN s, author
ORDER BY s.createdAt DESC
LIMIT 20
```

### 3. Get Upcoming Events for Family
```cypher
MATCH (user:Person {id: $userId})-[:MEMBER_OF]->(f:Family)
MATCH (f)<-[:MEMBER_OF]-(member:Person)
MATCH (e:Event)-[:INVOLVES]->(member)
WHERE e.date >= date() AND e.date <= date() + duration('P30D')
RETURN e, member
ORDER BY e.date
```

### 4. Find Relationship Path
```cypher
MATCH (a:Person {id: $personAId}), (b:Person {id: $personBId})
MATCH path = shortestPath((a)-[:PARENT_OF|SPOUSE_OF|SIBLING_OF*]-(b))
RETURN path
```

### 5. Get Memories About a Person
```cypher
MATCH (p:Person {id: $personId})<-[:ABOUT]-(m:Memory)
WHERE (m)-[:VISIBLE_TO]->(:Person {id: $currentUserId})
   OR NOT EXISTS((m)-[:VISIBLE_TO]->())
RETURN m
ORDER BY m.confidence DESC
```

### 6. Privacy Check Query
```cypher
// Check if user can access a story
MATCH (s:Story {id: $storyId}), (u:Person {id: $userId})
OPTIONAL MATCH (s)-[:VISIBLE_TO]->(allowed:Person)
OPTIONAL MATCH (s)-[:HIDDEN_FROM]->(denied:Person)
WITH s, u, collect(allowed) as allowedList, collect(denied) as deniedList
RETURN
  CASE
    WHEN u IN deniedList THEN false
    WHEN size(allowedList) = 0 THEN true  // No restrictions = public to family
    WHEN u IN allowedList THEN true
    ELSE false
  END as canAccess
```

## Qdrant Vector Schema

### Collection: `stories`

```json
{
  "collection_name": "stories",
  "vectors": {
    "size": 1536,
    "distance": "Cosine"
  },
  "payload_schema": {
    "story_id": "keyword",
    "author_id": "keyword",
    "family_id": "keyword",
    "topics": "keyword[]",
    "created_at": "datetime",
    "visible_to": "keyword[]"
  }
}
```

### Search Query Example

```typescript
// Semantic search with privacy filter
const searchResult = await qdrant.search('stories', {
  vector: queryEmbedding,
  filter: {
    should: [
      { is_empty: { key: 'visible_to' } },  // Public stories
      { match: { key: 'visible_to', value: currentUserId } }  // Visible to user
    ]
  },
  limit: 10
});
```

## Redis Cache Schema

### Keys

```
# Session tokens
session:{sessionId} -> { userId, familyId, expiresAt }

# Rate limiting
ratelimit:{userId}:{endpoint} -> count (TTL: 60s)

# Cached queries
cache:family:{familyId}:tree -> serialized family tree (TTL: 5min)
cache:user:{userId}:events -> upcoming events (TTL: 1min)

# Real-time presence
presence:{familyId}:{userId} -> { online: true, lastSeen } (TTL: 30s)
```

## Data Migration Scripts

### Initialize Neo4j Database

```cypher
// Create constraints
CREATE CONSTRAINT person_id_unique FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT story_id_unique FOR (s:Story) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT event_id_unique FOR (e:Event) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT family_id_unique FOR (f:Family) REQUIRE f.id IS UNIQUE;

// Create indexes
CREATE INDEX person_email FOR (p:Person) ON (p.email);
CREATE INDEX event_date FOR (e:Event) ON (e.date);
CREATE FULLTEXT INDEX story_search FOR (s:Story) ON EACH [s.content, s.summary];
```

### Sample Data Seeding

```cypher
// Create a sample family
CREATE (f:Family {id: 'fam-001', name: 'The Smith Family', createdAt: datetime()})

CREATE (grandma:Person {
  id: 'p-001',
  name: 'Mary Smith',
  nickname: 'Grandma Mary',
  birthDate: date('1945-03-15'),
  preferences: { favoritePie: 'apple', callTime: 'Sunday afternoon' },
  createdAt: datetime()
})

CREATE (mom:Person {
  id: 'p-002',
  name: 'Susan Johnson',
  birthDate: date('1970-07-22'),
  email: 'susan@email.com',
  createdAt: datetime()
})

CREATE (uncle:Person {
  id: 'p-003',
  name: 'Joe Smith',
  nickname: 'Uncle Joe',
  birthDate: date('1968-11-08'),
  preferences: { preferredContact: 'phone', bestTime: 'Sunday' },
  createdAt: datetime()
})

CREATE (user:Person {
  id: 'p-004',
  name: 'Alex Johnson',
  email: 'alex@email.com',
  createdAt: datetime()
})

// Create relationships
CREATE (grandma)-[:MEMBER_OF]->(f)
CREATE (mom)-[:MEMBER_OF]->(f)
CREATE (uncle)-[:MEMBER_OF]->(f)
CREATE (user)-[:MEMBER_OF]->(f)
CREATE (grandma)-[:PARENT_OF]->(mom)
CREATE (grandma)-[:PARENT_OF]->(uncle)
CREATE (mom)-[:SIBLING_OF]->(uncle)
CREATE (mom)-[:PARENT_OF]->(user)

// Create a sample story
CREATE (story:Story {
  id: 's-001',
  content: 'I remember when your grandfather proposed to me. It was a rainy day in April 1964...',
  summary: 'Grandma recalls grandpa\'s proposal in 1964',
  mood: 'nostalgic',
  topics: ['wedding', 'grandpa', 'love'],
  createdAt: datetime()
})

CREATE (grandma)-[:TOLD_STORY {date: datetime()}]->(story)
CREATE (story)-[:MENTIONS]->(grandma)

// Create an event
CREATE (birthday:Event {
  id: 'e-001',
  type: 'birthday',
  title: 'Grandma Mary\'s Birthday',
  date: date('2026-03-15'),
  recurring: true,
  reminderDays: [7, 1, 0],
  createdAt: datetime()
})

CREATE (birthday)-[:INVOLVES]->(grandma)
```
