BEGIN;

WITH room_seed AS (
  SELECT *
  FROM (VALUES
    ('GMW-001', 'general', 'Ground Floor', 'General Male Ward', 10, 1500, 'General Ward Station', '10-bed general male ward. Package includes bed charges and diet only.'),
    ('GFW-001', 'general', 'Ground Floor', 'General Female Ward', 6, 1500, 'General Ward Station', '6-bed general female ward. Package includes bed charges and diet only.'),
    ('SPMW-001', 'semi_private', 'First Floor', 'Semi Private Male Ward', 5, 2500, 'Semi Private Ward Station', '5-bed semi-private male ward. Package includes bed charges and diet only.'),
    ('SPFW-001', 'semi_private', 'First Floor', 'Semi Private Female Ward', 2, 2500, 'Semi Private Ward Station', '2-bed semi-private female ward. Package includes bed charges and diet only.'),
    ('PR-001', 'private', 'First Floor', 'Private Ward', 4, 3500, 'Private Ward Station', '4 private beds. Package includes bed charges and diet only.')
  ) AS seed(room_number, room_type, floor, ward, total_beds, daily_rate, nursing_station, notes)
)
INSERT INTO rooms (room_number, room_type, floor, ward, total_beds, daily_rate, nursing_station, notes, metadata)
SELECT room_number, room_type, floor, ward, total_beds, daily_rate, nursing_station, notes, jsonb_build_object('source', 'real_ward_inventory_2026_06')
FROM room_seed
ON CONFLICT (room_number) DO UPDATE
SET room_type = EXCLUDED.room_type,
    floor = EXCLUDED.floor,
    ward = EXCLUDED.ward,
    total_beds = EXCLUDED.total_beds,
    daily_rate = EXCLUDED.daily_rate,
    nursing_station = EXCLUDED.nursing_station,
    notes = EXCLUDED.notes,
    metadata = rooms.metadata || EXCLUDED.metadata,
    is_active = true,
    updated_at = NOW();

WITH bed_seed AS (
  SELECT 'GMW-001' AS room_number, 'GMW-' || LPAD(gs::text, 2, '0') AS bed_number, 'Bed ' || gs AS bed_label
  FROM generate_series(1, 10) AS gs
  UNION ALL
  SELECT 'GFW-001', 'GFW-' || LPAD(gs::text, 2, '0'), 'Bed ' || gs
  FROM generate_series(1, 6) AS gs
  UNION ALL
  SELECT 'SPMW-001', 'SPMW-' || LPAD(gs::text, 2, '0'), 'Bed ' || gs
  FROM generate_series(1, 5) AS gs
  UNION ALL
  SELECT 'SPFW-001', 'SPFW-' || LPAD(gs::text, 2, '0'), 'Bed ' || gs
  FROM generate_series(1, 2) AS gs
  UNION ALL
  SELECT 'PR-001', 'PR-' || LPAD(gs::text, 2, '0'), 'Bed ' || gs
  FROM generate_series(1, 4) AS gs
)
INSERT INTO beds (room_id, bed_number, bed_label, status, metadata)
SELECT rooms.id, bed_seed.bed_number, bed_seed.bed_label, 'available', jsonb_build_object('source', 'real_ward_inventory_2026_06')
FROM bed_seed
JOIN rooms ON rooms.room_number = bed_seed.room_number
ON CONFLICT (bed_number) DO UPDATE
SET room_id = EXCLUDED.room_id,
    bed_label = EXCLUDED.bed_label,
    metadata = beds.metadata || EXCLUDED.metadata,
    updated_at = NOW();

COMMIT;
