import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { MultiSelectPicker } from "../../components/common/MultiSelectPicker.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { Toast } from "../../components/common/Toast.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import { calculatePrakruti, initialAyurvedaFields } from "./ayurvedaParikshanData.js";
import { GeneralExaminationForm } from "./GeneralExaminationForm.jsx";
import { createInitialHistoryTaking, HistoryTakingForm, normalizeHistoryTaking } from "./HistoryTakingForm.jsx";
import { OpdPrescriptionPrint } from "./OpdPrescriptionPrint.jsx";
import { calculateSystemicExamination, initialSystemicExamination, SystemicExaminationForm } from "./SystemicExaminationForm.jsx";
import {
  completeOpdVisit,
  createLabOrder,
  createOpdVisit,
  getOpdMasters,
  getOpdClinicalHistory,
  getOpdQueue,
  getOpdVisit,
  saveOpdDischargeSummary,
  saveOpdVitals,
  saveHistoryTaking,
  savePrescription,
  saveSystemicExamination,
  updateOpdVisitWorkflow
} from "../../services/api.js";

const opdTabs = [
  "History Taking",
  "General Examination",
  "Systemic Examination",
  "Prescription",
  "Lab Orders",
  // "Billing", // OPD billing stays disabled; reception/pharmacy handle all billing.
  "Printable Rx",
  "Complete"
];
const initialOpdTab = opdTabs[0];

const initialVitals = {
  examDate: "",
  vitalsBp: "",
  vitalsPulse: "",
  vitalsTemp: "",
  temperatureSite: "",
  temperatureUnit: "",
  pulseRhythm: "",
  pulseVolume: "",
  pulseCharacter: "",
  pulseTension: "",
  pulseVesselWall: "",
  bpRightSystolic: "",
  bpRightDiastolic: "",
  bpLeftSystolic: "",
  bpLeftDiastolic: "",
  bpPosition: "",
  vitalsWeight: "",
  vitalsHeight: "",
  vitalsSpo2: "",
  spo2Condition: "",
  vitalsRr: "",
  respiratoryPattern: "",
  bmi: "",
  bmiCategory: "",
  waistCircumference: "",
  hipCircumference: "",
  waistHipRatio: "",
  bloodGlucoseType: "",
  bloodGlucoseValue: "",
  builtMorphology: "",
  bodyBuild: "",
  nourishment: "",
  posture: "",
  gait: "",
  decubitus: "",
  facialExpression: "",
  consciousLevel: "",
  orientationTime: "",
  orientationPlace: "",
  orientationPerson: "",
  cooperation: "",
  speech: "",
  skinColour: "",
  skinTexture: "",
  skinTurgor: "",
  rashesLesions: "",
  oedemaType: "",
  oedemaDistribution: "",
  oedemaGrade: "",
  lymphSite: "",
  lymphSize: "",
  lymphConsistency: "",
  lymphTenderness: "",
  lymphMobility: "",
  hair: "",
  nails: "",
  conjunctiva: "",
  sclera: "",
  pupilsSize: "",
  pupilsShape: "",
  pupilsDirectReflex: "",
  pupilsConsensualReflex: "",
  pupilsPerrla: "",
  tongueAppearance: "",
  tongueCoatingColor: "",
  tongueMoisture: "",
  tongueTremors: "",
  tongueMacroglossia: "",
  oralMucosa: "",
  throatCongestion: "",
  tonsillarGrade: "",
  throatExudates: "",
  ...initialAyurvedaFields,
  physicalExam: ""
};

function adultBmiCategory(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function calculateGeneralExamination(form) {
  const weight = Number(form.vitalsWeight);
  const height = Number(form.vitalsHeight);
  const waist = Number(form.waistCircumference);
  const hip = Number(form.hipCircumference);
  const bmi = weight > 0 && height > 0 ? (weight / ((height / 100) ** 2)).toFixed(2) : "";
  const waistHipRatio = waist > 0 && hip > 0 ? (waist / hip).toFixed(3) : "";
  const primarySystolic = form.bpRightSystolic || form.bpLeftSystolic;
  const primaryDiastolic = form.bpRightDiastolic || form.bpLeftDiastolic;
  const vitalsBp = [primarySystolic, primaryDiastolic].filter((value) => value !== "").join("/");

  return {
    ...form,
    vitalsBp,
    bmi,
    bmiCategory: adultBmiCategory(Number(bmi)),
    waistHipRatio,
    ...calculatePrakruti(form)
  };
}

const vitalsDraftKey = (visitId) => `hms-opd-vitals-draft-${visitId}`;

function readVitalsDraft(visitId) {
  try {
    const raw = window.localStorage.getItem(vitalsDraftKey(visitId));
    return raw ? calculateGeneralExamination({ ...initialVitals, ...JSON.parse(raw) }) : null;
  } catch (storageError) {
    return null;
  }
}

// Drafting is best-effort: a full or unavailable localStorage must never block vitals entry.
function writeVitalsDraft(visitId, form) {
  try {
    window.localStorage.setItem(vitalsDraftKey(visitId), JSON.stringify(form));
  } catch (storageError) {
    /* ignore */
  }
}

function clearVitalsDraft(visitId) {
  try {
    window.localStorage.removeItem(vitalsDraftKey(visitId));
  } catch (storageError) {
    /* ignore */
  }
}

// Ayurveda parikshan fields hold arrays, so a plain string comparison would report
// every restored draft as different.
function sameFieldValue(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftList = Array.isArray(left) ? left : [];
    const rightList = Array.isArray(right) ? right : [];
    return leftList.length === rightList.length && leftList.every((value, index) => value === rightList[index]);
  }
  return (left || "") === (right || "");
}

function sameVitals(left, right) {
  return Object.keys(initialVitals).every((field) => sameFieldValue(left[field], right[field]));
}

const systemicDraftKey = (visitId) => `hms-opd-systemic-examination-draft-${visitId}`;

function readSystemicDraft(visitId) {
  try {
    const raw = window.localStorage.getItem(systemicDraftKey(visitId));
    return raw ? calculateSystemicExamination({ ...initialSystemicExamination, ...JSON.parse(raw) }) : null;
  } catch {
    return null;
  }
}

function writeSystemicDraft(visitId, form) {
  try {
    window.localStorage.setItem(systemicDraftKey(visitId), JSON.stringify(form));
  } catch {
    /* Draft recovery is best-effort and must never interrupt clinical entry. */
  }
}

function clearSystemicDraft(visitId) {
  try {
    window.localStorage.removeItem(systemicDraftKey(visitId));
  } catch {
    /* ignore */
  }
}

function sameSystemicExamination(left, right) {
  return Object.keys(initialSystemicExamination).every((field) => (left[field] || "") === (right[field] || ""));
}

const historyDraftKey = (visitId) => `hms-opd-history-taking-draft-${visitId}`;

