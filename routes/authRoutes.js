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

const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per window
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes." }
});

router.post("/register", verifyToken, requireAdmin, registerUser);
router.post("/login", loginLimiter, loginUser);

module.exports = router;