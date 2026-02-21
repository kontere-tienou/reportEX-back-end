const jwt = require("jsonwebtoken");
const config = require("../config/config");

/**
 * ==========================================
 * JWT UTILITY
 * ==========================================
 */

/**
 * Generate access token
 */
const generateAccessToken = (userId, additionalPayload = {}) => {
  const payload = {
    userId,
    type: "access",
    ...additionalPayload,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  const payload = {
    userId,
    type: "refresh",
  };

  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error("Token invalide ou expiré");
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    throw new Error("Refresh token invalide ou expiré");
  }
};

/**
 * Decode token without verification
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Get token expiry time
 */
const getTokenExpiry = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;
  return new Date(decoded.exp * 1000);
};

/**
 * Check if token is expired
 */
const isTokenExpired = (token) => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return expiry < new Date();
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = (userId, additionalPayload = {}) => {
  return {
    accessToken: generateAccessToken(userId, additionalPayload),
    refreshToken: generateRefreshToken(userId),
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
  isTokenExpired,
  generateTokenPair,
};
