import { useEffect, useMemo, useState } from "react";

import certificateDivider from "../../assets/certificates/certificate-divider.png";
import certificateHeader from "../../assets/certificates/certificate-header.png";
import certificateLogo from "../../assets/certificates/shanti-ratnam-logo-full.png";
import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  createCertificate,
  getCertificates,
  getDoctors,
  getPatients,
} from "../../services/api.js";

const certificateTypes = [
  { value: "fitness", label: "Medical Fitness Certificate" },
  { value: "sick_leave", label: "Sick Leave Certificate" },
  { value: "insurance", label: "Medical Certificate for Insurance" }
];

const initialForm = {
  certificateType: "fitness",
  patientId: "",
  patientName: "",
  patientFirstName: "",
  patientLastName: "",
  patientAge: "",
  patientGender: "",
  patientMobile: "",
  patientAddress: "",
  createPatient: false,
  doctorId: "",
  doctorName: "",
  doctorRegistrationNumber: "",
  certificateDate: new Date().toISOString().slice(0, 10),
  diagnosis: "",
  activity: "",
  fitDate: "",
  leaveFromDate: "",
  leaveToDate: "",
  totalLeaveDays: "",
  admissionDate: "",
  dischargeDate: "",
  treatment: "",
  notes: ""
};

function typeLabel(type) {
  return certificateTypes.find((item) => item.value === type)?.label || "Medical Certificate";
}

function dateLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

function patientAgeGender(certificate) {
  const parts = [];
  if (certificate.patientAge) parts.push(`${certificate.patientAge} years`);
  if (certificate.patientGender) parts.push(certificate.patientGender);
  return parts.join(" / ") || "-";
}

function checkMark(isSelected) {
  return isSelected ? "[x]" : "[ ]";
}

function patientDisplayName(patient) {
  return patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
}

function CertificatePreview({ certificate }) {
  if (!certificate) {
    return (
      <div className="certificate-print-sheet certificate-empty-preview">
        <img className="certificate-letterhead" src={certificateHeader} alt="" />
        <img className="certificate-divider" src={certificateDivider} alt="" />
        <div className="empty-state">Save a certificate to preview and print the final patient copy.</div>
      </div>
    );
  }

  return (
    <div className="certificate-print-sheet">
      <div className="certificate-letterhead-row">
        <img className="certificate-logo" src={certificateLogo} alt="" />
        <img className="certificate-letterhead" src={certificateHeader} alt="Shanti Ratnam Ayush Institute of Indian Medical Sciences" />
      </div>
      <img className="certificate-divider" src={certificateDivider} alt="" />

      <h1>{typeLabel(certificate.certificateType).toUpperCase()}</h1>

      <div className="certificate-meta-grid">
        <div><strong>Patient Name:</strong> {certificate.patientName}</div>
        <div><strong>Age/Gender:</strong> {patientAgeGender(certificate)}</div>
        <div><strong>UHID:</strong> {certificate.uhid || "-"}</div>
        <div><strong>Date:</strong> {dateLabel(certificate.certificateDate)}</div>
      </div>

      {certificate.certificateType === "fitness" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that I have examined <strong>{certificate.patientName}</strong> and found them medically fit for:</p>
          <div className="certificate-check-grid">
            <span className={certificate.activity === "Work / Duty" ? "selected" : ""}>{checkMark(certificate.activity === "Work / Duty")} Work / Duty</span>
            <span className={certificate.activity === "School / Physical Activity" ? "selected" : ""}>{checkMark(certificate.activity === "School / Physical Activity")} School / Physical Activity</span>
            <span>{checkMark(certificate.activity && !["Work / Duty", "School / Physical Activity"].includes(certificate.activity))} Other: {certificate.activity && !["Work / Duty", "School / Physical Activity"].includes(certificate.activity) ? certificate.activity : ""}</span>
          </div>
          <p>The patient is fit to resume activities from <strong>{dateLabel(certificate.fitDate)}</strong>.</p>
        </div>
      ) : null}

      {certificate.certificateType === "sick_leave" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> is suffering from <strong>{certificate.diagnosis}</strong> and requires medical rest.</p>
          <p>The patient is advised rest from <strong>{dateLabel(certificate.leaveFromDate)}</strong> to <strong>{dateLabel(certificate.leaveToDate)}</strong>.</p>
          <p>Total leave recommended: <strong>{certificate.totalLeaveDays || "-"} days</strong>.</p>
        </div>
      ) : null}

      {certificate.certificateType === "insurance" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> was admitted under our care.</p>
          <p><strong>Admission Date:</strong> {dateLabel(certificate.admissionDate)}</p>
          <p><strong>Discharge Date:</strong> {dateLabel(certificate.dischargeDate)}</p>
          <p><strong>Diagnosis:</strong> {certificate.diagnosis}</p>
          <p><strong>Treatment Given:</strong> {certificate.treatment}</p>
          <p>This certificate is issued for insurance/claim purposes.</p>
        </div>
      ) : null}

      <div className="certificate-signature-block">
        <div>
          <p>Sincerely,</p>
          <strong>Digital Signature</strong>
          <p>Dr. {certificate.doctorName.replace(/^dr\.?\s*/i, "")}, BAMS / BNYS</p>
          <p>Reg. No: {certificate.doctorRegistrationNumber || "-"}</p>
        </div>
        <div className="certificate-qr-placeholder">Website QR Code</div>
      </div>

      <div className="certificate-verification">
        <p><strong>Medical Registration Number:</strong> {certificate.doctorRegistrationNumber || "-"}</p>
        <p><strong>Verified by:</strong> Shanti Ratnam Ayush Hospital</p>
        <p>This is a computer-generated document and does not require a physical signature.</p>
        <p><strong>Certificate No:</strong> {certificate.certificateNumber}</p>
      </div>
    </div>
  );
}

