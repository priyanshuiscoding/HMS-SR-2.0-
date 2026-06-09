function defaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5000/api/v1";
  }

  const { hostname, origin, protocol } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost) {
    return "http://localhost:5000/api/v1";
  }

  if (hostname.endsWith(".vercel.app") && hostname.includes("-frontend")) {
    return `${protocol}//${hostname.replace("-frontend", "-backend")}/api/v1`;
  }

  return `${origin}/api/v1`;
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl();

function getAccessToken() {
  try {
    const raw = window.localStorage.getItem("hms-auth");
    return raw ? JSON.parse(raw).accessToken : null;
  } catch {
    return null;
  }
}

function createHeaders(extraHeaders = {}) {
  const accessToken = getAccessToken();

  return {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extraHeaders
  };
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

async function parseResponse(response) {
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Request failed." };
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("hms-auth");

      if (!window.location.pathname.includes("/login")) {
        window.location.assign("/login");
      }
    }

    throw new Error(data.message || "Request failed.");
  }

  return data;
}

async function apiRequest(path, { method = "GET", body, params, headers } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}${buildQuery(params)}`, {
    method,
    headers: createHeaders(headers),
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  return parseResponse(response);
}

const get = (path, params) => apiRequest(path, { params });
const post = (path, body = {}) => apiRequest(path, { method: "POST", body });
const put = (path, body = {}) => apiRequest(path, { method: "PUT", body });
const del = (path) => apiRequest(path, { method: "DELETE" });

async function downloadRequest(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: createHeaders(),
    credentials: "include"
  });

  if (!response.ok) {
    await parseResponse(response);
  }

  return response.blob();
}

export const loginRequest = (payload) => post("/auth/login", payload);
export const getSystemOverview = () => get("/system/overview");

export const getPatients = (search = "") => get("/patients", search ? { search } : {});
export const createPatient = (payload) => post("/patients", payload);
export const getPatient = (id) => get(`/patients/${id}`);
export const updatePatient = (id, payload) => put(`/patients/${id}`, payload);
export const deletePatient = (id) => del(`/patients/${id}`);
export const getPatientHistory = (id) => get(`/patients/${id}/history`);
export const getPatientDocuments = (id) => get(`/patients/${id}/documents`);
export const uploadPatientDocument = (id, payload) => post(`/patients/${id}/documents`, payload);
export const deletePatientDocument = (id, documentId) => del(`/patients/${id}/documents/${documentId}`);
export const downloadPatientDocument = (id, documentId) => downloadRequest(`/patients/${id}/documents/${documentId}/download`);

export const getAppointmentMasters = () => get("/appointments/masters");
export const getAppointments = (params = {}) => get("/appointments", params);
export const createAppointment = (payload) => post("/appointments", payload);
export const getTodayAppointments = () => get("/appointments/today");
export const getAvailableSlots = (date, doctorId) => get("/appointments/available-slots", { date, doctorId });
export const cancelAppointment = (id) => del(`/appointments/${id}`);
export const updateAppointmentStatus = (id, payload) => put(`/appointments/${id}/status`, payload);
export const updateAppointmentQueueAction = (id, payload) => put(`/appointments/${id}/queue-action`, payload);

export const getCalendarEvents = (params = {}) => get("/calendar/events", params);
export const createCalendarEvent = (payload) => post("/calendar/events", payload);
export const updateCalendarEvent = (id, payload) => put(`/calendar/events/${id}`, payload);
export const deleteCalendarEvent = (id) => del(`/calendar/events/${id}`);

export const getUsers = () => get("/users");
export const getUsersSummary = () => get("/users/summary");

export const getHrOverview = (params = {}) => get("/hr/overview", params);
export const getHrEmployees = (params = {}) => get("/hr/employees", params);
export const saveHrEmployeeProfile = (payload) => post("/hr/employees/profile", payload);
export const getHrAttendance = (params = {}) => get("/hr/attendance", params);
export const saveHrAttendance = (payload) => post("/hr/attendance", payload);
export const saveHrAttendanceBulk = (payload) => post("/hr/attendance/bulk", payload);
export const getHrShifts = () => get("/hr/shifts");
export const createHrShift = (payload) => post("/hr/shifts", payload);
export const assignHrShift = (payload) => post("/hr/shifts/assign", payload);
export const getHrLeaves = (params = {}) => get("/hr/leaves", params);
export const createHrLeave = (payload) => post("/hr/leaves", payload);
export const updateHrLeaveStatus = (id, payload) => put(`/hr/leaves/${id}/status`, payload);
export const getHrPayroll = (params = {}) => get("/hr/payroll", params);
export const saveHrPayroll = (payload) => post("/hr/payroll", payload);
export const getHrDocuments = (params = {}) => get("/hr/documents", params);
export const createHrDocument = (payload) => post("/hr/documents", payload);

export const getOpdQueue = (params = {}) => get("/opd/queue", params);
export const getOpdMasters = () => get("/opd/masters");
export const createOpdVisit = (payload) => post("/opd/visits", payload);
export const getOpdVisit = (id) => get(`/opd/visits/${id}`);
export const saveOpdVitals = (id, payload) => put(`/opd/visits/${id}/vitals`, payload);
export const saveAyurvedaAssessment = (id, payload) => post(`/opd/visits/${id}/ayurveda`, payload);
export const savePrescription = (id, payload) => post(`/opd/visits/${id}/prescriptions`, payload);
export const saveOpdDischargeSummary = (id, payload) => post(`/opd/visits/${id}/discharge-summary`, payload);
export const createOpdLabOrder = (id, payload) => post(`/opd/visits/${id}/lab-orders`, payload);
export const referOpdVisitToIpd = (id, payload) => post(`/opd/visits/${id}/refer-ipd`, payload);
export const completeOpdVisit = (id) => put(`/opd/visits/${id}/complete`);
export const updateOpdVisitWorkflow = (id, payload) => put(`/opd/visits/${id}/workflow`, payload);

export const getLabTests = () => get("/lab/tests");
export const createLabOrder = (payload) => post("/lab/orders", payload);
export const getLabSummary = () => get("/lab/summary");
export const getLabOrders = (params = {}) => get("/lab/orders", params);
export const getLabOrder = (id) => get(`/lab/orders/${id}`);
export const collectLabSample = (id, payload) => post(`/lab/orders/${id}/sample-collection`, payload);
export const saveLabResults = (id, payload) => post(`/lab/orders/${id}/results`, payload);
export const createLabBill = (id, payload = {}) => post(`/lab/orders/${id}/bill`, payload);
export const updateLabOrderWorkflow = (id, payload) => put(`/lab/orders/${id}/workflow`, payload);

export const getBills = (params = {}) => get("/billing/bills", params);
export const createBill = (payload) => post("/billing/bills", payload);
export const getBillingSummary = () => get("/billing/summary");
export const getBillingMasters = () => get("/billing/masters");
export const getPayments = (params = {}) => get("/billing/payments", params);
export const getRefunds = (params = {}) => get("/billing/refunds", params);
export const getBill = (id) => get(`/billing/bills/${id}`);
export const getBillInvoice = (id) => get(`/billing/bills/${id}/invoice`);
export const collectBillPayment = (id, payload) => post(`/billing/bills/${id}/payments`, payload);
export const applyBillDiscount = (id, payload) => post(`/billing/bills/${id}/discount`, payload);
export const createRefund = (payload) => post("/billing/refunds", payload);

export const getPanchkarmaTherapies = () => get("/panchkarma/therapies");
export const getPanchkarmaMasters = () => get("/panchkarma/masters");
export const getPanchkarmaSummary = () => get("/panchkarma/summary");
export const getPanchkarmaSchedules = (params = {}) => get("/panchkarma/schedule", params);
export const getPanchkarmaSchedule = (id) => get(`/panchkarma/schedule/${id}`);
export const createPanchkarmaSchedule = (payload) => post("/panchkarma/schedule", payload);
export const startPanchkarmaSession = (id, payload = {}) => post(`/panchkarma/schedule/${id}/start`, payload);
export const completePanchkarmaSession = (id, payload) => post(`/panchkarma/schedule/${id}/complete`, payload);

export const getPharmacyMasters = () => get("/pharmacy/masters");
export const getPharmacyStock = () => get("/pharmacy/stock");
export const getPharmacyLowStock = () => get("/pharmacy/stock/low");
export const getPharmacyExpiringStock = (withinDays = 90) => get("/pharmacy/stock/expiry", { withinDays });
export const getPharmacyPrescriptions = (params = {}) => get("/pharmacy/prescriptions", params);
export const getDispensations = (params = {}) => get("/pharmacy/dispensations", params);
export const dispensePrescription = (prescriptionId, payload) => post(`/pharmacy/prescriptions/${prescriptionId}/dispense`, payload);
export const updatePrescriptionPharmacyWorkflow = (prescriptionId, payload) => put(`/pharmacy/prescriptions/${prescriptionId}/workflow`, payload);

export const getInventoryMasters = () => get("/inventory/masters");
export const getHospitalInventoryItems = (params = {}) => get("/inventory/hospital-items", params);
export const createHospitalInventoryItem = (payload) => post("/inventory/hospital-items", payload);
export const adjustHospitalInventoryStock = (payload) => post("/inventory/hospital-items/stock", payload);
export const getHospitalInventoryTransactions = (params = {}) => get("/inventory/hospital-transactions", params);
export const getInventoryBatches = (params = {}) => get("/inventory/batches", params);
export const getInventoryTransactions = (params = {}) => get("/inventory/transactions", params);
export const getInventorySuppliers = (params = {}) => get("/inventory/suppliers", params);
export const createInventorySupplier = (payload) => post("/inventory/suppliers", payload);
export const getPurchaseOrders = (params = {}) => get("/inventory/purchase-orders", params);
export const createPurchaseOrder = (payload) => post("/inventory/purchase-orders", payload);
export const receiveInventoryStock = (payload) => post("/inventory/receive", payload);

export const getIpdSummary = () => get("/ipd/summary");
export const getIpdCensus = () => get("/ipd/census");
export const getIpdMasters = () => get("/ipd/masters");
export const getIpdAdmissions = (params = {}) => get("/ipd/admissions", params);
export const getIpdAdmission = (id) => get(`/ipd/admissions/${id}`);
export const getIpdAdmissionNotes = (id) => get(`/ipd/admissions/${id}/notes`);
export const getIpdAdmissionVitals = (id) => get(`/ipd/admissions/${id}/vitals`);
export const createIpdAdmission = (payload) => post("/ipd/admissions", payload);
export const updateIpdAdmission = (id, payload) => put(`/ipd/admissions/${id}`, payload);
export const addIpdNote = (id, payload) => post(`/ipd/admissions/${id}/notes`, payload);
export const addIpdVitals = (id, payload) => post(`/ipd/admissions/${id}/vitals`, payload);
export const scheduleIpdTherapy = (id, payload) => post(`/ipd/admissions/${id}/therapies`, payload);
export const dischargeIpdAdmission = (id, payload) => post(`/ipd/admissions/${id}/discharge`, payload);
export const updateIpdAdmissionWorkflow = (id, payload) => put(`/ipd/admissions/${id}/workflow`, payload);

export const getRoomMasters = () => get("/rooms/masters");
export const getRooms = (params = {}) => get("/rooms", params);
export const getRoomsAvailability = () => get("/rooms/availability");
export const getRoom = (id) => get(`/rooms/${id}`);
export const createRoom = (payload) => post("/rooms", payload);
export const assignRoomBed = (roomId, bedId, payload) => post(`/rooms/${roomId}/beds/${bedId}/assign`, payload);
export const dischargeRoomBed = (roomId, bedId, payload) => post(`/rooms/${roomId}/beds/${bedId}/discharge`, payload);
export const updateRoomBedStatus = (roomId, bedId, payload) => put(`/rooms/${roomId}/beds/${bedId}/status`, payload);
export const updatePanchkarmaWorkflow = (id, payload) => put(`/panchkarma/schedule/${id}/workflow`, payload);

export const getReportsOverview = (params = {}) => get("/reports/overview", params);
export const getDailyOpdReport = (params = {}) => get("/reports/daily-opd", params);
export const getIpdCensusReport = (params = {}) => get("/reports/ipd-census", params);
export const getRevenueReport = (params = {}) => get("/reports/revenue", params);
export const getPharmacySalesReport = (params = {}) => get("/reports/pharmacy-sales", params);
export const getLabWorkloadReport = (params = {}) => get("/reports/lab-workload", params);
export const getPanchkarmaStatsReport = (params = {}) => get("/reports/panchkarma-stats", params);
