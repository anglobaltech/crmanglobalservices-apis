const { db } = require("../config/firebase");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { uploadBase64File } = require("../utils/storageHelper");

async function getNextId(counterDoc, prefix) {
  const ref = db.collection("counters").doc(counterDoc);
  return await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const next = snap.exists ? (snap.data().count || 0) + 1 : 1;
    t.set(ref, { count: next }, { merge: true });
    return `${prefix}${String(next).padStart(4, "0")}`;
  });
}

exports.createGateEntry = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    // Checklist
    invoiceDocNumber,
    invoiceDocPresent,
    ewayBillNumber,
    ewayBillPresent,
    companyInvoiceDetails,
    ewayBillDetails,
    vehicleNumber,
    invoiceMatchesEway,
    vehicleNumberMatch,
    fssaiLicenseApplicable,
    fssaiFssaiNumber,
    fssaiParty,
    itemBatchNumber,
    coaAvailable,
    coaDetails,
    coaFile,
    productName,
    packagingDetails,
    importedBy,
    productMatchesInvoice,
    productMatchesEway,
    gstNumberSeller,
    gstNumberBuyer,
    transporterReceiptMatch,
    // Transport details
    transporterName,
    transporterGst,
    driverName,
    driverPhone,
    driverPhoto,
    gateOpeningVideo,
    productVideo,
    productPhoto,
    // Meta
    remarks,
    entryDate,
  } = req.body;

  const gateEntryId = await getNextId("gateEntryCounter", "GE");
  const folder = `stockmanagement/gateentry/${gateEntryId}`;

  // Upload files to Firebase Storage
  const [
    uploadedCoaFile,
    uploadedDriverPhoto,
    uploadedGateVideo,
    uploadedProductVideo,
    uploadedProductPhoto,
  ] = await Promise.all([
    uploadBase64File(coaFile, folder, "coaFile"),
    uploadBase64File(driverPhoto, folder, "driverPhoto"),
    uploadBase64File(gateOpeningVideo, folder, "gateOpeningVideo"),
    uploadBase64File(productVideo, folder, "productVideo"),
    uploadBase64File(productPhoto, folder, "productPhoto"),
  ]);

  const data = {
    gateEntryId,
    // Checklist fields
    invoiceDocNumber: invoiceDocNumber || null,
    invoiceDocPresent: invoiceDocPresent ?? null,
    ewayBillNumber: ewayBillNumber || null,
    ewayBillPresent: ewayBillPresent ?? null,
    companyInvoiceDetails: companyInvoiceDetails || null,
    ewayBillDetails: ewayBillDetails || null,
    vehicleNumber: vehicleNumber || null,
    invoiceMatchesEway: invoiceMatchesEway ?? null,
    vehicleNumberMatch: vehicleNumberMatch ?? null,
    fssaiLicenseApplicable: fssaiLicenseApplicable ?? null,
    fssaiFssaiNumber: fssaiFssaiNumber || null,
    fssaiParty: fssaiParty || null,
    itemBatchNumber: itemBatchNumber || null,
    coaAvailable: coaAvailable ?? null,
    coaDetails: coaDetails || null,
    coaFile: uploadedCoaFile || null,
    productName: productName || null,
    packagingDetails: packagingDetails || null,
    importedBy: importedBy || null,
    productMatchesInvoice: productMatchesInvoice ?? null,
    productMatchesEway: productMatchesEway ?? null,
    gstNumberSeller: gstNumberSeller || null,
    gstNumberBuyer: gstNumberBuyer || null,
    transporterReceiptMatch: transporterReceiptMatch ?? null,
    // Transport
    transporterName: transporterName || null,
    transporterGst: transporterGst || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
    driverPhoto: uploadedDriverPhoto || null,
    gateOpeningVideo: uploadedGateVideo || null,
    productVideo: uploadedProductVideo || null,
    productPhoto: uploadedProductPhoto || null,
    // Meta
    remarks: remarks || null,
    entryDate: entryDate || new Date().toISOString().split("T")[0],
    status: "open",
    createdBy: user.id || user.uid || "unknown",
    createdByName: user.name || user.email || "System",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("stockGateEntries").doc(gateEntryId).set(data);
  res.status(201).json({ id: gateEntryId, ...data });
});

