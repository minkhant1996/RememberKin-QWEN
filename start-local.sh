#!/bin/bash

# ============================================
# Rememberkin - Local Setup Script
# ============================================
# This script starts all services locally:
# - Neo4j (Docker)
# - Qdrant (Docker)
# - Backend server
# ============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================"
echo "  Rememberkin - Local Setup"
echo "============================================"
echo -e "${NC}"

# Check if Docker is running
echo -e "${YELLOW}Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}Docker is running.${NC}"

# ============================================
# Start Neo4j
# ============================================
echo ""
echo -e "${YELLOW}Starting Neo4j...${NC}"

if docker ps -a --format '{{.Names}}' | grep -q '^neo4j$'; then
    if docker ps --format '{{.Names}}' | grep -q '^neo4j$'; then
        echo -e "${GREEN}Neo4j is already running.${NC}"
    else
        echo "Starting existing Neo4j container..."
        docker start neo4j
        echo -e "${GREEN}Neo4j started.${NC}"
    fi
else
    echo "Creating new Neo4j container..."
    docker run -d \
        --name neo4j \
        -p 7474:7474 -p 7687:7687 \
        -e NEO4J_AUTH=neo4j/password123 \
        -e NEO4J_PLUGINS='["apoc"]' \
        neo4j:latest
    echo -e "${GREEN}Neo4j container created and started.${NC}"
fi

# ============================================
# Start Qdrant
# ============================================
echo ""
echo -e "${YELLOW}Starting Qdrant...${NC}"

if docker ps -a --format '{{.Names}}' | grep -q '^qdrant$'; then
    if docker ps --format '{{.Names}}' | grep -q '^qdrant$'; then
        echo -e "${GREEN}Qdrant is already running.${NC}"
    else
        echo "Starting existing Qdrant container..."
        docker start qdrant
        echo -e "${GREEN}Qdrant started.${NC}"
    fi
else
    echo "Creating new Qdrant container..."
    docker run -d \
        --name qdrant \
        -p 6333:6333 \
        qdrant/qdrant
    echo -e "${GREEN}Qdrant container created and started.${NC}"
fi

# ============================================
# Wait for services to be ready
# ============================================
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for Neo4j
echo -n "Waiting for Neo4j..."
for i in {1..30}; do
    if curl -s http://localhost:7474 > /dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for Qdrant
echo -n "Waiting for Qdrant..."
for i in {1..30}; do
    if curl -s http://localhost:6333/health > /dev/null 2>&1; then
        echo -e " ${GREEN}Ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# ============================================
# Setup Backend .env
# ============================================
echo ""
echo -e "${YELLOW}Setting up backend environment...${NC}"

ENV_FILE="$BACKEND_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    cat > "$ENV_FILE" << 'EOF'
PORT=6100
NODE_ENV=development

# Neo4j (local Docker)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123

# Qdrant (local Docker)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Qwen (online - ADD YOUR API KEY HERE)
QWEN_API_KEY=YOUR_QWEN_API_KEY_HERE
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# JWT
JWT_SECRET=local-dev-secret-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:6101
EOF
    echo -e "${GREEN}.env file created.${NC}"
    echo -e "${RED}IMPORTANT: Edit $ENV_FILE and add your QWEN_API_KEY${NC}"
else
    echo -e "${GREEN}.env file already exists.${NC}"
fi

# Check if QWEN_API_KEY is set
if grep -q "YOUR_QWEN_API_KEY_HERE" "$ENV_FILE"; then
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}  WARNING: QWEN_API_KEY not configured!${NC}"
    echo -e "${RED}============================================${NC}"
    echo ""
    echo "Please edit: $ENV_FILE"
    echo "And replace YOUR_QWEN_API_KEY_HERE with your actual API key"
    echo ""
    echo "Get your key from: https://dashscope.console.aliyun.com/"
    echo ""
    read -p "Press Enter after you've added your API key (or Ctrl+C to exit)..."
fi

# ============================================
# Install dependencies
# ============================================
echo ""
echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd "$BACKEND_DIR"
npm install --silent
echo -e "${GREEN}Dependencies installed.${NC}"

# ============================================
# Start Backend
# ============================================
echo ""
echo -e "${YELLOW}Starting backend server...${NC}"
echo ""

# Print status
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  All services started!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BLUE}Neo4j Browser:${NC}    http://localhost:7474"
echo -e "  ${BLUE}Qdrant Dashboard:${NC} http://localhost:6333/dashboard"
echo -e "  ${BLUE}Backend API:${NC}      http://localhost:6100"
echo -e "  ${BLUE}Health Check:${NC}     http://localhost:6100/health"
echo ""
echo -e "${YELLOW}Starting backend... (Press Ctrl+C to stop)${NC}"
echo ""

# Start the backend
npm run dev
