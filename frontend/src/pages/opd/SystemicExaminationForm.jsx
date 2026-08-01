import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

const presentAbsent = ["Present", "Absent"];
const normalAbnormal = ["Normal", "Abnormal"];
const normalReducedAbsent = ["Normal", "Reduced", "Absent"];
const reflexGrades = ["0", "1+", "2+", "3+", "4+"];
const yesNo = ["Yes", "No"];

const text = (label, name, placeholder = "") => ({ label, name, placeholder });
const combo = (label, name, options, placeholder = "Type or select") => ({ label, name, options, placeholder });
const number = (label, name, min, max) => ({ label, name, type: "number", min, max });
const readonly = (label, name) => ({ label, name, readOnly: true });

export const systemicExaminationSections = [
  {
    number: "2.1",
    title: "Cardiovascular System (CVS)",
    description: "Precordium, heart sounds, murmurs, JVP, pulses, and perfusion",
    groups: [
      { title: "Precordium & Apex Beat", fields: [
        combo("Precordium shape", "precordiumShape", ["Normal", "Bulging", "Flat"]),
        combo("Apex beat location", "apexBeatLocation", ["Normal 5th ICS MCL", "Displaced"]),
        combo("Apex beat character", "apexBeatCharacter", ["Normal", "Heaving", "Thrusting", "Tapping"])
      ] },
      { title: "Heart Sounds & Murmurs", fields: [
        combo("S1", "heartSoundS1", ["Normal", "Muffled", "Split", "Loud", "Absent"]),
        combo("S2", "heartSoundS2", ["Normal", "Muffled", "Split", "Loud", "Absent"]),
        combo("Additional heart sounds", "additionalHeartSounds", ["Absent", "S3", "S4", "S3 and S4"]),
        combo("Murmur timing", "murmurTiming", ["Absent", "Systolic", "Diastolic", "Continuous"]),
        text("Murmur site", "murmurSite"), text("Murmur radiation", "murmurRadiation"),
        combo("Murmur grade", "murmurGrade", ["I/VI", "II/VI", "III/VI", "IV/VI", "V/VI", "VI/VI"])
      ] },
      { title: "JVP, Peripheral Pulses & Perfusion", fields: [
        combo("JVP", "jvpStatus", ["Normal", "Raised"]), text("JVP waveform", "jvpWaveform"),
        combo("Radial pulse", "pulseRadial", normalReducedAbsent), combo("Brachial pulse", "pulseBrachial", normalReducedAbsent),
        combo("Carotid pulse", "pulseCarotid", normalReducedAbsent), combo("Femoral pulse", "pulseFemoral", normalReducedAbsent),
        combo("Popliteal pulse", "pulsePopliteal", normalReducedAbsent), combo("Posterior tibial pulse", "pulsePosteriorTibial", normalReducedAbsent),
        combo("Dorsalis pedis pulse", "pulseDorsalisPedis", normalReducedAbsent),
        combo("Capillary refill time", "capillaryRefillTime", ["< 2 sec", "> 2 sec"])
      ] }
    ]
  },
  {
    number: "2.2", title: "Respiratory System (RS)", description: "Inspection, percussion, air entry, breath sounds, and resonance",
    groups: [{ fields: [
      combo("Chest shape", "chestShape", ["Normal", "Barrel", "Pigeon", "Funnel", "Kyphoscoliosis"]),
      combo("Chest movement", "chestMovement", ["Bilateral Equal", "Unequal", "Restricted"]), text("Restricted / unequal side", "chestMovementSide"),
      combo("Trachea", "tracheaPosition", ["Central", "Deviated"]), text("Tracheal deviation side", "tracheaDeviationSide"),
      combo("Percussion note", "percussionNote", ["Resonant", "Hyper-resonant", "Dull", "Stony Dull"]), text("Percussion area mapped", "percussionArea"),
      combo("Air entry", "airEntry", ["Normal", "Reduced", "Absent"]), combo("Air-entry distribution", "airEntryDistribution", ["Bilateral", "Unilateral"]),
      combo("Breath sounds", "breathSounds", ["Vesicular", "Bronchial", "Bronchovesicular"]),
      combo("Added sounds", "addedSounds", ["Absent", "Crepitations", "Rhonchi", "Pleural Rub", "Stridor", "Wheeze"]),
      combo("Crepitations", "crepitationsType", ["Absent", "Fine", "Coarse"]),
      combo("Vocal resonance", "vocalResonance", ["Normal", "Increased", "Decreased", "Absent"]),
      combo("Tactile fremitus", "tactileFremitus", ["Normal", "Increased", "Decreased", "Absent"])
    ] }]
  },
  {
    number: "2.3", title: "Gastrointestinal System (GIT) / Abdomen", description: "Inspection, palpation, organomegaly, ascites, and bowel findings",
    groups: [
      { title: "Inspection", fields: [
        combo("Abdominal shape", "abdomenShape", ["Flat", "Scaphoid", "Distended", "Pendulous", "Globular"]),
        combo("Umbilicus", "umbilicus", ["Central", "Deviated", "Inverted", "Everted"]), text("Umbilical discharge", "umbilicalDischarge"),
        combo("Visible peristalsis", "visiblePeristalsis", presentAbsent), combo("Dilated veins", "dilatedVeins", presentAbsent),
        combo("Dilated-vein pattern", "dilatedVeinPattern", ["Caput Medusae", "IVC pattern", "Other"])
      ] },
      { title: "Tenderness & Organomegaly", fields: [
        text("Tenderness location", "tendernessLocation"), combo("Guarding", "guarding", presentAbsent), combo("Rigidity", "rigidity", presentAbsent),
        combo("Rebound tenderness", "reboundTenderness", presentAbsent), text("Liver span", "liverSpan", "cm"),
        combo("Liver texture", "liverTexture", ["Normal", "Soft", "Firm", "Hard"]), combo("Liver tenderness", "liverTenderness", presentAbsent),
        combo("Liver surface", "liverSurface", ["Smooth", "Nodular", "Irregular"]), combo("Liver edge", "liverEdge", ["Sharp", "Rounded", "Irregular"]),
        combo("Spleen size", "spleenGrade", ["Not palpable", "Grade I", "Grade II", "Grade III", "Grade IV"]),
        combo("Kidneys ballotable", "kidneysBallotable", ["No", "Right", "Left", "Bilateral"])
      ] },
      { title: "Ascites, Bowel & Other", fields: [
        combo("Fluid thrill", "ascitesFluidThrill", presentAbsent), combo("Shifting dullness", "ascitesShiftingDullness", presentAbsent),
        combo("Puddle sign", "ascitesPuddleSign", presentAbsent), combo("Bowel sounds", "bowelSounds", ["Normal", "Hyperactive", "Hypoactive", "Absent"]),
        combo("Hernia orifices checked", "herniaOrifices", ["Inguinal", "Femoral", "Umbilical", "All checked", "Not checked"]),
        text("DRE findings (if indicated)", "dreFindings")
      ] }
    ]
  },
  {
    number: "2.4", title: "Central Nervous System (CNS)", description: "Mental functions, cranial nerves, motor, sensory, and reflex examination",
    groups: [
      { title: "Higher Mental Functions", fields: [
        combo("Consciousness", "cnsConsciousness", ["Alert", "Drowsy", "Stuporous", "Semiconscious", "Unconscious"]),
        number("GCS — Eye (E)", "gcsEye", 1, 4), number("GCS — Verbal (V)", "gcsVerbal", 1, 5), number("GCS — Motor (M)", "gcsMotor", 1, 6),
        readonly("GCS total", "gcsTotal"), combo("Orientation (TPP)", "cnsOrientation", ["Intact", "Impaired", "Partially oriented"]),
        combo("Immediate memory", "memoryImmediate", normalAbnormal), combo("Recent memory", "memoryRecent", normalAbnormal),
        combo("Remote memory", "memoryRemote", normalAbnormal), combo("Intelligence", "intelligence", normalAbnormal),
        combo("Judgement", "judgement", normalAbnormal), text("Behaviour", "behaviour"), text("Mood", "mood")
      ] },
      { title: "Cranial Nerves (I–XII)", fields: [
        text("CN I — Olfactory", "cn1Olfactory", "Smell tested bilaterally"), text("CN II — Optic", "cn2Optic", "Visual acuity / fields / fundoscopy"),
        text("CN III, IV, VI — Ocular", "cn346Ocular", "EOM / ptosis / nystagmus / diplopia"),
        text("CN V — Trigeminal", "cn5Trigeminal", "Sensation / corneal reflex / jaw"), text("CN VII — Facial", "cn7Facial", "Motor / sensory / taste"),
        text("CN VIII — Vestibulocochlear", "cn8Vestibulocochlear", "Hearing / Rinne / Weber"),
        text("CN IX, X — Glossopharyngeal / Vagus", "cn910GlossopharyngealVagus", "Gag / palate / voice"),
        text("CN XI — Accessory", "cn11Accessory", "SCM / trapezius"), text("CN XII — Hypoglossal", "cn12Hypoglossal", "Tongue movement / deviation / wasting")
      ] },
      { title: "Motor & Sensory Systems", fields: [
        text("Muscle bulk", "muscleBulk"), text("Muscle tone", "muscleTone"), combo("Muscle power (MRC)", "musclePower", ["0/5", "1/5", "2/5", "3/5", "4/5", "5/5"]),
        text("Coordination", "coordination"), combo("Involuntary movements", "involuntaryMovements", ["Absent", "Tremors", "Chorea", "Athetosis", "Tics"]),
        combo("Pain sensation", "sensoryPain", normalAbnormal), combo("Temperature sensation", "sensoryTemperature", normalAbnormal),
        combo("Light touch", "sensoryLightTouch", normalAbnormal), combo("Vibration", "sensoryVibration", normalAbnormal),
        combo("Proprioception", "sensoryProprioception", normalAbnormal), text("Dermatomal mapping", "dermatomalMapping", "If clinically relevant")
      ] },
      { title: "Reflexes & Meningeal Signs", fields: [
        combo("Biceps reflex", "reflexBiceps", reflexGrades), combo("Triceps reflex", "reflexTriceps", reflexGrades),
        combo("Supinator reflex", "reflexSupinator", reflexGrades), combo("Knee reflex", "reflexKnee", reflexGrades), combo("Ankle reflex", "reflexAnkle", reflexGrades),
        combo("Plantar response", "plantarResponse", ["Flexor", "Extensor (Babinski)"]), combo("Abdominal reflex", "abdominalReflex", presentAbsent),
        combo("Cremasteric reflex", "cremastericReflex", presentAbsent), combo("Neck stiffness", "neckStiffness", presentAbsent),
        combo("Kernig sign", "kernigSign", presentAbsent), combo("Brudzinski sign", "brudzinskiSign", presentAbsent)
      ] }
    ]
  },
  {
    number: "2.5", title: "Musculoskeletal System (MSK)", description: "Joint, spine, muscle, movement, and special-test findings",
    groups: [
      { title: "Joints", fields: [
        text("Joint examined 1", "jointExamined1"), text("Joint examined 2", "jointExamined2"), text("Joint examined 3", "jointExamined3"), text("Joint examined 4", "jointExamined4"),
        text("Inspection", "jointInspection"), text("Palpation", "jointPalpation"), text("ROM — Active", "activeRom"), text("ROM — Passive", "passiveRom"),
        text("Joint special tests", "jointSpecialTests")
      ] },
      { title: "Spine & Muscles", fields: [
        text("Cervical spine", "cervicalSpine"), text("Thoracic spine", "thoracicSpine"), text("Lumbar spine", "lumbarSpine"),
        text("Spinal movements", "spineMovements"), text("Spinal tenderness", "spineTenderness"), combo("SLRT", "slrt", ["Negative", "Positive"]),
        combo("FNST", "fnst", ["Negative", "Positive"]), combo("Muscle wasting", "muscleWasting", presentAbsent), text("Weakness pattern", "weaknessPattern"),
        combo("Applicable special tests", "mskSpecialTests", ["McMurray", "Lachman", "Drawer", "Apley", "FABER", "FADIR", "Neer", "Hawkins"])
      ] }
    ]
  },
  {
    number: "2.6", title: "Genitourinary System", description: "Renal angles, bladder, urethral, and sex-specific examination",
    groups: [{ fields: [
      combo("Right renal-angle tenderness", "renalAngleRight", presentAbsent), combo("Left renal-angle tenderness", "renalAngleLeft", presentAbsent),
      combo("Bladder", "bladderStatus", ["Palpable", "Not Palpable"]), text("Per-urethral discharge", "urethralDischarge"),
      text("Male — Testes", "maleTestes"), text("Male — Epididymis", "maleEpididymis"), combo("Male — Varicocele", "maleVaricocele", presentAbsent),
      combo("Male — Hydrocele", "maleHydrocele", presentAbsent), combo("Gynaecology referral", "gynaecologyReferral", ["Not indicated", "Advised", "Completed"]),
      text("Additional GU findings", "genitourinaryNotes")
    ] }]
  },
  {
    number: "2.7", title: "Endocrine System", description: "Thyroid, diabetes, adrenal signs, and sexual maturation",
    groups: [{ fields: [
      combo("Thyroid goitre", "thyroidGoitre", presentAbsent), text("Thyroid size", "thyroidSize"),
      combo("Thyroid consistency", "thyroidConsistency", ["Soft", "Firm", "Hard"]), combo("Thyroid nodularity", "thyroidNodularity", ["Absent", "Solitary", "Multinodular"]),
      combo("Thyroid bruit", "thyroidBruit", presentAbsent), text("Signs of hypothyroidism", "hypothyroidSigns"), text("Signs of hyperthyroidism", "hyperthyroidSigns"),
      combo("Acanthosis", "acanthosis", presentAbsent), text("Diabetic foot examination", "diabeticFootExam"),
      combo("Cushing — Moon face", "cushingMoonFace", presentAbsent), combo("Cushing — Buffalo hump", "cushingBuffaloHump", presentAbsent),
      combo("Cushing — Striae", "cushingStriae", presentAbsent), combo("Addison — Pigmentation", "addisonPigmentation", presentAbsent),
      combo("Addison — Hypotension", "addisonHypotension", presentAbsent), combo("Tanner stage (paediatric)", "tannerStage", ["Stage I", "Stage II", "Stage III", "Stage IV", "Stage V", "Not applicable"])
    ] }]
  },
  {
    number: "2.8", title: "Eye & ENT Examination (Modern)", description: "Eye, ear, nose, sinus, throat, and laryngeal findings",
    groups: [
      { title: "Eye", fields: [
        text("Visual acuity (Snellen)", "eyeVisualAcuity"), text("IOP", "eyeIop"), text("Fundoscopy", "eyeFundoscopy"), text("Slit-lamp findings", "eyeSlitLamp", "If available")
      ] },
      { title: "Ear", fields: [
        text("External canal", "earExternalCanal"), combo("TM integrity", "earTmIntegrity", ["Intact", "Perforated", "Not visualised"]),
        text("Hearing", "earHearing"), combo("Whisper test", "earWhisperTest", ["Normal", "Reduced", "Not tested"]),
        combo("Rinne test", "earRinne", ["Positive", "Negative", "Not tested"]), combo("Weber test", "earWeber", ["Central", "Lateralised right", "Lateralised left", "Not tested"]),
        text("Ear discharge", "earDischarge")
      ] },
      { title: "Nose, Sinuses & Throat", fields: [
        text("Nasal septum", "noseSeptum"), text("Turbinates", "noseTurbinates"), combo("Nasal polyp", "nosePolyp", presentAbsent), text("Nasal discharge", "noseDischarge"),
        combo("Sinus transillumination", "sinusTransillumination", ["Normal", "Reduced", "Not performed"]), text("Tonsils", "entTonsils"), text("Adenoids", "entAdenoids"),
        text("Posterior pharyngeal wall", "posteriorPharyngealWall"), text("Laryngoscopy", "laryngoscopy", "If indicated")
      ] }
    ]
  }
];

