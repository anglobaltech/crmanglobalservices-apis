const { db } = require("../config/firebase");

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)+/g, '');

const MODULES = ["dashboard", "users", "sales", "allocate", "settings", "services", "projects"];

const ROLES_CONFIG = [
  { department: "management", name: "Super Admin" },
  { department: "management", name: "Director" },
  { department: "management", name: "Founder & CEO" },
  { department: "sales", name: "Branch Manager" },
  { department: "sales", name: "Manager" },
  { department: "sales", name: "Team Manager" },
  { department: "sales", name: "Assistant Manager" },
  { department: "sales", name: "Executive" },
  { department: "sales", name: "Intern" },
  { department: "services", name: "Service Manager" },
  { department: "services", name: "Senior Executive" },
  { department: "services", name: "Executive" },
  { department: "services", name: "Support Staff" },
];

const DEFAULT_PERMISSIONS = {
  "Super Admin":       { dashboard: true,  users: true,  sales: true,  leads: true,  allocate: true,  settings: true,  services: true,  projects: true  },
  "Founder & CEO":     { dashboard: true,  users: true,  sales: true,  leads: true,  allocate: true,  settings: true,  services: true,  projects: true  },
  "Director":          { dashboard: true,  users: true,  sales: true,  leads: true,  allocate: true,  settings: false, services: true,  projects: true  },
  "Branch Manager":    { dashboard: true,  users: false, sales: true,  leads: true,  allocate: true,  settings: false, services: false, projects: false },
  "Manager":           { dashboard: true,  users: false, sales: true,  leads: true,  allocate: false, settings: false, services: false, projects: false },
  "Team Manager":      { dashboard: true,  users: false, sales: true,  leads: true,  allocate: false, settings: false, services: false, projects: false },
  "Assistant Manager": { dashboard: true,  users: false, sales: true,  leads: false, allocate: false, settings: false, services: false, projects: false },
  "Executive":         { dashboard: true,  users: false, sales: true,  leads: false, allocate: false, settings: false, services: false, projects: false },
  "Intern":            { dashboard: true,  users: false, sales: false, leads: false, allocate: false, settings: false, services: false, projects: false },
  "Service Manager":   { dashboard: true,  users: false, sales: false, leads: false, allocate: true,  settings: false, services: true,  projects: true  },
  "Senior Executive":  { dashboard: true,  users: false, sales: false, leads: false, allocate: false, settings: false, services: true,  projects: true  },
  "Support Staff":     { dashboard: true,  users: false, sales: false, leads: false, allocate: false, settings: false, services: true,  projects: true  },
};

exports.getRoles = async (req, res) => {
  try {
    const snap = await db.collection("roles").get();
    const roles = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const doc = await db.collection("roles").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: "Role not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createRole = async (req, res) => {
  const { name, department, permissions } = req.body;
  if (!name || !department)
    return res.status(400).json({ message: "name and department required" });

  try {
    const existing = await db
      .collection("roles")
      .where("name", "==", name)
      .where("department", "==", department)
      .get();
    if (!existing.empty)
      return res.status(400).json({ message: "Role already exists" });

    const roleId = `${slugify(department)}_${slugify(name)}`;
    await db.collection("roles").doc(roleId).set({
      name, department,
      permissions: permissions || {},
      createdAt: new Date(),
    });

    res.status(201).json({ id: roleId, name, department, permissions: permissions || {} });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  const { id } = req.params;
  const { permissions, name, department } = req.body;

  try {
    const roleDoc = await db.collection("roles").doc(id).get();
    if (!roleDoc.exists)
      return res.status(404).json({ message: "Role not found" });

    const roleData = roleDoc.data();
    const roleName = name || roleData.name;
    const roleDept = department || roleData.department;

    await db.collection("roles").doc(id).update({
      ...(permissions !== undefined && { permissions }),
      ...(name && { name }),
      ...(department && { department }),
      updatedAt: new Date(),
    });

    let usersUpdated = 0;
    if (permissions !== undefined) {
      const usersSnap = await db
        .collection("users")
        .where("roleName", "==", roleName)
        .where("department", "==", roleDept)
        .get();

      if (!usersSnap.empty) {
        const batch = db.batch();
        usersSnap.docs.forEach((userDoc) => {
          batch.update(userDoc.ref, { permissions });
        });
        await batch.commit();
        usersUpdated = usersSnap.size;
      }
    }

    res.json({ message: "Role updated and synced", usersUpdated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.seedRoles = async (req, res) => {
  try {
    const snap = await db.collection("roles").get();
    if (!snap.empty)
      return res.json({ message: "Roles already seeded", count: snap.size });

    const batch = db.batch();
    for (const roleConfig of ROLES_CONFIG) {
      const roleId = `${slugify(roleConfig.department)}_${slugify(roleConfig.name)}`;
      const ref = db.collection("roles").doc(roleId);
      const permissions =
        DEFAULT_PERMISSIONS[roleConfig.name] ||
        Object.fromEntries(MODULES.map((m) => [m, m === "dashboard"]));
      batch.set(ref, { ...roleConfig, permissions, createdAt: new Date() });
    }
    await batch.commit();

    res.json({ message: "Roles seeded successfully", count: ROLES_CONFIG.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.reseedRoles = async (req, res) => {
  try {
    // Delete all existing roles
    const snap = await db.collection("roles").get();
    const deleteBatch = db.batch();
    snap.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();

    // Re-create with correct permissions
    const createBatch = db.batch();
    for (const roleConfig of ROLES_CONFIG) {
      const roleId = `${slugify(roleConfig.department)}_${slugify(roleConfig.name)}`;
      const ref = db.collection("roles").doc(roleId);
      const permissions =
        DEFAULT_PERMISSIONS[roleConfig.name] ||
        Object.fromEntries(MODULES.map((m) => [m, m === "dashboard"]));
      createBatch.set(ref, { ...roleConfig, permissions, createdAt: new Date() });
    }
    await createBatch.commit();

    res.json({ message: "Roles re-seeded successfully", count: ROLES_CONFIG.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.syncAllUsers = async (req, res) => {
  try {
    // Get all roles as a map: "roleName|department" → permissions
    const rolesSnap = await db.collection("roles").get();
    const rolesMap = {};
    rolesSnap.docs.forEach((doc) => {
      const r = doc.data();
      rolesMap[`${r.name}|${r.department}`] = r.permissions || {};
    });

    // Get all users
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty)
      return res.json({ message: "No users found", updated: 0 });

    const batch = db.batch();
    let updated = 0;

    usersSnap.docs.forEach((userDoc) => {
      const u = userDoc.data();
      const key = `${u.roleName}|${u.department}`;
      const rolePermissions = rolesMap[key];

      if (rolePermissions) {
        batch.update(userDoc.ref, { permissions: rolePermissions });
        updated++;
      }
    });

    await batch.commit();
    res.json({ message: `Synced permissions for ${updated} users`, updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};