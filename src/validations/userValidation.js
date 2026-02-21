const { body, param, query } = require("express-validator");

/**
 * ==========================================
 * USER VALIDATORS
 * ==========================================
 */

/**
 * Create user validation
 */
const createUserValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email est requis")
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Mot de passe requis")
    .isLength({ min: 8 })
    .withMessage("Mot de passe doit contenir au moins 8 caractères"),

  body("full_name")
    .trim()
    .notEmpty()
    .withMessage("Nom complet requis")
    .isLength({ min: 2, max: 255 })
    .withMessage("Nom doit contenir entre 2 et 255 caractères"),

  body("role")
    .notEmpty()
    .withMessage("Rôle requis")
    .isIn(["ADMIN", "DG", "MANAGER", "SUPERVISOR", "USER", "VIEWER"])
    .withMessage("Rôle invalide"),

  body("department_id")
    .notEmpty()
    .withMessage("Département requis")
    .isInt({ min: 1 })
    .withMessage("ID département invalide"),

  body("phone")
    .optional()
    .matches(/^(\+225|0)?[0-9]{10}$/)
    .withMessage("Numéro de téléphone invalide"),
];

/**
 * Update user validation
 */
const updateUserValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID utilisateur invalide"),

  body("full_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("Nom doit contenir entre 2 et 255 caractères"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),

  body("role")
    .optional()
    .isIn(["ADMIN", "DG", "MANAGER", "SUPERVISOR", "USER", "VIEWER"])
    .withMessage("Rôle invalide"),

  body("department_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ID département invalide"),

  body("phone")
    .optional()
    .matches(/^(\+225|0)?[0-9]{10}$/)
    .withMessage("Numéro de téléphone invalide"),
];

/**
 * Get user validation
 */
const getUserValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID utilisateur invalide"),
];

/**
 * Query filters validation
 */
const getUsersQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page doit être un entier positif"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limite doit être entre 1 et 100"),

  query("role")
    .optional()
    .isIn(["ADMIN", "DG", "MANAGER", "SUPERVISOR", "USER", "VIEWER"])
    .withMessage("Rôle invalide"),

  query("department_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ID département invalide"),

  query("is_active")
    .optional()
    .isBoolean()
    .withMessage("is_active doit être boolean"),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Recherche doit contenir au moins 2 caractères"),
];

module.exports = {
  createUserValidation,
  updateUserValidation,
  getUserValidation,
  getUsersQueryValidation,
};