exports.getGateEntries = asyncHandler(async (req, res) => {
  const { status, search, limit = 50, page = 1 } = req.query;
  const lim = parseInt(limit);
  const pg = parseInt(page);
  const start = (pg - 1) * lim;

  let baseQuery = db.collection("stockGateEntries");
  if (status && status !== "all") {
    baseQuery = baseQuery.where("status", "==", status);
  }

  if (!search) {
    // Fast path: use direct database pagination
    const [totalSnap, snap] = await Promise.all([
      baseQuery.count().get(),
      baseQuery.orderBy("createdAt", "desc").offset(start).limit(lim).get()
    ]);
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ entries, total: totalSnap.data().count, page: pg, limit: lim });
  }

  // Slow path: in-memory search
  const snap = await baseQuery.orderBy("createdAt", "desc").get();
  let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const q = search.toLowerCase();
  entries = entries.filter(
    (e) =>
      (e.gateEntryId || "").toLowerCase().includes(q) ||
      (e.productName || "").toLowerCase().includes(q) ||
      (e.transporterName || "").toLowerCase().includes(q) ||
      (e.vehicleNumber || "").toLowerCase().includes(q)
  );

  res.json({ entries: entries.slice(start, start + lim), total: entries.length, page: pg, limit: lim });
});

exports.getGateEntryById = asyncHandler(async (req, res) => {
  const doc = await db.collection("stockGateEntries").doc(req.params.id).get();
  if (!doc.exists) throw new ApiError(404, "Gate entry not found");
  res.json({ id: doc.id, ...doc.data() });
});

exports.updateGateEntry = asyncHandler(async (req, res) => {
  const ref = db.collection("stockGateEntries").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Gate entry not found");
  await ref.update({ ...req.body, updatedAt: new Date() });
  res.json({ message: "Gate entry updated" });
});

// ─── STOCK ENTRY ──────────────────────────────────────────────────────────────

exports.createStockEntry = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    invoiceNumber,
    billFrom,
    billTo,
    totalBilledQty,
    approvedQty,
    rejectedQty,
    rejectionReason,
    rejectedItemPhoto,
    rejectedItemVideo,
    witnessName,
    witnessPhone,
    otherPartyName,
    otherPartyPhone,
    otherPartyRole,
    gateEntryRef,
    productName,
    entryDate,
    remarks,
  } = req.body;

  const stockEntryId = await getNextId("stockEntryCounter", "SE");
  const folder = `stockmanagement/stockentry/${stockEntryId}`;

  const [uploadedRejectedPhoto, uploadedRejectedVideo] = await Promise.all([
    uploadBase64File(rejectedItemPhoto, folder, "rejectedItemPhoto"),
    uploadBase64File(rejectedItemVideo, folder, "rejectedItemVideo"),
  ]);

  const data = {
    stockEntryId,
    invoiceNumber: invoiceNumber || null,
    billFrom: billFrom || null,
    billTo: billTo || null,
    totalBilledQty: totalBilledQty ? Number(totalBilledQty) : null,
    approvedQty: approvedQty ? Number(approvedQty) : null,
    rejectedQty: rejectedQty ? Number(rejectedQty) : 0,
    rejectionReason: rejectionReason || null,
    rejectedItemPhoto: uploadedRejectedPhoto || null,
    rejectedItemVideo: uploadedRejectedVideo || null,
    witnessName: witnessName || null,
    witnessPhone: witnessPhone || null,
    otherPartyName: otherPartyName || null,
    otherPartyPhone: otherPartyPhone || null,
    otherPartyRole: otherPartyRole || null,
    gateEntryRef: gateEntryRef || null,
    productName: productName || null,
    entryDate: entryDate || new Date().toISOString().split("T")[0],
    remarks: remarks || null,
    createdBy: user.id || user.uid || "unknown",
    createdByName: user.name || user.email || "System",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("stockEntries").doc(stockEntryId).set(data);
  res.status(201).json({ id: stockEntryId, ...data });
});

exports.getStockEntries = asyncHandler(async (req, res) => {
  const { search, limit = 50, page = 1 } = req.query;
  const lim = parseInt(limit);
  const pg = parseInt(page);
  const start = (pg - 1) * lim;

  let baseQuery = db.collection("stockEntries");

  if (!search) {
    const [totalSnap, snap] = await Promise.all([
      baseQuery.count().get(),
      baseQuery.orderBy("createdAt", "desc").offset(start).limit(lim).get()
    ]);
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ entries, total: totalSnap.data().count, page: pg, limit: lim });
  }

  const snap = await baseQuery.orderBy("createdAt", "desc").get();
  let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const q = search.toLowerCase();
  entries = entries.filter(
    (e) =>
      (e.stockEntryId || "").toLowerCase().includes(q) ||
      (e.productName || "").toLowerCase().includes(q) ||
      (e.invoiceNumber || "").toLowerCase().includes(q) ||
      (e.billFrom || "").toLowerCase().includes(q)
  );

  res.json({ entries: entries.slice(start, start + lim), total: entries.length, page: pg, limit: lim });
});

exports.getStockEntryById = asyncHandler(async (req, res) => {
  const doc = await db.collection("stockEntries").doc(req.params.id).get();
  if (!doc.exists) throw new ApiError(404, "Stock entry not found");
  res.json({ id: doc.id, ...doc.data() });
});

// ─── STOCK EXIT ───────────────────────────────────────────────────────────────

