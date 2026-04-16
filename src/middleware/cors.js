// src/middleware/cors.js
const allowedOrigins = [
  "https://report-ex.vercel.app",
  "https://reportex-back-end.up.railway.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  // Set other CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  );
  res.setHeader("Access-Control-Expose-Headers", "Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
};

module.exports = corsMiddleware;
