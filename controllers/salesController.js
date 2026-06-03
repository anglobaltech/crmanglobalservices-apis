const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");
const { logActivity } = require("./activityController");

const COLLECTION = "leads";

const LEAD_STATUSES = [
  "unallocated","allocated","contacted","interested","not_interested",
  "callback","converted","meeting","call_update",
];

// A followup is "pending" (overdue/due) if followupDate exists and is today or in the past.
// We no longer suppress based on updatedAt — only a future followupDate clears the pending state.
function isFollowupPending(lead, today) {
  if (!lead.followupDate) return false;
  if (lead.followupDate > today) return false; // future date — not pending yet
  return true; // today or overdue — always pending
}

exports.getMyLeads = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { status, search, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

    let query = db.collection(COLLECTION).where("assignedTo", "==", userId);
    if (status && status !== "all") query = query.where("status", "==", status);

    const snapshot = await query.get();
    let leads = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id, ...d,
        createdAt:  d.createdAt?.toDate?.()?.toISOString()  || null,
        updatedAt:  d.updatedAt?.toDate?.()?.toISOString()  || null,
        assignedAt: d.assignedAt?.toDate?.()?.toISOString() || null,
      };
    });

    const today = new Date().toISOString().split("T")[0];

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

      leads = leads.filter((l) => {
        const inRange = (iso) => {
          if (!iso) return false;
          const d = new Date(iso);
          return (!from || d >= from) && (!to || d <= to);
        };
        const pendingFollowup = isFollowupPending(l, today);
        return inRange(l.assignedAt) || inRange(l.updatedAt) ||
               inRange(l.followupDate) || inRange(l.meetingDate) ||
               pendingFollowup;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter((l) =>
        l.name?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.productInterest?.toLowerCase().includes(q)
      );
    }

    // Sort: pending followups first, then by updatedAt desc
    leads.sort((a, b) => {
      const aPending = isFollowupPending(a, today) ? 1 : 0;
      const bPending = isFollowupPending(b, today) ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;
      return new Date(b.updatedAt || b.assignedAt || 0) - new Date(a.updatedAt || a.assignedAt || 0);
    });

    const allSnap = await db.collection(COLLECTION).where("assignedTo","==",userId).get();
    const all = allSnap.docs.map((d) => d.data());
    const stats = {
      total:          all.length,
      contacted:      all.filter(l => l.status === "contacted").length,
      interested:     all.filter(l => l.status === "interested").length,
      converted:      all.filter(l => l.status === "converted").length,
      callback:       all.filter(l => l.status === "callback").length,
      not_interested: all.filter(l => l.status === "not_interested").length,
      meeting:        all.filter(l => l.status === "meeting").length,
      call_update:    all.filter(l => l.status === "call_update").length,
    };

    const total = leads.length;
    const start = (parseInt(page)-1) * parseInt(limit);
    res.json({ leads: leads.slice(start, start+parseInt(limit)), total, stats, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("GET MY LEADS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status, notes, followupDate, followUpNote,
      meetingSubType, meetingDate, meetingNote,
      quotationShared, quotationAmount,
    } = req.body;
    const user = req.user;

    if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status: " + status });

    const leadDoc = await db.collection(COLLECTION).doc(id).get();
    if (!leadDoc.exists) return res.status(404).json({ error: "Lead not found" });

    const currentLead = leadDoc.data();
    const userId = user?.id || user?.uid;
    const managerRoles = ["Super Admin","Founder & CEO","Director","Branch Manager","Manager","Team Manager"];

    if (currentLead.assignedTo !== userId && !managerRoles.includes(user.roleName)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updates = {
      status,
      updatedAt: Timestamp.now(),
      lastUpdatedBy: userId,
      lastUpdatedByName: user.name || user.email,
      followupDate: followupDate || null,
    };
    if (notes          !== undefined) updates.notes          = notes;
    if (followUpNote   !== undefined) updates.followUpNote   = followUpNote;
    if (meetingSubType !== undefined) updates.meetingSubType = meetingSubType;
    if (meetingDate    !== undefined) updates.meetingDate    = meetingDate;
    if (meetingNote    !== undefined) updates.meetingNote    = meetingNote;

    // quotationShared can be true / false / null (not yet set)
    if (quotationShared !== undefined) {
      updates.quotationShared = quotationShared === true || quotationShared === "true" ? true
        : quotationShared === false || quotationShared === "false" ? false
        : null;
    }
    // Only save amount when quotation was shared
    if (updates.quotationShared === true && quotationAmount !== undefined && quotationAmount !== "") {
      updates.quotationAmount = Number(quotationAmount);
    } else {
      updates.quotationAmount = null;
    }

    await db.collection(COLLECTION).doc(id).update(updates);

    await logActivity({
      userId, userName: user.name || user.email || "Unknown",
      userRole: user.roleName, department: user.department,
      action: "status_update", leadId: id, leadName: currentLead.name,
      oldData: { status: currentLead.status, notes: currentLead.notes },
      newData: {
        status, notes, followupDate, followUpNote,
        meetingSubType, meetingDate, meetingNote,
        quotationShared: updates.quotationShared,
        quotationAmount: updates.quotationAmount,
      },
    });

    res.json({ success: true, id, status });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getTeamLeads = async (req, res) => {
  try {
    const { userId, status, search, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const user = req.user;

    const managerRoles = ["Super Admin","Founder & CEO","Director","Branch Manager","Manager","Team Manager","Assistant Manager"];
    if (!managerRoles.includes(user.roleName)) return res.status(403).json({ error: "Access denied" });

    const adminRoles = ["Super Admin","Founder & CEO","Director"];
    let usersQuery = db.collection("users");
    if (!adminRoles.includes(user.roleName)) usersQuery = usersQuery.where("department","==",user.department);
    const usersSnap = await usersQuery.get();
    const teamIds = usersSnap.docs.map(d => d.id);

    const snapshot = await db.collection(COLLECTION).where("status","!=","unallocated").get();
    let leads = snapshot.docs.map(doc => {
      const d = doc.data();
      return { id: doc.id, ...d, createdAt: d.createdAt?.toDate?.()?.toISOString()||null, updatedAt: d.updatedAt?.toDate?.()?.toISOString()||null, assignedAt: d.assignedAt?.toDate?.()?.toISOString()||null };
    });

    const today = new Date().toISOString().split("T")[0];

    if (!adminRoles.includes(user.roleName)) leads = leads.filter(l => teamIds.includes(l.assignedTo));
    if (userId) leads = leads.filter(l => l.assignedTo === userId);
    if (status && status !== "all") leads = leads.filter(l => l.status === status);

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;
      leads = leads.filter(l => {
        const inRange = iso => { if (!iso) return false; const d = new Date(iso); return (!from || d >= from) && (!to || d <= to); };
        const pendingFollowup = isFollowupPending(l, today);
        return inRange(l.assignedAt) || inRange(l.updatedAt) || inRange(l.followupDate) || inRange(l.meetingDate) || pendingFollowup;
      });
    }

    if (search) { const q = search.toLowerCase(); leads = leads.filter(l => l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.assignedToName?.toLowerCase().includes(q)); }

    leads.sort((a, b) => {
      const aPending = isFollowupPending(a, today) ? 1 : 0;
      const bPending = isFollowupPending(b, today) ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;
      return new Date(b.updatedAt||0) - new Date(a.updatedAt||0);
    });

    const total = leads.length;
    const start = (parseInt(page)-1) * parseInt(limit);

    const teamStats = {};
    leads.forEach(l => {
      if (!teamStats[l.assignedToName]) teamStats[l.assignedToName] = { total:0, contacted:0, interested:0, converted:0, callback:0, not_interested:0, meeting:0, call_update:0 };
      teamStats[l.assignedToName].total++;
      if (teamStats[l.assignedToName][l.status] !== undefined) teamStats[l.assignedToName][l.status]++;
    });

    res.json({ leads: leads.slice(start, start+parseInt(limit)), total, teamStats, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("GET TEAM LEADS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};