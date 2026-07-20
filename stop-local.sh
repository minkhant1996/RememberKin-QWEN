#!/bin/bash

# ============================================
# Rememberkin - Stop Local Services
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping local services...${NC}"

# Stop Neo4j
if docker ps --format '{{.Names}}' | grep -q '^neo4j$'; then
    echo "Stopping Neo4j..."
    docker stop neo4j
    echo -e "${GREEN}Neo4j stopped.${NC}"
else
    echo "Neo4j is not running."
fi

# Stop Qdrant
if docker ps --format '{{.Names}}' | grep -q '^qdrant$'; then
    echo "Stopping Qdrant..."
    docker stop qdrant
    echo -e "${GREEN}Qdrant stopped.${NC}"
else
    echo "Qdrant is not running."
fi

echo ""
echo -e "${GREEN}All services stopped.${NC}"
echo ""
echo "To remove containers completely, run:"
echo "  docker rm neo4j qdrant"
