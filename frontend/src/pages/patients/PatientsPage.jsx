import { useEffect, useMemo, useState } from "react";
import { Link } from "../../router.jsx";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import { createPatient, deletePatient, getPatientRecycleBin, getPatients, restorePatient } from "../../services/api.js";

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

const initialFilters = {
  patientType: "all",
  gender: "all",
  city: "all",
  fromDate: "",
  toDate: ""
};

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "regno_asc", label: "Reg no. (low to high)" },
  { value: "regno_desc", label: "Reg no. (high to low)" },
  { value: "city_asc", label: "City / District (A-Z)" },
  { value: "relevance", label: "Search relevance" }
];

const patientTypeLabels = {
  new: "New",
  follow_up: "Follow-up",
  old: "Old"
};

function toTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Registration date + time is what the receptionist sees, but two patients saved in
// the same minute share it, so created_at breaks the tie and keeps the newest on top.
function registrationTimestamp(patient) {
  if (!patient.registrationDate) {
    return toTimestamp(patient.createdAt);
  }

  const time = patient.registrationTime || "00:00";
  const stamp = Date.parse(`${patient.registrationDate}T${time.length === 5 ? `${time}:00` : time}`);

  return Number.isNaN(stamp) ? toTimestamp(patient.createdAt) : stamp;
}

function compareByRecency(first, second) {
  return (registrationTimestamp(second) - registrationTimestamp(first))
    || (toTimestamp(second.createdAt) - toTimestamp(first.createdAt));
}

function patientName(patient) {
  return `${patient.firstName || ""} ${patient.lastName || ""}`.trim().toLowerCase();
}

