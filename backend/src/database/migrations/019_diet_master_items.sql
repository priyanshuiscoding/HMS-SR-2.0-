BEGIN;

-- Master vocabulary for the "Diet To Take" / "Diet To Avoid" pickers on the OPD
-- prescription. Doctors pick from this controlled list, but may also type an item
-- that is not seeded; those custom entries join the list so they are suggested on
-- later prescriptions, while staying tagged as 'custom' so the seeded sheet stays
-- distinguishable and typos can be audited or merged later.
-- name is the English label shown in the UI; name_hi keeps the Devanagari term
-- from the hospital's handwritten sheet so staff can search either way.
CREATE TABLE IF NOT EXISTS diet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  name_hi VARCHAR(120) NOT NULL DEFAULT '',
  applies_to VARCHAR(10) NOT NULL DEFAULT 'both' CHECK (applies_to IN ('take', 'avoid', 'both')),
  source VARCHAR(10) NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'custom')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_diet_items_name ON diet_items(lower(name), applies_to);
CREATE INDEX IF NOT EXISTS idx_diet_items_applies_to ON diet_items(applies_to) WHERE is_active;

-- Selections are denormalised onto the prescription as [{ id, name, nameHi }]
-- so reading a prescription never needs a join.
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS diet_to_take JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS diet_to_avoid JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seeded from the hospital's handwritten "Diet to Avoid" sheet. The sheet groups
-- items under Kapha/Vata/Pitta columns; they are merged into one flat list here
-- and duplicates across columns collapsed.
INSERT INTO diet_items (name, name_hi, applies_to) VALUES
  ('Banana', 'केला', 'avoid'),
  ('Coconut', 'नारियल', 'avoid'),
  ('Sugarcane juice', 'गन्ने का रस', 'avoid'),
  ('Rice', 'चावल', 'avoid'),
  ('Custard apple', 'सीताफल', 'avoid'),
  ('Pizza', 'पिज़्ज़ा', 'avoid'),
  ('Pasta', 'पास्ता', 'avoid'),
  ('Khoya', 'खोया', 'avoid'),
  ('Malai / cream', 'मलाई', 'avoid'),
  ('Sugar', 'शक्कर', 'avoid'),
  ('Beetroot', 'चुकंदर', 'avoid'),
  ('Peanut', 'मूंगफली', 'avoid'),
  ('Jackfruit', 'कटहल', 'avoid'),
  ('Radish', 'मूली', 'avoid'),
  ('Milk', 'दूध', 'avoid'),
  ('Urad dal', 'उड़द', 'avoid'),
  ('Idli', 'इडली', 'avoid'),
  ('Dosa', 'डोसा', 'avoid'),
  ('Curd', 'दही', 'avoid'),
  ('Watermelon', 'तरबूज', 'avoid'),
  ('Cashew', 'काजू', 'avoid'),
  ('Fig', 'अंजीर', 'avoid'),
  ('Walnut', 'अखरोट', 'avoid'),
  ('Arbi / colocasia', 'अरबी', 'avoid'),
  ('Oil', 'तेल', 'avoid'),
  ('Brinjal', 'बैंगन', 'avoid'),
  ('Bread', 'ब्रेड', 'avoid'),
  ('Biscuit', 'बिस्किट', 'avoid'),
  ('Maida / refined flour', 'मैदा', 'avoid'),
  ('Barbati / cowpea', 'बरबटी', 'avoid'),
  ('Sem / broad beans', 'सेम', 'avoid'),
  ('Chips', 'चिप्स', 'avoid'),
  ('Red chilli', 'लाल मिर्च', 'avoid'),
  ('Tulsi', 'तुलसी', 'avoid'),
  ('Flaxseed', 'अलसी', 'avoid'),
  ('Pickle', 'अचार', 'avoid'),
  ('Papad', 'पापड़', 'avoid'),
  ('Garam masala', 'गरम मसाले', 'avoid'),
  ('Khatai / sour food', 'खटाई', 'avoid'),
  ('Karonda', 'करौंदे', 'avoid'),
  ('Sauce', 'सॉस', 'avoid'),
  ('Sesame', 'तिल', 'avoid'),
  ('Rajgira / amaranth', 'राजगिरा', 'avoid'),
  ('Ginger', 'अदरक', 'avoid'),
  ('Garlic', 'लहसुन', 'avoid'),
  ('Tamarind', 'इमली', 'avoid'),
  ('Cauliflower', 'गोभी', 'avoid'),
  ('Rajma / kidney beans', 'राजमा', 'avoid'),
  ('Beans', 'बीन्स', 'avoid'),
  ('Cluster beans / guar', 'ग्वारफली', 'avoid')
ON CONFLICT DO NOTHING;

-- Seeded from the hospital's handwritten "Diet to Take" (pathya) sheet, which is
-- laid out in three columns — V (vata), P (pitta), K (kapha). The picker is a
-- single flat list, so the columns are merged and cross-column duplicates
-- collapsed here; the originating dosha(s) are kept in metadata->'dosha' so the
-- sheet can be reconstructed if the UI ever filters by prakriti.
-- Re-runnable: the earlier placeholder pathya list is cleared first. Only 'seed'
-- rows are removed, so items doctors typed themselves are preserved.
DELETE FROM diet_items WHERE applies_to = 'take' AND source = 'seed';

