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
  { id: "doc_isi_6", label: "List of Machinery", type: "file" },
  { id: "doc_isi_7", label: "List of Raw Material", type: "file" },
  { id: "doc_isi_8", label: "List of Testing Equipment's (With Make)", type: "file" },
  { id: "doc_isi_9", label: "Unit of production per day, per annum and price", type: "file" },
  { id: "doc_isi_10", label: "Process Flow Chart & Detailed Production Process Description", type: "file" },
  { id: "doc_isi_11", label: "Brand Name to be covered", type: "file" },
  { id: "doc_isi_12", label: "Authorized Signatory for BIS with Designation", type: "file" },
  { id: "doc_isi_13", label: "Layout Plan", type: "file" },
  { id: "doc_isi_14", label: "Location Plan", type: "file" },
  { id: "doc_isi_15", label: "Weekly Off", type: "file" },
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
  { id: "doc_isi_26", label: "Brand Name Declaration (ANNEX G – CM/PF307)", type: "file" },
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
  { id: "doc_hm_1",  label: "GST", type: "file", section: "General Documents" },
  { id: "doc_hm_2",  label: "Proof of Identity of Signatory (Aadhar Card of Owner)", type: "file", section: "General Documents" },
  { id: "doc_hm_3",  label: "XRF Detection Letter", type: "file", section: "General Documents" },
  { id: "doc_hm_7",  label: "Rent Agreement / CA Certificate", type: "file", section: "General Documents" },
  { id: "doc_hm_8",  label: "Logo of Center", type: "file", section: "General Documents" },
  { id: "doc_hm_9",  label: "Layout Plan", type: "file", section: "General Documents" },
  { id: "doc_hm_10", label: "Form V, Agreement between BIS and Center, Indemnity Bond", type: "file", section: "General Documents" },
  { id: "doc_hm_11", label: "ILC (Inter-Laboratory Comparison)", type: "file", section: "General Documents" },
  { id: "doc_hm_12", label: "Insurance", type: "file", section: "Insurance & PT", requiresValidity: true },
  { id: "doc_hm_13", label: "Location Plan", type: "file", section: "General Documents" },
  { id: "doc_hm_14", label: "Quality Manual", type: "file", section: "General Documents" },
  { id: "doc_hm_15", label: "List of Employees + Aadhaar Card + Degree of Assaying Master", type: "file", section: "General Documents" },
  { id: "doc_hm_16", label: "Pollution Certificate", type: "file", section: "General Documents" },
  { id: "doc_hm_17", label: "List of Equipment", type: "file", section: "General Documents" },
  { id: "doc_hm_18", label: "Electric Meter No.", type: "text", section: "General Documents" },
  { id: "doc_hm_19", label: "Area of Center (in sq. ft.)", type: "text", section: "General Documents" },
  { id: "doc_hm_20", label: "Authorized Signatory Aadhar Card", type: "file", section: "General Documents" },
  { id: "doc_hm_21", label: "Current Location (Geo-tagged Photo)", type: "file", section: "General Documents" },
  { id: "doc_hm_23", label: "Integration of XRF Machine, Laser Machine, Micro Balance", type: "file", section: "General Documents" },
  { id: "doc_hm_24", label: "Pollution Certificate with Hazardous Agreement", type: "file", section: "General Documents" },
  { id: "doc_hm_25", label: "PT (Proficiency Testing)", type: "file", section: "General Documents" },
  { id: "doc_hm_26", label: "Security Guard", type: "file", section: "General Documents" },
  { id: "hm_crm_gold", label: "CRM Gold", type: "file", section: "CRM Documents" },
  { id: "hm_crm_silver", label: "CRM Silver", type: "file", section: "CRM Documents" },
  { id: "hm_crm_copper", label: "CRM Copper", type: "file", section: "CRM Documents" },
  { id: "hm_crm_lead", label: "CRM Lead", type: "file", section: "CRM Documents" },
  { id: "hm_srm_g_995", label: "SRM Gold 995", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_958", label: "SRM Gold 958", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_916", label: "SRM Gold 916", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_833", label: "SRM Gold 833", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_750", label: "SRM Gold 750", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_585", label: "SRM Gold 585", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_g_375", label: "SRM Gold 375", type: "file", section: "SRM Documents (Gold)" },
  { id: "hm_srm_s_970", label: "SRM Silver 970", type: "file", section: "SRM Documents (Silver)" },
  { id: "hm_srm_s_925", label: "SRM Silver 925", type: "file", section: "SRM Documents (Silver)" },
  { id: "hm_srm_s_900", label: "SRM Silver 900", type: "file", section: "SRM Documents (Silver)" },
  { id: "hm_srm_s_835", label: "SRM Silver 835", type: "file", section: "SRM Documents (Silver)" },
  { id: "hm_srm_s_800", label: "SRM Silver 800", type: "file", section: "SRM Documents (Silver)" },
  { id: "hm_pt_gold", label: "PT Gold", type: "file", section: "Insurance & PT", requiresValidity: true },
  { id: "hm_pt_silver", label: "PT Silver", type: "file", section: "Insurance & PT", requiresValidity: true }
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

