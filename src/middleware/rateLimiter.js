const rateLimit = require("express-rate-limit");
const { RATE_LIMITS, HTTP_STATUS } = require("../config/constants");

// Rate limiter pour les tentatives de connexion
const loginLimiter = rateLimit({
  windowMs: RATE_LIMITS.LOGIN.windowMs,
  max: RATE_LIMITS.LOGIN.max,
  message: {
    success: false,
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
      retryAfter: Math.ceil(RATE_LIMITS.LOGIN.windowMs / 1000 / 60), // en minutes
    });
  },
});

// Rate limiter général pour l'API
const apiLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.windowMs,
  max: RATE_LIMITS.API.max,
  message: {
    success: false,
    message: "Trop de requêtes. Réessayez plus tard.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne pas limiter les requêtes GET de lecture simple
    return req.method === "GET" && !req.path.includes("/download");
  },
});

// Rate limiter pour les soumissions de rapports
const reportSubmissionLimiter = rateLimit({
  windowMs: RATE_LIMITS.REPORT_SUBMISSION.windowMs,
  max: RATE_LIMITS.REPORT_SUBMISSION.max,
  message: {
    success: false,
    message: "Trop de soumissions de rapports. Réessayez dans 1 heure.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limiter par utilisateur (IP + user ID si connecté)
    return req.user ? `user_${req.user.id}` : req.ip;
  },
});

// Rate limiter stricte pour les actions sensibles (validation, suppression)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requêtes max
  message: {
    success: false,
    message: "Action limitée. Trop de requêtes sensibles.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  apiLimiter,
  reportSubmissionLimiter,
  strictLimiter,
};
