const { db, bucket } = require("../config/firebase");

const col = () => db.collection("employees");

const { uploadBase64File } = require("../utils/storageHelper");

const isManagerUser = (user) => {
  if (!user) return false;
  const role = (user.roleName || "").toLowerCase();
  return role === "super admin" || role === "admin" || role === "director" || role === "founder & ceo" || role.includes("manager") || user.department === "management" || user.permissions?.employees === true;
};

/* ─── Helper: Delete file from Firebase Storage by URL ─── */
const deleteFileByUrl = async (url) => {
  // Deliberately empty: Firebase files should not be deleted
};

const getEmployees = async (req, res) => {
  try {
    const snap = await col().orderBy("createdAt", "desc").get();
    const employees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getEmployee = async (req, res) => {
  try {
    const doc = await col().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: "Employee not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    if (!isManagerUser(req.user)) {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const {
      name, email, phone, department, designation, employeeId,
      joiningDate, salary, status = "active",
      currentAddress, permanentAddress, notes,
      employeeType = "fresher",          // "fresher" | "experienced"
      salarySlipBase64, salarySlipName,  // base64 for experienced
      relievingLetterBase64, relievingLetterName,
    } = req.body;

    if (!name || !email || !department || !designation)
      return res.status(400).json({ message: "name, email, department and designation are required" });

    // Upload documents only for experienced employees
    let salarySlipUrl     = "";
    let relievingLetterUrl = "";
    if (employeeType === "experienced") {
      salarySlipUrl      = await uploadBase64File(salarySlipBase64,     `employees/${name}/salary_slips`, salarySlipName     || "salary_slip");
      relievingLetterUrl = await uploadBase64File(relievingLetterBase64, `employees/${name}/relieving_letters`, relievingLetterName || "relieving_letter");
    }

    const data = {
      name, email, phone: phone || "", department, designation,
      employeeId:        employeeId    || "",
      joiningDate:       joiningDate   || "",
      salary:            salary ? Number(salary) : 0,
      status,
      employeeType,
      currentAddress:    currentAddress   || "",
      permanentAddress:  permanentAddress  || "",
      notes:             notes            || "",
      salarySlipUrl,
      relievingLetterUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const ref = await col().add(data);
    res.status(201).json({ id: ref.id, ...data, message: "Employee created successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    if (!isManagerUser(req.user)) {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const ref = col().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ message: "Employee not found" });

    const existing = doc.data();

    const {
      name, email, phone, department, designation, employeeId,
      joiningDate, salary, status,
      currentAddress, permanentAddress, notes,
      employeeType,
      salarySlipBase64, salarySlipName,
      relievingLetterBase64, relievingLetterName,
      // allow passing existing URLs (no-change)
      salarySlipUrl: passedSalarySlipUrl,
      relievingLetterUrl: passedRelievingLetterUrl,
    } = req.body;

    // Handle salary slip update
    let salarySlipUrl = existing.salarySlipUrl || "";
    if (salarySlipBase64) {
      await deleteFileByUrl(existing.salarySlipUrl);
      salarySlipUrl = await uploadBase64File(salarySlipBase64, `employees/${name || existing.name}/salary_slips`, salarySlipName || "salary_slip");
    } else if (passedSalarySlipUrl !== undefined) {
      salarySlipUrl = passedSalarySlipUrl;
    }

    // Handle relieving letter update
    let relievingLetterUrl = existing.relievingLetterUrl || "";
    if (relievingLetterBase64) {
      await deleteFileByUrl(existing.relievingLetterUrl);
      relievingLetterUrl = await uploadBase64File(relievingLetterBase64, `employees/${name || existing.name}/relieving_letters`, relievingLetterName || "relieving_letter");
    } else if (passedRelievingLetterUrl !== undefined) {
      relievingLetterUrl = passedRelievingLetterUrl;
    }

    const updates = {
      ...(name             !== undefined && { name }),
      ...(email            !== undefined && { email }),
      ...(phone            !== undefined && { phone }),
      ...(department       !== undefined && { department }),
      ...(designation      !== undefined && { designation }),
      ...(employeeId       !== undefined && { employeeId }),
      ...(joiningDate      !== undefined && { joiningDate }),
      ...(salary           !== undefined && { salary: Number(salary) }),
      ...(status           !== undefined && { status }),
      ...(employeeType     !== undefined && { employeeType }),
      ...(currentAddress   !== undefined && { currentAddress }),
      ...(permanentAddress !== undefined && { permanentAddress }),
      ...(notes            !== undefined && { notes }),
      salarySlipUrl,
      relievingLetterUrl,
      updatedAt: new Date(),
    };

    await ref.update(updates);
    res.json({ message: "Employee updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (!isManagerUser(req.user)) {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const ref = col().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ message: "Employee not found" });
    const data = doc.data();
    // Clean up uploaded files
    await deleteFileByUrl(data.salarySlipUrl);
    await deleteFileByUrl(data.relievingLetterUrl);
    await ref.delete();
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const toggleStatus = async (req, res) => {
  try {
    if (!isManagerUser(req.user)) {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }
    const ref = col().doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ message: "Employee not found" });

    const current = doc.data().status || "active";
    const next = current === "active" ? "inactive" : "active";
    await ref.update({ status: next, updatedAt: new Date() });
    res.json({ message: "Status updated", status: next });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleStatus,
};
