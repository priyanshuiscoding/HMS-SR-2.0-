import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
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
  saveOpdVitals,
  savePrescription
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
  medicines: [{ ...emptyMedicine }]
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
      setPrescriptionForm({
        ...initialPrescription,
        ...(response.prescription || {}),
        medicines:
          response.prescription?.medicines?.length
            ? response.prescription.medicines
            : [{ ...emptyMedicine }]
      });
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
  const canSaveVitals = ["admin", "reception", "doctor"].includes(user?.role);
  const canClinicalDocument = ["admin", "doctor"].includes(user?.role);
  const canCreateBilling = ["admin", "doctor", "reception"].includes(user?.role);

  const handleDoctorFilter = async (event) => {
    const doctorId = event.target.value;
    setFilterDoctorId(doctorId);
    await loadQueue(doctorId);
  };

  const startConsultation = async (queueItem) => {
    if (!canStartVisit) {
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
      setMessage("Vitals saved.");
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

      <section className="stat-grid">
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
        <aside className="content-card">
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
                  <Button variant="secondary" onClick={() => startConsultation(item)} disabled={!canStartVisit}>
                    {item.visitId ? "Open" : "Start"}
                  </Button>
                </div>
              </div>
            ))}

            {!queue.length ? <div className="empty-state">No OPD queue items for the selected doctor today.</div> : null}
          </div>

          <div className="content-card inset-card" style={{ marginTop: 18 }}>
            <h3>OPD hours and charge</h3>
            <div className="detail-list">
              <div><strong>Mon-Sat:</strong> {masters.operatingHours?.mondayToSaturday?.map((slot) => slot.label).join(", ") || "Not set"}</div>
              <div><strong>Sunday:</strong> {masters.operatingHours?.sunday?.map((slot) => slot.label).join(", ") || "Not set"}</div>
              <div><strong>Consultation:</strong> Rs. {masters.consultationFee || 0}</div>
            </div>
          </div>
        </aside>

        <section className="consultation-column">
          <article className="content-card">
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
              <div className="detail-grid">
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
                        Save vitals first, then assessment, then prescription, and complete the visit.
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
              <article className="content-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Vitals</div>
                    <h3>Clinical vitals capture</h3>
                  </div>
                  <Button onClick={saveVitalsAction} disabled={!canSaveVitals}>Save Vitals</Button>
                </div>

                <div className="form-grid">
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

              <article className="content-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Ayurvedic Assessment</div>
                    <h3>Prakriti and clinical observations</h3>
                  </div>
                  <Button onClick={saveAssessmentAction} disabled={!canClinicalDocument}>Save Assessment</Button>
                </div>

                <div className="form-grid">
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

              <article className="content-card">
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

                <div className="form-grid">
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

                <div className="medicine-stack">
                  {prescriptionForm.medicines.map((medicine, index) => (
                    <div className="medicine-card" key={`${medicine.id || "new"}-${index}`}>
                      <div className="form-grid">
                        <div className="field">
                          <label>Medicine</label>
                          <select
                            value={medicine.medicineId}
                            onChange={(event) => handleMedicineChange(index, "medicineId", event.target.value)}
                          >
                            <option value="">Select medicine</option>
                            {masters.medicines.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
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
              </article>

              <article className="content-card">
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

              <article className="content-card">
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

              <article className="content-card">
                <div className="section-header">
                  <div>
                    <div className="eyebrow">Close Visit</div>
                    <h3>Complete consultation</h3>
                  </div>
                  <Button onClick={completeConsultationAction} disabled={!canClinicalDocument}>Complete Visit</Button>
                </div>
                <p className="page-copy">
                  Use this when the consultation, advice, and prescription have been finalized.
                </p>
              </article>
            </>
          ) : null}
        </section>
      </section>
    </DashboardLayout>
  );
}
