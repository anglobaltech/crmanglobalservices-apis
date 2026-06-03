const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin/firestore");

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
      let query = db.collection(COLLECTION).where("leadId", "==", leadId);
      const snapshot = await query.get();
      let logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
      });
      logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      return res.json({ logs, total: logs.length, page: 1, limit: logs.length });
    }

    const adminRoles   = ["Super Admin", "Founder & CEO", "Director"];
    const managerRoles = ["Branch Manager", "Manager", "Team Manager", "Assistant Manager"];

    let query = db.collection(COLLECTION);

    if (adminRoles.includes(user.roleName)) {
      // all logs
    } else if (managerRoles.includes(user.roleName)) {
      query = query.where("department", "==", user.department);
    } else {
      query = query.where("userId", "==", user.id || user.uid);
    }

    if (userId) query = query.where("userId", "==", userId);

    const snapshot = await query.get();
    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });

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

// GET /api/activity/followups
// Returns ALL leads where followupDate <= today (today + all overdue past dates).
// A followup is only considered "resolved/dismissed" if the lead has a NEW
// followupDate set in the future (meaning the agent rescheduled it forward).
// Simply updating notes/quotation/status does NOT dismiss the notification —
// only setting a future followupDate removes it from the bell.
exports.getTodayFollowups = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const today  = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    const snapshot = await db.collection("leads")
      .where("assignedTo", "==", userId)
      .get();

    const leads = snapshot.docs
      .map(doc => {
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
      })
      .filter(lead => {
        // Must have a followupDate
        if (!lead.followupDate) return false;

        // ✅ CORE RULE: show if followupDate is today OR any past date.
        // followupDate is stored as "YYYY-MM-DD" string — plain string compare works.
        if (lead.followupDate > today) return false; // future → don't show

        // ✅ A followup is only "resolved" if a NEW followupDate was set
        // that is strictly in the future. If followupDate is still today
        // or in the past, it must show regardless of any other updates.
        // This means: we NEVER suppress based on updatedAt alone.
        // The only way to dismiss a followup from notifications is to either:
        //   1. Set a new followupDate in the future (rescheduled), OR
        //   2. Set followupDate to null/empty (cleared)
        // Both of those cases are already handled above (followupDate > today → skip,
        // or !followupDate → skip), so we simply return true here.

        return true;
      });

    res.json({ leads, total: leads.length });
  } catch (err) {
    console.error("GET TODAY FOLLOWUPS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/activity/stats — summary stats for dashboard cards
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

    const snapshot = await query.get();
    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return { ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    }).filter(l => {
      if (!l.createdAt) return false;
      const d = new Date(l.createdAt);
      return d >= fromDt && d <= toDt;
    });

    const stats = {
      totalUpdates:   logs.length,
      interested:     logs.filter(l => l.newData?.status === "interested").length,
      converted:      logs.filter(l => l.newData?.status === "converted").length,
      not_interested: logs.filter(l => l.newData?.status === "not_interested").length,
      callback:       logs.filter(l => l.newData?.status === "callback").length,
      contacted:      logs.filter(l => l.newData?.status === "contacted").length,
      meeting:        logs.filter(l => l.newData?.status === "meeting").length,
      call_update:    logs.filter(l => l.newData?.status === "call_update").length,
    };

    res.json(stats);
  } catch (err) {
    console.error("GET ACTIVITY STATS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};