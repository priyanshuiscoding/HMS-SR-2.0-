import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { formatCurrency } from "../../utils/format.js";
import {
  completePanchkarmaSession,
  createPanchkarmaSchedule,
  getPanchkarmaMasters,
  getPanchkarmaSchedule,
  getPanchkarmaSchedules,
  getPanchkarmaSummary,
  getPatients,
  startPanchkarmaSession
} from "../../services/api.js";

const today = new Date().toISOString().slice(0, 10);

const initialScheduleForm = {
  patientId: "",
  therapyId: "",
  therapistId: "",
  recommendedBy: "",
  therapyRoomId: "",
  recoveryBedId: "",
  scheduledDate: today,
  scheduledTime: "",
  estimatedDurationMinutes: "",
  complaint: "",
  preparationNotes: ""
};

const emptyMaterial = {
  medicineId: "",
  quantity: 1,
  notes: ""
};

const initialCompletionForm = {
  executionNotes: "",
  outcome: "",
  followUpAdvice: "",
  sessionCharge: "",
  paymentStatus: "unpaid",
  createBill: true,
  addMaterialCharges: true,
  materialsUsed: [{ ...emptyMaterial }]
};

function patientLabel(patient) {
  return `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim()}`.trim();
}

export function PanchkarmaPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState({
    therapies: [],
    therapists: [],
    doctors: [],
    therapyRooms: [],
    recoveryBeds: [],
    materialMedicines: [],
    statuses: []
  });
  const [filters, setFilters] = useState({ scheduledDate: today, status: "", therapistId: "" });
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(initialScheduleForm);
  const [completionForm, setCompletionForm] = useState(initialCompletionForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData(nextFilters = filters, selectedId = selectedSchedule?.id) {
    try {
      const [summaryResponse, mastersResponse, patientsResponse, schedulesResponse] = await Promise.all([
        getPanchkarmaSummary(),
        getPanchkarmaMasters(),
        getPatients(),
        getPanchkarmaSchedules(nextFilters)
      ]);

      setSummary(summaryResponse);
      setMasters(mastersResponse);
      setPatients(patientsResponse.items);
      setSchedules(schedulesResponse.items);

      const activeId = selectedId || schedulesResponse.items[0]?.id;

      if (activeId) {
        const detail = await getPanchkarmaSchedule(activeId);
        setSelectedSchedule(detail);
        setCompletionForm({
          ...initialCompletionForm,
          executionNotes: detail.executionNotes || "",
          outcome: detail.outcome || "",
          followUpAdvice: detail.followUpAdvice || "",
          sessionCharge: detail.therapy?.price || "",
          createBill: !detail.billId,
          materialsUsed: detail.materialsUsed?.length
            ? detail.materialsUsed.map((item) => ({
                medicineId: item.medicineId,
                quantity: item.quantity,
                notes: item.notes || ""
              }))
            : [{ ...emptyMaterial }]
        });
      } else {
        setSelectedSchedule(null);
      }

      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load Panchkarma workspace.");
    }
  }

  useEffect(() => {
    loadData({ scheduledDate: today, status: "", therapistId: "" });
  }, []);

  const therapyLookup = useMemo(() => {
    return masters.therapies.reduce((lookup, therapy) => {
      lookup[therapy.id] = therapy;
      return lookup;
    }, {});
  }, [masters.therapies]);

  const stats = summary || {
    totalSessions: 0,
    todaySessions: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    pendingBilling: 0
  };

  const handleScheduleChange = (event) => {
    const { name, value } = event.target;

    updateScheduleField(name, value);
  };

  const updateScheduleField = (name, value) => {
    setScheduleForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "therapyId") {
        const therapy = therapyLookup[value];
        next.estimatedDurationMinutes = therapy?.defaultDurationMinutes || "";
        if (!therapy?.requiresRecovery) {
          next.recoveryBedId = "";
        }
      }

      return next;
    });
  };

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    await loadData(nextFilters);
  };

  const openSchedule = async (scheduleId) => {
    try {
      const detail = await getPanchkarmaSchedule(scheduleId);
      setSelectedSchedule(detail);
      setCompletionForm({
        ...initialCompletionForm,
        executionNotes: detail.executionNotes || "",
        outcome: detail.outcome || "",
        followUpAdvice: detail.followUpAdvice || "",
        sessionCharge: detail.therapy?.price || "",
        createBill: !detail.billId,
        materialsUsed: detail.materialsUsed?.length
          ? detail.materialsUsed.map((item) => ({
              medicineId: item.medicineId,
              quantity: item.quantity,
              notes: item.notes || ""
            }))
          : [{ ...emptyMaterial }]
      });
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load session detail.");
    }
  };

  const handleCreateSchedule = async (event) => {
    event.preventDefault();

    try {
      const response = await createPanchkarmaSchedule(scheduleForm);
      setMessage(response.message);
      setScheduleForm(initialScheduleForm);
      await loadData(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to schedule Panchkarma session.");
    }
  };

  const handleStartSession = async () => {
    if (!selectedSchedule?.id) {
      return;
    }

    try {
      const response = await startPanchkarmaSession(selectedSchedule.id, {});
      setMessage(response.message);
      await loadData(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to start Panchkarma session.");
    }
  };

  const handleCompletionChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCompletionForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleMaterialChange = (index, field, value) => {
    setCompletionForm((current) => {
      const materialsUsed = [...current.materialsUsed];
      materialsUsed[index] = { ...materialsUsed[index], [field]: value };
      return { ...current, materialsUsed };
    });
  };

  const addMaterialRow = () => {
    setCompletionForm((current) => ({
      ...current,
      materialsUsed: [...current.materialsUsed, { ...emptyMaterial }]
    }));
  };

  const handleCompleteSession = async (event) => {
    event.preventDefault();

    if (!selectedSchedule?.id) {
      return;
    }

    try {
      const response = await completePanchkarmaSession(selectedSchedule.id, {
        ...completionForm,
        sessionCharge: Number(completionForm.sessionCharge || selectedSchedule.therapy?.price || 0),
        materialsUsed: completionForm.materialsUsed.filter((item) => item.medicineId && Number(item.quantity || 0) > 0)
      });
      setMessage(response.message);
      await loadData(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to complete Panchkarma session.");
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Panchkarma</div>
        <h2>Schedule, execute, and bill therapy sessions from one Panchkarma operations board.</h2>
        <p>
          This phase links patients, therapists, therapy rooms, material consumption, recovery planning, and billing
          so Panchkarma can run as a real operational workflow inside the HMS.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Today</div><div className="stat-value">{stats.todaySessions}</div><div className="stat-note">Sessions planned today</div></article>
        <article className="stat-card"><div className="stat-label">Scheduled</div><div className="stat-value">{stats.scheduled}</div><div className="stat-note">Awaiting start</div></article>
        <article className="stat-card"><div className="stat-label">In Progress</div><div className="stat-value">{stats.inProgress}</div><div className="stat-note">Therapy board active</div></article>
        <article className="stat-card"><div className="stat-label">Pending Billing</div><div className="stat-value">{stats.pendingBilling}</div><div className="stat-note">Completed but not billed</div></article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Schedule</div>
              <h3>New therapy session</h3>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleCreateSchedule}>
            <div className="field field-span-2">
              <label>Patient</label>
              <SearchableSelect
                value={scheduleForm.patientId}
                options={patients}
                onChange={(value) => updateScheduleField("patientId", value)}
                placeholder="Search patient"
                emptyLabel="No matching patient"
                getOptionLabel={patientLabel}
                getOptionMeta={(patient) => patient.phone || patient.cityDistrict || patient.city || ""}
                getSearchText={(patient) => [
                  patient.uhid,
                  patient.registrationNumber,
                  patient.fullName,
                  patient.firstName,
                  patient.lastName,
                  patient.fatherName,
                  patient.phone,
                  patient.cityDistrict,
                  patient.city
                ].filter(Boolean).join(" ")}
              />
            </div>
            <div className="field">
              <label>Therapy</label>
              <select name="therapyId" value={scheduleForm.therapyId} onChange={handleScheduleChange}>
                <option value="">Select therapy</option>
                {masters.therapies.map((therapy) => (
                  <option key={therapy.id} value={therapy.id}>
                    {therapy.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Therapist</label>
              <select name="therapistId" value={scheduleForm.therapistId} onChange={handleScheduleChange}>
                <option value="">Select therapist</option>
                {masters.therapists.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Recommended by</label>
              <select name="recommendedBy" value={scheduleForm.recommendedBy} onChange={handleScheduleChange}>
                <option value="">Optional doctor link</option>
                {masters.doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Therapy room</label>
              <select name="therapyRoomId" value={scheduleForm.therapyRoomId} onChange={handleScheduleChange}>
                <option value="">Select room</option>
                {masters.therapyRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {room.ward}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" name="scheduledDate" value={scheduleForm.scheduledDate} onChange={handleScheduleChange} />
            </div>
            <div className="field">
              <label>Time</label>
              <input type="time" name="scheduledTime" value={scheduleForm.scheduledTime} onChange={handleScheduleChange} />
            </div>
            <div className="field">
              <label>Duration (mins)</label>
              <input name="estimatedDurationMinutes" value={scheduleForm.estimatedDurationMinutes} onChange={handleScheduleChange} />
            </div>
            <div className="field">
              <label>Recovery bed</label>
              <select name="recoveryBedId" value={scheduleForm.recoveryBedId} onChange={handleScheduleChange}>
                <option value="">Optional recovery linkage</option>
                {masters.recoveryBeds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.room?.roomNumber} - {bed.bedNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-span-2">
              <label>Complaint / indication</label>
              <input name="complaint" value={scheduleForm.complaint} onChange={handleScheduleChange} />
            </div>
            <div className="field field-span-2">
              <label>Preparation notes</label>
              <input name="preparationNotes" value={scheduleForm.preparationNotes} onChange={handleScheduleChange} />
            </div>
            <div className="field field-span-2"><Button type="submit">Schedule Session</Button></div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Daily Board</div>
              <h3>Panchkarma queue</h3>
            </div>
          </div>

          <div className="toolbar">
            <input className="search-input" type="date" name="scheduledDate" value={filters.scheduledDate} onChange={handleFilterChange} />
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All statuses</option>
              {masters.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select name="therapistId" value={filters.therapistId} onChange={handleFilterChange}>
              <option value="">All therapists</option>
              {masters.therapists.map((therapist) => (
                <option key={therapist.id} value={therapist.id}>
                  {therapist.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="queue-list">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`queue-item selectable-card${selectedSchedule?.id === schedule.id ? " selected-card" : ""}`}
                onClick={() => openSchedule(schedule.id)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <strong>{schedule.scheduleNumber}</strong>
                  <div className="timeline-copy">{schedule.patientName}</div>
                  <div className="timeline-copy">{schedule.therapyName}</div>
                  <div className="timeline-copy">{schedule.scheduledDate} | {schedule.scheduledTime}</div>
                </div>
                <div className="queue-actions">
                  <span className={`status-pill ${schedule.status === "in_progress" ? "in_progress" : schedule.status}`}>
                    {schedule.status}
                  </span>
                </div>
              </div>
            ))}
            {!schedules.length ? <div className="empty-state">No Panchkarma sessions found for the selected filter.</div> : null}
          </div>
        </article>
      </section>

      <section className="opd-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Session Detail</div>
              <h3>{selectedSchedule?.scheduleNumber || "Select a session"}</h3>
            </div>
            {selectedSchedule?.status === "scheduled" ? (
              <Button onClick={handleStartSession} disabled={!["admin", "doctor", "therapist"].includes(user?.role)}>
                Start Session
              </Button>
            ) : null}
          </div>

          {error ? <div className="error-text">{error}</div> : null}
          {message ? <div className="success-text">{message}</div> : null}

          {selectedSchedule ? (
            <>
              <div className="detail-grid">
                <article className="content-card inset-card">
                  <h3>Therapy snapshot</h3>
                  <div className="detail-list">
                    <div><strong>Patient:</strong> {selectedSchedule.patientName}</div>
                    <div><strong>Therapy:</strong> {selectedSchedule.therapyName}</div>
                    <div><strong>Therapist:</strong> {selectedSchedule.therapistName}</div>
                    <div><strong>Room:</strong> {selectedSchedule.therapyRoom?.roomNumber || "Not linked"}</div>
                    <div><strong>Duration:</strong> {selectedSchedule.estimatedDurationMinutes} mins</div>
                    <div><strong>Charge:</strong> Rs. {formatCurrency(selectedSchedule.therapy?.price)}</div>
                  </div>
                </article>
                <article className="content-card inset-card">
                  <h3>Clinical context</h3>
                  <div className="detail-list">
                    <div><strong>Complaint:</strong> {selectedSchedule.complaint || "Not recorded"}</div>
                    <div><strong>Preparation:</strong> {selectedSchedule.preparationNotes || "Not recorded"}</div>
                    <div><strong>Recovery bed:</strong> {selectedSchedule.recoveryBed?.bedNumber || "No recovery bed linked"}</div>
                    <div><strong>Recommended by:</strong> {selectedSchedule.doctor?.fullName || "Not linked"}</div>
                    <div><strong>Status:</strong> {selectedSchedule.status}</div>
                  </div>
                </article>
              </div>

              {selectedSchedule.materialsUsed?.length ? (
                <div className="content-card inset-card" style={{ marginTop: 18 }}>
                  <h3>Material usage</h3>
                  <div className="stack-list">
                    {selectedSchedule.materialsUsed.map((item) => (
                      <div key={item.id} className="quick-action">
                        <strong>{item.medicineName}</strong>
                        <div className="timeline-copy">Quantity: {item.quantity} {item.unit}</div>
                        <div className="timeline-copy">{item.notes || "No additional note"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedSchedule.bill ? (
                <div className="content-card inset-card" style={{ marginTop: 18 }}>
                  <h3>Billing link</h3>
                  <div className="detail-list">
                    <div><strong>Bill number:</strong> {selectedSchedule.bill.billNumber}</div>
                    <div><strong>Total:</strong> Rs. {formatCurrency(selectedSchedule.bill.totalAmount)}</div>
                    <div><strong>Payment status:</strong> {selectedSchedule.bill.paymentStatus}</div>
                  </div>
                </div>
              ) : null}
            </>
          ) : <div className="empty-state">Select a Panchkarma session from the queue to manage it.</div>}
        </article>

        <section className="consultation-column">
          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Execution</div>
                <h3>Complete therapy session</h3>
              </div>
            </div>

            {!selectedSchedule ? (
              <div className="empty-state">Select a session to complete it.</div>
            ) : selectedSchedule.status === "completed" ? (
              <div className="detail-list">
                <div><strong>Started:</strong> {selectedSchedule.sessionStartedAt || "Not recorded"}</div>
                <div><strong>Completed:</strong> {selectedSchedule.sessionCompletedAt || "Not recorded"}</div>
                <div><strong>Outcome:</strong> {selectedSchedule.outcome || "Not recorded"}</div>
                <div><strong>Follow-up:</strong> {selectedSchedule.followUpAdvice || "Not recorded"}</div>
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleCompleteSession}>
                <div className="field field-span-2">
                  <label>Execution notes</label>
                  <input name="executionNotes" value={completionForm.executionNotes} onChange={handleCompletionChange} />
                </div>
                <div className="field field-span-2">
                  <label>Outcome</label>
                  <input name="outcome" value={completionForm.outcome} onChange={handleCompletionChange} />
                </div>
                <div className="field field-span-2">
                  <label>Follow-up advice</label>
                  <input name="followUpAdvice" value={completionForm.followUpAdvice} onChange={handleCompletionChange} />
                </div>
                <div className="field">
                  <label>Session charge</label>
                  <input name="sessionCharge" value={completionForm.sessionCharge} onChange={handleCompletionChange} />
                </div>
                <div className="field">
                  <label>Payment status</label>
                  <select name="paymentStatus" value={completionForm.paymentStatus} onChange={handleCompletionChange}>
                    <option value="unpaid">unpaid</option>
                    <option value="partial">partial</option>
                    <option value="paid">paid</option>
                  </select>
                </div>
                <label className="checkbox-chip">
                  <input type="checkbox" name="createBill" checked={completionForm.createBill} onChange={handleCompletionChange} />
                  <span>Create therapy bill</span>
                </label>
                <label className="checkbox-chip">
                  <input type="checkbox" name="addMaterialCharges" checked={completionForm.addMaterialCharges} onChange={handleCompletionChange} />
                  <span>Add material charges to bill</span>
                </label>

                <div className="field field-span-2">
                  <label>Materials used</label>
                  <div className="medicine-stack">
                    {completionForm.materialsUsed.map((item, index) => (
                      <div key={`${selectedSchedule.id}-material-${index}`} className="medicine-card">
                        <div className="form-grid">
                          <div className="field">
                            <label>Material</label>
                            <SearchableSelect
                              value={item.medicineId}
                              options={masters.materialMedicines}
                              onChange={(value) => handleMaterialChange(index, "medicineId", value)}
                              placeholder="Search material"
                              emptyLabel="No matching material"
                              getOptionLabel={(medicine) => medicine.name}
                              getOptionMeta={(medicine) => `${medicine.formulation || ""} ${medicine.category || ""}`.trim()}
                              getSearchText={(medicine) => [medicine.name, medicine.formulation, medicine.category, medicine.unit].filter(Boolean).join(" ")}
                            />
                          </div>
                          <div className="field">
                            <label>Quantity</label>
                            <input value={item.quantity} onChange={(event) => handleMaterialChange(index, "quantity", event.target.value)} />
                          </div>
                          <div className="field field-span-2">
                            <label>Usage note</label>
                            <input value={item.notes} onChange={(event) => handleMaterialChange(index, "notes", event.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="field field-span-2 action-row">
                  <Button type="button" variant="secondary" onClick={addMaterialRow}>Add Material</Button>
                  <Button type="submit">Complete Session</Button>
                </div>
              </form>
            )}
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
