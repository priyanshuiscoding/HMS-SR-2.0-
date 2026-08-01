import { memo } from "react";

import { Button } from "../../components/common/Button.jsx";
import { ExaminationField } from "./SystemicExaminationForm.jsx";

const text = (label, name, placeholder = "") => ({ label, name, placeholder });
const combo = (label, name, options, placeholder = "Type or select") => ({ label, name, options, placeholder });
const number = (label, name, min, max) => ({ label, name, type: "number", min, max });
const date = (label, name) => ({ label, name, type: "date" });
const readonly = (label, name) => ({ label, name, readOnly: true });
const yesNo = ["Yes", "No"];
const presentAbsent = ["Present", "Absent"];

export const emptyComplaint = {
  complaint: "", durationValue: "", durationUnit: "", onset: "", site: "", spread: "", onsetDate: "", triggeringEvent: "",
  character: "", radiation: "", associations: "", timeCourse: "", coursePattern: "", exacerbatingFactors: "", relievingFactors: "",
  severity: "", functionalImpairment: "", previousEpisodes: "", episodeFrequency: "", previousTreatment: "", progression: "", relevantNegatives: ""
};

export const emptyCurrentMedication = { name: "", dose: "", frequency: "", duration: "", prescribingDoctor: "", medicineSystem: "" };

const complaintFields = [
  text("Chief complaint", "complaint"), number("Duration", "durationValue", 0, 999), combo("Duration unit", "durationUnit", ["Days", "Weeks", "Months", "Years"]),
  combo("Onset", "onset", ["Sudden", "Gradual", "Insidious"]), text("Primary site", "site"), text("Spread", "spread"), date("Exact onset date", "onsetDate"),
  combo("Triggering event", "triggeringEvent", ["Physical", "Emotional", "Seasonal", "Dietary", "Post-fever", "Post-injury"]),
  combo("Character / quality", "character", ["Burning", "Aching", "Stabbing", "Throbbing", "Cramping", "Colicky", "Pressure", "Dull", "Sharp"]),
  text("Radiation direction / pattern", "radiation"), text("Associated symptoms", "associations", "N/V, fever, weight, appetite, bowel/bladder, sweating"),
  combo("Time course", "timeCourse", ["Constant", "Intermittent", "Paroxysmal"]), combo("Course pattern", "coursePattern", ["Progressive", "Static", "Remitting-Relapsing"]),
  combo("Exacerbating factors", "exacerbatingFactors", ["Movement", "Food", "Cold", "Heat", "Stress", "Posture", "Sleep", "Specific activities"]),
  combo("Relieving factors", "relievingFactors", ["Rest", "Medication", "Heat application", "Cold application", "Position"]),
  number("Severity — VAS (0–10)", "severity", 0, 10), text("Functional impairment", "functionalImpairment"),
  combo("Previous similar episodes", "previousEpisodes", yesNo), text("Episode frequency", "episodeFrequency"), text("Previous treatment", "previousTreatment"),
  combo("Progression", "progression", ["Getting better", "Getting worse", "Same"]), text("Relevant negatives", "relevantNegatives")
];

const medicationFields = [
  text("Medicine name", "name"), text("Dose", "dose"), text("Frequency", "frequency"), text("Duration", "duration"),
  text("Prescribing doctor", "prescribingDoctor"), combo("System", "medicineSystem", ["Allopathic", "Ayurvedic", "Homeopathic", "Self-prescribed", "OTC"])
];

const majorIllnesses = [
  ["DM", "Dm"], ["HTN", "Htn"], ["CAD", "Cad"], ["Asthma", "Asthma"], ["TB", "Tb"], ["Jaundice", "Jaundice"],
  ["Epilepsy", "Epilepsy"], ["Malaria", "Malaria"], ["Typhoid", "Typhoid"]
];

