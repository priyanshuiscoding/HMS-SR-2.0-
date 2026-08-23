import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import {
  addIpdNote,
  addIpdVitals,
  createIpdAdmission,
  dischargeIpdAdmission,
  getIpdAdmission,
  getIpdAdmissions,
  getIpdBedDashboard,
  getIpdMasters,
  getPatients,
  scheduleIpdTherapy,
  updateIpdAdmissionWorkflow
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
  followUpDate: "",
  followUpWithOpd: true,
  followUpWithPhone: false,
  nextBedStatus: "cleaning",
  stayDays: "",
  extraCharge: "",
  extraChargeLabel: "",
  bedNote: "",
  metadata: {
    finalDiagnoses: ["", "", ""],
    dischargeVitals: { systolic: "", diastolic: "", pulse: "", temp: "", spo2: "", weight: "" },
    medicinesAdministered: Array.from({ length: 5 }, () => ({ medicineName: "", dosage: "", durationDays: "", remarks: "" })),
    yogaTherapy: [{ asanas: "", pranayama: "", sessions: "", durationMinutes: "" }],
    panchkarmaTherapy: [
      { procedure: "Nasya", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Virechana", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Basti (Enema)", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Vamana (Emesis)", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Shirodhara", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Abhyanga (Massage)", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Pizhichil", sessions: "", durationMinutes: "", response: "" },
      { procedure: "Kizhi", sessions: "", durationMinutes: "", response: "" }
    ],
    specializedTherapy: [
      { therapy: "Udwartana", sessions: "", durationMinutes: "", therapistSign: "" },
      { therapy: "Lepam (Herbal Paste)", sessions: "", durationMinutes: "", therapistSign: "" },
      { therapy: "Swedanam (Steam)", sessions: "", durationMinutes: "", therapistSign: "" },
      { therapy: "Akshibasti (Eye)", sessions: "", durationMinutes: "", therapistSign: "" }
    ],
    clinicalImprovement: { overallStatus: "", symptomRelief: "", functionalStatus: "" },
    dietAdvice: { recommendedDiet: "", foodsToInclude: "", foodsToAvoid: "" },
    lifestyleAdvice: { yogaPranayama: "", physicalActivity: "", sleepBedTime: "", sleepWakeTime: "", sleepDurationHours: "", stressManagement: "" },
    dischargeMedicines: Array.from({ length: 8 }, () => ({ medicineName: "", strengthRoute: "", dosage: "", duration: "", remarks: "" }))
  }
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDischargeForm(summary = null) {
  const base = clone(initialDischargeForm);
  if (!summary) return base;

  return {
    ...base,
    ...summary,
    metadata: {
      ...base.metadata,
      ...(summary.metadata || {}),
      dischargeVitals: { ...base.metadata.dischargeVitals, ...(summary.metadata?.dischargeVitals || {}) },
      clinicalImprovement: { ...base.metadata.clinicalImprovement, ...(summary.metadata?.clinicalImprovement || {}) },
      dietAdvice: { ...base.metadata.dietAdvice, ...(summary.metadata?.dietAdvice || {}) },
      lifestyleAdvice: { ...base.metadata.lifestyleAdvice, ...(summary.metadata?.lifestyleAdvice || {}) }
    }
  };
}

function BedDashboardIcon({ type }) {
  if (type === "availability") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (type === "occupancy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 19c.8-4 3-6 6.5-6s5.7 2 6.5 6" />
      </svg>
    );
  }

  if (type === "percentage") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 17 17 7" />
        <circle cx="7.5" cy="7.5" r="2" />
        <circle cx="16.5" cy="16.5" r="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 18v-7m18 7v-5a2 2 0 0 0-2-2H9v7M3 14h18M6 11V7h5a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function categoryNote(category, emptyLabel) {
  if (!category?.totalBeds) {
    return emptyLabel;
  }

  const roomLabel = `${category.totalRooms} ${category.totalRooms === 1 ? "room" : "rooms"}`;
  return `${category.availableBeds} available · ${category.occupiedBeds} occupied · ${roomLabel}`;
}

