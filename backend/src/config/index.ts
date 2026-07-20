import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '6100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Set ALLOW_REGISTRATION=false on public demo deployments (login-only with seeded accounts)
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',

  // Neo4j
  neo4j: {
    uri: process.env.NEO4J_URI || '',
    user: process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },

  // Qdrant
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  },

  // Qwen Cloud
  qwen: {
    apiKey: process.env.QWEN_API_KEY || '',
    baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    // Hard ceiling on cumulative AI spend for this deployment (USD)
    maxTotalCostUsd: parseFloat(process.env.MAX_TOTAL_COST_USD || '10'),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL,
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:6101',

  // Email (optional — invite emails are skipped if SMTP not configured)
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@rememberkin.com',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:6101',
};
