const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const {
  createGateEntry,
  getGateEntries,
  getGateEntryById,
  updateGateEntry,
  createStockEntry,
  getStockEntries,
  getStockEntryById,
  updateStockEntry,
  createStockExit,
  getStockExits,
  getStockExitById,
  updateStockExit,
  getStockStats,
  bulkDeleteGateEntries,
  bulkDeleteStockEntries,
  bulkDeleteStockExits,
} = require("../controllers/stockController");

router.get("/stats", verifyToken, getStockStats);

router.post("/gate-entries/bulk-delete", verifyToken, bulkDeleteGateEntries);
router.get("/gate-entries", verifyToken, getGateEntries);
router.post("/gate-entries", verifyToken, createGateEntry);
router.get("/gate-entries/:id", verifyToken, getGateEntryById);
router.patch("/gate-entries/:id", verifyToken, updateGateEntry);

router.post("/entries/bulk-delete", verifyToken, bulkDeleteStockEntries);
router.get("/entries", verifyToken, getStockEntries);
router.post("/entries", verifyToken, createStockEntry);
router.get("/entries/:id", verifyToken, getStockEntryById);
router.patch("/entries/:id", verifyToken, updateStockEntry);

router.post("/exits/bulk-delete", verifyToken, bulkDeleteStockExits);
router.get("/exits", verifyToken, getStockExits);
router.post("/exits", verifyToken, createStockExit);
router.get("/exits/:id", verifyToken, getStockExitById);
router.patch("/exits/:id", verifyToken, updateStockExit);

module.exports = router;
