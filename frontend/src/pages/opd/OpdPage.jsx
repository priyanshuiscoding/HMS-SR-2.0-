import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
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

const initialVitals = {
  vitalsBp: "",
  vitalsPulse: "",
  vitalsTemp: "",
  vitalsWeight: "",
  vitalsHeight: "",
  vitalsSpo2: "",
  vitalsRr: ""
};

const initialAssessment = {
  prakritiVata: 0,
  prakritiPitta: 0,
  prakritiKapha: 0,
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
        { procedure: "Abhyanga", frequency: "", duration: "" },
        { procedure: "Shiroabhyanga", frequency: "", duration: "" },
        { procedure: "Nasya", frequency: "", duration: "" },
        { procedure: "Basti", frequency: "", duration: "" }
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
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [prescriptionForm, setPrescriptionForm] = useState(initialPrescription);
  const [dischargeForm, setDischargeForm] = useState(initialDischargeSummary);
  const [filterDoctorId, setFilterDoctorId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [labOrderForm, setLabOrderForm] = useState(initialLabOrder);
  const [billingForm, setBillingForm] = useState(initialBilling);

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
      setVitalsForm({
        vitalsBp: response.visit.vitalsBp || "",
        vitalsPulse: response.visit.vitalsPulse || "",
        vitalsTemp: response.visit.vitalsTemp || "",
        vitalsWeight: response.visit.vitalsWeight || "",
        vitalsHeight: response.visit.vitalsHeight || "",
        vitalsSpo2: response.visit.vitalsSpo2 || "",
        vitalsRr: response.visit.vitalsRr || ""
      });
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

  useEffect(() => {
    async function bootstrap() {
      try {
        const response = await getOpdMasters();
        setMasters(response);
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
  const canSaveVitals = ["admin", "reception", "doctor", "nursing"].includes(user?.role);
  const canClinicalDocument = ["admin", "doctor"].includes(user?.role);
  const canCreateBilling = ["admin", "doctor", "reception"].includes(user?.role);
  const canPrintDischarge = ["admin", "doctor", "reception", "nursing"].includes(user?.role);

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
      setMessage(queueItem.visitId ? "Visit loaded successfully." : "Consultation started successfully.");
    } catch (apiError) {
      setError(apiError.message || "Unable to start consultation.");
    }
  };

  const handleVitalsChange = (event) => {
    setVitalsForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
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
      const medicine = { ...medicines[index], [field]: value };

      if (field === "medicineId") {
        const match = masters.medicines.find((entry) => entry.id === value);
        medicine.medicineName = match?.name || medicine.medicineName;
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

  const saveVitalsAction = async () => {
    if (!visitPayload?.visit?.id) {
      return;
    }

    if (!canSaveVitals) {
      setError("You do not have permission to record vitals.");
      return;
    }

    setError("");
    try {
      await saveOpdVitals(visitPayload.visit.id, vitalsForm);
      await loadVisit(visitPayload.visit.id, selectedQueueItem);
      await loadQueue(filterDoctorId);
      setMessage("Vitals saved and forwarded to doctor.");
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
      setMessage("Prescription saved.");
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

  const printDischargeSummary = () => {
    if (!canPrintDischarge) {
      setError("You do not have permission to print discharge summaries.");
      return;
    }

    window.print();
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
      setMessage("Consultation completed.");
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
      <section className="hero-panel logo-hero">
        <div className="eyebrow">OPD Consultation</div>
        <h2>Queue to consultation in one Shanti-Ratnam clinical workflow.</h2>
        <p>
          Reception can create visits from booked appointments, doctors can capture vitals, record Ayurvedic
          findings, and issue structured prescriptions from the same workspace.
        </p>
      </section>

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

      <section className="opd-grid">
        <aside className="content-card opd-queue-panel">
          <div className="section-header">
            <div>
              <div className="eyebrow">Queue Board</div>
              <h3>Doctor-wise OPD queue</h3>
            </div>
          </div>

          <div className="toolbar">
            <select value={filterDoctorId} onChange={handleDoctorFilter}>
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

          <div className="content-card inset-card opd-hours-card">
            <h3>OPD hours and charge</h3>
            <div className="detail-list">
              <div><strong>Mon-Sat:</strong> {masters.operatingHours?.mondayToSaturday?.map((slot) => slot.label).join(", ") || "Not set"}</div>
              <div><strong>Sunday:</strong> {masters.operatingHours?.sunday?.map((slot) => slot.label).join(", ") || "Not set"}</div>
              <div><strong>Consultation:</strong> Rs. {masters.consultationFee || 0}</div>
            </div>
          </div>
        </aside>

        <section className="consultation-column">
          <article className="content-card opd-workspace-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Consultation Workspace</div>
                <h3>
                  {visitPayload?.visit?.patientName || "Select or start a visit from the queue"}
                </h3>
              </div>
            </div>

            {error ? <div className="error-text">{error}</div> : null}
            {message ? <div className="success-text">{message}</div> : null}

            {visitPayload ? (
              <div className="detail-grid opd-summary-grid">
                <article className="content-card inset-card">
                  <h3>Visit snapshot</h3>
                  <div className="detail-list">
                    <div><strong>OPD number:</strong> {visitPayload.visit.opdNumber}</div>
                    <div><strong>Doctor:</strong> {visitPayload.doctorName}</div>
                    <div><strong>Date:</strong> {visitPayload.visit.visitDate}</div>
                    <div><strong>Chief complaint:</strong> {visitPayload.visit.chiefComplaint || "General consultation"}</div>
                    <div><strong>Status:</strong> {visitPayload.visit.status}</div>
                    <div><strong>Fee:</strong> Rs. {visitPayload.visit.consultationFee}</div>
                  </div>
                </article>

                <article className="content-card inset-card">
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
                        Reception starts the visit, nursing/JR staff save vitals, doctor completes prescription,
                        then discharge summary goes to reception and nursing for print.
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            ) : (
              <div className="empty-state">
                Start a visit from the queue to open the OPD consultation workspace.
              </div>
            )}
          </article>

          {visitPayload ? (
            <>
              <article className="content-card compact-form-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Vitals</div>
                    <h3>Clinical vitals capture</h3>
                  </div>
                  <Button onClick={saveVitalsAction} disabled={!canSaveVitals}>Save & Forward</Button>
                </div>

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
                </div>
              </article>

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
                    <label>Diet recommendations</label>
                    <input
                      name="dietRecommendations"
                      value={prescriptionForm.dietRecommendations}
                      onChange={handlePrescriptionChange}
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
                      <div className="form-grid medicine-grid">
                        <div className="field">
                          <label>Medicine</label>
                          <SearchableSelect
                            value={medicine.medicineId}
                            options={masters.medicines}
                            onChange={(value) => handleMedicineChange(index, "medicineId", value)}
                            placeholder="Search medicine"
                            emptyLabel="No matching medicine"
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

              <article className="content-card print-sheet-card">
                <div className="section-header no-print">
                  <div>
                    <div className="eyebrow">Discharge Summary</div>
                    <h3>Autofilled patient copy</h3>
                  </div>
                  <div className="action-row">
                    <Button variant="secondary" onClick={() => saveDischargeSummaryAction("draft")} disabled={!canClinicalDocument}>Save Draft</Button>
                    <Button onClick={() => saveDischargeSummaryAction("forwarded")} disabled={!canClinicalDocument}>Save & Forward</Button>
                    <Button variant="secondary" onClick={printDischargeSummary} disabled={!canPrintDischarge || !visitPayload.dischargeSummary}>Print</Button>
                  </div>
                </div>

                <div className="form-grid discharge-form-grid no-print">
                  <div className="field">
                    <label>Summary date</label>
                    <input type="date" name="summaryDate" value={dischargeForm.summaryDate} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>Condition on discharge</label>
                    <input name="conditionOnDischarge" value={dischargeForm.conditionOnDischarge} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Clinical course during treatment</label>
                    <textarea name="clinicalCourse" value={dischargeForm.clinicalCourse} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Final diagnosis</label>
                    <textarea name="finalDiagnosis" value={dischargeForm.finalDiagnosis} onChange={handleDischargeChange} />
                  </div>
                  <div className="field field-span-2">
                    <label>Advice at discharge</label>
                    <textarea name="advice" value={dischargeForm.advice} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>Follow-up date</label>
                    <input type="date" name="followUpDate" value={dischargeForm.followUpDate} onChange={handleDischargeChange} />
                  </div>
                  <div className="field">
                    <label>Ward / room</label>
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

                <div className="discharge-print-sheet">
                  <div className="print-hospital-name">SHANTI-RATNAM AYUSH INSTITUTE OF INDIAN MEDICAL SCIENCES</div>
                  <div className="print-hospital-subtitle">Lane No. 3, Nehanagaar, Makaronia, Sagar (M.P)</div>
                  <h2>Discharge Summary</h2>
                  <div className="print-grid">
                    <div><strong>Patient Name:</strong> {visitPayload.visit.patientName}</div>
                    <div><strong>OPD No./MRN:</strong> {visitPayload.visit.opdNumber}</div>
                    <div><strong>Date:</strong> {dischargeForm.summaryDate}</div>
                    <div><strong>Doctor:</strong> {visitPayload.doctorName}</div>
                    <div><strong>Ward/Room:</strong> {dischargeForm.metadata.patient.wardRoom || "OPD"}</div>
                    <div><strong>Follow-up:</strong> {dischargeForm.followUpDate || "As advised"}</div>
                  </div>
                  <h3>Reason for Treatment & Final Diagnosis</h3>
                  <p><strong>Chief Complaint:</strong> {visitPayload.visit.chiefComplaint || "General consultation"}</p>
                  <p>{dischargeForm.finalDiagnosis || prescriptionForm.diagnosis}</p>
                  <h3>Clinical Course During Treatment</h3>
                  <p>{dischargeForm.clinicalCourse || "Managed as per OPD prescription and advised therapy plan."}</p>
                  <h3>Vital Signs at Discharge</h3>
                  <div className="print-grid">
                    <div><strong>BP:</strong> {vitalsForm.vitalsBp || "-"}</div>
                    <div><strong>Pulse:</strong> {vitalsForm.vitalsPulse || "-"}</div>
                    <div><strong>Temp/SPO2:</strong> {vitalsForm.vitalsTemp || "-"} / {vitalsForm.vitalsSpo2 || "-"}</div>
                    <div><strong>Weight:</strong> {vitalsForm.vitalsWeight || "-"}</div>
                  </div>
                  <h3>Discharge Medications & Continuation</h3>
                  <table className="print-table">
                    <thead>
                      <tr><th>Medicine</th><th>Route</th><th>Dosage</th><th>Duration</th><th>Remarks</th></tr>
                    </thead>
                    <tbody>
                      {dischargeForm.metadata.dischargeMedicines.map((medicine, index) => (
                        <tr key={`discharge-medicine-${index}`}>
                          <td>{medicine.medicineName}</td>
                          <td>{medicine.strengthRoute}</td>
                          <td>{medicine.dosage}</td>
                          <td>{medicine.duration}</td>
                          <td>{medicine.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h3>Dietary & Lifestyle Advice</h3>
                  <p><strong>Recommended diet:</strong> {dischargeForm.metadata.dietAdvice.recommendedDiet || "-"}</p>
                  <p><strong>Foods to include:</strong> {dischargeForm.metadata.dietAdvice.foodsToInclude || "-"}</p>
                  <p><strong>Foods to avoid:</strong> {dischargeForm.metadata.dietAdvice.foodsToAvoid || "-"}</p>
                  <p>{dischargeForm.advice}</p>
                  <h3>Follow-up & Monitoring Plan</h3>
                  <p>Follow-up with: OPD / Phone. Date: {dischargeForm.followUpDate || "as advised"}.</p>
                  <div className="signature-line">Consulting Physician Signature</div>
                </div>
              </article>

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
                    <Button onClick={completeConsultationAction} disabled={!canClinicalDocument}>Complete Visit</Button>
                  </div>
                </div>
                <p className="page-copy">
                  Use Complete when the consultation is finalized. Use Hold, Requeue, Cancel, or Reopen when the patient flow changes.
                </p>
              </article>
            </>
          ) : null}
        </section>
      </section>
    </DashboardLayout>
  );
}
