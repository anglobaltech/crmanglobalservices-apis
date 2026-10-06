const express = require("express");
const router = express.Router();

const { registerUser, loginUser } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.roleName !== "admin" && req.user.roleName !== "Super Admin")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

router.post("/register", verifyToken, requireAdmin, registerUser);
router.post("/login", loginUser);

module.exports = router;