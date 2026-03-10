const db = require("../config/database");

/**
 * ==========================================
 * REPORT MODEL - FIXED VISIBILITY AND JSON HANDLING
 * ==========================================
 */

class Report {
  /**
   * Create new report
   */
  static async create(data) {
    const {
      user_id,
      department_id,
      period_start,
      period_end,
      layout: reportData,
      visibility = "private",
      title,
    } = data;

    // ✅ FIX: Ensure visibility is a STRING, not array
    let visibilityValue = visibility;

    // If array received (from old frontend), take first value
    if (Array.isArray(visibility)) {
      visibilityValue = visibility[0] || "private";
      console.warn(
        "⚠️ Received array for visibility, using first value:",
        visibilityValue,
      );
    }

    // Validate visibility value
    if (!["private", "department", "public"].includes(visibilityValue)) {
      console.warn(
        "⚠️ Invalid visibility value:",
        visibilityValue,
        '- using default "private"',
      );
      visibilityValue = "private";
    }

    // IMPORTANT FIX: Ensure reportData is a proper JSON object, not a string
    let jsonData = reportData;

    // If it's already a string, parse it to ensure it's a proper object
    if (typeof reportData === "string") {
      try {
        jsonData = JSON.parse(reportData);
      } catch (e) {
        console.error("Failed to parse reportData string:", e);
        jsonData = { error: "Invalid JSON", raw: reportData };
      }
    }

    // If it's null or undefined, create a default object
    if (jsonData === null || jsonData === undefined) {
      jsonData = {
        title: `Report ${period_start} - ${period_end}`,
        layout: [],
        sourceData: {},
        generatedAt: new Date().toISOString(),
      };
    }

    // Log what we're inserting (for debugging)
    console.log("Inserting report with data keys:", Object.keys(jsonData));

    // CRITICAL FIX: Pass the JSON object directly, NOT stringified
    // PostgreSQL driver will handle JSON conversion automatically
    const result = await db.query(
      `INSERT INTO reports (
        user_id,
        department_id,
        period_start,
        period_end,
        title,
        data,
        visibility,
        status,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'brouillon',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        user_id,
        department_id,
        period_start,
        period_end,
        title,
        jsonData,
        visibilityValue,
      ],
    );

    console.log("Report created successfully with ID:", result.rows[0]?.id);
    return result.rows[0];
  }

  /**
   * Find report by ID with full details
   */
  static async findById(id) {
    const result = await db.query(
      `SELECT r.*,
              u.full_name AS author_name,
              u.email AS author_email,
              d.name AS department_name,
              d.code AS department_code,
              d.color AS department_color,
              d.icon AS department_icon,
              validator.full_name AS validator_name
       FROM reports r
       JOIN users u ON r.user_id = u.id
       JOIN departments d ON r.department_id = d.id
       LEFT JOIN users validator ON r.validated_by = validator.id
       WHERE r.id = $1`,
      [id],
    );

    return result.rows[0];
  }

  /**
   * Get all reports with filters
   */
  static async findAll(filters = {}) {
    const {
      page = 1,
      limit = 20,
      user_id,
      department_id,
      status,
      visibility,
      search,
    } = filters;

    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;

    let query = `
      SELECT r.*,
             u.full_name AS author_name,
             d.name AS department_name,
             d.code AS department_code
      FROM reports r
      JOIN users u ON r.user_id = u.id
      JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `;

    if (user_id) {
      query += ` AND r.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (department_id) {
      query += ` AND r.department_id = $${paramCount}`;
      params.push(department_id);
      paramCount++;
    }

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (visibility) {
      query += ` AND r.visibility = $${paramCount}`;
      params.push(visibility);
      paramCount++;
    }

    if (search) {
      query += ` AND (d.name ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      JOIN users u ON r.user_id = u.id
      JOIN departments d ON r.department_id = d.id
      WHERE 1=1
    `;

    const countParams = [];
    let countParamCount = 1;
    let countWhereClause = "";

    if (user_id) {
      countWhereClause += ` AND r.user_id = $${countParamCount}`;
      countParams.push(user_id);
      countParamCount++;
    }

    if (department_id) {
      countWhereClause += ` AND r.department_id = $${countParamCount}`;
      countParams.push(department_id);
      countParamCount++;
    }

    if (status) {
      countWhereClause += ` AND r.status = $${countParamCount}`;
      countParams.push(status);
      countParamCount++;
    }

    if (visibility) {
      countWhereClause += ` AND r.visibility = $${countParamCount}`;
      countParams.push(visibility);
      countParamCount++;
    }

    if (search) {
      countWhereClause += ` AND (d.name ILIKE $${countParamCount} OR u.full_name ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
      countParamCount++;
    }

    const finalCountQuery = countQuery + countWhereClause;
    const countResult = await db.query(finalCountQuery, countParams);
    const total = countResult.rows[0] ? parseInt(countResult.rows[0].total) : 0;

    // Add pagination
    query += ` ORDER BY r.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      reports: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update report
   */
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== "id") {
        if (key === "data") {
          // FIX: For updates, also pass the object directly, not stringified
          fields.push(`${key} = $${paramCount}`);
          let jsonData = updateData[key];

          // If it's a string, parse it
          if (typeof jsonData === "string") {
            try {
              jsonData = JSON.parse(jsonData);
            } catch (e) {
              console.error("Failed to parse update data:", e);
            }
          }

          values.push(jsonData); // Pass object directly
        } else if (key === "visibility") {
          // Handle visibility as string
          let vis = updateData[key];
          if (Array.isArray(vis)) vis = vis[0] || "private";
          fields.push(`${key} = $${paramCount}`);
          values.push(vis);
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(updateData[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const query = `
      UPDATE reports 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Rest of your methods remain the same...
  // Submit, validate, delete, etc.

  static async submit(id, userId) {
    const result = await db.query(
      `UPDATE reports
       SET status = 'soumis',
           submitted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       AND user_id = $2
       AND status IN ('brouillon', 'rejete')
       RETURNING *`,
      [id, userId],
    );

    return result.rows[0];
  }

  static async validate(id, validatorId, validationData) {
    const { status, comments } = validationData;

    const result = await db.query(
      `UPDATE reports
       SET status = $1,
           validated_by = $2,
           validated_at = CURRENT_TIMESTAMP,
           rejection_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       AND status = 'soumis'
       RETURNING *`,
      [status, validatorId, status === "rejete" ? comments : null, id],
    );

    if (result.rows[0]) {
      // Insert validation record
      await db.query(
        `INSERT INTO validations (report_id, validator_id, status, comments)
         VALUES ($1, $2, $3, $4)`,
        [id, validatorId, status, comments],
      );
    }

    return result.rows[0];
  }

  static async delete(id, userId) {
    const result = await db.query(
      `DELETE FROM reports
       WHERE id = $1
       AND user_id = $2
       AND status = 'brouillon'
       RETURNING *`,
      [id, userId],
    );

    return result.rows[0];
  }

  static async getValidations(reportId) {
    const result = await db.query(
      `SELECT v.*,
              u.full_name AS validator_name
       FROM validations v
       JOIN users u ON v.validator_id = u.id
       WHERE v.report_id = $1
       ORDER BY v.created_at DESC`,
      [reportId],
    );

    return result.rows;
  }

  static async addComment(reportId, userId, content) {
    const result = await db.query(
      `INSERT INTO report_comments (report_id, user_id, comment)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [reportId, userId, content],
    );

    return result.rows[0];
  }

  static async getComments(reportId) {
    const result = await db.query(
      `SELECT c.*,
              u.full_name AS user_name,
              u.email AS user_email
       FROM report_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.report_id = $1
       ORDER BY c.created_at ASC`,
      [reportId],
    );

    return result.rows;
  }

  static async markAsRead(reportId, userId) {
    await db.query(
      `INSERT INTO report_reads (report_id, user_id, read_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (report_id, user_id)
       DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
      [reportId, userId],
    );
  }

  static async getReaders(reportId) {
    const result = await db.query(
      `SELECT rr.*,
              u.full_name,
              u.email,
              d.name AS department_name
       FROM report_reads rr
       JOIN users u ON rr.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE rr.report_id = $1
       ORDER BY rr.read_at DESC`,
      [reportId],
    );

    return result.rows;
  }

  static async addAnnotation(reportId, userId, annotationData) {
    const { selected_text, comment, decision, range_meta } = annotationData;

    const result = await db.query(
      `INSERT INTO report_annotations (
        report_id, user_id, selected_text, comment, decision, range_meta
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        reportId,
        userId,
        selected_text,
        comment,
        decision,
        range_meta ? JSON.stringify(range_meta) : null,
      ],
    );

    return result.rows[0];
  }

  static async getAnnotations(reportId) {
    const result = await db.query(
      `SELECT a.*,
              u.full_name AS user_name
       FROM report_annotations a
       JOIN users u ON a.user_id = u.id
       WHERE a.report_id = $1
       ORDER BY a.created_at DESC`,
      [reportId],
    );

    return result.rows;
  }

  static async canUserRead(reportId, user) {
    const report = await Report.findById(reportId);

    if (!report) return false;

    // Author can always read
    if (report.user_id === user.id) return true;

    // DG/Admin can read everything
    if (["DG", "ADMIN"].includes(user.role?.toUpperCase())) return true;

    // Check visibility
    if (report.visibility === "public") return true;

    if (report.visibility === "department") {
      return report.department_id === user.department_id;
    }

    // Private - check access grant
    const accessResult = await db.query(
      `SELECT 1 FROM report_access_grants
       WHERE report_id = $1 AND user_id = $2`,
      [reportId, user.id],
    );

    return accessResult.rowCount > 0;
  }

  static async getPermissions(reportId, user) {
    const report = await Report.findById(reportId);

    if (!report) {
      return {
        canRead: false,
        canEdit: false,
        canSubmit: false,
        canValidate: false,
        canDelete: false,
        canAnnotate: false,
        needsAccessRequest: false,
      };
    }

    const isAuthor = report.user_id === user.id;
    const isDG = ["DG", "ADMIN"].includes(user.role?.toUpperCase());

    const canRead = await Report.canUserRead(reportId, user);

    return {
      canRead,
      canEdit: isAuthor && ["brouillon", "rejete"].includes(report.status),
      canSubmit: isAuthor && ["brouillon", "rejete"].includes(report.status),
      canValidate: isDG && report.status === "soumis",
      canDelete: isAuthor && report.status === "brouillon",
      canAnnotate: isDG,
      needsAccessRequest: !canRead && report.visibility === "private",
    };
  }

  static async getDepartmentStats(departmentId) {
    const result = await db.query(
      `SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'brouillon' THEN 1 END)::int AS drafts,
        COUNT(CASE WHEN status = 'soumis' THEN 1 END)::int AS pending,
        COUNT(CASE WHEN status = 'valide' THEN 1 END)::int AS validated,
        COUNT(CASE WHEN status = 'rejete' THEN 1 END)::int AS rejected
       FROM reports
       WHERE department_id = $1`,
      [departmentId],
    );

    return result.rows[0];
  }
}

module.exports = Report;
