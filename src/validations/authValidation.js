const { body } = require("express-validator");

/**
 * ==========================================
 * AUTH VALIDATORS
 * ==========================================
 */

/**
 * Login validation rules
 */
const loginValidation = [
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
    .isLength({ min: 6 })
    .withMessage("Mot de passe doit contenir au moins 6 caractères"),
];

/**
 * Register validation rules
 */
const registerValidation = [
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
    .withMessage("Mot de passe doit contenir au moins 8 caractères")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial",
    ),

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
    .withMessage("Numéro de téléphone invalide (format ivoirien)"),
];

/**
 * Change password validation rules
 */
const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Mot de passe actuel requis"),

  body("newPassword")
    .notEmpty()
    .withMessage("Nouveau mot de passe requis")
    .isLength({ min: 8 })
    .withMessage("Mot de passe doit contenir au moins 8 caractères")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial",
    ),
];

module.exports = {
  loginValidation,
  registerValidation,
  changePasswordValidation,
};
