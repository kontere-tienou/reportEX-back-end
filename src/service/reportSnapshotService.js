// backend/src/service/reportSnapshotService.js
const DepartmentData = require("../models/DepartmentData");
const db = require("../config/database");

async function generateSnapshot(layout, departmentId, dateRange) {
    const snapshot = {
        metrics: {},
        charts: {},
        tables: {},
        generatedAt: new Date().toISOString()
    };

    try {
        // First, get the department code from the ID
        const deptResult = await db.query(
            `SELECT code FROM departments WHERE id = $1`,
            [departmentId]
        );
        
        if (deptResult.rows.length === 0) {
            throw new Error(`Department with ID ${departmentId} not found`);
        }
        
        const departmentCode = deptResult.rows[0].code;
        console.log(`Using department code: ${departmentCode} for ID: ${departmentId}`);

        // Group metrics by type
        const metricRequests = [];
        const chartRequests = [];

        layout.forEach(component => {
            if (component.type === 'metric') {
                metricRequests.push({
                    field: component.config.field,
                    calculation: component.config.calculation || 'sum'
                });
            } else if (component.type === 'chart' && component.config.chartType !== 'pie') {
                const yAxes = Array.isArray(component.config.yAxis) 
                    ? component.config.yAxis 
                    : [component.config.yAxis];
                
                yAxes.forEach(field => {
                    metricRequests.push({
                        field,
                        calculation: component.config.aggregation || 'sum'
                    });
                });
                chartRequests.push(component);
            }
        });

        // Fetch all metrics using department CODE, not ID
        if (metricRequests.length > 0) {
            try {
                // You need to modify your service to accept department CODE
                const metrics = await getBatchMetricsForDepartment(
                    departmentCode, // Use CODE here
                    metricRequests,
                    dateRange
                );
                snapshot.metrics = metrics;
            } catch (error) {
                console.error('Error fetching batch metrics:', error.message);
                // Return zeros for failed metrics
                metricRequests.forEach(req => {
                    const key = `${req.field}_${req.calculation}`;
                    snapshot.metrics[key] = 0;
                });
            }
        }

        return snapshot;

    } catch (error) {
        console.error('Error generating snapshot:', error);
        return snapshot;
    }
}

// Helper function to get metrics using department CODE
async function getBatchMetricsForDepartment(departmentCode, metrics, dateRange) {
    const tableName = DepartmentData.getTableName(departmentCode);
    
    // First, check which columns exist in this table
    const columnsResult = await db.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1`,
        [tableName]
    );
    
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    console.log(`Existing columns in ${tableName}:`, existingColumns);
    
    // Filter metrics to only those with existing columns
    const validMetrics = metrics.filter(m => 
        existingColumns.includes(m.field)
    );
    
    const missingMetrics = metrics.filter(m => 
        !existingColumns.includes(m.field)
    );
    
    if (missingMetrics.length > 0) {
        console.warn(`Missing columns in ${tableName}:`, 
            missingMetrics.map(m => m.field)
        );
    }
    
    if (validMetrics.length === 0) {
        // No valid metrics, return zeros
        const result = {};
        metrics.forEach(m => {
            const key = `${m.field}_${m.calculation}`;
            result[key] = 0;
        });
        return result;
    }
    
    // Build query for valid metrics only
    const selects = validMetrics.map(m => {
        switch(m.calculation) {
            case 'sum':
                return `COALESCE(SUM(${m.field}), 0) as "${m.field}_sum"`;
            case 'avg':
                return `COALESCE(AVG(${m.field}), 0) as "${m.field}_avg"`;
            case 'max':
                return `COALESCE(MAX(${m.field}), 0) as "${m.field}_max"`;
            case 'min':
                return `COALESCE(MIN(${m.field}), 0) as "${m.field}_min"`;
            case 'count':
                return `COUNT(${m.field}) as "${m.field}_count"`;
            default:
                return `COALESCE(SUM(${m.field}), 0) as "${m.field}_sum"`;
        }
    }).join(', ');
    
    const query = `
        SELECT ${selects}
        FROM ${tableName}
        WHERE date BETWEEN $1 AND $2
    `;
    
    try {
        const result = await db.query(query, [dateRange.start, dateRange.end]);
        
        // Fill in zeros for missing metrics
        const finalResult = {};
        metrics.forEach(m => {
            const key = `${m.field}_${m.calculation}`;
            finalResult[key] = result.rows[0]?.[key] || 0;
        });
        
        return finalResult;
    } catch (error) {
        console.error('Query error:', error);
        // Return zeros on error
        const result = {};
        metrics.forEach(m => {
            const key = `${m.field}_${m.calculation}`;
            result[key] = 0;
        });
        return result;
    }
}

module.exports = { generateSnapshot };
