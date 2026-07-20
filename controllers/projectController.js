const { db } = require("../config/firebase");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const userName = (u) => u?.name || u?.email || "System";

const isManagerUser = (user) =>
  user?.department === "management" ||
  user?.permissions?.users === true ||
  user?.roleName?.toLowerCase().includes("manager") ||
  ["Founder & CEO", "Director", "Super Admin"].includes(user?.roleName);

const ISI_REQUIRED_DOCUMENTS = [
  { id: "doc_isi_1", label: "Premises document / Rent Agreement", type: "file" },
  { id: "doc_isi_2", label: "Copy of GST Registration (If Available)", type: "file" },
  { id: "doc_isi_3", label: "Copy of Partnership Deed / MOA (for Pvt. Ltd.)", type: "file" },
  { id: "doc_isi_4", label: "SSI Certificate / CA Certificate", type: "file" },
  { id: "doc_isi_5", label: "Electricity Bill", type: "file" },
  {
    id: "doc_isi_6", label: "List of Machinery", type: "table",
    columns: ["Machinery", "Make", "Capacity", "Number", "Remark"]
  },
  {
    id: "doc_isi_7", label: "List of Raw Material", type: "table",
    columns: ["Raw Material", "Name of Supplier", "With or Without BIS Certification Mark", "Test Certificate of the Supplier", "How Received Batched / Lots Nature of Package"]
  },
  {
    id: "doc_isi_8", label: "List of Testing Equipment's (With Make)", type: "table",
    columns: ["Test Equipment / Chemicals and Identification Numbers (Where Applicable)", "Laser Count & Range (Where Applicable)", "Valid Calibration (Where Required) Yes/No", "Test Used in with Clause Reference", "Remark (Indicate Number of Equipment)"]
  },
  { id: "doc_isi_9", label: "Unit of production per day, per annum and price", type: "text" },
  { id: "doc_isi_10", label: "Process Flow Chart & Detailed Production Process Description", type: "file" },
  { id: "doc_isi_11", label: "Brand Name to be covered", type: "text" },
  { id: "doc_isi_12", label: "Authorized Signatory for BIS with Designation", type: "file" },
  { id: "doc_isi_13", label: "Layout Plan", type: "file" },
  { id: "doc_isi_14", label: "Location Plan", type: "file" },
  { id: "doc_isi_15", label: "Weekly Off", type: "text" },
  { id: "doc_isi_16", label: "Appointment letter of QCI + Qualification Certificate + ID", type: "file" },
  { id: "doc_isi_17", label: "Letter Head", type: "file" },
  { id: "doc_isi_18", label: "E-mail address and permanent contact number", type: "text" },
  { id: "doc_isi_19", label: "Lab dimension and details", type: "file" },
  { id: "doc_isi_20", label: "Office & Factory Address with City, District, State, Area, PIN", type: "text" },
  { id: "doc_isi_21", label: "Calibration Certificate of testing equipment", type: "file" },
  { id: "doc_isi_22", label: "Raw material test certificate with relevant IS", type: "file" },
  { id: "doc_isi_23", label: "Factory Test Report", type: "file" },
  { id: "doc_isi_24", label: "Designation of all members of top management", type: "file" },
  { id: "doc_isi_25", label: "Correspondence Address, scale and sector", type: "text" },
];

const ISI_STAGES = [
  {
    id: "stage_bis_id",
    label: "BIS ISI ID Generate",
    steps: [{ id: "bis_id_done", label: "BIS ISI ID Generated", type: "step" }],
  },
  {
    id: "stage_test_request",
    label: "Test Request",
    steps: [
      { id: "test_sample_sent_mfr", label: "Sample sent by Manufacturer", type: "step" },
      { id: "test_sample_sent_lab", label: "Sample sent to Lab", type: "step" },
      { id: "test_report_received", label: "Test Report of Sample", type: "step" },
    ],
  },
  {
    id: "stage_application",
    label: "Application File",
    steps: [
      { id: "app_file_submitted", label: "Application File Submitted", type: "step" },
      { id: "marking_fees_paid", label: "Marking Fees Submitted", type: "step" },
    ],
  },
  {
    id: "stage_audit",
    label: "Audit",
    steps: [
      { id: "audit_query_received", label: "Query received by BIS", type: "step" },
      { id: "audit_date_granted", label: "Audit Date Granted", type: "date" },
      { id: "audit_done", label: "Audit Done", type: "step" },
    ],
  },
  {
    id: "stage_grant",
    label: "Grant of License",
    steps: [{ id: "license_granted", label: "License Granted", type: "step" }],
  },
];

