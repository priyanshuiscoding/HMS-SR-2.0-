INSERT INTO lab_test_masters (code, name, department, price, normal_range, unit, is_active, metadata)
VALUES
  ('CBC', 'Complete Blood Count (CBC)', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('RFT', 'Renal Function Test (RFT)', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('LFT', 'Liver Function Test (LFT)', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('FBS', 'Fasting Blood Sugar (FBS)', 'Laboratory Tests', 0, '', 'mg/dL', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('RBS', 'Random Blood Sugar (RBS)', 'Laboratory Tests', 0, '', 'mg/dL', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('HBA1C', 'HbA1c', 'Laboratory Tests', 0, '', '%', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('LIPID', 'Lipid Profile', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('THYROID', 'Thyroid Profile', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('RA', 'RA Factor', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('CRP', 'C-Reactive Protein (CRP)', 'Laboratory Tests', 0, '', '', true, '{"selectionGroup":"Laboratory Tests","opdSelectable":true}'::jsonb),
  ('XRAY-CHEST', 'X-Ray - Chest', 'Radiology', 0, '', '', true, '{"selectionGroup":"X-Ray","opdSelectable":true}'::jsonb),
  ('XRAY-ABDOMEN', 'X-Ray - Abdomen', 'Radiology', 0, '', '', true, '{"selectionGroup":"X-Ray","opdSelectable":true}'::jsonb),
  ('XRAY-EXTREMITY', 'X-Ray - Extremity', 'Radiology', 0, '', '', true, '{"selectionGroup":"X-Ray","opdSelectable":true}'::jsonb),
  ('USG-ABDOMEN', 'Ultrasound - Abdomen', 'Radiology', 0, '', '', true, '{"selectionGroup":"Ultrasound","opdSelectable":true}'::jsonb),
  ('USG-PELVIS', 'Ultrasound - Pelvis', 'Radiology', 0, '', '', true, '{"selectionGroup":"Ultrasound","opdSelectable":true}'::jsonb),
  ('USG-BREAST', 'Ultrasound - Breast', 'Radiology', 0, '', '', true, '{"selectionGroup":"Ultrasound","opdSelectable":true}'::jsonb),
  ('USG-THYROID', 'Ultrasound - Thyroid', 'Radiology', 0, '', '', true, '{"selectionGroup":"Ultrasound","opdSelectable":true}'::jsonb),
  ('CT-HEAD', 'CT Scan - Head', 'Radiology', 0, '', '', true, '{"selectionGroup":"CT Scan","opdSelectable":true}'::jsonb),
  ('CT-CHEST', 'CT Scan - Chest', 'Radiology', 0, '', '', true, '{"selectionGroup":"CT Scan","opdSelectable":true}'::jsonb),
  ('CT-ABDOMEN', 'CT Scan - Abdomen', 'Radiology', 0, '', '', true, '{"selectionGroup":"CT Scan","opdSelectable":true}'::jsonb),
  ('MRI-BRAIN', 'MRI - Brain', 'Radiology', 0, '', '', true, '{"selectionGroup":"MRI","opdSelectable":true}'::jsonb),
  ('MRI-SPINE', 'MRI - Spine', 'Radiology', 0, '', '', true, '{"selectionGroup":"MRI","opdSelectable":true}'::jsonb)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  unit = CASE WHEN lab_test_masters.unit = '' THEN EXCLUDED.unit ELSE lab_test_masters.unit END,
  is_active = true,
  metadata = COALESCE(lab_test_masters.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = NOW();

UPDATE prescriptions
SET metadata = jsonb_set(
  metadata,
  '{therapyPlan,panchkarma}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN LOWER(COALESCE(item->>'procedure', '')) IN ('shiroabhyanga', 'shiro abhyanga', 'shiroabhayaya')
          THEN jsonb_set(item, '{procedure}', to_jsonb('Vaman/Virchak'::text), true)
        ELSE item
      END
      ORDER BY ordinal
    )
    FROM jsonb_array_elements(metadata #> '{therapyPlan,panchkarma}') WITH ORDINALITY AS rows(item, ordinal)
  ),
  true
)
WHERE jsonb_typeof(metadata #> '{therapyPlan,panchkarma}') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(metadata #> '{therapyPlan,panchkarma}') AS item
    WHERE LOWER(COALESCE(item->>'procedure', '')) IN ('shiroabhyanga', 'shiro abhyanga', 'shiroabhayaya')
  );

UPDATE prescriptions
SET metadata = jsonb_set(
  metadata,
  '{therapyPlan,specialized}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN LOWER(COALESCE(item->>'therapy', '')) IN ('shirodhara', 'shiro dhara')
          THEN jsonb_set(item, '{therapy}', to_jsonb('Abhayans'::text), true)
        ELSE item
      END
      ORDER BY ordinal
    )
    FROM jsonb_array_elements(metadata #> '{therapyPlan,specialized}') WITH ORDINALITY AS rows(item, ordinal)
  ),
  true
)
WHERE jsonb_typeof(metadata #> '{therapyPlan,specialized}') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(metadata #> '{therapyPlan,specialized}') AS item
    WHERE LOWER(COALESCE(item->>'therapy', '')) IN ('shirodhara', 'shiro dhara')
  );