export function CertificatesPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = ["admin", "doctor"].includes(user?.role);

  async function loadData() {
    const [patientResponse, doctorResponse, certificateResponse] = await Promise.all([
      getPatients(""),
      getDoctors(),
      getCertificates()
    ]);

    setPatients(patientResponse.items || []);
    setDoctors(doctorResponse.items || []);
    setCertificates(certificateResponse.items || []);
    setSelectedCertificate((current) => current || certificateResponse.items?.[0] || null);
  }

  useEffect(() => {
    loadData().catch((apiError) => setError(apiError.message || "Unable to load certificates."));
  }, []);

  useEffect(() => {
    if (user?.role === "doctor" && user?.id && !form.doctorId) {
      setForm((current) => ({ ...current, doctorId: user.id, doctorName: user.fullName || current.doctorName }));
    }
  }, [form.doctorId, user]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === form.patientId),
    [form.patientId, patients]
  );

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handlePatientSelect = (patientId, patient) => {
    setForm((current) => ({
      ...current,
      patientId,
      createPatient: false,
      patientName: patient ? patientDisplayName(patient) : "",
      patientAge: patient?.ageYears || "",
      patientGender: patient?.gender || "",
      patientMobile: patient?.phone || "",
      patientAddress: patient?.address || ""
    }));
  };

  const handlePatientNameChange = (value) => {
    setForm((current) => ({
      ...current,
      patientName: value,
      patientFirstName: value
    }));
  };

  const handleDoctorSelect = (doctorId, doctor) => {
    setForm((current) => ({
      ...current,
      doctorId,
      doctorName: doctor?.fullName || "",
      doctorRegistrationNumber: doctor?.metadata?.registrationNumber || doctor?.metadata?.regNo || current.doctorRegistrationNumber
    }));
  };

  const saveCertificate = async (event) => {
    event.preventDefault();

    if (!canCreate) {
      setError("Only doctors and admin can issue medical certificates.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await createCertificate({
        ...form,
        createPatient: form.createPatient && !form.patientId
      });
      setMessage(response.message || "Medical certificate saved.");
      setSelectedCertificate(response.item);
      setCertificates((current) => [response.item, ...current.filter((item) => item.id !== response.item.id)]);
      setForm({ ...initialForm, doctorId: form.doctorId, doctorRegistrationNumber: form.doctorRegistrationNumber });
      await loadData();
    } catch (apiError) {
      setError(apiError.message || "Unable to save certificate.");
    } finally {
      setSaving(false);
    }
  };

  const printCertificate = () => {
    if (!selectedCertificate) {
      setError("Save or select a certificate before printing.");
      return;
    }

    const cleanup = () => {
      document.body.classList.remove("print-medical-certificate");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("print-medical-certificate");
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 0);
  };

  return (
    <DashboardLayout>
      <section className="hero-panel certificates-hero">
        <div>
          <div className="eyebrow">Medical Certificates</div>
          <h2>Issue printable patient certificates</h2>
          <p className="page-copy">Create fitness, sick leave, and insurance certificates with the Shanti Ratnam letterhead and save them against the patient record.</p>
        </div>
      </section>

      {message ? <div className="success-text">{message}</div> : null}
      {error ? <div className="error-text">{error}</div> : null}

      <section className="certificates-layout">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Form</div>
              <h3>Certificate details</h3>
            </div>
            <Button type="button" variant="secondary" onClick={printCertificate} disabled={!selectedCertificate}>
              Print
            </Button>
          </div>

          <form className="form-grid" onSubmit={saveCertificate}>
            <div className="field">
              <label>Certificate type</label>
              <select name="certificateType" value={form.certificateType} onChange={handleChange}>
                {certificateTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Certificate date</label>
              <input type="date" name="certificateDate" value={form.certificateDate} onChange={handleChange} />
            </div>

            <div className="field field-span-2">
              <label>Existing patient</label>
              <SearchableSelect
                value={form.patientId}
                customValue={form.patientName}
                options={patients}
                onChange={handlePatientSelect}
                onCustomValueChange={handlePatientNameChange}
                placeholder="Search UHID, name, or mobile"
                getOptionLabel={patientDisplayName}
                getOptionMeta={(patient) => `${patient.uhid} - ${patient.phone || "No mobile"} - ${patient.ageYears || "-"} / ${patient.gender || "-"}`}
                getSearchText={(patient) => `${patient.uhid} ${patient.registrationNumber || ""} ${patientDisplayName(patient)} ${patient.phone || ""}`}
                emptyLabel="No matching patient"
              />
            </div>

            {!form.patientId ? (
              <>
                <label className="checkbox-chip field-span-2">
                  <input type="checkbox" name="createPatient" checked={form.createPatient} onChange={handleChange} />
                  <span>Register this as a new patient record while saving</span>
                </label>
                <div className="field">
                  <label>Patient name</label>
                  <input name="patientName" value={form.patientName} onChange={handleChange} required={!form.patientId} />
                </div>
                <div className="field">
                  <label>Mobile no.</label>
                  <input name="patientMobile" value={form.patientMobile} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Age</label>
                  <input type="number" name="patientAge" min="0" max="130" value={form.patientAge} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select name="patientGender" value={form.patientGender} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field field-span-2">
                  <label>Address for new patient</label>
                  <input name="patientAddress" value={form.patientAddress} onChange={handleChange} />
                </div>
              </>
            ) : (
              <div className="empty-state field-span-2">
                Selected patient: {patientDisplayName(selectedPatient || {})} - UHID {selectedPatient?.uhid || "-"}
              </div>
            )}

            <div className="field">
              <label>Doctor</label>
              <SearchableSelect
                value={form.doctorId}
                customValue={form.doctorName}
                options={doctors}
                onChange={handleDoctorSelect}
                onCustomValueChange={(value) => setForm((current) => ({ ...current, doctorName: value }))}
                placeholder="Select doctor"
                getOptionLabel={(doctor) => doctor.fullName}
                getOptionMeta={(doctor) => doctor.department || doctor.designation || "Doctor"}
              />
            </div>
            <div className="field">
              <label>Doctor registration no.</label>
              <input name="doctorRegistrationNumber" value={form.doctorRegistrationNumber} onChange={handleChange} />
            </div>

            {form.certificateType === "fitness" ? (
              <>
                <div className="field">
                  <label>Fit for</label>
                  <input name="activity" list="certificate-activity-options" value={form.activity} onChange={handleChange} placeholder="Work / Duty, school, activity name" />
                  <datalist id="certificate-activity-options">
                    <option value="Work / Duty" />
                    <option value="School / Physical Activity" />
                  </datalist>
                </div>
                <div className="field">
                  <label>Fit from date</label>
                  <input type="date" name="fitDate" value={form.fitDate} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {form.certificateType === "sick_leave" ? (
              <>
                <div className="field field-span-2">
                  <label>Diagnosis / reason</label>
                  <textarea name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Rest from</label>
                  <input type="date" name="leaveFromDate" value={form.leaveFromDate} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Rest to</label>
                  <input type="date" name="leaveToDate" value={form.leaveToDate} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Total leave days</label>
                  <input type="number" name="totalLeaveDays" min="1" value={form.totalLeaveDays} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {form.certificateType === "insurance" ? (
              <>
                <div className="field">
                  <label>Admission date</label>
                  <input type="date" name="admissionDate" value={form.admissionDate} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Discharge date</label>
                  <input type="date" name="dischargeDate" value={form.dischargeDate} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Diagnosis</label>
                  <textarea name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Treatment given</label>
                  <textarea name="treatment" value={form.treatment} onChange={handleChange} />
                </div>
              </>
            ) : null}

            <div className="field field-span-2">
              <label>Internal notes</label>
              <input name="notes" value={form.notes} onChange={handleChange} />
            </div>

            <div className="field-span-2 action-row">
              <Button type="submit" disabled={saving || !canCreate}>
                {saving ? "Saving..." : "Save Certificate"}
              </Button>
              {!canCreate ? <span className="muted-text">Only doctor and admin users can issue certificates.</span> : null}
            </div>
          </form>
        </article>

        <article className="content-card certificate-preview-card">
          <div className="section-header no-print">
            <div>
              <div className="eyebrow">Preview</div>
              <h3>{selectedCertificate ? selectedCertificate.certificateNumber : "Patient copy"}</h3>
            </div>
          </div>
          <CertificatePreview certificate={selectedCertificate} />
        </article>
      </section>

      <section className="content-card certificates-history-card no-print">
        <div className="section-header">
          <div>
            <div className="eyebrow">Records</div>
            <h3>Issued certificates</h3>
          </div>
        </div>
        {certificates.length ? (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Certificate</th>
                  <th>Type</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Doctor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <td>{certificate.certificateNumber}</td>
                    <td>{typeLabel(certificate.certificateType)}</td>
                    <td>{certificate.patientName}<br /><span className="muted-text">{certificate.uhid || certificate.patientMobile || "-"}</span></td>
                    <td>{certificate.certificateDate}</td>
                    <td>{certificate.doctorName}</td>
                    <td>
                      <button className="button-link" type="button" onClick={() => setSelectedCertificate(certificate)}>
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No medical certificates have been issued yet.</div>
        )}
      </section>
    </DashboardLayout>
  );
}
