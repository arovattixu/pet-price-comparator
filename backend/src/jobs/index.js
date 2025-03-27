/**
 * Scheduled jobs for automating backend tasks
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const { clearCache } = require('../utils/cache');
const productsJob = require('./productsJob');
const trendsJob = require('./trendsJob');
const alertsJob = require('./alertsJob');

// Jobs configuration
const JOBS = {
  // Update product data and refresh cache (daily at 2:00 AM)
  UPDATE_PRODUCTS: {
    schedule: '0 2 * * *',
    enabled: true,
    handler: productsJob.updateProductData,
    description: 'Update product data and refresh cache'
  },
  
  // Calculate trends and analytics (daily at 3:00 AM)
  GENERATE_TRENDS: {
    schedule: '0 3 * * *',
    enabled: true,
    handler: trendsJob.generateTrends,
    description: 'Calculate price trends and analytics'
  },
  
  // Send price alerts to users (every 4 hours)
  PRICE_ALERTS: {
    schedule: '0 */4 * * *',
    enabled: true,
    handler: alertsJob.processPriceAlerts,
    description: 'Process and send price alerts'
  },
  
  // Refresh cache for frequently accessed data (hourly)
  REFRESH_CACHE: {
    schedule: '0 * * * *',
    enabled: true,
    handler: async () => {
      try {
        await clearCache('api:/deals/*');
        await clearCache('api:/products/featured');
        logger.info('Cache refreshed for frequently changing data');
      } catch (error) {
        logger.error(`Failed to refresh cache: ${error.message}`);
      }
    },
    description: 'Refresh cache for frequently accessed data'
  },
  
  // Clean up old data (weekly on Sunday at 1:00 AM)
  CLEANUP_OLD_DATA: {
    schedule: '0 1 * * 0',
    enabled: true,
    handler: async () => {
      try {
        // Implement cleanup logic
        logger.info('Old data cleanup completed');
      } catch (error) {
        logger.error(`Failed to clean up old data: ${error.message}`);
      }
    },
    description: 'Clean up old and redundant data'
  }
};

/**
 * Setup and register all scheduled jobs
 */
function setupScheduledJobs() {
  // Skip if scheduled jobs are disabled in the environment
  if (process.env.ENABLE_SCHEDULED_JOBS !== 'true') {
    logger.info('Scheduled jobs are disabled by configuration');
    return;
  }
  
  const timezone = process.env.JOBS_TIMEZONE || 'Europe/Rome';
  
  // Register each job
  Object.entries(JOBS).forEach(([name, job]) => {
    if (job.enabled) {
      cron.schedule(job.schedule, async () => {
        logger.info(`Running scheduled job: ${name} - ${job.description}`);
        try {
          await job.handler();
          logger.info(`Job ${name} completed successfully`);
        } catch (error) {
          logger.error(`Job ${name} failed: ${error.message}`);
          if (error.stack) {
            logger.error(error.stack);
          }
        }
      }, {
        timezone,
        scheduled: true
      });
      
      logger.info(`Scheduled job registered: ${name} (${job.schedule}, ${timezone})`);
    } else {
      logger.info(`Job ${name} is disabled`);
    }
  });
  
  logger.info('All scheduled jobs have been registered');
}

module.exports = {
  setupScheduledJobs,
  JOBS
}; 