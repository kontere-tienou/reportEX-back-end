const express = require('express');
const cors = require('cors');
const http = require("http");
const socketIo = require("socket.io");
require('dotenv').config({ path: '.env.local' });

const app = express();
// Création du serveur HTTP et de l'instance Socket.IO
const server = http.createServer(app);
const io = socketIo(server); 

// Middleware
app.use(
  cors({
    //origin: process.env.FRONTEND_URL || 'http://localhost:5174',
    origin: process.env.FRONTEND_URL || "https://report-ex.vercel.app",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./src/routes/authRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const managementRoutes = require('./src/routes/namagmentRoutes');
const itRoutes = require('./src/routes/itRoute');

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/it", itRoutes);

// Route de test
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'BATEX-CI Reporting API is running',
        timestamp: new Date().toISOString()
    });
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route non trouvée'
    });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Socket.IO pour les mises à jour en temps réel des tickets IT
app.post("/api/it/tickets/:id/update", (req, res) => {
  const { status } = req.body;
  const ticketId = req.params.id;
  // Ici, vous mettriez à jour le ticket dans la base de données
  io.emit("ticketUpdated", { ticketId, status });

  res.status(200).json({ success: true, message: "Ticket status updated" });
});

const PORT = process.env.PORT || 5008;

app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║ BATEX-CI REPORTING SYSTEM API                     ║
  ║ Serveur démarré sur le port ${PORT}                  ║
  ║ Environment: ${process.env.NODE_ENV || 'development'}                          ║
  ║ URL: http://localhost:${PORT}                        ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;