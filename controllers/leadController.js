// const { db } = require("../config/firebase");
// const { Timestamp } = require("firebase-admin/firestore");

// const normalizePhone = (phone) => {
//   if (!phone) return "";

//   return String(phone).replace(/\D/g, "").replace(/^91/, "").replace(/^0+/, "");
// };

// const getNextLeadId = async () => {
//   const ref = db.collection("counters").doc("leads");

//   return await db.runTransaction(async (t) => {
//     const doc = await t.get(ref);

//     let next = 1;

//     if (doc.exists) {
//       next = (doc.data().last || 0) + 1;
//     }

//     t.set(ref, { last: next }, { merge: true });

//     return "ANG" + String(next).padStart(5, "0");
//   });
// };

// // GET /api/leads
// exports.getLeads = async (req, res) => {
//   try {
//     const {
//       status,
//       source,
//       city,
//       state,
//       productInterest,
//       assignedTo,
//       search,
//       page = 1,
//       limit = 20,
//     } = req.query;

//     let query = db.collection("leads");

//     if (status) query = query.where("status", "==", status);
//     if (source) query = query.where("source", "==", source);
//     if (city) query = query.where("city", "==", city);
//     if (state) query = query.where("state", "==", state);
//     if (productInterest)
//       query = query.where("productInterest", "==", productInterest);
//     if (assignedTo) query = query.where("assignedTo", "==", assignedTo);

//     const snapshot = await query.get();
//     let leads = snapshot.docs.map((doc) => {
//       const data = doc.data();
//       return {
//         id: doc.id,
//         ...data,
//         createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
//         updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
//         assignedAt: data.assignedAt?.toDate?.()?.toISOString() || null,
//       };
//     });

//     leads.sort(
//       (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
//     );

//     // Search filter
//     if (search) {
//       const q = search.toLowerCase();
//       leads = leads.filter(
//         (l) =>
//           l.name?.toLowerCase().includes(q) ||
//           l.phone?.includes(q) ||
//           l.email?.toLowerCase().includes(q),
//       );
//     }

//     const total = leads.length;
//     const start = (parseInt(page) - 1) * parseInt(limit);
//     const paginated = leads.slice(start, start + parseInt(limit));

//     res.json({
//       leads: paginated,
//       total,
//       page: parseInt(page),
//       limit: parseInt(limit),
//     });
//   } catch (err) {
//     console.error("GET LEADS ERROR:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // GET /api/leads/stats
// exports.getStats = async (req, res) => {
//   try {
//     const snapshot = await db.collection("leads").get();
//     const leads = snapshot.docs.map((d) => d.data());

//     const stats = {
//       total: leads.length,
//       unallocated: leads.filter((l) => l.status === "unallocated").length,
//       allocated: leads.filter((l) => l.status === "allocated").length,
//       bySource: {},
//       byState: {},
//     };

//     leads.forEach((l) => {
//       if (l.source)
//         stats.bySource[l.source] = (stats.bySource[l.source] || 0) + 1;
//       if (l.state) stats.byState[l.state] = (stats.byState[l.state] || 0) + 1;
//     });

//     res.json(stats);
//   } catch (err) {
//     console.error("GET STATS ERROR:", err);
//     res.status(500).json({ error: err.message });
//   }
// };
// // POST /api/leads
// exports.createLead = async (req, res) => {
//   try {
//     const { name, phone, email, source, city, state, productInterest, notes } =
//       req.body;

//     if (!name || !phone)
//       return res.status(400).json({ error: "Name and phone are required" });

//     const normalizedPhone = normalizePhone(phone);

//     const dupSnap = await db.collection("leads").get();

//     const exists = dupSnap.docs.some(
//       (d) => normalizePhone(d.data().phone) === normalizedPhone,
//     );

//     if (exists) {
//       return res.status(409).json({ error: "Lead already exists" });
//     }

//     const lead = {
//       name,
//       phone,
//       email: email || "",
//       source: source || "manual",
//       city: city || "",
//       state: state || "",
//       productInterest: productInterest || "",
//       notes: notes || "",
//       status: "unallocated",
//       assignedTo: null,
//       assignedToName: null,
//       assignedAt: null,
//       createdBy: req.user?.id || req.user?.uid || "",
//       createdByName: req.user?.name || req.user?.email || "Unknown",
//       createdAt: Timestamp.now(),
//       updatedAt: Timestamp.now(),
//     };

//     const leadId = await getNextLeadId();

//     await db
//       .collection("leads")
//       .doc(leadId)
//       .set({
//         ...lead,
//         leadId,
//       });
//     res.status(201).json({ id: leadId, ...lead, leadId });
//   } catch (err) {
//     console.error("CREATE LEAD ERROR:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // POST /api/leads/importFromExcel
// exports.importLeads = async (req, res) => {
//   try {
//     const { leads } = req.body;
//     if (!Array.isArray(leads) || leads.length === 0)
//       return res.status(400).json({ error: "No leads provided" });

