const DepartmentData = require("../models/DepartmentData");
const { ValidationError } = require("../middleware/errorHandler");
const {
  getDepartmentSchema,
} = require("../config/departmentSchema");

/**
 * ==========================================
 * DEPARTMENT DATA SERVICE
 * Validation et logique métier
 * ==========================================
 */

class DepartmentDataService {
  /**
   * Validate data against schema
   */
  validateData(deptCode, data) {
    const schema = getDepartmentSchema(deptCode);
    const errors = [];

    // Check required fields
    schema.fields.forEach((field) => {
      if (field.required && !data[field.key]) {
        errors.push(`Le champ "${field.label}" est requis`);
      }

      // Type validation
      if (data[field.key]) {
        if (field.type === "number" && isNaN(parseFloat(data[field.key]))) {
          errors.push(`Le champ "${field.label}" doit être un nombre`);
        }

        // Min/max validation
        if (field.type === "number") {
          const value = parseFloat(data[field.key]);
          if (field.min !== undefined && value < field.min) {
            errors.push(`Le champ "${field.label}" doit être ≥ ${field.min}`);
          }
          if (field.max !== undefined && value > field.max) {
            errors.push(`Le champ "${field.label}" doit être ≤ ${field.max}`);
          }
        }
      }
    });

    // Validate machines data if present
    if (schema.machines && data.machines_data) {
      Object.entries(data.machines_data).forEach(([key, value]) => {
        if (value && isNaN(parseFloat(value))) {
          errors.push(`La valeur pour ${key} doit être un nombre`);
        }
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }

    return true;
  }

  /**
   * Prepare data for storage
   */
  prepareData(deptCode, data, userId) {
    const prepared = { ...data, user_id: userId };

    // Parse JSON fields
    const schema = getDepartmentSchema(deptCode);
    schema.fields.forEach((field) => {
      if (field.type === "textarea" && prepared[field.key]) {
        try {
          // Try to parse as JSON if it looks like JSON
          if (
            prepared[field.key].trim().startsWith("{") ||
            prepared[field.key].trim().startsWith("[")
          ) {
            prepared[field.key] = JSON.parse(prepared[field.key]);
          }
        } catch {
          // Keep as string if not valid JSON
        }
      }
    });

    return prepared;
  }

  /**
   * Get all data with filters
   */
  async getAll(deptCode, options = {}, userId = null) {
    try {
      console.log("Service getAll called with:", { deptCode, options, userId });

      const { page, limit, dateFrom, dateTo, sortBy, sortOrder } = options;

      const result = await DepartmentData.findAll(deptCode, {
        page,
        limit,
        dateFrom,
        dateTo,
        userId,
        sortBy,
        sortOrder,
      });

      console.log("Service result:", result);
      return result;
    } catch (error) {
      console.error("Service getAll error:", error);
      throw error;
    }
  }

  /**
   * Get single data entry
   */
  async getById(deptCode, id) {
    const data = await DepartmentData.findById(deptCode, id);
    if (!data) {
      throw new Error("Donnée non trouvée");
    }
    return data;
  }

  /**
   * Create new data entry
   */
  async create(deptCode, data, userId) {
    try {
      console.log("Service create called with:", { deptCode, data, userId });

      // Validate data against schema
      const schema = getDepartmentSchema(deptCode);

      // Check required fields
      const requiredFields = schema.fields.filter((f) => f.required);
      for (const field of requiredFields) {
        if (!data[field.key]) {
          throw new Error(`Le champ "${field.label}" est requis`);
        }
      }

      // Add user_id to data
      const dataWithUser = {
        ...data,
        user_id: userId,
      };

      // Create in database
      const newData = await DepartmentData.create(deptCode, dataWithUser);

      console.log("Service create result:", newData);
      return newData;
    } catch (error) {
      console.error("Service create error:", error);
      throw error;
    }
  }

  /**
   * Update data entry
   */
  async update(deptCode, id, data, userId) {
    // Check existence
    const existing = await DepartmentData.findById(deptCode, id);
    if (!existing) {
      throw new Error("Donnée non trouvée");
    }

    // Validate
    this.validateData(deptCode, data);

    // Prepare
    const preparedData = this.prepareData(deptCode, data, userId);

    // Update
    const updated = await DepartmentData.update(deptCode, id, preparedData);

    return updated;
  }

  /**
   * Delete data entry
   */
  async delete(deptCode, id, userId) {
    // Check existence
    const existing = await DepartmentData.findById(deptCode, id);
    if (!existing) {
      throw new Error("Donnée non trouvée");
    }

    // Delete
    const deleted = await DepartmentData.delete(deptCode, id);

    return deleted;
  }

  /**
   * Get statistics
   */
  async getStats(deptCode, userId = null) {
    return await DepartmentData.getStats(deptCode, userId);
  }

  /**
   * Get aggregated data
   */
  async getAggregated(deptCode, options = {}) {
    return await DepartmentData.getAggregated(deptCode, options);
  }

  /**
   * Export data
   */
  async exportData(deptCode, options = {}) {
    const data = await DepartmentData.exportData(deptCode, options);
    return data;
  }

  /**
   * Generate CSV from data
   */
  generateCSV(data) {
    if (!data || data.length === 0) {
      return "";
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Headers
    csvRows.push(headers.join(","));

    // Data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape commas and quotes
        if (value === null || value === undefined) return "";
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  }
}

module.exports = new DepartmentDataService();
