const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const { db } = require("../config/firebase");

const userStatusCache = new Map();
const USER_STATUS_TTL_MS = 5 * 60 * 1000; 

async function getUserData(userId) {
  const cached = userStatusCache.get(userId);
  if (cached && (Date.now() - cached.cachedAt < USER_STATUS_TTL_MS)) {
    return cached;
  }
  try {
    const doc = await db.collection("users").doc(userId).get();
    if (!doc.exists) {
      const data = { isActive: false, permissions: {} };
      userStatusCache.set(userId, { ...data, cachedAt: Date.now() });
      return data;
    }
    const userData = doc.data();
    const data = { 
      isActive: userData.isActive !== false,
      permissions: userData.permissions || {},
      roleName: userData.roleName || null,
      department: userData.department || null
    };
    userStatusCache.set(userId, { ...data, cachedAt: Date.now() });
    return data;
  } catch (e) {
    return { isActive: true, permissions: null }; // Fallback to token permissions on DB error
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

    const activeData = await getUserData(decoded.id || decoded.uid);
    if (!activeData.isActive) {
      throw new ApiError(403, "Account has been deactivated. Please contact your administrator.");
    }

    req.user = decoded;
    if (activeData.permissions) {
      req.user.permissions = activeData.permissions;
    }
    if (activeData.roleName) req.user.roleName = activeData.roleName;
    if (activeData.department) req.user.department = activeData.department;
    
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, "Invalid token"));
  }
};

module.exports = verifyToken;
