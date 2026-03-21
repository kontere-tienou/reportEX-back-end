// departmentDataService.js
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
      LIST: 30 * 1000, // 30 secondes
    };
  }

  _getCacheKey(prefix, deptCode, options = {}, userId = null) {
    // On exclut _t du cache key pour que le cache-busting frontend
    // soit ignoré ici (le cache est géré côté service, pas par timestamp)
    const { _t, ...stableOptions } = options;
    return `${prefix}_${deptCode}_${userId || "all"}_${JSON.stringify(stableOptions)}`;
  }

  async _cached(prefix, deptCode, ttl, options = {}, userId = null, fn) {
    const cacheKey = this._getCacheKey(prefix, deptCode, options, userId);

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const data = await fn();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  clearCache(deptCode) {
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
        const { page, limit, dateFrom, dateTo, sortBy, sortOrder } = options;

        // ✅ FIX : La limite 90 jours ne s'applique QUE si dateFrom ET dateTo
        // sont tous les deux fournis ET explicitement demandés.
        // Sans filtre de date (cas du dashboard qui veut tout l'historique),
        // on ne bloque pas.
        if (dateFrom && dateTo) {
          const daysDiff = this._getDaysDiff(dateFrom, dateTo);
          if (daysDiff > 365) {
            // On monte la limite à 1 an (365j) pour couvrir les dashboards annuels
            throw new Error("La période ne peut pas dépasser 365 jours");
          }
        }

        const result = await DepartmentData.findAll(deptCode, {
          page: page ? parseInt(page) : undefined,
          // ✅ FIX : Si limit n'est pas spécifié, on récupère tout (pas de limite)
          //         Le frontend envoie limit=1000 pour l'historique complet
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
        const { dateFrom, dateTo, groupBy, metrics = [] } = options;

        if (dateFrom && dateTo) {
          const daysDiff = this._getDaysDiff(dateFrom, dateTo);
          if (daysDiff > 365) {
            throw new Error("La période ne peut pas dépasser 365 jours");
          }
        }

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
      const schema = getDepartmentSchema(deptCode);

      const requiredFields = schema.fields.filter((f) => f.required);
      for (const field of requiredFields) {
        if (!data[field.key] && data[field.key] !== 0) {
          throw new Error(`Le champ "${field.label}" est requis`);
        }
      }

      const dataWithUser = { ...data, user_id: userId };
      const newData = await DepartmentData.create(deptCode, dataWithUser);

      // ✅ FIX : clearCache APRÈS la création — le prochain getAll
      //         ira chercher les données fraîches en DB
      this.clearCache(deptCode);

      return newData;
    } catch (error) {
      console.error("Service create error:", error);
      throw error;
    }
  }

  async update(deptCode, id, data, userId) {
    const existing = await DepartmentData.findById(deptCode, id);
    if (!existing) throw new Error("Donnée non trouvée");

    this.validateData(deptCode, data);
    const preparedData = this.prepareData(deptCode, data, userId);
    const updated = await DepartmentData.update(deptCode, id, preparedData);

    // ✅ clearCache après update
    this.clearCache(deptCode);

    return updated;
  }

  async delete(deptCode, id, userId) {
    const existing = await DepartmentData.findById(deptCode, id);
    if (!existing) throw new Error("Donnée non trouvée");

    const deleted = await DepartmentData.delete(deptCode, id);

    // ✅ clearCache après delete
    this.clearCache(deptCode);

    return deleted;
  }

  validateData(deptCode, data) {
    const schema = getDepartmentSchema(deptCode);
    const errors = [];

    schema.fields.forEach((field) => {
      if (field.required && !data[field.key] && data[field.key] !== 0) {
        errors.push(`Le champ "${field.label}" est requis`);
      }

      if (data[field.key] !== undefined && data[field.key] !== null) {
        if (field.type === "number" && isNaN(parseFloat(data[field.key]))) {
          errors.push(`Le champ "${field.label}" doit être un nombre`);
        }

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
    const schema = getDepartmentSchema(deptCode);

    schema.fields.forEach((field) => {
      if (field.type === "textarea" && prepared[field.key]) {
        try {
          if (
            prepared[field.key].trim().startsWith("{") ||
            prepared[field.key].trim().startsWith("[")
          ) {
            prepared[field.key] = JSON.parse(prepared[field.key]);
          }
        } catch {
          // Keep as string
        }
      }
    });

    return prepared;
  }

  async getById(deptCode, id) {
    const data = await DepartmentData.findById(deptCode, id);
    if (!data) throw new Error("Donnée non trouvée");
    return data;
  }

  async exportData(deptCode, options = {}) {
    return await DepartmentData.exportData(deptCode, options);
  }

  generateCSV(data) {
    if (!data || data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(",")];

    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
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
    const result = await this.getAggregated(deptCode, {
      ...options,
      metrics: [{ field, calculation }],
    });

    if (!result || result.length === 0) return 0;
    return result[0][`${calculation}_${field}`] ?? 0;
  }

  async getChartData(deptCode, config, options = {}) {
    const { fields, groupBy = "date" } = config;
    const metrics = fields.map((f) => ({ field: f, calculation: "sum" }));

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
