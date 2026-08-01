const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");
const { getCache, setCache, clearCachePrefix } = require("../utils/cache");

const COLLECTION = "activityLogs";

exports.logActivity = async ({ userId, userName, userRole, department, action, leadId, leadName, oldData, newData }) => {
  try {
    await db.collection(COLLECTION).add({
      userId, userName, userRole, department, action,
      leadId, leadName,
      oldData: oldData || null,
      newData: newData || null,
      createdAt: Timestamp.now(),
    });
    clearCachePrefix("activity_");
    clearCachePrefix("todayFollowups_");
    clearCachePrefix("activityStats_");
  } catch (err) {
    console.error("LOG ACTIVITY ERROR:", err.message);
  }
};

// GET /api/activity
exports.getActivity = async (req, res) => {
  try {
    const { page = 1, limit = 30, userId, leadId, dateFrom, dateTo } = req.query;
    const user = req.user;

    // Isolated lead history
    if (leadId) {
      const cacheKey = `activity_lead_${leadId}`;
      let logs = getCache(cacheKey);
      if (!logs) {
        let query = db.collection(COLLECTION).where("leadId", "==", leadId);
        const snapshot = await query.get();
        logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
        });
        setCache(cacheKey, logs);
      }
      logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.json({ logs, total: logs.length, page: 1, limit: logs.length });
    }

    const adminRoles   = ["Super Admin", "Founder & CEO", "Director"];
    const managerRoles = ["Branch Manager", "Manager", "Team Manager", "Assistant Manager"];

    let query = db.collection(COLLECTION);

    if (adminRoles.includes(user.roleName)) {
    } else if (managerRoles.includes(user.roleName)) {
      query = query.where("department", "==", user.department);
    } else {
      query = query.where("userId", "==", user.id || user.uid);
    }

    if (userId) query = query.where("userId", "==", userId);

    const reqUserId = user.id || user.uid;
    const cacheKey = `activity_${reqUserId}_${userId || 'all'}`;
    let logs = getCache(cacheKey);

    if (!logs) {
      const snapshot = await query.get();
      logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
      });
      setCache(cacheKey, logs);
    }

    const today = new Date().toISOString().split("T")[0];
    const from = dateFrom || today;
    const to   = dateTo   || today;

    const fromDt = new Date(from + "T00:00:00");
    const toDt   = new Date(to   + "T23:59:59");

    logs = logs.filter(l => {
      if (!l.createdAt) return false;
      const d = new Date(l.createdAt);
      return d >= fromDt && d <= toDt;
    });

    logs = logs.filter(l => l.action === "status_update");

    logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = logs.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    res.json({
      logs: logs.slice(start, start + parseInt(limit)),
      total, page: parseInt(page), limit: parseInt(limit),
    });
  } catch (err) {
    console.error("GET ACTIVITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getTodayFollowups = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const today  = new Date().toISOString().split("T")[0];  

    const reqUserId = req.user?.id || req.user?.uid;
    const cacheKey = `todayFollowups_${reqUserId}`;
    let snapshotLeads = getCache(cacheKey);

    if (!snapshotLeads) {
      const snapshot = await db.collection("leads")
        .where("assignedTo", "==", userId)
        .get();

      snapshotLeads = snapshot.docs.map(doc => {
        const data = doc.data();

        // Safely convert Firestore Timestamps → ISO strings
        const toISO = (val) => {
          if (!val) return null;
          if (typeof val.toDate === "function") return val.toDate().toISOString();
          if (typeof val === "string") return val;
          return null;
        };

        return {
          id: doc.id,
          ...data,
          createdAt:  toISO(data.createdAt),
          updatedAt:  toISO(data.updatedAt),
          assignedAt: toISO(data.assignedAt),
        };
      });
      setCache(cacheKey, snapshotLeads);
    }

    const leads = snapshotLeads.filter(lead => {
        if (!lead.followupDate) return false;
        if (lead.followupDate > today) return false; 

        return true;
      });

    res.json({ leads, total: leads.length });
  } catch (err) {
    console.error("GET TODAY FOLLOWUPS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getActivityStats = async (req, res) => {
  try {
    const user = req.user;
    const { dateFrom, dateTo } = req.query;

    const today = new Date().toISOString().split("T")[0];
    const from  = dateFrom || today;
    const to    = dateTo   || today;
    const fromDt = new Date(from + "T00:00:00");
    const toDt   = new Date(to   + "T23:59:59");

    const adminRoles   = ["Super Admin", "Founder & CEO", "Director"];
    const managerRoles = ["Branch Manager", "Manager", "Team Manager", "Assistant Manager"];

    let query = db.collection(COLLECTION).where("action", "==", "status_update");

    if (!adminRoles.includes(user.roleName)) {
      if (managerRoles.includes(user.roleName)) {
        query = query.where("department", "==", user.department);
      } else {
        query = query.where("userId", "==", user.id || user.uid);
      }
    }

    const reqUserId = user.id || user.uid;
    const cacheKey = `activityStats_${reqUserId}`;
    let logs = getCache(cacheKey);

    if (!logs) {
      const snapshot = await query.get();
      logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
      });
      setCache(cacheKey, logs);
    }
    
    logs = logs.filter(l => {
      if (!l.createdAt) return false;
      const d = new Date(l.createdAt);
      return d >= fromDt && d <= toDt;
    });

    const userPerformanceMap = {};
    logs.forEach(l => {
      const u = l.userName || "Unknown";
      if (!userPerformanceMap[u]) userPerformanceMap[u] = { name: u, role: l.userRole, total: 0, statuses: {} };
      userPerformanceMap[u].total++;
      const s = l.newData?.status;
      if (s) {
        userPerformanceMap[u].statuses[s] = (userPerformanceMap[u].statuses[s] || 0) + 1;
      }
    });
    
    const userPerformance = Object.values(userPerformanceMap).sort((a, b) => b.total - a.total);

    const stats = {
      totalUpdates:   logs.length,
      interested:     logs.filter(l => l.newData?.status === "interested").length,
      converted:      logs.filter(l => l.newData?.status === "converted").length,
      not_interested: logs.filter(l => l.newData?.status === "not_interested").length,
      callback:       logs.filter(l => l.newData?.status === "callback").length,
      contacted:      logs.filter(l => l.newData?.status === "contacted").length,
      meeting:        logs.filter(l => l.newData?.status === "meeting").length,
      call_update:    logs.filter(l => l.newData?.status === "call_update").length,
      userPerformance: userPerformance,
    };

    res.json(stats);
  } catch (err) {
    console.error("GET ACTIVITY STATS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};