exports.createStockExit = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    productName,
    qtyDispatched,
    destination,
    buyerName,
    buyerPhone,
    buyerGst,
    transporterName,
    vehicleNumber,
    driverName,
    driverPhone,
    stockEntryRef,
    gateEntryRef,
    exitDate,
    remarks,
    exitPhoto,
    exitVideo,
  } = req.body;

  const stockExitId = await getNextId("stockExitCounter", "SX");
  const folder = `stockmanagement/stockexit/${stockExitId}`;

  const [uploadedExitPhoto, uploadedExitVideo] = await Promise.all([
    uploadBase64File(exitPhoto, folder, "exitPhoto"),
    uploadBase64File(exitVideo, folder, "exitVideo"),
  ]);

  const data = {
    stockExitId,
    productName: productName || null,
    qtyDispatched: qtyDispatched ? Number(qtyDispatched) : null,
    destination: destination || null,
    buyerName: buyerName || null,
    buyerPhone: buyerPhone || null,
    buyerGst: buyerGst || null,
    transporterName: transporterName || null,
    vehicleNumber: vehicleNumber || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
    stockEntryRef: stockEntryRef || null,
    gateEntryRef: gateEntryRef || null,
    exitDate: exitDate || new Date().toISOString().split("T")[0],
    remarks: remarks || null,
    exitPhoto: uploadedExitPhoto || null,
    exitVideo: uploadedExitVideo || null,
    createdBy: user.id || user.uid || "unknown",
    createdByName: user.name || user.email || "System",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("stockExits").doc(stockExitId).set(data);
  res.status(201).json({ id: stockExitId, ...data });
});

exports.getStockExits = asyncHandler(async (req, res) => {
  const { search, limit = 50, page = 1 } = req.query;
  const lim = parseInt(limit);
  const pg = parseInt(page);
  const start = (pg - 1) * lim;

  let baseQuery = db.collection("stockExits");

  if (!search) {
    const [totalSnap, snap] = await Promise.all([
      baseQuery.count().get(),
      baseQuery.orderBy("createdAt", "desc").offset(start).limit(lim).get()
    ]);
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ entries, total: totalSnap.data().count, page: pg, limit: lim });
  }

  const snap = await baseQuery.orderBy("createdAt", "desc").get();
  let entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const q = search.toLowerCase();
  entries = entries.filter(
    (e) =>
      (e.stockExitId || "").toLowerCase().includes(q) ||
      (e.productName || "").toLowerCase().includes(q) ||
      (e.buyerName || "").toLowerCase().includes(q) ||
      (e.vehicleNumber || "").toLowerCase().includes(q)
  );

  res.json({ entries: entries.slice(start, start + lim), total: entries.length, page: pg, limit: lim });
});

exports.getStockExitById = asyncHandler(async (req, res) => {
  const doc = await db.collection("stockExits").doc(req.params.id).get();
  if (!doc.exists) throw new ApiError(404, "Stock exit not found");
  res.json({ id: doc.id, ...doc.data() });
});

// ─── STATS ────────────────────────────────────────────────────────────────────

exports.getStockStats = asyncHandler(async (req, res) => {
  const [geSnap, seSnap, sxSnap] = await Promise.all([
    db.collection("stockGateEntries").count().get(),
    db.collection("stockEntries").select("approvedQty", "rejectedQty").get(),
    db.collection("stockExits").count().get(),
  ]);

  const stockEntries = seSnap.docs.map((d) => d.data());
  const totalApproved = stockEntries.reduce(
    (s, e) => s + (e.approvedQty || 0),
    0
  );
  const totalRejected = stockEntries.reduce(
    (s, e) => s + (e.rejectedQty || 0),
    0
  );

  res.json({
    totalGateEntries: geSnap.data().count,
    totalStockEntries: seSnap.size,
    totalStockExits: sxSnap.data().count,
    totalApprovedQty: totalApproved,
    totalRejectedQty: totalRejected,
  });
  });

// ─── BULK DELETE ───────────────────────────────────────────────────────────────

const bulkDeleteDocs = async (collectionName, ids) => {
  if (!ids || !ids.length) return;
  const chunkSize = 400;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach(id => {
      const ref = db.collection(collectionName).doc(id);
      batch.delete(ref);
    });
    await batch.commit();
  }
};

exports.bulkDeleteGateEntries = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");
  await bulkDeleteDocs("stockGateEntries", ids);
  res.json({ message: `${ids.length} gate entries deleted successfully` });
});

exports.bulkDeleteStockEntries = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");
  await bulkDeleteDocs("stockEntries", ids);
  res.json({ message: `${ids.length} stock entries deleted successfully` });
});

exports.bulkDeleteStockExits = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");
  await bulkDeleteDocs("stockExits", ids);
  res.json({ message: `${ids.length} stock exits deleted successfully` });
});
