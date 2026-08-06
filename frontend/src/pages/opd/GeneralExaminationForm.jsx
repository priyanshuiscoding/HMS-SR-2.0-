import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ayurvedaSections,
  prakrutiDoshaHeadings,
  prakrutiDoshas,
  prakrutiTraits
} from "./ayurvedaParikshanData.js";

function Field({ label, name, value, onChange, type = "text", placeholder = "", help = "", readOnly = false, step, min, max }) {
  return (
    <div className="field general-exam-field">
      <label htmlFor={`general-exam-${name}`}>{label}</label>
      <input
        id={`general-exam-${name}`}
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        step={step}
        min={min}
        max={max}
      />
      {help ? <small className="field-help">{help}</small> : null}
    </div>
  );
}

function TypeableField({ label, name, value, onChange, options, help = "", placeholder = "Type or select" }) {
  const reactId = useId();
  const listId = `general-exam-${name}-${reactId.replace(/:/g, "")}-options`;
  const blurTimer = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = String(value ?? "").trim().toLowerCase();
  const filteredOptions = useMemo(
    () => (query ? options.filter((option) => option.toLowerCase().includes(query)) : options).slice(0, 10),
    [options, query]
  );

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const emitValue = (nextValue) => {
    onChange({ target: { name, value: nextValue } });
  };

  const selectOption = (option) => {
    emitValue(option);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if ((event.key === "Enter" || event.key === "Tab") && isOpen && filteredOptions[activeIndex]) {
      if (event.key === "Enter") event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="field general-exam-field">
      <label htmlFor={`general-exam-${name}`}>{label}</label>
      <div className="general-exam-combobox">
        <input
          id={`general-exam-${name}`}
          name={name}
          value={value ?? ""}
          onChange={(event) => {
            emitValue(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={isOpen && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        />
        {isOpen ? (
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
              >
                {option}
              </button>
            ))}
            {!filteredOptions.length ? (
              <div className="general-exam-combobox-empty">No suggestion. Your custom entry will be kept.</div>
            ) : null}
          </div>
        ) : null}
      </div>
      {help ? <small className="field-help">{help}</small> : null}
    </div>
  );
}

// Ayurvedic parikshan findings are rarely single-valued, so this variant keeps a list
// of picks as chips while still allowing a term that is not in the printed sheet.
function MultiTypeableField({ label, name, values, onChange, options, help = "", placeholder = "Select or type" }) {
  const reactId = useId();
  const listId = `general-exam-${name}-${reactId.replace(/:/g, "")}-options`;
  const blurTimer = useRef(null);
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = Array.isArray(values) ? values : [];
  const query = draft.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      options
        .filter((option) => !selected.includes(option))
        .filter((option) => (query ? option.toLowerCase().includes(query) : true))
        .slice(0, 12),
    [options, query, selected]
  );

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const emitValues = (nextValues) => {
    onChange({ target: { name, value: nextValues } });
  };

  const addValue = (rawValue) => {
    const value = String(rawValue).trim();
    if (!value || selected.includes(value)) {
      setDraft("");
      return;
    }
    emitValues([...selected, value]);
    setDraft("");
    setActiveIndex(0);
  };

  const removeValue = (value) => {
    emitValues(selected.filter((item) => item !== value));
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      addValue(isOpen && filteredOptions[activeIndex] && !draft.trim() ? filteredOptions[activeIndex] : draft);
      return;
    }

    if (event.key === "Tab" && isOpen && filteredOptions[activeIndex] && !draft.trim()) {
      addValue(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === "Backspace" && !draft && selected.length) {
      event.preventDefault();
      removeValue(selected[selected.length - 1]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="field general-exam-field general-exam-multifield">
      <label htmlFor={`general-exam-${name}`}>{label}</label>
      <div className="general-exam-combobox">
        <div className="general-exam-chips">
          {selected.map((value) => (
            <span className="general-exam-chip" key={value}>
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => removeValue(value)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id={`general-exam-${name}`}
            name={name}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              window.clearTimeout(blurTimer.current);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => {
                if (draft.trim()) addValue(draft);
                setIsOpen(false);
              }, 140);
            }}
            onKeyDown={handleKeyDown}
            placeholder={selected.length ? "" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-activedescendant={isOpen && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          />
        </div>
        {isOpen ? (
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
                onClick={() => addValue(option)}
              >
                {option}
              </button>
            ))}
            {!filteredOptions.length ? (
              <div className="general-exam-combobox-empty">
                {draft.trim() ? "Press Enter to add your own entry." : "All listed options are already selected."}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {help ? <small className="field-help">{help}</small> : null}
    </div>
  );
}

function PrakrutiTable({ form, onChange }) {
  const counts = ["prakrutiVataCount", "prakrutiPittaCount", "prakrutiKaphaCount"];

  return (
    <div className="prakruti-block">
      <div className="table-shell prakruti-table-shell">
        <table className="prakruti-table">
          <thead>
            <tr>
              <th scope="col">Trait</th>
              {prakrutiDoshas.map((dosha) => (
                <th scope="col" key={dosha}>{prakrutiDoshaHeadings[dosha]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prakrutiTraits.map((trait) => (
              <tr key={trait.name}>
                <th scope="row">{trait.label}</th>
                {prakrutiDoshas.map((dosha) => {
                  const isSelected = form[trait.name] === dosha;
                  return (
                    <td key={dosha} className={isSelected ? "is-selected" : ""}>
                      <button
                        type="button"
                        className="prakruti-option"
                        aria-pressed={isSelected}
                        // Clicking the chosen cell again clears the trait.
                        onClick={() => onChange({ target: { name: trait.name, value: isSelected ? "" : dosha } })}
                      >
                        <ul>
                          {trait[dosha].map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="prakruti-summary">
        {prakrutiDoshas.map((dosha, index) => (
          <div className="prakruti-summary-item" key={dosha}>
            <span>{dosha}</span>
            <strong>{form[counts[index]] || "0"}</strong>
          </div>
        ))}
        <div className="prakruti-summary-item is-result">
          <span>Prakruti</span>
          <strong>{form.prakrutiDominant || "—"}</strong>
        </div>
      </div>
    </div>
  );
}

function ExamSection({ number, title, description, children, open = false }) {
  return (
    <details className="general-exam-section" open={open}>
      <summary>
        <span className="general-exam-section-number">{number}</span>
        <span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
      </summary>
      <div className="general-exam-section-body">{children}</div>
    </details>
  );
}

const yesNo = ["Present", "Absent"];

export function GeneralExaminationForm({ form, onChange }) {
  return (
    <div className="general-exam-form">
      <div className="general-exam-intro">
        <div>
          <strong>Modern medicine general examination</strong>
          <p>Use the suggestions or type a custom clinical finding. Measurements are saved against this patient and visit date.</p>
        </div>
        <Field label="Examination date" name="examDate" type="date" value={form.examDate} onChange={onChange} />
      </div>

      <ExamSection number="1.1" title="Vital Signs" description="Measurements, posture/condition, and anthropometry" open>
        <h4>Temperature</h4>
        <div className="general-exam-grid">
          <Field label="Temperature" name="vitalsTemp" type="number" step="0.1" min="0" max="120" value={form.vitalsTemp} onChange={onChange} help="Adult resting reference: 97.7–99.1°F / 36.5–37.3°C." />
          <TypeableField label="Measurement site" name="temperatureSite" value={form.temperatureSite} onChange={onChange} options={["Oral", "Axillary", "Rectal"]} />
          <TypeableField label="Unit" name="temperatureUnit" value={form.temperatureUnit} onChange={onChange} options={["°F", "°C"]} />
        </div>

        <h4>Pulse</h4>
        <div className="general-exam-grid">
          <Field label="Pulse rate / minute" name="vitalsPulse" type="number" min="0" max="300" value={form.vitalsPulse} onChange={onChange} help="Adult resting reference: 60–100/min." />
          <TypeableField label="Rhythm" name="pulseRhythm" value={form.pulseRhythm} onChange={onChange} options={["Regular", "Irregular", "Regularly irregular", "Irregularly irregular"]} />
          <TypeableField label="Volume" name="pulseVolume" value={form.pulseVolume} onChange={onChange} options={["Normal", "Low volume", "High volume", "Thready", "Bounding"]} />
          <TypeableField label="Character" name="pulseCharacter" value={form.pulseCharacter} onChange={onChange} options={["Normal", "Collapsing", "Anacrotic", "Pulsus paradoxus", "Pulsus alternans"]} />
          <TypeableField label="Tension" name="pulseTension" value={form.pulseTension} onChange={onChange} options={["Normal", "Low", "High"]} />
          <TypeableField label="Condition of vessel wall" name="pulseVesselWall" value={form.pulseVesselWall} onChange={onChange} options={["Normal", "Thickened", "Rigid", "Tortuous"]} />
        </div>

        <h4>Blood Pressure</h4>
        <div className="general-exam-grid">
          <Field label="Right arm systolic" name="bpRightSystolic" type="number" min="0" max="300" value={form.bpRightSystolic} onChange={onChange} />
          <Field label="Right arm diastolic" name="bpRightDiastolic" type="number" min="0" max="200" value={form.bpRightDiastolic} onChange={onChange} />
          <Field label="Left arm systolic" name="bpLeftSystolic" type="number" min="0" max="300" value={form.bpLeftSystolic} onChange={onChange} />
          <Field label="Left arm diastolic" name="bpLeftDiastolic" type="number" min="0" max="200" value={form.bpLeftDiastolic} onChange={onChange} />
          <TypeableField label="Patient position" name="bpPosition" value={form.bpPosition} onChange={onChange} options={["Lying", "Sitting", "Standing"]} help="Average healthy adult resting reference: 90/60–120/80 mmHg." />
        </div>

        <h4>Respiration &amp; Oxygen Saturation</h4>
        <div className="general-exam-grid">
          <Field label="Respiratory rate / minute" name="vitalsRr" type="number" min="0" max="100" value={form.vitalsRr} onChange={onChange} help="Adult resting reference: 12–18/min." />
          <TypeableField label="Respiratory pattern" name="respiratoryPattern" value={form.respiratoryPattern} onChange={onChange} options={["Eupnoea", "Tachypnoea", "Bradypnoea", "Cheyne-Stokes", "Kussmaul"]} />
          <Field label="SpO₂ (%)" name="vitalsSpo2" type="number" step="0.1" min="0" max="100" value={form.vitalsSpo2} onChange={onChange} help="Typical healthy range at sea level: 95–100%." />
          <TypeableField label="SpO₂ condition" name="spo2Condition" value={form.spo2Condition} onChange={onChange} options={["At rest", "On exertion"]} />
        </div>

        <h4>Anthropometry &amp; Blood Glucose</h4>
        <div className="general-exam-grid">
          <Field label="Weight (kg)" name="vitalsWeight" type="number" step="0.01" min="0" max="500" value={form.vitalsWeight} onChange={onChange} />
          <Field label="Height (cm)" name="vitalsHeight" type="number" step="0.01" min="0" max="300" value={form.vitalsHeight} onChange={onChange} />
          <Field label="BMI (kg/m²)" name="bmi" value={form.bmi} onChange={onChange} readOnly help="Calculated automatically: weight ÷ height²." />
          <Field label="Adult BMI category" name="bmiCategory" value={form.bmiCategory} onChange={onChange} readOnly help="Underweight <18.5; Normal 18.5–24.9; Overweight 25–29.9; Obese ≥30." />
          <Field label="Waist circumference (cm)" name="waistCircumference" type="number" step="0.01" min="0" max="400" value={form.waistCircumference} onChange={onChange} />
          <Field label="Hip circumference (cm)" name="hipCircumference" type="number" step="0.01" min="0" max="400" value={form.hipCircumference} onChange={onChange} />
          <Field label="Waist:Hip ratio" name="waistHipRatio" value={form.waistHipRatio} onChange={onChange} readOnly />
          <TypeableField label="Blood glucose type" name="bloodGlucoseType" value={form.bloodGlucoseType} onChange={onChange} options={["Fasting", "Post-Prandial", "Random"]} />
          <Field label="Blood glucose (mg/dL)" name="bloodGlucoseValue" type="number" step="0.1" min="0" max="1000" value={form.bloodGlucoseValue} onChange={onChange} placeholder="If device linked / available" />
        </div>
      </ExamSection>

      <ExamSection number="1.2" title="Ayurveda Parikshan" description="Ashtvidh, Dashavidh, Srotas, Samprapti Ghatak, and Prakruti">
        {ayurvedaSections.map((section) => (
          <div key={section.key}>
            <h4>{section.title}</h4>
            <div className="general-exam-grid">
              {section.fields.map((field) => (
                <MultiTypeableField
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  values={form[field.name]}
                  onChange={onChange}
                  options={field.options}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Prakruti assessment is disabled for now. Re-enable by uncommenting these two
            lines — the table, its scoring, and the DB columns are all still in place.
        <h4>Prakruti</h4>
        <PrakrutiTable form={form} onChange={onChange} />
        */}

        <div className="field general-exam-notes">
          <label htmlFor="general-exam-ayurvedaNotes">Ayurveda parikshan notes</label>
          <textarea
            id="general-exam-ayurvedaNotes"
            name="ayurvedaNotes"
            value={form.ayurvedaNotes ?? ""}
            onChange={onChange}
            placeholder="Any parikshan finding not covered by the lists above"
          />
        </div>
      </ExamSection>

      <ExamSection number="1.3" title="General Appearance & Built" description="Constitution, posture, neurological appearance, and communication">
        <div className="general-exam-grid">
          <TypeableField label="Built (somatotype)" name="builtMorphology" value={form.builtMorphology} onChange={onChange} options={["Ectomorph", "Mesomorph", "Endomorph"]} />
          <TypeableField label="Body build" name="bodyBuild" value={form.bodyBuild} onChange={onChange} options={["Thin", "Average", "Obese"]} />
          <TypeableField label="Nourishment" name="nourishment" value={form.nourishment} onChange={onChange} options={["Well-nourished", "Malnourished", "Cachexic", "Over-nourished"]} />
          <TypeableField label="Posture" name="posture" value={form.posture} onChange={onChange} options={["Normal", "Kyphosis", "Lordosis", "Scoliosis", "Antalgic"]} />
          <TypeableField label="Gait" name="gait" value={form.gait} onChange={onChange} options={["Normal", "Antalgic", "Ataxic", "Hemiplegic", "Waddling", "Steppage", "Parkinsonian"]} />
          <TypeableField label="Decubitus" name="decubitus" value={form.decubitus} onChange={onChange} options={["Active", "Passive", "Forced"]} />
          <TypeableField label="Facial expression" name="facialExpression" value={form.facialExpression} onChange={onChange} options={["Normal", "Anxious", "Painful", "Mask-like", "Cushingoid", "Myxedematous"]} />
          <TypeableField label="Conscious level" name="consciousLevel" value={form.consciousLevel} onChange={onChange} options={["Fully Conscious", "Drowsy", "Stuporous", "Semiconscious", "Unconscious"]} />
          <TypeableField label="Orientation — Time" name="orientationTime" value={form.orientationTime} onChange={onChange} options={["Intact", "Impaired"]} />
          <TypeableField label="Orientation — Place" name="orientationPlace" value={form.orientationPlace} onChange={onChange} options={["Intact", "Impaired"]} />
          <TypeableField label="Orientation — Person" name="orientationPerson" value={form.orientationPerson} onChange={onChange} options={["Intact", "Impaired"]} />
          <TypeableField label="Co-operation" name="cooperation" value={form.cooperation} onChange={onChange} options={["Good", "Poor", "Uncooperative"]} />
          <TypeableField label="Speech" name="speech" value={form.speech} onChange={onChange} options={["Normal", "Slurred", "Dysarthric", "Aphasic", "Mute"]} />
        </div>
      </ExamSection>

      <ExamSection number="1.4" title="Skin, Hair & Nails" description="Integumentary findings, oedema, and lymph nodes">
        <div className="general-exam-grid">
          <TypeableField label="Skin colour" name="skinColour" value={form.skinColour} onChange={onChange} options={["Normal", "Pallor", "Cyanosis", "Jaundice", "Pigmentation", "Erythema", "Vitiligo"]} />
          <TypeableField label="Skin texture" name="skinTexture" value={form.skinTexture} onChange={onChange} options={["Normal", "Rough", "Smooth", "Dry", "Oily", "Scaly"]} />
          <TypeableField label="Skin turgor" name="skinTurgor" value={form.skinTurgor} onChange={onChange} options={["Normal", "Decreased (dehydration)", "Increased"]} />
          <TypeableField label="Rashes / lesions" name="rashesLesions" value={form.rashesLesions} onChange={onChange} options={["Macule", "Papule", "Vesicle", "Pustule", "Bulla", "Nodule", "Plaque", "Wheal", "Ulcer"]} />
          <TypeableField label="Oedema type" name="oedemaType" value={form.oedemaType} onChange={onChange} options={["Pitting", "Non-pitting", "Absent"]} />
          <TypeableField label="Oedema distribution" name="oedemaDistribution" value={form.oedemaDistribution} onChange={onChange} options={["Localised", "Generalised"]} />
          <TypeableField label="Oedema grade" name="oedemaGrade" value={form.oedemaGrade} onChange={onChange} options={["1+", "2+", "3+", "4+"]} />
          <Field label="Lymphadenopathy site" name="lymphSite" value={form.lymphSite} onChange={onChange} placeholder="Site or absent" />
          <Field label="Lymph node size" name="lymphSize" value={form.lymphSize} onChange={onChange} placeholder="cm" />
          <TypeableField label="Lymph node consistency" name="lymphConsistency" value={form.lymphConsistency} onChange={onChange} options={["Soft", "Firm", "Hard", "Rubbery", "Fluctuant"]} />
          <TypeableField label="Lymph node tenderness" name="lymphTenderness" value={form.lymphTenderness} onChange={onChange} options={["Tender", "Non-tender"]} />
          <TypeableField label="Lymph node mobility" name="lymphMobility" value={form.lymphMobility} onChange={onChange} options={["Mobile", "Fixed", "Matted"]} />
          <TypeableField label="Hair" name="hair" value={form.hair} onChange={onChange} options={["Normal", "Alopecia", "Hirsutism", "Texture changes"]} />
          <TypeableField label="Nails" name="nails" value={form.nails} onChange={onChange} options={["Normal", "Clubbing Grade I", "Clubbing Grade II", "Clubbing Grade III", "Clubbing Grade IV", "Koilonychia", "Leuconychia", "Splinter haemorrhages", "Onycholysis", "Beau's lines"]} />
        </div>
      </ExamSection>

      <ExamSection number="1.5" title="Eyes, Tongue & Mucous Membranes" description="Ocular, oral, tongue, and throat findings">
        <div className="general-exam-grid">
          <TypeableField label="Conjunctiva" name="conjunctiva" value={form.conjunctiva} onChange={onChange} options={["Normal", "Pallor (Anaemia)", "Congestion"]} />
          <TypeableField label="Sclera" name="sclera" value={form.sclera} onChange={onChange} options={["Normal", "Icteric (Jaundice)", "Subconjunctival Haemorrhage"]} />
          <Field label="Pupil size" name="pupilsSize" value={form.pupilsSize} onChange={onChange} placeholder="e.g. 3 mm, equal" />
          <TypeableField label="Pupil shape" name="pupilsShape" value={form.pupilsShape} onChange={onChange} options={["Round", "Irregular", "Equal", "Unequal"]} />
          <TypeableField label="Direct light reflex" name="pupilsDirectReflex" value={form.pupilsDirectReflex} onChange={onChange} options={["Present", "Sluggish", "Absent"]} />
          <TypeableField label="Consensual light reflex" name="pupilsConsensualReflex" value={form.pupilsConsensualReflex} onChange={onChange} options={["Present", "Sluggish", "Absent"]} />
          <TypeableField label="PERRLA" name="pupilsPerrla" value={form.pupilsPerrla} onChange={onChange} options={["Normal / Intact", "Abnormal"]} />
          <TypeableField label="Tongue" name="tongueAppearance" value={form.tongueAppearance} onChange={onChange} options={["Clean", "Coated"]} />
          <TypeableField label="Tongue coating colour" name="tongueCoatingColor" value={form.tongueCoatingColor} onChange={onChange} options={["White", "Yellow", "Brown", "Purple", "Bluish"]} />
          <TypeableField label="Tongue moisture" name="tongueMoisture" value={form.tongueMoisture} onChange={onChange} options={["Moist", "Dry"]} />
          <TypeableField label="Tongue tremors" name="tongueTremors" value={form.tongueTremors} onChange={onChange} options={yesNo} />
          <TypeableField label="Macroglossia" name="tongueMacroglossia" value={form.tongueMacroglossia} onChange={onChange} options={yesNo} />
          <TypeableField label="Oral mucosa" name="oralMucosa" value={form.oralMucosa} onChange={onChange} options={["Normal", "Pallor", "Cyanosis", "Ulcers", "Candidiasis"]} />
          <TypeableField label="Throat congestion" name="throatCongestion" value={form.throatCongestion} onChange={onChange} options={yesNo} />
          <TypeableField label="Tonsillar enlargement" name="tonsillarGrade" value={form.tonsillarGrade} onChange={onChange} options={["Absent", "Grade I", "Grade II", "Grade III"]} />
          <TypeableField label="Throat exudates" name="throatExudates" value={form.throatExudates} onChange={onChange} options={yesNo} />
        </div>
      </ExamSection>

      <div className="field general-exam-notes">
        <label htmlFor="general-exam-physicalExam">Additional general examination notes</label>
        <textarea id="general-exam-physicalExam" name="physicalExam" value={form.physicalExam} onChange={onChange} placeholder="Enter any additional findings not captured above" />
      </div>
    </div>
  );
}
