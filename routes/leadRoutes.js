const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);


router.get("/stats", leadController.getStats);
router.post("/import", leadController.importLeads);
router.patch("/bulk-assign", leadController.bulkAssign);
router.get("/", leadController.getLeads);
router.post("/", leadController.createLead);
router.put("/:id", leadController.updateLead);
router.patch("/:id/assign", leadController.assignLead);
router.delete("/:id", leadController.deleteLead);

module.exports = router;