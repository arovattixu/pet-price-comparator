/**
 * Cache middleware for API routes
 */
const { cacheMiddleware } = require('../utils/cache');

// Common cache durations in seconds
const CACHE_DURATIONS = {
  SHORT: 60 * 5,       // 5 minutes
  MEDIUM: 60 * 30,     // 30 minutes
  LONG: 60 * 60 * 2,   // 2 hours
  VERY_LONG: 60 * 60 * 12, // 12 hours
  DAY: 60 * 60 * 24    // 24 hours
};

/**
 * Apply short cache duration (5 minutes)
 */
const shortCache = cacheMiddleware(CACHE_DURATIONS.SHORT);

/**
 * Apply medium cache duration (30 minutes)
 */
const mediumCache = cacheMiddleware(CACHE_DURATIONS.MEDIUM);

/**
 * Apply long cache duration (2 hours)
 */
const longCache = cacheMiddleware(CACHE_DURATIONS.LONG);

/**
 * Apply very long cache duration (12 hours)
 */
const veryLongCache = cacheMiddleware(CACHE_DURATIONS.VERY_LONG);

/**
 * Apply day-long cache duration (24 hours)
 */
const dayCache = cacheMiddleware(CACHE_DURATIONS.DAY);

/**
 * Utility to create a cache middleware with custom duration
 * @param {number} durationInSeconds - Cache duration in seconds
 * @returns {Function} Express middleware
 */
const customCache = (durationInSeconds) => cacheMiddleware(durationInSeconds);

/**
 * Dynamic cache based on content type
 * - Products list: medium cache
 * - Product details: longer cache
 * - Price history: longer cache
 * - Similar products: medium cache
 * @param {Object} req - Express request object
 * @returns {Function} Appropriate cache middleware
 */
const dynamicCache = (req) => {
  const path = req.path;
  
  // Product details or price history get longer cache
  if (path.includes('/products/') && (path.includes('/details') || path.includes('/prices'))) {
    return longCache;
  }
  
  // Similar products get medium cache
  if (path.includes('/similar')) {
    return mediumCache;
  }
  
  // Deals get short cache as they may change frequently
  if (path.includes('/deals')) {
    return shortCache;
  }
  
  // Trends data can be cached longer
  if (path.includes('/trends')) {
    return longCache;
  }
  
  // Default to medium cache
  return mediumCache;
};

module.exports = {
  shortCache,
  mediumCache,
  longCache,
  veryLongCache,
  dayCache,
  customCache,
  dynamicCache,
  CACHE_DURATIONS
}; 