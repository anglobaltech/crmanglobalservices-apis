const { db } = require("../config/firebase");

// Safely resolve user display name — JWT may not carry a name field
const userName = (u) => u?.name || u?.email || "System";

// Manager check: management dept, users permission, or a manager-level role
const isManagerUser = (user) =>
  user?.department === "management" ||
  user?.permissions?.users === true ||
  user?.roleName?.toLowerCase().includes("manager") ||
  ["Founder & CEO", "Director", "Super Admin"].includes(user?.roleName);

const getNextServiceId = async () => {
  const ref = db.collection("counters").doc("services");
  return await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) {
      next = (doc.data().last || 0) + 1;
    }
    t.set(ref, { last: next }, { merge: true });
    return "SRV" + String(next).padStart(3, "0");
  });
};

// GET /api/services
// Employees see only their tasks; managers see all
exports.getServices = async (req, res) => {
  try {
    const { status, priority, assignedTo, search, page = 1, pageSize = 20 } = req.query;
    const isManager = isManagerUser(req.user);

    // Fetch all non-deleted services — filter in memory to avoid Firestore composite index
    const [snap, usersSnap] = await Promise.all([
      db.collection("services").get(),
      db.collection("users").get()
    ]);
    const userMap = {};
    usersSnap.docs.forEach(d => {
      userMap[d.id] = d.data().name || d.data().email;
    });

    let services = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          assignedToName: userMap[data.assignedTo] || data.assignedToName,
          createdByName: userMap[data.createdBy] || data.createdByName,
          assignedByName: userMap[data.assignedBy] || data.assignedByName,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
          assignedAt: data.assignedAt?.toDate?.()?.toISOString() || null,
          dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate || null,
        };
      })
      .filter(s => s.isDeleted !== true);

    // Permission filter — employees only see their tasks
    if (!isManager) {
      services = services.filter(s => s.assignedTo === req.user.id);
    } else if (assignedTo) {
      services = services.filter(s => s.assignedTo === assignedTo);
    }

    // Dropdown filters
    if (status) services = services.filter(s => s.status === status);
    if (priority) services = services.filter(s => s.priority === priority);

    // Search
    if (search) {
      const q = search.toLowerCase();
      services = services.filter(s =>
        s.serviceName?.toLowerCase().includes(q) ||
        s.clientName?.toLowerCase().includes(q) ||
        s.assignedToName?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    services.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = services.length;
    const start = (parseInt(page) - 1) * parseInt(pageSize);
    const paginated = services.slice(start, start + parseInt(pageSize));

    res.json({ services: paginated, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error("GET SERVICES ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/services/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const isManager = isManagerUser(req.user);
    const now = new Date();

    // Fetch all services (avoid composite index by fetching and filtering in memory)
    const snap = await db.collection("services").get();
    let allDocs = snap.docs.map(d => d.data()).filter(s => s.isDeleted !== true);

    // Employees only see stats for their own assigned tasks
    if (!isManager) {
      allDocs = allDocs.filter(s => s.assignedTo === req.user.id);
    }

    let total = 0, active = 0, completed = 0, pending = 0, overdue = 0, employees = new Set();

    allDocs.forEach(s => {
      total++;
      if (s.assignedTo) employees.add(s.assignedTo);
      if (s.status === "completed" || s.status === "cancelled") completed++;
      else if (s.status === "pending") pending++;
      else active++;

      const due = s.dueDate?.toDate ? s.dueDate.toDate() : (s.dueDate ? new Date(s.dueDate) : null);
      if (due && due < now && s.status !== "completed" && s.status !== "cancelled") overdue++;
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      total, active, completed, pending, overdue,
      employeesAssigned: employees.size,
      completionRate,
      isManager,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/services/:id
exports.getServiceById = async (req, res) => {
  try {
    const [doc, activitySnap, usersSnap] = await Promise.all([
      db.collection("services").doc(req.params.id).get(),
      db.collection("services").doc(req.params.id).collection("activity").orderBy("createdAt", "desc").limit(50).get(),
      db.collection("users").get()
    ]);
    
    if (!doc.exists || doc.data().isDeleted) return res.status(404).json({ message: "Service not found" });

    const userMap = {};
    usersSnap.docs.forEach(d => {
      userMap[d.id] = d.data().name || d.data().email;
    });

    const data = doc.data();
    data.assignedToName = userMap[data.assignedTo] || data.assignedToName;
    data.createdByName = userMap[data.createdBy] || data.createdByName;
    data.assignedByName = userMap[data.assignedBy] || data.assignedByName;

    const activity = activitySnap.docs.map(a => {
      const ad = a.data();
      return {
        id: a.id,
        ...ad,
        performedByName: userMap[ad.performedBy] || ad.performedByName,
        createdAt: ad.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      assignedAt: data.assignedAt?.toDate?.()?.toISOString() || null,
      dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
      activity,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/services
exports.createService = async (req, res) => {
  try {
    // Only managers can create services
    if (!isManagerUser(req.user)) {
      return res.status(403).json({ message: "Access denied. Only managers can create services." });
    }

    const { serviceName, clientName, description, category, priority, assignedTo, assignedToName, dueDate, currentStage } = req.body;
    if (!serviceName || !clientName) return res.status(400).json({ message: "serviceName and clientName are required" });

    const serviceId = await getNextServiceId();

    const data = {
      serviceName,
      clientName,
      description: description || "",
      category: category || "General",
      priority: priority || "medium",
      status: assignedTo ? "assigned" : "pending",
      assignedTo: assignedTo || null,
      assignedToName: assignedToName || null,
      assignedBy: assignedTo ? (req.user.id || null) : null,
      assignedByName: assignedTo ? userName(req.user) : null,
      assignedAt: assignedTo ? new Date() : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      progress: 0,
      currentStage: currentStage || "Not Started",
      createdBy: req.user.id || null,
      createdByName: userName(req.user),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };

    await db.collection("services").doc(serviceId).set(data);

    // Log creation activity
    await db.collection("services").doc(serviceId).collection("activity").add({
      type: "created",
      message: `Service created by ${userName(req.user)}`,
      performedBy: req.user.id,
      performedByName: userName(req.user),
      createdAt: new Date(),
    });

    if (assignedTo) {
      await db.collection("services").doc(serviceId).collection("activity").add({
        type: "assigned",
        message: `Task assigned to ${assignedToName || assignedTo}`,
        performedBy: req.user.id,
        performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }

    res.status(201).json({ id: serviceId, ...data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/services/:id
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("services").doc(id).get();
    if (!doc.exists || doc.data().isDeleted) return res.status(404).json({ message: "Service not found" });

    const prev = doc.data();
    const updates = { updatedAt: new Date() };
    const activityLogs = [];
    const isManager = isManagerUser(req.user);

    // Fields all users can update
    const employeeFields = ["status", "progress", "currentStage", "comment"];

    // Fields only managers can update
    const managerOnlyFields = ["serviceName", "clientName", "description", "category", "priority", "dueDate"];

    managerOnlyFields.forEach(f => {
      if (req.body[f] !== undefined) {
        if (!isManager) return; // silently skip manager-only fields for employees
        updates[f] = req.body[f] === "" ? null : (f === "dueDate" ? new Date(req.body[f]) : req.body[f]);
      }
    });

    if (req.body.status !== undefined && req.body.status !== prev.status) {
      updates.status = req.body.status;
      if (req.body.status === "completed") updates.progress = 100;
      activityLogs.push({
        type: "status_changed",
        message: `Status changed from "${prev.status}" to "${req.body.status}"`,
        previousStatus: prev.status,
        newStatus: req.body.status,
        performedBy: req.user.id,
        performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }

    if (req.body.progress !== undefined && req.body.progress !== prev.progress) {
      updates.progress = parseInt(req.body.progress);
      activityLogs.push({
        type: "progress_updated",
        message: `Progress updated from ${prev.progress || 0}% to ${req.body.progress}%`,
        previousProgress: prev.progress || 0,
        newProgress: parseInt(req.body.progress),
        performedBy: req.user.id,
        performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }

    // Only managers can reassign
    if (req.body.assignedTo !== undefined && isManager) {
      updates.assignedTo = req.body.assignedTo;
      updates.assignedToName = req.body.assignedToName || null;
      updates.assignedBy = req.user.id;
      updates.assignedByName = userName(req.user);
      updates.assignedAt = new Date();
      if (!updates.status) updates.status = "assigned";
      activityLogs.push({
        type: "assigned",
        message: `Task reassigned to ${req.body.assignedToName || req.body.assignedTo}`,
        performedBy: req.user.id,
        performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }

    if (req.body.comment) {
      activityLogs.push({
        type: "comment",
        message: req.body.comment,
        performedBy: req.user.id,
        performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }

    await db.collection("services").doc(id).update(updates);

    const batch = db.batch();
    activityLogs.forEach(log => {
      const ref = db.collection("services").doc(id).collection("activity").doc();
      batch.set(ref, log);
    });
    await batch.commit();

    res.json({ message: "Service updated successfully", id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/services/:id (soft delete)
exports.deleteService = async (req, res) => {
  try {
    const doc = await db.collection("services").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: "Service not found" });

    await db.collection("services").doc(req.params.id).update({
      isDeleted: true,
      updatedAt: new Date(),
    });

    res.json({ message: "Service deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/services/:id/activity
exports.getActivity = async (req, res) => {
  try {
    const snap = await db.collection("services").doc(req.params.id)
      .collection("activity").orderBy("createdAt", "desc").limit(100).get();

    const activity = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });

    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/services/:id/activity
exports.addActivity = async (req, res) => {
  try {
    const { message, type } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const ref = await db.collection("services").doc(req.params.id).collection("activity").add({
      type: type || "comment",
      message,
      performedBy: req.user.id,
      performedByName: req.user.name || req.user.email,
      createdAt: new Date(),
    });

    res.status(201).json({ id: ref.id, message: "Activity logged" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