const BIS_CRS_STAGES = [
  {
    id: "stage_bis_id",
    label: "BIS CRS ID Generate",
    steps: [{ id: "crs_bis_id_done", label: "BIS CRS ID Generated", type: "step" }],
  },
  {
    id: "stage_test_request",
    label: "Test Request",
    steps: [
      { id: "crs_test_sample_sent_mfr", label: "Sample sent by Manufacturer", type: "step" },
      { id: "crs_test_sample_sent_lab", label: "Sample sent to Lab", type: "step" },
      { id: "crs_test_report_received", label: "Test Report of Sample", type: "step" },
    ],
  },
  {
    id: "stage_application",
    label: "Application File",
    steps: [
      { id: "crs_app_file_submitted", label: "Application File Submitted", type: "step" },
      { id: "crs_marking_fees_paid", label: "Marking Fees Submitted", type: "step" },
    ],
  },
  {
    id: "stage_grant",
    label: "Grant of License",
    steps: [{ id: "crs_license_granted", label: "License Granted", type: "step" }],
  },
];

const HALLMARKING_STAGES = [
  {
    id: "stage_hm_id",
    label: "BIS Hallmarking ID Generate",
    steps: [{ id: "hm_id_done", label: "BIS Hallmarking ID Generated", type: "step" }],
  },
  {
    id: "stage_hm_application",
    label: "Application File",
    steps: [
      { id: "hm_app_file_submitted", label: "Application File Submitted", type: "step" },
      { id: "hm_marking_fees_paid", label: "Marking Fees Submitted", type: "step" },
    ],
  },
  {
    id: "stage_hm_audit",
    label: "Audit",
    steps: [
      { id: "hm_audit_query_received", label: "Query received by BIS", type: "step" },
      { id: "hm_audit_date_granted", label: "Audit Date Granted", type: "date" },
      { id: "hm_audit_done", label: "Audit Done", type: "step" },
    ],
  },
  {
    id: "stage_hm_grant",
    label: "Grant of License",
    steps: [{ id: "hm_license_granted", label: "Hallmarking License Granted", type: "step" }],
  },
];

