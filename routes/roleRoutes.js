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

router.post("/seed", seedRoles);              
router.post("/reseed", verifyToken, reseedRoles); 
router.post("/sync-users", verifyToken, syncAllUsers); 
router.get("/", verifyToken, getRoles);
router.get("/:id", verifyToken, getRoleById);
router.post("/", verifyToken, createRole);
router.put("/:id", verifyToken, updateRole);

module.exports = router;