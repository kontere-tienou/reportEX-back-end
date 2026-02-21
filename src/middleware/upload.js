const multer = require("multer");
const path = require("path");
const fs = require("fs");
const config = require("../config/config");
const { AppError } = require("./errorHandler");
const { HTTP_STATUS } = require("../config/constants");

/**
 * ==========================================
 * FILE UPLOAD MIDDLEWARE
 * ==========================================
 */

// Ensure upload directory exists
const uploadDir = config.upload.directory;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectories based on file type
    let subDir = "others";

    if (file.mimetype.startsWith("image/")) {
      subDir = "images";
    } else if (file.mimetype === "application/pdf") {
      subDir = "documents";
    } else if (
      file.mimetype.includes("spreadsheet") ||
      file.mimetype.includes("excel")
    ) {
      subDir = "spreadsheets";
    }

    const fullPath = path.join(uploadDir, subDir);

    // Create directory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50);

    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter
 */
const fileFilter = (req, file, cb) => {
  // Check if file type is allowed
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Type de fichier non autorisé: ${file.mimetype}`,
        HTTP_STATUS.BAD_REQUEST,
      ),
      false,
    );
  }
};

/**
 * Multer configuration
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxSize,
    files: 10, // Max 10 files per request
  },
  fileFilter: fileFilter,
});

/**
 * Single file upload
 */
const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

/**
 * Multiple files upload
 */
const uploadMultiple = (fieldName, maxCount = 10) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Multiple fields upload
 */
const uploadFields = (fields) => {
  return upload.fields(fields);
};

/**
 * Delete file helper
 */
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Get file info
 */
const getFileInfo = (file) => {
  if (!file) return null;

  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/${path.relative(uploadDir, file.path).replace(/\\/g, "/")}`,
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  deleteFile,
  getFileInfo,
};
