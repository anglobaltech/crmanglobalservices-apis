const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const {
  getProjects,
  getProjectStats,
  getProjectById,
  getProjectActivity,
  createProject,
  updateProject,
  toggleChecklistItem,
  toggleIsiStep,
  addRemark,
  deleteProject,
} = require("../controllers/projectController");

router.get("/stats", verifyToken, getProjectStats);
router.get("/", verifyToken, getProjects);
router.get("/:id", verifyToken, getProjectById);
router.get("/:id/activity", verifyToken, getProjectActivity);
router.post("/", verifyToken, createProject);
router.put("/:id", verifyToken, updateProject);
router.put("/:id/checklist/:itemId", verifyToken, toggleChecklistItem);  // non-ISI
router.put("/:id/stage/:stepId", verifyToken, toggleIsiStep);        // ISI stages
router.post("/:id/remark", verifyToken, addRemark);             // remarks
router.delete("/:id", verifyToken, deleteProject);

module.exports = router;
