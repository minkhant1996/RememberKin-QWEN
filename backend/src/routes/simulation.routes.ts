/**
 * Simulation Routes
 *
 * API endpoints for running and monitoring agent simulations.
 */

import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { simulationService } from '../services/simulation.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Store SSE clients for live updates
const sseClients: Map<string, Response> = new Map();

/**
 * GET /api/v1/simulation/personas
 * Get available test user personas
 */
router.get('/personas', (req: Request, res: Response) => {
  const personas = simulationService.getPersonas();
  res.json({
    success: true,
    data: personas,
  });
});

/**
 * GET /api/v1/simulation/scenarios
 * Get available simulation scenarios
 */
router.get('/scenarios', (req: Request, res: Response) => {
  const scenarios = simulationService.getScenarios();
  res.json({
    success: true,
    data: scenarios,
  });
});

/**
 * GET /api/v1/simulation/state
 * Get current simulation state
 */
router.get('/state', (req: Request, res: Response) => {
  const state = simulationService.getState();
  res.json({
    success: true,
    data: state,
  });
});

/**
 * GET /api/v1/simulation/results
 * Get all simulation results
 */
router.get('/results', (req: Request, res: Response) => {
  const results = simulationService.getResults();
  const summary = simulationService.getSummary();
  res.json({
    success: true,
    data: {
      results,
      summary,
    },
  });
});

/**
 * GET /api/v1/simulation/summary
 * Get simulation summary statistics
 */
router.get('/summary', (req: Request, res: Response) => {
  const summary = simulationService.getSummary();
  res.json({
    success: true,
    data: summary,
  });
});

/**
 * POST /api/v1/simulation/run
 * Run all simulation scenarios
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = simulationService.getState();
    if (state.isRunning) {
      res.status(409).json({
        success: false,
        error: 'Simulation already running',
      });
      return;
    }

    // Start simulation in background
    logger.info('Starting simulation run');

    // Run simulation and broadcast events
    simulationService.runAllScenarios(
      (turn, result) => {
        // Broadcast turn to all SSE clients
        broadcastSSE('turn', { turn, simulationId: result.id, scenarioName: result.scenarioName });
      },
      (result, index, total) => {
        // Broadcast scenario completion
        broadcastSSE('scenario:complete', {
          result,
          progress: { current: index + 1, total },
        });
      }
    ).then(({ results, stopped }) => {
      const summary = simulationService.getSummary(results);
      if (stopped) {
        broadcastSSE('simulation:stopped', { results, summary });
        logger.info({ summary }, 'Simulation stopped');
      } else {
        broadcastSSE('simulation:complete', { results, summary });
        logger.info({ summary }, 'Simulation completed');
      }
      broadcastSSE('state', simulationService.getState());
    }).catch(error => {
      broadcastSSE('simulation:error', { error: error.message });
      logger.error({ error }, 'Simulation failed');
    });

    broadcastSSE('state', simulationService.getState());

    res.json({
      success: true,
      message: 'Simulation started. Connect to /api/v1/simulation/events for live updates.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/simulation/run/:scenarioId
 * Run a specific scenario
 */
const runScenarioSchema = z.object({
  scenarioId: z.string(),
});

router.post('/run/:scenarioId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId } = req.params;
    const scenarios = simulationService.getScenarios();
    const scenario = scenarios.find(s => s.id === scenarioId);

    if (!scenario) {
      res.status(404).json({
        success: false,
        error: `Scenario ${scenarioId} not found`,
      });
      return;
    }

    const state = simulationService.getState();
    if (state.isRunning) {
      res.status(409).json({
        success: false,
        error: 'Simulation already running',
      });
      return;
    }

    logger.info({ scenarioId }, 'Starting single scenario');

    // Run scenario and broadcast events
    simulationService.runScenario(
      scenario,
      (turn, result) => {
        broadcastSSE('turn', { turn, simulationId: result.id, scenarioName: result.scenarioName });
      }
    ).then(result => {
      if (result.status === 'stopped') {
        const summary = simulationService.getSummary([result]);
        broadcastSSE('simulation:stopped', { results: [result], summary });
        logger.info({ scenarioId }, 'Scenario stopped');
      } else {
        broadcastSSE('scenario:complete', { result, progress: { current: 1, total: 1 } });
        logger.info({ scenarioId, scores: result.scores }, 'Scenario completed');
      }
      broadcastSSE('state', simulationService.getState());
    }).catch(error => {
      broadcastSSE('scenario:error', { scenarioId, error: error.message });
      logger.error({ error, scenarioId }, 'Scenario failed');
    });

    broadcastSSE('state', simulationService.getState());

    res.json({
      success: true,
      message: `Scenario ${scenarioId} started. Connect to /api/v1/simulation/events for live updates.`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/simulation/clear
 * Clear all simulation data
 */
router.delete('/clear', (req: Request, res: Response) => {
  const result = simulationService.clearAllData();
  broadcastSSE('cleared', { timestamp: new Date() });
  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/simulation/stop
 * Stop the currently running simulation
 */
router.post('/stop', (req: Request, res: Response) => {
  const state = simulationService.getState();
  if (!state.isRunning) {
    res.status(409).json({
      success: false,
      error: 'No simulation is currently running',
    });
    return;
  }

  const result = simulationService.stopCurrentRun();
  broadcastSSE('simulation:stop-requested', {
    activeSimulationId: simulationService.getState().activeSimulationId,
    currentScenarioIndex: simulationService.getState().currentScenarioIndex,
  });
  broadcastSSE('state', simulationService.getState());

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/v1/simulation/events
 * Server-Sent Events endpoint for live updates
 */
router.get('/events', cors({ origin: '*' }), (req: Request, res: Response) => {
  const clientId = Math.random().toString(36).substring(7);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Store client
  sseClients.set(clientId, res);
  logger.debug({ clientId }, 'SSE client connected');

  // Send current state
  const state = simulationService.getState();
  res.write(`data: ${JSON.stringify({ type: 'state', data: state })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(clientId);
    logger.debug({ clientId }, 'SSE client disconnected');
  });
});

/**
 * Broadcast message to all SSE clients
 */
function broadcastSSE(type: string, data: any): void {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  sseClients.forEach((res, clientId) => {
    try {
      res.write(`data: ${message}\n\n`);
    } catch (error) {
      logger.warn({ clientId }, 'Failed to send SSE message');
      sseClients.delete(clientId);
    }
  });
}

export default router;
