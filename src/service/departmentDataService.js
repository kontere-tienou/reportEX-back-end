const DepartmentData = require("../models/DepartmentData");
const { ValidationError } = require("../middleware/errorHandler");
const { getDepartmentSchema } = require("../config/departmentSchema");

/**
 * ==========================================
 * DEPARTMENT DATA SERVICE WITH CACHING
 * ==========================================
 */

class DepartmentDataService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = {
      AGGREGATED: 2 * 60 * 1000, // 2 minutes
      STATS: 5 * 60 * 1000, // 5 minutes
      LIST: 30 * 1000, // 30 seconds
    };
  }

  /**
   * Generate cache key
   */
  _getCacheKey(prefix, deptCode, options = {}, userId = null) {
    return `${prefix}_${deptCode}_${userId || "all"}_${JSON.stringify(options)}`;
  }

  async _cached(prefix, deptCode, ttl, options = {}, userId = null, fn) {
    const cacheKey = this._getCacheKey(prefix, deptCode, options, userId);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ttl) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return cached.data;
      }
      console.log(`🔄 Cache expired for ${cacheKey}`);
      this.cache.delete(cacheKey);
    }

    // Execute function
    console.log(`🆕 Cache miss for ${cacheKey}, fetching fresh data`);
    const data = await fn();

    // Store in cache
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  clearCache(deptCode) {
    console.log(`🧹 Clearing cache for department: ${deptCode}`);
    for (const key of this.cache.keys()) {
      if (key.includes(deptCode)) {
        this.cache.delete(key);
      }
    }
  }

  async getAll(deptCode, options = {}, userId = null) {
    return this._cached(
      "LIST",
      deptCode,
      this.CACHE_TTL.LIST,
      options,
      userId,
      async () => {
        console.log("Service getAll called with:", {
          deptCode,
          options,
          userId,
        });
        const { page, limit, dateFrom, dateTo, sortBy, sortOrder } = options;

        // Validate date range
        if (dateFrom && dateTo) {
          const daysDiff = this._getDaysDiff(dateFrom, dateTo);
          if (daysDiff > 90) {
            throw new Error("La période ne peut pas dépasser 90 jours");
          }
        }

        const result = await DepartmentData.findAll(deptCode, {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          dateFrom,
          dateTo,
          userId,
          sortBy,
          sortOrder,
        });

        return result;
      },
    );
  }

  async getAggregated(deptCode, options = {}) {
    return this._cached(
      "AGGREGATED",
      deptCode,
      this.CACHE_TTL.AGGREGATED,
      options,
      null,
      async () => {
        console.log("Getting aggregated data for:", deptCode, options);

        // Validate and limit options
        const { dateFrom, dateTo, groupBy, metrics = [] } = options;

        // Limit date range
        if (dateFrom && dateTo) {
          const daysDiff = this._getDaysDiff(dateFrom, dateTo);
          if (daysDiff > 90) {
            throw new Error("La période ne peut pas dépasser 90 jours");
          }
        }

        // Limit number of metrics
        const safeMetrics = Array.isArray(metrics) ? metrics.slice(0, 5) : [];

        return await DepartmentData.getAggregated(deptCode, {
          dateFrom,
          dateTo,
          groupBy,
          metrics: safeMetrics,
        });
      },
    );
  }

  async getStats(deptCode, userId = null) {
    return this._cached(
      "STATS",
      deptCode,
      this.CACHE_TTL.STATS,
      {},
      userId,
      async () => {
        return await DepartmentData.getStats(deptCode, userId);
      },
    );
  }

  _getDaysDiff(dateFrom, dateTo) {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }

  async create(deptCode, data, userId) {
    try {
      console.log("Service create called with:", { deptCode, data, userId });

      // Validate data against schema
      const schema = getDepartmentSchema(deptCode);

      // Check required fields
      const requiredFields = schema.fields.filter((f) => f.required);
      for (const field of requiredFields) {
        if (!data[field.key] && data[field.key] !== 0) {
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

      // Clear cache for this department
      this.clearCache(deptCode);

      return newData;
    } catch (error) {
      console.error("Service create error:", error);
      throw error;
    }
  }

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

    // Clear cache
    this.clearCache(deptCode);

    return updated;
  }

  async delete(deptCode, id, userId) {
    // Check existence
    const existing = await DepartmentData.findById(deptCode, id);
    if (!existing) {
      throw new Error("Donnée non trouvée");
    }

    // Delete
    const deleted = await DepartmentData.delete(deptCode, id);

    // Clear cache
    this.clearCache(deptCode);

    return deleted;
  }

  validateData(deptCode, data) {
    const schema = getDepartmentSchema(deptCode);
    const errors = [];

    // Check required fields
    schema.fields.forEach((field) => {
      if (field.required && !data[field.key] && data[field.key] !== 0) {
        errors.push(`Le champ "${field.label}" est requis`);
      }

      // Type validation
      if (data[field.key] !== undefined && data[field.key] !== null) {
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

  async getById(deptCode, id) {
    const data = await DepartmentData.findById(deptCode, id);
    if (!data) {
      throw new Error("Donnée non trouvée");
    }
    return data;
  }

  async exportData(deptCode, options = {}) {
    const data = await DepartmentData.exportData(deptCode, options);
    return data;
  }

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

  async getMetric(deptCode, field, calculation, options = {}) {
    const metrics = [
      {
        field,
        calculation,
      },
    ];

    const result = await this.getAggregated(deptCode, {
      ...options,
      metrics,
    });

    if (!result || result.length === 0) {
      return 0;
    }

    const key = `${calculation}_${field}`;

    return result[0][key] ?? 0;
  }

  async getChartData(deptCode, config, options = {}) {
    const { fields, groupBy = "date" } = config;

    const metrics = fields.map((f) => ({
      field: f,
      calculation: "sum",
    }));

    const result = await this.getAggregated(deptCode, {
      ...options,
      groupBy,
      metrics,
    });

    return result || [];
  }

  async getTableData(deptCode, options = {}) {
    const result = await this.getAll(deptCode, {
      limit: options.limit || 10,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
    });

    return result?.data || [];
  }
}
module.exports = new DepartmentDataService();