export function IpdPage() {
  const [census, setCensus] = useState(null);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
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
      const [censusResponse, admissionsResponse, mastersResponse, patientsResponse] = await Promise.all([
        getIpdBedDashboard(),
        getIpdAdmissions(nextFilters),
        getIpdMasters(),
        getPatients()
      ]);

      setCensus(censusResponse);
      setDashboardError("");
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

  async function refreshBedDashboard({ silent = false } = {}) {
    if (!silent) {
      setDashboardRefreshing(true);
    }

    try {
      setCensus(await getIpdBedDashboard());
      setDashboardError("");
    } catch (apiError) {
      setDashboardError(apiError.message || "Live bed data is temporarily unavailable.");
    } finally {
      if (!silent) {
        setDashboardRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadData({ status: "active", search: "" });

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshBedDashboard({ silent: true });
      }
    }, 10000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshBedDashboard({ silent: true });
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
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

  const updateAdmissionField = (name, value) => {
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

  const handleDischargeArrayChange = (section, index, field, value) => {
    setDischargeForm((current) => {
      const rows = [...(current.metadata?.[section] || [])];
      rows[index] = field ? { ...rows[index], [field]: value } : value;
      return { ...current, metadata: { ...current.metadata, [section]: rows } };
    });
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
      setDischargeForm(mergeDischargeForm(detail.dischargeSummary));
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

  const printIpdDischarge = () => {
    const cleanup = () => {
      document.body.classList.remove("print-ipd-discharge");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("print-ipd-discharge");
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 0);
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

  const handleAdmissionWorkflow = async (action, label = action) => {
    if (!selectedAdmission?.id) {
      return;
    }

    const reason = window.prompt(`Reason for ${label}:`);
    if (!reason?.trim()) {
      setError("Reason is required for IPD workflow actions.");
      return;
    }

    try {
      const response = await updateIpdAdmissionWorkflow(selectedAdmission.id, {
        action,
        reason,
        nextBedStatus: "cleaning",
        bedNote: reason
      });
      setMessage(response.message);
      setSelectedAdmission(response.item);
      await loadData(filters, selectedAdmission.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to update IPD workflow.");
    }
  };

  const bedSummary = census?.summary || {
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyPercent: 0
  };
  const bedCategories = census?.bedCategories || {};
  const dashboardCards = [
    { label: "Total Beds", value: bedSummary.totalBeds, note: "Configured inpatient capacity", type: "bed", tone: "blue" },
    { label: "Occupied Beds", value: bedSummary.occupiedBeds, note: `${bedSummary.totalBeds - bedSummary.occupiedBeds} beds not occupied`, type: "occupancy", tone: "orange" },
    { label: "Available Beds", value: bedSummary.availableBeds, note: "Ready for immediate admission", type: "availability", tone: "green" },
    { label: "Male Ward", value: bedCategories.maleWard?.totalBeds || 0, note: categoryNote(bedCategories.maleWard, "No male ward beds configured"), type: "bed", tone: "blue" },
    { label: "Female Ward", value: bedCategories.femaleWard?.totalBeds || 0, note: categoryNote(bedCategories.femaleWard, "No female ward beds configured"), type: "bed", tone: "violet" },
    { label: "Deluxe Rooms", value: bedCategories.deluxeRooms?.totalBeds || 0, note: categoryNote(bedCategories.deluxeRooms, "No deluxe/private rooms configured"), type: "bed", tone: "gold" },
    { label: "ICU", value: bedCategories.icu?.totalBeds || 0, note: categoryNote(bedCategories.icu, "No ICU beds configured"), type: "occupancy", tone: "red" },
    { label: "Bed Occupancy", value: `${bedSummary.occupancyPercent}%`, note: `${bedSummary.occupiedBeds} of ${bedSummary.totalBeds} beds occupied`, type: "percentage", tone: "navy", progress: bedSummary.occupancyPercent }
  ];
  const dashboardUpdatedAt = census?.updatedAt
    ? new Date(census.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "Waiting for data";
  const selectedTherapy = masters.therapies?.find((item) => item.id === therapyForm.therapyId);
  const selectedPackage = masters.treatmentPackages?.find((item) => item.id === therapyForm.packageId);
  const patientLabel = (patient) => `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  const latestVitals = selectedAdmission?.vitals?.[0] || {};

  return (
    <DashboardLayout>
      <section className="ipd-bed-dashboard no-print" aria-labelledby="ipd-bed-dashboard-title">
        <div className="ipd-dashboard-header">
          <div>
            <div className="eyebrow">IPD · Live census</div>
            <h2 id="ipd-bed-dashboard-title">Bed availability dashboard</h2>
            <div className={`ipd-live-status ${dashboardError ? "stale" : ""}`} role="status">
              <span className="ipd-live-dot" aria-hidden="true" />
              {dashboardError ? "Showing last available data" : `Live · Updated ${dashboardUpdatedAt}`}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => refreshBedDashboard()} disabled={dashboardRefreshing}>
            {dashboardRefreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>

        {dashboardError ? <div className="ipd-dashboard-warning">{dashboardError} Automatic refresh will retry.</div> : null}

        <div className="ipd-bed-metric-grid">
          {dashboardCards.map((card) => (
            <article className={`ipd-bed-metric-card ${card.tone}`} key={card.label}>
              <div className="ipd-metric-topline">
                <div className={`ipd-metric-icon ${card.tone}`}>
                  <BedDashboardIcon type={card.type} />
                </div>
                <span>{card.label}</span>
              </div>
              <div className="ipd-metric-value">{card.value}</div>
              <div className="ipd-metric-note">{card.note}</div>
              {card.progress !== undefined ? (
                <div
                  className="ipd-occupancy-track"
                  role="progressbar"
                  aria-label="Bed occupancy percentage"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={card.progress}
                >
                  <span style={{ width: `${Math.min(Math.max(card.progress, 0), 100)}%` }} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Admit Patient</div><h3>New IPD admission</h3></div></div>
          <form className="form-grid" onSubmit={handleCreateAdmission}>
            <div className="field field-span-2">
              <label>Patient</label>
              <SearchableSelect
                value={admissionForm.patientId}
                options={patients}
                loadOptions={(query) => getPatients(query, { pageSize: 30 }).then((response) => response.items || [])}
                onChange={(value) => updateAdmissionField("patientId", value)}
                placeholder="Search patient by name, UHID, phone, father name, or city"
                emptyLabel="No matching patient"
                getOptionLabel={patientLabel}
                getOptionMeta={(patient) => [patient.phone, patient.fatherName, patient.cityDistrict || patient.city].filter(Boolean).join(" | ")}
                getSearchText={(patient) => [
                  patient.uhid,
                  patient.registrationNumber,
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
              <label>Room</label>
              <SearchableSelect
                value={admissionForm.roomId}
                options={roomOptions}
                onChange={(value) => updateAdmissionField("roomId", value)}
                placeholder="Search room or ward"
                emptyLabel="No matching room"
                getOptionValue={(room) => room.roomId}
                getOptionLabel={(room) => `${room.roomNumber} - ${room.ward}`}
                getOptionMeta={(room) => room.roomType || ""}
              />
            </div>
            <div className="field">
              <label>Bed</label>
              <SearchableSelect
                value={admissionForm.bedId}
                options={availableBeds}
                onChange={(value) => updateAdmissionField("bedId", value)}
                placeholder="Search bed"
                emptyLabel={admissionForm.roomId ? "No matching bed" : "Select a room first"}
                getOptionLabel={(bed) => `${bed.bedNumber} - ${bed.bedLabel}`}
                getOptionMeta={(bed) => bed.status || ""}
                disabled={!admissionForm.roomId}
              />
            </div>
            <div className="field">
              <label>Attending doctor</label>
              <SearchableSelect
                value={admissionForm.attendingDoctorId}
                options={masters.doctors}
                onChange={(value) => updateAdmissionField("attendingDoctorId", value)}
                placeholder="Search doctor"
                emptyLabel="No matching doctor"
                getOptionLabel={(doctor) => doctor.fullName}
                getOptionMeta={(doctor) => doctor.department || ""}
              />
            </div>
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
            <select name="status" value={filters.status} onChange={handleFilterChange}><option value="">All statuses</option><option value="active">active</option><option value="discharged">discharged</option><option value="transferred">transferred</option><option value="cancelled">cancelled</option></select>
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
          <div className="section-header">
            <div><div className="eyebrow">Admission Detail</div><h3>{selectedAdmission?.admissionNumber || "Select an admission"}</h3></div>
            {selectedAdmission ? (
              <div className="action-row">
                <Button variant="secondary" onClick={() => handleAdmissionWorkflow("cancel", "cancel admission")}>Cancel</Button>
                <Button variant="secondary" onClick={() => handleAdmissionWorkflow("transfer", "transfer admission")}>Transfer</Button>
                <Button variant="secondary" onClick={() => handleAdmissionWorkflow("reopen", "reopen admission")}>Reopen</Button>
              </div>
            ) : null}
          </div>
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
                        <div className="timeline-copy">Bill: {session.billId ? "Billed" : session.status === "completed" ? "Pending at billing desk" : "Pending completion"}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">No therapies scheduled for this admission yet.</div>}
              </div>

              {selectedAdmission.dischargeSummary ? (
                <div className="content-card inset-card print-sheet-card" style={{ marginTop: 18 }}>
                  <div className="section-header no-print">
                    <div><h3>Discharge Summary</h3></div>
                    <Button variant="secondary" onClick={printIpdDischarge}>Print Summary</Button>
                  </div>
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
                  <div className="discharge-print-sheet ipd-discharge-print-sheet">
                    <div className="print-hospital-name">SHANTI-RATNAM AYUSH INSTITUTE OF INDIAN MEDICINAL SCIENCES, LANE NO. 3, NEHANAGAR, MAKRONIA, SAGAR (M.P)</div>
                    <div className="print-hospital-subtitle">07582357300, 8989927755, www.shantiratnam.com</div>
                    <h2>Patient & Admission Information</h2>
                    <div className="print-grid">
                      <div><strong>Patient Name:</strong> {selectedAdmission.patientName}</div>
                      <div><strong>IPD No./MRN:</strong> {selectedAdmission.admissionNumber}</div>
                      <div><strong>DOB/Age:</strong> {selectedAdmission.patient?.dateOfBirth || selectedAdmission.patient?.ageYears || "-"}</div>
                      <div><strong>Gender:</strong> {selectedAdmission.patient?.gender || "-"}</div>
                      <div><strong>Contact:</strong> {selectedAdmission.patient?.phone || "-"}</div>
                      <div><strong>Date of Admission:</strong> {selectedAdmission.admissionDate}</div>
                      <div><strong>Date of Discharge:</strong> {selectedAdmission.dischargeSummary.dischargeDate}</div>
                      <div><strong>Length of Stay:</strong> {selectedAdmission.dischargeSummary.stayDays} days</div>
                      <div><strong>Ward/Room:</strong> {selectedAdmission.room?.ward || "-"} / {selectedAdmission.room?.roomNumber || "-"}</div>
                      <div><strong>Consulting Physician:</strong> {selectedAdmission.doctor?.fullName || "-"}</div>
                    </div>
                    <h2>Reason for Hospitalization & Final Diagnosis</h2>
                    <p><strong>Chief Complaint:</strong> {selectedAdmission.reasonForAdmission || "-"}</p>
                    <ol>{(selectedAdmission.dischargeSummary.metadata?.finalDiagnoses || []).filter(Boolean).map((item, index) => <li key={`final-dx-${index}`}>{item}</li>)}</ol>
                    <h2>Clinical Course During Hospitalization</h2>
                    <p>{selectedAdmission.dischargeSummary.dischargeNote || "-"}</p>
                    <h2>Vital Signs at Discharge</h2>
                    <div className="print-grid">
                      <div><strong>BP:</strong> {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.systolic || latestVitals.bp || "-"} / {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.diastolic || ""}</div>
                      <div><strong>Pulse:</strong> {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.pulse || latestVitals.pulse || "-"} bpm</div>
                      <div><strong>Temp/SPO2:</strong> {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.temp || latestVitals.temp || "-"} / {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.spo2 || latestVitals.spo2 || "-"}%</div>
                      <div><strong>Weight:</strong> {selectedAdmission.dischargeSummary.metadata?.dischargeVitals?.weight || latestVitals.weight || "-"} kg</div>
                    </div>
                    <h2>Ayurvedic Medicines Administered</h2>
                    <table className="print-table"><thead><tr><th>Medicine Name</th><th>Dosage</th><th>Duration (Days)</th><th>Remarks</th></tr></thead><tbody>{(selectedAdmission.dischargeSummary.metadata?.medicinesAdministered || []).map((row, index) => <tr key={`admin-med-${index}`}><td>{row.medicineName}</td><td>{row.dosage}</td><td>{row.durationDays}</td><td>{row.remarks}</td></tr>)}</tbody></table>
                    <h2>Yoga & Pranayama Therapy Provided During Hospitalization</h2>
                    <table className="print-table"><thead><tr><th>Yoga Asanas Taught</th><th>Pranayama Techniques</th><th>Sessions Conducted</th></tr></thead><tbody>{(selectedAdmission.dischargeSummary.metadata?.yogaTherapy || []).map((row, index) => <tr key={`yoga-${index}`}><td>{row.asanas}</td><td>{row.pranayama}</td><td>{row.sessions} sessions, {row.durationMinutes} min/session</td></tr>)}</tbody></table>
                    <h2>Panchakarma Therapies Administered</h2>
                    <table className="print-table"><thead><tr><th>Procedure</th><th>No. of Sessions</th><th>Duration/Session</th><th>Response</th></tr></thead><tbody>{(selectedAdmission.dischargeSummary.metadata?.panchkarmaTherapy || []).map((row, index) => <tr key={`pk-${index}`}><td>{row.procedure}</td><td>{row.sessions}</td><td>{row.durationMinutes} min</td><td>{row.response}</td></tr>)}</tbody></table>
                    <h2>Clinical Improvement & Response to Treatment</h2>
                    <p><strong>Overall Status:</strong> {selectedAdmission.dischargeSummary.metadata?.clinicalImprovement?.overallStatus || selectedAdmission.dischargeSummary.conditionOnDischarge}</p>
                    <p><strong>Symptom Relief:</strong> {selectedAdmission.dischargeSummary.metadata?.clinicalImprovement?.symptomRelief || "-"}</p>
                    <p><strong>Functional Status:</strong> {selectedAdmission.dischargeSummary.metadata?.clinicalImprovement?.functionalStatus || "-"}</p>
                    <h2>Dietary & Lifestyle Advice at Discharge</h2>
                    <p><strong>Recommended Diet:</strong> {selectedAdmission.dischargeSummary.metadata?.dietAdvice?.recommendedDiet || "-"}</p>
                    <p><strong>Foods to Include:</strong> {selectedAdmission.dischargeSummary.metadata?.dietAdvice?.foodsToInclude || "-"}</p>
                    <p><strong>Foods to Avoid:</strong> {selectedAdmission.dischargeSummary.metadata?.dietAdvice?.foodsToAvoid || "-"}</p>
                    <p><strong>Lifestyle:</strong> {selectedAdmission.dischargeSummary.advice || "-"}</p>
                    <h2>Discharge Medications & Continuation</h2>
                    <table className="print-table"><thead><tr><th>Medicine Name</th><th>Strength & Route</th><th>Dosage</th><th>Duration</th><th>Remarks</th></tr></thead><tbody>{(selectedAdmission.dischargeSummary.metadata?.dischargeMedicines || []).map((row, index) => <tr key={`dc-med-${index}`}><td>{row.medicineName}</td><td>{row.strengthRoute}</td><td>{row.dosage}</td><td>{row.duration}</td><td>{row.remarks}</td></tr>)}</tbody></table>
                    <h2>Follow-up & Monitoring Plan</h2>
                    <p><strong>Follow-up Date:</strong> {selectedAdmission.dischargeSummary.followUpDate || "As advised"} <strong>Follow-up with:</strong> {selectedAdmission.dischargeSummary.followUpWithOpd ? "OPD " : ""}{selectedAdmission.dischargeSummary.followUpWithPhone ? "Phone" : ""}</p>
                    <div className="signature-line">Consulting Physician Signature</div>
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
                  Therapy completion and material usage are handled in Panchkarma. Completed therapies appear as pending charges at the Billing Desk.
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
                <div className="field"><label>Follow-up date</label><input type="date" name="followUpDate" value={dischargeForm.followUpDate} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Bed status after discharge</label><select name="nextBedStatus" value={dischargeForm.nextBedStatus} onChange={handleDischargeFormChange}><option value="cleaning">cleaning</option><option value="available">available</option><option value="maintenance">maintenance</option></select></div>
                <div className="field"><label>Extra charge</label><input name="extraCharge" value={dischargeForm.extraCharge} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Extra charge label</label><input name="extraChargeLabel" value={dischargeForm.extraChargeLabel} onChange={handleDischargeFormChange} /></div>
                {dischargeForm.metadata.finalDiagnoses.map((diagnosis, index) => (
                  <div className="field field-span-2" key={`final-diagnosis-${index}`}><label>Final diagnosis {index + 1}</label><input value={diagnosis} onChange={(event) => handleDischargeArrayChange("finalDiagnoses", index, "", event.target.value)} /></div>
                ))}
                <div className="field"><label>Discharge BP systolic</label><input value={dischargeForm.metadata.dischargeVitals.systolic} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "systolic", event.target.value)} /></div>
                <div className="field"><label>Discharge BP diastolic</label><input value={dischargeForm.metadata.dischargeVitals.diastolic} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "diastolic", event.target.value)} /></div>
                <div className="field"><label>Pulse</label><input value={dischargeForm.metadata.dischargeVitals.pulse} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "pulse", event.target.value)} /></div>
                <div className="field"><label>Temp</label><input value={dischargeForm.metadata.dischargeVitals.temp} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "temp", event.target.value)} /></div>
                <div className="field"><label>SPO2</label><input value={dischargeForm.metadata.dischargeVitals.spo2} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "spo2", event.target.value)} /></div>
                <div className="field"><label>Weight</label><input value={dischargeForm.metadata.dischargeVitals.weight} onChange={(event) => handleDischargeMetadataChange("dischargeVitals", "weight", event.target.value)} /></div>
                <div className="field field-span-2"><label>Discharge summary</label><input name="dischargeNote" value={dischargeForm.dischargeNote} onChange={handleDischargeFormChange} /></div>
                <div className="field field-span-2"><label>Advice</label><input name="advice" value={dischargeForm.advice} onChange={handleDischargeFormChange} /></div>
                <div className="field"><label>Overall clinical status</label><input value={dischargeForm.metadata.clinicalImprovement.overallStatus} onChange={(event) => handleDischargeMetadataChange("clinicalImprovement", "overallStatus", event.target.value)} /></div>
                <div className="field"><label>Symptom relief</label><select value={dischargeForm.metadata.clinicalImprovement.symptomRelief} onChange={(event) => handleDischargeMetadataChange("clinicalImprovement", "symptomRelief", event.target.value)}><option value="">Select</option><option value="complete">complete</option><option value="significant">significant</option><option value="moderate">moderate</option><option value="minimal">minimal</option></select></div>
                <div className="field"><label>Functional status</label><select value={dischargeForm.metadata.clinicalImprovement.functionalStatus} onChange={(event) => handleDischargeMetadataChange("clinicalImprovement", "functionalStatus", event.target.value)}><option value="">Select</option><option value="normal">normal</option><option value="improved">improved</option><option value="partially_improved">partially improved</option><option value="no_change">no change</option></select></div>
                <div className="field"><label>Recommended diet</label><input value={dischargeForm.metadata.dietAdvice.recommendedDiet} onChange={(event) => handleDischargeMetadataChange("dietAdvice", "recommendedDiet", event.target.value)} /></div>
                <div className="field"><label>Foods to include</label><input value={dischargeForm.metadata.dietAdvice.foodsToInclude} onChange={(event) => handleDischargeMetadataChange("dietAdvice", "foodsToInclude", event.target.value)} /></div>
                <div className="field"><label>Foods to avoid</label><input value={dischargeForm.metadata.dietAdvice.foodsToAvoid} onChange={(event) => handleDischargeMetadataChange("dietAdvice", "foodsToAvoid", event.target.value)} /></div>
                <div className="field field-span-2">
                  <label>Medicines administered</label>
                  <div className="medicine-stack">
                    {dischargeForm.metadata.medicinesAdministered.map((row, index) => (
                      <div className="medicine-card" key={`administered-${index}`}>
                        <div className="form-grid">
                          <div className="field"><label>Medicine</label><input value={row.medicineName} onChange={(event) => handleDischargeArrayChange("medicinesAdministered", index, "medicineName", event.target.value)} /></div>
                          <div className="field"><label>Dosage</label><input value={row.dosage} onChange={(event) => handleDischargeArrayChange("medicinesAdministered", index, "dosage", event.target.value)} /></div>
                          <div className="field"><label>Days</label><input value={row.durationDays} onChange={(event) => handleDischargeArrayChange("medicinesAdministered", index, "durationDays", event.target.value)} /></div>
                          <div className="field"><label>Remarks</label><input value={row.remarks} onChange={(event) => handleDischargeArrayChange("medicinesAdministered", index, "remarks", event.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="field field-span-2">
                  <label>Panchkarma therapies administered</label>
                  <div className="medicine-stack">
                    {dischargeForm.metadata.panchkarmaTherapy.map((row, index) => (
                      <div className="medicine-card" key={`discharge-pk-${index}`}>
                        <div className="form-grid">
                          <div className="field"><label>Procedure</label><input value={row.procedure} onChange={(event) => handleDischargeArrayChange("panchkarmaTherapy", index, "procedure", event.target.value)} /></div>
                          <div className="field"><label>Sessions</label><input value={row.sessions} onChange={(event) => handleDischargeArrayChange("panchkarmaTherapy", index, "sessions", event.target.value)} /></div>
                          <div className="field"><label>Minutes/session</label><input value={row.durationMinutes} onChange={(event) => handleDischargeArrayChange("panchkarmaTherapy", index, "durationMinutes", event.target.value)} /></div>
                          <div className="field"><label>Response</label><input value={row.response} onChange={(event) => handleDischargeArrayChange("panchkarmaTherapy", index, "response", event.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="field field-span-2">
                  <label>Discharge medicines</label>
                  <div className="medicine-stack">
                    {dischargeForm.metadata.dischargeMedicines.map((row, index) => (
                      <div className="medicine-card" key={`discharge-med-${index}`}>
                        <div className="form-grid">
                          <div className="field"><label>Medicine</label><input value={row.medicineName} onChange={(event) => handleDischargeArrayChange("dischargeMedicines", index, "medicineName", event.target.value)} /></div>
                          <div className="field"><label>Strength & route</label><input value={row.strengthRoute} onChange={(event) => handleDischargeArrayChange("dischargeMedicines", index, "strengthRoute", event.target.value)} /></div>
                          <div className="field"><label>Dosage</label><input value={row.dosage} onChange={(event) => handleDischargeArrayChange("dischargeMedicines", index, "dosage", event.target.value)} /></div>
                          <div className="field"><label>Duration</label><input value={row.duration} onChange={(event) => handleDischargeArrayChange("dischargeMedicines", index, "duration", event.target.value)} /></div>
                          <div className="field field-span-2"><label>Remarks</label><input value={row.remarks} onChange={(event) => handleDischargeArrayChange("dischargeMedicines", index, "remarks", event.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <label className="checkbox-chip"><input type="checkbox" name="followUpWithOpd" checked={dischargeForm.followUpWithOpd} onChange={handleDischargeFormChange} /> Follow-up OPD</label>
                <label className="checkbox-chip"><input type="checkbox" name="followUpWithPhone" checked={dischargeForm.followUpWithPhone} onChange={handleDischargeFormChange} /> Follow-up phone</label>
                <div className="field field-span-2"><label>Bed note</label><input name="bedNote" value={dischargeForm.bedNote} onChange={handleDischargeFormChange} /></div>
                <div className="empty-state field-span-2">Stay charges are recorded on discharge and billed at the Billing Desk with the rest of the admission.</div>
                <div className="field field-span-2"><Button type="submit">Discharge Patient</Button></div>
              </form>
            )}
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