//     const batch = db.batch();
//     const results = { imported: 0, duplicates: 0, errors: [] };

//     const existingSnap = await db.collection("leads").select("phone").get();
//     const existingPhones = new Set(
//       existingSnap.docs.map((d) => normalizePhone(d.data().phone)),
//     );

//     const seenInFile = new Set();

//     for (const l of leads) {
//       const rawPhone = l.mobile || l.phone;
//       const phone = normalizePhone(rawPhone);

//       if (!phone) continue;
//       if (existingPhones.has(phone)) continue;
//       if (seenInFile.has(phone)) continue;

//       const leadId = await getNextLeadId();

//       const ref = db.collection("leads").doc(leadId);

//       batch.set(ref, {
//         name: l.name || "Unknown",
//         phone,
//         email: l.email || "",
//         source: l.source || "excel",

//         city: l.city || "",
//         state: l.state || "",
//         productInterest: l.productInterest || l.product || "",
//         notes: l.notes || l.message || "",

//         status: "unallocated",
//         leadId,

//         createdAt: Timestamp.now(),
//         updatedAt: Timestamp.now(),
//       });

//       existingPhones.add(phone);
//       seenInFile.add(phone);
//     }
//     await batch.commit();
//     res.json(results);
//   } catch (err) {
//     console.error("IMPORT ERROR:", err);
//     res.status(500).json({ error: err.message });
//   }
// };

// // PUT /api/leads/:id
// exports.updateLead = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const allowed = [
//       "name",
//       "phone",
//       "email",
//       "source",
//       "city",
//       "state",
//       "productInterest",
//       "notes",
//     ];
//     const updates = {};
//     allowed.forEach((k) => {
//       if (req.body[k] !== undefined) updates[k] = req.body[k];
//     });
//     updates.updatedAt = Timestamp.now();
//     await db.collection("leads").doc(id).update(updates);
//     res.json({ id, ...updates });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // PATCH /api/leads/:id/assign
// exports.assignLead = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { assignedTo, assignedToName } = req.body;
//     if (!assignedTo)
//       return res.status(400).json({ error: "assignedTo is required" });

//     await db.collection("leads").doc(id).update({
//       assignedTo,
//       assignedToName,
//       status: "allocated",
//       assignedAt: Timestamp.now(),
//       updatedAt: Timestamp.now(),
//     });
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // PATCH /api/leads/bulk-assign
// exports.bulkAssign = async (req, res) => {
//   try {
//     const { leadIds, assignedTo, assignedToName } = req.body;
//     if (!leadIds?.length || !assignedTo)
//       return res
//         .status(400)
//         .json({ error: "leadIds and assignedTo are required" });

//     const batch = db.batch();
//     leadIds.forEach((id) => {
//       batch.update(db.collection("leads").doc(id), {
//         assignedTo,
//         assignedToName,
//         status: "allocated",
//         assignedAt: Timestamp.now(),
//         updatedAt: Timestamp.now(),
//       });
//     });
//     await batch.commit();
//     res.json({ success: true, count: leadIds.length });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // DELETE /api/leads/:id
// exports.deleteLead = async (req, res) => {
//   try {
//     await db.collection("leads").doc(req.params.id).delete();
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.bulkDelete = async (req, res) => {
//   const { leadIds } = req.body;
//   const batch = db.batch();
//   leadIds.forEach((id) => batch.delete(db.collection("leads").doc(id)));
//   await batch.commit();
//   res.json({ success: true, count: leadIds.length });
// };

// exports.importExternalLeads = async () => {
//   const { fetchTradeIndiaLeads } = require("../services/tradeindiaService");

//   try {
//     const leads = await fetchTradeIndiaLeads();

//     if (!leads || !Array.isArray(leads) || leads.length === 0) {
//       console.log("[TradeIndia] No leads found in response.");
//       return;
//     }

//     let count = 0;

//     for (const l of leads) {
//       // 1. Deduplication ID check (TradeIndia's Inquiry ID)
//       let externalId = l.inquiry_id || l.id || l.unique_id || l.oid;
//       const rawPhone = l.sender_mobile || l.landline_number || "";
//       const phone = normalizePhone(rawPhone);

//       if (!externalId && phone) {
//         externalId = `TI-${phone}-${(l.product_name || "lead").substring(0, 5)}`;
//       }

//       if (!externalId) continue;
//       const externalIdStr = externalId.toString();

//       // Check if already exists in CRM using sourceId
//       const existing = await db
//         .collection("leads")
//         .where("sourceId", "==", externalIdStr)
//         .limit(1)
//         .get();

//       if (!existing.empty) continue;

//       // 2. GENERATE INCREMENTAL ID (ANG00001, ANG00002...)
//       // Yeh function counter document se next number uthayega
//       const leadId = await getNextLeadId();

//       // 3. CLEANING DATA
//       const fullMessage = l.message || "";
//       const cleanNotes = fullMessage
//         .split("Sender Details")[0]
//         .replace(/Buyer is looking for\s*/i, "")
//         .trim();
//       const emailMatch = fullMessage.match(
//         /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/,
//       );
//       const email = emailMatch ? emailMatch[0] : l.sender_email || "";

//       // 4. SAVE TO FIRESTORE
//       // .doc(leadId) use karne se Document ID wahi banegi jo image_48dd4d.png mein hai
//       await db
//         .collection("leads")
//         .doc(leadId)
//         .set({
//           leadId, // Field mein bhi save hoga
//           name: l.sender_name || "Unknown",
//           phone: phone || "",
//           email: email || "",
//           source: "tradeindia",
//           sourceId: externalIdStr,
//           city: l.sender_city || "",
//           state: l.sender_state || l.sender_country || "",
//           productInterest: l.product_name || l.subject || "",
//           notes: cleanNotes || "TradeIndia Inquiry",
//           status: "unallocated",
//           assignedTo: null,
//           assignedToName: null,
//           createdAt: Timestamp.now(),
//           updatedAt: Timestamp.now(),
//         });

//       count++;
//     }

//     if (count > 0) {
//       console.log(
//         `[TradeIndia] Success: ${count} new leads imported.`,
//       );
//     }
//   } catch (err) {
//     console.error("TRADEINDIA IMPORT CONTROLLER ERROR:", err);
//   }
// };

const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");

const normalizePhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "").replace(/^91/, "").replace(/^0+/, "");
};

