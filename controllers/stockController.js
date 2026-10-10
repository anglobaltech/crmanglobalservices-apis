const { db, bucket } = require("../config/firebase");
const { AggregateField } = require("firebase-admin/firestore");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { uploadBase64File } = require("../utils/storageHelper");

const isManagerUser = (user) => {
  if (!user) return false;
  const role = (user.roleName || "").toLowerCase();
  return role === "super admin" || role === "admin" || role === "director" || role === "founder & ceo" || role.includes("manager") || user.department === "management" || user.permissions?.stock === true;
};

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
    quantityKg,
    importedBy,
    productMatchesInvoice,
    productMatchesEway,
    gstNumberSeller,
    gstNumberBuyer,
    transporterReceiptMatch,
    transporterName,
    transporterGst,
    driverName,
    driverPhone,
    driverPhoto,
    gateOpeningVideo,
    productVideo,
    productPhoto,
    remarks,
    entryDate,
  } = req.body;

  const gateEntryId = await getNextId("gateEntryCounter", "GE");
  const folder = `stockmanagement/gateentry/${gateEntryId}`;

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
    productName: productName ? String(productName).trim().toUpperCase() : null,
    packagingDetails: packagingDetails || null,
    quantityKg: quantityKg != null ? Number(quantityKg) : null,
    importedBy: importedBy || null,
    productMatchesInvoice: productMatchesInvoice ?? null,
    productMatchesEway: productMatchesEway ?? null,
    gstNumberSeller: gstNumberSeller || null,
    gstNumberBuyer: gstNumberBuyer || null,
    transporterReceiptMatch: transporterReceiptMatch ?? null,
    transporterName: transporterName || null,
    transporterGst: transporterGst || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
    driverPhoto: uploadedDriverPhoto || null,
    gateOpeningVideo: uploadedGateVideo || null,
    productVideo: uploadedProductVideo || null,
    productPhoto: uploadedProductPhoto || null,
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

  const folder = `stockmanagement/gateentry/${doc.data().gateEntryId || req.params.id}`;
  const updates = { ...req.body, updatedAt: new Date() };
  if (updates.productName) updates.productName = String(updates.productName).trim().toUpperCase();

  if (updates.coaFile && String(updates.coaFile).startsWith("data:")) updates.coaFile = await uploadBase64File(updates.coaFile, folder, "coaFile");
  if (updates.driverPhoto && String(updates.driverPhoto).startsWith("data:")) updates.driverPhoto = await uploadBase64File(updates.driverPhoto, folder, "driverPhoto");
  if (updates.gateOpeningVideo && String(updates.gateOpeningVideo).startsWith("data:")) updates.gateOpeningVideo = await uploadBase64File(updates.gateOpeningVideo, folder, "gateOpeningVideo");
  if (updates.productVideo && String(updates.productVideo).startsWith("data:")) updates.productVideo = await uploadBase64File(updates.productVideo, folder, "productVideo");
  if (updates.productPhoto && String(updates.productPhoto).startsWith("data:")) updates.productPhoto = await uploadBase64File(updates.productPhoto, folder, "productPhoto");

  await ref.update(updates);
  res.json({ message: "Gate entry updated" });
});

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
    batchNumber,
    entryDate,
    remarks,
    amountPerKg,
    productAmount,
    gstAmount,
    expenseAmount,
    expenseReason,
    totalAmountWithGst,
    tdsApplicable,
    tdsAmount,
    productAmountAfterTds,
  } = req.body;

  if (!productName || !String(productName).trim()) {
    throw new ApiError(400, "Product name is required.");
  }
  if (!totalBilledQty && !approvedQty) {
    throw new ApiError(400, "At least one of Total Billed Qty or Approved Qty is required.");
  }
  const parsedTotal    = totalBilledQty ? Number(totalBilledQty) : null;
  const parsedApproved = approvedQty    ? Number(approvedQty)    : null;
  const parsedRejected = rejectedQty    ? Number(rejectedQty)    : 0;
  if (parsedTotal    !== null && (isNaN(parsedTotal)    || parsedTotal    < 0)) throw new ApiError(400, "Total Billed Qty must be a positive number.");
  if (parsedApproved !== null && (isNaN(parsedApproved) || parsedApproved < 0)) throw new ApiError(400, "Approved Qty must be a positive number.");
  if (isNaN(parsedRejected) || parsedRejected < 0) throw new ApiError(400, "Rejected Qty must be a positive number.");
  
  if (parsedTotal !== null && parsedApproved !== null) {
    if ((parsedApproved + parsedRejected) > parsedTotal) {
      throw new ApiError(400, `Approved (${parsedApproved}) + Rejected (${parsedRejected}) cannot exceed Total Billed Qty (${parsedTotal}).`);
    }
  }

  const stockEntryId = await getNextId("stockEntryCounter", "SE");
  const folder = `stockmanagement/stockentry/${stockEntryId}`;

  const [uploadedRejectedPhoto, uploadedRejectedVideo] = await Promise.all([
    uploadBase64File(rejectedItemPhoto, folder, "rejectedItemPhoto"),
    uploadBase64File(rejectedItemVideo, folder, "rejectedItemVideo"),
  ]);

  const data = {
    stockEntryId,
    currency: req.body.currency || "INR",
    invoiceNumber: invoiceNumber || null,
    billFrom: billFrom || null,
    billTo: billTo || null,
    totalBilledQty: parsedTotal,
    approvedQty: parsedApproved,
    rejectedQty: parsedRejected,
    rejectionReason: rejectionReason || null,
    rejectedItemPhoto: uploadedRejectedPhoto,
    rejectedItemVideo: uploadedRejectedVideo,
    witnessName: witnessName || null,
    witnessPhone: witnessPhone || null,
    otherPartyName: otherPartyName || null,
    otherPartyPhone: otherPartyPhone || null,
    otherPartyRole: otherPartyRole || null,
    gateEntryRef: gateEntryRef || null,
    productName: String(productName).trim().toUpperCase(),
    batchNumber: batchNumber || null,
    entryDate: entryDate || new Date().toISOString().split("T")[0],
    remarks: remarks || null,
    remarkHistory: [],
    amountPerKg: amountPerKg ? Number(amountPerKg) : null,
    productAmount: productAmount ? Number(productAmount) : null,
    gstAmount: gstAmount ? Number(gstAmount) : null,
    expenseAmount: expenseAmount ? Number(expenseAmount) : null,
    expenseReason: expenseReason || null,
    totalAmountWithGst: totalAmountWithGst ? Number(totalAmountWithGst) : null,
    tdsApplicable: tdsApplicable || false,
    tdsAmount: tdsAmount ? Number(tdsAmount) : null,
    productAmountAfterTds: productAmountAfterTds ? Number(productAmountAfterTds) : null,
    exchangeRate: req.body.exchangeRate ? Number(req.body.exchangeRate) : null,
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
      (e.batchNumber || "").toLowerCase().includes(q) ||
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

exports.updateStockEntry = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) {
    throw new ApiError(403, "Access denied. Managers only can edit entries.");
  }
  const ref = db.collection("stockEntries").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Stock entry not found");

  const folder = `stockmanagement/stockentry/${doc.data().stockEntryId || req.params.id}`;
  const updates = { ...req.body, updatedAt: new Date() };
  if (updates.productName) updates.productName = String(updates.productName).trim().toUpperCase();

  // Validate quantities if provided
  const existing = doc.data();
  const billed = updates.totalBilledQty !== undefined ? Number(updates.totalBilledQty) : Number(existing.totalBilledQty);
  const approved = updates.approvedQty !== undefined ? Number(updates.approvedQty) : Number(existing.approvedQty);
  const rejected = updates.rejectedQty !== undefined ? Number(updates.rejectedQty) : Number(existing.rejectedQty || 0);

  if (billed !== null && billed !== undefined && !isNaN(billed)) {
    if (approved + rejected > billed) {
      throw new ApiError(400, `Approved (${approved}) + Rejected (${rejected}) cannot exceed Total Billed Qty (${billed}).`);
    }
  }

  if (updates.rejectedItemPhoto && String(updates.rejectedItemPhoto).startsWith("data:")) updates.rejectedItemPhoto = await uploadBase64File(updates.rejectedItemPhoto, folder, "rejectedItemPhoto");
  if (updates.rejectedItemVideo && String(updates.rejectedItemVideo).startsWith("data:")) updates.rejectedItemVideo = await uploadBase64File(updates.rejectedItemVideo, folder, "rejectedItemVideo");

  // Prevent reducing approvedQty or changing productName if it causes negative stock for the OLD product
  const oldProductName = String(existing.productName || "").trim().toUpperCase();
  const newProductName = updates.productName || oldProductName;

  const oldApproved = Number(existing.approvedQty || 0);
  const newApproved = updates.approvedQty !== undefined ? Number(updates.approvedQty) : oldApproved;

  const isProductChanged = oldProductName !== newProductName;
  const isQtyDecreased = newApproved < oldApproved;

  if ((isProductChanged || isQtyDecreased) && oldProductName) {
    await db.runTransaction(async (t) => {
      const tEntriesSnap = await t.get(db.collection("stockEntries").where("productName", "==", oldProductName));
      const tExitsSnap = await t.get(db.collection("stockExits").where("productName", "==", oldProductName));
      
      const totalReceived = tEntriesSnap.docs.reduce((s, d) => {
        if (d.id === req.params.id) {
          return isProductChanged ? s : s + newApproved;
        }
        return s + (Number(d.data().approvedQty) || 0);
      }, 0);
      
      const totalExited = tExitsSnap.docs.reduce((s, d) => s + (Number(d.data().qtyDispatched) || 0), 0);
      
      if (totalReceived < totalExited) {
        if (isProductChanged) {
          throw new ApiError(400, `Cannot change product name. The old product "${existing.productName}" has ${totalExited} kg dispatched, but without this entry it would only have ${totalReceived} kg received.`);
        } else {
          const required = totalExited - (totalReceived - newApproved);
          throw new ApiError(400, `Race condition prevented: Cannot reduce approved quantity to ${newApproved}. Product "${existing.productName}" already has ${totalExited} kg dispatched.`);
        }
      }
      
      t.update(ref, updates);
    });
    return res.json({ message: "Stock entry updated" });
  }

  await ref.update(updates);
  res.json({ message: "Stock entry updated" });
});

