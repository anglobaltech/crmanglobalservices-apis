const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");

const {
  getRoles,
  createRole,
  updateRole,
  seedRoles,
  reseedRoles,
  getRoleById,
  syncAllUsers,
} = require("../controllers/roleController");

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.roleName !== "admin" && req.user.roleName !== "Super Admin")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

router.post("/seed", seedRoles);              
router.post("/reseed", verifyToken, requireAdmin, reseedRoles); 
router.post("/sync-users", verifyToken, requireAdmin, syncAllUsers); 
router.get("/", verifyToken, getRoles);
router.get("/:id", verifyToken, getRoleById);
router.post("/", verifyToken, requireAdmin, createRole);
router.put("/:id", verifyToken, requireAdmin, updateRole);

module.exports = router;