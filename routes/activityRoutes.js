const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/activityController");
const verifyToken = require("../middleware/authMiddleware");

router.use(verifyToken);

router.get("/stats",     ctrl.getActivityStats);
router.get("/followups", ctrl.getTodayFollowups);
router.get("/",          ctrl.getActivity);

module.exports = router;