const HALLMARKING_REQUIRED_DOCUMENTS = [
  { id: "doc_hm_1",  label: "GST", type: "file", description: "GST registration certificate of the center/business. Required for identity and tax compliance verification by BIS.", uploadedBy: "Client side" },
  { id: "doc_hm_2",  label: "Proof of Identity of Signatory (Aadhar Card of Owner)", type: "file", description: "Aadhar card of the business owner or authorized signatory. Used as official identity proof for BIS registration.", uploadedBy: "Client side" },
  { id: "doc_hm_3",  label: "XRF Detection Letter", type: "file", description: "Official letter confirming the presence and working condition of the XRF (X-Ray Fluorescence) machine at the center.", uploadedBy: "Client side" },
  { id: "doc_hm_4",  label: "CRM (Certified Reference Material)", type: "file", description: "Certificate or record of Certified Reference Material used for XRF machine calibration and accuracy verification.", uploadedBy: "Client side or both side" },
  { id: "doc_hm_5",  label: "SRM (Standard Reference Material)", type: "file", description: "Certificate or record of Standard Reference Material used alongside CRM for quality assurance of testing equipment.", uploadedBy: "Client side or both side" },
  { id: "doc_hm_6",  label: "XRF Calibration Certificate", type: "file", description: "Valid calibration certificate from an accredited lab for the XRF machine installed at the hallmarking center.", uploadedBy: "Client side" },
  { id: "doc_hm_7",  label: "Rent Agreement / CA Certificate", type: "file", description: "Premises document — either a registered rent agreement or a CA certificate confirming the center address.", uploadedBy: "Client side" },
  { id: "doc_hm_8",  label: "Logo of Center", type: "file", description: "Official logo/trademark of the hallmarking center, required for BIS registration and license display.", uploadedBy: "Both side" },
  { id: "doc_hm_9",  label: "Layout Plan", type: "file", description: "Scaled layout/floor plan of the hallmarking center showing equipment placement, work areas, and dimensions.", uploadedBy: "My side" },
  { id: "doc_hm_10", label: "Form V, Agreement between BIS and Center, Indemnity Bond", type: "file", description: "Three documents on stamp paper: Form V (application), BIS-Center agreement, and indemnity bond — all duly signed and stamped by the client.", uploadedBy: "Three stamp paper — Client side" },
  { id: "doc_hm_11", label: "ILC (Inter-Laboratory Comparison)", type: "file", description: "Inter-Laboratory Comparison report demonstrating the center's testing accuracy against a reference lab as mandated by BIS.", uploadedBy: "My side" },
  { id: "doc_hm_12", label: "Insurance", type: "file", description: "Insurance policy document covering the hallmarking center premises and equipment as required by BIS norms.", uploadedBy: "Both side" },
  { id: "doc_hm_13", label: "Location Plan", type: "file", description: "Map/location plan showing the geographic location of the hallmarking center relative to nearby landmarks.", uploadedBy: "My side" },
  { id: "doc_hm_14", label: "Quality Manual", type: "file", description: "Documented quality manual outlining the standard operating procedures, quality objectives, and processes of the center.", uploadedBy: "My side" },
  { id: "doc_hm_15", label: "List of Employees + Aadhaar Card + Degree of Assaying Master", type: "file", description: "Employee list with Aadhaar cards and professional degree certificate of the designated Assaying & Hallmarking Master.", uploadedBy: "Client side" },
  { id: "doc_hm_16", label: "Pollution Certificate", type: "file", description: "Valid pollution/NOC certificate from the appropriate state pollution control board for the center's operations.", uploadedBy: "Both side" },
  { id: "doc_hm_17", label: "List of Equipment", type: "file", description: "Detailed list of all equipment at the center including make, model, and serial numbers (XRF, laser, micro-balance, etc.).", uploadedBy: "My side" },
  { id: "doc_hm_18", label: "Electric Meter No.", type: "text", description: "Electricity connection meter number of the hallmarking center premises for address and utility verification.", placeholder: "Enter electric meter number...", uploadedBy: "Client side" },
  { id: "doc_hm_19", label: "Area of Center (in sq. ft.)", type: "text", description: "Total area of the hallmarking center in square feet, required to verify minimum space compliance as per BIS norms.", placeholder: "e.g. 500 sq. ft.", uploadedBy: "Client side" },
  { id: "doc_hm_20", label: "Authorized Signatory Aadhar Card", type: "file", description: "Aadhar card of the person authorized to sign BIS-related documents on behalf of the center.", uploadedBy: "Client side" },
  { id: "doc_hm_21", label: "Current Location (Geo-tagged Photo)", type: "file", description: "Geo-tagged photograph or Google Maps screenshot showing the current physical location of the hallmarking center.", uploadedBy: "Client side" },
  { id: "doc_hm_22", label: "Calibration Certificate (All Equipment)", type: "file", description: "Valid calibration certificates for all testing and weighing equipment at the center (micro-balance, weights, etc.).", uploadedBy: "Both side" },
  { id: "doc_hm_23", label: "Integration of XRF Machine, Laser Machine, Micro Balance", type: "file", description: "Integration report confirming that the XRF machine, laser marking machine, and micro-balance are properly set up and operational.", uploadedBy: "Client side" },
  { id: "doc_hm_24", label: "Pollution Certificate with Hazardous Agreement", type: "file", description: "Pollution certificate combined with a hazardous waste disposal agreement for centers handling chemical/acid processes.", uploadedBy: "Client side" },
  { id: "doc_hm_25", label: "PT (Proficiency Testing)", type: "file", description: "Proficiency Testing report from an accredited provider demonstrating the center's competency in gold assaying.", uploadedBy: "Both side" },
  { id: "doc_hm_26", label: "Security Guard", type: "file", description: "Agreement or appointment letter from a licensed security agency for deployment of a security guard at the hallmarking center.", uploadedBy: "Client side" },
];