export const historyTakingSections = [
  {
    number: "3.3", title: "Past History (PH)", description: "Illnesses, admissions, procedures, trauma, transfusion, vaccination, and investigations",
    groups: [
      { title: "Major Illnesses", fields: majorIllnesses.flatMap(([label, key]) => [combo(`${label} — History`, `past${key}Status`, yesNo), text(`${label} — Year`, `past${key}Year`)]) },
      { title: "Hospitalisation, Surgery & Recurrence", fields: [
        text("Hospitalisation reason", "previousHospitalisationReason"), text("Hospital", "previousHospitalisationHospital"), text("Hospitalisation year", "previousHospitalisationYear"), text("Outcome", "previousHospitalisationOutcome"),
        text("Previous surgery / procedure", "previousSurgeryType"), text("Surgery year", "previousSurgeryYear"), text("Surgical complications", "previousSurgeryComplications"),
        text("Previous similar complaints", "previousSimilarComplaints"), text("Recurrence pattern", "recurrencePattern"), text("Accident / trauma / fracture", "traumaHistory")
      ] },
      { title: "Transfusion, Vaccination & Investigations", fields: [
        combo("Blood transfusion", "bloodTransfusionStatus", yesNo), text("Transfusion year", "bloodTransfusionYear"), text("Transfusion reaction", "bloodTransfusionReaction"),
        combo("Vaccination status", "vaccinationStatus", ["Complete", "Incomplete", "Unknown"]), text("COVID vaccination", "covidVaccination"), text("Flu vaccination", "fluVaccination"),
        text("Hepatitis B vaccination", "hepatitisBVaccination"), text("Other vaccinations", "otherVaccinations"),
        combo("Previous investigation type", "previousInvestigationTypes", ["ECG", "X-ray", "Ultrasound", "CT", "MRI", "Labs"]),
        text("Investigation findings / reference", "previousInvestigationDetails"), text("Uploaded-document reference", "previousInvestigationDocument", "Use Patient Record for PDF upload")
      ] }
    ]
  },
  {
    number: "3.4", title: "Medicinal / Drug History", description: "Current therapy, risk medicines, allergies, Ayurveda, and adherence", medicationRows: true,
    groups: [{ fields: [
      combo("Overall medicine system", "medicineSystem", ["Allopathic", "Ayurvedic", "Homeopathic", "Self-prescribed", "OTC", "Mixed"]),
      combo("Steroid use", "steroidUse", ["Never", "Current", "Past"]), text("Steroid duration", "steroidDuration"), combo("Anticoagulant / antiplatelet", "anticoagulantUse", yesNo),
      combo("NSAID use", "nsaidUse", ["None", "Regular", "Occasional"]), text("Drug allergy name", "drugAllergyName"),
      combo("Drug-allergy reaction", "drugAllergyReaction", ["Rash", "Anaphylaxis", "GI", "Other"]), readonly("Automatic allergy alert", "drugInteractionFlag"),
      combo("Drug-interaction screening", "drugInteractionStatus", ["No known interaction", "Potential interaction — review", "Not checked"]), text("Drug-interaction notes", "drugInteractionNotes"),
      combo("Previous Ayurvedic treatment", "previousAyurvedicType", ["None", "Panchakarma", "Rasayana", "Herbal"]), text("Ayurvedic treatment details", "previousAyurvedicDetails"),
      combo("Compliance", "medicationCompliance", ["Good", "Irregular", "Non-compliant"]), combo("Self-medication / quack treatment", "selfMedication", yesNo)
    ] }]
  },
  {
    number: "3.5", title: "Family History (FH)", description: "Parents, siblings, children, hereditary risk, and mental-health history",
    groups: [{ fields: [
      combo("Mother status", "parentMotherStatus", ["Alive", "Deceased"]), text("Mother illnesses / cause", "parentMotherIllnesses"),
      combo("Father status", "parentFatherStatus", ["Alive", "Deceased"]), text("Father illnesses / cause", "parentFatherIllnesses"),
      number("Number of siblings", "siblingCount", 0, 30), text("Sibling illnesses", "siblingIllnesses"), number("Number of children", "childrenCount", 0, 30), text("Children illnesses", "childrenIllnesses"),
      combo("Hereditary conditions", "hereditaryConditions", ["DM", "HTN", "CAD", "Cancer", "Epilepsy", "Thyroid", "Asthma", "TB", "Psoriasis", "Thalassaemia", "Haemophilia"]),
      combo("Consanguinity", "consanguinity", yesNo), text("Ayurvedic family Prakriti pattern", "familyPrakritiPattern"), text("Family mental-health history", "familyMentalHealth"), text("Other family illnesses", "familyOtherIllnesses")
    ] }]
  },
  {
    number: "3.6", title: "Personal History (PerH)", description: "Diet, elimination, sleep, habits, activity, occupation, socioeconomic, marital, and sexual history",
    groups: [
      { title: "Diet", fields: [
        combo("Diet", "dietType", ["Vegetarian", "Non-Vegetarian", "Vegan", "Mixed"]), combo("Appetite", "appetite", ["Normal", "Increased", "Decreased", "Anorexia"]),
        combo("Food timings", "foodTiming", ["Regular", "Irregular"]), text("Water intake", "waterIntake", "Litres/day"), text("Junk / processed food", "junkFoodIntake"),
        combo("Salt intake", "saltIntake", ["Normal", "High", "Low"]), text("Milk / dairy intake", "dairyIntake")
      ] },
      { title: "Bowel & Bladder", fields: [
        text("Bowel frequency", "bowelFrequency"), combo("Bristol stool scale", "bowelConsistency", ["Type 1", "Type 2", "Type 3", "Type 4", "Type 5", "Type 6", "Type 7"]),
        combo("Blood in stool", "bowelBlood", presentAbsent), combo("Mucus", "bowelMucus", presentAbsent), combo("Straining", "bowelStraining", presentAbsent), combo("Bowel incontinence", "bowelIncontinence", presentAbsent),
        text("Bladder frequency", "bladderFrequency"), combo("Nocturia", "bladderNocturia", presentAbsent), combo("Urgency", "bladderUrgency", presentAbsent),
        combo("Urinary incontinence", "bladderIncontinence", presentAbsent), combo("Haematuria", "bladderHaematuria", presentAbsent), combo("Burning micturition", "bladderBurning", presentAbsent),
        text("Urine colour", "urineColour"), text("Urine odour", "urineOdour")
      ] },
      { title: "Sleep & Habits", fields: [
        text("Sleep hours / night", "sleepHours"), combo("Day sleep", "sleepDay", yesNo), combo("Sleep disorder", "sleepDisorder", ["None", "Insomnia", "Hypersomnia"]),
        combo("Sleep quality", "sleepQuality", ["Refreshing", "Non-refreshing", "Snoring", "Apnoeic episodes"]), combo("Dream pattern", "dreamPattern", ["Disturbing", "Pleasant", "None recalled"]),
        combo("Tobacco type", "tobaccoType", ["None", "Cigarettes", "Bidis", "Chewing pan/gutka", "Snuff"]), text("Tobacco quantity / day", "tobaccoQuantity"), text("Pack-years", "tobaccoPackYears"),
        text("Alcohol frequency", "alcoholFrequency"), text("Alcohol type", "alcoholType"), text("Alcohol quantity", "alcoholQuantity"), text("Alcohol duration", "alcoholDuration"),
        combo("Other substances", "otherSubstances", ["None", "Cannabis", "Other"]), text("Caffeine cups/day", "caffeineCups"), text("Addiction history", "addictionHistory")
      ] },
      { title: "Activity, Occupation & Socioeconomic", fields: [
        combo("Physical activity", "physicalActivity", ["Sedentary", "Light", "Moderate", "Heavy"]), text("Exercise type", "exerciseType"), text("Exercise duration", "exerciseDuration"), text("Exercise frequency", "exerciseFrequency"),
        combo("Yoga / Pranayama", "yogaPractice", yesNo), text("Yoga duration", "yogaDuration"), text("Nature of work", "occupationNature"), combo("Work demand", "workDemand", ["Physical", "Mental", "Mixed"]),
        text("Work hours", "workHours"), combo("Work stress", "workStress", ["Low", "Moderate", "High"]), combo("Income category", "incomeCategory", ["BPL", "APL"]),
        combo("Housing", "housingType", ["Kutcha", "Pakka", "Slum", "Rural", "Urban"]), combo("Water source", "waterSource", ["Safe", "Unsafe"]), combo("Sanitation", "sanitation", ["Open defecation", "Toilet"])
      ] },
      { title: "Marital & Sexual History", fields: [
        text("Age at marriage", "marriageAge"), combo("Relationship stability", "relationshipStability", ["Stable", "Unstable", "Separated", "Not applicable"]),
        text("Sexual dysfunction (if volunteered)", "sexualDysfunction"), text("STI history (if relevant)", "stiHistory")
      ] }
    ]
  },
  {
    number: "3.7", title: "Obstetric & Gynaecological History", description: "Menstrual history, GPAL, pregnancies, contraception, and Ayurvedic additions",
    groups: [
      { title: "Menstrual History", fields: [
        date("LMP", "menstrualLmp"), date("Previous LMP", "menstrualPreviousLmp"), text("Age at menarche", "menarcheAge"),
        combo("Cycle", "menstrualCycle", ["Regular", "Irregular"]), text("Cycle frequency", "menstrualFrequency", "Days"), text("Flow duration", "menstrualFlowDuration", "Days"),
        combo("Flow amount", "menstrualFlowAmount", ["Scanty", "Normal", "Heavy"]), text("Pads/day", "menstrualPadsPerDay"),
        combo("Dysmenorrhoea", "dysmenorrhoea", ["Absent", "Primary", "Secondary"]), combo("Intermenstrual bleeding", "intermenstrualBleeding", presentAbsent),
        combo("Post-coital bleeding", "postCoitalBleeding", presentAbsent), combo("Premenstrual symptoms", "premenstrualSymptoms", ["None", "PMS", "PMDD"]),
        combo("Menopausal status", "menopausalStatus", ["Pre", "Peri", "Post"]), text("Age at menopause", "menopauseAge"),
        combo("Hot flashes", "hotFlashes", presentAbsent), combo("Night sweats", "nightSweats", presentAbsent), combo("Vaginal dryness", "vaginalDryness", presentAbsent)
      ] },
      { title: "Obstetric History — GPAL", fields: [
        number("Gravida (G)", "obstetricGravida", 0, 30), number("Para (P)", "obstetricPara", 0, 30), number("Abortus (A)", "obstetricAbortus", 0, 30), number("Living children (L)", "obstetricLiving", 0, 30),
        text("Pregnancy history", "pregnancyHistory", "Year / NVD or LSCS / birth weight / complications"), text("Stillbirths", "stillbirths"), text("Neonatal deaths", "neonatalDeaths"),
        combo("Ectopic pregnancy", "ectopicPregnancy", yesNo), combo("Hydatidiform mole", "hydatidiformMole", yesNo), combo("Current pregnancy", "currentPregnancy", yesNo), date("EDD", "edd"),
        text("Contraception method", "contraceptionMethod"), text("Contraception duration", "contraceptionDuration")
      ] },
      { title: "Ayurvedic Gynaecological Additions", fields: [
        combo("Artava Prakriti", "artavaPrakriti", ["Shukla", "Rakta", "Peeta", "Krishna", "Kapila", "Visra"]), combo("Yoni Prakriti", "yoniPrakriti", ["Vataja", "Pittaja", "Kaphaja", "Sannipataja"]),
        combo("Garbhashaya status", "garbhashayaStatus", ["Suddha", "Dushta"]), text("Pradara colour", "pradaraColour"), text("Pradara consistency", "pradaraConsistency"), text("Pradara smell", "pradaraSmell"),
        text("Kshara / Kashtartava Nidana", "kashtartavaNidana")
      ] }
    ]
  },
  {
    number: "3.8", title: "Paediatric History", description: "Complete only when the patient is a child",
    groups: [{ fields: [
      combo("Birth term", "birthTerm", ["Term", "Preterm", "Post-term"]), combo("Delivery mode", "birthDeliveryMode", ["NVD", "LSCS"]), text("NICU stay", "birthNicuStay"),
      text("Antenatal maternal health", "antenatalMaternalHealth"), text("Antenatal medications", "antenatalMedications"), text("Antenatal infections", "antenatalInfections"),
      text("Birth weight", "neonatalBirthWeight"), text("Cry at birth", "neonatalCry"), text("APGAR", "neonatalApgar"), combo("Neonatal jaundice", "neonatalJaundice", yesNo), text("Neonatal feeding", "neonatalFeeding"),
      text("Motor milestones", "developmentMotor"), text("Language milestones", "developmentLanguage"), text("Social milestones", "developmentSocial"), text("Cognitive milestones", "developmentCognitive"),
      text("Immunisation / EPI chart", "immunisationChart"), text("Breastfeeding duration", "breastfeedingDuration"), text("Weaning details", "weaningDetails"), text("Paediatric nutritional status", "paediatricNutritionalStatus")
    ] }]
  },
  {
    number: "3.9", title: "Psychiatric / Mental Health History", description: "Previous illness, stress, risk screening, mood, and Manasika Prakriti",
    groups: [{ fields: [
      combo("Previous psychiatric illness", "psychiatricIllness", ["None", "Depression", "Anxiety", "Psychosis", "OCD", "PTSD", "Bipolar"]),
      text("Psychiatric hospitalisation", "psychiatricHospitalisation"), text("Substance abuse context", "mentalSubstanceAbuse"),
      text("Home stress", "currentStressHome"), text("Work stress", "currentStressWork"), text("Financial stress", "currentStressFinancial"),
      combo("Suicidal ideation screened", "suicidalIdeation", ["No ideation", "Passive ideation", "Active ideation", "Not screened"]), combo("Screening tool", "screeningTool", ["PHQ-9", "DASS-21", "Clinical interview", "Not used"]),
      text("Sleep–mood correlation", "sleepMoodCorrelation"), combo("Manasika Prakriti", "manasikaPrakriti", ["Sattvika", "Rajasika", "Tamasika"])
    ] }]
  },
  {
    number: "3.10", title: "Dietary History — Ayurvedic + Modern", description: "Diet recall, eating habits, compatibility, season, tastes, and qualities",
    groups: [{ fields: [
      text("24-hour dietary recall", "dietaryRecall24Hour"), text("Ahara Vidhi — Time", "aharaTime"), text("Ahara Vidhi — Place", "aharaPlace"), text("Ahara Vidhi — Company", "aharaCompany"),
      combo("Eating speed", "aharaSpeed", ["Slow", "Moderate", "Fast"]), combo("Viruddha Ahara", "viruddhaAhara", ["No", "Milk + Fish", "Fruit with meals", "Heated honey", "Other"]),
      text("Seasonal diet appropriateness", "seasonalDiet"), text("Dominant tastes consumed", "tridoshaDietTastes"), combo("Guru / Laghu predominance", "heavyLightFoods", ["Guru (Heavy)", "Laghu (Light)", "Balanced"]),
      combo("Ushna / Sheeta predominance", "ushnaSheetaFoods", ["Ushna", "Sheeta", "Balanced"]), combo("Snigdha / Rooksha predominance", "snigdhaRookshaFoods", ["Snigdha", "Rooksha", "Balanced"])
    ] }]
  },
  {
    number: "3.11", title: "Travel History", description: "Recent travel, endemic exposure, and risk assessment",
    groups: [{ fields: [
      combo("Recent travel within 6 months", "recentTravel", yesNo), text("Countries / states visited", "travelCountriesStates"),
      combo("Malaria-endemic exposure", "malariaExposure", yesNo), combo("HIV-prevalent-zone exposure", "hivZoneExposure", yesNo), text("Exposure risk assessment", "travelExposureRisk")
    ] }]
  }
];

