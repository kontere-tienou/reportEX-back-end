// routes/schemaRoutes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getDepartmentSchema,
  DEPARTMENT_DATA_SCHEMAS,
} = require("../config/departmentSchema");


router.use(authenticate);


router.get("/", (req, res) => {
  try {
    const departments = Object.keys(DEPARTMENT_DATA_SCHEMAS)
      .filter((key) => key !== "DEFAULT")
      .map((key) => ({
        code: key,
        name: key.replace(/_/g, " "),
        icon: DEPARTMENT_DATA_SCHEMAS[key].icon,
        ...DEPARTMENT_DATA_SCHEMAS[key],
      }));
    res.json(departments);
  } catch (error) {
    console.error("Error fetching schemas:", error);
    res.status(500).json({ error: "Error fetching schemas" });
  }
});


router.get("/:deptCode", (req, res) => {
  try {
    const { deptCode } = req.params;
    const schema = getDepartmentSchema(deptCode);

    if (!schema) {
      return res.status(404).json({ error: "Schema not found" });
    }

    res.json(schema);
  } catch (error) {
    console.error("Error fetching schema:", error);
    res.status(500).json({ error: "Error fetching schema" });
  }
});

module.exports = router;