const PROJECT_CHECKLISTS = {
  fmcs: [
    { id: "fmcs_1", label: "Government document addressing factory" },
    { id: "fmcs_2", label: "Authorization letter for BIS Signatory" },
    { id: "fmcs_3", label: "Authorization letter for Indian representative with Aadhar Card" },
    { id: "fmcs_4", label: "List of machinery" },
    { id: "fmcs_5", label: "List of testing equipment" },
    { id: "fmcs_6", label: "List of raw material" },
    { id: "fmcs_7", label: "Process flow chart" },
    { id: "fmcs_8", label: "Layout plan" },
    { id: "fmcs_9", label: "Location Plan" },
    { id: "fmcs_10", label: "Appointment letter of Quality in charge" },
    { id: "fmcs_11", label: "Payment receipt in USD (except Nepal country)" },
    { id: "fmcs_12", label: "Raw material certificate" },
    { id: "fmcs_13", label: "Factory test report" },
    { id: "fmcs_14", label: "English translator person present at the time of audit" },
    { id: "fmcs_15", label: "Nomination" },
    { id: "fmcs_16", label: "Agreement" },
    { id: "fmcs_17", label: "Letter head of company" },
  ],
  hallmarking: [
    { id: "hm_1", label: "GST" },
    { id: "hm_2", label: "Proof of identity of signatory (Aadhar card of Owner)" },
    { id: "hm_3", label: "XRF detection Letter" },
    { id: "hm_4", label: "CRM" },
    { id: "hm_5", label: "SRM" },
    { id: "hm_6", label: "XRF calibration certificate" },
    { id: "hm_7", label: "Rent agreement / CA certificate" },
    { id: "hm_8", label: "Logo of center" },
    { id: "hm_9", label: "Layout plan" },
    { id: "hm_10", label: "Form V, agreement between BIS and Center, indemnity bond" },
    { id: "hm_11", label: "ILC" },
    { id: "hm_12", label: "Insurance" },
    { id: "hm_13", label: "Location Plan" },
    { id: "hm_14", label: "Quality manual" },
    { id: "hm_15", label: "List of employees + Aadhaar card + degree of assaying master" },
    { id: "hm_16", label: "Pollution certificate" },
    { id: "hm_17", label: "List of equipment" },
    { id: "hm_18", label: "Electric meter no" },
    { id: "hm_19", label: "Area of center" },
    { id: "hm_20", label: "Authorize signatory Aadhar card" },
    { id: "hm_21", label: "Current location" },
    { id: "hm_22", label: "Calibration certificate" },
    { id: "hm_23", label: "Integration of XRF Machine, Laser Machine, Micro balance" },
    { id: "hm_24", label: "Pollution certificate with hazardous agreement" },
    { id: "hm_25", label: "PT" },
    { id: "hm_26", label: "Security Guard" },
  ],
  bis_crs: [
    { id: "crs_1", label: "Company Email", section: "ID Creation" },
    { id: "crs_2", label: "Domain (For Foreign manufacturer)", section: "ID Creation" },
    { id: "crs_3", label: "GST / MSME", section: "ID Creation" },
    { id: "crs_4", label: "ISO certificate with product specification", section: "ID Creation" },
    { id: "crs_5", label: "Business License", section: "ID Creation" },
    { id: "crs_6", label: "Trademark License", section: "ID Creation" },
    { id: "crs_7", label: "Company representative name, Contact no., Email ID, Govt. ID proof", section: "ID Creation" },
    { id: "crs_8", label: "Trademark (Brand Logo)", section: "Registration" },
    { id: "crs_9", label: "Product specification including Model name", section: "Registration" },
    { id: "crs_10", label: "Registration certificate (For registered brands)", section: "Registration" },
    { id: "crs_11", label: "Authorization letter/agreement from brand owner (If owned by others)", section: "Registration" },
    { id: "crs_12", label: "Copy of TM application (For un-registered brands, if applied for)", section: "Registration" },
    { id: "crs_13", label: "Authorization letter/agreement from proprietor (un-registered, if owned by others)", section: "Registration" },
    { id: "crs_14", label: "Nomination Form sealed and signed", section: "AIR & Affidavit" },
    { id: "crs_15", label: "Authorized Indian representative Govt. ID proof, Contact No., Email ID", section: "AIR & Affidavit" },
  ],
};

const BIS_CRS_REQUIRED_DOCUMENTS = [
  { id: "doc_crs_1", label: "Company Email", section: "ID Creation" },
  { id: "doc_crs_2", label: "Domain (For Foreign manufacturer)", section: "ID Creation" },
  { id: "doc_crs_3", label: "GST / MSME", section: "ID Creation" },
  { id: "doc_crs_4", label: "ISO certificate with product specification", section: "ID Creation" },
  { id: "doc_crs_5", label: "Business License", section: "ID Creation" },
  { id: "doc_crs_6", label: "Trademark License", section: "ID Creation" },
  { id: "doc_crs_7", label: "Company representative name, Contact no., Email ID, Govt. ID proof", section: "ID Creation" },
  { id: "doc_crs_8", label: "Trademark (Brand Logo)", section: "Registration" },
  { id: "doc_crs_9", label: "Product specification including Model name", section: "Registration" },
  { id: "doc_crs_10", label: "Registration certificate (For registered brands)", section: "Registration" },
  { id: "doc_crs_11", label: "Authorization letter/agreement from brand owner (If owned by others)", section: "Registration" },
  { id: "doc_crs_12", label: "Copy of TM application (For un-registered brands, if applied for)", section: "Registration" },
  { id: "doc_crs_13", label: "Authorization letter/agreement from proprietor (un-registered, if owned by others)", section: "Registration" },
  { id: "doc_crs_14", label: "Nomination Form sealed and signed", section: "AIR & Affidavit" },
  { id: "doc_crs_15", label: "Authorized Indian representative Govt. ID proof, Contact No., Email ID", section: "AIR & Affidavit" },
];