exports.createStockExit = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    productName,
    batchNumber,
    packagingType,
    totalValue,
    qtyDispatched,
    destination,
    buyerName,
    buyerCompanyName,
    buyerFssaiNumber,
    buyerPhone,
    buyerGst,
    invoiceDocNumber,
    ewayBillApplicable,
    ewayBillNumber,
    transportMode,
    transporterName,
    vehicleNumber,
    driverName,
    driverPhone,
    driverId,
    stockEntryRef,
    gateEntryRef,
    exitDate,
    remarks,
    vehiclePhoto,
    itemPhoto,
    itemVideo,
    exitPhoto,
    exitVideo,
    amountPerKg,
    productAmount,
    gstAmount,
    expenseAmount,
    expenseReason,
    totalAmountWithGst,
    tdsApplicable,
    tdsAmount,
    productAmountAfterTds,
    exchangeRate,
  } = req.body;

  if (!productName || !String(productName).trim()) {
    throw new ApiError(400, "Product name is required.");
  }
  if (!qtyDispatched) {
    throw new ApiError(400, "Quantity Dispatched is required.");
  }
  const parsedQty   = Number(qtyDispatched);
  const parsedValue = totalValue ? Number(totalValue) : null;
  if (isNaN(parsedQty) || parsedQty <= 0)                           throw new ApiError(400, "Quantity Dispatched must be a positive number.");
  if (parsedValue !== null && (isNaN(parsedValue) || parsedValue < 0)) throw new ApiError(400, "Total Value must be a positive number.");

  // Validation: Prevent Negative Stock
  const normalizedProductName = String(productName).trim().toUpperCase();
  const entriesSnap = await db.collection("stockEntries").where("productName", "==", normalizedProductName).get();
  const exitsSnap = await db.collection("stockExits").where("productName", "==", normalizedProductName).get();
  const totalReceived = entriesSnap.docs.reduce((s, d) => s + (Number(d.data().approvedQty) || 0), 0);
  const totalExited = exitsSnap.docs.reduce((s, d) => s + (Number(d.data().qtyDispatched) || 0), 0);
  const availableQty = totalReceived - totalExited;
  
  if (parsedQty > availableQty) {
    throw new ApiError(400, `Insufficient stock. Only ${availableQty} kg of "${productName}" is available.`);
  }

  const stockExitId = await getNextId("stockExitCounter", "SX");
  const folder = `stockmanagement/stockexit/${stockExitId}`;

  const [
    uploadedVehiclePhoto, 
    uploadedItemPhoto, 
    uploadedItemVideo, 
    uploadedExitPhoto, 
    uploadedExitVideo
  ] = await Promise.all([
    uploadBase64File(vehiclePhoto, folder, "vehiclePhoto"),
    uploadBase64File(itemPhoto, folder, "itemPhoto"),
    uploadBase64File(itemVideo, folder, "itemVideo"),
    uploadBase64File(exitPhoto, folder, "exitPhoto"),
    uploadBase64File(exitVideo, folder, "exitVideo"),
  ]);

  const data = {
    stockExitId,
    currency: req.body.currency || "INR",
    exchangeRate: req.body.exchangeRate ? Number(req.body.exchangeRate) : null,
    productName: productName ? String(productName).trim().toUpperCase() : null,
    batchNumber: batchNumber || null,
    packagingType: packagingType || null,
    totalValue: parsedValue,
    qtyDispatched: parsedQty,
    destination: destination || null,
    buyerName: buyerName || null,
    buyerCompanyName: buyerCompanyName || null,
    buyerFssaiNumber: buyerFssaiNumber || null,
    buyerPhone: buyerPhone || null,
    buyerGst: buyerGst || null,
    invoiceDocNumber: invoiceDocNumber || null,
    ewayBillApplicable: ewayBillApplicable ?? null,
    ewayBillNumber: ewayBillNumber || null,
    transportMode: transportMode || null,
    transporterName: transporterName || null,
    vehicleNumber: vehicleNumber || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
    driverId: driverId || null,
    stockEntryRef: stockEntryRef || null,
    gateEntryRef: gateEntryRef || null,
    exitDate: exitDate || new Date().toISOString().split("T")[0],
    remarks: remarks || null,
    amountPerKg: amountPerKg ? Number(amountPerKg) : null,
    productAmount: productAmount ? Number(productAmount) : null,
    gstAmount: gstAmount ? Number(gstAmount) : null,
    expenseAmount: expenseAmount ? Number(expenseAmount) : null,
    expenseReason: expenseReason || null,
    totalAmountWithGst: totalAmountWithGst ? Number(totalAmountWithGst) : null,
    tdsApplicable: tdsApplicable || false,
    tdsAmount: tdsAmount ? Number(tdsAmount) : null,
    productAmountAfterTds: productAmountAfterTds ? Number(productAmountAfterTds) : null,
    vehiclePhoto: uploadedVehiclePhoto || null,
    itemPhoto: uploadedItemPhoto || null,
    itemVideo: uploadedItemVideo || null,
    exitPhoto: uploadedExitPhoto || null,
    exitVideo: uploadedExitVideo || null,
    createdBy: user.id || user.uid || "unknown",
    createdByName: user.name || user.email || "System",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Strict Validation & Write inside Transaction to prevent concurrency race conditions
  await db.runTransaction(async (t) => {
    const tEntriesSnap = await t.get(db.collection("stockEntries").where("productName", "==", normalizedProductName));
    const tExitsSnap = await t.get(db.collection("stockExits").where("productName", "==", normalizedProductName));
    
    const tTotalReceived = tEntriesSnap.docs.reduce((s, d) => s + (Number(d.data().approvedQty) || 0), 0);
    const tTotalExited = tExitsSnap.docs.reduce((s, d) => s + (Number(d.data().qtyDispatched) || 0), 0);
    const tAvailableQty = tTotalReceived - tTotalExited;
    
    if (parsedQty > tAvailableQty) {
      throw new ApiError(400, `Race condition prevented: Insufficient stock. Only ${tAvailableQty} kg of "${productName}" is available.`);
    }

    t.set(db.collection("stockExits").doc(stockExitId), data);
  });
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

exports.updateStockExit = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) {
    throw new ApiError(403, "Access denied. Managers only can edit exits.");
  }
  const ref = db.collection("stockExits").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError(404, "Stock exit not found");

  const folder = `stockmanagement/stockexit/${doc.data().stockExitId || req.params.id}`;
  const updates = { ...req.body, updatedAt: new Date() };
  if (updates.productName) updates.productName = String(updates.productName).trim().toUpperCase();

  if (updates.vehiclePhoto && String(updates.vehiclePhoto).startsWith("data:")) updates.vehiclePhoto = await uploadBase64File(updates.vehiclePhoto, folder, "vehiclePhoto");
  if (updates.itemPhoto && String(updates.itemPhoto).startsWith("data:")) updates.itemPhoto = await uploadBase64File(updates.itemPhoto, folder, "itemPhoto");
  if (updates.itemVideo && String(updates.itemVideo).startsWith("data:")) updates.itemVideo = await uploadBase64File(updates.itemVideo, folder, "itemVideo");
  if (updates.exitPhoto && String(updates.exitPhoto).startsWith("data:")) updates.exitPhoto = await uploadBase64File(updates.exitPhoto, folder, "exitPhoto");
  if (updates.exitVideo && String(updates.exitVideo).startsWith("data:")) updates.exitVideo = await uploadBase64File(updates.exitVideo, folder, "exitVideo");

  // Strict Validation & Write inside Transaction to prevent Negative Stock on Update
  if (updates.qtyDispatched) {
    const newQty = Number(updates.qtyDispatched);
    const productName = updates.productName || doc.data().productName;
    const normalizedProductName = productName ? String(productName).trim().toUpperCase() : null;
    
    await db.runTransaction(async (t) => {
      const tEntriesSnap = await t.get(db.collection("stockEntries").where("productName", "==", normalizedProductName));
      const tExitsSnap = await t.get(db.collection("stockExits").where("productName", "==", normalizedProductName));
      
      const tTotalReceived = tEntriesSnap.docs.reduce((s, d) => s + (Number(d.data().approvedQty) || 0), 0);
      const tTotalExited = tExitsSnap.docs.reduce((s, d) => {
        if (d.id === req.params.id) return s; // skip current
        return s + (Number(d.data().qtyDispatched) || 0);
      }, 0);
      
      const tAvailableQty = tTotalReceived - tTotalExited;
      if (newQty > tAvailableQty) {
        throw new ApiError(400, `Race condition prevented: Insufficient stock. Only ${tAvailableQty} kg of "${productName}" is available.`);
      }
      
      t.update(ref, updates);
    });
  } else {
    await ref.update(updates);
  }

  res.json({ message: "Stock exit updated" });
});

