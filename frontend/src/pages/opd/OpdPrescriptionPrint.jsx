import certificateHeader from "../../assets/certificates/certificate-header.png";
import hospitalLogo from "../../assets/certificates/shanti-ratnam-logo-full.png";
import { ayurvedaSections } from "./ayurvedaParikshanData.js";

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

function filledRows(rows, hasContent, fallback = {}) {
  const completedRows = (rows || []).filter(hasContent);
  return completedRows.length ? completedRows : [fallback];
}

function bmiValue(height, weight) {
  const heightCm = Number.parseFloat(height);
  const weightKg = Number.parseFloat(weight);
  if (!heightCm || !weightKg) return "—";
  return (weightKg / ((heightCm / 100) ** 2)).toFixed(1);
}

// Only parikshan fields the doctor actually filled reach the printed sheet.
function AyurvedaParikshan({ vitalsForm }) {
  const filledSections = ayurvedaSections
    .map((section) => ({
      title: section.title,
      rows: section.fields
        .map((field) => ({ label: field.label, value: (vitalsForm[field.name] || []).join(", ") }))
        .filter((row) => row.value)
    }))
    .filter((section) => section.rows.length);

  // Prakruti is disabled for now, so it neither prints nor keeps the section alive.
  const prakrutiDominant = "";
  const notes = vitalsForm.ayurvedaNotes || "";
  if (!filledSections.length && !notes) return null;

  return (
    <>
      <SectionTitle>AYURVEDIC PARIKSHAN</SectionTitle>
      <div className="opd-rx-ayurveda-grid">
        {filledSections.map((section) => (
          <section className="opd-rx-ayurveda-section" key={section.title}>
            <h4>{section.title.toUpperCase()}</h4>
            <table className="opd-rx-ayurveda-findings">
              <tbody>
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        {/* Re-enable together with the Prakruti table in GeneralExaminationForm, and
            restore `prakrutiDominant` above to read from vitalsForm.
        {prakrutiDominant ? (
          <p>
            <strong>PRAKRUTI:</strong> {prakrutiDominant} (Vata {vitalsForm.prakrutiVataCount || 0} / Pitta{" "}
            {vitalsForm.prakrutiPittaCount || 0} / Kapha {vitalsForm.prakrutiKaphaCount || 0})
          </p>
        ) : null}
        */}
        {notes ? (
          <div className="opd-rx-ayurveda-notes"><strong>Notes:</strong> {notes}</div>
        ) : null}
      </div>
    </>
  );
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
  const complaintRows = filledRows(
    metadata.complaintRows,
    (row) => row?.complaint || row?.duration || row?.severity,
    { complaint: visit.chiefComplaint || "" }
  );
  const diagnosisRows = filledRows(
    metadata.diagnosisRows,
    (row) => row?.diagnosis || row?.icdCode,
    { diagnosis: prescriptionForm.diagnosis || "", type: "primary" }
  );
  const medicineRows = filledRows(
    prescriptionForm.medicines,
    (row) => row?.medicineName,
    {}
  );
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

        <AyurvedaParikshan vitalsForm={vitalsForm} />

        <SectionTitle>CHIEF COMPLAINT &amp; HISTORY OF PRESENT ILLNESS</SectionTitle>
        <table className="opd-rx-table opd-rx-complaint-table">
          <thead><tr><th>CHIEF COMPLAINT</th><th>Duration</th><th>Severity</th></tr></thead>
          <tbody>
            {complaintRows.map((row, index) => <tr key={`rx-complaint-${index}`}><td>{text(row.complaint, index === 0 ? text(visit.chiefComplaint, "") : "")}</td><td>{row.duration || ""}</td><td>{row.severity || ""}</td></tr>)}
          </tbody>
        </table>

        <SectionTitle>MEDICAL, ALLERGY &amp; FAMILY HISTORY</SectionTitle>
        <table className="opd-rx-table opd-rx-history-table">
          <tbody>
            <tr>
              <th>Medical</th>
              <td>{medicalConditions.map(([value, label]) => <Choice key={value} checked={includesValue(medical.conditions, value)}>{label}</Choice>)}</td>
            </tr>
            <tr>
              <th>Surgical</th>
              <td>{text(medical.surgicalHistory)} <strong>Details:</strong> {text(medical.surgicalDetails)}</td>
            </tr>
            <tr>
              <th>Menstrual / obstetric</th>
              <td>
                LMP {text(medical.menstrualLmp)}; previous {text(medical.menstrualPreviousLmp)}; days {text(medical.menstrualDays)}; menarche {text(medical.menarche)}; menopause {text(medical.menopause)};{" "}
                <Choice checked={medical.menstrualCycle === "regular"}>Regular</Choice>
                <Choice checked={medical.menstrualCycle === "irregular"}>Irregular</Choice>
                <Choice checked={Boolean(medical.clotting)}>Clotting</Choice>
                Pain {text(medical.painSeverity)}; obstetric {text(medical.obstetricHistory)}
              </td>
            </tr>
            <tr>
              <th>Allergies</th>
              <td>Drug: {text(allergies.drug)}; Food: {text(allergies.food)}; Environmental: {text(allergies.environmental)}</td>
            </tr>
            <tr>
              <th>Family</th>
              <td>
                <Choice checked={Boolean(family.geneticConditions)}>Genetic / hereditary</Choice>
                {familyConditions.map(([value, label]) => <Choice key={value} checked={includesValue(family.conditions, value)}>{label}</Choice>)}
                Details: {text(family.geneticDetails)}; Others: {text(family.others)}
              </td>
            </tr>
            {medical.other ? <tr><th>Other history</th><td>{medical.other}</td></tr> : null}
          </tbody>
        </table>
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
