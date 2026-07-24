import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { createPatient, deletePatient, getPatients } from "../../services/api.js";

const titleOptionsByGender = {
  male: ["Master", "Mr", "Shri"],
  female: ["Baby", "Ms", "Miss", "Mrs", "Smt"],
  other: ["Master", "Mr", "Shri", "Baby", "Ms", "Miss", "Mrs", "Smt"]
};

function getTitleOptions(gender) {
  return titleOptionsByGender[gender] || titleOptionsByGender.other;
}

const initialForm = {
  patientType: "new",
  title: "",
  firstName: "",
  lastName: "",
  fatherName: "",
  dateOfBirth: "",
  ageYears: "",
  gender: "female",
  bloodGroup: "",
  maritalStatus: "",
  occupation: "",
  phone: "",
  altPhone: "",
  email: "",
  houseStreet: "",
  areaVillage: "",
  cityDistrict: "Sagar",
  state: "Madhya Pradesh",
  pincode: "",
  idType: "",
  idNumber: "",
  opdIpdNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  referredBy: "Front Desk"
};

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return "";
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

const patientDeleteReceptionEmails = new Set(["reception@sraiims.in"]);

function canDeletePatientRecord(user = {}) {
  return user.role === "admin" || user.role === "hr" || (
    user.role === "reception" && patientDeleteReceptionEmails.has(String(user.email || "").toLowerCase())
  );
}