exports.getStockStats = asyncHandler(async (req, res) => {
  const [geCount, seCount, sxCount, seSum] = await Promise.all([
    db.collection("stockGateEntries").count().get(),
    db.collection("stockEntries").count().get(),
    db.collection("stockExits").count().get(),
    db.collection("stockEntries").aggregate({
      totalApproved: AggregateField.sum("approvedQty"),
      totalRejected: AggregateField.sum("rejectedQty"),
    }).get(),
  ]);

  res.json({
    totalGateEntries: geCount.data().count,
    totalStockEntries: seCount.data().count,
    totalStockExits: sxCount.data().count,
    totalApprovedQty: seSum.data().totalApproved || 0,
    totalRejectedQty: seSum.data().totalRejected || 0,
  });
});

const deleteStorageFolder = async (folderPath) => {
  try {
    await bucket.deleteFiles({ prefix: folderPath });
  } catch (err) {
    console.error("Error deleting storage folder", folderPath, err);
  }
};

const bulkDeleteDocs = async (collectionName, ids, idField, prefixFolder) => {
  if (!ids || !ids.length) return;
  const chunkSize = 400;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batch = db.batch();
    
    // Fetch documents to retrieve their custom IDs for storage deletion
    const refs = chunk.map(id => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    
    for (const snap of snaps) {
      if (snap.exists) {
        batch.delete(snap.ref);
        const data = snap.data();
        const customId = data[idField] || snap.id;
        const folder = `stockmanagement/${prefixFolder}/${customId}`;
        await deleteStorageFolder(folder);
      }
    }
    
    await batch.commit();
  }
};

