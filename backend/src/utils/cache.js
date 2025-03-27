/**
 * Redis cache utility for improving API performance
 */
const redis = require('redis');
const { promisify } = require('util');
const logger = require('./logger');

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_EXPIRATION = 3600; // 1 hour in seconds

// Create Redis client
let redisClient;
let getAsync;
let setAsync;
let delAsync;
let flushAsync;

/**
 * Initialize Redis client and promisify methods
 * @returns {Object} Redis client or null if connection fails
 */
const initRedisClient = async () => {
  try {
    redisClient = redis.createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
      }
    });

    // Log Redis errors but don't crash the application
    redisClient.on('error', (err) => {
      logger.warn(`Redis error: ${err.message}`);
    });

    // Promisify Redis methods for easier async/await usage
    getAsync = promisify(redisClient.get).bind(redisClient);
    setAsync = promisify(redisClient.set).bind(redisClient);
    delAsync = promisify(redisClient.del).bind(redisClient);
    flushAsync = promisify(redisClient.flushAll).bind(redisClient);

    await redisClient.connect();
    logger.info('Redis client connected successfully');
    return redisClient;
  } catch (error) {
    logger.warn(`Failed to connect to Redis: ${error.message}`);
    return null;
  }
};

/**
 * Cache middleware for Express routes
 * @param {number} duration - Cache duration in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (duration = DEFAULT_EXPIRATION) => {
  return async (req, res, next) => {
    // Skip caching if Redis is not connected
    if (!redisClient || !redisClient.isOpen) {
      return next();
    }

    // Create a cache key from the request URL
    const cacheKey = `api:${req.originalUrl || req.url}`;

    try {
      // Check if we have a cache hit
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        // Return cached data and avoid processing the request
        const data = JSON.parse(cachedData);
        return res.status(200).json({
          ...data,
          _cache: true
        });
      }

      // Modify response to store data in cache before sending it
      const originalSend = res.send;
      res.send = function (body) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          try {
            // Don't cache error responses
            const data = JSON.parse(body);
            if (!data.error) {
              redisClient.set(cacheKey, body, {
                EX: duration
              });
            }
          } catch (err) {
            logger.error(`Cache serialization error: ${err.message}`);
          }
        }
        return originalSend.call(this, body);
      };

      next();
    } catch (err) {
      logger.error(`Cache middleware error: ${err.message}`);
      next();
    }
  };
};

/**
 * Clear cache for a specific key pattern
 * @param {string} pattern - Key pattern to clear
 */
const clearCache = async (pattern) => {
  if (!redisClient || !redisClient.isOpen) {
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  } catch (err) {
    logger.error(`Error clearing cache: ${err.message}`);
  }
};

/**
 * Clear all cache
 */
const clearAllCache = async () => {
  if (!redisClient || !redisClient.isOpen) {
    return;
  }

  try {
    await redisClient.flushAll();
    logger.info('All cache cleared successfully');
  } catch (err) {
    logger.error(`Error clearing all cache: ${err.message}`);
  }
};

/**
 * Close Redis connection
 */
const closeRedisConnection = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error(`Error closing Redis connection: ${err.message}`);
    }
  }
};

module.exports = {
  initRedisClient,
  cacheMiddleware,
  clearCache,
  clearAllCache,
  closeRedisConnection
}; 