const express = require("express");
const router = express.Router();

const { registerUser, loginUser } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: "Admin access required" });
  }
  const role = (req.user.roleName || "").toLowerCase();
  const dept = (req.user.department || "").toLowerCase();
  
  if (role === "admin" || role === "super admin" || role === "manager" || dept === "management") {
    return next();
  }
  return res.status(403).json({ message: "Admin or Manager access required" });
};

const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per window
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes." }
});

router.post("/register", verifyToken, requireAdmin, registerUser);
router.post("/login", loginLimiter, loginUser);

module.exports = router;