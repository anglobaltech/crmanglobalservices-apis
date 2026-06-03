const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { db } = require("../config/firebase");
const verifyToken = require("../middleware/authMiddleware");

router.get("/", verifyToken, async (req, res) => {
  try {
    const snap = await db.collection("users").get();
    const users = snap.docs.map((doc) => {
      const { password, ...safe } = doc.data();
      return { id: doc.id, ...safe };
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: "User not found" });
    const { password, ...safe } = doc.data();
    res.json({ id: doc.id, ...safe });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  const { name, email, password, department, roleName, roleId } = req.body;

  try {
    const userRef = db.collection("users").doc(req.params.id);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ message: "User not found" });

    // Fetch fresh permissions from role if role/department changed
    let permissions = userDoc.data().permissions || {};
    if (roleName && department) {
      try {
        const roleSnap = await db
          .collection("roles")
          .where("name", "==", roleName)
          .where("department", "==", department)
          .get();
        if (!roleSnap.empty) {
          permissions = roleSnap.docs[0].data().permissions || {};
        }
      } catch {}
    }

    const updates = {
      ...(name       && { name }),
      ...(email      && { email }),
      ...(department && { department }),
      ...(roleName   && { roleName }),
      ...(roleId     && { roleId }),
      permissions,
      updatedAt: new Date(),
    };

    if (password && password.trim()) {
      updates.password = await bcrypt.hash(password, 10);
    }

    await userRef.update(updates);
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/status", verifyToken, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ message: "User not found" });

    const current = doc.data().isActive;
    await userRef.update({ isActive: !current });
    res.json({ message: "Status updated", isActive: !current });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ message: "User not found" });

    await userRef.delete();
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;