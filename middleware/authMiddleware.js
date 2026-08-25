const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { db } = require("../config/firebase");

const userStatusCache = new Map();
const USER_STATUS_TTL_MS = 5 * 60 * 1000; 

async function isUserActive(userId) {
  const cached = userStatusCache.get(userId);
  if (cached && (Date.now() - cached.cachedAt < USER_STATUS_TTL_MS)) {
    return cached.isActive;
  }
  try {
    const doc = await db.collection("users").doc(userId).get();
    const isActive = doc.exists ? (doc.data().isActive !== false) : false;
    userStatusCache.set(userId, { isActive, cachedAt: Date.now() });
    return isActive;
  } catch (e) {
    return true;
  }
}

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new ApiError(401, "No token provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Invalid format");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const active = await isUserActive(decoded.id || decoded.uid);
    if (!active) {
      throw new ApiError(403, "Account has been deactivated. Please contact your administrator.");
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, "Invalid token"));
  }
};

module.exports = verifyToken;
