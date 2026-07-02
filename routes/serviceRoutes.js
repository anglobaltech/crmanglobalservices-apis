const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const {
  getServices,
  getDashboardStats,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getActivity,
  addActivity,
} = require("../controllers/serviceController");

router.get("/stats", verifyToken, getDashboardStats);
router.get("/", verifyToken, getServices);
router.get("/:id", verifyToken, getServiceById);
router.post("/", verifyToken, createService);
router.put("/:id", verifyToken, updateService);
router.delete("/:id", verifyToken, deleteService);
router.get("/:id/activity", verifyToken, getActivity);
router.post("/:id/activity", verifyToken, addActivity);

module.exports = router;
