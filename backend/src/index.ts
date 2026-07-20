import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { requestLoggingMiddleware } from './middleware/logging.middleware.js';
import { rateLimit } from './middleware/rate-limit.middleware.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import familyRoutes from './routes/family.routes.js';
import memberRoutes from './routes/member.routes.js';
import storyRoutes from './routes/story.routes.js';
import chatRoutes from './routes/chat.routes.js';
import memoryRoutes from './routes/memory.routes.js';
import memoryDashboardRoutes from './routes/memory-dashboard.routes.js';
import eventRoutes from './routes/event.routes.js';
import searchRoutes from './routes/search.routes.js';
import usageRoutes from './routes/usage.routes.js';
import imageRoutes from './routes/image.routes.js';
import simulationRoutes from './routes/simulation.routes.js';
import photoRoutes, { UPLOADS_DIR } from './routes/photo.routes.js';

// Services
import { initNeo4j } from './config/neo4j.js';
import { initQdrant } from './config/qdrant.js';
import { WebSocketHandler } from './websocket/handler.js';
import { SchedulerService } from './services/scheduler.service.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(requestLoggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Uploaded family photos (relax helmet's CORP so the frontend origin can embed them)
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(UPLOADS_DIR)
);

// Rate limits: a broad per-client ceiling, plus tighter caps on the
// endpoints that spend Qwen tokens (chat, search, images, simulation).
const globalLimiter = rateLimit({ name: 'global', windowMs: 60_000, max: 120 });
const aiChatLimiter = rateLimit({ name: 'chat', windowMs: 60_000, max: 20 });
const aiSearchLimiter = rateLimit({ name: 'search', windowMs: 60_000, max: 30 });
const aiImageLimiter = rateLimit({ name: 'images', windowMs: 60_000, max: 5 });
const simulationLimiter = rateLimit({ name: 'simulation', windowMs: 60_000, max: 10 });
const authLimiter = rateLimit({ name: 'auth', windowMs: 60_000, max: 15 });
const photoLimiter = rateLimit({ name: 'photos', windowMs: 60_000, max: 20 });

app.use('/api/v1', globalLimiter);

// API Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/family', authMiddleware, familyRoutes);
app.use('/api/v1/members', authMiddleware, memberRoutes);
app.use('/api/v1/stories', authMiddleware, storyRoutes);
app.use('/api/v1/chat', authMiddleware, aiChatLimiter, chatRoutes);
app.use('/api/v1/memories', authMiddleware, memoryRoutes);
app.use('/api/v1/memory-dashboard', authMiddleware, memoryDashboardRoutes);
app.use('/api/v1/events', authMiddleware, eventRoutes);
app.use('/api/v1/search', authMiddleware, aiSearchLimiter, searchRoutes);
app.use('/api/v1/usage', usageRoutes); // No auth - public pricing info
app.use('/api/v1/images', authMiddleware, aiImageLimiter, imageRoutes);
app.use('/api/v1/photos', authMiddleware, photoLimiter, photoRoutes);
app.use('/api/v1/simulation', simulationLimiter, simulationRoutes); // No auth - for demo/testing

// 404 handler
app.use(notFoundMiddleware);

// Error handling
app.use(errorMiddleware);

// Initialize services and start server
async function bootstrap() {
  try {
    // Initialize databases
    await initNeo4j();
    logger.info('Neo4j connected');

    await initQdrant();
    logger.info('Qdrant connected');

    // Initialize WebSocket
    const wss = new WebSocketServer({ server, path: '/ws' });
    const wsHandler = new WebSocketHandler(wss);
    logger.info('WebSocket server initialized');

    // Initialize scheduler for proactive reminders
    const scheduler = new SchedulerService();
    scheduler.start();
    logger.info('Scheduler started');

    // Start server
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    console.error(error);
    process.exit(1);
  }
}

bootstrap();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
