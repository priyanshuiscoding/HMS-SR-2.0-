import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  deletePatientDocument,
  downloadPatientDocument,
  getPatientHistory,
  updatePatient,
  uploadPatientDocument
} from "../../services/api.js";

const documentInitialForm = {
  title: "",
  documentType: "old_prescription",
  notes: "",
  file: null
};

const patientEditInitialForm = {
  patientType: "new",
  title: "",
  firstName: "",
  lastName: "",
  fatherName: "",
  dateOfBirth: "",
  ageYears: "",
  gender: "",
  bloodGroup: "",
  maritalStatus: "",
  occupation: "",
  phone: "",
  altPhone: "",
  email: "",
  houseStreet: "",
  areaVillage: "",
  cityDistrict: "",
  state: "",
  pincode: "",
  idType: "",
  idNumber: "",
  opdIpdNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  referredBy: ""
};

function toPatientEditForm(patient = {}) {
  return {
    patientType: patient.patientType || "new",
    title: patient.title || "",
    firstName: patient.firstName || "",
    lastName: patient.lastName || "",
    fatherName: patient.fatherName || "",
    dateOfBirth: patient.dateOfBirth || "",
    ageYears: patient.ageYears || "",
    gender: patient.gender || "",
    bloodGroup: patient.bloodGroup || "",
    maritalStatus: patient.maritalStatus || "",
    occupation: patient.occupation || "",
    phone: patient.phone || "",
    altPhone: patient.altPhone || "",
    email: patient.email || "",
    houseStreet: patient.houseStreet || "",
    areaVillage: patient.areaVillage || "",
    cityDistrict: patient.cityDistrict || patient.city || "",
    state: patient.state || "",
    pincode: patient.pincode || "",
    idType: patient.idType || "",
    idNumber: patient.idNumber || "",
    opdIpdNumber: patient.opdIpdNumber || "",
    emergencyContactName: patient.emergencyContactName || "",
    emergencyContactPhone: patient.emergencyContactPhone || "",
    referredBy: patient.referredBy || ""
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(new Error("Unable to read selected PDF."));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size) {
  if (!size) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeLabel(time) {
  const [hourValue, minuteValue] = String(time || "").split(":").map(Number);

  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return time || "";
  }

  const hour = hourValue % 12 || 12;
  const period = hourValue >= 12 ? "PM" : "AM";
  return `${hour}:${String(minuteValue).padStart(2, "0")} ${period}`;
}

export function PatientProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [documentForm, setDocumentForm] = useState(documentInitialForm);
  const [documentStatus, setDocumentStatus] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [patientEditForm, setPatientEditForm] = useState(patientEditInitialForm);
  const [patientEditStatus, setPatientEditStatus] = useState("");
  const [patientEditError, setPatientEditError] = useState("");
  const [savingPatient, setSavingPatient] = useState(false);

  const canUploadDocuments = ["admin", "reception", "doctor"].includes(user?.role);
  const canDeleteDocuments = ["admin", "reception"].includes(user?.role);
  const canEditPatient = ["admin", "reception"].includes(user?.role);

  async function loadPatientProfile() {
    try {
      const response = await getPatientHistory(id);
      setPayload(response);
      setPatientEditForm(toPatientEditForm(response.patient));
    } catch (apiError) {
      setError(apiError.message || "Unable to load patient profile.");
    }
  }

  useEffect(() => {
    loadPatientProfile();
  }, [id]);

  const patient = payload?.patient;

  const handlePatientEditInputChange = (event) => {
    const { name, value } = event.target;
    setPatientEditForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handlePatientEditCancel = () => {
    setPatientEditForm(toPatientEditForm(patient));
    setIsEditingPatient(false);
    setPatientEditError("");
    setPatientEditStatus("");
  };

  const handlePatientEditSubmit = async (event) => {
    event.preventDefault();

    if (!canEditPatient) {
      setPatientEditError("Only admin and reception users can edit patient details.");
      return;
    }

    setSavingPatient(true);
    setPatientEditError("");
    setPatientEditStatus("");

    try {
      const response = await updatePatient(id, patientEditForm);
      setPatientEditStatus(response.message || "Patient details updated successfully.");
      setPayload((current) => current ? { ...current, patient: response.item } : current);
      setPatientEditForm(toPatientEditForm(response.item));
      setIsEditingPatient(false);
      await loadPatientProfile();
    } catch (apiError) {
      setPatientEditError(apiError.message || "Unable to update patient details.");
    } finally {
      setSavingPatient(false);
    }
  };

  const handleDocumentInputChange = (event) => {
    const { name, value, files } = event.target;
    setDocumentForm((current) => ({
      ...current,
      [name]: files ? files[0] : value
    }));
  };

  const handleDocumentUpload = async (event) => {
    event.preventDefault();

    if (!canUploadDocuments) {
      setDocumentError("You do not have permission to upload patient documents.");
      return;
    }

    if (!documentForm.file) {
      setDocumentError("Select a PDF document to upload.");
      return;
    }

    setUploadingDocument(true);
    setDocumentError("");
    setDocumentStatus("");

    try {
      const fileBase64 = await fileToBase64(documentForm.file);
      const response = await uploadPatientDocument(id, {
        title: documentForm.title || documentForm.file.name.replace(/\.pdf$/i, ""),
        documentType: documentForm.documentType,
        notes: documentForm.notes,
        fileName: documentForm.file.name,
        mimeType: documentForm.file.type || "application/pdf",
        fileBase64
      });

      setDocumentStatus(response.message);
      setDocumentForm(documentInitialForm);
      event.target.reset();
      await loadPatientProfile();
    } catch (apiError) {
      setDocumentError(apiError.message || "Unable to upload patient document.");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDocumentDownload = async (document) => {
    setDocumentError("");

    try {
      const blob = await downloadPatientDocument(id, document.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (apiError) {
      setDocumentError(apiError.message || "Unable to open patient document.");
    }
  };

  const handleDocumentDelete = async (documentId) => {
    if (!canDeleteDocuments) {
      setDocumentError("Only admin and reception users can remove uploaded documents.");
      return;
    }

    setDocumentError("");
    setDocumentStatus("");

    try {
      const response = await deletePatientDocument(id, documentId);
      setDocumentStatus(response.message);
      await loadPatientProfile();
    } catch (apiError) {
      setDocumentError(apiError.message || "Unable to remove patient document.");
    }
  };

  return (
    <DashboardLayout>
      {!payload && !error ? <div className="empty-state">Loading patient profile...</div> : null}
      {error ? <div className="error-text">{error}</div> : null}

      {patient ? (
        <>
          <section className="profile-banner">
            <div>
              <div className="eyebrow">Patient Profile</div>
              <h2>{patient.title ? `${patient.title} ` : ""}{patient.firstName} {patient.lastName}</h2>
              <p>
                UHID {patient.uhid} - Reg. No. / PPIN {patient.registrationNumber || patient.ppin || "Not assigned"} - {patient.patientType || "new"} - Registered on {patient.registrationDate}
                {patient.registrationTime ? ` at ${patient.registrationTime}` : ""}
              </p>
            </div>
            <div className="action-row">
              {canEditPatient ? (
                <button className="inline-link button-link" type="button" onClick={() => setIsEditingPatient(true)}>
                  Edit details
                </button>
              ) : null}
              <Link className="inline-link" to="/patients">
                Back to registry
              </Link>
            </div>
          </section>

          {patientEditStatus ? <div className="success-text">{patientEditStatus}</div> : null}

          {isEditingPatient ? (
            <section className="content-card">
              <div className="section-header">
                <div>
                  <div className="eyebrow">Edit</div>
                  <h3>Patient details</h3>
                </div>
              </div>

              <form className="form-grid" onSubmit={handlePatientEditSubmit}>
                <div className="field">
                  <label>Patient type</label>
                  <select name="patientType" value={patientEditForm.patientType} onChange={handlePatientEditInputChange}>
                    <option value="new">New</option>
                    <option value="follow_up">Follow-up</option>
                  </select>
                </div>
                <div className="field">
                  <label>OPD / IPD No.</label>
                  <input name="opdIpdNumber" value={patientEditForm.opdIpdNumber} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Title</label>
                  <select name="title" value={patientEditForm.title} onChange={handlePatientEditInputChange}>
                    <option value="">Select</option>
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Master">Master</option>
                  </select>
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select name="gender" value={patientEditForm.gender} onChange={handlePatientEditInputChange}>
                    <option value="">Not recorded</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>First name</label>
                  <input name="firstName" value={patientEditForm.firstName} onChange={handlePatientEditInputChange} required />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input name="lastName" value={patientEditForm.lastName} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field field-span-2">
                  <label>Father's name</label>
                  <input name="fatherName" value={patientEditForm.fatherName} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Date of birth</label>
                  <input name="dateOfBirth" type="date" value={patientEditForm.dateOfBirth} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Age</label>
                  <input name="ageYears" type="number" min="0" max="130" value={patientEditForm.ageYears} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Blood group</label>
                  <input name="bloodGroup" value={patientEditForm.bloodGroup} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Marital status</label>
                  <select name="maritalStatus" value={patientEditForm.maritalStatus} onChange={handlePatientEditInputChange}>
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>
                <div className="field field-span-2">
                  <label>Occupation</label>
                  <input name="occupation" value={patientEditForm.occupation} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Mobile no.</label>
                  <input name="phone" value={patientEditForm.phone} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Alternate mobile no.</label>
                  <input name="altPhone" value={patientEditForm.altPhone} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field field-span-2">
                  <label>Email ID</label>
                  <input name="email" type="email" value={patientEditForm.email} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field field-span-2">
                  <label>House / Street</label>
                  <input name="houseStreet" value={patientEditForm.houseStreet} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field field-span-2">
                  <label>Area / Village</label>
                  <input name="areaVillage" value={patientEditForm.areaVillage} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>City / District</label>
                  <input name="cityDistrict" value={patientEditForm.cityDistrict} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>State</label>
                  <input name="state" value={patientEditForm.state} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>PIN code</label>
                  <input name="pincode" value={patientEditForm.pincode} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Referred by</label>
                  <input name="referredBy" value={patientEditForm.referredBy} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>ID type</label>
                  <select name="idType" value={patientEditForm.idType} onChange={handlePatientEditInputChange}>
                    <option value="">Optional</option>
                    <option value="aadhaar">Aadhaar</option>
                    <option value="voter_id">Voter ID</option>
                    <option value="pan">PAN</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>ID number</label>
                  <input name="idNumber" value={patientEditForm.idNumber} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Emergency contact</label>
                  <input name="emergencyContactName" value={patientEditForm.emergencyContactName} onChange={handlePatientEditInputChange} />
                </div>
                <div className="field">
                  <label>Emergency phone</label>
                  <input name="emergencyContactPhone" value={patientEditForm.emergencyContactPhone} onChange={handlePatientEditInputChange} />
                </div>

                {patientEditError ? <div className="error-text field-span-2">{patientEditError}</div> : null}

                <div className="field-span-2 action-row">
                  <Button type="submit" disabled={savingPatient}>
                    {savingPatient ? "Saving..." : "Save Patient Details"}
                  </Button>
                  <button className="secondary-button" type="button" onClick={handlePatientEditCancel} disabled={savingPatient}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="detail-grid">
            <article className="content-card">
              <h3>Registration and demographics</h3>
              <div className="detail-list">
                <div><strong>UHID:</strong> {patient.uhid}</div>
                <div><strong>Reg No. / PPIN:</strong> {patient.registrationNumber || patient.ppin || "Not assigned"}</div>
                <div><strong>OPD / IPD No.:</strong> {patient.opdIpdNumber || "Not assigned"}</div>
                <div><strong>Father's name:</strong> {patient.fatherName || "Not recorded"}</div>
                <div><strong>Gender:</strong> {patient.gender}</div>
                <div><strong>Date of birth:</strong> {patient.dateOfBirth}</div>
                <div><strong>Age:</strong> {patient.ageYears || "Not recorded"} years</div>
                <div><strong>Blood group:</strong> {patient.bloodGroup || "Not recorded"}</div>
                <div><strong>Marital status:</strong> {patient.maritalStatus || "Not recorded"}</div>
                <div><strong>Occupation:</strong> {patient.occupation || "Not recorded"}</div>
              </div>
            </article>

            <article className="content-card">
              <h3>Contact and identity</h3>
              <div className="detail-list">
                <div><strong>Mobile:</strong> {patient.phone}</div>
                <div><strong>Alternate mobile:</strong> {patient.altPhone || "Not provided"}</div>
                <div><strong>Email:</strong> {patient.email || "Not provided"}</div>
                <div><strong>House / Street:</strong> {patient.houseStreet || patient.address || "Not provided"}</div>
                <div><strong>Area / Village:</strong> {patient.areaVillage || "Not provided"}</div>
                <div><strong>City / District:</strong> {patient.cityDistrict || patient.city || "Not provided"}</div>
                <div><strong>State / PIN:</strong> {patient.state || "Not provided"}{patient.pincode ? ` - ${patient.pincode}` : ""}</div>
                <div><strong>ID Proof:</strong> {patient.idType ? `${patient.idType} - ${patient.idNumber || "number not recorded"}` : "Not provided"}</div>
              </div>
            </article>
          </section>

          <section className="detail-grid">
            <article className="content-card">
              <h3>Emergency and referral</h3>
              <div className="detail-list">
                <div><strong>Emergency contact:</strong> {patient.emergencyContactName || "Not provided"}</div>
                <div><strong>Emergency phone:</strong> {patient.emergencyContactPhone || "Not provided"}</div>
                <div><strong>Referred by:</strong> {patient.referredBy || "Not captured"}</div>
                <div><strong>Saved address:</strong> {patient.address || "Not recorded"}</div>
              </div>
            </article>

            <article className="content-card">
              <h3>Registration summary</h3>
              <div className="detail-list">
                <div><strong>Patient type:</strong> {patient.patientType || "new"}</div>
                <div><strong>Registration date:</strong> {patient.registrationDate}</div>
                <div><strong>Registration time:</strong> {patient.registrationTime || "Auto-generated"}</div>
                <div><strong>Created by user:</strong> {patient.createdBy || "System"}</div>
              </div>
            </article>
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Documents</div>
                <h3>Old records and additional PDFs</h3>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleDocumentUpload}>
              <div className="field">
                <label>Document title</label>
                <input name="title" value={documentForm.title} onChange={handleDocumentInputChange} placeholder="Old prescription, lab report, discharge summary" />
              </div>
              <div className="field">
                <label>Document type</label>
                <select name="documentType" value={documentForm.documentType} onChange={handleDocumentInputChange}>
                  <option value="old_prescription">Old prescription</option>
                  <option value="old_lab_report">Old lab report</option>
                  <option value="old_discharge_summary">Old discharge summary</option>
                  <option value="old_case_sheet">Old case sheet</option>
                  <option value="additional_detail">Additional detail</option>
                </select>
              </div>
              <div className="field">
                <label>PDF file</label>
                <input name="file" type="file" accept="application/pdf,.pdf" onChange={handleDocumentInputChange} />
              </div>
              <div className="field">
                <label>Notes</label>
                <input name="notes" value={documentForm.notes} onChange={handleDocumentInputChange} placeholder="Optional context for doctors or reception" />
              </div>

              {documentError ? <div className="error-text field-span-2">{documentError}</div> : null}
              {documentStatus ? <div className="success-text field-span-2">{documentStatus}</div> : null}

              <div className="field-span-2 action-row">
                <Button type="submit" disabled={uploadingDocument || !canUploadDocuments}>
                  {uploadingDocument ? "Uploading..." : "Upload PDF"}
                </Button>
              </div>
              {!canUploadDocuments ? (
                <div className="empty-state field-span-2">Document upload is available to admin, reception, and doctor roles.</div>
              ) : null}
            </form>

            {payload.documents?.length ? (
              <div className="stack-list">
                {payload.documents.map((document) => (
                  <div key={document.id} className="quick-action document-row">
                    <div>
                      <strong>{document.title}</strong>
                      <div className="timeline-copy">
                        {document.documentType.replaceAll("_", " ")} - {document.fileName} - {formatFileSize(document.fileSize)}
                      </div>
                      <div className="timeline-copy">{document.notes || "No notes added."}</div>
                    </div>
                    <div className="action-row">
                      <button className="button-link" type="button" onClick={() => handleDocumentDownload(document)}>
                        Open PDF
                      </button>
                      {canDeleteDocuments ? (
                        <button className="button-link danger-link" type="button" onClick={() => handleDocumentDelete(document.id)}>
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ marginTop: 16 }}>No old PDFs or additional patient documents have been uploaded yet.</div>
            )}
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Timeline</div>
                <h3>Unified patient timeline</h3>
              </div>
            </div>

            {payload.timeline.length ? (
              <div className="stack-list timeline-stack">
                {payload.timeline.map((item) => (
                  <div key={item.id} className={`timeline-block ${item.type}`}>
                    <div className="timeline-block-date">{item.date}</div>
                    <div>
                      <strong>{item.title}</strong>
                      <div className="timeline-copy">{item.summary}</div>
                      <div className="timeline-copy">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No timeline history has been recorded for this patient yet.</div>
            )}
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Certificates</div>
                <h3>Medical certificates</h3>
              </div>
              <Link className="inline-link" to="/certificates">
                Issue certificate
              </Link>
            </div>

            {payload.certificates?.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Certificate</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Doctor</th>
                      <th>Purpose / diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.certificates.map((certificate) => (
                      <tr key={certificate.id}>
                        <td>{certificate.certificateNumber}</td>
                        <td>{certificate.certificateType.replaceAll("_", " ")}</td>
                        <td>{certificate.certificateDate}</td>
                        <td>{certificate.doctorName}</td>
                        <td>{certificate.diagnosis || certificate.activity || certificate.treatment || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No medical certificates have been issued for this patient yet.</div>
            )}
          </section>

          <section className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Appointments</div>
                <h3>Appointment history</h3>
              </div>
            </div>

            {payload.appointments.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Appointment</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Complaint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.appointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>{appointment.appointmentNumber}</td>
                        <td>{appointment.appointmentDate}</td>
                        <td>{formatTimeLabel(appointment.appointmentTime)}</td>
                        <td>{appointment.department}</td>
                        <td><span className={`status-pill ${appointment.status}`}>{appointment.status}</span></td>
                        <td>{appointment.chiefComplaint || "General consultation"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No appointment history has been recorded for this patient yet.</div>
            )}
          </section>

          <section className="detail-grid">
            <article className="content-card">
              <h3>OPD vitals</h3>
              {payload.opdVisits.length ? (
                <div className="stack-list">
                  {payload.opdVisits.map((visit) => (
                    <div key={visit.id} className="quick-action">
                      <strong>{visit.opdNumber}</strong>
                      <div className="timeline-copy">{visit.visitDate} | {visit.status}</div>
                      <div className="timeline-copy">
                        BP: {visit.vitalsBp || "-"} | Pulse: {visit.vitalsPulse || "-"} | Temp: {visit.vitalsTemp || "-"} | SpO2: {visit.vitalsSpo2 || "-"}
                      </div>
                      <div className="timeline-copy">
                        Height: {visit.vitalsHeight || "-"} | Weight: {visit.vitalsWeight || "-"} | RR: {visit.vitalsRr || "-"}
                      </div>
                      {visit.metadata?.physicalExam ? <div className="timeline-copy">Exam: {visit.metadata.physicalExam}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No OPD vitals recorded yet.</div>
              )}
            </article>

            <article className="content-card">
              <h3>Prakriti observations</h3>
              {payload.assessments.length ? (
                <div className="stack-list">
                  {payload.assessments.map((assessment) => (
                    <div key={assessment.id} className="quick-action">
                      <strong>{assessment.assessmentDate}</strong>
                      <div className="timeline-copy">Dominant dosha: {assessment.prakritiDominant || "-"}</div>
                      <div className="timeline-copy">
                        Vata: {assessment.prakritiVata || "-"} | Pitta: {assessment.prakritiPitta || "-"} | Kapha: {assessment.prakritiKapha || "-"}
                      </div>
                      <div className="timeline-copy">Nadi: {assessment.nadiType || "-"} | Agni: {assessment.agniStatus || "-"} | Koshtha: {assessment.koshthaNature || "-"}</div>
                      {assessment.vikritiAssessment ? <div className="timeline-copy">Vikriti: {assessment.vikritiAssessment}</div> : null}
                      {assessment.observations ? <div className="timeline-copy">Observation: {assessment.observations}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No Prakriti observations recorded yet.</div>
              )}
            </article>
          </section>

          <section className="detail-grid">
            <article className="content-card">
              <h3>Prescriptions</h3>
              {payload.prescriptions.length ? (
                <div className="stack-list">
                  {payload.prescriptions.map((prescription) => (
                    <div key={prescription.id} className="quick-action">
                      <strong>{prescription.prescriptionNumber}</strong>
                      <div className="timeline-copy">{prescription.diagnosis}</div>
                      {prescription.medicines.map((item, index) => (
                        <div className="timeline-copy" key={item.id || `${prescription.id}-${index}`}>
                          {index + 1}. {item.medicineName || "Unnamed medicine"} | {item.dose || "-"} | {item.frequency || "-"} | {item.durationDays ? `${item.durationDays} days` : "-"}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No prescriptions recorded yet.</div>
              )}
            </article>

            <article className="content-card">
              <h3>IPD, Panchkarma, lab, billing, and pharmacy</h3>
              <div className="stack-list">
                {payload.ipdAdmissions.map((admission) => (
                  <div key={admission.id} className="quick-action">
                    <strong>{admission.admissionNumber}</strong>
                    <div className="timeline-copy">{admission.reasonForAdmission}</div>
                    <div className="timeline-copy">Status: {admission.status}</div>
                  </div>
                ))}
                {payload.panchkarmaSchedules.map((session) => (
                  <div key={session.id} className="quick-action">
                    <strong>{session.scheduleNumber}</strong>
                    <div className="timeline-copy">{session.therapyName}</div>
                    <div className="timeline-copy">Status: {session.status}</div>
                  </div>
                ))}
                {payload.labOrders.map((order) => (
                  <div key={order.id} className="quick-action">
                    <strong>{order.orderNumber}</strong>
                    <div className="timeline-copy">{order.tests.map((item) => item.testName).join(", ")}</div>
                    <div className="timeline-copy">Status: {order.status}</div>
                  </div>
                ))}
                {payload.bills.map((bill) => (
                  <div key={bill.id} className="quick-action">
                    <strong>{bill.billNumber}</strong>
                    <div className="timeline-copy">Total: Rs. {bill.totalAmount}</div>
                    <div className="timeline-copy">Payment: {bill.paymentStatus}</div>
                  </div>
                ))}
                {payload.dispensations.map((dispense) => (
                  <div key={dispense.id} className="quick-action">
                    <strong>{dispense.dispenseNumber}</strong>
                    <div className="timeline-copy">
                      {dispense.items.map((item) => `${item.medicineName} x${item.quantity}`).join(", ")}
                    </div>
                    <div className="timeline-copy">Dispensed: {dispense.dispensedDate}</div>
                  </div>
                ))}
                {payload.payments.map((payment) => (
                  <div key={payment.id} className="quick-action">
                    <strong>{payment.receiptNumber}</strong>
                    <div className="timeline-copy">Rs. {payment.amount} via {payment.paymentMode}</div>
                    <div className="timeline-copy">Received: {payment.paymentDate}</div>
                  </div>
                ))}
                {!payload.ipdAdmissions.length &&
                !payload.panchkarmaSchedules.length &&
                !payload.labOrders.length &&
                !payload.bills.length &&
                !payload.dispensations.length &&
                !payload.payments.length ? (
                  <div className="empty-state">No IPD, Panchkarma, lab, billing, pharmacy, or payment records recorded yet.</div>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </DashboardLayout>
  );
}