INSERT INTO diet_items (name, name_hi, applies_to, metadata) VALUES
  -- grains and pulses
  ('Wheat', 'गेहूँ', 'take', '{"dosha":["v","p"]}'),
  ('Rice', 'चावल', 'take', '{"dosha":["v","p"]}'),
  ('Barley', 'जौ', 'take', '{"dosha":["p","k"]}'),
  ('Bajra / pearl millet', 'बाजरा', 'take', '{"dosha":["k"]}'),
  ('Ragi / finger millet', 'रागी', 'take', '{"dosha":["k"]}'),
  ('Moong', 'मूँग', 'take', '{"dosha":["v","p","k"]}'),
  ('Urad', 'उड़द', 'take', '{"dosha":["v"]}'),
  ('Masoor / red lentil', 'मसूर', 'take', '{"dosha":["v","p"]}'),
  ('Kulthi / horse gram', 'कुल्थी', 'take', '{"dosha":["k"]}'),
  ('Chana / gram', 'चना', 'take', '{"dosha":["k"]}'),
  -- milk and fats
  ('Milk', 'दूध', 'take', '{"dosha":["v","p"]}'),
  ('Ghee', 'घी', 'take', '{"dosha":["v","p"]}'),
  ('Butter', 'मक्खन', 'take', '{"dosha":["v"]}'),
  ('Curd (small quantity)', 'दही (कम मात्रा में)', 'take', '{"dosha":["k"]}'),
  -- vegetables
  ('Bottle gourd', 'लौकी', 'take', '{"dosha":["v","p"]}'),
  ('Pumpkin', 'कद्दू', 'take', '{"dosha":["v"]}'),
  ('Sweet potato', 'शकरकंद', 'take', '{"dosha":["v"]}'),
  ('Ridge gourd', 'तोरी', 'take', '{"dosha":["p"]}'),
  ('Cucumber', 'खीरा', 'take', '{"dosha":["p"]}'),
  ('Pointed gourd / parwal', 'परवल', 'take', '{"dosha":["p"]}'),
  ('Bitter gourd', 'करेला', 'take', '{"dosha":["k"]}'),
  ('Fenugreek leaves', 'मेथी', 'take', '{"dosha":["k"]}'),
  ('Spinach', 'पालक', 'take', '{"dosha":["k"]}'),
  ('Radish', 'मूली', 'take', '{"dosha":["k"]}'),
  -- fruits
  ('Banana', 'केला', 'take', '{"dosha":["v"]}'),
  ('Mango', 'आम', 'take', '{"dosha":["v"]}'),
  ('Papaya', 'पपीता', 'take', '{"dosha":["v"]}'),
  ('Grapes', 'अंगूर', 'take', '{"dosha":["v"]}'),
  ('Pomegranate', 'अनार', 'take', '{"dosha":["p","k"]}'),
  ('Apple', 'सेब', 'take', '{"dosha":["p","k"]}'),
  ('Pear', 'नाशपाती', 'take', '{"dosha":["p"]}'),
  ('Coconut', 'नारियल', 'take', '{"dosha":["p"]}'),
  ('Guava', 'अमरूद', 'take', '{"dosha":["k"]}'),
  ('Draksha / dried grapes', 'द्राक्षा', 'take', '{"dosha":["p"]}'),
  -- spices
  ('Ginger', 'अदरक', 'take', '{"dosha":["v","k"]}'),
  ('Cumin', 'जीरा', 'take', '{"dosha":["v"]}'),
  ('Asafoetida', 'हींग', 'take', '{"dosha":["v"]}'),
  ('Coriander', 'धनिया', 'take', '{"dosha":["p"]}'),
  ('Fennel', 'सौंफ', 'take', '{"dosha":["p"]}'),
  ('Cardamom', 'इलायची', 'take', '{"dosha":["p"]}'),
  ('Black pepper', 'काली मिर्च', 'take', '{"dosha":["k"]}'),
  ('Turmeric', 'हल्दी', 'take', '{"dosha":["k"]}'),
  -- oils
  ('Sesame oil', 'तिल का तेल', 'take', '{"dosha":["v"]}'),
  ('Coconut oil', 'नारियल तेल', 'take', '{"dosha":["p"]}'),
  ('Mustard oil (small quantity)', 'सरसों का तेल (कम मात्रा)', 'take', '{"dosha":["k"]}'),
  -- water and regimen
  ('Lukewarm water', 'गुनगुना जल', 'take', '{"dosha":["v"]}'),
  ('Cold or room-temperature water', 'ठंडा या सामान्य तापमान का जल', 'take', '{"dosha":["p"]}'),
  ('Coconut water', 'नारियल पानी', 'take', '{"dosha":["p"]}'),
  ('Warm water with ginger', 'गर्म जल (अदरक युक्त)', 'take', '{"dosha":["k"]}'),
  ('Food cooked with ghee', 'घी युक्त भोजन', 'take', '{"dosha":["v"]}'),
  ('Warm freshly cooked food', 'गर्म ताजा भोजन', 'take', '{"dosha":["v"]}'),
  ('Soup and khichdi', 'सूप एवं खिचड़ी', 'take', '{"dosha":["v"]}')
ON CONFLICT DO NOTHING;

COMMIT;
