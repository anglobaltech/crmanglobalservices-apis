const express = require("express");
const { uploadFile } = require("../controllers/uploadController");
const verifyToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, uploadFile);

module.exports = router;