const fieldNames = historyTakingSections.flatMap((section) => section.groups.flatMap((group) => group.fields.map((field) => field.name)));

export function createInitialHistoryTaking() {
  return { historyDate: "", ...Object.fromEntries(fieldNames.map((name) => [name, ""])), complaints: [{ ...emptyComplaint }], currentMedications: [{ ...emptyCurrentMedication }], historyNotes: "" };
}

export function normalizeHistoryTaking(form = {}) {
  const base = createInitialHistoryTaking();
  const complaints = Array.isArray(form.complaints) && form.complaints.length ? form.complaints.slice(0, 10).map((row) => ({ ...emptyComplaint, ...row })) : base.complaints;
  const currentMedications = Array.isArray(form.currentMedications) && form.currentMedications.length ? form.currentMedications.slice(0, 20).map((row) => ({ ...emptyCurrentMedication, ...row })) : base.currentMedications;
  const allergy = String(form.drugAllergyName || "").trim().toLowerCase();
  const allergyConflict = allergy && currentMedications.some((medicine) => {
    const name = String(medicine.name || "").trim().toLowerCase();
    return name && (name.includes(allergy) || allergy.includes(name));
  });
  return { ...base, ...form, complaints, currentMedications, drugInteractionFlag: allergyConflict ? "Possible documented drug-allergy conflict — review required" : "" };
}