const SERVICE_ID_PREFIX = {
  isi: "ISI",
  hallmarking: "HMC",
  bis_crs: "CRS",
  fmcs: "FMCS",
};

const getNextProjectId = async (serviceType) => {
  const prefix = SERVICE_ID_PREFIX[serviceType] || "PRJ";
  const counterKey = serviceType || "projects";
  const ref = db.collection("counters").doc(counterKey);
  return await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    let next = 1;
    if (doc.exists) next = (doc.data().last || 0) + 1;
    t.set(ref, { last: next }, { merge: true });
    return prefix + String(next).padStart(3, "0");
  });
};

const serializeProject = (id, data) => ({
  id,
  ...data,
  createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
  updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || null,
  dueDate: data.dueDate?.toDate?.()?.toISOString() || data.dueDate || null,
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
  isCodes: (data.isCodes || []).map((codeObj) => ({
    ...codeObj,
    stages: (codeObj.stages || []).map((stage) => ({
      ...stage,
      steps: (stage.steps || []).map((step) => ({
        ...step,
        doneAt: step.doneAt?.toDate?.()?.toISOString() || step.doneAt || null,
      })),
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
    value: doc.type !== "file" ? "" : null,
  }));

const buildFmcsStages = () => [
  {
    id: "stage_fmcs_process",
    label: "FMCS Process",
    steps: (PROJECT_CHECKLISTS.fmcs || []).map((item) => ({
      id: item.id,
      label: item.label,
      type: "step",
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
      dateValue: null,
    })),
  },
];

const FMCS_DOC_SLOTS = [
  // Standard FMCS Checklist Documents
  { id: "fmcs_doc_1",  label: "Government document addressing factory", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_2",  label: "Authorization letter for BIS Signatory", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_3",  label: "Authorization letter for Indian representative with Aadhar Card", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_4",  label: "List of machinery", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_5",  label: "List of testing equipment", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_6",  label: "List of raw material", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_7",  label: "Process flow chart", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_8",  label: "Layout plan", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_9",  label: "Location Plan", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_10", label: "Appointment letter of Quality in charge", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_11", label: "Payment receipt in USD (except Nepal country)", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_12", label: "Raw material certificate", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_13", label: "Factory test report", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_14", label: "English translator person present at the time of audit", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_15", label: "Nomination", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_16", label: "Agreement", type: "file", section: "FMCS Documents" },
  { id: "fmcs_doc_17", label: "Letter head of company", type: "file", section: "FMCS Documents" },
  // AIR (Authorized Indian Representative) Details
  { id: "fmcs_air_1",  label: "AIR Full Name (Authorized Indian Representative)", type: "text", section: "AIR Details", placeholder: "Enter AIR full name..." },
  { id: "fmcs_air_2",  label: "AIR Aadhar Card", type: "file", section: "AIR Details" },
  { id: "fmcs_air_3",  label: "AIR Qualification Certificate", type: "file", section: "AIR Details" },
  { id: "fmcs_air_4",  label: "AIR Agreement signed with BIS", type: "file", section: "AIR Details" },
  // BIS Bank Guarantee
  { id: "fmcs_bg_1",   label: "BIS Bank Guarantee Document", type: "file", section: "BIS Bank Guarantee" },
];

const buildFmcsDocSlots = () =>
  FMCS_DOC_SLOTS.map((doc) => ({
    ...doc,
    file: null,
    value: doc.type !== "file" ? "" : null,
  }));

exports.getProjects = asyncHandler(async (req, res) => {
  const { serviceType, status, search, page = 1, pageSize = 20 } = req.query;
  const isManager = isManagerUser(req.user);
  
  const start = (parseInt(page) - 1) * parseInt(pageSize);
  const lim = parseInt(pageSize);

  let baseQuery = db.collection("projects").where("isDeleted", "!=", true);



  // Fallback to in-memory processing for search or complex access rights. Limit to 1000 to prevent OOM
  const snap = await baseQuery.limit(1000).get();
  let projects = snap.docs.map((d) => serializeProject(d.id, d.data()));

  if (!isManager) {
    projects = projects.filter((p) => canAccessProject(req.user, p));
  }

  if (search) {
    const q = search.toLowerCase();
    projects = projects.filter((p) =>
      p.projectName?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  }

  if (serviceType) {
    projects = projects.filter((p) => p.serviceType === serviceType);
  }
  
  if (status) {
    projects = projects.filter((p) => p.status === status);
  }

  projects.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const total = projects.length;
  const paginated = projects.slice(start, start + lim);

  res.json({ projects: paginated, total, page: parseInt(page), pageSize: lim });
});

exports.getProjectStats = asyncHandler(async (req, res) => {
  const isManager = isManagerUser(req.user);
  const snap = await db.collection("projects").where("isDeleted", "!=", true).get();
  let projects = snap.docs.map((d) => d.data());

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
    if (!data.isCodes || data.isCodes.length === 0) {
      migrations.isCodes = [{ code: data.isCode || "", stages: data.isiStages && data.isiStages.length > 0 ? data.isiStages : buildIsiStages() }];
    }
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
      const needsPatch = data.isiDocSlots.some(s => !s.type);
      if (needsPatch) {
        migrations.isiDocSlots = data.isiDocSlots.map(slot => {
          const def = ISI_REQUIRED_DOCUMENTS.find(d => d.id === slot.id);
          if (!def || slot.type) return slot; 
          const patched = { ...slot, type: def.type || "file" };
          if (def.columns) patched.columns = def.columns;
          if (def.label) patched.label = def.label;
          return patched;
        });
      }
    }
    if (Object.keys(migrations).length > 0) {
      data = { ...data, ...migrations };
    }
  }

  if (data.serviceType === "bis_crs") {
    const migrations = {};
    if (!data.isCodes || data.isCodes.length === 0) {
      migrations.isCodes = [{ code: data.isCode || "", stages: data.isiStages && data.isiStages.length > 0 ? data.isiStages : buildBisCrsStages() }];
    }
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
      data = { ...data, ...migrations };
    }
  }

  if (data.serviceType === "hallmarking") {
    const migrations = {};
    if (!data.isCodes || data.isCodes.length === 0) {
      migrations.isCodes = [{ code: data.isCode || "", stages: data.isiStages && data.isiStages.length > 0 ? data.isiStages : buildHallmarkingStages() }];
    }
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
    } else {
      let updatedSlots = [...data.isiDocSlots];
      let needsMigration = false;
      HALLMARKING_REQUIRED_DOCUMENTS.forEach((docDef) => {
        if (!updatedSlots.find(s => s.id === docDef.id)) {
          updatedSlots.push({ ...docDef, file: null });
          needsMigration = true;
        }
      });
      const deprecated = ['doc_hm_4', 'doc_hm_5', 'doc_hm_6', 'doc_hm_22'];
      const filteredSlots = updatedSlots.filter(s => {
        if (deprecated.includes(s.id)) {
          if (!s.file && (!s.value || s.value === "")) {
            needsMigration = true;
            return false;
          }
        }
        return true;
      });
      if (needsMigration) {
        migrations.isiDocSlots = filteredSlots;
      }
    }
    if (Object.keys(migrations).length > 0) {
      data = { ...data, ...migrations };
    }
  }
  
  if (data.serviceType === "fmcs") {
    const migrations = {};
    if (!data.isCodes || data.isCodes.length === 0) {
      migrations.isCodes = [{ code: data.isCode || "", stages: buildFmcsStages() }];
    }
    if (!data.isiDocSlots || data.isiDocSlots.length === 0) {
      migrations.isiDocSlots = buildFmcsDocSlots();
    }
    if (data.totalPaymentNeeded === undefined) {
      migrations.totalPaymentNeeded = null;
    }
    if (!data.payments) {
      migrations.payments = [];
    }
    if (data.fmcsCertValidityDate === undefined) {
      migrations.fmcsCertValidityDate = null;
    }
    if (data.bankGuaranteeValidityDate === undefined) {
      migrations.bankGuaranteeValidityDate = null;
    }
    if (Object.keys(migrations).length > 0) {
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

exports.createProject = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) throw new ApiError(403, "Managers only");

  const { projectName, clientName, serviceType, assignedTo, assignedToNames, dueDate, notes, address, name, phone, email, isCode } = req.body;
  if (!projectName || !clientName || !serviceType) {
    throw new ApiError(400, "projectName, clientName, serviceType required");
  }

  const projectId = await getNextProjectId(serviceType);
  const assignedArr = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);
  const assignedNamesArr = Array.isArray(assignedToNames) ? assignedToNames : (assignedToNames ? [assignedToNames] : []);

  const isIsi = serviceType === "isi";
  const isBisCrs = serviceType === "bis_crs";
  const isHallmarking = serviceType === "hallmarking";
  const isFmcs = serviceType === "fmcs";
  const usesStages = isIsi || isBisCrs || isHallmarking || isFmcs;
  
  const codesArray = (isCode || "").split(',').map(c => c.trim()).filter(Boolean);
  if (codesArray.length === 0) codesArray.push(isCode || "");

  const buildStages = () => isIsi ? buildIsiStages() : isBisCrs ? buildBisCrsStages() : isHallmarking ? buildHallmarkingStages() : isFmcs ? buildFmcsStages() : [];

  const isCodesArray = codesArray.map(c => ({
    code: c,
    stages: buildStages()
  }));

  const data = {
    projectId,
    projectName,
    clientName,
    serviceType,
    status: "in_progress",
    assignedTo: assignedArr,
    assignedToNames: assignedNamesArr,
    assignedBy: req.user.id,
    assignedByName: userName(req.user),
    dueDate: dueDate ? new Date(dueDate) : null,
    notes: notes || "",
    address: address || "",
    name: name || "",
    phone: phone || "",
    email: email || "",
    isCode: isCode || "",
    isCodes: isCodesArray,
    isiStages: isCodesArray.length > 0 ? isCodesArray[0].stages : buildStages(), // legacy fallback
    isiDocSlots: isIsi ? buildIsiDocSlots() : isBisCrs ? buildBisCrsDocSlots() : isHallmarking ? buildHallmarkingDocSlots() : isFmcs ? buildFmcsDocSlots() : [],
    checklist: usesStages ? [] : (PROJECT_CHECKLISTS[serviceType] || []).map((item) => ({
      ...item,
      done: false,
      doneBy: null,
      doneByName: null,
      doneAt: null,
    })),
    documents: [],
    // Payment tracking
    totalPaymentNeeded: null,
    payments: [],
    // FMCS-specific
    fmcsCertValidityDate: null,
    bankGuaranteeValidityDate: null,
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

exports.updateProject = asyncHandler(async (req, res) => {
  const doc = await db.collection("projects").doc(req.params.id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const prev = doc.data();
  if (!canAccessProject(req.user, prev)) throw new ApiError(403, "Access denied");

  const isManager = isManagerUser(req.user);
  const updates = { updatedAt: new Date() };
  const activityLogs = [];

  // Payment fields — accessible to all assigned users
  if (req.body.totalPaymentNeeded !== undefined && req.body.totalPaymentNeeded !== prev.totalPaymentNeeded) {
    updates.totalPaymentNeeded = req.body.totalPaymentNeeded !== null ? Number(req.body.totalPaymentNeeded) : null;
    activityLogs.push({
      type: "remark",
      message: `Total Payment Needed set to ₹${Number(req.body.totalPaymentNeeded).toLocaleString("en-IN")}`,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }

  // Validity dates — managers only
  if (isManager) {
    if (req.body.certValidityDate !== undefined && req.body.certValidityDate !== prev.certValidityDate) {
      updates.certValidityDate = req.body.certValidityDate || null;
      const formattedDate = updates.certValidityDate ? new Date(updates.certValidityDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
      activityLogs.push({
        type: "remark",
        message: `Certificate Validity Date updated to ${formattedDate}`,
        performedBy: req.user.id, performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }
    // Legacy FMCS cert validity date
    if (req.body.fmcsCertValidityDate !== undefined && req.body.fmcsCertValidityDate !== prev.fmcsCertValidityDate) {
      updates.fmcsCertValidityDate = req.body.fmcsCertValidityDate || null;
      const formattedDate = updates.fmcsCertValidityDate ? new Date(updates.fmcsCertValidityDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
      activityLogs.push({
        type: "remark",
        message: `FMCS Certificate Validity Date updated to ${formattedDate}`,
        performedBy: req.user.id, performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }
    if (req.body.bankGuaranteeValidityDate !== undefined && req.body.bankGuaranteeValidityDate !== prev.bankGuaranteeValidityDate) {
      updates.bankGuaranteeValidityDate = req.body.bankGuaranteeValidityDate || null;
      const formattedDate = updates.bankGuaranteeValidityDate ? new Date(updates.bankGuaranteeValidityDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not set";
      activityLogs.push({
        type: "remark",
        message: `BIS Bank Guarantee Validity Date updated to ${formattedDate}`,
        performedBy: req.user.id, performedByName: userName(req.user),
        createdAt: new Date(),
      });
    }
  }

  if (isManager) {
    const fieldLabels = {
      projectName: "Company Name",
      clientName: "Client Name",
      serviceType: "Service Type",
      notes: "Notes",
      address: "Address",
      name: "Contact Name",
      phone: "Phone",
      email: "Email"
    };

    ["projectName", "clientName", "serviceType", "notes", "address", "name", "phone", "email"].forEach((f) => {
      if (req.body[f] !== undefined && req.body[f] !== prev[f]) {
        updates[f] = req.body[f];
        activityLogs.push({
          type: "remark",
          message: `${fieldLabels[f]} updated to "${req.body[f]}"`,
          performedBy: req.user.id, performedByName: userName(req.user),
          createdAt: new Date(),
        });
      }
    });

    if (req.body.isCode !== undefined) {
      if (req.body.isCode !== prev.isCode) {
        activityLogs.push({
          type: "remark",
          message: `IS Code updated to "${req.body.isCode}"`,
          performedBy: req.user.id, performedByName: userName(req.user),
          createdAt: new Date(),
        });
      }
      updates.isCode = req.body.isCode;
      const newCodes = req.body.isCode.split(',').map(c => c.trim()).filter(Boolean);
      if (newCodes.length === 0) newCodes.push("");
      const existingCodes = prev.isCodes || [];
      const updatedIsCodes = [];
      const isIsi = prev.serviceType === "isi";
      const isBisCrs = prev.serviceType === "bis_crs";
      const isHallmarking = prev.serviceType === "hallmarking";
      const isFmcs = prev.serviceType === "fmcs";
      const buildStages = () => isIsi ? buildIsiStages() : isBisCrs ? buildBisCrsStages() : isHallmarking ? buildHallmarkingStages() : isFmcs ? buildFmcsStages() : [];

      newCodes.forEach(code => {
        const existing = existingCodes.find(e => e.code === code);
        if (existing) {
          updatedIsCodes.push(existing);
        } else {
          updatedIsCodes.push({ code, stages: buildStages() });
        }
      });
      updates.isCodes = updatedIsCodes;
    }
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
  if (req.body.calibrationDocs !== undefined) updates.calibrationDocs = req.body.calibrationDocs;

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

exports.toggleIsiStep = asyncHandler(async (req, res) => {
  const { id, stepId } = req.params;
  const { dateValue, remark, code } = req.body; 

  const doc = await db.collection("projects").doc(id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const data = doc.data();
  if (!canAccessProject(req.user, data)) throw new ApiError(403, "Access denied");

  const isCodes = data.isCodes || [];
  let targetCodeObj = isCodes.find(c => c.code === (code || ""));
  
  if (!targetCodeObj && isCodes.length > 0) {
    targetCodeObj = isCodes[0]; 
  }
  
  const isiStages = targetCodeObj ? targetCodeObj.stages : (data.isiStages || []);
  
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
        if (remark && remark.trim()) {
          if (!step.remarks) step.remarks = [];
          step.remarks.push({
            message: remark.trim(),
            addedBy: req.user.id,
            addedByName: userName(req.user),
            addedAt: new Date().toISOString()
          });
        }
        break;
      }
    }
    if (found) break;
  }

  if (!found) throw new ApiError(404, "Stage step not found");

  const allDone = isCodes.every(c => c.stages.every(stage => stage.steps.every(step => step.done)));
  const updatesObj = { isCodes, updatedAt: new Date() };
  if (allDone) updatesObj.status = "completed";

  await db.collection("projects").doc(id).update(updatesObj);

  const codePrefix = targetCodeObj && targetCodeObj.code ? `[${targetCodeObj.code}] ` : "";

  const activityLogs = [];
  activityLogs.push({
    type: "stage",
    stepId,
    code: targetCodeObj ? targetCodeObj.code : null,
    message: `${codePrefix}"${stepLabel}" marked as ${nowDone ? "done" : "undone"} by ${userName(req.user)}`,
    performedBy: req.user.id, performedByName: userName(req.user),
    createdAt: new Date(),
  });
  if (remark) {
    activityLogs.push({
      type: "remark",
      stepId,
      stepLabel,
      code: targetCodeObj ? targetCodeObj.code : null,
      message: `${codePrefix}${remark}`,
      performedBy: req.user.id, performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }
  if (allDone) {
    activityLogs.push({
      type: "status_changed",
      message: `All stages completed across all IS codes. Project marked as Completed.`,
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

exports.addRemark = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message, stepId, stepLabel } = req.body;

  if (!message || !message.trim()) throw new ApiError(400, "message is required");

  const docRef = db.collection("projects").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");
  
  const data = doc.data();
  if (!canAccessProject(req.user, data)) throw new ApiError(403, "Access denied");

  let updatedStages = false;
  
  // If stepId is provided, we should attach the remark to the specific step in the project document
  if (stepId) {
    const isCodes = data.isCodes || [];
    let found = false;
    
    // First try to find in isCodes
    for (const codeObj of isCodes) {
      if (codeObj.stages) {
        for (const stage of codeObj.stages) {
          if (stage.steps) {
            for (const step of stage.steps) {
              if (step.id === stepId) {
                if (!step.remarks) step.remarks = [];
                step.remarks.push({
                  message: message.trim(),
                  addedBy: req.user.id,
                  addedByName: userName(req.user),
                  addedAt: new Date().toISOString()
                });
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
      }
      if (found) break;
    }
    
    // Fallback for older projects without isCodes (just isiStages)
    if (!found && data.isiStages) {
      const isiStages = data.isiStages;
      for (const stage of isiStages) {
        if (stage.steps) {
          for (const step of stage.steps) {
            if (step.id === stepId) {
              if (!step.remarks) step.remarks = [];
              step.remarks.push({
                message: message.trim(),
                addedBy: req.user.id,
                addedByName: userName(req.user),
                addedAt: new Date().toISOString()
              });
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (found) {
        await docRef.update({ isiStages, updatedAt: new Date() });
        updatedStages = true;
      }
    }
    
    if (found && !updatedStages) {
      await docRef.update({ isCodes, updatedAt: new Date() });
    }
  }

  const ref = await docRef.collection("activity").add({
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

exports.deleteProject = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) throw new ApiError(403, "Managers only");

  const doc = await db.collection("projects").doc(req.params.id).get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  await db.collection("projects").doc(req.params.id).update({
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: req.user.id,
    deletedByName: userName(req.user),
  });

  const actRef = db.collection("projects").doc(req.params.id).collection("activity");
  await actRef.doc().set({
    type: "deleted",
    message: `Project deleted by ${userName(req.user)}`,
    performedBy: req.user.id, 
    performedByName: userName(req.user),
    createdAt: new Date(),
  });

  res.json({ success: true, message: "Project deleted successfully" });
});

exports.addPaymentInstallment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, date, note, referenceId, excessReason } = req.body;
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new ApiError(400, "A valid positive amount is required");
  }

  const docRef = db.collection("projects").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");
  if (!canAccessProject(req.user, doc.data())) throw new ApiError(403, "Access denied");

  const installment = {
    id: Date.now().toString(),
    amount: Number(amount),
    date: date || new Date().toISOString().split("T")[0],
    note: note || "",
    referenceId: referenceId || "",
    excessReason: excessReason || "",
    addedBy: req.user.id,
    addedByName: userName(req.user),
    addedAt: new Date().toISOString(),
  };

  const existing = doc.data().payments || [];
  const updated = [...existing, installment];
  await docRef.update({ payments: updated, updatedAt: new Date() });

  let msg = `Payment of ₹${Number(amount).toLocaleString("en-IN")} received`;
  if (referenceId) msg += ` (Ref: ${referenceId})`;
  if (note) msg += ` — ${note}`;
  if (excessReason) msg += ` [Extra Payment Reason: ${excessReason}]`;

  await db.collection("projects").doc(id).collection("activity").add({
    type: "payment",
    message: msg,
    performedBy: req.user.id,
    performedByName: userName(req.user),
    createdAt: new Date(),
  });

  res.status(201).json({ installment, message: "Payment installment added" });
});

exports.deletePaymentInstallment = asyncHandler(async (req, res) => {
  if (!isManagerUser(req.user)) throw new ApiError(403, "Managers only");
  const { id, installmentId } = req.params;
  const docRef = db.collection("projects").doc(id);
  const doc = await docRef.get();
  if (!doc.exists || doc.data().isDeleted) throw new ApiError(404, "Project not found");

  const deletedPayment = (doc.data().payments || []).find(p => p.id === installmentId);
  const payments = (doc.data().payments || []).filter(p => p.id !== installmentId);
  await docRef.update({ payments, updatedAt: new Date() });
  
  if (deletedPayment) {
    await db.collection("projects").doc(id).collection("activity").add({
      type: "payment",
      message: `Payment of ₹${Number(deletedPayment.amount).toLocaleString("en-IN")} was removed`,
      performedBy: req.user.id,
      performedByName: userName(req.user),
      createdAt: new Date(),
    });
  }
  
  res.json({ success: true, message: "Installment removed" });
});



