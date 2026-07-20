import cron from 'node-cron';
import { graphService } from './graph.service.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  start(): void {
    // Check for event reminders every day at 9 AM
    cron.schedule('0 9 * * *', async () => {
      logger.info('Running daily event reminder check');
      await this.checkEventReminders();
    });

    // Check for inactive connections every Sunday at 10 AM
    cron.schedule('0 10 * * 0', async () => {
      logger.info('Running weekly connection check');
      await this.checkInactiveConnections();
    });

    logger.info('Scheduler service started');
  }

  private async checkEventReminders(): Promise<void> {
    // This would typically send push notifications or emails
    // For now, we just log upcoming events
    try {
      // TODO: Get all families and check their events
      // For each event that needs a reminder today, notify relevant members
      logger.info('Event reminder check completed');
    } catch (error) {
      logger.error('Event reminder check failed:', error);
    }
  }

  private async checkInactiveConnections(): Promise<void> {
    try {
      // TODO: Check for family members who haven't been contacted in a while
      // Send gentle suggestions to stay connected
      logger.info('Inactive connection check completed');
    } catch (error) {
      logger.error('Inactive connection check failed:', error);
    }
  }
}
