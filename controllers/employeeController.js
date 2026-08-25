const { db, bucket } = require("../config/firebase");

const col = () => db.collection("employees");

/* ─── Helper: Upload base64 file to Firebase Storage ─── */
const uploadBase64File = async (base64Data, fileName, folder) => {
  if (!base64Data) return "";
  // base64Data format: "data:<mime>;base64,<data>"
  const matches = base64Data.match(/^data:([A-Za-z0-9+/]+\/[A-Za-z0-9+/]+);base64,(.+)$/);
  if (!matches) return "";
  const mimeType = matches[1];
  const buffer   = Buffer.from(matches[2], "base64");
  const ext      = mimeType.split("/")[1].replace("jpeg", "jpg");
  const filePath = `${folder}/${Date.now()}_${fileName}.${ext}`;
  const file     = bucket.file(filePath);
  await file.save(buffer, { contentType: mimeType, resumable: false });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
};

/* ─── Helper: Delete file from Firebase Storage by URL ─── */
const deleteFileByUrl = async (url) => {
  if (!url) return;
  try {
    const bucketName = bucket.name;
    const prefix = `https://storage.googleapis.com/${bucketName}/`;
    if (url.startsWith(prefix)) {
      const filePath = url.slice(prefix.length);
      await bucket.file(filePath).delete();
    }
  } catch (_) { /* ignore deletion errors */ }
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
      salarySlipUrl      = await uploadBase64File(salarySlipBase64,     salarySlipName     || "salary_slip",     `employees/${name}/salary_slips`);
      relievingLetterUrl = await uploadBase64File(relievingLetterBase64, relievingLetterName || "relieving_letter", `employees/${name}/relieving_letters`);
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
      salarySlipUrl = await uploadBase64File(salarySlipBase64, salarySlipName || "salary_slip", `employees/${name || existing.name}/salary_slips`);
    } else if (passedSalarySlipUrl !== undefined) {
      salarySlipUrl = passedSalarySlipUrl;
    }

    // Handle relieving letter update
    let relievingLetterUrl = existing.relievingLetterUrl || "";
    if (relievingLetterBase64) {
      await deleteFileByUrl(existing.relievingLetterUrl);
      relievingLetterUrl = await uploadBase64File(relievingLetterBase64, relievingLetterName || "relieving_letter", `employees/${name || existing.name}/relieving_letters`);
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
