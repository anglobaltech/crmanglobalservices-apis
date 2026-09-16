const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");
const { logActivity } = require("./activityController");
const { getCache, setCache, clearCachePrefix } = require("../utils/cache");
const COLLECTION = "leads";

const LEAD_STATUSES = [
  "unallocated","allocated","contacted","interested","not_interested",
  "callback","converted","meeting","call_update",
];

function isFollowupPending(lead, today) {
  if (!lead.followupDate) return false;
  if (lead.followupDate > today) return false; 
  return true; 
}

exports.getMyLeads = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { status, search, dateFrom, dateTo, leadType, page = 1, limit = 20 } = req.query;

    let query = db.collection(COLLECTION).where("assignedTo", "==", userId);

    const cacheKey = `myLeads_${userId}`;
    let leads = getCache(cacheKey);

    if (!leads) {
      const snapshot = await query.get();
      leads = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id, ...d,
          createdAt:  d.createdAt?.toDate?.()?.toISOString()  || null,
          updatedAt:  d.updatedAt?.toDate?.()?.toISOString()  || null,
          assignedAt: d.assignedAt?.toDate?.()?.toISOString() || null,
        };
      });
      setCache(cacheKey, leads);
    }

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
        const isAllocated = l.status === "allocated";
        return inRange(l.assignedAt) || inRange(l.updatedAt) ||
               inRange(l.followupDate) || inRange(l.meetingDate) ||
               pendingFollowup || isAllocated;
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

    if (leadType) {
      leads = leads.filter((l) => l.leadType === leadType);
    }

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

    const stats = {
      total: 0, allocated: 0, contacted: 0, interested: 0, converted: 0,
      callback: 0, not_interested: 0, meeting: 0, call_update: 0
    };
    leads.forEach(l => {
      stats.total++;
      if (l.status !== "callback" && stats[l.status] !== undefined) stats[l.status]++;
      
      if (l.followupDate) {
        const fd = new Date(l.followupDate);
        if ((!from || fd >= from) && (!to || fd <= to)) {
          stats.callback++;
        }
      }
    });

    if (status && status !== "all") {
      leads = leads.filter(l => l.status === status);
    }

    leads.sort((a, b) => {
      const aPending = isFollowupPending(a, today) ? 1 : 0;
      const bPending = isFollowupPending(b, today) ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;
      return new Date(b.updatedAt || b.assignedAt || 0) - new Date(a.updatedAt || a.assignedAt || 0);
    });

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

    const userId = user?.id || user?.uid;
    const managerRoles = ["Super Admin","Founder & CEO","Director","Branch Manager","Manager","Team Manager"];

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

    if (quotationShared !== undefined) {
      updates.quotationShared = quotationShared === true || quotationShared === "true" ? true
        : quotationShared === false || quotationShared === "false" ? false
        : null;
    }
    if (updates.quotationShared === true && quotationAmount !== undefined && quotationAmount !== "") {
      updates.quotationAmount = Number(quotationAmount);
    } else {
      updates.quotationAmount = null;
    }

    let currentLead;
    const leadRef = db.collection(COLLECTION).doc(id);

    await db.runTransaction(async (t) => {
      const doc = await t.get(leadRef);
      if (!doc.exists) throw new Error("LEAD_NOT_FOUND");
      
      currentLead = doc.data();
      if (currentLead.assignedTo !== userId && !managerRoles.includes(user.roleName)) {
        throw new Error("NOT_AUTHORIZED");
      }

      t.update(leadRef, updates);
    });

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

    clearCachePrefix(`myLeads_${userId}`);
    clearCachePrefix("teamLeads");

    res.json({ success: true, id, status });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    if (err.message === "LEAD_NOT_FOUND") return res.status(404).json({ error: "Lead not found" });
    if (err.message === "NOT_AUTHORIZED") return res.status(403).json({ error: "Not authorized" });
    res.status(500).json({ error: err.message });
  }
};

