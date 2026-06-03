const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);

router.get("/my-leads", salesController.getMyLeads);
router.patch("/leads/:id/status", salesController.updateLeadStatus);
router.get("/team-leads", salesController.getTeamLeads);

module.exports = router;