const getNextLeadId = async () => {
  const ref = db.collection("counters").doc("leads");
  return await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) {
      next = (doc.data().last || 0) + 1;
    }
    t.set(ref, { last: next }, { merge: true });
    return "ANG" + String(next).padStart(5, "0");
  });
};

// GET /api/leads
exports.getLeads = async (req, res) => {
  try {
    const {
      status,
      source,
      city,
      state,
      productInterest,
      assignedTo,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    let query = db.collection("leads");

    // READ OPTIMIZATION: Filter at Database level
    if (status) query = query.where("status", "==", status);
    if (source) query = query.where("source", "==", source);
    if (city) query = query.where("city", "==", city);
    if (state) query = query.where("state", "==", state);
    if (productInterest)
      query = query.where("productInterest", "==", productInterest);
    if (assignedTo) query = query.where("assignedTo", "==", assignedTo);

    const snapshot = await query.get();
    let leads = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        assignedAt: data.assignedAt?.toDate?.()?.toISOString() || null,
      };
    });

    leads.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.email?.toLowerCase().includes(q),
      );
    }

    const total = leads.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = leads.slice(start, start + parseInt(limit));

    res.json({
      leads: paginated,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error("GET LEADS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/leads/stats
exports.getStats = async (req, res) => {
  try {
    const snapshot = await db.collection("leads").get();
    const leads = snapshot.docs.map((d) => d.data());

    const stats = {
      total: leads.length,
      unallocated: leads.filter((l) => l.status === "unallocated").length,
      allocated: leads.filter((l) => l.status === "allocated").length,
      bySource: {},
      byState: {},
    };

    leads.forEach((l) => {
      if (l.source)
        stats.bySource[l.source] = (stats.bySource[l.source] || 0) + 1;
      if (l.state) stats.byState[l.state] = (stats.byState[l.state] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    console.error("GET STATS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/leads
exports.createLead = async (req, res) => {
  try {
    const { name, phone, email, source, city, state, productInterest, notes } =
      req.body;
    if (!name || !phone)
      return res.status(400).json({ error: "Name and phone are required" });

    const normalizedPhone = normalizePhone(phone);

    // READ OPTIMIZATION: Don't fetch all leads to check for one duplicate
    const dupSnap = await db
      .collection("leads")
      .where("phone", "==", phone)
      .limit(1)
      .get();

    if (!dupSnap.empty) {
      return res.status(409).json({ error: "Lead already exists" });
    }

const lead = {
  name,
  phone,
  email: email || "",
  source: source || "manual",
  city: city || "",
  state: state || city || "", 
  productInterest: productInterest ? productInterest.trim() : "",
  notes: notes || "",
  status: "unallocated",
  assignedTo: null,
  assignedToName: null,
  assignedAt: null,
  createdBy: req.user?.id || req.user?.uid || "",
  createdByName: req.user?.name || req.user?.email || "Unknown",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};
    const leadId = await getNextLeadId();
    await db
      .collection("leads")
      .doc(leadId)
      .set({ ...lead, leadId });
    res.status(201).json({ id: leadId, ...lead, leadId });
  } catch (err) {
    console.error("CREATE LEAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/leads/importFromExcel
exports.importLeads = async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0)
      return res.status(400).json({ error: "No leads provided" });

    const batch = db.batch();
    const results = { imported: 0, duplicates: 0, errors: [] };

    const existingSnap = await db.collection("leads").select("phone").get();
    const existingPhones = new Set(
      existingSnap.docs.map((d) => normalizePhone(d.data().phone)),
    );
    const seenInFile = new Set();

    for (const l of leads) {
      const rawPhone = l.mobile || l.phone;
      const phone = normalizePhone(rawPhone);
      if (!phone || existingPhones.has(phone) || seenInFile.has(phone))
        continue;

      const leadId = await getNextLeadId();
      const ref = db.collection("leads").doc(leadId);
      batch.set(ref, {
        name: l.name || "Unknown",
        phone,
        email: l.email || "",
        source: l.source || "excel",
        city: l.city || "",
        state: l.state || "",
        productInterest: l.productInterest || l.product || "",
        notes: l.notes || l.message || "",
        status: "unallocated",
        leadId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      existingPhones.add(phone);
      seenInFile.add(phone);
      results.imported++;
    }
    await batch.commit();
    res.json(results);
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "name",
      "phone",
      "email",
      "source",
      "city",
      "state",
      "productInterest",
      "notes",
    ];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    updates.updatedAt = Timestamp.now();
    await db.collection("leads").doc(id).update(updates);
    res.json({ id, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/leads/:id/assign
exports.assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedToName } = req.body;
    if (!assignedTo)
      return res.status(400).json({ error: "assignedTo is required" });
    await db.collection("leads").doc(id).update({
      assignedTo,
      assignedToName,
      status: "allocated",
      assignedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/leads/bulk-assign
exports.bulkAssign = async (req, res) => {
  try {
    const { leadIds, assignedTo, assignedToName } = req.body;
    if (!leadIds?.length || !assignedTo)
      return res
        .status(400)
        .json({ error: "leadIds and assignedTo are required" });
    const batch = db.batch();
    leadIds.forEach((id) => {
      batch.update(db.collection("leads").doc(id), {
        assignedTo,
        assignedToName,
        status: "allocated",
        assignedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    await batch.commit();
    res.json({ success: true, count: leadIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    await db.collection("leads").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkDelete = async (req, res) => {
  const { leadIds } = req.body;
  const batch = db.batch();
  leadIds.forEach((id) => batch.delete(db.collection("leads").doc(id)));
  await batch.commit();
  res.json({ success: true, count: leadIds.length });
};

exports.importExternalLeads = async () => {
  const { fetchTradeIndiaLeads } = require("../services/tradeindiaService");
  try {
    const leads = await fetchTradeIndiaLeads();
    if (!leads || !Array.isArray(leads) || leads.length === 0) return;
    let count = 0;
    for (const l of leads) {
      let externalId = l.inquiry_id || l.id || l.unique_id || l.oid;
      const rawPhone = l.sender_mobile || l.landline_number || "";
      const phone = normalizePhone(rawPhone);
      if (!externalId && phone) {
        externalId = `TI-${phone}-${(l.product_name || "lead").substring(0, 5)}`;
      }
      if (!externalId) continue;
      const externalIdStr = externalId.toString();

      // READ OPTIMIZATION: Check sourceId with targeted query
      const existing = await db
        .collection("leads")
        .where("sourceId", "==", externalIdStr)
        .limit(1)
        .get();
      if (!existing.empty) continue;

      const leadId = await getNextLeadId();
      const fullMessage = l.message || "";
      const cleanNotes = fullMessage
        .split("Sender Details")[0]
        .replace(/Buyer is looking for\s*/i, "")
        .trim();
      const emailMatch = fullMessage.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/,
      );
      const email = emailMatch ? emailMatch[0] : l.sender_email || "";

      await db
        .collection("leads")
        .doc(leadId)
        .set({
          leadId,
          name: l.sender_name || "Unknown",
          phone: phone || "",
          email: email || "",
          source: "tradeindia",
          sourceId: externalIdStr,
          city: l.sender_city || "",
          state: l.sender_state || l.sender_country || "",
          productInterest: l.product_name || l.subject || "",
          notes: cleanNotes || "TradeIndia Inquiry",
          status: "unallocated",
          assignedTo: null,
          assignedToName: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      count++;
    }
    if (count > 0)
      console.log(`[TradeIndia] Success: ${count} new leads imported.`);
  } catch (err) {
    console.error("TRADEINDIA IMPORT CONTROLLER ERROR:", err);
  }
};
