import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import {
  addIpdNote,
  addIpdVitals,
  createIpdAdmission,
  dischargeIpdAdmission,
  getIpdAdmission,
  getIpdAdmissions,
  getIpdMasters,
  getIpdSummary,
  getPatients,
  scheduleIpdTherapy
} from "../../services/api.js";

const initialAdmissionForm = {
  patientId: "",
  roomId: "",
  bedId: "",
  attendingDoctorId: "",
  admissionSource: "opd",
  admissionType: "ipd",
  admissionDate: "",
  admissionTime: "",
  expectedDischargeDate: "",
  reasonForAdmission: "",
  diagnosis: "",
  initialNote: ""
};

const initialNoteForm = {
  category: "progress",
  note: ""
};

const initialVitalsForm = {
  bp: "",
  pulse: "",
  temp: "",
  spo2: "",
  rr: "",
  weight: "",
  notes: ""
};

const initialDischargeForm = {
  dischargeDate: "",
  dischargeTime: "",
  dischargeStatus: "recovered",
  conditionOnDischarge: "stable",
  dischargeNote: "",
  advice: "",
  nextBedStatus: "cleaning",
  createBill: true,
  stayDays: "",
  extraCharge: "",
  extraChargeLabel: "",
  bedNote: ""
};

const initialTherapyForm = {
  packageId: "",
  therapyId: "",
  therapistId: "",
  therapyRoomId: "",
  scheduledDate: "",
  scheduledTime: "",
  estimatedDurationMinutes: "",
  complaint: "",
  preparationNotes: ""
};

function currency(value) {
  return Number(value || 0).toFixed(2);
}

