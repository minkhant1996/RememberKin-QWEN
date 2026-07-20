# Deployment Guide — Alibaba Cloud

Rememberkin is built on **Qwen models served from Alibaba Cloud Model Studio (DashScope)**. The backend deploys to **Alibaba Cloud Function Compute** via the official **Serverless Devs (`s`) CLI** — see [`s.yaml`](../s.yaml) at the repo root. An ECS + Docker Compose alternative is included at the end.

## Cloud architecture

```
                 ┌───────────────────────── Alibaba Cloud ─────────────────────────┐
                 │                                                                  │
  Browser ─────▶ │  OSS static hosting (React build)                                │
                 │        │  /api/v1/* + /ws                                        │
                 │        ▼                                                         │
                 │  Function Compute 3.0 (custom container, 1 warm instance)       │
                 │    Express API · WebSocket · node-cron consolidation jobs       │
                 │        │                                                         │
                 │        ├──────────────▶ Model Studio / DashScope                │
                 │        │                qwen-plus · qwen-turbo ·                 │
                 │        │                text-embedding-v3 · qwen-image-2.0      │
                 └────────┼─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     Neo4j Aura (managed)        Qdrant Cloud (managed)
     family graph + memory       embeddings + semantic search
     layers 2-4                  free tier available
```

Notes on serverless fit:

- The backend is **stateless on disk** — no local file writes, so it runs cleanly in a container on Function Compute.
- **Layer 1 working memory** and the **node-cron jobs** (memory consolidation, event reminders) live in-process, so `s.yaml` pins **exactly one warm instance** (`provisionConfig.target: 1`, `maxInstances: 1`) — no cold starts, cron always runs, working memory never splits across instances. Layers 2–4 are already externalized to Neo4j + Qdrant.
- All LLM traffic goes to the DashScope OpenAI-compatible endpoint `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (`backend/src/config/qwen.ts`).

## Prerequisites

1. **Alibaba Cloud account** with an AccessKey pair
2. **Qwen Cloud API key** — https://home.qwencloud.com/api-keys (Model Studio / DashScope also works: https://modelstudio.console.alibabacloud.com/)
3. **Container Registry (ACR) namespace** (international) — https://cr.console.alibabacloud.com/ (personal edition is free)
4. **Neo4j Aura** free instance — https://neo4j.com/cloud/aura/ (the `.env.example` `neo4j+s://` URI format)
5. **Qdrant Cloud** free cluster — https://cloud.qdrant.io/
6. Tools: Docker + the official Serverless Devs CLI:

```bash
npm install -g @serverless-devs/s
s config add   # paste your AccessKeyID / AccessKeySecret, name the access "default"
```

## Deploy the backend (official Serverless Devs script)

From the repo root:

```bash
# 1. Build and push the backend image to ACR (replace <namespace>)
REGION=ap-southeast-1
IMAGE=registry-intl.$REGION.aliyuncs.com/<namespace>/rememberkin-backend:latest
docker build -t $IMAGE backend/
docker login registry-intl.$REGION.aliyuncs.com
docker push $IMAGE

# 2. Edit s.yaml: replace <namespace> with yours

# 3. Provide secrets via environment, then deploy
export NEO4J_URI='neo4j+s://xxxxx.databases.neo4j.io'
export NEO4J_PASSWORD='...'
export QDRANT_URL='https://xxxxx.cloud.qdrant.io:6333'
export QDRANT_API_KEY='...'
export QWEN_API_KEY='sk-...'
export JWT_SECRET='long-random-string'
export CORS_ORIGIN='https://<your-frontend-domain>'

s deploy
```

`s deploy` prints the function's HTTP trigger URL. Verify:

```bash
curl https://<function-url>/health
```

Redeploy after changes with `docker build` + `docker push` + `s deploy` again. Serverless Application Center can also [bind this GitHub repo for auto-deploy on push](https://www.alibabacloud.com/help/en/functioncompute/fc/use-serverless-application-center-to-implement-ci-cd-on-existing-projects).

## Deploy the frontend (OSS static hosting)

```bash
cd frontend
VITE_API_URL=https://<function-url>/api/v1 VITE_WS_URL=wss://<function-url>/ws npm run build

# Create an OSS bucket with static website hosting enabled, then:
ossutil cp -r dist/ oss://<bucket-name>/ --update
```

Set the bucket's index document to `index.html` (and error document to `index.html` for SPA routing). Point `CORS_ORIGIN` on the backend at the bucket's website endpoint (or your CDN domain) and redeploy.

## Alternative: single ECS instance with Docker Compose

For a self-contained deployment (includes Neo4j and Qdrant as containers — no managed databases needed):

```bash
# On an Ubuntu 22.04 ECS instance (2 vCPU / 4 GB), security group open on 8080:
curl -fsSL https://get.docker.com | sh
git clone <repository-url> rememberkin && cd rememberkin
cat > .env <<'EOF'
QWEN_API_KEY=sk-your-dashscope-key
NEO4J_PASSWORD=choose-a-strong-password
JWT_SECRET=choose-a-long-random-string
CORS_ORIGIN=http://<ECS_PUBLIC_IP>:8080
EOF
docker compose up -d --build
curl http://localhost:6100/health
```

The bundled nginx (frontend container) serves the React build on port 8080 and proxies `/api` and `/ws` to the backend. Data persists in the `neo4j_data` / `qdrant_data` volumes.

## Proof of Alibaba Cloud integration

For hackathon verification, the Alibaba Cloud touchpoints in code are:

- [`s.yaml`](../s.yaml) — Function Compute deployment definition (Serverless Devs)
- `backend/src/config/qwen.ts` — Qwen client pointed at `dashscope-intl.aliyuncs.com` (Model Studio)
- `backend/src/services/agent.service.ts` — chat (`qwen-plus`), extraction (`qwen-turbo`), embeddings (`text-embedding-v3`)
- `backend/src/services/image.service.ts` — DashScope text-to-image API (`qwen-image-2.0`)
- `backend/src/config/pricing.ts` — Qwen model pricing and cost tracking

Runtime proof: the `/api/v1/usage` endpoint reports live Qwen token usage and per-model cost for every request served.
