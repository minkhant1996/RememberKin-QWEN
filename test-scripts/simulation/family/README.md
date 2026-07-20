# 👨‍👩‍👧 Family Test Cases

Tests for family relationship memory - parents, grandparents, children, traditions, and heritage.

---

## Test Case 1: Family Memory Recall

### Overview
| Field | Value |
|-------|-------|
| **ID** | `family-memory-recall` |
| **Persona** | Grandma Mary (75 years old) |
| **Conversation Turns** | 4 |
| **Focus** | Remembering family stories and details |

### Persona Profile
```
Name: Grandma Mary
Age: 75
Role: Grandmother who loves sharing family stories
Personality: Warm, nostalgic, sometimes forgetful, loves grandchildren
```

### Test Flow

#### PHASE 1: TELL (User Input)
```
Turn 1: "Oh, I want to tell you about when little Tommy first learned
        to ride a bike!"

Turn 2: "It was June 5th, and his grandpa John was so patient with him.
        Tommy fell three times but never gave up!"

Turn 3: "Do you remember what I told you about my apple pie recipe?
        The secret is a hint of lemon zest."
```

#### PHASE 2: EXTRACT (What Agent Should Learn)
```
✅ People:
   • Tommy (grandchild)
   • John (grandpa/husband)
   • Mary (narrator/grandma)

✅ Events:
   • Tommy learned to ride bike - June 5th
   • Tommy fell 3 times but persevered

✅ Relationships:
   • John helped Tommy (grandfather-grandson)
   • Mary is Tommy's grandmother

✅ Facts:
   • Apple pie recipe has lemon zest (secret ingredient)

✅ Emotions:
   • Pride, determination, patience
```

#### PHASE 3: STORE (Memory Layers)
```
Working Memory:
  → Current topic: Tommy's bike story
  → Active entities: Tommy, John, Mary

Episodic Memory:
  → Episode: "Grandma shares Tommy's bike story"
  → Importance: HIGH (milestone moment)
  → Emotional valence: Positive (pride, joy)

Semantic Memory:
  → Fact: "Tommy learned to ride bike on June 5th"
  → Fact: "Grandpa John taught Tommy"
  → Fact: "Mary's apple pie has lemon zest"
```

#### PHASE 4: RECALL (Test Questions)
```
Q: "When did Tommy learn to ride his bike?"
A: "Tommy learned to ride his bike on June 5th! His grandpa John
    helped him, and even though he fell three times, he never gave up.
    Such a determined little one! 🚲"
   [Source: Semantic Memory, Confidence: 95%]

Q: "What's special about your apple pie?"
A: "The secret is a hint of lemon zest! It adds a lovely brightness
    to the pie."
   [Source: Semantic Memory, Confidence: 90%]
```

#### PHASE 5: VALUE (User Benefits)
```
✨ Memories Preserved:
   • Tommy's first bike ride - forever documented
   • Family tradition (grandpa teaching grandson)
   • Secret family recipe saved

✨ Connections Tracked:
   • Tommy ↔ Grandpa John (learning moment)
   • Family milestone captured with date

✨ Emotional Context:
   • Pride and determination remembered
   • Can be shared with future generations
```

### Evaluation Criteria
| Criteria | Weight | Description |
|----------|--------|-------------|
| Agent remembers family member names | 30% | Tommy, John correctly recalled |
| Agent recalls relationships correctly | 30% | Grandfather-grandson bond |
| Agent references previous family stories | 40% | Connects bike story to family context |

---

## Test Case 2: Family Event Tracking

### Overview
| Field | Value |
|-------|-------|
| **ID** | `family-event-tracking` |
| **Persona** | Busy Dad Mike (42 years old) |
| **Conversation Turns** | 3 |
| **Focus** | Tracking family events, schedules, reminders |

### Persona Profile
```
Name: Mike (Busy Dad)
Age: 42
Role: Father managing work and family
Personality: Efficient, caring but stressed, wants quick answers
```

### Test Flow

#### PHASE 1: TELL (User Input)
```
Turn 1: "What events do we have coming up this month?"

Turn 2: "Did my wife mention anything about Emma's school play?
        I think it's on the 15th."

Turn 3: "I need to remember to pick up the cake for Dad's birthday.
        He turns 70 on Saturday!"
```

#### PHASE 2: EXTRACT (What Agent Should Learn)
```
✅ People:
   • Mike (user/father)
   • Wife (spouse, name TBD)
   • Emma (daughter)
   • Dad (Mike's father, turning 70)

✅ Events:
   • Emma's school play - 15th of month
   • Dad's 70th birthday - Saturday
   • Need to pick up birthday cake

✅ Tasks:
   • Pick up cake for Dad's birthday

✅ Relationships:
   • Mike → Emma (father-daughter)
   • Mike → Dad (son-father)
   • Mike → Wife (spouse)
```

#### PHASE 3: STORE (Memory Layers)
```
Working Memory:
  → Active tasks: Pick up cake
  → Upcoming events: School play (15th), Birthday (Saturday)

Episodic Memory:
  → Episode: "Mike planning family events"
  → Context: Busy parent coordinating

Semantic Memory:
  → Fact: "Emma has school play on 15th"
  → Fact: "Dad's birthday is Saturday, turning 70"
  → Fact: "Need cake for Dad's birthday"
```

#### PHASE 4: RECALL (Test Questions)
```
Q: "When is Emma's school play?"
A: "Emma's school play is on the 15th! Don't forget to confirm
    the time with your wife. 🎭"
   [Source: Semantic Memory, Confidence: 92%]

Q: "What do I need to do for Dad's birthday?"
A: "Your Dad turns 70 on Saturday! You mentioned picking up
    the cake. Would you like me to remind you the day before?"
   [Source: Semantic Memory, Confidence: 95%]
```

#### PHASE 5: VALUE (User Benefits)
```
✨ Never Miss Events:
   • School play date tracked
   • Birthday milestone remembered
   • Automatic reminders possible

✨ Family Coordination:
   • Tasks captured (pick up cake)
   • Can sync with spouse mentioned events

✨ Mental Load Reduced:
   • Dad doesn't need to remember everything
   • Agent becomes family calendar assistant
```

### Evaluation Criteria
| Criteria | Weight | Description |
|----------|--------|-------------|
| Agent extracts family member names | 30% | Emma, Dad identified |
| Agent identifies birthdays and events | 40% | Dates and events captured |
| Agent suggests reminders appropriately | 30% | Proactive reminder offers |

---

## Running Family Tests

```bash
# Run all family tests
curl -X POST http://localhost:6100/api/v1/simulation/run/family-memory-recall
curl -X POST http://localhost:6100/api/v1/simulation/run/family-event-tracking

# Expected output format
{
  "scenario": "Family Memory Recall",
  "status": "completed",
  "conversation": [...],
  "extracted": {
    "people": ["Tommy", "John", "Mary"],
    "events": ["Bike riding lesson - June 5th"],
    "facts": ["Apple pie has lemon zest"]
  },
  "scores": {
    "memoryRecall": 85,
    "contextRelevance": 90,
    "entityExtraction": 88,
    "emotionalTone": 92
  },
  "value": {
    "memoriesPreserved": 3,
    "connectionsTracked": 2,
    "datesRemembered": 1
  }
}
```

---

## Success Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Memory Recall | > 80% | Agent remembers family details |
| Entity Extraction | > 85% | Names, dates, relationships captured |
| Emotional Tone | > 90% | Warm, family-appropriate responses |
| User Value Score | > 85% | Tangible benefits demonstrated |