const getNextProjectId = async () => {
  const ref = db.collection("counters").doc("projects");
  return await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) next = (doc.data().last || 0) + 1;
    t.set(ref, { last: next }, { merge: true });
    return "PRJ" + String(next).padStart(3, "0");
  });
};

const serializeProject = (id, data) => ({
  id,
  ...data,
  createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
  updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
  dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate || null,
  // For ISI/CRS: stages stored as isiStages
  checklist: (data.checklist || []).map((item) => ({
    ...item,
    doneAt: item.doneAt?.toDate?.()?.toISOString() || item.doneAt || null,
  })),
  isiStages: (data.isiStages || []).map((stage) => ({
    ...stage,
    steps: (stage.steps || []).map((step) => ({
      ...step,
      doneAt: step.doneAt?.toDate?.()?.toISOString() || step.doneAt || null,
    })),
  })),
});

const canAccessProject = (user, projectData) => {
  if (isManagerUser(user)) return true;
  const assigned = projectData.assignedTo || [];
  return Array.isArray(assigned)
    ? assigned.includes(user.id)
    : assigned === user.id;
};

// Build initial ISI/CRS stages from config
const buildIsiStages = () =>
  ISI_STAGES.map((stage) => ({
    ...stage,
    steps: stage.steps.map((step) => ({
      ...step,
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
      dateValue: null,
    })),
  }));

const buildBisCrsStages = () =>
  BIS_CRS_STAGES.map((stage) => ({
    ...stage,
    steps: stage.steps.map((step) => ({
      ...step,
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
      dateValue: null,
    })),
  }));

// Build initial ISI/CRS required documents
const buildIsiDocSlots = () =>
  ISI_REQUIRED_DOCUMENTS.map((doc) => ({
    ...doc,
    file: null,
  }));

const buildBisCrsDocSlots = () =>
  BIS_CRS_REQUIRED_DOCUMENTS.map((doc) => ({
    ...doc,
    file: null,
  }));

const buildHallmarkingStages = () =>
  HALLMARKING_STAGES.map((stage) => ({
    ...stage,
    steps: stage.steps.map((step) => ({
      ...step,
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
      dateValue: null,
    })),
  }));

const buildHallmarkingDocSlots = () =>
  HALLMARKING_REQUIRED_DOCUMENTS.map((doc) => ({
    ...doc,
    file: null,
    value: doc.type !== "file" ? "" : undefined,
  }));