exports.bulkDeleteGateEntries = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) {
    throw new ApiError(403, "Access denied. Managers only.");
  }
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");
  await bulkDeleteDocs("stockGateEntries", ids, "gateEntryId", "gateentry");
  res.json({ message: `${ids.length} gate entries deleted successfully` });
});

exports.bulkDeleteStockEntries = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) {
    throw new ApiError(403, "Access denied. Managers only.");
  }
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");

  // Validate that deletion won't cause negative stock
  const refs = ids.map(id => db.collection("stockEntries").doc(id));
  const snaps = await db.getAll(...refs);
  
  const productReductions = {};
  snaps.forEach(snap => {
    if (snap.exists) {
      const data = snap.data();
      if (data.productName && data.approvedQty) {
        const p = String(data.productName).trim().toUpperCase();
        productReductions[p] = (productReductions[p] || 0) + Number(data.approvedQty);
      }
    }
  });
  
  for (const [prod, reduction] of Object.entries(productReductions)) {
    const [entSnap, exSnap] = await Promise.all([
      db.collection("stockEntries").where("productName", "==", prod).get(),
      db.collection("stockExits").where("productName", "==", prod).get(),
    ]);
    const totalReceived = entSnap.docs.reduce((s, d) => s + (Number(d.data().approvedQty) || 0), 0);
    const totalExited = exSnap.docs.reduce((s, d) => s + (Number(d.data().qtyDispatched) || 0), 0);
    if ((totalReceived - reduction) < totalExited) {
      throw new ApiError(400, `Cannot delete these entries. Deleting them removes ${reduction} kg of "${prod}", but ${totalExited} kg is already dispatched (only ${totalReceived} kg total received).`);
    }
  }

  await bulkDeleteDocs("stockEntries", ids, "stockEntryId", "stockentry");
  res.json({ message: `${ids.length} stock entries deleted successfully` });
});

