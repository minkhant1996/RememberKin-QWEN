#!/bin/bash

# Manual Memory System Test
# Run this script to test the memory system with curl commands

BASE_URL="http://localhost:6100/api/v1"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "MEMORY SYSTEM MANUAL TEST"
echo "=========================================="
echo ""

# Test 1: Register user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"memory-test-$TIMESTAMP@example.com\", \"password\": \"testpass123\", \"name\": \"Test User\"}")

TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "   ERROR: Failed to register. Response: $REGISTER_RESPONSE"
    exit 1
fi
echo "   ✓ Registered. Token: ${TOKEN:0:20}..."
echo ""

# Test 2: Create family
echo "2. Creating family: The Johnson Family..."
FAMILY_RESPONSE=$(curl -s -X POST "$BASE_URL/family" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "The Johnson Family"}')

FAMILY_ID=$(echo $FAMILY_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Family ID: $FAMILY_ID"
echo ""

# Test 3: Add family members
echo "3. Adding family members..."
curl -s -X POST "$BASE_URL/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Grandma Rose", "nickname": "Grandma", "birthDate": "1945-03-15"}' > /dev/null
echo "   ✓ Added Grandma Rose"

curl -s -X POST "$BASE_URL/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Uncle Joe", "nickname": "Joe", "birthDate": "1970-07-22"}' > /dev/null
echo "   ✓ Added Uncle Joe"

curl -s -X POST "$BASE_URL/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Sarah Johnson", "nickname": "Mom", "birthDate": "1975-11-30"}' > /dev/null
echo "   ✓ Added Sarah Johnson"
echo ""

# Test 4: Get initial memory stats
echo "4. Getting initial memory stats..."
STATS=$(curl -s -X GET "$BASE_URL/memory-dashboard/stats" \
  -H "Authorization: Bearer $TOKEN")
echo "   Stats: $STATS" | head -c 200
echo "..."
echo ""

# Test 5: Chat to extract facts
echo "5. Chatting to extract facts about Grandma..."
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Grandma Rose loves apple pie and she always bakes it on Sundays. She was born in Boston and moved to California in 1970.", "history": []}')

SESSION_ID=$(echo $CHAT_RESPONSE | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
echo "   Session ID: $SESSION_ID"
echo "   Response: $(echo $CHAT_RESPONSE | grep -o '"response":"[^"]*"' | head -c 100)..."
echo ""

# Wait for async processing
echo "   Waiting for fact extraction..."
sleep 3
echo ""

# Test 6: Check working memory
echo "6. Checking working memory..."
WORKING=$(curl -s -X GET "$BASE_URL/memory-dashboard/working" \
  -H "Authorization: Bearer $TOKEN")
echo "   Working Memory: $WORKING" | head -c 300
echo "..."
echo ""

# Test 7: Another chat
echo "7. Chatting about Uncle Joe..."
curl -s -X POST "$BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"message\": \"Uncle Joe is a mechanic and he loves vintage cars. His favorite food is pizza.\", \"sessionId\": \"$SESSION_ID\", \"history\": []}" > /dev/null
echo "   ✓ Sent message about Uncle Joe"
sleep 2
echo ""

# Test 8: Get consolidation queue
echo "8. Checking consolidation queue..."
QUEUE=$(curl -s -X GET "$BASE_URL/memory-dashboard/consolidation-queue" \
  -H "Authorization: Bearer $TOKEN")
echo "   Queue: $QUEUE" | head -c 300
echo "..."
echo ""

# Test 9: Trigger consolidation
echo "9. Triggering memory consolidation..."
CONSOLIDATE=$(curl -s -X POST "$BASE_URL/memory-dashboard/consolidate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')
echo "   Result: $CONSOLIDATE" | head -c 300
echo "..."
echo ""

# Test 10: Get semantic memories
echo "10. Getting semantic memories (long-term facts)..."
SEMANTIC=$(curl -s -X GET "$BASE_URL/memory-dashboard/semantic" \
  -H "Authorization: Bearer $TOKEN")
echo "   Semantic: $SEMANTIC" | head -c 400
echo "..."
echo ""

# Test 11: Get episodic memories
echo "11. Getting episodic memories (episodes)..."
EPISODIC=$(curl -s -X GET "$BASE_URL/memory-dashboard/episodic" \
  -H "Authorization: Bearer $TOKEN")
echo "   Episodic: $EPISODIC" | head -c 400
echo "..."
echo ""

# Test 12: Detect patterns
echo "12. Detecting patterns..."
PATTERNS=$(curl -s -X POST "$BASE_URL/memory-dashboard/detect-patterns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}')
echo "   Patterns: $PATTERNS" | head -c 300
echo "..."
echo ""

# Test 13: Get activity feed
echo "13. Getting activity feed..."
ACTIVITY=$(curl -s -X GET "$BASE_URL/memory-dashboard/activity?limit=10" \
  -H "Authorization: Bearer $TOKEN")
echo "   Activity: $ACTIVITY" | head -c 400
echo "..."
echo ""

# Test 14: Final stats
echo "14. Getting final memory stats..."
FINAL_STATS=$(curl -s -X GET "$BASE_URL/memory-dashboard/stats" \
  -H "Authorization: Bearer $TOKEN")
echo "   Final Stats: $FINAL_STATS"
echo ""

echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Created family: The Johnson Family"
echo "- Added 3 family members"
echo "- Had 2 conversations"
echo "- Extracted and consolidated memories"
echo ""
echo "To view the Memory Dashboard:"
echo "1. Start the frontend: cd ../frontend && npm run dev"
echo "2. Login with: memory-test-$TIMESTAMP@example.com / testpass123"
echo "3. Go to /memory to see the dashboard"
echo ""
