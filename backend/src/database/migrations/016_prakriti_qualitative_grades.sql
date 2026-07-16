-- Clinicians enter vitals and prakriti grades with units/symbols, e.g. "96bpm",
-- "86.20 kgs", "16/min", "+", "PITTA KAPHA". Those were rejected by the numeric /
-- integer column types (and the prakriti 0-10 CHECK) and surfaced as a generic
-- "Something went wrong" 500 on Save & Forward / Save Assessment. Store these
-- fields as free text so the values save exactly as typed.

-- Prakriti Vata/Pitta/Kapha: INTEGER (0-10) -> short text grade.
ALTER TABLE ayurveda_assessments
  DROP CONSTRAINT IF EXISTS ayurveda_assessments_prakriti_vata_check,
  DROP CONSTRAINT IF EXISTS ayurveda_assessments_prakriti_pitta_check,
  DROP CONSTRAINT IF EXISTS ayurveda_assessments_prakriti_kapha_check;

ALTER TABLE ayurveda_assessments
  ALTER COLUMN prakriti_vata TYPE VARCHAR(30) USING NULLIF(prakriti_vata::text, ''),
  ALTER COLUMN prakriti_pitta TYPE VARCHAR(30) USING NULLIF(prakriti_pitta::text, ''),
  ALTER COLUMN prakriti_kapha TYPE VARCHAR(30) USING NULLIF(prakriti_kapha::text, '');

-- Vitals: numeric columns -> text so units typed by staff are preserved.
ALTER TABLE opd_visits
  ALTER COLUMN vitals_pulse TYPE VARCHAR(30) USING NULLIF(vitals_pulse::text, ''),
  ALTER COLUMN vitals_temp TYPE VARCHAR(30) USING NULLIF(vitals_temp::text, ''),
  ALTER COLUMN vitals_weight TYPE VARCHAR(30) USING NULLIF(vitals_weight::text, ''),
  ALTER COLUMN vitals_height TYPE VARCHAR(30) USING NULLIF(vitals_height::text, ''),
  ALTER COLUMN vitals_spo2 TYPE VARCHAR(30) USING NULLIF(vitals_spo2::text, ''),
  ALTER COLUMN vitals_rr TYPE VARCHAR(30) USING NULLIF(vitals_rr::text, '');
