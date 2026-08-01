import certificateHeader from "../../assets/certificates/certificate-header.png";
import hospitalLogo from "../../assets/certificates/shanti-ratnam-logo-full.png";

const medicalConditions = [
  ["dm", "DM"], ["htn", "HTN"], ["cad", "CAD"], ["cva", "CVA"],
  ["respiratory", "Respiratory disease"], ["thyroid", "Thyroid"], ["renal", "Renal disease"],
  ["neurological", "Neurological disease"], ["psychiatric", "Psychiatric disease"], ["malignancy", "Malignancy / cancer"]
];

const familyConditions = [
  ["diabetes", "Diabetes"], ["htn", "HTN"], ["cad", "CAD"], ["cancer", "Cancer"],
  ["renal", "Renal"], ["arthritis", "Arthritis"]
];

function text(value, fallback = "—") {
  return value === 0 || String(value || "").trim() ? value : fallback;
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function includesValue(values, value) {
  return (values || []).some((item) => String(item).toLowerCase() === String(value).toLowerCase());
}

function contains(value, target) {
  return String(value || "").toLowerCase().includes(String(target).toLowerCase());
}

function Choice({ checked, children }) {
  return <span className="opd-rx-choice"><span aria-hidden="true">{checked ? "☑" : "☐"}</span> {children}</span>;
}

function SectionTitle({ children }) {
  return <h3 className="opd-rx-section-title">{children}</h3>;
}

function Header() {
  return (
    <header className="opd-rx-header">
      <img className="opd-rx-logo" src={hospitalLogo} alt="Shanti Ratnam" />
      <img className="opd-rx-header-details" src={certificateHeader} alt="Shanti Ratnam hospital details" />
    </header>
  );
}

function paddedRows(rows, minimum) {
  return Array.from({ length: Math.max(rows?.length || 0, minimum) }, (_, index) => rows?.[index] || {});
}

function bmiValue(height, weight) {
  const heightCm = Number.parseFloat(height);
  const weightKg = Number.parseFloat(weight);
  if (!heightCm || !weightKg) return "—";
  return (weightKg / ((heightCm / 100) ** 2)).toFixed(1);
}

function selectedPatientCategory(patient, queueItem) {
  return patient?.metadata?.category || patient?.metadata?.socialCategory || patient?.metadata?.casteCategory || queueItem?.patientCategory || "";
}

export function OpdPrescriptionPrint({ visitPayload, selectedQueueItem, vitalsForm, assessmentForm, prescriptionForm }) {
  const visit = visitPayload.visit;
  const patient = visitPayload.patient || {};
  const metadata = prescriptionForm.metadata || {};
  const medical = metadata.medicalHistory || {};
  const allergies = metadata.allergies || {};
  const family = metadata.familyHistory || {};
  const followUp = metadata.followUpMonitoring || {};
  const patientCategory = metadata.patientDetails?.category || selectedPatientCategory(patient, selectedQueueItem);
  const [systolic = "", diastolic = ""] = String(vitalsForm.vitalsBp || "").split(/[\/\\-]/).map((part) => part.trim());
  const complaintRows = paddedRows(metadata.complaintRows, 10);
  const enteredDiagnosisRows = (metadata.diagnosisRows || []).filter((row) => row.diagnosis || row.icdCode);
  const diagnosisRows = paddedRows(enteredDiagnosisRows, 2);
  const medicineRows = paddedRows(prescriptionForm.medicines, 8);
  const prakriti = assessmentForm.prakritiDominant || "";
  const age = patient.ageYears || selectedQueueItem?.patientAge || "";
  const gender = patient.gender || selectedQueueItem?.patientGender || "";

  return (
    <div className="opd-prescription-print-sheet">
      <section className="opd-rx-page opd-rx-page-one">
        <Header />
        <h1>SR-AIIMS OPD PRESCRIPTION</h1>

        <SectionTitle>PATIENT DETAILS</SectionTitle>
        <table className="opd-rx-table opd-rx-patient-table">
          <tbody>
            <tr><th>Patient Name (FULL):</th><td>{text(patient.fullName || visit.patientName)}</td><th>UID/MRN:</th><td>{text(patient.uhid || patient.registrationNumber || visit.patientId)}</td></tr>
            <tr><th>Date of Birth:</th><td>{formatDate(patient.dateOfBirth)}</td><th>Age (Years):</th><td>{text(age)}</td></tr>
            <tr><th>Gender:</th><td><Choice checked={contains(gender, "male") && !contains(gender, "female")}>M</Choice> <Choice checked={contains(gender, "female")}>F</Choice> <Choice checked={Boolean(gender) && !contains(gender, "male") && !contains(gender, "female")}>Other</Choice></td><th>Category:</th><td><Choice checked={contains(patientCategory, "gen")}>Gen</Choice> <Choice checked={contains(patientCategory, "obc")}>OBC</Choice> <Choice checked={patientCategory.toLowerCase() === "sc"}>SC</Choice> <Choice checked={patientCategory.toLowerCase() === "st"}>ST</Choice></td></tr>
            <tr><th>Contact Number:</th><td>{text(patient.phone || selectedQueueItem?.patientMobile)}</td><th>Email:</th><td>{text(patient.email)}</td></tr>
            <tr><th>Address:</th><td colSpan="3">{text(patient.address || [patient.houseStreet, patient.areaVillage, patient.cityDistrict, patient.state, patient.pincode].filter(Boolean).join(", "))}</td></tr>
          </tbody>
        </table>

        <SectionTitle>VITAL SIGNS &amp; ANTHROPOMETRY</SectionTitle>
        <table className="opd-rx-table opd-rx-vitals-table">
          <tbody>
            <tr><th>Blood Pressure:</th><td>Systolic: {text(systolic)} &nbsp; Diastolic: {text(diastolic)} mmHg</td><th>Pulse Rate:</th><td>{text(vitalsForm.vitalsPulse)} bpm</td></tr>
            <tr><th>Temperature:</th><td>{text(vitalsForm.vitalsTemp)} {vitalsForm.temperatureUnit || "°C / °F"}</td><th>Respiration:</th><td>{text(vitalsForm.vitalsRr)} rpm</td></tr>
            <tr><th>Height (cm):</th><td>{text(vitalsForm.vitalsHeight)}</td><th>Weight (kg):</th><td>{text(vitalsForm.vitalsWeight)}</td></tr>
            <tr><th>BMI:</th><td>{bmiValue(vitalsForm.vitalsHeight, vitalsForm.vitalsWeight)} kg/m²</td><th>SPO2:</th><td>{text(vitalsForm.vitalsSpo2)}%</td></tr>
          </tbody>
        </table>

        <SectionTitle>CHIEF COMPLAINT &amp; HISTORY OF PRESENT ILLNESS</SectionTitle>
        <table className="opd-rx-table opd-rx-complaint-table">
          <thead><tr><th>CHIEF COMPLAINT</th><th>Duration</th><th>Severity</th></tr></thead>
          <tbody>
            {complaintRows.map((row, index) => <tr key={`rx-complaint-${index}`}><td>{text(row.complaint, index === 0 ? text(visit.chiefComplaint, "") : "")}</td><td>{row.duration || ""}</td><td>{row.severity || ""}</td></tr>)}
          </tbody>
        </table>

        <div className="opd-rx-history">
          <h4>MEDICAL HISTORY</h4>
          <p>{medicalConditions.map(([value, label]) => <Choice key={value} checked={includesValue(medical.conditions, value)}>{label}</Choice>)}</p>
          <p><strong>Surgical history:</strong> {text(medical.surgicalHistory)} &nbsp; <strong>If so, details:</strong> {text(medical.surgicalDetails)}</p>
          <p><strong>Menstrual history:</strong> LMP {text(medical.menstrualLmp)} &nbsp; Previous LMP {text(medical.menstrualPreviousLmp)} &nbsp; Days {text(medical.menstrualDays)}</p>
          <p>Menarche {text(medical.menarche)} &nbsp; Menopause {text(medical.menopause)} &nbsp; <Choice checked={medical.menstrualCycle === "regular"}>Regular</Choice> <Choice checked={medical.menstrualCycle === "irregular"}>Irregular</Choice> <Choice checked={Boolean(medical.clotting)}>Clotting</Choice> &nbsp; Pain severity {text(medical.painSeverity)} &nbsp; Obstetric history {text(medical.obstetricHistory)}</p>
          <p><strong>Other:</strong> {text(medical.other)}</p>
          <p><strong>ALLERGIES:</strong> Drug: {text(allergies.drug)} &nbsp; Food: {text(allergies.food)} &nbsp; Environmental: {text(allergies.environmental)}</p>
          <h4>FAMILY HISTORY</h4>
          <p><Choice checked={Boolean(family.geneticConditions)}>Genetic / hereditary conditions</Choice> Please specify: {text(family.geneticDetails)}</p>
          <p>{familyConditions.map(([value, label]) => <Choice key={value} checked={includesValue(family.conditions, value)}>{label}</Choice>)} &nbsp; Others: {text(family.others)}</p>
        </div>
        <div className="opd-rx-footer-line" />
      </section>

      <section className="opd-rx-page opd-rx-page-two">
        <SectionTitle>DIAGNOSIS (ICD-11 Classification)</SectionTitle>
        <table className="opd-rx-table opd-rx-blue-table">
          <thead><tr><th>S.No.</th><th>Diagnosis/Condition</th><th>ICD-11 Code</th><th>Primary/Secondary</th></tr></thead>
          <tbody>{diagnosisRows.map((row, index) => <tr key={`rx-diagnosis-${index}`}><td>{index + 1}</td><td>{text(row.diagnosis, index === 0 ? prescriptionForm.diagnosis : "")}</td><td>{row.icdCode || ""}</td><td><Choice checked={row.type === "primary"}>P</Choice> <Choice checked={row.type === "secondary"}>S</Choice></td></tr>)}</tbody>
        </table>

        <SectionTitle>AYURVEDIC ASSESSMENT</SectionTitle>
        <table className="opd-rx-table opd-rx-ayurveda-table"><tbody>
          <tr><th>Prakriti (Constitution):</th><td><Choice checked={contains(prakriti, "vata")}>Vata</Choice> <Choice checked={contains(prakriti, "pitta")}>Pitta</Choice> <Choice checked={contains(prakriti, "kapha")}>Kapha</Choice> &nbsp; Vikrita (Imbalance): {text(assessmentForm.vikritiAssessment)}</td></tr>
          <tr><th>Agni Status:</th><td><Choice checked={assessmentForm.agniStatus === "sama"}>Balanced</Choice> <Choice checked={assessmentForm.agniStatus === "manda"}>Manda (Weak)</Choice> <Choice checked={assessmentForm.agniStatus === "tikshna"}>Tikshna (Excess)</Choice></td></tr>
          <tr><th>Tongue Coating:</th><td>{["clean", "white", "yellow", "brown"].map((value) => <Choice key={value} checked={contains(assessmentForm.jihvaPariksha, value)}>{value[0].toUpperCase() + value.slice(1)}</Choice>)} &nbsp; {text(assessmentForm.jihvaPariksha, "")}</td></tr>
          <tr><th>Pulse (Nadi):</th><td><Choice checked={contains(assessmentForm.nadiType, "vata")}>Vata (Snake-like)</Choice> <Choice checked={contains(assessmentForm.nadiType, "pitta")}>Pitta (Frog-like)</Choice> <Choice checked={contains(assessmentForm.nadiType, "kapha")}>Kapha (Swan-like)</Choice> &nbsp; {text(assessmentForm.nadiPariksha, "")}</td></tr>
        </tbody></table>

        <SectionTitle>MEDICATIONS &amp; TREATMENT PLAN</SectionTitle>
        <table className="opd-rx-table opd-rx-blue-table opd-rx-medicine-table">
          <thead><tr><th>S.No.</th><th>Medicine Name</th><th>Strength</th><th>Dosage</th><th>Duration</th><th>Route</th><th>Notes</th></tr></thead>
          <tbody>{medicineRows.map((medicine, index) => {
            const hasMedicine = Boolean(medicine.medicineName);
            return <tr key={`rx-medicine-${index}`}><td>{index + 1}</td><td>{medicine.medicineName || ""}</td><td>{hasMedicine ? medicine.strength || "" : ""}</td><td>{hasMedicine ? [medicine.dose, medicine.frequency].filter(Boolean).join(" / ") : ""}</td><td>{hasMedicine && medicine.durationDays ? `${medicine.durationDays} days` : ""}</td><td>{hasMedicine ? medicine.route || "" : ""}</td><td>{hasMedicine ? [medicine.timing, medicine.anupana, medicine.specialInstructions].filter(Boolean).join("; ") : ""}</td></tr>;
          })}</tbody>
        </table>
        <div className="opd-rx-signature">{text(visitPayload.doctorName, "")}<br />Physician&apos;s signature ____________________</div>

        <SectionTitle>FOLLOW-UP &amp; CLINICAL MONITORING</SectionTitle>
        <table className="opd-rx-table opd-rx-followup-table"><tbody>
          <tr><th>Follow-up Interval:</th><td><Choice checked={followUp.interval === "1-week"}>1 week</Choice> <Choice checked={followUp.interval === "2-weeks"}>2 weeks</Choice> <Choice checked={followUp.interval === "1-month"}>1 month</Choice></td><th>Follow-up Date:</th><td>{formatDate(prescriptionForm.followUpDate)}</td></tr>
          <tr><th>Monitoring Parameters:</th><td colSpan="3">{[["bp", "Blood pressure"], ["weight", "Weight"], ["fbs", "Fasting blood sugar"], ["symptoms", "Symptoms / clinical response"]].map(([value, label]) => <Choice key={value} checked={includesValue(followUp.parameters, value)}>{label}</Choice>)} &nbsp; Others: {text(followUp.others)}</td></tr>
        </tbody></table>

        <div className="opd-rx-validity">
          <h4>PRESCRIPTION VALIDITY:</h4>
          <p><strong>This prescription is valid for 7 days from the date of issue. Refills require fresh physician consultation.</strong></p>
          <p><strong>MEDICATION COMPLIANCE:</strong> Patient must take all medications exactly as prescribed without skipping doses for optimal therapeutic outcomes.</p>
          <p><strong>FOLLOW-UP APPOINTMENTS:</strong> Keep all scheduled follow-up appointments and investigations for monitoring therapeutic response.</p>
          <p><strong>SELF-MEDICATION RESTRICTION:</strong> DO NOT self-medicate, change doses, or discontinue medications without physician approval. This document is not valid for MLC purpose.</p>
        </div>
        <div className="opd-rx-footer-line" />
      </section>
    </div>
  );
}
