const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // console.log("AUTH HEADER:", authHeader);
    // console.log("AUTH HEADER:", req.headers.authorization);

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Invalid format" });
    }

    const token = authHeader.split(" ")[1];

    // console.log("TOKEN RECEIVED:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (err) {
    console.error("JWT ERROR:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = verifyToken;