function readHistoryDraft(visitId) {
  try {
    const raw = window.localStorage.getItem(historyDraftKey(visitId));
    return raw ? normalizeHistoryTaking(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeHistoryDraft(visitId, form) {
  try {
    window.localStorage.setItem(historyDraftKey(visitId), JSON.stringify(form));
  } catch {
    /* Draft recovery must never interrupt clinical entry. */
  }
}

function clearHistoryDraft(visitId) {
  try {
    window.localStorage.removeItem(historyDraftKey(visitId));
  } catch {
    /* ignore */
  }
}

function sameHistoryTaking(left, right) {
  return JSON.stringify(normalizeHistoryTaking(left)) === JSON.stringify(normalizeHistoryTaking(right));
}

function applyHistoryToPrescription(prescription, history) {
  const snapshot = history?.prescriptionSnapshot || {};
  if (!Object.keys(snapshot).length) return prescription;
  const metadata = prescription.metadata || {};
  const complaintRows = normalizePrescriptionComplaintRows(
    Array.from({ length: MAX_PRESCRIPTION_COMPLAINTS }, (_, index) => snapshot.complaintRows?.[index] || metadata.complaintRows?.[index] || emptyPrescriptionComplaint())
  );
  return {
    ...prescription,
    metadata: {
      ...metadata,
      complaintRows,
      medicalHistory: { ...(metadata.medicalHistory || {}), ...(snapshot.medicalHistory || {}) },
      allergies: { ...(metadata.allergies || {}), ...(snapshot.allergies || {}) },
      familyHistory: { ...(metadata.familyHistory || {}), ...(snapshot.familyHistory || {}) }
    }
  };
}

const initialAssessment = {
  prakritiVata: "",
  prakritiPitta: "",
  prakritiKapha: "",
  prakritiDominant: "",
  nadiPariksha: "",
  nadiType: "Vataja",
  jihvaPariksha: "",
  agniStatus: "sama",
  koshthaNature: "madhyama",
  vikritiAssessment: "",
  observations: ""
};

const emptyMedicine = {
  medicineId: "",
  medicineName: "",
  strength: "",
  dose: "",
  frequency: "BD",
  route: "oral",
  timing: "",
  durationDays: 10,
  anupana: "",
  quantityDispensed: 0,
  specialInstructions: ""
};

const DEFAULT_PRESCRIPTION_COMPLAINTS = 3;
const MAX_PRESCRIPTION_COMPLAINTS = 10;
const emptyPrescriptionComplaint = () => ({ complaint: "", duration: "", severity: "" });

function normalizePrescriptionComplaintRows(rows = []) {
  const source = Array.isArray(rows) ? rows.slice(0, MAX_PRESCRIPTION_COMPLAINTS) : [];
  const lastCompletedIndex = source.reduce((lastIndex, row, index) => (
    row?.complaint || row?.duration || row?.severity ? index : lastIndex
  ), -1);
  const visibleCount = Math.max(DEFAULT_PRESCRIPTION_COMPLAINTS, lastCompletedIndex + 1);

  return Array.from({ length: visibleCount }, (_, index) => ({
    ...emptyPrescriptionComplaint(),
    ...(source[index] || {})
  }));
}

const initialPrescription = {
  diagnosis: "",
  diagnosisAyurvedic: "",
  chikitsaSutra: "",
  dietRecommendations: "",
  dietToTake: [],
  dietToAvoid: [],
  followUpDate: "",
  metadata: {
    diagnosisRows: [
      { diagnosis: "", icdCode: "", type: "primary" },
      { diagnosis: "", icdCode: "", type: "secondary" },
      { diagnosis: "", icdCode: "", type: "secondary" }
    ],
    complaintRows: Array.from({ length: DEFAULT_PRESCRIPTION_COMPLAINTS }, emptyPrescriptionComplaint),
    patientDetails: { category: "" },
    medicalHistory: {
      conditions: [], surgicalHistory: "", surgicalDetails: "", menstrualLmp: "", menstrualPreviousLmp: "",
      menstrualDays: "", menarche: "", menopause: "", menstrualCycle: "", clotting: "", painSeverity: "",
      obstetricHistory: "", other: ""
    },
    allergies: { drug: "", food: "", environmental: "" },
    familyHistory: { geneticConditions: false, geneticDetails: "", conditions: [], others: "" },
    followUpMonitoring: { interval: "", parameters: [], others: "" },
    therapyPlan: {
      yoga: [{ asanas: "Surya Namaskar, Tadasana, Bhujangasana", pranayama: "Anulom-Vilom, Bhastrika", durationMinutes: "" }],
      panchkarma: [
        { procedure: "Abhyanga", frequency: "", duration: "", durationDays: "" },
        { procedure: "Vaman/Virchak", frequency: "", duration: "", durationDays: "" },
        { procedure: "Nasya", frequency: "", duration: "", durationDays: "" },
        { procedure: "Basti", frequency: "", duration: "", durationDays: "" }
      ],
      specialized: [
        { therapy: "Abhayans", sessions: "", duration: "" },
        { therapy: "Kizhi/Swedan ", sessions: "", duration: "" },
        { therapy: "Udwarthana", sessions: "", duration: "" }
      ]
    },
    dietPlan: { recommendedDiet: "", foodsToInclude: "", foodsToAvoid: "" },
    lifestylePlan: { activityType: "", frequency: "", duration: "", bestTime: "", precautions: "", stressManagement: "" }
  },
  medicines: [{ ...emptyMedicine }]
};

const initialDischargeSummary = {
  summaryDate: new Date().toISOString().slice(0, 10),
  status: "draft",
  clinicalCourse: "",
  finalDiagnosis: "",
  conditionOnDischarge: "stable",
  advice: "",
  followUpDate: "",
  metadata: {
    patient: { admissionDate: "", dischargeDate: "", lengthOfStay: "", wardRoom: "" },
    clinicalImprovement: { overallStatus: "", symptomRelief: "", functionalStatus: "" },
    dietAdvice: { recommendedDiet: "", foodsToInclude: "", foodsToAvoid: "" },
    lifestyleAdvice: { yogaPranayama: "", physicalActivity: "", sleepSchedule: "", stressManagement: "" },
    investigations: { bloodTests: false, imaging: "", specialtyTests: "" },
    medicinesAdministered: [],
    dischargeMedicines: [],
    yogaTherapy: [],
    panchkarmaTherapy: [],
    specializedTherapy: []
  }
};

const initialLabOrder = {
  priority: "routine",
  tests: []
};

const labOrderGroupOrder = ["Laboratory Tests", "X-Ray", "Ultrasound", "CT Scan", "MRI"];


function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTherapyPlan(therapyPlan = {}) {
  return {
    ...therapyPlan,
    panchkarma: (therapyPlan.panchkarma || []).map((row) => ({
      ...row,
      procedure: ["shiroabhyanga", "shiro abhyanga", "shiroabhayaya"].includes(String(row.procedure || "").toLowerCase())
        ? "Vaman/Virchak"
        : row.procedure
    })),
    specialized: (therapyPlan.specialized || []).map((row) => ({
      ...row,
      therapy: ["shirodhara", "shiro dhara"].includes(String(row.therapy || "").toLowerCase())
        ? "Abhayans"
        : row.therapy
    }))
  };
}

function dietNames(items) {
  return (items || []).map((item) => item.name).join(", ");
}

function normalizeMedicineNameInput(value) {
  return String(value || "").replace(/^\s*\d+[\).\-\s]+/, "").trimStart();
}

function mergePrescription(prescription) {
  const base = clone(initialPrescription);
  const storedPrescription = { ...(prescription || {}) };
  const storedMetadata = { ...(prescription?.metadata || {}) };
  delete storedPrescription.nidana;
  delete storedPrescription.samprapti;
  delete storedMetadata.investigations;

  return {
    ...base,
    ...storedPrescription,
    metadata: {
      ...base.metadata,
      ...storedMetadata,
      complaintRows: normalizePrescriptionComplaintRows(prescription?.metadata?.complaintRows),
      therapyPlan: normalizeTherapyPlan({
        ...base.metadata.therapyPlan,
        ...(prescription?.metadata?.therapyPlan || {})
      }),
      dietPlan: {
        ...base.metadata.dietPlan,
        ...(prescription?.metadata?.dietPlan || {})
      },
      lifestylePlan: {
        ...base.metadata.lifestylePlan,
        ...(prescription?.metadata?.lifestylePlan || {})
      },
      medicalHistory: {
        ...base.metadata.medicalHistory,
        ...(prescription?.metadata?.medicalHistory || {}),
        conditions: prescription?.metadata?.medicalHistory?.conditions || []
      },
      patientDetails: {
        ...base.metadata.patientDetails,
        ...(prescription?.metadata?.patientDetails || {})
      },
      allergies: {
        ...base.metadata.allergies,
        ...(prescription?.metadata?.allergies || {})
      },
      familyHistory: {
        ...base.metadata.familyHistory,
        ...(prescription?.metadata?.familyHistory || {}),
        conditions: prescription?.metadata?.familyHistory?.conditions || []
      },
      followUpMonitoring: {
        ...base.metadata.followUpMonitoring,
        ...(prescription?.metadata?.followUpMonitoring || {}),
        parameters: prescription?.metadata?.followUpMonitoring?.parameters || []
      }
    },
    dietToTake: prescription?.dietToTake || [],
    dietToAvoid: prescription?.dietToAvoid || [],
    medicines: prescription?.medicines?.length ? prescription.medicines : [{ ...emptyMedicine }]
  };
}

function medicineRows(prescription) {
  return (prescription?.medicines || []).map((medicine) => ({
    medicineName: medicine.medicineName,
    strengthRoute: medicine.route,
    dosage: medicine.dose,
    duration: medicine.durationDays ? `${medicine.durationDays} days` : "",
    remarks: medicine.specialInstructions || medicine.timing || ""
  }));
}

const workflowStageLabels = {
  screening: "Reception -> Screening",
  doctor: "Screening -> Doctor",
  pharmacy_reception: "Doctor -> Pharmacy & Reception"
};

function workflowStageForVisit(visit) {
  return visit?.metadata?.workflowStage || (visit?.status === "completed" ? "pharmacy_reception" : visit?.status === "waiting" ? "screening" : "doctor");
}

function workflowStageForQueueItem(item) {
  return item.visitMetadata?.workflowStage || (item.visitStatus === "completed" ? "pharmacy_reception" : item.visitStatus === "waiting" ? "screening" : item.visitStatus ? "doctor" : "reception");
}

function mergeDischargeSummary(summary, prescription, visit) {
  const base = clone(initialDischargeSummary);
  const prescriptionRows = medicineRows(prescription);
  const metadata = prescription?.metadata || {};

  return {
    ...base,
    ...(summary || {}),
    finalDiagnosis: summary?.finalDiagnosis || prescription?.diagnosis || "",
    advice: summary?.advice || prescription?.dietRecommendations || "",
    followUpDate: summary?.followUpDate || prescription?.followUpDate || "",
    metadata: {
      ...base.metadata,
      ...(summary?.metadata || {}),
      patient: {
        ...base.metadata.patient,
        ...(summary?.metadata?.patient || {})
      },
      clinicalImprovement: {
        ...base.metadata.clinicalImprovement,
        ...(summary?.metadata?.clinicalImprovement || {})
      },
      dietAdvice: {
        ...base.metadata.dietAdvice,
        ...(metadata.dietPlan || {}),
        ...(summary?.metadata?.dietAdvice || {})
      },
      lifestyleAdvice: {
        ...base.metadata.lifestyleAdvice,
        ...(summary?.metadata?.lifestyleAdvice || {})
      },
      investigations: {
        ...base.metadata.investigations,
        ...(metadata.investigations || {}),
        ...(summary?.metadata?.investigations || {})
      },
      medicinesAdministered: summary?.metadata?.medicinesAdministered?.length ? summary.metadata.medicinesAdministered : prescriptionRows,
      dischargeMedicines: summary?.metadata?.dischargeMedicines?.length ? summary.metadata.dischargeMedicines : prescriptionRows,
      yogaTherapy: summary?.metadata?.yogaTherapy?.length ? summary.metadata.yogaTherapy : metadata.therapyPlan?.yoga || [],
      panchkarmaTherapy: summary?.metadata?.panchkarmaTherapy?.length ? summary.metadata.panchkarmaTherapy : metadata.therapyPlan?.panchkarma || [],
      specializedTherapy: summary?.metadata?.specializedTherapy?.length ? summary.metadata.specializedTherapy : metadata.therapyPlan?.specialized || []
    },
    conditionOnDischarge: summary?.conditionOnDischarge || "stable",
    summaryDate: summary?.summaryDate || new Date().toISOString().slice(0, 10),
    status: summary?.status || "draft"
  };
}

export function OpdPage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [masters, setMasters] = useState({
    doctors: [],
    medicines: [],
    labTests: [],
    dietItems: { take: [], avoid: [] },
    nadiTypes: [],
    agniStatuses: [],
    koshthaTypes: [],
    frequencies: [],
    routes: [],
    consultationFee: 0,
    operatingHours: null
  });
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [visitPayload, setVisitPayload] = useState(null);
  const [vitalsForm, setVitalsForm] = useState(initialVitals);
  const [pendingVitalsDraft, setPendingVitalsDraft] = useState(null);
  const vitalsDraftDirtyRef = useRef(false);
  const vitalsLatestFormRef = useRef(initialVitals);
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [systemicForm, setSystemicForm] = useState(initialSystemicExamination);
  const [pendingSystemicDraft, setPendingSystemicDraft] = useState(null);
  const systemicDraftDirtyRef = useRef(false);
  const systemicLatestFormRef = useRef(initialSystemicExamination);
  const [historyForm, setHistoryForm] = useState(createInitialHistoryTaking);
  const [pendingHistoryDraft, setPendingHistoryDraft] = useState(null);
  const historyDraftDirtyRef = useRef(false);
  const historyLatestFormRef = useRef(createInitialHistoryTaking());
  const [prescriptionForm, setPrescriptionForm] = useState(initialPrescription);
  const [dischargeForm, setDischargeForm] = useState(initialDischargeSummary);
  const [filterDoctorId, setFilterDoctorId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [labOrderForm, setLabOrderForm] = useState(initialLabOrder);
  const [activeOpdTab, setActiveOpdTab] = useState(initialOpdTab);
  const [historyFilters, setHistoryFilters] = useState({ date: "", search: "" });
  const [historyVisits, setHistoryVisits] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historicalView, setHistoricalView] = useState(false);

  async function loadQueue(doctorId = filterDoctorId) {
    try {
      const response = await getOpdQueue({ doctorId });
      setQueue(response.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to load OPD queue.");
    }
  }

  async function loadVisit(visitId, queueItem, nextTab = initialOpdTab) {
    try {
      const response = await getOpdVisit(visitId);
      setSelectedQueueItem(queueItem);
      setVisitPayload(response);
      setActiveOpdTab(nextTab);
      const generalExamination = response.generalExamination;
      const savedVitals = calculateGeneralExamination({
        ...initialVitals,
        ...(generalExamination || {}),
        examDate: generalExamination?.examDate || response.visit.visitDate || ""
      });
      vitalsDraftDirtyRef.current = false;
      vitalsLatestFormRef.current = savedVitals;
      setVitalsForm(savedVitals);

      const draft = readVitalsDraft(visitId);
      if (draft && !sameVitals(draft, savedVitals)) {
        setPendingVitalsDraft(draft);
      } else {
        if (draft) {
          clearVitalsDraft(visitId);
        }
        setPendingVitalsDraft(null);
      }
      setAssessmentForm({
        ...initialAssessment,
        ...(response.assessment || {})
      });
      const savedSystemic = calculateSystemicExamination({
        ...initialSystemicExamination,
        ...(response.systemicExamination || {}),
        examDate: response.systemicExamination?.examDate || response.visit.visitDate || ""
      });
      systemicDraftDirtyRef.current = false;
      systemicLatestFormRef.current = savedSystemic;
      setSystemicForm(savedSystemic);
      const systemicDraft = readSystemicDraft(visitId);
      if (systemicDraft && !sameSystemicExamination(systemicDraft, savedSystemic)) {
        setPendingSystemicDraft(systemicDraft);
      } else {
        if (systemicDraft) clearSystemicDraft(visitId);
        setPendingSystemicDraft(null);
      }
      const savedHistory = normalizeHistoryTaking({
        ...(response.historyTaking || {}),
        historyDate: response.historyTaking?.historyDate || response.visit.visitDate || ""
      });
      historyDraftDirtyRef.current = false;
      historyLatestFormRef.current = savedHistory;
      setHistoryForm(savedHistory);
      const historyDraft = readHistoryDraft(visitId);
      if (historyDraft && !sameHistoryTaking(historyDraft, savedHistory)) {
        setPendingHistoryDraft(historyDraft);
      } else {
        if (historyDraft) clearHistoryDraft(visitId);
        setPendingHistoryDraft(null);
      }
      const nextPrescription = applyHistoryToPrescription(mergePrescription(response.prescription), savedHistory);
      setPrescriptionForm(nextPrescription);
      setDischargeForm(mergeDischargeSummary(response.dischargeSummary, nextPrescription, response.visit));
      setLabOrderForm(initialLabOrder);
    } catch (apiError) {
      setError(apiError.message || "Unable to load visit details.");
    }
  }

  async function searchClinicalHistory(event, page = 1) {
    event?.preventDefault();
    if (!historyFilters.date && !historyFilters.search.trim()) {
      setError("Choose a visit date or enter a patient name, UHID, registration number, or phone.");
      return;
    }
    setHistoryLoading(true);
    setError("");
    try {
      const response = await getOpdClinicalHistory({ ...historyFilters, page, pageSize: historyMeta.pageSize });
      setHistoryVisits(response.items || []);
      setHistoryMeta((current) => ({ ...current, ...(response.meta || {}), page }));
    } catch (apiError) {
      setError(apiError.message || "Unable to search previous clinical records.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistoricalVisit(visit) {
    setHistoricalView(true);
    await loadVisit(visit.id, {
      id: `history-${visit.id}`,
      patientId: visit.patientId,
      patientName: visit.patientName,
      patientUhid: visit.patientUhid,
      visitId: visit.id,
      visitStatus: visit.status,
      doctorName: visit.doctorName,
      appointmentTime: "",
      source: "Clinical history"
    }, "Printable Rx");
  }

  async function loadMasters() {
    const response = await getOpdMasters();
    setMasters((current) => ({
      ...current,
      ...response,
      dietItems: { ...current.dietItems, ...(response.dietItems || {}) }
    }));
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        await loadMasters();
      } catch (apiError) {
        setError(apiError.message || "Unable to load OPD masters.");
      }
    }

    bootstrap();
    loadQueue("");
  }, []);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId || !vitalsDraftDirtyRef.current) return undefined;

    const timer = window.setTimeout(() => {
      writeVitalsDraft(visitId, vitalsForm);
      vitalsDraftDirtyRef.current = false;
    }, 300);

    return () => window.clearTimeout(timer);
  }, [vitalsForm, visitPayload?.visit?.id]);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId) return undefined;

    const flushDraft = () => {
      if (vitalsDraftDirtyRef.current) {
        writeVitalsDraft(visitId, vitalsLatestFormRef.current);
        vitalsDraftDirtyRef.current = false;
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [visitPayload?.visit?.id]);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId || !historyDraftDirtyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      writeHistoryDraft(visitId, historyForm);
      historyDraftDirtyRef.current = false;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [historyForm, visitPayload?.visit?.id]);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId) return undefined;
    const flushDraft = () => {
      if (historyDraftDirtyRef.current) {
        writeHistoryDraft(visitId, historyLatestFormRef.current);
        historyDraftDirtyRef.current = false;
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [visitPayload?.visit?.id]);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId || !systemicDraftDirtyRef.current) return undefined;

    const timer = window.setTimeout(() => {
      writeSystemicDraft(visitId, systemicForm);
      systemicDraftDirtyRef.current = false;
    }, 300);

    return () => window.clearTimeout(timer);
  }, [systemicForm, visitPayload?.visit?.id]);

  useEffect(() => {
    const visitId = visitPayload?.visit?.id;
    if (!visitId) return undefined;

    const flushDraft = () => {
      if (systemicDraftDirtyRef.current) {
        writeSystemicDraft(visitId, systemicLatestFormRef.current);
        systemicDraftDirtyRef.current = false;
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [visitPayload?.visit?.id]);

  const queueStats = useMemo(() => {
    return {
      total: queue.length,
      waiting: queue.filter((item) => !item.visitStatus || item.visitStatus === "waiting").length,
      active: queue.filter((item) => item.visitStatus === "in_consultation").length,
      done: queue.filter((item) => item.visitStatus === "completed").length
    };
  }, [queue]);
  const labOrderGroups = useMemo(() => {
    const groups = new Map();

    masters.labTests.forEach((test) => {
      const groupName = test.metadata?.selectionGroup || test.department || "Other Tests";
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(test);
    });

    return [...groups.entries()]
      .map(([name, tests]) => ({ name, tests: tests.sort((left, right) => left.name.localeCompare(right.name)) }))
      .sort((left, right) => {
        const leftIndex = labOrderGroupOrder.indexOf(left.name);
        const rightIndex = labOrderGroupOrder.indexOf(right.name);
        if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name);
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });
  }, [masters.labTests]);
  const canStartVisit = canPerformModuleAction(user, "opd", ["admin", "reception", "doctor"]);
  const canSaveVitals = canPerformModuleAction(user, "opd", ["admin", "doctor", "nursing"]) && !historicalView;
  const canClinicalDocument = canPerformModuleAction(user, "opd", ["admin", "doctor"]) && !historicalView;
  const canPrintPrescription = canPerformModuleAction(user, "opd", ["admin", "doctor", "reception"]);
  const canManageWorkflow = canPerformModuleAction(user, "opd", ["admin", "doctor", "reception", "nursing"]);

  const handleDoctorFilter = async (event) => {
    const doctorId = event.target.value;
    setFilterDoctorId(doctorId);
    await loadQueue(doctorId);
  };

  const startConsultation = async (queueItem) => {
    if (!queueItem.visitId && !canStartVisit) {
      setError("You do not have permission to start consultations.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = queueItem.visitId
        ? { item: { id: queueItem.visitId } }
        : await createOpdVisit({ appointmentId: queueItem.id });

      await loadQueue(filterDoctorId);
      await loadVisit(response.item.id, queueItem);
      setMessage(queueItem.visitId ? "Visit loaded successfully." : "OPD form saved by reception and forwarded to screening.");
    } catch (apiError) {
      setError(apiError.message || "Unable to start consultation.");
    }
  };

  const handleVitalsChange = (event) => {
    const { name, value } = event.target;
    setVitalsForm((current) => {
      const nextVitals = calculateGeneralExamination({ ...current, [name]: value });
      vitalsDraftDirtyRef.current = true;
      vitalsLatestFormRef.current = nextVitals;
      return nextVitals;
    });
  };

  const restoreVitalsDraft = () => {
    if (!pendingVitalsDraft) {
      return;
    }

    const restored = calculateGeneralExamination(pendingVitalsDraft);
    vitalsDraftDirtyRef.current = false;
    vitalsLatestFormRef.current = restored;
    setVitalsForm(restored);
    setPendingVitalsDraft(null);
    setMessage("Restored the unsaved general examination draft. Review it, then save and forward.");
  };

  const discardVitalsDraft = () => {
    if (visitPayload?.visit?.id) {
      clearVitalsDraft(visitPayload.visit.id);
    }

    vitalsDraftDirtyRef.current = false;
    setPendingVitalsDraft(null);
  };

  const handleSystemicChange = useCallback((name, value) => {
    systemicDraftDirtyRef.current = true;
    setSystemicForm((current) => {
      const next = calculateSystemicExamination({ ...current, [name]: value });
      systemicLatestFormRef.current = next;
      return next;
    });
  }, []);

  const restoreSystemicDraft = () => {
    if (!pendingSystemicDraft) return;
    systemicDraftDirtyRef.current = false;
    const restored = calculateSystemicExamination(pendingSystemicDraft);
    systemicLatestFormRef.current = restored;
    setSystemicForm(restored);
    setPendingSystemicDraft(null);
    setMessage("Restored the unsaved systemic examination draft. Review it, then save.");
  };

  const discardSystemicDraft = () => {
    if (visitPayload?.visit?.id) clearSystemicDraft(visitPayload.visit.id);
    systemicDraftDirtyRef.current = false;
    setPendingSystemicDraft(null);
  };

  const handleHistoryChange = useCallback((name, value) => {
    historyDraftDirtyRef.current = true;
    setHistoryForm((current) => {
      const next = normalizeHistoryTaking({ ...current, [name]: value });
      historyLatestFormRef.current = next;
      return next;
    });
  }, []);

  const restoreHistoryDraft = () => {
    if (!pendingHistoryDraft) return;
    const restored = normalizeHistoryTaking(pendingHistoryDraft);
    historyDraftDirtyRef.current = false;
    historyLatestFormRef.current = restored;
    setHistoryForm(restored);
    setPendingHistoryDraft(null);
    setMessage("Restored the unsaved history-taking draft. Review it, then save and forward.");
  };

  const discardHistoryDraft = () => {
    if (visitPayload?.visit?.id) clearHistoryDraft(visitPayload.visit.id);
    historyDraftDirtyRef.current = false;
    setPendingHistoryDraft(null);
  };

  const handlePrescriptionChange = (event) => {
    setPrescriptionForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleDietChange = (field, items) => {
    setPrescriptionForm((current) => ({
      ...current,
      [field]: items.map((item) => ({ id: item.id, name: item.name, nameHi: item.nameHi || "" }))
    }));
  };

  const handlePrescriptionMetadataChange = (section, field, value) => {
    setPrescriptionForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [section]: {
          ...(current.metadata?.[section] || {}),
          [field]: value
        }
      }
    }));
  };

  const handlePrescriptionMetadataListChange = (section, field, value, checked) => {
    setPrescriptionForm((current) => {
      const values = current.metadata?.[section]?.[field] || [];
      const nextValues = checked
        ? [...new Set([...values, value])]
        : values.filter((item) => item !== value);

      return {
        ...current,
        metadata: {
          ...current.metadata,
          [section]: {
            ...(current.metadata?.[section] || {}),
            [field]: nextValues
          }
        }
      };
    });
  };

  const handlePrescriptionRowChange = (section, index, field, value) => {
    setPrescriptionForm((current) => {
      const rows = [...(current.metadata?.[section] || [])];
      rows[index] = { ...rows[index], [field]: value };
      return {
        ...current,
        metadata: {
          ...current.metadata,
          [section]: rows
        }
      };
    });
  };

  const handleTherapyRowChange = (section, index, field, value) => {
    setPrescriptionForm((current) => {
      const therapyPlan = { ...(current.metadata?.therapyPlan || {}) };
      const rows = [...(therapyPlan[section] || [])];
      rows[index] = { ...rows[index], [field]: value };
      therapyPlan[section] = rows;
      return {
        ...current,
        metadata: {
          ...current.metadata,
          therapyPlan
        }
      };
    });
  };

  const handleDischargeChange = (event) => {
    setDischargeForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleDischargeMetadataChange = (section, field, value) => {
    setDischargeForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [section]: {
          ...(current.metadata?.[section] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleLabOrderChange = (event) => {
    const { name, value, checked } = event.target;

    if (name === "tests") {
      setLabOrderForm((current) => ({
        ...current,
        tests: checked
          ? [...current.tests, value]
          : current.tests.filter((item) => item !== value)
      }));
      return;
    }

    setLabOrderForm((current) => ({
      ...current,
      [name]: value
    }));
  };


  const handleMedicineChange = (index, field, value) => {
    setPrescriptionForm((current) => {
      const medicines = [...current.medicines];
      const nextValue = field === "medicineName" ? normalizeMedicineNameInput(value) : value;
      const medicine = { ...medicines[index], [field]: nextValue };

      if (field === "medicineId") {
        const match = masters.medicines.find((entry) => entry.id === value);
        medicine.medicineName = match?.name || "";
      }

      medicines[index] = medicine;
      return { ...current, medicines };
    });
  };

  const addMedicineRow = () => {
    setPrescriptionForm((current) => ({
      ...current,
      medicines: [...current.medicines, { ...emptyMedicine }]
    }));
  };

  const removeMedicineRow = (index) => {
    setPrescriptionForm((current) => {
      // Never leave zero rows: clear the last remaining medicine instead of deleting it.
      if (current.medicines.length <= 1) {
        return { ...current, medicines: [{ ...emptyMedicine }] };
      }

      return { ...current, medicines: current.medicines.filter((_, i) => i !== index) };
    });
  };

  const saveVitalsAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canSaveVitals) {
      setError("Only screening/nursing, doctors, and admin can save the general examination.");
      return;
    }

    setError("");
    try {
      await saveOpdVitals(visitPayload.visit.id, vitalsForm);
      vitalsDraftDirtyRef.current = false;
      clearVitalsDraft(visitPayload.visit.id);
      setPendingVitalsDraft(null);
      await loadVisit(visitPayload.visit.id, selectedQueueItem, "Systemic Examination");
      await loadQueue(filterDoctorId);
      setMessage("General examination saved to the dated patient history and forwarded to the systemic examination.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save the general examination.");
    }
  };

  const saveSystemicExaminationAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to save the systemic examination.");
      return;
    }

    setError("");
    try {
      const response = await saveSystemicExamination(visitPayload.visit.id, systemicForm);
      const savedSystemic = calculateSystemicExamination({ ...initialSystemicExamination, ...(response.item || {}) });
      systemicDraftDirtyRef.current = false;
      systemicLatestFormRef.current = savedSystemic;
      clearSystemicDraft(visitPayload.visit.id);
      setPendingSystemicDraft(null);
      setSystemicForm(savedSystemic);
      setVisitPayload((current) => current ? { ...current, systemicExamination: response.item } : current);
      setActiveOpdTab("Prescription");
      setMessage("Systemic examination saved to the dated patient history and forwarded to the prescription.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save the systemic examination.");
    }
  };

  const addComplaintRow = () => {
    setPrescriptionForm((current) => {
      const complaintRows = current.metadata?.complaintRows || [];
      if (complaintRows.length >= MAX_PRESCRIPTION_COMPLAINTS) return current;

      return {
        ...current,
        metadata: {
          ...current.metadata,
          complaintRows: [...complaintRows, emptyPrescriptionComplaint()]
        }
      };
    });
  };

  const saveHistoryTakingAction = async () => {
    if (!visitPayload?.visit?.id) return;
    if (!canClinicalDocument) {
      setError("You do not have permission to save history taking.");
      return;
    }
    setError("");
    try {
      const response = await saveHistoryTaking(visitPayload.visit.id, historyForm);
      const savedHistory = normalizeHistoryTaking(response.item || {});
      historyDraftDirtyRef.current = false;
      historyLatestFormRef.current = savedHistory;
      clearHistoryDraft(visitPayload.visit.id);
      setPendingHistoryDraft(null);
      setHistoryForm(savedHistory);
      setPrescriptionForm((current) => applyHistoryToPrescription(current, savedHistory));
      const firstComplaint = savedHistory.complaints.find((item) => item.complaint.trim())?.complaint.trim();
      setVisitPayload((current) => current ? {
        ...current,
        historyTaking: response.item,
        visit: firstComplaint ? { ...current.visit, chiefComplaint: firstComplaint } : current.visit
      } : current);
      setActiveOpdTab("General Examination");
      setMessage("History taking saved to the patient record and forwarded to the general examination.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save history taking.");
    }
  };

  const savePrescriptionAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to save prescriptions.");
      return;
    }

    setError("");
    try {
      await savePrescription(visitPayload.visit.id, prescriptionForm);
      await loadVisit(visitPayload.visit.id, selectedQueueItem, "Lab Orders");
      // Typed diet items become master entries on save; refresh so they are
      // suggested straight away instead of only after a page reload.
      await loadMasters();
      setMessage("Prescription saved and forwarded to lab orders.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save prescription.");
    }
  };

  const saveDischargeSummaryAction = async (status = "forwarded") => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to save discharge summaries.");
      return;
    }

    setError("");
    try {
      await saveOpdDischargeSummary(visitPayload.visit.id, {
        ...dischargeForm,
        status
      });
      await loadVisit(
        visitPayload.visit.id,
        selectedQueueItem,
        status === "forwarded" ? "Complete" : "Printable Rx"
      );
      setMessage(status === "forwarded" ? "Discharge summary saved and forwarded to reception and nursing." : "Discharge summary saved.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save discharge summary.");
    }
  };

  const printOpdPrescription = () => {
    if (!canPrintPrescription) {
      setError("Only doctor, reception, and admin can print OPD prescriptions.");
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("print-opd-prescription");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("print-opd-prescription");
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 0);
  };

  const completeConsultationAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to complete consultations.");
      return;
    }

    setError("");
    try {
      await completeOpdVisit(visitPayload.visit.id);
      await loadQueue(filterDoctorId);
      await loadVisit(visitPayload.visit.id, selectedQueueItem, "Complete");
      setMessage("Consultation completed and forwarded to pharmacy and reception.");
    } catch (apiError) {
      setError(apiError.message || "Unable to complete consultation.");
    }
  };

  const visitWorkflowAction = async (action, label = action) => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canManageWorkflow) {
      setError("You do not have permission to update OPD workflow status.");
      return;
    }

    const reason = window.prompt(`Reason for ${label}:`);
    if (!reason?.trim()) {
      setError("Reason is required for OPD workflow actions.");
      return;
    }

    try {
      await updateOpdVisitWorkflow(visitPayload.visit.id, { action, reason });
      await loadQueue(filterDoctorId);
      await loadVisit(visitPayload.visit.id, selectedQueueItem, "Complete");
      setMessage("OPD workflow action saved.");
    } catch (apiError) {
      setError(apiError.message || "Unable to update OPD workflow.");
    }
  };

  const createLabOrderAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to create lab orders from OPD.");
      return;
    }

    setError("");
    try {
      await createLabOrder({
        visitId: visitPayload.visit.id,
        patientId: visitPayload.visit.patientId,
        patientName: visitPayload.visit.patientName,
        orderedBy: visitPayload.visit.doctorId,
        priority: labOrderForm.priority,
        tests: labOrderForm.tests
      });
      await loadVisit(visitPayload.visit.id, selectedQueueItem, "Printable Rx");
      setLabOrderForm(initialLabOrder);
      setMessage("Lab order created and forwarded to the printable prescription.");
    } catch (apiError) {
      setError(apiError.message || "Unable to create lab order.");
    }
  };

  return (
    <DashboardLayout>
      <div className="toast-stack">
        <Toast message={message} type="success" onClose={() => setMessage("")} />
        <Toast message={error} type="error" onClose={() => setError("")} />
      </div>
{/* 
      <section className="hero-panel logo-hero">
        <div className="eyebrow">OPD Consultation</div>
        <h2>Reception, screening, doctor, pharmacy, and print in one OPD flow.</h2>
        <p>
          Reception forwards the OPD form to screening, screening records vitals and examination, and the doctor
          completes the prescription before pharmacy and reception handle medicines, payment, and patient copy.
        </p>
      </section> */}

      <section className="stat-grid compact-stat-grid">
        <article className="stat-card">
          <div className="stat-label">Queue Today</div>
          <div className="stat-value">{queueStats.total}</div>
          <div className="stat-note">Appointments ready for OPD</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Waiting</div>
          <div className="stat-value">{queueStats.waiting}</div>
          <div className="stat-note">Pending general examination or start</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">In Consultation</div>
          <div className="stat-value">{queueStats.active}</div>
          <div className="stat-note">Doctor workspace active</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{queueStats.done}</div>
          <div className="stat-note">Consultations closed</div>
        </article>
      </section>

      <section className="content-card opd-history-search">
        <div className="section-header">
          <div><div className="eyebrow">Past Clinical Records</div><h3>Find examinations and prescriptions from any date</h3></div>
        </div>
        <form className="toolbar" onSubmit={searchClinicalHistory}>
          <input type="date" aria-label="Visit date" value={historyFilters.date} onChange={(event) => setHistoryFilters((current) => ({ ...current, date: event.target.value }))} />
          <input className="search-input" aria-label="Patient search" placeholder="Patient name, UHID, registration number, or phone" value={historyFilters.search} onChange={(event) => setHistoryFilters((current) => ({ ...current, search: event.target.value }))} />
          <Button type="submit" disabled={historyLoading}>{historyLoading ? "Searching..." : "Search records"}</Button>
          <Button type="button" variant="secondary" onClick={() => { setHistoryFilters({ date: "", search: "" }); setHistoryVisits([]); setHistoryMeta({ page: 1, pageSize: 25, total: 0, totalPages: 1 }); }}>Clear</Button>
        </form>
        {historyVisits.length ? (
          <div className="table-shell"><table className="data-table">
            <thead><tr><th>Date</th><th>UHID</th><th>Patient</th><th>OPD No.</th><th>Doctor</th><th>Prescription</th><th></th></tr></thead>
            <tbody>{historyVisits.map((visit) => (
              <tr key={visit.id}><td>{visit.visitDate}</td><td><strong>{visit.patientUhid || "Not assigned"}</strong></td><td>{visit.patientName}</td><td>{visit.opdNumber}</td><td>{visit.doctorName || "Unassigned"}</td><td>{visit.prescriptionNumber || visit.prescriptionDiagnosis || "Not recorded"}</td><td><Button type="button" variant="secondary" onClick={() => openHistoricalVisit(visit)}>Open full record</Button></td></tr>
            ))}</tbody>
          </table></div>
        ) : null}
        {historyMeta.totalPages > 1 ? (
          <div className="action-row">
            <Button type="button" variant="secondary" disabled={historyLoading || historyMeta.page <= 1} onClick={() => searchClinicalHistory(null, historyMeta.page - 1)}>Previous</Button>
            <span>Page {historyMeta.page} of {historyMeta.totalPages} · {historyMeta.total} records</span>
            <Button type="button" variant="secondary" disabled={historyLoading || historyMeta.page >= historyMeta.totalPages} onClick={() => searchClinicalHistory(null, historyMeta.page + 1)}>Next</Button>
          </div>
        ) : null}
        {!historyLoading && (historyFilters.date || historyFilters.search) && !historyVisits.length ? <div className="empty-state">No matching historical visits found.</div> : null}
      </section>

      <section className="opd-grid opd-top-grid">
        <article className="content-card opd-workspace-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Consultation Workspace</div>
                <h3>
                  {visitPayload?.visit?.patientName || "Select or start a visit from the queue"}
                </h3>
                {visitPayload ? <div className="timeline-copy"><strong>UHID:</strong> {visitPayload.patient?.uhid || selectedQueueItem?.patientUhid || "Not assigned"}</div> : null}
                {historicalView && visitPayload ? <div className="status-pill completed">Historical record · read only</div> : null}
              </div>
            </div>


            {visitPayload ? (
              <div className="opd-summary-grid">
                <article className="content-card inset-card">
                  <h3>Visit snapshot</h3>
                  <div className="opd-snapshot-list">
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">OPD Number</span>
                      <span className="opd-snapshot-value">{visitPayload.visit.opdNumber}</span>
                    </div>
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Doctor</span>
                      <span className="opd-snapshot-value">{visitPayload.doctorName}</span>
                    </div>
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Date</span>
                      <span className="opd-snapshot-value">{visitPayload.visit.visitDate}</span>
                    </div>
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Chief Complaint</span>
                      <span className="opd-snapshot-value">{visitPayload.visit.chiefComplaint || "General consultation"}</span>
                    </div>
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Status</span>
                      <span className="opd-snapshot-value">{visitPayload.visit.status}</span>
                    </div>
                    {/* <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Workflow</span>
                      <span className="opd-snapshot-value">{workflowStageLabels[workflowStageForVisit(visitPayload.visit)] || "Reception entry"}</span>
                    </div>
                    <div className="opd-snapshot-item">
                      <span className="opd-snapshot-label">Fee</span>
                      <span className="opd-snapshot-value">Rs. {visitPayload.visit.consultationFee}</span>
                    </div> */}
                  </div>
                </article>

                {/* <article className="content-card inset-card">
                  <h3>Quick actions</h3>
                  <div className="quick-actions">
                    <div className="quick-action">
                      <strong>Visit mode</strong>
                      <div className="timeline-copy">
                        {selectedQueueItem?.source || "Reception"} sourced booking.
                      </div>
                    </div>
                    <div className="quick-action">
                      <strong>Next step</strong>
                      <div className="timeline-copy">
                        Reception saves and forwards to screening. Screening saves vitals and physical examination,
                        then forwards to the doctor. Doctor completes prescription and forwards to pharmacy and reception.
                      </div>
                    </div>
                  </div>
                </article> */}
              </div>
            ) : (
              <div className="empty-state">
                Start a visit from the queue to open the OPD consultation workspace.
              </div>
            )}
          </article>

          <aside className="content-card opd-queue-panel opd-top-queue">
            <div className="section-header queue-header">
              <div>
                <div className="eyebrow">Queue Board</div>
                <h3>Doctor-wise OPD queue</h3>
              </div>
              <select className="queue-doctor-filter" value={filterDoctorId} onChange={handleDoctorFilter}>
                <option value="">All doctors</option>
                {masters.doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="queue-list">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={`queue-item selectable-card${
                    selectedQueueItem?.id === item.id ? " selected-card" : ""
                  }`}
                >
                  <div>
                    <strong>Token {item.tokenNumber}</strong>
                    <div className="timeline-copy">{item.patientName}</div>
                    <div className="timeline-copy"><strong>UHID:</strong> {item.patientUhid || "Not assigned"}</div>
                    <div className="timeline-copy">{item.doctorName}</div>
                    <div className="timeline-copy">{item.appointmentTime} - {item.department}</div>
                    <div className="timeline-copy">{workflowStageLabels[workflowStageForQueueItem(item)] || "Reception entry"}</div>
                  </div>
                  <div className="queue-actions">
                    <span className={`status-pill ${item.visitStatus || item.status}`}>
                      {item.visitStatus || item.status}
                    </span>
                    <Button variant="secondary" onClick={() => { setHistoricalView(false); startConsultation(item); }} disabled={!item.visitId && !canStartVisit}>
                      {item.visitId ? "Open" : "Start"}
                    </Button>
                  </div>
                </div>
              ))}

              {!queue.length ? <div className="empty-state">No OPD queue items for the selected doctor today.</div> : null}
            </div>
          </aside>

          <section className="consultation-column opd-panels-column">
          {visitPayload ? (
            <>
              <div className="opd-tabs">
                {opdTabs.map((tab) => (
                  <button
                    className={activeOpdTab === tab ? "active" : ""}
                    key={tab}
                    type="button"
                    onClick={() => setActiveOpdTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeOpdTab === "General Examination" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">General Examination</div>
                    <h3>Modern medicine clinical examination</h3>
                  </div>
                  <Button onClick={saveVitalsAction} disabled={!canSaveVitals}>Save Examination &amp; Forward</Button>
                </div>

                {pendingVitalsDraft ? (
                  <div className="draft-banner">
                    <div>
                      <strong>Unsaved general examination draft found</strong>
                      <p>
                        Examination findings were entered for this visit but not saved, possibly due to a power cut
                        or closed browser. Restore them, or discard to keep the currently saved record.
                      </p>
                    </div>
                    <div className="draft-banner-actions">
                      <Button onClick={restoreVitalsDraft}>Restore draft</Button>
                      <Button variant="secondary" onClick={discardVitalsDraft}>Discard</Button>
                    </div>
                  </div>
                ) : null}

                <GeneralExaminationForm form={vitalsForm} onChange={handleVitalsChange} />
              </article>
              ) : null}

              {activeOpdTab === "Systemic Examination" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Systemic Examination</div>
                    <h3>Modern medicine system-wise examination</h3>
                  </div>
                  <Button onClick={saveSystemicExaminationAction} disabled={!canClinicalDocument}>Save &amp; Forward</Button>
                </div>

                {pendingSystemicDraft ? (
                  <div className="draft-banner">
                    <div>
                      <strong>Unsaved systemic examination draft found</strong>
                      <p>The earlier entries were recovered after an interrupted or closed session. Restore them, or discard the draft.</p>
                    </div>
                    <div className="draft-banner-actions">
                      <Button onClick={restoreSystemicDraft}>Restore draft</Button>
                      <Button variant="secondary" onClick={discardSystemicDraft}>Discard</Button>
                    </div>
                  </div>
                ) : null}

                <SystemicExaminationForm form={systemicForm} onFieldChange={handleSystemicChange} />
              </article>
              ) : null}

              {activeOpdTab === "History Taking" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">History Taking</div>
                    <h3>Structured complaints and clinical history</h3>
                  </div>
                  <Button onClick={saveHistoryTakingAction} disabled={!canClinicalDocument}>Save &amp; Forward</Button>
                </div>

                {pendingHistoryDraft ? (
                  <div className="draft-banner">
                    <div>
                      <strong>Unsaved history-taking draft found</strong>
                      <p>The earlier entries were recovered after an interrupted or closed session. Restore them, or discard the draft.</p>
                    </div>
                    <div className="draft-banner-actions">
                      <Button onClick={restoreHistoryDraft}>Restore draft</Button>
                      <Button variant="secondary" onClick={discardHistoryDraft}>Discard</Button>
                    </div>
                  </div>
                ) : null}

                <HistoryTakingForm form={historyForm} onFieldChange={handleHistoryChange} />
              </article>
              ) : null}

              {activeOpdTab === "Prescription" ? (
              <article className="content-card compact-form-card prescription-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Prescription</div>
                    <h3>Starter prescription builder</h3>
                  </div>
                  <Button onClick={savePrescriptionAction} disabled={!canClinicalDocument}>Save Prescription &amp; Forward</Button>
                </div>

                <div className="form-subsection prescription-complaints-top">
                  <div className="prescription-subsection-heading">
                    <h4>Chief complaints</h4>
                    {prescriptionForm.metadata.complaintRows.length < MAX_PRESCRIPTION_COMPLAINTS ? (
                      <Button variant="secondary" onClick={addComplaintRow} disabled={!canClinicalDocument}>+ Add complaint</Button>
                    ) : null}
                  </div>
                  <div className="table-shell compact-table-shell">
                    <table className="data-table compact-table prescription-complaint-editor">
                      <thead>
                        <tr>
                          <th>Complaint</th>
                          <th>Duration</th>
                          <th>Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionForm.metadata.complaintRows.map((row, index) => (
                          <tr key={`complaint-${index}`}>
                            <td><input aria-label={`Complaint ${index + 1}`} value={row.complaint} onChange={(event) => handlePrescriptionRowChange("complaintRows", index, "complaint", event.target.value)} /></td>
                            <td><input aria-label={`Complaint ${index + 1} duration`} value={row.duration} onChange={(event) => handlePrescriptionRowChange("complaintRows", index, "duration", event.target.value)} /></td>
                            <td><input aria-label={`Complaint ${index + 1} severity`} value={row.severity || ""} onChange={(event) => handlePrescriptionRowChange("complaintRows", index, "severity", event.target.value)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="form-grid clinical-form-grid">
                  <div className="field field-span-2">
                    <label>Diagnosis</label>
                    <input name="diagnosis" value={prescriptionForm.diagnosis} onChange={handlePrescriptionChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Ayurvedic diagnosis</label>
                    <input
                      name="diagnosisAyurvedic"
                      value={prescriptionForm.diagnosisAyurvedic}
                      onChange={handlePrescriptionChange}
                    />
                  </div>
                  <div className="field field-span-2">
                    <label>Chikitsa sutra</label>
                    <input
                      name="chikitsaSutra"
                      value={prescriptionForm.chikitsaSutra}
                      onChange={handlePrescriptionChange}
                    />
                  </div>
                  <div className="field field-span-2">
                    <label>Diet To Take</label>
                    <MultiSelectPicker
                      value={prescriptionForm.dietToTake}
                      options={masters.dietItems.take}
                      onChange={(items) => handleDietChange("dietToTake", items)}
                      placeholder="Search foods to advise"
                      emptyLabel="No matching item in the diet master"
                      emptySelectionLabel="No foods added yet"
                      getOptionMeta={(item) => item.nameHi || ""}
                      getSearchText={(item) => [item.name, item.nameHi].filter(Boolean).join(" ")}
                      allowCustom
                      disabled={!canClinicalDocument}
                    />
                  </div>
                  <div className="field field-span-2">
                    <label>Diet To Avoid</label>
                    <MultiSelectPicker
                      value={prescriptionForm.dietToAvoid}
                      options={masters.dietItems.avoid}
                      onChange={(items) => handleDietChange("dietToAvoid", items)}
                      placeholder="Search foods to avoid"
                      emptyLabel="No matching item in the diet master"
                      emptySelectionLabel="No foods added yet"
                      getOptionMeta={(item) => item.nameHi || ""}
                      getSearchText={(item) => [item.name, item.nameHi].filter(Boolean).join(" ")}
                      allowCustom
                      disabled={!canClinicalDocument}
                    />
                  </div>
                  <div className="field">
                    <label>Follow-up date</label>
                    <input
                      name="followUpDate"
                      type="date"
                      value={prescriptionForm.followUpDate}
                      onChange={handlePrescriptionChange}
                    />
                  </div>
                  <div className="field">
                    <label>Patient category</label>
                    <select value={prescriptionForm.metadata.patientDetails.category} onChange={(event) => handlePrescriptionMetadataChange("patientDetails", "category", event.target.value)}>
                      <option value="">Not specified</option>
                      <option value="general">General</option>
                      <option value="obc">OBC</option>
                      <option value="sc">SC</option>
                      <option value="st">ST</option>
                    </select>
                  </div>
                </div>

                <div className="form-subsection">
                  <h4>Clinical diagnosis</h4>
                  <div className="table-shell compact-table-shell">
                    <table className="data-table compact-table prescription-diagnosis-editor">
                      <thead>
                        <tr>
                          <th>Diagnosis</th>
                          <th>ICD-11 code</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionForm.metadata.diagnosisRows.map((row, index) => (
                          <tr key={`diagnosis-${index}`}>
                            <td><input value={row.diagnosis} onChange={(event) => handlePrescriptionRowChange("diagnosisRows", index, "diagnosis", event.target.value)} /></td>
                            <td><input value={row.icdCode} onChange={(event) => handlePrescriptionRowChange("diagnosisRows", index, "icdCode", event.target.value)} /></td>
                            <td>
                              <select value={row.type} onChange={(event) => handlePrescriptionRowChange("diagnosisRows", index, "type", event.target.value)}>
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="form-subsection prescription-medicine-section">
                  <div className="prescription-subsection-heading">
                    <h4>Medicines</h4>
                  </div>
                  <div className="medicine-stack">
                  {prescriptionForm.medicines.map((medicine, index) => (
                    <div className="medicine-card" key={`${medicine.id || "new"}-${index}`}>
                      <div className="medicine-card-head">
                        <span className="medicine-card-title">Medicine {index + 1}</span>
                        <button
                          type="button"
                          className="medicine-remove"
                          onClick={() => removeMedicineRow(index)}
                          disabled={!canClinicalDocument}
                          aria-label={`Remove medicine ${index + 1}`}
                          title="Remove medicine"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="form-grid medicine-grid">
                        <div className="field medicine-name-field">
                          <label>Medicine name</label>
                          <SearchableSelect
                            value={medicine.medicineId}
                            customValue={medicine.medicineName}
                            options={masters.medicines}
                            onChange={(value) => handleMedicineChange(index, "medicineId", value)}
                            onCustomValueChange={(value) => handleMedicineChange(index, "medicineName", value)}
                            placeholder="Search medicine"
                            emptyLabel="No master match; typed name will be saved"
                            getOptionLabel={(item) => item.name}
                            getOptionMeta={(item) => `${item.formulation || ""} ${item.category || ""}`.trim()}
                            getSearchText={(item) => [item.name, item.formulation, item.category, item.unit].filter(Boolean).join(" ")}
                          />
                        </div>
                        <div className="field">
                          <label>Dose</label>
                          <input value={medicine.dose} onChange={(event) => handleMedicineChange(index, "dose", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Strength</label>
                          <input value={medicine.strength || ""} onChange={(event) => handleMedicineChange(index, "strength", event.target.value)} placeholder="e.g. 500 mg" />
                        </div>
                        <div className="field">
                          <label>Frequency</label>
                          <select
                            value={medicine.frequency}
                            onChange={(event) => handleMedicineChange(index, "frequency", event.target.value)}
                          >
                            {masters.frequencies.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Route</label>
                          <select
                            value={medicine.route}
                            onChange={(event) => handleMedicineChange(index, "route", event.target.value)}
                          >
                            {masters.routes.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Timing</label>
                          <input value={medicine.timing} onChange={(event) => handleMedicineChange(index, "timing", event.target.value)} />
                        </div>
                        <div className="field">
                          <label>Duration days</label>
                          <input
                            value={medicine.durationDays}
                            onChange={(event) => handleMedicineChange(index, "durationDays", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Anupana</label>
                          <input
                            value={medicine.anupana}
                            onChange={(event) => handleMedicineChange(index, "anupana", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label>Qty</label>
                          <input
                            value={medicine.quantityDispensed}
                            onChange={(event) => handleMedicineChange(index, "quantityDispensed", event.target.value)}
                          />
                        </div>
                        <div className="field medicine-instructions-field">
                          <label>Special instructions</label>
                          <input
                            value={medicine.specialInstructions}
                            onChange={(event) => handleMedicineChange(index, "specialInstructions", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>

                  <div className="medicine-add-row">
                    <Button variant="secondary" onClick={addMedicineRow} disabled={!canClinicalDocument}>
                      + Add medicine
                    </Button>
                  </div>
                </div>

                <div className="form-subsection">
                  <h4>Therapy, diet, and lifestyle</h4>
                  <div className="form-grid therapy-grid">
                    {prescriptionForm.metadata.therapyPlan.yoga.map((row, index) => (
                      <div className="field field-span-2" key={`yoga-${index}`}>
                        <label>Yoga and pranayama plan</label>
                        <input value={row.asanas} onChange={(event) => handleTherapyRowChange("yoga", index, "asanas", event.target.value)} />
                        <input value={row.pranayama} onChange={(event) => handleTherapyRowChange("yoga", index, "pranayama", event.target.value)} />
                        <input value={row.durationMinutes} placeholder="Minutes daily / times per week" onChange={(event) => handleTherapyRowChange("yoga", index, "durationMinutes", event.target.value)} />
                      </div>
                    ))}
                    {prescriptionForm.metadata.therapyPlan.panchkarma.map((row, index) => (
                      <div className="field" key={`panchkarma-${index}`}>
                        <label>{row.procedure}</label>
                        <input value={row.frequency} placeholder="Frequency" onChange={(event) => handleTherapyRowChange("panchkarma", index, "frequency", event.target.value)} />
                        <input value={row.duration} placeholder="Duration" onChange={(event) => handleTherapyRowChange("panchkarma", index, "duration", event.target.value)} />
                        <input value={row.durationDays || ""} placeholder="No. of days" onChange={(event) => handleTherapyRowChange("panchkarma", index, "durationDays", event.target.value)} />
                      </div>
                    ))}
                    {prescriptionForm.metadata.therapyPlan.specialized.map((row, index) => (
                      <div className="field" key={`specialized-${index}`}>
                        <label>{row.therapy}</label>
                        <input value={row.sessions} placeholder="Sessions" onChange={(event) => handleTherapyRowChange("specialized", index, "sessions", event.target.value)} />
                        <input value={row.duration} placeholder="Duration" onChange={(event) => handleTherapyRowChange("specialized", index, "duration", event.target.value)} />
                      </div>
                    ))}
                    {/* <div className="field">
                      <label>Recommended diet</label>
                      <input value={prescriptionForm.metadata.dietPlan.recommendedDiet} onChange={(event) => handlePrescriptionMetadataChange("dietPlan", "recommendedDiet", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Foods to include</label>
                      <input value={prescriptionForm.metadata.dietPlan.foodsToInclude} onChange={(event) => handlePrescriptionMetadataChange("dietPlan", "foodsToInclude", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Foods to avoid</label>
                      <input value={prescriptionForm.metadata.dietPlan.foodsToAvoid} onChange={(event) => handlePrescriptionMetadataChange("dietPlan", "foodsToAvoid", event.target.value)} />
                    </div> */}
                    <div className="field">
                      <label>Exercise type</label>
                      <input value={prescriptionForm.metadata.lifestylePlan.activityType} onChange={(event) => handlePrescriptionMetadataChange("lifestylePlan", "activityType", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Exercise frequency</label>
                      <input value={prescriptionForm.metadata.lifestylePlan.frequency} onChange={(event) => handlePrescriptionMetadataChange("lifestylePlan", "frequency", event.target.value)} />
                    </div>
                    <div className="field"><label>Follow-up interval</label><select value={prescriptionForm.metadata.followUpMonitoring.interval} onChange={(event) => handlePrescriptionMetadataChange("followUpMonitoring", "interval", event.target.value)}><option value="">Select</option><option value="1-week">1 week</option><option value="2-weeks">2 weeks</option><option value="1-month">1 month</option></select></div>
                    <div className="field field-span-2">
                      <label>Monitoring parameters</label>
                      <div className="monitoring-parameter-grid">
                        {[["bp", "Blood pressure"], ["weight", "Weight"], ["fbs", "Fasting blood sugar"], ["symptoms", "Symptoms / clinical response"]].map(([value, label]) => {
                          const isSelected = prescriptionForm.metadata.followUpMonitoring.parameters.includes(value);
                          return (
                            <label className={`monitoring-parameter-option ${isSelected ? "is-selected" : ""}`} key={value}>
                              <input type="checkbox" checked={isSelected} onChange={(event) => handlePrescriptionMetadataListChange("followUpMonitoring", "parameters", value, event.target.checked)} />
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="field field-span-2"><label>Other monitoring parameters</label><input value={prescriptionForm.metadata.followUpMonitoring.others} onChange={(event) => handlePrescriptionMetadataChange("followUpMonitoring", "others", event.target.value)} /></div>
                  </div>
                </div>
              </article>
              ) : null}

              {activeOpdTab === "Lab Orders" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Lab Orders</div>
                    <h3>Order laboratory and diagnostic tests</h3>
                  </div>
                  <Button onClick={createLabOrderAction} disabled={!canClinicalDocument || labOrderForm.tests.length === 0}>Create Lab Order</Button>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Priority</label>
                    <select name="priority" value={labOrderForm.priority} onChange={handleLabOrderChange}>
                      <option value="routine">routine</option>
                      <option value="urgent">urgent</option>
                      <option value="stat">stat</option>
                    </select>
                  </div>
                  <div className="field field-span-2">
                    <div className="lab-order-selection-heading">
                      <label>Choose tests and investigations</label>
                      <span>{labOrderForm.tests.length} selected</span>
                    </div>
                    <div className="lab-order-groups">
                      {labOrderGroups.map((group) => (
                        <section className="lab-order-group" key={group.name}>
                          <h4>{group.name}</h4>
                          <div className="lab-order-checkboxes">
                            {group.tests.map((test) => (
                              <label
                                key={test.id}
                                className={`checkbox-chip lab-order-checkbox ${labOrderForm.tests.includes(test.id) ? "is-selected" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  name="tests"
                                  value={test.id}
                                  checked={labOrderForm.tests.includes(test.id)}
                                  onChange={handleLabOrderChange}
                                />
                                <span>
                                  <strong>{test.name}</strong>
                                  {Number(test.price) > 0 ? <small>Rs. {test.price}</small> : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                </div>

                {visitPayload.labOrders?.length ? (
                  <div className="stack-list">
                    {visitPayload.labOrders.map((order) => (
                      <div key={order.id} className="quick-action">
                        <strong>{order.orderNumber}</strong>
                        <div className="timeline-copy">{order.tests.map((test) => test.testName).join(", ")}</div>
                        <div className="timeline-copy">Status: {order.status}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
              ) : null}

              {/* OPD billing is intentionally disabled for now. All billing is handled by reception or pharmacy.
              {activeOpdTab === "Billing" ? (
                <article className="content-card compact-form-card">
                  <div className="section-header">
                    <div>
                      <div className="eyebrow">Billing</div>
                      <h3>Charges for this visit</h3>
                    </div>
                  </div>
                </article>
              ) : null}
              */}

              {activeOpdTab === "Printable Rx" ? (
              <article className="content-card print-sheet-card">
                <div className="section-header no-print">
                  <div>
                    <div className="eyebrow">OPD Prescription</div>
                    <h3>Printable patient copy</h3>
                  </div>
                  <div className="action-row">
                    <Button variant="secondary" onClick={() => saveDischargeSummaryAction("draft")} disabled={!canClinicalDocument}>Save Doctor Note</Button>
                    <Button onClick={() => saveDischargeSummaryAction("forwarded")} disabled={!canClinicalDocument}>Save & Forward</Button>
                    <Button variant="secondary" onClick={printOpdPrescription} disabled={!canPrintPrescription || !visitPayload.prescription}>Print OPD</Button>
                  </div>
                </div>

                <div className="form-grid discharge-form-grid no-print">
                  <div className="field">
                    <label>Prescription note date</label>
                    <input type="date" name="summaryDate" value={dischargeForm.summaryDate} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>Patient condition</label>
                    <input name="conditionOnDischarge" value={dischargeForm.conditionOnDischarge} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Doctor note</label>
                    <textarea name="clinicalCourse" value={dischargeForm.clinicalCourse} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Final / working diagnosis</label>
                    <textarea name="finalDiagnosis" value={dischargeForm.finalDiagnosis} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Advice to patient</label>
                    <textarea name="advice" value={dischargeForm.advice} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>Follow-up date</label>
                    <input type="date" name="followUpDate" value={dischargeForm.followUpDate} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>OPD room / desk</label>
                    <input value={dischargeForm.metadata.patient.wardRoom} onChange={(event) => handleDischargeMetadataChange("patient", "wardRoom", event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Overall status</label>
                    <input value={dischargeForm.metadata.clinicalImprovement.overallStatus} onChange={(event) => handleDischargeMetadataChange("clinicalImprovement", "overallStatus", event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Symptom relief</label>
                    <input value={dischargeForm.metadata.clinicalImprovement.symptomRelief} onChange={(event) => handleDischargeMetadataChange("clinicalImprovement", "symptomRelief", event.target.value)} />
                  </div>
                </div>

                <OpdPrescriptionPrint
                  visitPayload={visitPayload}
                  selectedQueueItem={selectedQueueItem}
                  vitalsForm={vitalsForm}
                  assessmentForm={assessmentForm}
                  prescriptionForm={prescriptionForm}
                />

                <div className="legacy-opd-prescription-print-sheet no-print" hidden>
                  <div className="print-hospital-name">SHANTI-RATNAM AYUSH INSTITUTE OF INDIAN MEDICAL SCIENCES</div>
                  <div className="print-hospital-subtitle">Lane No. 3, Nehanagar, Makronia, Sagar (M.P) | 07582357300, 8989927755 | www.shantiratnam.com</div>
                  <h2>OPD Prescription</h2>

                  <section className="opd-print-block">
                    <h3>Patient Identification</h3>
                    <div className="print-grid">
                      <div><strong>Patient Name:</strong> {visitPayload.visit.patientName}</div>
                      <div><strong>UID / MRN:</strong> {selectedQueueItem?.patientId || visitPayload.visit.patientId || "-"}</div>
                      <div><strong>OPD No.:</strong> {visitPayload.visit.opdNumber}</div>
                      <div><strong>Date / Time:</strong> {visitPayload.visit.visitDate} {selectedQueueItem?.appointmentTime || ""}</div>
                      <div><strong>Age / Gender:</strong> {selectedQueueItem?.patientAge || "-"} / {selectedQueueItem?.patientGender || "-"}</div>
                      <div><strong>Contact:</strong> {selectedQueueItem?.patientMobile || "-"}</div>
                      <div><strong>Email:</strong> -</div>
                      <div><strong>Doctor:</strong> {visitPayload.doctorName}</div>
                    </div>
                  </section>

                  <section className="opd-print-block">
                    <h3>Vital Signs & Physical Examination</h3>
                    <div className="print-grid">
                      <div><strong>BP:</strong> {vitalsForm.vitalsBp || "-"}</div>
                      <div><strong>Pulse Rate:</strong> {vitalsForm.vitalsPulse || "-"} BPM</div>
                      <div><strong>Temp / SpO2:</strong> {vitalsForm.vitalsTemp || "-"} / {vitalsForm.vitalsSpo2 || "-"}%</div>
                      <div><strong>Height / Weight:</strong> {vitalsForm.vitalsHeight || "-"} / {vitalsForm.vitalsWeight || "-"}</div>
                      <div><strong>Respiratory Rate:</strong> {vitalsForm.vitalsRr || "-"}</div>
                    </div>
                    <p><strong>Physical Exam:</strong> {vitalsForm.physicalExam || "-"}</p>
                  </section>

                  <section className="opd-print-block">
                    <h3>Ayurvedic Assessment</h3>
                    <div className="print-grid">
                      <div><strong>Dominant Dosha:</strong> {assessmentForm.prakritiDominant || "-"}</div>
                      <div><strong>Vata / Pitta / Kapha:</strong> {assessmentForm.prakritiVata || "-"} / {assessmentForm.prakritiPitta || "-"} / {assessmentForm.prakritiKapha || "-"}</div>
                      <div><strong>Nadi Type:</strong> {assessmentForm.nadiType || "-"}</div>
                      <div><strong>Agni / Koshtha:</strong> {assessmentForm.agniStatus || "-"} / {assessmentForm.koshthaNature || "-"}</div>
                    </div>
                    <p><strong>Nadi Pariksha:</strong> {assessmentForm.nadiPariksha || "-"}</p>
                    <p><strong>Vikriti:</strong> {assessmentForm.vikritiAssessment || "-"}</p>
                    <p><strong>Observations:</strong> {assessmentForm.observations || "-"}</p>
                  </section>

                  <section className="opd-print-block">
                    <h3>Clinical Diagnosis (ICD-11)</h3>
                    <table className="print-table">
                      <thead>
                        <tr><th>S.No.</th><th>Diagnosis</th><th>ICD-11 Code</th><th>Primary / Sec.</th></tr>
                      </thead>
                      <tbody>
                        {prescriptionForm.metadata.diagnosisRows.map((row, index) => (
                          <tr key={`print-diagnosis-${index}`}>
                            <td>{index + 1}</td>
                            <td>{row.diagnosis || (index === 0 ? prescriptionForm.diagnosis : "")}</td>
                            <td>{row.icdCode}</td>
                            <td>{row.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  <section className="opd-print-block">
                    <h3>Main Complaint With Duration</h3>
                    <table className="print-table">
                      <thead>
                        <tr><th>S.No.</th><th>Complaint</th><th>Duration</th></tr>
                      </thead>
                      <tbody>
                        {prescriptionForm.metadata.complaintRows.map((row, index) => (
                          <tr key={`print-complaint-${index}`}>
                            <td>{index + 1}</td>
                            <td>{row.complaint}</td>
                            <td>{row.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  <section className="opd-print-block">
                    <h3>Medicines & Formulations</h3>
                    <table className="print-table medicine-print-table">
                      <thead>
                        <tr><th>S.No.</th><th>Medicine Name</th><th>Dosage (Matra)</th><th>Frequency (Kaal)</th><th>Duration (Krama)</th></tr>
                      </thead>
                      <tbody>
                        {prescriptionForm.medicines.map((medicine, index) => (
                          <tr key={`print-medicine-${index}`}>
                            <td>{index + 1}</td>
                            <td>{medicine.medicineName}</td>
                            <td>{medicine.dose}</td>
                            <td>{medicine.frequency}</td>
                            <td>{medicine.durationDays ? `${medicine.durationDays} days` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  <section className="opd-print-block page-break-before">
                    <h3>SR-AIIMS Prescribed Therapy Services</h3>
                    <h4>Yoga & Pranayama Therapy</h4>
                    {prescriptionForm.metadata.therapyPlan.yoga.map((row, index) => (
                      <p key={`print-yoga-${index}`}><strong>Yoga:</strong> {row.asanas || "-"} | <strong>Pranayama:</strong> {row.pranayama || "-"} | <strong>Duration:</strong> {row.durationMinutes || "-"}</p>
                    ))}
                    <h4>Therapeutic Panchkarma & Massage Services</h4>
                    <table className="print-table">
                      <thead><tr><th>Service</th><th>Frequency</th><th>Duration</th><th>No. of Days</th></tr></thead>
                      <tbody>
                        {prescriptionForm.metadata.therapyPlan.panchkarma.map((row, index) => (
                          <tr key={`print-panchkarma-${index}`}><td>{row.procedure}</td><td>{row.frequency}</td><td>{row.duration}</td><td>{row.durationDays || ""}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <h4>Specialized Therapy Services</h4>
                    {prescriptionForm.metadata.therapyPlan.specialized.map((row, index) => (
                      <p key={`print-special-${index}`}><strong>{row.therapy}:</strong> {row.sessions || "-"} sessions, {row.duration || "-"}</p>
                    ))}
                  </section>

                  <section className="opd-print-block">
                    <h3>Disease-Specific Diet Plan</h3>
                    <p><strong>Recommended diet:</strong> {prescriptionForm.metadata.dietPlan.recommendedDiet || prescriptionForm.dietRecommendations || "-"}</p>
                    <p><strong>Foods to include:</strong> {dietNames(prescriptionForm.dietToTake) || prescriptionForm.metadata.dietPlan.foodsToInclude || "-"}</p>
                    <p><strong>Foods to avoid:</strong> {dietNames(prescriptionForm.dietToAvoid) || prescriptionForm.metadata.dietPlan.foodsToAvoid || "-"}</p>
                  </section>

                  <section className="opd-print-block">
                    <h3>Lifestyle Modifications</h3>
                    <p><strong>Exercise & physical activity:</strong> {prescriptionForm.metadata.lifestylePlan.activityType || "-"} {prescriptionForm.metadata.lifestylePlan.frequency || ""}</p>
                    <p><strong>Stress management:</strong> {prescriptionForm.metadata.lifestylePlan.stressManagement || "-"}</p>
                  </section>

                  <section className="opd-print-block">
                    <h3>Follow-up & Monitoring</h3>
                    <p><strong>Date:</strong> {prescriptionForm.followUpDate || dischargeForm.followUpDate || "As advised"} <strong>Type:</strong> Phone / OPD Visit</p>
                    <div className="signature-line">Physician Signature</div>
                  </section>
                </div>
              </article>
              ) : null}

              {activeOpdTab === "Complete" ? (
              <article className="content-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Close Visit</div>
                    <h3>Complete consultation</h3>
                  </div>
                  <div className="action-row">
                    <Button variant="secondary" onClick={() => visitWorkflowAction("hold", "hold visit")}>Hold</Button>
                    <Button variant="secondary" onClick={() => visitWorkflowAction("requeue", "requeue visit")}>Requeue</Button>
                    <Button variant="secondary" onClick={() => visitWorkflowAction("cancel", "cancel visit")}>Cancel</Button>
                    <Button variant="secondary" onClick={() => visitWorkflowAction("reopen", "reopen visit")}>Reopen</Button>
                    <Button onClick={completeConsultationAction} disabled={!canClinicalDocument || !visitPayload.prescription}>Complete & Forward</Button>
                  </div>
                </div>
                <p className="page-copy">
                  Use Complete & Forward after saving the prescription. Pharmacy and reception can then process medicines, payment, and patient copy.
                </p>
              </article>
              ) : null}
            </>
          ) : null}
        </section>
      </section>
    </DashboardLayout>
  );
}