export function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState(initialForm);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  async function loadPatients(searchValue = "") {
    setLoading(true);
    try {
      const response = await getPatients(searchValue);
      setPatients(response.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to load patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: patients.length,
      today: patients.filter((patient) => patient.registrationDate === today).length,
      fromSagar: patients.filter((patient) => (patient.cityDistrict || patient.city) === "Sagar").length
    };
  }, [patients]);

  const canRegisterPatient = ["admin", "reception"].includes(user?.role);
  const canDeletePatients = canDeletePatientRecord(user);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormState((current) => {
      const next = {
        ...current,
        [name]: value,
        ...(name === "dateOfBirth" ? { ageYears: calculateAge(value) } : {})
      };

      if (name === "gender" && !getTitleOptions(value).includes(current.title)) {
        next.title = "";
      }

      return next;
    });
  };

  const handleOpenForm = () => {
    setFormError("");
    setSuccess("");
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    if (submitting) {
      return;
    }

    setIsFormOpen(false);
    setFormError("");
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    await loadPatients(search);
  };

  const handleCreatePatient = async (event) => {
    event.preventDefault();
    if (!canRegisterPatient) {
      setFormError("Only admin and reception users can register patients.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setSuccess("");

    try {
      const response = await createPatient(formState);
      setSuccess(response.message);
      setPatients((current) => [response.item, ...current.filter((patient) => patient.id !== response.item.id)]);
      setFormState(initialForm);
      setIsFormOpen(false);
    } catch (apiError) {
      setFormError(apiError.message || "Unable to register patient.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePatient = async (patient) => {
    if (!canDeletePatients) {
      setError("Only admin, HR, and authorized reception can delete patients.");
      return;
    }

    const patientLabel = patient.registrationNumber || patient.uhid || patient.firstName || "this patient";
    if (!window.confirm(`Delete patient ${patientLabel}?`)) {
      return;
    }

    setDeletingPatientId(patient.id);
    setError("");
    setSuccess("");

    try {
      const response = await deletePatient(patient.uhid || patient.id);
      setPatients((current) => current.filter((entry) => entry.id !== patient.id));
      setSuccess(response.message || "Patient deleted successfully.");
    } catch (apiError) {
      setError(apiError.message || "Unable to delete patient.");
    } finally {
      setDeletingPatientId("");
    }
  };

  return (
    <DashboardLayout>
      <div className="patients-page patients-registry-page">
        <section className="hero-panel patients-hero">
          <div>
            <div className="eyebrow">Patient Registry</div>
            <h2>Search every patient from one clean registry.</h2>
          </div>
          <p>
            Use the visible Add Patient action when a new registration is needed; the registry stays focused on finding existing patients.
          </p>
        </section>

        <section className="stat-grid patients-stat-grid">
          <article className="stat-card">
            <div className="stat-label">Registered Patients</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-note">Current registry</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Today</div>
            <div className="stat-value">{stats.today}</div>
            <div className="stat-note">New registrations</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Sagar Base</div>
            <div className="stat-value">{stats.fromSagar}</div>
            <div className="stat-note">Primary city count</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Phase 2</div>
            <div className="stat-value">Live</div>
            <div className="stat-note">Patients active</div>
          </article>
        </section>

        <article className="content-card patients-registry-card patients-registry-full-card">
          <div className="section-header patients-registry-header">
            <div>
              <div className="eyebrow">Find Patient</div>
              <h3>Search and review registry</h3>
            </div>
            <Button type="button" onClick={handleOpenForm} disabled={!canRegisterPatient}>
              Add Patient
            </Button>
          </div>

          <form className="toolbar patients-search-toolbar" onSubmit={handleSearchSubmit}>
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by reg no., UHID, OPD/IPD no., phone, address, ID number, father name, or patient name"
            />
            <Button type="submit">Search</Button>
          </form>

          {error ? <div className="error-text">{error}</div> : null}
          {success ? <div className="success-text">{success}</div> : null}
          {!canRegisterPatient ? (
            <div className="empty-state patients-registration-note">
              Patient registration is available only to admin and reception roles.
            </div>
          ) : null}
          {loading ? <div className="empty-state">Loading patient registry...</div> : null}

          {!loading ? (
            <div className="table-shell patients-table-shell patients-registry-table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>UHID</th>
                    <th>Reg No. / PPIN</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Mobile</th>
                    <th>City / District</th>
                    <th>Registered</th>
                    {canDeletePatients ? <th></th> : null}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.uhid}</td>
                      <td>{patient.registrationNumber || patient.ppin || "Not assigned"}</td>
                      <td>{patient.title ? `${patient.title} ` : ""}{patient.firstName} {patient.lastName}</td>
                      <td>{patient.patientType || "new"}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.cityDistrict || patient.city}</td>
                      <td>{patient.registrationDate}</td>
                      <td>
                        <Link className="table-link" to={`/patients/${patient.id}`}>
                          View
                        </Link>
                      </td>
                      {canDeletePatients ? (
                        <td>
                          <button
                            className="table-link button-link danger-link"
                            type="button"
                            onClick={() => handleDeletePatient(patient)}
                            disabled={deletingPatientId === patient.id}
                          >
                            {deletingPatientId === patient.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!patients.length ? <div className="empty-state">No patients found for the current search.</div> : null}
            </div>
          ) : null}
        </article>
      </div>

      {isFormOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={handleCloseForm}>
          <section
            className="content-card patient-form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-header patient-form-modal-header">
              <div>
                <div className="eyebrow">Register</div>
                <h3 id="patient-form-title">New patient registration</h3>
              </div>
              <button className="modal-close-button" type="button" onClick={handleCloseForm} disabled={submitting}>
                x
              </button>
            </div>

            <div className="empty-state patients-registration-note">
              Registration number, date, and time are generated automatically when the patient is saved.
            </div>

            <form className="form-grid patient-form-modal-grid" onSubmit={handleCreatePatient}>
              <div className="field">
                <label>Patient type</label>
                <select name="patientType" value={formState.patientType} onChange={handleInputChange}>
                  <option value="new">New</option>
                  <option value="follow_up">Follow-up</option>
                </select>
              </div>
              <div className="field">
                <label>OPD / IPD No.</label>
                <input name="opdIpdNumber" value={formState.opdIpdNumber} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Gender</label>
                <select name="gender" value={formState.gender} onChange={handleInputChange}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Title</label>
                <select name="title" value={formState.title} onChange={handleInputChange} required>
                  <option value="">Select</option>
                  {getTitleOptions(formState.gender).map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>First name</label>
                <input name="firstName" value={formState.firstName} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Last name</label>
                <input name="lastName" value={formState.lastName} onChange={handleInputChange} />
              </div>
              <div className="field field-span-2">
                <label>Father's name</label>
                <input name="fatherName" value={formState.fatherName} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Date of birth</label>
                <input name="dateOfBirth" type="date" value={formState.dateOfBirth} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Age</label>
                <input
                  name="ageYears"
                  type="number"
                  min="0"
                  max="130"
                  value={formState.ageYears}
                  onChange={handleInputChange}
                  placeholder="Enter age if DOB unknown"
                />
              </div>
              <div className="field">
                <label>Blood group</label>
                <input name="bloodGroup" value={formState.bloodGroup} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Marital status</label>
                <select name="maritalStatus" value={formState.maritalStatus} onChange={handleInputChange}>
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                </select>
              </div>
              <div className="field field-span-2">
                <label>Occupation</label>
                <input name="occupation" value={formState.occupation} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Mobile no.</label>
                <input name="phone" value={formState.phone} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Alternate mobile no.</label>
                <input name="altPhone" value={formState.altPhone} onChange={handleInputChange} />
              </div>
              <div className="field field-span-2">
                <label>Email ID</label>
                <input name="email" type="email" value={formState.email} onChange={handleInputChange} />
              </div>
              <div className="field field-span-2">
                <label>House / Street</label>
                <input name="houseStreet" value={formState.houseStreet} onChange={handleInputChange} />
              </div>
              <div className="field field-span-2">
                <label>Area / Village</label>
                <input name="areaVillage" value={formState.areaVillage} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>City / District</label>
                <input name="cityDistrict" value={formState.cityDistrict} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>State</label>
                <input name="state" value={formState.state} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>PIN code</label>
                <input name="pincode" value={formState.pincode} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Referred by</label>
                <input name="referredBy" value={formState.referredBy} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>ID type</label>
                <select name="idType" value={formState.idType} onChange={handleInputChange}>
                  <option value="">Optional</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="pan">PAN</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>ID number</label>
                <input name="idNumber" value={formState.idNumber} onChange={handleInputChange} />
              </div>
              <div className="field">
                <label>Emergency contact</label>
                <input
                  name="emergencyContactName"
                  value={formState.emergencyContactName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="field">
                <label>Emergency phone</label>
                <input
                  name="emergencyContactPhone"
                  value={formState.emergencyContactPhone}
                  onChange={handleInputChange}
                />
              </div>

              {formError ? <div className="error-text field-span-2">{formError}</div> : null}

              <div className="field-span-2 action-row patient-form-modal-actions">
                <Button type="submit" disabled={submitting || !canRegisterPatient}>
                  {submitting ? "Registering..." : "Register Patient"}
                </Button>
                <button className="secondary-button" type="button" onClick={handleCloseForm} disabled={submitting}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
