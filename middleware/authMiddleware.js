const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

const verifyToken = (req, res, next) => {
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
    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, "Invalid token"));
  }
};

module.exports = verifyToken;
