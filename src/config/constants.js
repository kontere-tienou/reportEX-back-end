/**
 * ==========================================
 * APPLICATION CONSTANTS
 * ==========================================
 */

// User Status
exports.USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

// Document Status
exports.DOCUMENT_STATUS = {
  DRAFT: 'brouillon',
  SUBMITTED: 'soumis',
  APPROVED: 'approuve',
  REJECTED: 'rejete',
  CANCELLED: 'annule',
  VALIDATED: 'valide',
};

// Payment Status
exports.PAYMENT_STATUS = {
  PENDING: 'en_attente',
  PAID: 'paye',
  PARTIAL: 'partiel',
  OVERDUE: 'en_retard',
  CANCELLED: 'annule',
};

// Priority Levels
exports.PRIORITY = {
  LOW: 'basse',
  MEDIUM: 'moyenne',
  HIGH: 'haute',
  URGENT: 'urgente',
  CRITICAL: 'critique',
};

// Notification Types
exports.NOTIFICATION_TYPE = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  VALIDATION: 'validation',
  APPROVAL: 'approval',
  SYSTEM: 'system',
};

// Action Types (Audit)
exports.ACTION_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUBMIT: 'SUBMIT',
  CANCEL: 'CANCEL',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
};

// Entity Types
exports.ENTITY_TYPE = {
  USER: 'user',
  EMPLOYEE: 'employee',
  DEPARTMENT: 'department',
  CONTRACT: 'contract',
  LEAVE: 'leave',
  PURCHASE_ORDER: 'purchase_order',
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  STOCK: 'stock',
  MAINTENANCE: 'maintenance',
  TICKET: 'ticket',
};

// Leave Types
exports.LEAVE_TYPE = {
  ANNUAL: 'conge_annuel',
  SICK: 'conge_maladie',
  MATERNITY: 'conge_maternite',
  PATERNITY: 'conge_paternite',
  UNPAID: 'conge_sans_solde',
  SPECIAL: 'conge_special',
};

// Contract Types
exports.CONTRACT_TYPE = {
  CDI: 'CDI', // Contrat à Durée Indéterminée
  CDD: 'CDD', // Contrat à Durée Déterminée
  STAGE: 'Stage',
  APPRENTISSAGE: 'Apprentissage',
  INTERIM: 'Intérim',
};

// Transaction Types
exports.TRANSACTION_TYPE = {
  INCOME: 'encaissement',
  EXPENSE: 'decaissement',
  TRANSFER: 'virement',
  ADVANCE: 'avance',
  REGULARIZATION: 'regularisation',
};

// Stock Movement Types
exports.STOCK_MOVEMENT = {
  IN: 'entree',
  OUT: 'sortie',
  TRANSFER: 'transfert',
  ADJUSTMENT: 'ajustement',
  RETURN: 'retour',
};

// Maintenance Types
exports.MAINTENANCE_TYPE = {
  PREVENTIVE: 'preventive',
  CURATIVE: 'curative',
  PREDICTIVE: 'predictive',
};

// Machine Status
exports.MACHINE_STATUS = {
  OPERATIONAL: 'operationnelle',
  MAINTENANCE: 'en_maintenance',
  BREAKDOWN: 'en_panne',
  STOPPED: 'arretee',
  RETIRED: 'reformee',
};

// Ticket Status
exports.TICKET_STATUS = {
  NEW: 'nouveau',
  ASSIGNED: 'assigne',
  IN_PROGRESS: 'en_cours',
  PENDING: 'en_attente',
  RESOLVED: 'resolu',
  CLOSED: 'ferme',
  REOPENED: 'rouvert',
};

// Quality Test Status
exports.QUALITY_STATUS = {
  PASSED: 'conforme',
  FAILED: 'non_conforme',
  PENDING: 'en_attente',
  IN_PROGRESS: 'en_cours',
};

// Production Order Status
exports.PRODUCTION_STATUS = {
  PLANNED: 'planifie',
  IN_PROGRESS: 'en_cours',
  PAUSED: 'en_pause',
  COMPLETED: 'termine',
  CANCELLED: 'annule',
};

// Approval Workflow
exports.APPROVAL_STATUS = {
  PENDING: 'en_attente',
  APPROVED: 'approuve',
  REJECTED: 'rejete',
  DELEGATED: 'delegue',
};

// File Types
exports.FILE_TYPE = {
  IMAGE: 'image',
  PDF: 'pdf',
  EXCEL: 'excel',
  WORD: 'word',
  OTHER: 'other',
};

// Date Formats
exports.DATE_FORMAT = {
  DISPLAY: 'DD/MM/YYYY',
  DATABASE: 'YYYY-MM-DD',
  DATETIME: 'DD/MM/YYYY HH:mm',
  TIME: 'HH:mm',
};

// Pagination
exports.PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Error Codes
exports.ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  DUPLICATE: 'DUPLICATE',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
};

// Success Codes
exports.SUCCESS_CODE = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  SUCCESS: 'SUCCESS',
};

// HTTP Status Codes
exports.HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  INTERNAL_ERROR: 500,
};

// Regex Patterns
exports.REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\+225|0)?[0-9]{10}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMERIC: /^[0-9]+$/,
};

// Default Values
exports.DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  TOKEN_EXPIRY: 24 * 60 * 60, // 24 hours in seconds
  CACHE_TTL: 3600, // 1 hour in seconds
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
};