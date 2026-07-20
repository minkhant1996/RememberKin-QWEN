# Rememberkin - Simulation Test Suite

End-to-end tests for the AI Memory Agent focused on family relationships.

## Overview

These tests validate that the Rememberkin agent can:
1. **Extract** facts, names, dates, preferences from conversations
2. **Store** information in the multi-layer memory system
3. **Recall** information accurately when asked later
4. **Deliver value** by helping users preserve family memories

## Test Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: TELL                                                  │
│  User shares information with the agent                         │
│  Input: Natural conversation with facts embedded                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: EXTRACT                                               │
│  Agent identifies and extracts:                                 │
│  • People (names, relationships)                                │
│  • Dates (birthdays, anniversaries, events)                     │
│  • Preferences (likes, dislikes, favorites)                     │
│  • Events (what happened, when, with whom)                      │
│  • Emotions (how people felt)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: STORE                                                 │
│  Facts flow through memory layers:                              │
│  • Working Memory (immediate context)                           │
│  • Episodic Memory (conversation episodes)                      │
│  • Semantic Memory (consolidated facts)                         │
│  • Procedural Memory (learned patterns)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: RECALL                                                │
│  User asks about previously shared information                  │
│  Agent retrieves from appropriate memory layer                  │
│  Response includes source and confidence                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: VALUE                                                 │
│  Demonstrate tangible user benefits:                            │
│  • Memories preserved forever                                   │
│  • Important dates never forgotten                              │
│  • Family legacy maintained                                     │
│  • Generations connected                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Test Scenarios

| Folder | Type | Scenarios | Description |
|--------|------|-----------|-------------|
| `/family` | 👨‍👩‍👧 Family | 2 | Parents, grandparents, children, traditions |

## Scoring Criteria

Each test is evaluated on 4 dimensions (0-100 scale):

| Metric | What It Measures |
|--------|------------------|
| **Memory Recall** | Did the agent remember facts shared earlier? |
| **Context Relevance** | Were responses relevant to the conversation? |
| **Entity Extraction** | Were people, dates, events correctly identified? |
| **Emotional Tone** | Was the tone appropriate for family context? |

## Running Tests

```bash
# Run all scenarios
curl -X POST http://localhost:6100/api/v1/simulation/run

# Run specific scenario
curl -X POST http://localhost:6100/api/v1/simulation/run/family-memory-recall
curl -X POST http://localhost:6100/api/v1/simulation/run/family-event-tracking

# Watch live results (SSE)
curl http://localhost:6100/api/v1/simulation/events

# Get results
curl http://localhost:6100/api/v1/simulation/results

# Clear all data
curl -X DELETE http://localhost:6100/api/v1/simulation/clear
```

## Test Summary

| # | Scenario | Turns | Persona |
|---|----------|-------|---------|
| 1 | Family Memory Recall | 4 | Grandma Mary |
| 2 | Family Event Tracking | 3 | Busy Dad Mike |

**Total: 2 scenarios, 7 conversation turns**
