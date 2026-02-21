const { body, param, query } = require("express-validator");

/**
 * ==========================================
 * EMPLOYEE VALIDATORS
 * ==========================================
 */

/**
 * Create employee validation
 */
const createEmployeeValidation = [
  body("matricule")
    .trim()
    .notEmpty()
    .withMessage("Matricule requis")
    .isLength({ min: 3, max: 50 })
    .withMessage("Matricule doit contenir entre 3 et 50 caractères")
    .matches(/^[A-Z0-9-]+$/)
    .withMessage(
      "Matricule doit contenir uniquement lettres majuscules, chiffres et tirets",
    ),

  body("first_name")
    .trim()
    .notEmpty()
    .withMessage("Prénom requis")
    .isLength({ min: 2, max: 100 })
    .withMessage("Prénom doit contenir entre 2 et 100 caractères"),

  body("last_name")
    .trim()
    .notEmpty()
    .withMessage("Nom requis")
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom doit contenir entre 2 et 100 caractères"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),

  body("phone")
    .optional()
    .matches(/^(\+225|0)?[0-9]{10}$/)
    .withMessage("Numéro de téléphone invalide"),

  body("date_of_birth")
    .optional()
    .isDate()
    .withMessage("Date de naissance invalide"),

  body("hire_date")
    .notEmpty()
    .withMessage("Date d'embauche requise")
    .isDate()
    .withMessage("Date d'embauche invalide"),

  body("department_id")
    .notEmpty()
    .withMessage("Département requis")
    .isInt({ min: 1 })
    .withMessage("ID département invalide"),

  body("position")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Poste doit contenir entre 2 et 100 caractères"),

  body("contract_type")
    .notEmpty()
    .withMessage("Type de contrat requis")
    .isIn(["CDI", "CDD", "Stage", "Apprentissage", "Intérim"])
    .withMessage("Type de contrat invalide"),

  body("salary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Salaire doit être un nombre positif"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Adresse ne peut dépasser 500 caractères"),

  body("bank_account")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Compte bancaire ne peut dépasser 100 caractères"),

  body("social_security_number")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Numéro sécurité sociale ne peut dépasser 50 caractères"),
];

/**
 * Update employee validation
 */
const updateEmployeeValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID employé invalide"),

  body("first_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Prénom doit contenir entre 2 et 100 caractères"),

  body("last_name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom doit contenir entre 2 et 100 caractères"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Email invalide")
    .normalizeEmail(),

  body("phone")
    .optional()
    .matches(/^(\+225|0)?[0-9]{10}$/)
    .withMessage("Numéro de téléphone invalide"),

  body("position")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Poste doit contenir entre 2 et 100 caractères"),

  body("salary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Salaire doit être un nombre positif"),
];

/**
 * Terminate employee validation
 */
const terminateEmployeeValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID employé invalide"),

  body("termination_date")
    .notEmpty()
    .withMessage("Date de fin requise")
    .isDate()
    .withMessage("Date de fin invalide"),

  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Raison de résiliation requise")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Raison doit contenir entre 10 et 1000 caractères"),
];

/**
 * Get employee validation
 */
const getEmployeeValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID employé invalide"),
];

/**
 * Query filters validation
 */
const getEmployeesQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page doit être un entier positif"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limite doit être entre 1 et 100"),

  query("department_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("ID département invalide"),

  query("status")
    .optional()
    .isIn(["active", "on_leave", "terminated", "suspended"])
    .withMessage("Statut invalide"),

  query("contract_type")
    .optional()
    .isIn(["CDI", "CDD", "Stage", "Apprentissage", "Intérim"])
    .withMessage("Type de contrat invalide"),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Recherche doit contenir au moins 2 caractères"),
];

/**
 * Search validation
 */
const searchEmployeesValidation = [
  query("q")
    .trim()
    .notEmpty()
    .withMessage("Terme de recherche requis")
    .isLength({ min: 2 })
    .withMessage("Recherche doit contenir au moins 2 caractères"),
];

module.exports = {
  createEmployeeValidation,
  updateEmployeeValidation,
  terminateEmployeeValidation,
  getEmployeeValidation,
  getEmployeesQueryValidation,
  searchEmployeesValidation,
};
