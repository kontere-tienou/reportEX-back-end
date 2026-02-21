const { validationResult } = require("express-validator");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * VALIDATION MIDDLEWARE
 * ==========================================
 */

/**
 * Handle validation errors from express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.param,
      message: err.msg,
      value: err.value,
    }));

    return res.status(HTTP_STATUS.UNPROCESSABLE).json({
      success: false,
      message: "Erreur de validation",
      errors: extractedErrors,
    });
  }

  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  let { page, limit } = req.query;

  // Parse and validate page
  page = parseInt(page) || 1;
  if (page < 1) page = 1;

  // Parse and validate limit
  limit = parseInt(limit) || 20;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;

  // Calculate offset
  const offset = (page - 1) * limit;

  // Attach to request
  req.pagination = {
    page,
    limit,
    offset,
  };

  next();
};

/**
 * Validate date range
 */
const validateDateRange = (req, res, next) => {
  const { start_date, end_date } = req.query;

  if (start_date && end_date) {
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Format de date invalide",
      });
    }

    if (start > end) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "La date de début doit être avant la date de fin",
      });
    }

    req.dateRange = { start, end };
  }

  next();
};

/**
 * Validate request body is not empty
 */
const validateBody = (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: "Le corps de la requête est vide",
    });
  }
  next();
};

/**
 * Sanitize request body (remove undefined/null values)
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] === undefined || req.body[key] === null) {
        delete req.body[key];
      }
      // Trim strings
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = {
  validate,
  validatePagination,
  validateDateRange,
  validateBody,
  sanitizeBody,
};