function registrationNumberValue(patient) {
  const digits = String(patient.registrationNumber || patient.ppin || "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function compareRegistrationNumbers(first, second, direction) {
  const firstValue = registrationNumberValue(first);
  const secondValue = registrationNumberValue(second);

  if (firstValue === null && secondValue === null) {
    return compareByRecency(first, second);
  }

  if (firstValue === null) {
    return 1;
  }

  if (secondValue === null) {
    return -1;
  }

  return direction === "asc" ? firstValue - secondValue : secondValue - firstValue;
}

function sortPatients(items, sort) {
  const sorted = [...items];

  switch (sort) {
    case "oldest":
      return sorted.sort((first, second) => compareByRecency(second, first));
    case "name_asc":
      return sorted.sort((first, second) => patientName(first).localeCompare(patientName(second)));
    case "name_desc":
      return sorted.sort((first, second) => patientName(second).localeCompare(patientName(first)));
    case "regno_asc":
      return sorted.sort((first, second) => compareRegistrationNumbers(first, second, "asc"));
    case "regno_desc":
      return sorted.sort((first, second) => compareRegistrationNumbers(first, second, "desc"));
    case "city_asc":
      return sorted.sort((first, second) => {
        const firstCity = String(first.cityDistrict || first.city || "").toLowerCase();
        const secondCity = String(second.cityDistrict || second.city || "").toLowerCase();
        return firstCity.localeCompare(secondCity) || compareByRecency(first, second);
      });
    case "relevance":
      return sorted;
    default:
      return sorted.sort(compareByRecency);
  }
}

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

function canDeletePatientRecord(user = {}) {
  return user.role === "admin" || user.role === "hr";
}

export function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState("newest");
  const [formState, setFormState] = useState(initialForm);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [recycleBinPatients, setRecycleBinPatients] = useState([]);
  const [recycleBinMeta, setRecycleBinMeta] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [recycleBinLoading, setRecycleBinLoading] = useState(false);
  const [restoringPatientId, setRestoringPatientId] = useState("");

  async function loadPatients(searchValue = "", page = 1) {
    setLoading(true);
    try {
      const response = await getPatients(searchValue, { page, pageSize: pagination.pageSize });
      setPatients(response.items || []);
      setPagination((current) => ({ ...current, ...(response.meta || {}), page }));
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
      total: pagination.total,
      today: patients.filter((patient) => patient.registrationDate === today).length,
      fromSagar: patients.filter((patient) => (patient.cityDistrict || patient.city) === "Sagar").length
    };
  }, [patients, pagination.total]);

  const cityOptions = useMemo(() => {
    const uniqueCities = new Map();

    patients.forEach((patient) => {
      const label = String(patient.cityDistrict || patient.city || "").trim();
      if (label) {
        uniqueCities.set(label.toLowerCase(), label);
      }
    });

    return [...uniqueCities.entries()].sort((first, second) => first[1].localeCompare(second[1]));
  }, [patients]);

  const visiblePatients = useMemo(() => {
    const filtered = patients.filter((patient) => {
      if (filters.patientType !== "all" && (patient.patientType || "new") !== filters.patientType) {
        return false;
      }

      if (filters.gender !== "all" && String(patient.gender || "").toLowerCase() !== filters.gender) {
        return false;
      }

      if (filters.city !== "all" && String(patient.cityDistrict || patient.city || "").toLowerCase() !== filters.city) {
        return false;
      }

      const registeredOn = patient.registrationDate || "";

      if (filters.fromDate && (!registeredOn || registeredOn < filters.fromDate)) {
        return false;
      }

      if (filters.toDate && (!registeredOn || registeredOn > filters.toDate)) {
        return false;
      }

      return true;
    });

    return sortPatients(filtered, sort);
  }, [patients, filters, sort]);

  const activeFilterCount = useMemo(
    () => Object.entries(initialFilters).filter(([key, emptyValue]) => filters[key] !== emptyValue).length,
    [filters]
  );

  const canRegisterPatient = canPerformModuleAction(user, "patients", ["admin", "reception", "doctor"]);
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

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setSort("newest");
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    await loadPatients(search, 1);
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
      setPagination((current) => ({ ...current, total: current.total + 1, totalPages: Math.max(1, Math.ceil((current.total + 1) / current.pageSize)) }));
      // Clear any active filter/sort so the freshly registered patient is visible at the top.
      setFilters(initialFilters);
      setSort("newest");
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
      setError("Only admin and HR can archive patients.");
      return;
    }

    const patientLabel = patient.registrationNumber || patient.uhid || patient.firstName || "this patient";
    const reason = window.prompt(`Reason for archiving patient ${patientLabel}:`);
    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setError("An archive reason is required.");
      return;
    }

    if (!window.confirm(`Move patient ${patientLabel} to the recycle bin? Their clinical records will remain preserved.`)) return;

    setDeletingPatientId(patient.id);
    setError("");
    setSuccess("");

    try {
      const response = await deletePatient(patient.uhid || patient.id, reason.trim());
      setPatients((current) => current.filter((entry) => entry.id !== patient.id));
      setPagination((current) => ({ ...current, total: Math.max(0, current.total - 1), totalPages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.pageSize)) }));
      setSuccess(response.message || "Patient moved to the recycle bin.");
    } catch (apiError) {
      setError(apiError.message || "Unable to delete patient.");
    } finally {
      setDeletingPatientId("");
    }
  };

  const openRecycleBin = async (page = 1) => {
    if (!canDeletePatients) return;
    setIsRecycleBinOpen(true);
    setRecycleBinLoading(true);
    setError("");
    try {
      const response = await getPatientRecycleBin({ page, pageSize: recycleBinMeta.pageSize });
      setRecycleBinPatients(response.items || []);
      setRecycleBinMeta((current) => ({ ...current, ...(response.meta || {}), page }));
    } catch (apiError) {
      setError(apiError.message || "Unable to load the patient recycle bin.");
    } finally {
      setRecycleBinLoading(false);
    }
  };

  const handleRestorePatient = async (patient) => {
    if (!canDeletePatients || !window.confirm(`Restore ${patient.fullName || patient.firstName} to the active patient registry?`)) return;
    setRestoringPatientId(patient.id);
    setError("");
    try {
      const response = await restorePatient(patient.id);
      setRecycleBinPatients((current) => current.filter((entry) => entry.id !== patient.id));
      setPatients((current) => [response.item, ...current.filter((entry) => entry.id !== response.item.id)]);
      setRecycleBinMeta((current) => ({ ...current, total: Math.max(0, current.total - 1), totalPages: Math.max(1, Math.ceil(Math.max(0, current.total - 1) / current.pageSize)) }));
      setPagination((current) => ({ ...current, total: current.total + 1, totalPages: Math.max(1, Math.ceil((current.total + 1) / current.pageSize)) }));
      setSuccess(response.message || "Patient restored successfully.");
    } catch (apiError) {
      setError(apiError.message || "Unable to restore patient.");
    } finally {
      setRestoringPatientId("");
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
            <div className="stat-note">New registrations on this page</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Sagar Base</div>
            <div className="stat-value">{stats.fromSagar}</div>
            <div className="stat-note">Primary city count on this page</div>
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
            <div className="action-row">
              {canDeletePatients ? <Button type="button" variant="secondary" onClick={() => openRecycleBin(1)}>Recycle Bin</Button> : null}
              <Button type="button" onClick={handleOpenForm} disabled={!canRegisterPatient}>Add Patient</Button>
            </div>
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

          <div className="patients-filter-bar">
            <div className="field">
              <label htmlFor="filter-patient-type">Patient type</label>
              <select
                id="filter-patient-type"
                name="patientType"
                value={filters.patientType}
                onChange={handleFilterChange}
              >
                <option value="all">All types</option>
                <option value="new">New</option>
                <option value="follow_up">Follow-up</option>
                <option value="old">Old</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-gender">Gender</label>
              <select id="filter-gender" name="gender" value={filters.gender} onChange={handleFilterChange}>
                <option value="all">All genders</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-city">City / District</label>
              <select id="filter-city" name="city" value={filters.city} onChange={handleFilterChange}>
                <option value="all">All cities</option>
                {cityOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-from-date">Registered from</label>
              <input
                id="filter-from-date"
                name="fromDate"
                type="date"
                value={filters.fromDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="field">
              <label htmlFor="filter-to-date">Registered to</label>
              <input
                id="filter-to-date"
                name="toDate"
                type="date"
                value={filters.toDate}
                onChange={handleFilterChange}
              />
            </div>
            <div className="field">
              <label htmlFor="registry-sort">Sort by</label>
              <select id="registry-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="patients-filter-summary">
            <span>
              Showing {visiblePatients.length} on page {pagination.page} of {pagination.total} patients
              {activeFilterCount ? ` (${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} applied)` : ""}
              {activeFilterCount ? " · filters apply to this page" : ""}
            </span>
            <button
              className="table-link button-link"
              type="button"
              onClick={handleResetFilters}
              disabled={!activeFilterCount && sort === "newest"}
            >
              Reset filters
            </button>
          </div>

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
                    <th></th>
                    {canDeletePatients ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.uhid}</td>
                      <td>{patient.registrationNumber || patient.ppin || "Not assigned"}</td>
                      <td>{patient.title ? `${patient.title} ` : ""}{patient.firstName} {patient.lastName}</td>
                      <td>{patientTypeLabels[patient.patientType] || patient.patientType || "New"}</td>
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
                            {deletingPatientId === patient.id ? "Archiving..." : "Soft delete"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>

              {!visiblePatients.length ? (
                <div className="empty-state">
                  {patients.length
                    ? "No patients match the selected filters."
                    : "No patients found for the current search."}
                </div>
              ) : null}
              {pagination.totalPages > 1 ? (
                <div className="action-row">
                  <Button type="button" variant="secondary" disabled={pagination.page <= 1} onClick={() => loadPatients(search, pagination.page - 1)}>Previous</Button>
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <Button type="button" variant="secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => loadPatients(search, pagination.page + 1)}>Next</Button>
                </div>
              ) : null}
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

      {isRecycleBinOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsRecycleBinOpen(false)}>
          <section className="content-card patient-form-modal" role="dialog" aria-modal="true" aria-labelledby="recycle-bin-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="section-header patient-form-modal-header">
              <div><div className="eyebrow">Recovery</div><h3 id="recycle-bin-title">Patient recycle bin</h3></div>
              <button className="modal-close-button" type="button" onClick={() => setIsRecycleBinOpen(false)}>x</button>
            </div>
            <div className="empty-state patients-registration-note">Archived patients are hidden from active workflows, while their clinical records remain preserved. No permanent-delete action is available.</div>
            {recycleBinLoading ? <div className="empty-state">Loading recycle bin...</div> : (
              <div className="table-shell patients-table-shell">
                <table className="data-table">
                  <thead><tr><th>UHID</th><th>Patient</th><th>Archived</th><th>By</th><th>Reason</th><th></th></tr></thead>
                  <tbody>{recycleBinPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.uhid}</td><td>{patient.fullName || `${patient.firstName} ${patient.lastName}`}</td>
                      <td>{patient.deletedAt ? new Date(patient.deletedAt).toLocaleString() : "-"}</td><td>{patient.deletedByName || "System"}</td><td>{patient.deletionReason || "Not recorded"}</td>
                      <td><Button type="button" variant="secondary" onClick={() => handleRestorePatient(patient)} disabled={restoringPatientId === patient.id}>{restoringPatientId === patient.id ? "Restoring..." : "Restore"}</Button></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!recycleBinPatients.length ? <div className="empty-state">Recycle bin is empty.</div> : null}
                {recycleBinMeta.totalPages > 1 ? (
                  <div className="action-row">
                    <Button type="button" variant="secondary" disabled={recycleBinLoading || recycleBinMeta.page <= 1} onClick={() => openRecycleBin(recycleBinMeta.page - 1)}>Previous</Button>
                    <span>Page {recycleBinMeta.page} of {recycleBinMeta.totalPages} · {recycleBinMeta.total} archived patients</span>
                    <Button type="button" variant="secondary" disabled={recycleBinLoading || recycleBinMeta.page >= recycleBinMeta.totalPages} onClick={() => openRecycleBin(recycleBinMeta.page + 1)}>Next</Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