exports.getProjects = asyncHandler(async (req, res) => {
  const { serviceType, status, search, page = 1, pageSize = 20 } = req.query;
  const isManager = isManagerUser(req.user);

  const snap = await db.collection("projects").get();
  let projects = snap.docs
    .map((d) => serializeProject(d.id, d.data()))
    .filter((p) => p.isDeleted !== true);

  if (!isManager) {
    projects = projects.filter((p) => canAccessProject(req.user, p));
  }

  if (serviceType) projects = projects.filter((p) => p.serviceType === serviceType);
  if (status) projects = projects.filter((p) => p.status === status);
  if (search) {
    const q = search.toLowerCase();
    projects = projects.filter((p) =>
      p.projectName?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  }

  projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const total = projects.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const paginated = projects.slice(start, start + parseInt(pageSize));

  res.json({ projects: paginated, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

exports.getProjectStats = asyncHandler(async (req, res) => {
  const isManager = isManagerUser(req.user);
  const snap = await db.collection("projects").get();
  let projects = snap.docs.map((d) => d.data()).filter((p) => p.isDeleted !== true);

  if (!isManager) {
    projects = projects.filter((p) => canAccessProject(req.user, p));
  }

  const now = new Date();
  let total = 0, active = 0, completed = 0, overdue = 0;
  const byType = { isi: 0, fmcs: 0, hallmarking: 0, bis_crs: 0 };

  projects.forEach((p) => {
    total++;
    if (p.serviceType && byType[p.serviceType] !== undefined) byType[p.serviceType]++;
    if (p.status === "completed") completed++;
    else active++;
    const due = p.dueDate?.toDate ? p.dueDate.toDate() : (p.dueDate ? new Date(p.dueDate) : null);
    if (due && due < now && p.status !== "completed") overdue++;
  });

  res.json({ total, active, completed, overdue, byType, isManager });
});

exports.getProjectById = asyncHandler(async (req, res) => {
  const docRef = db.collection("projects").doc(req.params.id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  let data = doc.data();
  if (!canAccessProject(req.user, data)) throw new ApiError(403, "Access denied");

  if (data.serviceType === "isi") {
    const migrations = {};
    if (!data.isiStages || data.isiStages.length === 0) migrations.isiStages = buildIsiStages();
    if (!data.isiDocSlots || data.isiDocSlots.length === 0) {
      const oldChecklist = (data.checklist || []).filter(i => i.id?.startsWith("isi_"));
      if (oldChecklist.length > 0) {
        migrations.isiDocSlots = ISI_REQUIRED_DOCUMENTS.map((docDef, idx) => {
          const old = oldChecklist[idx];
          return { ...docDef, file: null, prevDone: old?.done || false };
        });
      } else {
        migrations.isiDocSlots = buildIsiDocSlots();
      }
    } else {
      // Patch existing slots: add type/columns if missing (migration for new field types)
      const needsPatch = data.isiDocSlots.some(s => !s.type);
      if (needsPatch) {
        migrations.isiDocSlots = data.isiDocSlots.map(slot => {
          const def = ISI_REQUIRED_DOCUMENTS.find(d => d.id === slot.id);
          if (!def || slot.type) return slot; // already typed
          const patched = { ...slot, type: def.type || "file" };
          if (def.columns) patched.columns = def.columns;
          if (def.label) patched.label = def.label; // update label too (e.g. 6,7,8)
          return patched;
        });
      }
    }
    if (Object.keys(migrations).length > 0) {
      migrations.updatedAt = new Date();
      await docRef.update(migrations);
      data = { ...data, ...migrations };
    }
  }

  // ── Auto-migrate old BIS CRS projects to new stage-based structure ────────────
  if (data.serviceType === "bis_crs") {
    const migrations = {};
    if (!data.isiStages || data.isiStages.length === 0) migrations.isiStages = buildBisCrsStages();
    if (!data.isiDocSlots || data.isiDocSlots.length === 0) {
      const oldChecklist = (data.checklist || []).filter(i => i.id?.startsWith("crs_"));
      if (oldChecklist.length > 0) {
        migrations.isiDocSlots = BIS_CRS_REQUIRED_DOCUMENTS.map((docDef, idx) => {
          const old = oldChecklist[idx];
          return { ...docDef, file: null, prevDone: old?.done || false };
        });
      } else {
        migrations.isiDocSlots = buildBisCrsDocSlots();
      }
    }
    if (Object.keys(migrations).length > 0) {
      migrations.updatedAt = new Date();
      await docRef.update(migrations);
      data = { ...data, ...migrations };
    }
  }

  // ── Auto-migrate old Hallmarking projects to new stage-based structure ────────
  if (data.serviceType === "hallmarking") {
    const migrations = {};
    if (!data.isiStages || data.isiStages.length === 0) migrations.isiStages = buildHallmarkingStages();
    if (!data.isiDocSlots || data.isiDocSlots.length === 0) {
      const oldChecklist = (data.checklist || []).filter(i => i.id?.startsWith("hm_"));
      if (oldChecklist.length > 0) {
        migrations.isiDocSlots = HALLMARKING_REQUIRED_DOCUMENTS.map((docDef, idx) => {
          const old = oldChecklist[idx];
          return { ...docDef, file: null, prevDone: old?.done || false };
        });
      } else {
        migrations.isiDocSlots = buildHallmarkingDocSlots();
      }
    }
    if (Object.keys(migrations).length > 0) {
      migrations.updatedAt = new Date();
      await docRef.update(migrations);
      data = { ...data, ...migrations };
    }
  }

  const actSnap = await db
    .collection("projects").doc(req.params.id)
    .collection("activity")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const activity = actSnap.docs.map((a) => {
    const ad = a.data();
    return { id: a.id, ...ad, createdAt: ad.createdAt?.toDate?.()?.toISOString() || null };
  });

  res.json({ ...serializeProject(doc.id, data), activity });
});

// ─── GET /api/projects/:id/activity?page=1&pageSize=10 ───
exports.getProjectActivity = asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;
  const doc = await db.collection("projects").doc(req.params.id).get();
  if (!doc.exists) throw new ApiError(404, "Project not found");
  if (!canAccessProject(req.user, doc.data())) throw new ApiError(403, "Access denied");

  const snap = await db
    .collection("projects").doc(req.params.id)
    .collection("activity")
    .orderBy("createdAt", "desc")
    .get();

  const all = snap.docs.map((a) => {
    const ad = a.data();
    return { id: a.id, ...ad, createdAt: ad.createdAt?.toDate?.()?.toISOString() || null };
  });

  const total = all.length;
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const items = all.slice(start, start + parseInt(pageSize));

  res.json({ activity: items, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

// ─── POST /api/projects ─
exports.createProject = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) throw new ApiError(403, "Managers only");

  const { projectName, clientName, serviceType, assignedTo, assignedToNames, dueDate, notes } = req.body;
  if (!projectName || !clientName || !serviceType) {
    throw new ApiError(400, "projectName, clientName, serviceType required");
  }

  const projectId = await getNextProjectId();
  const assignedArr = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);
  const assignedNamesArr = Array.isArray(assignedToNames) ? assignedToNames : (assignedToNames ? [assignedToNames] : []);

  // ISI, BIS CRS, and Hallmarking use isiStages + isiDocSlots instead of a flat checklist
  const isIsi = serviceType === "isi";
  const isBisCrs = serviceType === "bis_crs";
  const isHallmarking = serviceType === "hallmarking";
  const usesStages = isIsi || isBisCrs || isHallmarking;
  const data = {
    projectId,
    projectName,
    clientName,
    serviceType,
    status: assignedArr.length > 0 ? "in_progress" : "pending",
    assignedTo: assignedArr,
    assignedToNames: assignedNamesArr,
    assignedBy: req.user.id,
    assignedByName: userName(req.user),
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes || "",
    // ISI / BIS CRS / Hallmarking specific
    isiStages: isIsi ? buildIsiStages() : isBisCrs ? buildBisCrsStages() : isHallmarking ? buildHallmarkingStages() : [],
    isiDocSlots: isIsi ? buildIsiDocSlots() : isBisCrs ? buildBisCrsDocSlots() : isHallmarking ? buildHallmarkingDocSlots() : [],
    // Other service types
    checklist: usesStages ? [] : (PROJECT_CHECKLISTS[serviceType] || []).map((item) => ({
      ...item,
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
    })),
    documents: [],
    createdBy: req.user.id,
    createdByName: userName(req.user),
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
  };

  await db.collection("projects").doc(projectId).set(data);

  const batch = db.batch();
  const actRef = db.collection("projects").doc(projectId).collection("activity");
  batch.set(actRef.doc(), {
    type: "created",
    message: `Project created by ${userName(req.user)}`,
    performedBy: req.user.id, performedByName: userName(req.user),
    createdAt: new Date(),
  });
  if (assignedArr.length > 0) {
    batch.set(actRef.doc(), {
      type: "assigned",
      message: `Project assigned to: ${assignedNamesArr.join(", ")}`,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }
  await batch.commit();

  res.status(201).json({ id: projectId, ...serializeProject(projectId, data) });
});

// ─── PUT /api/projects/:id ─
exports.updateProject = asyncHandler(async (req, res) => {
  const doc = await db.collection("projects").doc(req.params.id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const prev = doc.data();
  if (!canAccessProject(req.user, prev)) throw new ApiError(403, "Access denied");

  const isManager = isManagerUser(req.user);
  const updates = { updatedAt: new Date() };
  const activityLogs = [];

  if (isManager) {
    ["projectName", "clientName", "serviceType", "notes"].forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (req.body.dueDate !== undefined) {
      updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    if (req.body.assignedTo !== undefined) {
      const newAssigned = Array.isArray(req.body.assignedTo) ? req.body.assignedTo : [req.body.assignedTo];
      const newNames = Array.isArray(req.body.assignedToNames) ? req.body.assignedToNames : [req.body.assignedToNames || ""];
      updates.assignedTo = newAssigned;
      updates.assignedToNames = newNames;
      updates.assignedBy = req.user.id;
      updates.assignedByName = userName(req.user);
      activityLogs.push({
        type: "assigned",
        message: `Project reassigned to: ${newNames.join(", ")}`,
        performedBy: req.user.id, performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }
  }

  if (req.body.status !== undefined && req.body.status !== prev.status) {
    updates.status = req.body.status;
    activityLogs.push({
      type: "status_changed",
      message: `Status changed from "${prev.status}" to "${req.body.status}"`,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }

  if (req.body.comment) {
    activityLogs.push({
      type: "comment",
      message: req.body.comment,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }

  if (req.body.documents !== undefined) updates.documents = req.body.documents;
  if (req.body.isiDocSlots !== undefined) updates.isiDocSlots = req.body.isiDocSlots;

  await db.collection("projects").doc(req.params.id).update(updates);

  if (activityLogs.length > 0) {
    const batch = db.batch();
    activityLogs.forEach((log) => {
      batch.set(db.collection("projects").doc(req.params.id).collection("activity").doc(), log);
    });
    await batch.commit();
  }

  res.json({ message: "Project updated successfully" });
});

// ─── PUT /api/projects/:id/checklist/:itemId  (non-ISI flat checklist toggle) ──
exports.toggleChecklistItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const doc = await db.collection("projects").doc(id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const data = doc.data();
  if (!canAccessProject(req.user, data)) throw new ApiError(403, "Access denied");

  const checklist = data.checklist || [];
  const idx = checklist.findIndex((item) => item.id === itemId);
  if (idx === -1) throw new ApiError(404, "Checklist item not found");

  const current = checklist[idx];
  const nowDone = !current.done;
  checklist[idx] = {
    ...current,
    done: nowDone,
    doneBy: nowDone ? req.user.id : null,
    doneByName: nowDone ? userName(req.user) : null,
    doneAt: nowDone ? new Date() : null,
  };

  await db.collection("projects").doc(id).update({ checklist, updatedAt: new Date() });
  await db.collection("projects").doc(id).collection("activity").add({
    type: "checklist",
    message: `"${current.label}" marked as ${nowDone ? "done" : "undone"} by ${userName(req.user)}`,
    performedBy: req.user.id, performedByName: userName(req.user),
    createdAt: new Date(),
  });

  res.json({ message: "Checklist updated", done: nowDone });
});

// ─── PUT /api/projects/:id/stage/:stepId  (ISI stage step toggle + optional date + remark) ──
exports.toggleIsiStep = asyncHandler(async (req, res) => {
  const { id, stepId } = req.params;
  const { dateValue, remark } = req.body; // optional

  const doc = await db.collection("projects").doc(id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const data = doc.data();
  if (!canAccessProject(req.user, data)) throw new ApiError(403, "Access denied");

  const isiStages = data.isiStages || [];
  let found = false;
  let stepLabel = "";
  let nowDone = false;

  for (const stage of isiStages) {
    for (const step of stage.steps) {
      if (step.id === stepId) {
        found = true;
        stepLabel = step.label;
        nowDone = !step.done;
        step.done = nowDone;
        step.doneBy = nowDone ? req.user.id : null;
        step.doneByName = nowDone ? userName(req.user) : null;
        step.doneAt = nowDone ? new Date() : null;
        if (step.type === "date" && dateValue !== undefined) {
          step.dateValue = dateValue || null;
        }
        break;
      }
    }
    if (found) break;
  }

  if (!found) throw new ApiError(404, "Stage step not found");

  // Auto-complete project if all ISI stages are done
  const allDone = isiStages.every((stage) => stage.steps.every((step) => step.done));
  const updatesObj = { isiStages, updatedAt: new Date() };
  if (allDone) updatesObj.status = "completed";

  await db.collection("projects").doc(id).update(updatesObj);

  const activityLogs = [];
  activityLogs.push({
    type: "stage",
    stepId,
    message: `"${stepLabel}" marked as ${nowDone ? "done" : "undone"} by ${userName(req.user)}`,
    performedBy: req.user.id, performedByName: userName(req.user),
    createdAt: new Date(),
  });
  if (remark) {
    activityLogs.push({
      type: "remark",
      stepId,
      stepLabel,
      message: remark,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }
  if (allDone) {
    activityLogs.push({
      type: "status_changed",
      message: `All stages completed. Project marked as Completed.`,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }

  const batch = db.batch();
  activityLogs.forEach((log) => {
    batch.set(db.collection("projects").doc(id).collection("activity").doc(), log);
  });
  await batch.commit();

  res.json({ message: "Stage updated", done: nowDone, allDone });
});

// ─── POST /api/projects/:id/remark  (add standalone remark to a step or project) ──
exports.addRemark = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message, stepId, stepLabel } = req.body;

  if (!message || !message.trim()) throw new ApiError(400, "message is required");

  const doc = await db.collection("projects").doc(id).get();
  if (!doc.exists) throw new ApiError(404, "Project not found");
  if (!canAccessProject(req.user, doc.data())) throw new ApiError(403, "Access denied");

  const ref = await db.collection("projects").doc(id).collection("activity").add({
    type: "remark",
    stepId: stepId || null,
    stepLabel: stepLabel || null,
    message: message.trim(),
    performedBy: req.user.id,
    performedByName: userName(req.user),
    createdAt: new Date(),
  });

  res.status(201).json({ id: ref.id, message: "Remark added" });
});

// ─── DELETE /api/projects/:id ─
exports.deleteProject = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) throw new ApiError(403, "Managers only");
  const doc = await db.collection("projects").doc(req.params.id).get();
  if (!doc.exists) throw new ApiError(404, "Project not found");
  await db.collection("projects").doc(req.params.id).update({ isDeleted: true, updatedAt: new Date() });
  res.json({ message: "Project deleted" });
});
