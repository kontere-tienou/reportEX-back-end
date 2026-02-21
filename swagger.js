const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const config = require("./config/config");

/**
 * ==========================================
 * SWAGGER API DOCUMENTATION
 * ==========================================
 */

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BATEX ERP API Documentation",
      version: "1.0.0",
      description: `
        API complète pour le système ERP BATEX-CI.
        
        ## Features
        - 🔐 Authentification JWT
        - 👥 Gestion des utilisateurs
        - 🏢 Gestion des départements  
        - 👨‍💼 Gestion des employés
        - 🔔 Système de notifications
        - 📊 Rapports et statistiques
        - 🔌 WebSocket (Socket.IO) pour temps réel
        
        ## Authentification
        Utilisez le header Authorization avec le format: \`Bearer <token>\`
      `,
      contact: {
        name: "BATEX-CI Support",
        email: "support@batex-ci.com",
      },
      license: {
        name: "Propriétaire",
        url: "https://batex-ci.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: "Serveur de développement",
      },
      {
        url: "https://api.batex-ci.com",
        description: "Serveur de production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT obtenu via /api/auth/login",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            email: {
              type: "string",
              format: "email",
              example: "user@batex-ci.com",
            },
            full_name: { type: "string", example: "Jean Kouassi" },
            role: {
              type: "string",
              enum: ["ADMIN", "DG", "MANAGER", "SUPERVISOR", "USER", "VIEWER"],
              example: "USER",
            },
            department_id: { type: "integer", example: 1 },
            phone: { type: "string", example: "+225 0123456789" },
            is_active: { type: "boolean", example: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Department: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            code: { type: "string", example: "RH" },
            name: { type: "string", example: "Ressources Humaines" },
            icon: { type: "string", example: "users" },
            color: { type: "string", example: "blue" },
            description: { type: "string" },
            manager_id: { type: "integer", nullable: true },
            is_active: { type: "boolean", example: true },
          },
        },
        Employee: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            matricule: { type: "string", example: "EMP-001" },
            first_name: { type: "string", example: "Jean" },
            last_name: { type: "string", example: "Kouassi" },
            email: { type: "string", format: "email" },
            phone: { type: "string", example: "+225 0123456789" },
            date_of_birth: { type: "string", format: "date" },
            hire_date: { type: "string", format: "date" },
            department_id: { type: "integer", example: 1 },
            position: { type: "string", example: "Développeur" },
            contract_type: {
              type: "string",
              enum: ["CDI", "CDD", "Stage", "Apprentissage", "Intérim"],
              example: "CDI",
            },
            salary: { type: "number", format: "decimal", example: 500000 },
            status: {
              type: "string",
              enum: ["active", "on_leave", "terminated", "suspended"],
              example: "active",
            },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            user_id: { type: "integer", example: 1 },
            type: { type: "string", example: "info" },
            title: { type: "string", example: "Nouvelle notification" },
            message: {
              type: "string",
              example: "Vous avez un nouveau message",
            },
            link: { type: "string", nullable: true },
            is_read: { type: "boolean", example: false },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            total: { type: "integer", example: 100 },
            totalPages: { type: "integer", example: 5 },
            hasNext: { type: "boolean", example: true },
            hasPrev: { type: "boolean", example: false },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Non autorisé - Token manquant ou invalide",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        Forbidden: {
          description: "Accès interdit - Permissions insuffisantes",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        NotFound: {
          description: "Ressource non trouvée",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        ValidationError: {
          description: "Erreur de validation des données",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        ServerError: {
          description: "Erreur interne du serveur",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Auth",
        description: "Authentification et gestion de session",
      },
      {
        name: "Users",
        description: "Gestion des utilisateurs",
      },
      {
        name: "Departments",
        description: "Gestion des départements",
      },
      {
        name: "Employees",
        description: "Gestion des employés",
      },
      {
        name: "Notifications",
        description: "Système de notifications",
      },
    ],
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"],
};

const specs = swaggerJsdoc(options);

/**
 * Setup Swagger UI
 */
const setupSwagger = (app) => {
  // Swagger UI options
  const swaggerOptions = {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "BATEX ERP API Docs",
  };

  // Serve Swagger docs
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

  // Serve Swagger JSON
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });

  console.log("📚 Swagger documentation available at /api-docs");
};

module.exports = { setupSwagger, specs };
