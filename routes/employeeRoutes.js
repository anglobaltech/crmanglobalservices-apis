const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const { 
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleStatus,
} = require("../controllers/employeeController");

router.get("/",           verifyToken, getEmployees);
router.get("/:id",        verifyToken, getEmployee);
router.post("/",          verifyToken, createEmployee);
router.put("/:id",        verifyToken, updateEmployee);
router.delete("/:id",     verifyToken, deleteEmployee);
router.patch("/:id/status", verifyToken, toggleStatus);

module.exports = router;