exports.bulkDeleteStockExits = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) {
    throw new ApiError(403, "Access denied. Managers only.");
  }
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw new ApiError(400, "Invalid IDs array");
  await bulkDeleteDocs("stockExits", ids, "stockExitId", "stockexit");
  res.json({ message: `${ids.length} stock exits deleted successfully` });
});

exports.getStockSummary = asyncHandler(async (req, res) => {
  // Fetch all entries and exits to calculate accurate stock summaries
  const [entriesSnap, exitsSnap] = await Promise.all([
    db.collection("stockEntries").get(),
    db.collection("stockExits").get()
  ]);

  const summary = {};

  entriesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.productName) return;
    const prod = String(data.productName).trim().toUpperCase();
    if (!summary[prod]) summary[prod] = { received: 0, exited: 0, purchaseValue: 0, purchaseValueInr: 0, purchaseExpense: 0, salesValue: 0, salesValueInr: 0, salesExpense: 0, entryCount: 0, exitCount: 0 };
    summary[prod].received += (Number(data.approvedQty) || 0);
    summary[prod].purchaseValue += (Number(data.totalAmountWithGst) || 0);
    const rate = Number(data.exchangeRate) || (data.currency === 'USD' ? 0 : 1);
    summary[prod].purchaseValueInr += ((Number(data.totalAmountWithGst) || 0) * rate);
    summary[prod].purchaseExpense += (Number(data.expenseAmount) || 0);
    summary[prod].entryCount += 1;
  });

  exitsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.productName) return;
    const prod = String(data.productName).trim().toUpperCase();
    if (!summary[prod]) summary[prod] = { received: 0, exited: 0, purchaseValue: 0, purchaseValueInr: 0, purchaseExpense: 0, salesValue: 0, salesValueInr: 0, salesExpense: 0, entryCount: 0, exitCount: 0 };
    summary[prod].exited += (Number(data.qtyDispatched) || 0);
    summary[prod].salesValue += (Number(data.totalAmountWithGst) || 0);
    const rate = Number(data.exchangeRate) || (data.currency === 'USD' ? 0 : 1);
    summary[prod].salesValueInr += ((Number(data.totalAmountWithGst) || 0) * rate);
    summary[prod].salesExpense += (Number(data.expenseAmount) || 0);
    summary[prod].exitCount += 1;
  });

  // Fix floating point precision issues (e.g. 0.1 + 0.2 = 0.30000000000000004) and round monetary values to integers
  Object.keys(summary).forEach(prod => {
    const s = summary[prod];
    s.received = Math.round(s.received * 100) / 100;
    s.exited = Math.round(s.exited * 100) / 100;
    s.purchaseValue = Math.round(s.purchaseValue);
    s.purchaseValueInr = Math.round(s.purchaseValueInr || 0);
    s.purchaseExpense = Math.round(s.purchaseExpense);
    s.salesValue = Math.round(s.salesValue);
    s.salesValueInr = Math.round(s.salesValueInr || 0);
    s.salesExpense = Math.round(s.salesExpense);
  });

  res.json({ summary });
});

exports.getUnreadRemarks = asyncHandler(async (req, res) => {
  const [geSnap, seSnap, sxSnap] = await Promise.all([
    db.collection("stockGateEntries").where("hasUnreadRemark", "==", true).get(),
    db.collection("stockEntries").where("hasUnreadRemark", "==", true).get(),
    db.collection("stockExits").where("hasUnreadRemark", "==", true).get(),
  ]);

  const mapData = (snap, type, idField) => snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type,
      displayId: data[idField] || d.id,
      productName: data.productName || "Unknown Product",
      date: data.updatedAt || data.createdAt,
      remarkHistory: data.remarkHistory
    };
  });

  const unread = [
    ...mapData(geSnap, "gate", "gateEntryId"),
    ...mapData(seSnap, "entry", "stockEntryId"),
    ...mapData(sxSnap, "exit", "stockExitId"),
  ].sort((a, b) => {
    const timeA = a.date && a.date.toDate ? a.date.toDate().getTime() : 0;
    const timeB = b.date && b.date.toDate ? b.date.toDate().getTime() : 0;
    return timeB - timeA;
  });

  res.json({ unread });
});
