import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  createAppointment,
  getAppointmentMasters,
  getAppointments,
  getAvailableSlots,
  getPatients,
  getTodayAppointments,
  updateAppointmentQueueAction
} from "../../services/api.js";

const initialForm = {
  patientId: "",
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientMobile: "",
  patientAddress: "",
  doctorId: "",
  appointmentDate: new Date().toISOString().slice(0, 10),
  appointmentTime: "",
  type: "new",
  department: "",
  status: "scheduled",
  chiefComplaint: "",
  source: "Reception",
  consultationFeeAmount: "",
  paymentMode: "cash",
  paymentReference: ""
};

function formatTimeLabel(time) {
  const [hourValue, minuteValue] = String(time || "").split(":").map(Number);

  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return time || "";
  }

  const hour = hourValue % 12 || 12;
  const period = hourValue >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [todayQueue, setTodayQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState({
    doctors: [],
    departments: [],
    types: [],
    statuses: [],
    sources: [],
    slotDurationMinutes: 10,
    consultationFee: 200,
    bookingRules: {
      maxPatientsPerDay: 100,
      advanceBookingAllowed: true,
      sameDayBookingAllowed: true,
      emergencyOverrideAllowed: false,
      walkInAllowed: true
    },
    opdTimings: { weekday: [], sundayAndHoliday: [] }
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [filters, setFilters] = useState({ date: "", status: "" });
  const [formState, setFormState] = useState(initialForm);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData(nextFilters = filters) {
    try {
      const [appointmentsResponse, queueResponse] = await Promise.all([
        getAppointments(nextFilters),
        getTodayAppointments()
      ]);
      setAppointments(appointmentsResponse.items);
      setTodayQueue(queueResponse.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to load appointments.");
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const [patientsResponse, mastersResponse] = await Promise.all([
          getPatients(),
          getAppointmentMasters()
        ]);
        setPatients(patientsResponse.items);
        setMasters((current) => ({ ...current, ...mastersResponse }));

        const firstDoctorId = mastersResponse.doctors[0]?.id || "";
        const firstDoctorDepartment = mastersResponse.doctors[0]?.department || mastersResponse.departments[0] || "";

        setFormState((current) => ({
          ...current,
          doctorId: firstDoctorId,
          department: firstDoctorDepartment,
          type: mastersResponse.types?.[0] || "new",
          source: mastersResponse.sources?.includes("Reception") ? "Reception" : (mastersResponse.sources?.[0] || "Reception"),
          consultationFeeAmount: mastersResponse.consultationFee || 200,
          paymentMode: mastersResponse.paymentModes?.[0] || "cash"
        }));
      } catch (apiError) {
        setError(apiError.message || "Unable to initialize appointment masters.");
      }
    }

    bootstrap();
    loadData({ date: "", status: "" });
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!formState.appointmentDate || !formState.doctorId) {
        return;
      }

      try {
        const response = await getAvailableSlots(formState.appointmentDate, formState.doctorId);
        setAvailableSlots(response.items);
      } catch (apiError) {
        setError(apiError.message || "Unable to load doctor slots.");
      }
    }

    loadSlots();
  }, [formState.appointmentDate, formState.doctorId]);

  const stats = useMemo(() => {
    const confirmed = appointments.filter((appointment) => appointment.status === "confirmed").length;
    const scheduled = appointments.filter((appointment) => appointment.status === "scheduled").length;
    return {
      total: appointments.length,
      confirmed,
      scheduled,
      queue: todayQueue.length
    };
  }, [appointments, todayQueue]);

  const canManageAppointments = ["admin", "reception"].includes(user?.role);

  const patientLabel = (patient) => {
    if (!patient) {
      return "";
    }

    return `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  };

  const handleFilterChange = (event) => {
    const nextFilters = {
      ...filters,
      [event.target.name]: event.target.value
    };
    setFilters(nextFilters);
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    setError("");
    setLastReceipt(null);
    await loadData(filters);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    if (name === "patientId") {
      const selectedPatient = patients.find((patient) => patient.id === value);
      setFormState((current) => ({
        ...current,
        patientId: value,
        patientName: selectedPatient ? "" : current.patientName,
        patientAge: selectedPatient ? "" : current.patientAge,
        patientGender: selectedPatient ? "" : current.patientGender,
        patientMobile: selectedPatient ? "" : current.patientMobile,
        patientAddress: selectedPatient ? "" : current.patientAddress
      }));
      return;
    }

    if (name === "doctorId") {
      const selectedDoctor = masters.doctors.find((doctor) => doctor.id === value);
      setFormState((current) => ({
        ...current,
        doctorId: value,
        department: selectedDoctor?.department || current.department
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handlePatientSelect = (patientId, patient) => {
    setFormState((current) => ({
      ...current,
      patientId,
      patientName: "",
      patientAge: "",
      patientGender: "",
      patientMobile: "",
      patientAddress: ""
    }));
  };

  const handleBookAppointment = async (event) => {
    event.preventDefault();
    if (!canManageAppointments) {
      setError("Only admin and reception users can book appointments.");
      return;
    }

    setError("");
    setSuccess("");
    setLastReceipt(null);

    try {
      const response = await createAppointment(formState);
      const payment = response.item.consultationPayment || response.item.metadata?.consultationPayment || {};
      setLastReceipt({
        appointmentNumber: response.item.appointmentNumber,
        tokenNumber: response.item.tokenNumber,
        patientName: response.item.patientName,
        doctorName: masters.doctors.find((doctor) => doctor.id === response.item.doctorId)?.fullName || "Doctor",
        department: response.item.department,
        appointmentDate: response.item.appointmentDate,
        appointmentTime: response.item.appointmentTime,
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
        paymentMode: payment.paymentMode,
        referenceNumber: payment.referenceNumber
      });
      setSuccess(`${response.message} Token ${response.item.tokenNumber} generated after payment.`);
      setFormState((current) => ({
        ...initialForm,
        appointmentDate: current.appointmentDate,
        doctorId: current.doctorId || masters.doctors[0]?.id || "",
        department: (masters.doctors.find((doctor) => doctor.id === current.doctorId)?.department) || masters.doctors[0]?.department || masters.departments[0] || "",
        type: masters.types?.[0] || "new",
        source: masters.sources?.includes("Reception") ? "Reception" : (masters.sources?.[0] || "Reception"),
        consultationFeeAmount: masters.consultationFee || 200,
        paymentMode: masters.paymentModes?.[0] || "cash"
      }));
      await loadData(filters);
      const refreshedSlots = await getAvailableSlots(formState.appointmentDate, formState.doctorId);
      setAvailableSlots(refreshedSlots.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to book appointment.");
    }
  };

  const printLastReceipt = () => {
    if (!lastReceipt) {
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("print-appointment-receipt");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("print-appointment-receipt");
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 0);
  };

  const handleQueueAction = async (id, action, label = action) => {
    if (!canManageAppointments) {
      setError("Only admin and reception users can manage appointment workflow actions.");
      return;
    }

    const reason = window.prompt(`Reason for ${label}:`);
    if (!reason?.trim()) {
      setError("Reason is required for workflow actions.");
      return;
    }

    try {
      await updateAppointmentQueueAction(id, { action, reason });
      await loadData(filters);
    } catch (apiError) {
      setError(apiError.message || "Unable to update appointment workflow.");
    }
  };

  const handleCancel = (id) => handleQueueAction(id, "cancel", "cancel");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Appointments</div>
        <h2>Doctor scheduling, department mapping, and front-desk queue control for Shanti-Ratnam.</h2>
        <p>
          Slot-based booking follows hospital OPD timings, supports walk-ins with tokens, and keeps live queue
          visibility for reception and doctors.
        </p>
      </section>

      <section className="content-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Policy</div>
            <h3>Current OPD timings and booking rules</h3>
          </div>
        </div>
        <div className="detail-grid">
          <article className="content-card inset-card">
            <h3>OPD timings</h3>
            <div className="detail-list">
              <div><strong>Morning:</strong> 9:00 AM - 1:30 PM</div>
              <div><strong>Evening:</strong> 3:30 PM - 7:30 PM</div>
              <div><strong>Sunday/Holiday:</strong> 9:00 AM - 12:30 PM</div>
              <div><strong>Slot duration:</strong> {masters.slotDurationMinutes} minutes</div>
            </div>
          </article>
          <article className="content-card inset-card">
            <h3>Booking rules</h3>
            <div className="detail-list">
              <div><strong>Max/day:</strong> {masters.bookingRules?.maxPatientsPerDay || 100}</div>
              <div><strong>Advance booking:</strong> Allowed</div>
              <div><strong>Same-day booking:</strong> Allowed</div>
              <div><strong>Emergency override:</strong> Not allowed</div>
              <div><strong>Consultation fee:</strong> Rs. {masters.consultationFee}</div>
              <div><strong>Queue rule:</strong> Token enters OPD queue only after payment</div>
            </div>
          </article>
        </div>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <div className="stat-label">Appointments</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-note">Current filtered list</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Confirmed</div>
          <div className="stat-value">{stats.confirmed}</div>
          <div className="stat-note">Paid and ready for queue</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Scheduled</div>
          <div className="stat-value">{stats.scheduled}</div>
          <div className="stat-note">Upcoming bookings</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Today Queue</div>
          <div className="stat-value">{stats.queue}</div>
          <div className="stat-note">Live front-desk overview</div>
        </article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Book</div>
              <h3>New appointment</h3>
            </div>
          </div>

          <form className="form-grid" onSubmit={handleBookAppointment}>
            <div className="field field-span-2">
              <label>Existing patient</label>
              <SearchableSelect
                value={formState.patientId}
                options={patients}
                onChange={handlePatientSelect}
                placeholder="Click and type patient name, UHID, phone, father name, address, or city"
                emptyLabel="No matching patient. Leave blank to enter a new patient below."
                getOptionLabel={patientLabel}
                getOptionMeta={(patient) => [patient.phone, patient.fatherName, patient.cityDistrict || patient.city].filter(Boolean).join(" | ")}
                getSearchText={(patient) => [
                  patient.uhid,
                  patient.registrationNumber,
                  patient.firstName,
                  patient.lastName,
                  patient.fatherName,
                  patient.phone,
                  patient.address,
                  patient.houseStreet,
                  patient.areaVillage,
                  patient.cityDistrict,
                  patient.city
                ].filter(Boolean).join(" ")}
              />
            </div>

            {!formState.patientId ? (
              <>
                <div className="field field-span-2">
                  <label>Name</label>
                  <input name="patientName" value={formState.patientName} onChange={handleFormChange} required />
                </div>
                <div className="field">
                  <label>Age</label>
                  <input name="patientAge" type="number" min="1" value={formState.patientAge} onChange={handleFormChange} required />
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select name="patientGender" value={formState.patientGender} onChange={handleFormChange} required>
                    <option value="">Select</option>
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </select>
                </div>
                <div className="field field-span-2">
                  <label>Mobile</label>
                  <input name="patientMobile" value={formState.patientMobile} onChange={handleFormChange} minLength={10} required />
                </div>
                <div className="field field-span-2">
                  <label>Address</label>
                  <input name="patientAddress" value={formState.patientAddress} onChange={handleFormChange} placeholder="Optional" />
                </div>
              </>
            ) : null}

            <div className="field">
              <label>Doctor</label>
              <select name="doctorId" value={formState.doctorId} onChange={handleFormChange}>
                {masters.doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Department</label>
              <select name="department" value={formState.department} onChange={handleFormChange}>
                {masters.departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Date</label>
              <input
                name="appointmentDate"
                type="date"
                min={today}
                value={formState.appointmentDate}
                onChange={handleFormChange}
              />
            </div>

            <div className="field">
              <label>Time slot</label>
              <select name="appointmentTime" value={formState.appointmentTime} onChange={handleFormChange}>
                <option value="">Choose slot</option>
                {availableSlots.map((slot) => (
                  <option key={slot.time} value={slot.time} disabled={slot.isBooked}>
                    {formatTimeLabel(slot.time)} {slot.isBooked ? "- Booked" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Type</label>
              <select name="type" value={formState.type} onChange={handleFormChange}>
                {masters.types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Source</label>
              <select name="source" value={formState.source} onChange={handleFormChange}>
                {masters.sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-span-2">
              <label>Problem</label>
              <input name="chiefComplaint" value={formState.chiefComplaint} onChange={handleFormChange} placeholder="Optional" />
            </div>

            <div className="field">
              <label>Consultation fee</label>
              <input
                name="consultationFeeAmount"
                type="number"
                min="1"
                value={formState.consultationFeeAmount}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="field">
              <label>Payment mode</label>
              <select name="paymentMode" value={formState.paymentMode} onChange={handleFormChange} required>
                {(masters.paymentModes || ["cash", "upi", "card", "bank_transfer", "other"]).map((mode) => (
                  <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>

            <div className="field field-span-2">
              <label>Payment reference</label>
              <input name="paymentReference" value={formState.paymentReference} onChange={handleFormChange} placeholder="Optional UPI/card/reference number" />
            </div>

            {error ? <div className="error-text field-span-2">{error}</div> : null}
            {success ? <div className="success-text field-span-2">{success}</div> : null}
            {lastReceipt ? (
              <div className="empty-state field-span-2">
                <strong>Receipt {lastReceipt.receiptNumber}</strong>
                <div>Token {lastReceipt.tokenNumber} - {lastReceipt.patientName}</div>
                <div>{lastReceipt.department} with {lastReceipt.doctorName} on {lastReceipt.appointmentDate} at {formatTimeLabel(lastReceipt.appointmentTime)}</div>
                <div>Paid Rs. {lastReceipt.amount} via {lastReceipt.paymentMode}{lastReceipt.referenceNumber ? ` (${lastReceipt.referenceNumber})` : ""}</div>
                <div className="action-row" style={{ marginTop: 10 }}>
                  <Button type="button" variant="secondary" onClick={printLastReceipt}>Print Receipt</Button>
                </div>
              </div>
            ) : null}

            <div className="field-span-2 action-row">
              <Button type="submit" disabled={!canManageAppointments}>Collect Fee & Generate Token</Button>
            </div>
            {!canManageAppointments ? <div className="empty-state field-span-2">Appointment booking and cancellation are limited to admin and reception roles.</div> : null}
          </form>
        </article>

        <aside className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Today</div>
              <h3>Reception queue board</h3>
            </div>
          </div>

          <div className="queue-list">
            {todayQueue.map((appointment) => (
              <div className="queue-item" key={appointment.id}>
                <div>
                  <strong>Token {appointment.tokenNumber}</strong>
                  <div className="timeline-copy">{appointment.patientName}</div>
                  <div className="timeline-copy">{appointment.department}</div>
                  <div className="timeline-copy">{formatTimeLabel(appointment.appointmentTime)}</div>
                  <div className="timeline-copy">Receipt {appointment.consultationPayment?.receiptNumber || "paid"}</div>
                </div>
                <span className={`status-pill ${appointment.status}`}>{appointment.status}</span>
                <div className="queue-actions">
                  <button className="table-link button-link" type="button" onClick={() => handleQueueAction(appointment.id, "call", "call patient")}>Call</button>
                  <button className="table-link button-link" type="button" onClick={() => handleQueueAction(appointment.id, "hold", "hold")}>Hold</button>
                  <button className="table-link button-link" type="button" onClick={() => handleQueueAction(appointment.id, "requeue", "requeue")}>Requeue</button>
                  <button className="table-link button-link" type="button" onClick={() => handleQueueAction(appointment.id, "no_show", "no show")}>No Show</button>
                </div>
              </div>
            ))}

            {!todayQueue.length ? <div className="empty-state">No queue items scheduled for today yet.</div> : null}
          </div>
        </aside>
      </section>

      <section className="content-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Manage</div>
            <h3>Appointment list</h3>
          </div>
        </div>

        <form className="toolbar" onSubmit={applyFilters}>
          <input name="date" type="date" value={filters.date} onChange={handleFilterChange} />
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">All statuses</option>
            {masters.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <Button type="submit">Apply filters</Button>
        </form>

        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Appointment</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Receipt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => {
                const linkedPatient = patients.find((patient) => patient.id === appointment.patientId);
                const doctor = masters.doctors.find((entry) => entry.id === appointment.doctorId);

                return (
                  <tr key={appointment.id}>
                    <td>{appointment.appointmentNumber}</td>
                    <td>
                      {linkedPatient ? (
                        <Link className="table-link" to={`/patients/${linkedPatient.id}`}>
                          {appointment.patientName}
                        </Link>
                      ) : (
                        appointment.patientName
                      )}
                    </td>
                    <td>{doctor?.fullName || "Unassigned"}</td>
                    <td>{appointment.appointmentDate}</td>
                    <td>{formatTimeLabel(appointment.appointmentTime)}</td>
                    <td><span className={`status-pill ${appointment.status}`}>{appointment.status}</span></td>
                    <td>{appointment.consultationPayment?.receiptNumber || "-"}</td>
                    <td>
                      {!["cancelled", "no_show", "completed"].includes(appointment.status) ? (
                        <button className="table-link button-link" type="button" onClick={() => handleCancel(appointment.id)} disabled={!canManageAppointments}>
                          Cancel
                        </button>
                      ) : (
                        <span className="muted-text">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!appointments.length ? <div className="empty-state">No appointments found for the selected filters.</div> : null}
        </div>
      </section>

      {lastReceipt ? (
        <section className="appointment-receipt-print-sheet" aria-hidden="true">
          <div className="receipt-hospital-name">SR-AIIMS HMS</div>
          <div className="receipt-hospital-subtitle">Consultation Fee Receipt</div>
          <div className="receipt-token">Token {lastReceipt.tokenNumber}</div>
          <div className="receipt-grid">
            <div><strong>Receipt No.</strong><span>{lastReceipt.receiptNumber}</span></div>
            <div><strong>Appointment No.</strong><span>{lastReceipt.appointmentNumber}</span></div>
            <div><strong>Patient</strong><span>{lastReceipt.patientName}</span></div>
            <div><strong>Doctor</strong><span>{lastReceipt.doctorName}</span></div>
            <div><strong>Department</strong><span>{lastReceipt.department}</span></div>
            <div><strong>Date / Time</strong><span>{lastReceipt.appointmentDate} {formatTimeLabel(lastReceipt.appointmentTime)}</span></div>
            <div><strong>Amount Paid</strong><span>Rs. {lastReceipt.amount}</span></div>
            <div><strong>Payment Mode</strong><span>{lastReceipt.paymentMode}</span></div>
            <div><strong>Reference</strong><span>{lastReceipt.referenceNumber || "-"}</span></div>
          </div>
          <div className="receipt-footer">
            <span>Patient copy</span>
            <span>Authorized signature</span>
          </div>
        </section>
      ) : null}
    </DashboardLayout>
  );
}