function RepeatRows({ rows, fields, idPrefix, title, limit, emptyRow, onRowsChange }) {
  const update = (index, name, value) => onRowsChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [name]: value } : row));
  return (
    <div className="history-repeat-list">
      {rows.map((row, index) => (
        <details className="history-repeat-card" open={index === 0} key={`${idPrefix}-${index}`}>
          <summary><strong>{title} {index + 1}</strong><span>{row.complaint || row.name || "Optional entry"}</span></summary>
          <div className="history-repeat-body">
            <div className="general-exam-grid">
              {fields.map((field) => <ExaminationField key={field.name} field={field} value={row[field.name]} onValueChange={(name, value) => update(index, name, value)} idPrefix={`${idPrefix}-${index}`} />)}
            </div>
            {rows.length > 1 ? <Button variant="secondary" onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))}>Remove {title.toLowerCase()}</Button> : null}
          </div>
        </details>
      ))}
      {rows.length < limit ? <Button variant="secondary" onClick={() => onRowsChange([...rows, { ...emptyRow }])}>Add {title.toLowerCase()}</Button> : null}
    </div>
  );
}

export const HistoryTakingForm = memo(function HistoryTakingForm({ form, onFieldChange }) {
  return (
    <div className="general-exam-form history-taking-form">
      <div className="general-exam-intro">
        <div><strong>Structured clinical history taking</strong><p>All fields are optional. Relevant findings automatically flow into the OPD prescription.</p></div>
        <div className="field general-exam-field"><label htmlFor="history-taking-date">History date</label><input id="history-taking-date" type="date" value={form.historyDate || ""} onChange={(event) => onFieldChange("historyDate", event.target.value)} /></div>
      </div>

      <details className="general-exam-section" open>
        <summary><span className="general-exam-section-number">3.1</span><span><strong>Chief Complaints & HPI</strong><small>Up to 10 complaints with duration, priority, and complete SOCRATES history</small></span></summary>
        <div className="general-exam-section-body">
          <RepeatRows rows={form.complaints} fields={complaintFields} idPrefix="history-complaint" title="Complaint" limit={10} emptyRow={emptyComplaint} onRowsChange={(rows) => onFieldChange("complaints", rows)} />
        </div>
      </details>

      {historyTakingSections.map((section) => (
        <details className="general-exam-section" key={section.number}>
          <summary><span className="general-exam-section-number">{section.number}</span><span><strong>{section.title}</strong><small>{section.description}</small></span></summary>
          <div className="general-exam-section-body">
            {section.medicationRows ? <><h4>Current Medications</h4><RepeatRows rows={form.currentMedications} fields={medicationFields} idPrefix="history-medication" title="Medication" limit={20} emptyRow={emptyCurrentMedication} onRowsChange={(rows) => onFieldChange("currentMedications", rows)} /></> : null}
            {section.groups.map((group, groupIndex) => (
              <div key={`${section.number}-${group.title || groupIndex}`}>{group.title ? <h4>{group.title}</h4> : null}<div className="general-exam-grid">{group.fields.map((field) => <ExaminationField key={field.name} field={field} value={form[field.name]} onValueChange={onFieldChange} idPrefix="history-taking" />)}</div></div>
            ))}
          </div>
        </details>
      ))}

      <div className="field general-exam-notes"><label htmlFor="history-taking-notes">Additional history notes</label><textarea id="history-taking-notes" value={form.historyNotes || ""} onChange={(event) => onFieldChange("historyNotes", event.target.value)} /></div>
    </div>
  );
});
