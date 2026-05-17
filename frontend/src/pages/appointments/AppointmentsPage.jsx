import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentMasters,
  getAppointments,
  getAvailableSlots,
  getPatients,
  getTodayAppointments
} from "../../services/api.js";

const initialForm = {
  patientId: "",
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientMobile: "",
  doctorId: "",
  appointmentDate: new Date().toISOString().slice(0, 10),
  appointmentTime: "",
  type: "new",
  department: "",
  status: "scheduled",
  chiefComplaint: "",
  source: "Reception"
};

export function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [todayQueue, setTodayQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);
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
          source: mastersResponse.sources?.includes("Reception") ? "Reception" : (mastersResponse.sources?.[0] || "Reception")
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
  const selectedPatient = patients.find((patient) => patient.id === formState.patientId);
  const patientSearchTerm = patientSearch.trim().toLowerCase();
  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm) {
      return patients.slice(0, 30);
    }

    return patients
      .filter((patient) => {
        const searchableText = [
          patient.uhid,
          patient.registrationNumber,
          patient.firstName,
          patient.lastName,
          patient.fatherName,
          patient.phone,
          patient.cityDistrict,
          patient.city
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(patientSearchTerm);
      })
      .slice(0, 30);
  }, [patientSearchTerm, patients]);

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
        patientMobile: selectedPatient ? "" : current.patientMobile
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

  const handlePatientSearchChange = (event) => {
    const { value } = event.target;
    setPatientSearch(value);
    setIsPatientPickerOpen(true);
    setFormState((current) => ({
      ...current,
      patientId: ""
    }));
  };

  const handlePatientSelect = (patient) => {
    setPatientSearch(patientLabel(patient));
    setIsPatientPickerOpen(false);
    setFormState((current) => ({
      ...current,
      patientId: patient.id,
      patientName: "",
      patientAge: "",
      patientGender: "",
      patientMobile: ""
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

    try {
      const response = await createAppointment(formState);
      setSuccess(response.message);
      setPatientSearch("");
      setFormState((current) => ({
        ...initialForm,
        appointmentDate: current.appointmentDate,
        doctorId: current.doctorId || masters.doctors[0]?.id || "",
        department: (masters.doctors.find((doctor) => doctor.id === current.doctorId)?.department) || masters.doctors[0]?.department || masters.departments[0] || "",
        type: masters.types?.[0] || "new",
        source: masters.sources?.includes("Reception") ? "Reception" : (masters.sources?.[0] || "Reception")
      }));
      await loadData(filters);
      const refreshedSlots = await getAvailableSlots(formState.appointmentDate, formState.doctorId);
      setAvailableSlots(refreshedSlots.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to book appointment.");
    }
  };

  const handleCancel = async (id) => {
    if (!canManageAppointments) {
      setError("Only admin and reception users can cancel appointments.");
      return;
    }

    try {
      await cancelAppointment(id);
      await loadData(filters);
    } catch (apiError) {
      setError(apiError.message || "Unable to cancel appointment.");
    }
  };

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
              <div><strong>Morning:</strong> 09:00 - 13:30</div>
              <div><strong>Evening:</strong> 15:30 - 19:30</div>
              <div><strong>Sunday/Holiday:</strong> 09:00 - 12:30</div>
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
          <div className="stat-note">Ready for queue flow</div>
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
              <div className="patient-combobox">
                <input
                  value={selectedPatient ? patientLabel(selectedPatient) : patientSearch}
                  onChange={handlePatientSearchChange}
                  onFocus={() => setIsPatientPickerOpen(true)}
                  onBlur={() => window.setTimeout(() => setIsPatientPickerOpen(false), 140)}
                  placeholder="Click and type patient name, UHID, phone, father name, or city"
                  autoComplete="off"
                />
                {isPatientPickerOpen ? (
                  <div className="patient-combobox-menu">
                    {filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        className="patient-combobox-option"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <strong>{patientLabel(patient)}</strong>
                        <span>
                          {[patient.phone, patient.fatherName, patient.cityDistrict || patient.city].filter(Boolean).join(" | ") || "No extra details"}
                        </span>
                      </button>
                    ))}
                    {!filteredPatients.length ? (
                      <div className="patient-combobox-empty">No matching patient. Leave blank to enter a new patient below.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
                    {slot.time} {slot.isBooked ? "- Booked" : ""}
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
              <input name="chiefComplaint" value={formState.chiefComplaint} onChange={handleFormChange} required />
            </div>

            {error ? <div className="error-text field-span-2">{error}</div> : null}
            {success ? <div className="success-text field-span-2">{success}</div> : null}

            <div className="field-span-2 action-row">
              <Button type="submit" disabled={!canManageAppointments}>Book Appointment</Button>
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
                  <div className="timeline-copy">{appointment.appointmentTime}</div>
                </div>
                <span className={`status-pill ${appointment.status}`}>{appointment.status}</span>
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
                    <td>{appointment.appointmentTime}</td>
                    <td><span className={`status-pill ${appointment.status}`}>{appointment.status}</span></td>
                    <td>
                      {appointment.status !== "cancelled" ? (
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
    </DashboardLayout>
  );
}