exports.getTeamLeads = async (req, res) => {
  try {
    const { userId, status, search, dateFrom, dateTo, leadType, page = 1, limit = 20 } = req.query;
    const user = req.user;

    const managerRoles = ["Super Admin","Founder & CEO","Director","Branch Manager","Manager","Team Manager","Assistant Manager"];
    if (!managerRoles.includes(user.roleName)) return res.status(403).json({ error: "Access denied" });

    const adminRoles = ["Super Admin","Founder & CEO","Director"];
    let usersQuery = db.collection("users");
    if (!adminRoles.includes(user.roleName)) usersQuery = usersQuery.where("department","==",user.department);
    const usersSnap = await usersQuery.get();
    const teamIds = usersSnap.docs.map(d => d.id);

    const cacheKey = "teamLeads";
    let leads = getCache(cacheKey);

    if (!leads) {
      const snapshot = await db.collection(COLLECTION).where("status","!=","unallocated").get();
      leads = snapshot.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, ...d, createdAt: d.createdAt?.toDate?.()?.toISOString()||null, updatedAt: d.updatedAt?.toDate?.()?.toISOString()||null, assignedAt: d.assignedAt?.toDate?.()?.toISOString()||null };
      });
      setCache(cacheKey, leads);
    }

    const today = new Date().toISOString().split("T")[0];

    if (!adminRoles.includes(user.roleName)) leads = leads.filter(l => teamIds.includes(l.assignedTo));
    if (userId) leads = leads.filter(l => l.assignedTo === userId);

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
      const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;
      leads = leads.filter(l => {
        const inRange = iso => { if (!iso) return false; const d = new Date(iso); return (!from || d >= from) && (!to || d <= to); };
        const pendingFollowup = isFollowupPending(l, today);
        const isAllocated = l.status === "allocated";
        return inRange(l.assignedAt) || inRange(l.updatedAt) || inRange(l.followupDate) || inRange(l.meetingDate) || pendingFollowup || isAllocated;
      });
    }

    if (search) { const q = search.toLowerCase(); leads = leads.filter(l => l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.assignedToName?.toLowerCase().includes(q)); }

    if (leadType) {
      leads = leads.filter((l) => l.leadType === leadType);
    }

    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to   = dateTo   ? new Date(dateTo   + "T23:59:59") : null;

    const teamStats = {};
    const stats = { total:0, allocated:0, contacted:0, interested:0, converted:0, callback:0, not_interested:0, meeting:0, call_update:0 };
    leads.forEach(l => {
      if (!teamStats[l.assignedToName]) teamStats[l.assignedToName] = { total:0, allocated:0, contacted:0, interested:0, converted:0, callback:0, not_interested:0, meeting:0, call_update:0 };
      teamStats[l.assignedToName].total++;
      if (l.status !== "callback" && teamStats[l.assignedToName][l.status] !== undefined) teamStats[l.assignedToName][l.status]++;
      
      stats.total++;
      if (l.status !== "callback" && stats[l.status] !== undefined) stats[l.status]++;
      
      if (l.followupDate) {
        const fd = new Date(l.followupDate);
        if ((!from || fd >= from) && (!to || fd <= to)) {
          teamStats[l.assignedToName].callback++;
          stats.callback++;
        }
      }
    });

    if (status && status !== "all") leads = leads.filter(l => l.status === status);

    leads.sort((a, b) => {
      const aPending = isFollowupPending(a, today) ? 1 : 0;
      const bPending = isFollowupPending(b, today) ? 1 : 0;
      if (bPending !== aPending) return bPending - aPending;
      return new Date(b.updatedAt||0) - new Date(a.updatedAt||0);
    });

    const total = leads.length;
    const start = (parseInt(page)-1) * parseInt(limit);

    res.json({ leads: leads.slice(start, start+parseInt(limit)), total, teamStats, stats, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("GET TEAM LEADS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};