const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../config/firebase");

const getNextUserId = async () => {
  const ref = db.collection("counters").doc("users");
  return await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) {
      next = (doc.data().last || 0) + 1;
    }
    t.set(ref, { last: next }, { merge: true });
    return "UID" + String(next).padStart(3, "0");
  });
};

exports.registerUser = async (req, res) => {
  const { name, email, password, roleId, roleName, department } = req.body;

  if (!name || !email || !password || !department)
    return res.status(400).json({ message: "All fields are required" });
  if (!roleName) return res.status(400).json({ message: "Role is required" });

  try {
    // Duplicate check
    const existing = await db
      .collection("users")
      .where("email", "==", email)
      .get();
    if (!existing.empty)
      return res.status(400).json({ message: "User already exists" });

    let permissions = {};
    const roleSnap = await db
      .collection("roles")
      .where("name", "==", roleName)
      .where("department", "==", department)
      .get();
    if (!roleSnap.empty) {
      permissions = roleSnap.docs[0].data().permissions || {};
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await getNextUserId();

    await db.collection("users").doc(userId).set({
      id: userId,
      name,
      email,
      password: hashedPassword,
      roleId: roleId || roleName,
      roleName,
      department,
      permissions,
      isActive: true,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "User created successfully",
      id: userId,
      name,
      email,
      roleName,
      department,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const snap = await db.collection("users").where("email", "==", email).get();
    if (snap.empty)
      return res.status(401).json({ message: "Invalid credentials" });

    const userDoc = snap.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isActive)
      return res.status(403).json({ message: "Account is deactivated" });

    let permissions = user.permissions || {};
    try {
      const roleSnap = await db
        .collection("roles")
        .where("name", "==", user.roleName)
        .where("department", "==", user.department)
        .get();

      if (!roleSnap.empty) {
        permissions = roleSnap.docs[0].data().permissions || {};
        // Sync back to user doc so it stays fresh
        await db.collection("users").doc(user.id).update({ permissions });
      }
    } catch (e) {
      console.error("Role fetch error:", e.message);
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        department: user.department,
        permissions,
        profilePic: user.profilePic || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        department: user.department,
        permissions,
        isActive: user.isActive,
        profilePic: user.profilePic || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
