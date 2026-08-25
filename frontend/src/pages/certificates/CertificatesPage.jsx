import { useEffect, useMemo, useState } from "react";

import certificateDivider from "../../assets/certificates/certificate-divider.png";
import certificateHeader from "../../assets/certificates/certificate-header.png";
import certificateLogo from "../../assets/certificates/shanti-ratnam-logo-full.png";
import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import {
  createCertificate,
  getCertificates,
  getDoctors,
  getPatients,
} from "../../services/api.js";

const certificateTypes = [
  { value: "fitness", label: "Medical Fitness Certificate", category: "clinical" },
  { value: "sick_leave", label: "Sick Leave Certificate", category: "clinical" },
  { value: "insurance", label: "Medical Certificate for Insurance", category: "clinical" },
  { value: "birth", label: "Birth Certificate", category: "patient" },
  { value: "death", label: "Death Certificate", category: "patient" },
  { value: "disability", label: "Disability Certificate", category: "patient" },
  { value: "treatment", label: "Treatment Certificate", category: "patient" },
  { value: "panchakarma", label: "Panchakarma Treatment Certificate", category: "patient" },
  { value: "medical_records", label: "Copy of Medical Records", category: "patient" },
  { value: "wound", label: "Wound Certificate", category: "medicolegal" },
  { value: "post_mortem", label: "Post Mortem Certificate", category: "medicolegal" },
  { value: "mlc", label: "Medico-Legal Case (MLC) Report", category: "medicolegal" },
  { value: "accident_wound", label: "Accident-cum-Wound Certificate", category: "medicolegal" }
];

const certificateCategories = [
  { value: "clinical", label: "Clinical Certificates" },
  { value: "patient", label: "Patient-Centric Certificates" },
  { value: "medicolegal", label: "Medico-Legal Certificates" }
];

const natureOfInjuryOptions = ["Simple", "Grievous", "Dangerous to life"];

const deliveryTypeOptions = ["Normal", "Assisted", "Caesarean (LSCS)"];

const disabilityStatusOptions = ["Permanent", "Temporary"];

const panchakarmaTherapyOptions = [
  "Vamana",
  "Virechana",
  "Basti (Niruha/Anuvasana)",
  "Nasya",
  "Raktamokshana",
  "Snehana",
  "Swedana"
];

function typesForCategory(category) {
  return certificateTypes.filter((type) => type.category === category);
}

function categoryOfType(type) {
  return certificateTypes.find((item) => item.value === type)?.category || "clinical";
}

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
  notes: "",
  // Medico-legal fields (persisted under metadata.medicoLegal on the backend)
  policeStation: "",
  mlcNumber: "",
  broughtBy: "",
  incidentDate: "",
  incidentPlace: "",
  examinationDateTime: "",
  injuryDetails: "",
  natureOfInjury: "",
  weaponType: "",
  causeOfDeath: "",
  identificationMarks: "",
  // Patient-centric fields (persisted under metadata.patientCentric on the backend)
  childName: "",
  babySex: "",
  birthDateTime: "",
  placeOfBirth: "",
  fatherName: "",
  motherName: "",
  birthWeight: "",
  deliveryType: "",
  deathDateTime: "",
  placeOfDeath: "",
  informantName: "",
  disabilityType: "",
  disabilityPercentage: "",
  disabilityStatus: "",
  boardMembers: "",
  reassessmentDate: "",
  admissionType: "",
  therapiesAdministered: "",
  panchakarmaTherapies: "",
  courseFrom: "",
  courseTo: "",
  numberOfSessions: "",
  medicinesUsed: "",
  recordsProvided: "",
  periodFrom: "",
  periodTo: "",
  purpose: "",
  numberOfPages: "",
  requestedBy: ""
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

