import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { MultiSelectPicker } from "../../components/common/MultiSelectPicker.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { Toast } from "../../components/common/Toast.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  completeOpdVisit,
  createBill,
  createLabOrder,
  createOpdVisit,
  getOpdMasters,
  getOpdQueue,
  getOpdVisit,
  saveAyurvedaAssessment,
  saveOpdDischargeSummary,
  saveOpdVitals,
  savePrescription,
  updateOpdVisitWorkflow
} from "../../services/api.js";

const opdTabs = ["Vitals", "Assessment", "Prescription", "Lab Orders", "Billing", "Printable Rx", "Complete"];

const initialVitals = {
  vitalsBp: "",
  vitalsPulse: "",
  vitalsTemp: "",
  vitalsWeight: "",
  vitalsHeight: "",
  vitalsSpo2: "",
  vitalsRr: "",
  physicalExam: ""
};

const vitalsDraftKey = (visitId) => `hms-opd-vitals-draft-${visitId}`;

function readVitalsDraft(visitId) {
  try {
    const raw = window.localStorage.getItem(vitalsDraftKey(visitId));
    return raw ? { ...initialVitals, ...JSON.parse(raw) } : null;
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

function sameVitals(left, right) {
  return Object.keys(initialVitals).every((field) => (left[field] || "") === (right[field] || ""));
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
  dose: "",
  frequency: "BD",
  route: "oral",
  timing: "",
  durationDays: 10,
  anupana: "",
  quantityDispensed: 0,
  specialInstructions: ""
};

const initialPrescription = {
  diagnosis: "",
  diagnosisAyurvedic: "",
  nidana: "",
  samprapti: "",
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
    complaintRows: Array.from({ length: 8 }, () => ({ complaint: "", duration: "" })),
    therapyPlan: {
      yoga: [{ asanas: "Surya Namaskar, Tadasana, Bhujangasana", pranayama: "Anulom-Vilom, Bhastrika", durationMinutes: "" }],
      panchkarma: [
        { procedure: "Abhyanga", frequency: "", duration: "", durationDays: "" },
        { procedure: "Shiroabhyanga", frequency: "", duration: "", durationDays: "" },
        { procedure: "Nasya", frequency: "", duration: "", durationDays: "" },
        { procedure: "Basti", frequency: "", duration: "", durationDays: "" }
      ],
      specialized: [
        { therapy: "Shirodhara", sessions: "", duration: "" },
        { therapy: "Kizhi", sessions: "", duration: "" },
        { therapy: "Udwarthana", sessions: "", duration: "" }
      ]
    },
    dietPlan: { recommendedDiet: "", foodsToInclude: "", foodsToAvoid: "" },
    lifestylePlan: { activityType: "", frequency: "", duration: "", bestTime: "", precautions: "", stressManagement: "" },
    investigations: { bloodTests: false, imaging: "", specialtyTests: "" }
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

const initialBilling = {
  consultationIncluded: true,
  addLabCharges: true,
  paymentStatus: "unpaid"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dietNames(items) {
  return (items || []).map((item) => item.name).join(", ");
}

function normalizeMedicineNameInput(value) {
  return String(value || "").replace(/^\s*\d+[\).\-\s]+/, "").trimStart();
}

function mergePrescription(prescription) {
  const base = clone(initialPrescription);
  return {
    ...base,
    ...(prescription || {}),
    metadata: {
      ...base.metadata,
      ...(prescription?.metadata || {}),
      therapyPlan: {
        ...base.metadata.therapyPlan,
        ...(prescription?.metadata?.therapyPlan || {})
      },
      dietPlan: {
        ...base.metadata.dietPlan,
        ...(prescription?.metadata?.dietPlan || {})
      },
      lifestylePlan: {
        ...base.metadata.lifestylePlan,
        ...(prescription?.metadata?.lifestylePlan || {})
      },
      investigations: {
        ...base.metadata.investigations,
        ...(prescription?.metadata?.investigations || {})
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
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [prescriptionForm, setPrescriptionForm] = useState(initialPrescription);
  const [dischargeForm, setDischargeForm] = useState(initialDischargeSummary);
  const [filterDoctorId, setFilterDoctorId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [labOrderForm, setLabOrderForm] = useState(initialLabOrder);
  const [billingForm, setBillingForm] = useState(initialBilling);
  const [activeOpdTab, setActiveOpdTab] = useState("Vitals");

  async function loadQueue(doctorId = filterDoctorId) {
    try {
      const response = await getOpdQueue({ doctorId });
      setQueue(response.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to load OPD queue.");
    }
  }

  async function loadVisit(visitId, queueItem) {
    try {
      const response = await getOpdVisit(visitId);
      setSelectedQueueItem(queueItem);
      setVisitPayload(response);
      setActiveOpdTab("Vitals");
      const savedVitals = {
        vitalsBp: response.visit.vitalsBp || "",
        vitalsPulse: response.visit.vitalsPulse || "",
        vitalsTemp: response.visit.vitalsTemp || "",
        vitalsWeight: response.visit.vitalsWeight || "",
        vitalsHeight: response.visit.vitalsHeight || "",
        vitalsSpo2: response.visit.vitalsSpo2 || "",
        vitalsRr: response.visit.vitalsRr || "",
        physicalExam: response.visit.metadata?.physicalExam || ""
      };
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
      const nextPrescription = mergePrescription(response.prescription);
      setPrescriptionForm(nextPrescription);
      setDischargeForm(mergeDischargeSummary(response.dischargeSummary, nextPrescription, response.visit));
      setLabOrderForm(initialLabOrder);
      setBillingForm(initialBilling);
    } catch (apiError) {
      setError(apiError.message || "Unable to load visit details.");
    }
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

  const queueStats = useMemo(() => {
    return {
      total: queue.length,
      waiting: queue.filter((item) => !item.visitStatus || item.visitStatus === "waiting").length,
      active: queue.filter((item) => item.visitStatus === "in_consultation").length,
      done: queue.filter((item) => item.visitStatus === "completed").length
    };
  }, [queue]);
  const canStartVisit = ["admin", "reception", "doctor"].includes(user?.role);
  const canSaveVitals = ["admin", "doctor", "nursing"].includes(user?.role);
  const canClinicalDocument = ["admin", "doctor"].includes(user?.role);
  const canCreateBilling = ["admin", "doctor", "reception"].includes(user?.role);
  const canPrintPrescription = ["admin", "doctor", "reception"].includes(user?.role);

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
    const nextVitals = { ...vitalsForm, [event.target.name]: event.target.value };
    setVitalsForm(nextVitals);

    if (visitPayload?.visit?.id) {
      writeVitalsDraft(visitPayload.visit.id, nextVitals);
    }
  };

  const restoreVitalsDraft = () => {
    if (!pendingVitalsDraft) {
      return;
    }

    setVitalsForm(pendingVitalsDraft);
    setPendingVitalsDraft(null);
    setMessage("Restored the unsaved vitals draft. Review the values, then Save & Forward.");
  };

  const discardVitalsDraft = () => {
    if (visitPayload?.visit?.id) {
      clearVitalsDraft(visitPayload.visit.id);
    }

    setPendingVitalsDraft(null);
  };

  const handleAssessmentChange = (event) => {
    setAssessmentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
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

  const handleInvestigationChange = (field, value) => {
    setPrescriptionForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        investigations: {
          ...(current.metadata?.investigations || {}),
          [field]: value
        }
      }
    }));
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

  const handleBillingChange = (event) => {
    const { name, checked, value, type } = event.target;
    setBillingForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
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
      setError("Only screening/nursing, doctors, and admin can save vitals and physical examination.");
      return;
    }

    setError("");
    try {
      await saveOpdVitals(visitPayload.visit.id, vitalsForm);
      clearVitalsDraft(visitPayload.visit.id);
      setPendingVitalsDraft(null);
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      await loadQueue(filterDoctorId);
      setMessage("Screening saved vitals and physical examination, then forwarded the OPD form to doctor.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save vitals.");
    }
  };

  const saveAssessmentAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canClinicalDocument) {
      setError("You do not have permission to save the Ayurvedic assessment.");
      return;
    }

    setError("");
    try {
      await saveAyurvedaAssessment(visitPayload.visit.id, assessmentForm);
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      setMessage("Ayurvedic assessment saved.");
    } catch (apiError) {
      setError(apiError.message || "Unable to save assessment.");
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
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      // Typed diet items become master entries on save; refresh so they are
      // suggested straight away instead of only after a page reload.
      await loadMasters();
      setMessage("Prescription saved. Complete the visit to forward it to pharmacy and reception.");
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
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
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
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      setMessage("Consultation completed and forwarded to pharmacy and reception.");
    } catch (apiError) {
      setError(apiError.message || "Unable to complete consultation.");
    }
  };

  const visitWorkflowAction = async (action, label = action) => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!["admin", "doctor", "reception", "nursing"].includes(user?.role)) {
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
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
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
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      setLabOrderForm(initialLabOrder);
      setMessage("Lab order created.");
    } catch (apiError) {
      setError(apiError.message || "Unable to create lab order.");
    }
  };

  const createBillAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canCreateBilling) {
      setError("You do not have permission to create OPD bills.");
      return;
    }

    if (visitPayload.bills?.some((bill) => bill.billType === "opd")) {
      setError("An OPD bill has already been generated for this visit.");
      return;
    }

    setError("");
    try {
      const items = [];

      if (billingForm.consultationIncluded) {
        items.push({
          description: "OPD Consultation Fee",
          category: "consultation",
          quantity: 1,
          unitPrice: Number(visitPayload.visit.consultationFee || 0),
          amount: Number(visitPayload.visit.consultationFee || 0)
        });
      }

      if (billingForm.addLabCharges) {
        visitPayload.labOrders.forEach((order) => {
          order.tests.forEach((test) => {
            const master = masters.labTests.find((entry) => entry.id === test.testId);
            items.push({
              description: test.testName,
              category: "lab",
              quantity: 1,
              unitPrice: Number(master?.price || 0),
              amount: Number(master?.price || 0)
            });
          });
        });
      }

      await createBill({
        patientId: visitPayload.visit.patientId,
        patientName: visitPayload.visit.patientName,
        visitId: visitPayload.visit.id,
        billType: "opd",
        items,
        paymentStatus: billingForm.paymentStatus,
        createdBy: visitPayload.visit.doctorId
      });
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      setMessage("Bill generated.");
    } catch (apiError) {
      setError(apiError.message || "Unable to generate bill.");
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
          <div className="stat-note">Pending vitals or start</div>
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

      <section className="opd-grid opd-top-grid">
        <article className="content-card opd-workspace-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Consultation Workspace</div>
                <h3>
                  {visitPayload?.visit?.patientName || "Select or start a visit from the queue"}
                </h3>
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
                    <div className="timeline-copy">{item.doctorName}</div>
                    <div className="timeline-copy">{item.appointmentTime} - {item.department}</div>
                    <div className="timeline-copy">{workflowStageLabels[workflowStageForQueueItem(item)] || "Reception entry"}</div>
                  </div>
                  <div className="queue-actions">
                    <span className={`status-pill ${item.visitStatus || item.status}`}>
                      {item.visitStatus || item.status}
                    </span>
                    <Button variant="secondary" onClick={() => startConsultation(item)} disabled={!item.visitId && !canStartVisit}>
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

              {activeOpdTab === "Vitals" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Vitals</div>
                    <h3>Clinical vitals capture</h3>
                  </div>
                  <Button onClick={saveVitalsAction} disabled={!canSaveVitals}>Save & Forward</Button>
                </div>

                {pendingVitalsDraft ? (
                  <div className="draft-banner">
                    <div>
                      <strong>Unsaved vitals draft found</strong>
                      <p>
                        Vitals were typed for this visit but never saved, possibly due to a power cut or a closed
                        browser. Restore them, or discard to keep the currently saved values.
                      </p>
                    </div>
                    <div className="draft-banner-actions">
                      <Button onClick={restoreVitalsDraft}>Restore draft</Button>
                      <Button variant="secondary" onClick={discardVitalsDraft}>Discard</Button>
                    </div>
                  </div>
                ) : null}

                <div className="form-grid vitals-grid">
                  <div className="field">
                    <label>BP</label>
                    <input name="vitalsBp" value={vitalsForm.vitalsBp} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>Pulse</label>
                    <input name="vitalsPulse" value={vitalsForm.vitalsPulse} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>Temperature</label>
                    <input name="vitalsTemp" value={vitalsForm.vitalsTemp} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>Weight</label>
                    <input name="vitalsWeight" value={vitalsForm.vitalsWeight} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>Height</label>
                    <input name="vitalsHeight" value={vitalsForm.vitalsHeight} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>SpO2</label>
                    <input name="vitalsSpo2" value={vitalsForm.vitalsSpo2} onChange={handleVitalsChange} />
                  </div>
                  <div className="field">
                    <label>Respiratory rate</label>
                    <input name="vitalsRr" value={vitalsForm.vitalsRr} onChange={handleVitalsChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Physical examination</label>
                    <textarea name="physicalExam" value={vitalsForm.physicalExam} onChange={handleVitalsChange} />
                  </div>
                </div>
              </article>
              ) : null}

              {activeOpdTab === "Assessment" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Ayurvedic Assessment</div>
                    <h3>Prakriti and clinical observations</h3>
                  </div>
                  <Button onClick={saveAssessmentAction} disabled={!canClinicalDocument}>Save Assessment</Button>
                </div>

                <div className="form-grid clinical-form-grid">
                  <div className="field">
                    <label>Prakriti Vata</label>
                    <input name="prakritiVata" value={assessmentForm.prakritiVata} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field">
                    <label>Prakriti Pitta</label>
                    <input name="prakritiPitta" value={assessmentForm.prakritiPitta} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field">
                    <label>Prakriti Kapha</label>
                    <input name="prakritiKapha" value={assessmentForm.prakritiKapha} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field">
                    <label>Dominant dosha</label>
                    <input name="prakritiDominant" value={assessmentForm.prakritiDominant} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field">
                    <label>Nadi type</label>
                    <select name="nadiType" value={assessmentForm.nadiType} onChange={handleAssessmentChange}>
                      {masters.nadiTypes.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Agni status</label>
                    <select name="agniStatus" value={assessmentForm.agniStatus} onChange={handleAssessmentChange}>
                      {masters.agniStatuses.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Koshtha nature</label>
                    <select name="koshthaNature" value={assessmentForm.koshthaNature} onChange={handleAssessmentChange}>
                      {masters.koshthaTypes.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field field-span-2">
                    <label>Nadi Pariksha</label>
                    <input name="nadiPariksha" value={assessmentForm.nadiPariksha} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Jihva Pariksha</label>
                    <input name="jihvaPariksha" value={assessmentForm.jihvaPariksha} onChange={handleAssessmentChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Vikriti assessment</label>
                    <input
                      name="vikritiAssessment"
                      value={assessmentForm.vikritiAssessment}
                      onChange={handleAssessmentChange}
                    />
                  </div>
                  <div className="field field-span-2">
                    <label>Observations</label>
                    <input name="observations" value={assessmentForm.observations} onChange={handleAssessmentChange} />
                  </div>
                </div>
              </article>
              ) : null}

              {activeOpdTab === "Prescription" ? (
              <article className="content-card compact-form-card prescription-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Prescription</div>
                    <h3>Starter prescription builder</h3>
                  </div>
                  <div className="action-row">
                    <Button variant="secondary" onClick={addMedicineRow} disabled={!canClinicalDocument}>Add Medicine</Button>
                    <Button onClick={savePrescriptionAction} disabled={!canClinicalDocument}>Save Prescription</Button>
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
                    <label>Nidana</label>
                    <input name="nidana" value={prescriptionForm.nidana} onChange={handlePrescriptionChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Samprapti</label>
                    <input name="samprapti" value={prescriptionForm.samprapti} onChange={handlePrescriptionChange} />
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
                </div>

                <div className="form-subsection">
                  <h4>Clinical diagnosis and complaints</h4>
                  <div className="table-shell compact-table-shell">
                    <table className="data-table compact-table">
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

                  <div className="form-grid complaint-grid">
                    {prescriptionForm.metadata.complaintRows.map((row, index) => (
                      <div className="field" key={`complaint-${index}`}>
                        <label>Complaint {index + 1}</label>
                        <input value={row.complaint} onChange={(event) => handlePrescriptionRowChange("complaintRows", index, "complaint", event.target.value)} />
                        <input value={row.duration} placeholder="Duration" onChange={(event) => handlePrescriptionRowChange("complaintRows", index, "duration", event.target.value)} />
                      </div>
                    ))}
                  </div>
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
                        <div className="field">
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
                        <div className="field field-span-2">
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

                <div className="form-subsection">
                  <h4>Therapy, diet, lifestyle, and investigations</h4>
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
                    <div className="field">
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
                    </div>
                    <div className="field">
                      <label>Exercise type</label>
                      <input value={prescriptionForm.metadata.lifestylePlan.activityType} onChange={(event) => handlePrescriptionMetadataChange("lifestylePlan", "activityType", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Exercise frequency</label>
                      <input value={prescriptionForm.metadata.lifestylePlan.frequency} onChange={(event) => handlePrescriptionMetadataChange("lifestylePlan", "frequency", event.target.value)} />
                    </div>
                    <label className="checkbox-chip">
                      <input type="checkbox" checked={prescriptionForm.metadata.investigations.bloodTests} onChange={(event) => handleInvestigationChange("bloodTests", event.target.checked)} />
                      <span>Blood tests advised</span>
                    </label>
                    <div className="field">
                      <label>Imaging</label>
                      <input value={prescriptionForm.metadata.investigations.imaging} onChange={(event) => handleInvestigationChange("imaging", event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Specialty tests</label>
                      <input value={prescriptionForm.metadata.investigations.specialtyTests} onChange={(event) => handleInvestigationChange("specialtyTests", event.target.value)} />
                    </div>
                  </div>
                </div>
              </article>
              ) : null}

              {activeOpdTab === "Lab Orders" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Lab Hook</div>
                    <h3>Order lab tests from consultation</h3>
                  </div>
                  <Button onClick={createLabOrderAction} disabled={!canClinicalDocument}>Create Lab Order</Button>
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
                    <label>Choose tests</label>
                    <div className="checkbox-grid">
                      {masters.labTests.map((test) => (
                        <label key={test.id} className="checkbox-chip">
                          <input
                            type="checkbox"
                            name="tests"
                            value={test.id}
                            checked={labOrderForm.tests.includes(test.id)}
                            onChange={handleLabOrderChange}
                          />
                          <span>{test.name} - Rs. {test.price}</span>
                        </label>
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

              {activeOpdTab === "Billing" ? (
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Billing Hook</div>
                    <h3>Create OPD bill from consultation</h3>
                  </div>
                  <Button onClick={createBillAction} disabled={!canCreateBilling || visitPayload.bills?.some((bill) => bill.billType === "opd")}>Generate Bill</Button>
                </div>

                <div className="form-grid">
                  <label className="checkbox-chip">
                    <input
                      type="checkbox"
                      name="consultationIncluded"
                      checked={billingForm.consultationIncluded}
                      onChange={handleBillingChange}
                    />
                    <span>Include consultation fee</span>
                  </label>
                  <label className="checkbox-chip">
                    <input
                      type="checkbox"
                      name="addLabCharges"
                      checked={billingForm.addLabCharges}
                      onChange={handleBillingChange}
                    />
                    <span>Include lab charges from current visit</span>
                  </label>
                  <div className="field">
                    <label>Payment status</label>
                    <select name="paymentStatus" value={billingForm.paymentStatus} onChange={handleBillingChange}>
                      <option value="unpaid">unpaid</option>
                      <option value="partial">partial</option>
                      <option value="paid">paid</option>
                    </select>
                  </div>
                </div>

                {visitPayload.bills?.length ? (
                  <div className="stack-list">
                    {visitPayload.bills.map((bill) => (
                      <div key={bill.id} className="quick-action">
                        <strong>{bill.billNumber}</strong>
                        <div className="timeline-copy">Total: Rs. {bill.totalAmount}</div>
                        <div className="timeline-copy">Status: {bill.paymentStatus}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
              ) : null}

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

                <div className="opd-prescription-print-sheet">
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
                    <p><strong>Investigations:</strong> {prescriptionForm.metadata.investigations.bloodTests ? "Blood tests; " : ""}{prescriptionForm.metadata.investigations.imaging || ""} {prescriptionForm.metadata.investigations.specialtyTests || ""}</p>
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