export function IpdPage() {
  const [summary, setSummary] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState({ doctors: [], admissionSources: [], noteCategories: [], dischargeStatuses: [], wardCharges: [], rooms: [], treatmentPackages: [], therapies: [], therapists: [], therapyRooms: [] });
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [filters, setFilters] = useState({ status: "active", search: "" });
  const [admissionForm, setAdmissionForm] = useState(initialAdmissionForm);
  const [noteForm, setNoteForm] = useState(initialNoteForm);
  const [vitalsForm, setVitalsForm] = useState(initialVitalsForm);
  const [dischargeForm, setDischargeForm] = useState(initialDischargeForm);
  const [therapyForm, setTherapyForm] = useState(initialTherapyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData(nextFilters = filters, selectedId = selectedAdmission?.id) {
    try {
      const [summaryResponse, admissionsResponse, mastersResponse, patientsResponse] = await Promise.all([
        getIpdSummary(),
        getIpdAdmissions(nextFilters),
        getIpdMasters(),
        getPatients()
      ]);

      setSummary(summaryResponse);
      setAdmissions(admissionsResponse.items);
      setMasters(mastersResponse);
      setPatients(patientsResponse.items);

      const activeId = selectedId || admissionsResponse.items[0]?.id;
      if (activeId) {
        const detail = await getIpdAdmission(activeId);
        setSelectedAdmission(detail);
      } else {
        setSelectedAdmission(null);
      }

      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load IPD workspace.");
    }
  }

  useEffect(() => {
    loadData({ status: "active", search: "" });
  }, []);

  const roomOptions = useMemo(() => masters.rooms || [], [masters.rooms]);
  const availableBeds = useMemo(() => roomOptions.find((room) => room.roomId === admissionForm.roomId)?.beds || [], [roomOptions, admissionForm.roomId]);

  const handleAdmissionFormChange = (event) => {
    const { name, value } = event.target;
    setAdmissionForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "roomId" ? { bedId: "" } : {})
    }));
  };

  const handleNoteFormChange = (event) => {
    setNoteForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleVitalsFormChange = (event) => {
    setVitalsForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleDischargeFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setDischargeForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleTherapyFormChange = (event) => {
    const { name, value } = event.target;
    setTherapyForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "therapyId") {
        const therapy = masters.therapies?.find((item) => item.id === value);
        next.estimatedDurationMinutes = therapy?.defaultDurationMinutes || "";
      }

      if (name === "packageId") {
        const selectedPackage = masters.treatmentPackages?.find((item) => item.id === value);
        next.preparationNotes = selectedPackage ? `${selectedPackage.name}: ${selectedPackage.overview}` : current.preparationNotes;
      }

      return next;
    });
  };

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    await loadData(nextFilters);
  };

  const openAdmission = async (admissionId) => {
    try {
      const detail = await getIpdAdmission(admissionId);
      setSelectedAdmission(detail);
      setNoteForm(initialNoteForm);
      setVitalsForm(initialVitalsForm);
      setDischargeForm(initialDischargeForm);
      setTherapyForm(initialTherapyForm);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load admission details.");
    }
  };

  const handleCreateAdmission = async (event) => {
    event.preventDefault();

    try {
      const response = await createIpdAdmission(admissionForm);
      setMessage(response.message);
      setAdmissionForm(initialAdmissionForm);
      await loadData(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to admit patient.");
    }
  };

  const handleAddNote = async (event) => {
    event.preventDefault();
    if (!selectedAdmission?.id) {
      return;
    }

    try {
      const response = await addIpdNote(selectedAdmission.id, noteForm);
      setMessage(response.message);
      setSelectedAdmission(response.item);
      setNoteForm(initialNoteForm);
      await loadData(filters, selectedAdmission.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to add clinical note.");
    }
  };

  const handleAddVitals = async (event) => {
    event.preventDefault();
    if (!selectedAdmission?.id) {
      return;
    }

    try {
      const response = await addIpdVitals(selectedAdmission.id, vitalsForm);
      setMessage(response.message);
      setSelectedAdmission(response.item);
      setVitalsForm(initialVitalsForm);
      await loadData(filters, selectedAdmission.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to record vitals.");
    }
  };

  const handleDischarge = async (event) => {
    event.preventDefault();
    if (!selectedAdmission?.id) {
      return;
    }

    try {
      const response = await dischargeIpdAdmission(selectedAdmission.id, {
        ...dischargeForm,
        extraCharge: Number(dischargeForm.extraCharge || 0),
        stayDays: dischargeForm.stayDays ? Number(dischargeForm.stayDays) : ""
      });
      setMessage(response.message);
      setSelectedAdmission(response.item);
      setDischargeForm(initialDischargeForm);
      await loadData(filters, selectedAdmission.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to discharge patient.");
    }
  };

  const handleScheduleTherapy = async (event) => {
    event.preventDefault();
    if (!selectedAdmission?.id) {
      return;
    }

    try {
      const response = await scheduleIpdTherapy(selectedAdmission.id, therapyForm);
      setMessage(response.message);
      setSelectedAdmission(response.item);
      setTherapyForm(initialTherapyForm);
      await loadData(filters, selectedAdmission.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to schedule IPD therapy.");
    }
  };

  const stats = summary || {
    totalAdmissions: 0,
    activeAdmissions: 0,
    dischargedAdmissions: 0,
    todayAdmissions: 0,
    pendingDischarges: 0,
    activeRooms: 0
  };
  const selectedTherapy = masters.therapies?.find((item) => item.id === therapyForm.therapyId);
  const selectedPackage = masters.treatmentPackages?.find((item) => item.id === therapyForm.packageId);

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">IPD</div>
        <h2>Run inpatient admissions, bedside documentation, and discharge billing from one IPD desk.</h2>
        <p>
          This phase completes the inpatient workflow with admission intake, bed allocation, clinical progress notes,
          vitals tracking, and discharge closure that can generate an IPD bill.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Admissions</div><div className="stat-value">{stats.totalAdmissions}</div><div className="stat-note">Total IPD records</div></article>
        <article className="stat-card"><div className="stat-label">Active</div><div className="stat-value">{stats.activeAdmissions}</div><div className="stat-note">Current inpatient load</div></article>
        <article className="stat-card"><div className="stat-label">Pending discharge</div><div className="stat-value">{stats.pendingDischarges}</div><div className="stat-note">Expected out today or earlier</div></article>
        <article className="stat-card"><div className="stat-label">Today</div><div className="stat-value">{stats.todayAdmissions}</div><div className="stat-note">Admissions registered today</div></article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Admit Patient</div><h3>New IPD admission</h3></div></div>
          <form className="form-grid" onSubmit={handleCreateAdmission}>
            <div className="field field-span-2"><label>Patient</label><select name="patientId" value={admissionForm.patientId} onChange={handleAdmissionFormChange}><option value="">Select patient</option>{patients.map((patient) => (<option key={patient.id} value={patient.id}>{patient.uhid} - {patient.firstName} {patient.lastName}</option>))}</select></div>
            <div className="field"><label>Room</label><select name="roomId" value={admissionForm.roomId} onChange={handleAdmissionFormChange}><option value="">Select room</option>{roomOptions.map((room) => (<option key={room.roomId} value={room.roomId}>{room.roomNumber} - {room.ward}</option>))}</select></div>
            <div className="field"><label>Bed</label><select name="bedId" value={admissionForm.bedId} onChange={handleAdmissionFormChange}><option value="">Select bed</option>{availableBeds.map((bed) => (<option key={bed.id} value={bed.id}>{bed.bedNumber} - {bed.bedLabel}</option>))}</select></div>
            <div className="field"><label>Attending doctor</label><select name="attendingDoctorId" value={admissionForm.attendingDoctorId} onChange={handleAdmissionFormChange}><option value="">Select doctor</option>{masters.doctors.map((doctor) => (<option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>))}</select></div>
            <div className="field"><label>Source</label><select name="admissionSource" value={admissionForm.admissionSource} onChange={handleAdmissionFormChange}>{masters.admissionSources.map((source) => (<option key={source} value={source}>{source}</option>))}</select></div>
            <div className="field"><label>Admission date</label><input type="date" name="admissionDate" value={admissionForm.admissionDate} onChange={handleAdmissionFormChange} /></div>
            <div className="field"><label>Admission time</label><input type="time" name="admissionTime" value={admissionForm.admissionTime} onChange={handleAdmissionFormChange} /></div>
            <div className="field"><label>Expected discharge</label><input type="date" name="expectedDischargeDate" value={admissionForm.expectedDischargeDate} onChange={handleAdmissionFormChange} /></div>
            <div className="field field-span-2"><label>Reason for admission</label><input name="reasonForAdmission" value={admissionForm.reasonForAdmission} onChange={handleAdmissionFormChange} /></div>
            <div className="field field-span-2"><label>Diagnosis</label><input name="diagnosis" value={admissionForm.diagnosis} onChange={handleAdmissionFormChange} /></div>
            <div className="field field-span-2"><label>Initial note</label><input name="initialNote" value={admissionForm.initialNote} onChange={handleAdmissionFormChange} /></div>
            <div className="field field-span-2"><Button type="submit">Admit Patient</Button></div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Admissions</div><h3>IPD register</h3></div></div>
          <div className="toolbar">
            <input className="search-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search by patient, admission no, diagnosis" />
            <select name="status" value={filters.status} onChange={handleFilterChange}><option value="">All statuses</option><option value="active">active</option><option value="discharged">discharged</option></select>
          </div>
          <div className="queue-list">
            {admissions.map((admission) => (
              <div key={admission.id} className={`queue-item selectable-card${selectedAdmission?.id === admission.id ? " selected-card" : ""}`} onClick={() => openAdmission(admission.id)} role="button" tabIndex={0}>
                <div>
                  <strong>{admission.admissionNumber}</strong>
                  <div className="timeline-copy">{admission.patientName}</div>
                  <div className="timeline-copy">{admission.room?.roomNumber || "No room"} | {admission.bed?.bedNumber || "No bed"}</div>
                  <div className="timeline-copy">{admission.admissionDate} | {admission.reasonForAdmission}</div>
                </div>
                <div className="queue-actions">
                  <span className={`status-pill ${admission.status === "active" ? "in_progress" : "completed"}`}>{admission.status}</span>
                </div>
              </div>
            ))}
            {!admissions.length ? <div className="empty-state">No admissions found for the selected filters.</div> : null}
          </div>
        </article>
      </section>

      <section className="opd-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Admission Detail</div><h3>{selectedAdmission?.admissionNumber || "Select an admission"}</h3></div></div>
          {error ? <div className="error-text">{error}</div> : null}
          {message ? <div className="success-text">{message}</div> : null}
          {selectedAdmission ? (
            <>
              <div className="detail-grid">
                <article className="content-card inset-card">
                  <h3>Patient and Bed</h3>
                  <div className="detail-list">
                    <div><strong>Patient:</strong> {selectedAdmission.patientName}</div>
                    <div><strong>UHID:</strong> {selectedAdmission.patient?.uhid || "N/A"}</div>
                    <div><strong>Room:</strong> {selectedAdmission.room?.roomNumber || "N/A"}</div>
                    <div><strong>Bed:</strong> {selectedAdmission.bed?.bedNumber || "N/A"}</div>
                    <div><strong>Doctor:</strong> {selectedAdmission.doctor?.fullName || "N/A"}</div>
                  </div>
                </article>
                <article className="content-card inset-card">
                  <h3>Admission Snapshot</h3>
                  <div className="detail-list">
                    <div><strong>Status:</strong> {selectedAdmission.status}</div>
                    <div><strong>Admitted:</strong> {selectedAdmission.admissionDate} {selectedAdmission.admissionTime}</div>
                    <div><strong>Expected discharge:</strong> {selectedAdmission.expectedDischargeDate || "Not set"}</div>
                    <div><strong>Source:</strong> {selectedAdmission.admissionSource}</div>
                    <div><strong>Diagnosis:</strong> {selectedAdmission.diagnosis || "Not recorded"}</div>
                  </div>
                </article>
              </div>

              <div className="content-card inset-card" style={{ marginTop: 18 }}>
                <h3>Clinical Notes</h3>
                {selectedAdmission.notes?.length ? <div className="stack-list">{selectedAdmission.notes.map((note) => (<div key={note.id} className="quick-action"><strong>{note.category}</strong><div className="timeline-copy">{note.noteDate}</div><div className="timeline-copy">{note.note}</div></div>))}</div> : <div className="empty-state">No clinical notes recorded yet.</div>}
              </div>

              <div className="content-card inset-card" style={{ marginTop: 18 }}>
                <h3>Vitals Log</h3>
                {selectedAdmission.vitals?.length ? (
                  <div className="table-shell">
                    <table className="data-table">
                      <thead><tr><th>Recorded</th><th>BP</th><th>Pulse</th><th>Temp</th><th>SPO2</th><th>RR</th><th>Weight</th><th>Notes</th></tr></thead>
                      <tbody>
                        {selectedAdmission.vitals.map((item) => (
                          <tr key={item.id}>
                            <td>{item.recordedAt}</td>
                            <td>{item.bp || "-"}</td>
                            <td>{item.pulse || "-"}</td>
                            <td>{item.temp || "-"}</td>
                            <td>{item.spo2 || "-"}</td>
                            <td>{item.rr || "-"}</td>
                            <td>{item.weight || "-"}</td>
                            <td>{item.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="empty-state">No vitals recorded yet.</div>}
              </div>

              <div className="content-card inset-card" style={{ marginTop: 18 }}>
                <h3>Scheduled IPD Therapies</h3>
                {selectedAdmission.therapySessions?.length ? (
                  <div className="stack-list">
                    {selectedAdmission.therapySessions.map((session) => (
                      <div key={session.id} className="quick-action">
                        <strong>{session.therapyName}</strong>
                        <div className="timeline-copy">{session.scheduleNumber} | {session.scheduledDate} at {session.scheduledTime}</div>
                        <div className="timeline-copy">Therapist: {session.therapistName} | Status: {session.status}</div>
                        <div className="timeline-copy">Bill: {session.billId ? "Created separately" : session.status === "completed" ? "Will be added to IPD discharge bill" : "Pending completion"}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">No therapies scheduled for this admission yet.</div>}
              </div>

              {selectedAdmission.dischargeSummary ? (
                <div className="content-card inset-card" style={{ marginTop: 18 }}>
                  <h3>Discharge Summary</h3>
                  <div className="detail-list">
                    <div><strong>Date:</strong> {selectedAdmission.dischargeSummary.dischargeDate} {selectedAdmission.dischargeSummary.dischargeTime}</div>
                    <div><strong>Status:</strong> {selectedAdmission.dischargeSummary.dischargeStatus}</div>
                    <div><strong>Condition:</strong> {selectedAdmission.dischargeSummary.conditionOnDischarge}</div>
                    <div><strong>Stay days:</strong> {selectedAdmission.dischargeSummary.stayDays}</div>
                    <div><strong>Room charge:</strong> Rs. {currency(selectedAdmission.dischargeSummary.roomCharge)}</div>
                    <div><strong>Extra charge:</strong> Rs. {currency(selectedAdmission.dischargeSummary.extraCharge)}</div>
                    <div><strong>Summary:</strong> {selectedAdmission.dischargeSummary.dischargeNote}</div>
                    <div><strong>Advice:</strong> {selectedAdmission.dischargeSummary.advice || "No advice recorded"}</div>
                    <div><strong>Billing link:</strong> {selectedAdmission.bill?.billNumber || "No bill created"}</div>
                  </div>
                </div>
              ) : null}
            </>
          ) : <div className="empty-state">Choose an admission from the register to manage its stay.</div>}
        </article>

        <section className="consultation-column">
          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Ward Charges</div><h3>IPD package rates</h3></div></div>
            <div className="stack-list compact-list">
              {masters.wardCharges.map((ward) => (
                <div className="quick-action" key={ward.id}>
                  <strong>{ward.ward}</strong>
                  <div className="timeline-copy">Rs. {currency(ward.chargePerDay)} / day{ward.perPerson ? " / person" : ""}</div>
                  <div className="timeline-copy">{ward.packageIncludes}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Therapy Plan</div><h3>Schedule IPD therapy</h3></div></div>
            {!selectedAdmission ? <div className="empty-state">Select an active admission to schedule therapy.</div> : selectedAdmission.status !== "active" ? <div className="empty-state">This admission is discharged. Therapy scheduling is closed.</div> : (
              <>
                <form className="form-grid" onSubmit={handleScheduleTherapy}>
                  <div className="field field-span-2">
                    <label>IPD package preset</label>
                    <select name="packageId" value={therapyForm.packageId} onChange={handleTherapyFormChange}>
                      <option value="">No package preset</option>
                      {masters.treatmentPackages.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.durationDays} days)</option>
                      ))}
                    </select>
                  </div>
                  {selectedPackage ? (
                    <div className="empty-state field-span-2">
                      {selectedPackage.goal}. {selectedPackage.overview}
                    </div>
                  ) : null}
                  <div className="field field-span-2">
                    <label>Therapy</label>
                    <select name="therapyId" value={therapyForm.therapyId} onChange={handleTherapyFormChange}>
                      <option value="">Select therapy</option>
                      {masters.therapies.map((therapy) => (
                        <option key={therapy.id} value={therapy.id}>{therapy.name} - Rs. {currency(therapy.price)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Therapist</label>
                    <select name="therapistId" value={therapyForm.therapistId} onChange={handleTherapyFormChange}>
                      <option value="">Select therapist</option>
                      {masters.therapists.map((therapist) => (
                        <option key={therapist.id} value={therapist.id}>{therapist.fullName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Therapy room</label>
                    <select name="therapyRoomId" value={therapyForm.therapyRoomId} onChange={handleTherapyFormChange}>
                      <option value="">Use available therapy room</option>
                      {masters.therapyRooms.map((room) => (
                        <option key={room.id} value={room.id}>{room.roomNumber} - {room.ward}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field"><label>Date</label><input type="date" name="scheduledDate" value={therapyForm.scheduledDate} onChange={handleTherapyFormChange} /></div>
                  <div className="field"><label>Time</label><input type="time" name="scheduledTime" value={therapyForm.scheduledTime} onChange={handleTherapyFormChange} /></div>
                  <div className="field"><label>Duration minutes</label><input name="estimatedDurationMinutes" value={therapyForm.estimatedDurationMinutes} onChange={handleTherapyFormChange} /></div>
                  <div className="field"><label>Estimated charge</label><input value={selectedTherapy ? `Rs. ${currency(selectedTherapy.price)}` : ""} disabled readOnly /></div>
                  <div className="field field-span-2"><label>Indication / complaint</label><input name="complaint" value={therapyForm.complaint} onChange={handleTherapyFormChange} placeholder={selectedAdmission.reasonForAdmission} /></div>
                  <div className="field field-span-2"><label>Preparation notes</label><input name="preparationNotes" value={therapyForm.preparationNotes} onChange={handleTherapyFormChange} /></div>
                  <div className="field field-span-2"><Button type="submit">Schedule Therapy</Button></div>
                </form>
                <div className="empty-state" style={{ marginTop: 14 }}>
                  Therapy completion and material usage are handled in Panchkarma. Completed unbilled IPD therapies are added to the discharge bill automatically.
                </div>
              </>
            )}
          </article>

          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Clinical Note</div><h3>Add progress note</h3></div></div>
            {!selectedAdmission ? <div className="empty-state">Select an admission to add notes.</div> : selectedAdmission.status !== "active" ? <div className="empty-state">This admission is discharged. Notes are read-only now.</div> : (
              <form className="form-grid" onSubmit={handleAddNote}>
                <div className="field"><label>Category</label><select name="category" value={noteForm.category} onChange={handleNoteFormChange}>{masters.noteCategories.map((category) => (<option key={category} value={category}>{category}</option>))}</select></div>
                <div className="field field-span-2"><label>Note</label><input name="note" value={noteForm.note} onChange={handleNoteFormChange} /></div>
                <div className="field field-span-2"><Button type="submit">Save Note</Button></div>
              </form>
            )}
          </article>

          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Vitals</div><h3>Record bedside vitals</h3></div></div>
            {!selectedAdmission ? <div className="empty-state">Select an admission to record vitals.</div> : selectedAdmission.status !== "active" ? <div className="empty-state">This admission is discharged. Vitals are read-only now.</div> : (
              <form className="form-grid" onSubmit={handleAddVitals}>
                <div className="field"><label>BP</label><input name="bp" value={vitalsForm.bp} onChange={handleVitalsFormChange} /></div>
                <div className="field"><label>Pulse</label><input name="pulse" value={vitalsForm.pulse} onChange={handleVitalsFormChange} /></div>
                <div className="field"><label>Temp</label><input name="temp" value={vitalsForm.temp} onChange={handleVitalsFormChange} /></div>
                <div className="field"><label>SPO2</label><input name="spo2" value={vitalsForm.spo2} onChange={handleVitalsFormChange} /></div>
                <div className="field"><label>RR</label><input name="rr" value={vitalsForm.rr} onChange={handleVitalsFormChange} /></div>
                <div className="field"><label>Weight</label><input name="weight" value={vitalsForm.weight} onChange={handleVitalsFormChange} /></div>
                <div className="field field-span-2"><label>Notes</label><input name="notes" value={vitalsForm.notes} onChange={handleVitalsFormChange} /></div>
                <div className="field field-span-2"><Button type="submit">Record Vitals</Button></div>
              </form>
            )}
          </article>

          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Discharge</div><h3>Close admission and bill stay</h3></div></div>
            {!selectedAdmission ? <div className="empty-state">Select an admission to discharge.</div> : selectedAdmission.status !== "active" ? <div className="empty-state">This admission is already discharged.</div> : (
              <form className="form-grid" onSubmit={handleDischarge}>
                <div className="field"><label>Discharge date</label><input type="date" name="dischargeDate" value={dischargeForm.dischargeDate} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Discharge time</label><input type="time" name="dischargeTime" value={dischargeForm.dischargeTime} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Status</label><select name="dischargeStatus" value={dischargeForm.dischargeStatus} onChange={handleDischargeFormChange}>{masters.dischargeStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}</select></div>
                <div className="field"><label>Condition</label><input name="conditionOnDischarge" value={dischargeForm.conditionOnDischarge} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Stay days override</label><input name="stayDays" value={dischargeForm.stayDays} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Bed status after discharge</label><select name="nextBedStatus" value={dischargeForm.nextBedStatus} onChange={handleDischargeFormChange}><option value="cleaning">cleaning</option><option value="available">available</option><option value="maintenance">maintenance</option></select></div>
                <div className="field"><label>Extra charge</label><input name="extraCharge" value={dischargeForm.extraCharge} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Extra charge label</label><input name="extraChargeLabel" value={dischargeForm.extraChargeLabel} onChange={handleDischargeFormChange} /></div>
                <div className="field field-span-2"><label>Discharge summary</label><input name="dischargeNote" value={dischargeForm.dischargeNote} onChange={handleDischargeFormChange} /></div>
                <div className="field field-span-2"><label>Advice</label><input name="advice" value={dischargeForm.advice} onChange={handleDischargeFormChange} /></div>
                <div className="field field-span-2"><label>Bed note</label><input name="bedNote" value={dischargeForm.bedNote} onChange={handleDischargeFormChange} /></div>
                <label className="checkbox-chip field-span-2"><input type="checkbox" name="createBill" checked={dischargeForm.createBill} onChange={handleDischargeFormChange} /> Create IPD bill on discharge</label>
                <div className="field field-span-2"><Button type="submit">Discharge Patient</Button></div>
              </form>
            )}
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