function dateTimeLabel(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
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

const medicoLegalKeys = [
  "policeStation", "mlcNumber", "broughtBy", "incidentDate", "incidentPlace",
  "examinationDateTime", "injuryDetails", "natureOfInjury", "weaponType",
  "causeOfDeath", "identificationMarks"
];

const patientCentricKeys = [
  "childName", "babySex", "birthDateTime", "placeOfBirth", "fatherName", "motherName",
  "birthWeight", "deliveryType", "deathDateTime", "placeOfDeath", "informantName",
  "causeOfDeath", "disabilityType", "disabilityPercentage", "disabilityStatus",
  "boardMembers", "reassessmentDate", "admissionType", "therapiesAdministered",
  "panchakarmaTherapies", "courseFrom", "courseTo", "numberOfSessions", "medicinesUsed",
  "recordsProvided", "periodFrom", "periodTo", "purpose", "numberOfPages", "requestedBy"
];

function pick(source, keys) {
  return keys.reduce((accumulator, key) => {
    accumulator[key] = source[key] || "";
    return accumulator;
  }, {});
}

// Builds a live, unsaved preview object shaped exactly like a saved certificate
// so the preview panel can render while the user is still composing the form.
function formToDraftCertificate(form, patient) {
  const category = categoryOfType(form.certificateType);

  return {
    ...form,
    certificateNumber: "(draft — not saved)",
    patientName: form.patientName || (patient ? patientDisplayName(patient) : ""),
    patientAge: patient?.ageYears || form.patientAge || "",
    patientGender: patient?.gender || form.patientGender || "",
    uhid: patient?.uhid || "",
    metadata: {
      ...(category === "medicolegal" ? { medicoLegal: pick(form, medicoLegalKeys) } : {}),
      ...(category === "patient" ? { patientCentric: pick(form, patientCentricKeys) } : {})
    }
  };
}

function CertificatePreview({ certificate, isDraft = false }) {
  if (!certificate) {
    return (
      <div className="certificate-print-sheet certificate-empty-preview">
        <img className="certificate-letterhead" src={certificateHeader} alt="" />
        <img className="certificate-divider" src={certificateDivider} alt="" />
        <div className="empty-state">Start filling the form to see a live preview, then save to issue the certificate.</div>
      </div>
    );
  }

  const ml = certificate.metadata?.medicoLegal || {};
  const pc = certificate.metadata?.patientCentric || {};

  return (
    <div className="certificate-print-sheet">
      {isDraft ? <div className="certificate-draft-ribbon no-print">DRAFT — not saved</div> : null}
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

      {["wound", "accident_wound"].includes(certificate.certificateType) ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> was examined in connection with a medico-legal case{ml.broughtBy ? <> and was brought by <strong>{ml.broughtBy}</strong></> : null}.</p>
          <div className="certificate-meta-grid">
            <div><strong>Police Station:</strong> {ml.policeStation || "-"}</div>
            <div><strong>MLC / FIR No.:</strong> {ml.mlcNumber || "-"}</div>
            <div><strong>Date of Incident:</strong> {dateLabel(ml.incidentDate) || "-"}</div>
            <div><strong>Place of Incident:</strong> {ml.incidentPlace || "-"}</div>
          </div>
          <p><strong>Nature and extent of injuries:</strong></p>
          <p className="certificate-preformatted">{ml.injuryDetails || "-"}</p>
          <p><strong>Nature of injury:</strong> {ml.natureOfInjury || "-"}</p>
          <p><strong>Weapon / Cause used:</strong> {ml.weaponType || "-"}</p>
          {ml.identificationMarks ? <p><strong>Identification marks:</strong> {ml.identificationMarks}</p> : null}
        </div>
      ) : null}

      {certificate.certificateType === "mlc" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> was registered as a Medico-Legal Case{ml.broughtBy ? <>, brought by <strong>{ml.broughtBy}</strong></> : null}.</p>
          <div className="certificate-meta-grid">
            <div><strong>Police Station:</strong> {ml.policeStation || "-"}</div>
            <div><strong>MLC / FIR No.:</strong> {ml.mlcNumber || "-"}</div>
            <div><strong>Date of Incident:</strong> {dateLabel(ml.incidentDate) || "-"}</div>
            <div><strong>Place of Incident:</strong> {ml.incidentPlace || "-"}</div>
          </div>
          <p><strong>History / Alleged cause:</strong></p>
          <p className="certificate-preformatted">{ml.injuryDetails || "-"}</p>
          <p><strong>Clinical findings / Diagnosis:</strong> {certificate.diagnosis || "-"}</p>
          <p><strong>Nature of injury:</strong> {ml.natureOfInjury || "-"}</p>
        </div>
      ) : null}

      {certificate.certificateType === "post_mortem" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that a post-mortem examination was conducted on the body of <strong>{certificate.patientName}</strong>{ml.broughtBy ? <>, identified by <strong>{ml.broughtBy}</strong></> : null}.</p>
          <div className="certificate-meta-grid">
            <div><strong>Police Station:</strong> {ml.policeStation || "-"}</div>
            <div><strong>MLC / FIR No.:</strong> {ml.mlcNumber || "-"}</div>
            <div><strong>Date of Death:</strong> {dateLabel(ml.incidentDate) || "-"}</div>
            <div><strong>Examination On:</strong> {dateTimeLabel(ml.examinationDateTime) || "-"}</div>
          </div>
          <p><strong>Identification marks:</strong> {ml.identificationMarks || "-"}</p>
          <p><strong>Cause of death:</strong></p>
          <p className="certificate-preformatted">{ml.causeOfDeath || "-"}</p>
        </div>
      ) : null}

      {certificate.certificateType === "birth" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that a live birth took place at this AYUSH institution as recorded below.</p>
          <div className="certificate-meta-grid">
            <div><strong>Name of Child:</strong> {pc.childName || "-"}</div>
            <div><strong>Sex:</strong> {pc.babySex || "-"}</div>
            <div><strong>Date &amp; Time of Birth:</strong> {dateTimeLabel(pc.birthDateTime) || "-"}</div>
            <div><strong>Place of Birth:</strong> {pc.placeOfBirth || "-"}</div>
            <div><strong>Father's Name:</strong> {pc.fatherName || "-"}</div>
            <div><strong>Mother's Name:</strong> {pc.motherName || certificate.patientName || "-"}</div>
            <div><strong>Weight at Birth:</strong> {pc.birthWeight ? `${pc.birthWeight} kg` : "-"}</div>
            <div><strong>Type of Delivery:</strong> {pc.deliveryType || "-"}</div>
          </div>
        </div>
      ) : null}

      {certificate.certificateType === "death" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> expired while under care at this AYUSH institution.</p>
          <div className="certificate-meta-grid">
            <div><strong>Date &amp; Time of Death:</strong> {dateTimeLabel(pc.deathDateTime) || "-"}</div>
            <div><strong>Place of Death:</strong> {pc.placeOfDeath || "-"}</div>
            <div><strong>Age:</strong> {certificate.patientAge ? `${certificate.patientAge} years` : "-"}</div>
            <div><strong>Informant:</strong> {pc.informantName || "-"}</div>
          </div>
          <p><strong>Cause of death:</strong></p>
          <p className="certificate-preformatted">{pc.causeOfDeath || "-"}</p>
        </div>
      ) : null}

      {certificate.certificateType === "disability" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> was assessed by the medical board and found to have the following disability.</p>
          <div className="certificate-meta-grid">
            <div><strong>Type of Disability:</strong> {pc.disabilityType || "-"}</div>
            <div><strong>Extent:</strong> {pc.disabilityPercentage ? `${pc.disabilityPercentage}%` : "-"}</div>
            <div><strong>Status:</strong> {pc.disabilityStatus || "-"}</div>
            <div><strong>Re-assessment Due:</strong> {dateLabel(pc.reassessmentDate) || "-"}</div>
          </div>
          <p><strong>Diagnosis / Clinical basis:</strong> {certificate.diagnosis || "-"}</p>
          {pc.boardMembers ? <><p><strong>Medical board:</strong></p><p className="certificate-preformatted">{pc.boardMembers}</p></> : null}
        </div>
      ) : null}

      {certificate.certificateType === "treatment" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> received treatment at this AYUSH institution as an <strong>{pc.admissionType || "OP/IP"}</strong> patient.</p>
          <div className="certificate-meta-grid">
            <div><strong>From:</strong> {dateLabel(certificate.admissionDate) || "-"}</div>
            <div><strong>To:</strong> {dateLabel(certificate.dischargeDate) || "-"}</div>
          </div>
          <p><strong>Diagnosis:</strong> {certificate.diagnosis || "-"}</p>
          <p><strong>Treatment / medicines given:</strong></p>
          <p className="certificate-preformatted">{certificate.treatment || "-"}</p>
          {pc.therapiesAdministered ? <><p><strong>AYUSH therapies administered:</strong></p><p className="certificate-preformatted">{pc.therapiesAdministered}</p></> : null}
        </div>
      ) : null}

      {certificate.certificateType === "panchakarma" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that <strong>{certificate.patientName}</strong> underwent the following Panchakarma therapies at this institution.</p>
          <div className="certificate-meta-grid">
            <div><strong>Course From:</strong> {dateLabel(pc.courseFrom) || "-"}</div>
            <div><strong>Course To:</strong> {dateLabel(pc.courseTo) || "-"}</div>
            <div><strong>No. of Sessions:</strong> {pc.numberOfSessions || "-"}</div>
            <div><strong>Diagnosis:</strong> {certificate.diagnosis || "-"}</div>
          </div>
          <p><strong>Panchakarma therapies:</strong></p>
          <p className="certificate-preformatted">{pc.panchakarmaTherapies || "-"}</p>
          {pc.medicinesUsed ? <><p><strong>Medicines used:</strong></p><p className="certificate-preformatted">{pc.medicinesUsed}</p></> : null}
        </div>
      ) : null}

      {certificate.certificateType === "medical_records" ? (
        <div className="certificate-body-copy">
          <p>This is to certify that copies of the medical records of <strong>{certificate.patientName}</strong> have been issued from the hospital file.</p>
          <div className="certificate-meta-grid">
            <div><strong>Period From:</strong> {dateLabel(pc.periodFrom) || "-"}</div>
            <div><strong>Period To:</strong> {dateLabel(pc.periodTo) || "-"}</div>
            <div><strong>No. of Pages:</strong> {pc.numberOfPages || "-"}</div>
            <div><strong>Requested By:</strong> {pc.requestedBy || "-"}</div>
          </div>
          <p><strong>Records / documents provided:</strong></p>
          <p className="certificate-preformatted">{pc.recordsProvided || "-"}</p>
          <p><strong>Purpose:</strong> {pc.purpose || "-"}</p>
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
  const [mode, setMode] = useState("draft");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = canPerformModuleAction(user, "certificates", ["admin", "doctor"]);

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

  const activeCategory = categoryOfType(form.certificateType);

  const isSavedView = mode === "saved" && Boolean(selectedCertificate);
  const draftCertificate = formToDraftCertificate(form, selectedPatient);
  const previewCertificate = isSavedView
    ? selectedCertificate
    : (form.patientName ? draftCertificate : null);
  const previewIsDraft = !isSavedView && Boolean(previewCertificate);

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;
    setMode("draft");
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCategoryChange = (category) => {
    if (category === activeCategory) {
      return;
    }

    const firstType = typesForCategory(category)[0]?.value;
    if (firstType) {
      setMode("draft");
      setForm((current) => ({ ...current, certificateType: firstType }));
    }
  };

  const handlePatientSelect = (patientId, patient) => {
    setMode("draft");
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
    setMode("draft");
    setForm((current) => ({
      ...current,
      patientName: value,
      patientFirstName: value
    }));
  };

  const handleDoctorSelect = (doctorId, doctor) => {
    setMode("draft");
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
      setMode("saved");
      setCertificates((current) => [response.item, ...current.filter((item) => item.id !== response.item.id)]);
      await loadData();
    } catch (apiError) {
      setError(apiError.message || "Unable to save certificate.");
    } finally {
      setSaving(false);
    }
  };

  const startNewCertificate = () => {
    setForm({
      ...initialForm,
      certificateType: form.certificateType,
      doctorId: form.doctorId,
      doctorName: form.doctorName,
      doctorRegistrationNumber: form.doctorRegistrationNumber
    });
    setMode("draft");
    setMessage("");
    setError("");
  };

  const printCertificate = () => {
    if (!(mode === "saved" && selectedCertificate)) {
      setError("Save the certificate before printing.");
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
          <p className="page-copy">Create clinical certificates (fitness, sick leave, insurance) and medico-legal certificates (wound, post mortem, MLC, accident) with the Shanti Ratnam letterhead and save them against the patient record.</p>
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
            <div className="section-header-actions">
              <Button type="button" variant="secondary" onClick={startNewCertificate}>
                New
              </Button>
              <Button type="button" variant="secondary" onClick={printCertificate} disabled={!isSavedView}>
                Print
              </Button>
            </div>
          </div>

          <div className="certificate-category-tabs" role="tablist">
            {certificateCategories.map((category) => (
              <button
                key={category.value}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.value}
                className={`certificate-category-tab ${activeCategory === category.value ? "active" : ""}`}
                onClick={() => handleCategoryChange(category.value)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <form className="form-grid" onSubmit={saveCertificate}>
            <div className="field">
              <label>Certificate type</label>
              <select name="certificateType" value={form.certificateType} onChange={handleChange}>
                {typesForCategory(activeCategory).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
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
                loadOptions={(query) => getPatients(query, { pageSize: 30 }).then((response) => response.items || [])}
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
                onCustomValueChange={(value) => { setMode("draft"); setForm((current) => ({ ...current, doctorName: value })); }}
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

            {form.certificateType === "birth" ? (
              <>
                <div className="field">
                  <label>Name of child</label>
                  <input name="childName" value={form.childName} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Sex of child</label>
                  <select name="babySex" value={form.babySex} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date &amp; time of birth</label>
                  <input type="datetime-local" name="birthDateTime" value={form.birthDateTime} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Place of birth</label>
                  <input name="placeOfBirth" value={form.placeOfBirth} onChange={handleChange} placeholder="Shanti Ratnam Ayush Hospital" />
                </div>
                <div className="field">
                  <label>Father's name</label>
                  <input name="fatherName" value={form.fatherName} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Mother's name</label>
                  <input name="motherName" value={form.motherName} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Weight at birth (kg)</label>
                  <input type="number" step="0.01" min="0" name="birthWeight" value={form.birthWeight} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Type of delivery</label>
                  <select name="deliveryType" value={form.deliveryType} onChange={handleChange}>
                    <option value="">Select</option>
                    {deliveryTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </>
            ) : null}

            {form.certificateType === "death" ? (
              <>
                <div className="field">
                  <label>Date &amp; time of death</label>
                  <input type="datetime-local" name="deathDateTime" value={form.deathDateTime} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Place of death</label>
                  <input name="placeOfDeath" value={form.placeOfDeath} onChange={handleChange} placeholder="Shanti Ratnam Ayush Hospital" />
                </div>
                <div className="field">
                  <label>Informant name</label>
                  <input name="informantName" value={form.informantName} onChange={handleChange} placeholder="Relative / person informed" />
                </div>
                <div className="field field-span-2">
                  <label>Cause of death</label>
                  <textarea name="causeOfDeath" value={form.causeOfDeath} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {form.certificateType === "disability" ? (
              <>
                <div className="field">
                  <label>Type of disability</label>
                  <input name="disabilityType" value={form.disabilityType} onChange={handleChange} placeholder="Locomotor, visual, hearing, mental..." />
                </div>
                <div className="field">
                  <label>Extent of disability (%)</label>
                  <input type="number" min="0" max="100" name="disabilityPercentage" value={form.disabilityPercentage} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select name="disabilityStatus" value={form.disabilityStatus} onChange={handleChange}>
                    <option value="">Select</option>
                    {disabilityStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Re-assessment due</label>
                  <input type="date" name="reassessmentDate" value={form.reassessmentDate} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Diagnosis / clinical basis</label>
                  <textarea name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Medical board members</label>
                  <textarea name="boardMembers" value={form.boardMembers} onChange={handleChange} placeholder="One member per line" />
                </div>
              </>
            ) : null}

            {form.certificateType === "treatment" ? (
              <>
                <div className="field">
                  <label>Patient type</label>
                  <select name="admissionType" value={form.admissionType} onChange={handleChange}>
                    <option value="">Select</option>
                    <option value="OP">Outpatient (OP)</option>
                    <option value="IP">Inpatient (IP)</option>
                  </select>
                </div>
                <div className="field" />
                <div className="field">
                  <label>Treatment from</label>
                  <input type="date" name="admissionDate" value={form.admissionDate} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Treatment to</label>
                  <input type="date" name="dischargeDate" value={form.dischargeDate} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Diagnosis</label>
                  <textarea name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Treatment / medicines given</label>
                  <textarea name="treatment" value={form.treatment} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>AYUSH therapies administered</label>
                  <textarea name="therapiesAdministered" value={form.therapiesAdministered} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {form.certificateType === "panchakarma" ? (
              <>
                <div className="field">
                  <label>Course from</label>
                  <input type="date" name="courseFrom" value={form.courseFrom} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Course to</label>
                  <input type="date" name="courseTo" value={form.courseTo} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>No. of sessions</label>
                  <input type="number" min="0" name="numberOfSessions" value={form.numberOfSessions} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Diagnosis</label>
                  <input name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                </div>
                <div className="field field-span-2">
                  <label>Panchakarma therapies</label>
                  <textarea name="panchakarmaTherapies" value={form.panchakarmaTherapies} onChange={handleChange} list="panchakarma-therapy-options" placeholder="e.g. Vamana, Virechana, Basti..." />
                  <datalist id="panchakarma-therapy-options">
                    {panchakarmaTherapyOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
                <div className="field field-span-2">
                  <label>Medicines used</label>
                  <textarea name="medicinesUsed" value={form.medicinesUsed} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {form.certificateType === "medical_records" ? (
              <>
                <div className="field">
                  <label>Period from</label>
                  <input type="date" name="periodFrom" value={form.periodFrom} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Period to</label>
                  <input type="date" name="periodTo" value={form.periodTo} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>No. of pages</label>
                  <input type="number" min="0" name="numberOfPages" value={form.numberOfPages} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>Requested by</label>
                  <input name="requestedBy" value={form.requestedBy} onChange={handleChange} placeholder="Patient / relative / authority" />
                </div>
                <div className="field field-span-2">
                  <label>Records / documents provided</label>
                  <textarea name="recordsProvided" value={form.recordsProvided} onChange={handleChange} placeholder="Discharge summary, lab reports, prescriptions..." />
                </div>
                <div className="field field-span-2">
                  <label>Purpose</label>
                  <input name="purpose" value={form.purpose} onChange={handleChange} />
                </div>
              </>
            ) : null}

            {activeCategory === "medicolegal" ? (
              <>
                <div className="field">
                  <label>Police station</label>
                  <input name="policeStation" value={form.policeStation} onChange={handleChange} placeholder="Reporting police station" />
                </div>
                <div className="field">
                  <label>MLC / FIR no.</label>
                  <input name="mlcNumber" value={form.mlcNumber} onChange={handleChange} />
                </div>
                <div className="field">
                  <label>{form.certificateType === "post_mortem" ? "Identified / brought by" : "Brought by"}</label>
                  <input name="broughtBy" value={form.broughtBy} onChange={handleChange} placeholder="Police / relative / constable name" />
                </div>
                <div className="field">
                  <label>{form.certificateType === "post_mortem" ? "Date of death" : "Date of incident"}</label>
                  <input type="date" name="incidentDate" value={form.incidentDate} onChange={handleChange} />
                </div>

                {form.certificateType === "post_mortem" ? (
                  <>
                    <div className="field">
                      <label>Examination date &amp; time</label>
                      <input type="datetime-local" name="examinationDateTime" value={form.examinationDateTime} onChange={handleChange} />
                    </div>
                    <div className="field field-span-2">
                      <label>Identification marks</label>
                      <input name="identificationMarks" value={form.identificationMarks} onChange={handleChange} />
                    </div>
                    <div className="field field-span-2">
                      <label>Cause of death</label>
                      <textarea name="causeOfDeath" value={form.causeOfDeath} onChange={handleChange} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field field-span-2">
                      <label>Place of incident</label>
                      <input name="incidentPlace" value={form.incidentPlace} onChange={handleChange} />
                    </div>
                    <div className="field field-span-2">
                      <label>{form.certificateType === "mlc" ? "History / alleged cause" : "Nature and extent of injuries"}</label>
                      <textarea name="injuryDetails" value={form.injuryDetails} onChange={handleChange} />
                    </div>
                    <div className="field">
                      <label>Nature of injury</label>
                      <select name="natureOfInjury" value={form.natureOfInjury} onChange={handleChange}>
                        <option value="">Select</option>
                        {natureOfInjuryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    {form.certificateType === "mlc" ? (
                      <div className="field">
                        <label>Clinical findings / diagnosis</label>
                        <input name="diagnosis" value={form.diagnosis} onChange={handleChange} />
                      </div>
                    ) : (
                      <div className="field">
                        <label>Weapon / cause used</label>
                        <input name="weaponType" value={form.weaponType} onChange={handleChange} placeholder="Blunt, sharp, vehicle, firearm..." />
                      </div>
                    )}
                    <div className="field field-span-2">
                      <label>Identification marks</label>
                      <input name="identificationMarks" value={form.identificationMarks} onChange={handleChange} />
                    </div>
                  </>
                )}
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
              <h3>{isSavedView ? selectedCertificate.certificateNumber : (previewIsDraft ? "Draft preview" : "Patient copy")}</h3>
            </div>
          </div>
          <CertificatePreview certificate={previewCertificate} isDraft={previewIsDraft} />
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
                      <button className="button-link" type="button" onClick={() => { setSelectedCertificate(certificate); setMode("saved"); }}>
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
