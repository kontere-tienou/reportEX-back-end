const rateLimit = require("express-rate-limit");
const config = require("../config/config");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * RATE LIMITING MIDDLEWARE
 * ==========================================
 */

/**
 * General rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: "Trop de requêtes. Veuillez réessayer plus tard.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS || 429).json({
      success: false,
      message:
        "Trop de requêtes depuis cette adresse IP. Veuillez réessayer dans quelques minutes.",
    });
  },
});

/**
 * Strict rate limiter for auth routes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 5 requests per windowMs
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Trop de tentatives de connexion. Compte temporairement bloqué.",
  },
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS || 429).json({
      success: false,
      message:
        "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
    });
  },
});

/**
 * API limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 60 requests per 15 minutes
  message: {
    success: false,
    message: "Limite d'API atteinte",
  },
});

/**
 * File upload limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: "Limite de téléchargement atteinte. Réessayez dans 1 heure.",
  },
});

/**
 * Create custom limiter
 */
const createLimiter = (windowMinutes, maxRequests) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      success: false,
      message: `Limite de ${maxRequests} requêtes par ${windowMinutes} minutes atteinte`,
    },
  });
};


const batchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 batch requests per minute
    message: {
        success: false,
        message: 'Batch request limit reached.'
    }
});

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  createLimiter,
  batchLimiter,
};
