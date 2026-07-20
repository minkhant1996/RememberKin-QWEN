#!/bin/bash

# Memory System Test Setup Script
# This script helps set up and run the memory system tests

echo "=========================================="
echo "Memory System Test Setup"
echo "=========================================="
echo ""

# Check if backend .env exists
if [ ! -f "../backend/.env" ]; then
    echo "ERROR: Backend .env file not found!"
    echo ""
    echo "Please create backend/.env from backend/.env.example with your credentials:"
    echo "  - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD"
    echo "  - QDRANT_URL, QDRANT_API_KEY"
    echo "  - QWEN_API_KEY"
    echo "  - JWT_SECRET"
    echo ""
    echo "Example:"
    echo "  cd ../backend"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your credentials"
    echo ""
    exit 1
fi

# Check if backend is running
echo "Checking if backend is running..."
if ! curl -s --max-time 2 http://localhost:6100/health > /dev/null 2>&1; then
    echo "Backend is not running. Starting it..."
    echo ""

    # Start backend in background
    cd ../backend
    npm run dev &
    BACKEND_PID=$!
    cd ../test-scripts

    # Wait for backend to start
    echo "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s --max-time 1 http://localhost:6100/health > /dev/null 2>&1; then
            echo "Backend started successfully!"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

# Check health again
echo "Checking backend health..."
HEALTH=$(curl -s http://localhost:6100/health 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo "ERROR: Backend is not responding!"
    exit 1
fi
echo "Backend health: $HEALTH"
echo ""

# Run tests
echo "Running memory system tests..."
echo ""
npx ts-node memory-system-tests.ts

# Get exit code
EXIT_CODE=$?

echo ""
echo "=========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All tests completed successfully!"
else
    echo "❌ Some tests failed. Check the output above."
fi
echo "=========================================="

exit $EXIT_CODE