const fieldNames = systemicExaminationSections.flatMap((section) => section.groups.flatMap((group) => group.fields.map((field) => field.name)));

export const initialSystemicExamination = Object.freeze({
  examDate: "",
  ...Object.fromEntries(fieldNames.map((name) => [name, ""])),
  systemicNotes: ""
});

export function calculateSystemicExamination(form) {
  const parts = [form.gcsEye, form.gcsVerbal, form.gcsMotor].map(Number);
  const gcsTotal = parts.every((value) => Number.isFinite(value) && value > 0)
    ? String(parts.reduce((sum, value) => sum + value, 0))
    : "";
  return { ...form, gcsTotal };
}

export const ExaminationField = memo(function ExaminationField({ field, value, onValueChange, idPrefix = "systemic-exam" }) {
  const reactId = useId();
  const listId = `${idPrefix}-${field.name}-${reactId.replace(/:/g, "")}-options`;
  const blurTimer = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = String(value ?? "").trim().toLowerCase();
  const filteredOptions = useMemo(
    () => field.options ? (query ? field.options.filter((option) => option.toLowerCase().includes(query)) : field.options).slice(0, 10) : [],
    [field.options, query]
  );

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const selectOption = (option) => {
    onValueChange(field.name, option);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (!field.options) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => event.key === "ArrowDown"
        ? Math.min(current + 1, Math.max(filteredOptions.length - 1, 0))
        : Math.max(current - 1, 0));
    } else if ((event.key === "Enter" || event.key === "Tab") && isOpen && filteredOptions[activeIndex]) {
      if (event.key === "Enter") event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="field general-exam-field">
      <label htmlFor={`${idPrefix}-${field.name}`}>{field.label}</label>
      <div className={field.options ? "general-exam-combobox" : undefined}>
        <input
          id={`${idPrefix}-${field.name}`}
          name={field.name}
          type={field.type || "text"}
          min={field.min}
          max={field.max}
          value={value ?? ""}
          readOnly={field.readOnly}
          placeholder={field.placeholder || ""}
          autoComplete="off"
          onChange={(event) => {
            onValueChange(field.name, event.target.value);
            if (field.options) {
              setIsOpen(true);
              setActiveIndex(0);
            }
          }}
          onFocus={() => {
            if (!field.options) return;
            window.clearTimeout(blurTimer.current);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onBlur={() => {
            if (field.options) blurTimer.current = window.setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          role={field.options ? "combobox" : undefined}
          aria-autocomplete={field.options ? "list" : undefined}
          aria-expanded={field.options ? isOpen : undefined}
          aria-controls={field.options ? listId : undefined}
          aria-activedescendant={field.options && isOpen && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        />
        {field.options && isOpen ? (
          <div id={listId} className="general-exam-combobox-menu" role="listbox">
            {filteredOptions.map((option, index) => (
              <button
                id={`${listId}-${index}`}
                key={option}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`general-exam-combobox-option${index === activeIndex ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >{option}</button>
            ))}
            {!filteredOptions.length ? <div className="general-exam-combobox-empty">No suggestion. Your custom entry will be kept.</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export const SystemicExaminationForm = memo(function SystemicExaminationForm({ form, onFieldChange }) {
  return (
    <div className="general-exam-form systemic-exam-form">
      <div className="general-exam-intro">
        <div>
          <strong>Modern medicine systemic examination</strong>
          <p>All findings are optional. Search a suggestion or type any custom clinical finding.</p>
        </div>
        <div className="field general-exam-field">
          <label htmlFor="systemic-exam-examDate">Examination date</label>
          <input id="systemic-exam-examDate" type="date" value={form.examDate || ""} onChange={(event) => onFieldChange("examDate", event.target.value)} />
        </div>
      </div>

      {systemicExaminationSections.map((section, sectionIndex) => (
        <details className="general-exam-section" open={sectionIndex === 0} key={section.number}>
          <summary>
            <span className="general-exam-section-number">{section.number}</span>
            <span><strong>{section.title}</strong><small>{section.description}</small></span>
          </summary>
          <div className="general-exam-section-body">
            {section.groups.map((group, groupIndex) => (
              <div className="systemic-exam-group" key={`${section.number}-${group.title || groupIndex}`}>
                {group.title ? <h4>{group.title}</h4> : null}
                <div className="general-exam-grid">
                  {group.fields.map((field) => <ExaminationField key={field.name} field={field} value={form[field.name]} onValueChange={onFieldChange} />)}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}

      <div className="field general-exam-notes">
        <label htmlFor="systemic-exam-notes">Additional systemic examination notes</label>
        <textarea id="systemic-exam-notes" value={form.systemicNotes || ""} onChange={(event) => onFieldChange("systemicNotes", event.target.value)} placeholder="Enter any additional findings not captured above" />
      </div>
    </div>
  );
});
