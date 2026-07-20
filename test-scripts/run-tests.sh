#!/bin/bash

# ===========================================
# Rememberkin - Test Runner
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print header
echo "==========================================="
echo "  Rememberkin - Test Suite"
echo "==========================================="
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Parse arguments
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    api)
        echo -e "${GREEN}Running API Tests...${NC}"
        npx ts-node api-tests.ts
        ;;
    websocket|ws)
        echo -e "${GREEN}Running WebSocket Tests...${NC}"
        npx ts-node websocket-tests.ts
        ;;
    database|db)
        echo -e "${GREEN}Running Database Tests...${NC}"
        npx ts-node database-tests.ts
        ;;
    all)
        echo -e "${GREEN}Running All Tests...${NC}"
        echo ""

        echo "--- Database Tests ---"
        npx ts-node database-tests.ts || true
        echo ""

        echo "--- API Tests ---"
        npx ts-node api-tests.ts || true
        echo ""

        echo "--- WebSocket Tests ---"
        npx ts-node websocket-tests.ts || true
        ;;
    *)
        echo "Usage: $0 [api|websocket|database|all]"
        echo ""
        echo "Options:"
        echo "  api       - Run REST API tests"
        echo "  websocket - Run WebSocket tests"
        echo "  database  - Run database tests"
        echo "  all       - Run all tests (default)"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Tests completed!${NC}"
