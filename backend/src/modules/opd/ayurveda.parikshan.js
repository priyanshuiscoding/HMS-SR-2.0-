// Field names of the ayurvedic parikshan sheet, grouped exactly as they are stored
// (one JSONB column per group). The printed option lists live in the frontend; the
// server only guarantees the shape, because doctors may record a custom finding.

export const ashtavidhaFieldNames = [
  "ashtaNadi",
  "ashtaJihva",
  "ashtaMala",
  "ashtaMutra",
  "ashtaNetra",
  "ashtaAkriti",
  "ashtaShabda",
  "ashtaSparsha"
];

export const dashavidhaFieldNames = [
  "dashaPrakriti",
  "dashaSatmyaAbhyavaharana",
  "dashaSatmyaJarana",
  "dashaSara",
  "dashaVaya",
  "dashaDesha",
  "dashaKala",
  "dashaSatva",
  "dashaSamhanana",
  "dashaPramana",
  "dashaSharirBala",
  "dashaManasPrakriti"
];

export const srotasFieldNames = [
  "srotasPranavaha",
  "srotasUdakavaha",
  "srotasAnnavaha",
  "srotasRasavaha",
  "srotasRaktavaha",
  "srotasMamsavaha",
  "srotasMedovaha",
  "srotasAsthivaha",
  "srotasMajjavaha",
  "srotasShukravaha",
  "srotasArtavavaha",
  "srotasMutravaha",
  "srotasPurishavaha",
  "srotasSwedavaha"
];

export const sampraptiFieldNames = [
  "sampraptiDosha",
  "sampraptiDushya",
  "sampraptiSrotas",
  "sampraptiMala",
  "sampraptiAdhishthana",
  "sampraptiSrotodushti",
  "sampraptiSwabhava",
  "sampraptiSadhyasadhyatva",
  "sampraptiSamata",
  "sampraptiAgni"
];

export const prakrutiTraitFieldNames = [
  "prakrutiBodyWeightFrame",
  "prakrutiSkin",
  "prakrutiFingernails",
  "prakrutiHair",
  "prakrutiForehead",
  "prakrutiEyes",
  "prakrutiLips",
  "prakrutiThirst",
  "prakrutiExcretions",
  "prakrutiVoiceSpeech",
  "prakrutiWorkingStyle",
  "prakrutiMentalMakeUp",
  "prakrutiTemperament",
  "prakrutiRelationships",
  "prakrutiWeatherPreferences",
  "prakrutiMoneyMatters",
  "prakrutiMemory",
  "prakrutiDreams",
  "prakrutiSleep"
];

const PRAKRUTI_DOSHAS = ["Vata", "Pitta", "Kapha"];
const MAX_FINDINGS_PER_FIELD = 30;
const MAX_FINDING_LENGTH = 120;

// Accepts either an array (normal case) or a "a / b" string, so an older client or a
// manual API call cannot corrupt the stored shape.
function normalizeFindings(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" && value ? value.split("/") : [];
  const seen = new Set();
  const findings = [];

  raw.forEach((entry) => {
    const finding = String(entry ?? "").trim().slice(0, MAX_FINDING_LENGTH);
    if (!finding || seen.has(finding)) return;
    seen.add(finding);
    findings.push(finding);
  });

  return findings.slice(0, MAX_FINDINGS_PER_FIELD);
}

function pickFindings(payload, fieldNames) {
  return Object.fromEntries(fieldNames.map((name) => [name, normalizeFindings(payload[name])]));
}

function prakrutiFromPayload(payload) {
  const traits = Object.fromEntries(
    prakrutiTraitFieldNames.map((name) => [name, PRAKRUTI_DOSHAS.includes(payload[name]) ? payload[name] : ""])
  );
  const counts = { Vata: 0, Pitta: 0, Kapha: 0 };
  Object.values(traits).forEach((dosha) => {
    if (counts[dosha] !== undefined) counts[dosha] += 1;
  });

  const answered = counts.Vata + counts.Pitta + counts.Kapha;
  const highest = Math.max(counts.Vata, counts.Pitta, counts.Kapha);
  const leaders = PRAKRUTI_DOSHAS.filter((dosha) => counts[dosha] === highest);

  return {
    ...traits,
    prakrutiVataCount: answered ? String(counts.Vata) : "",
    prakrutiPittaCount: answered ? String(counts.Pitta) : "",
    prakrutiKaphaCount: answered ? String(counts.Kapha) : "",
    prakrutiDominant: !answered ? "" : leaders.length === 3 ? "Tridosha (सम)" : leaders.join("-")
  };
}

export function ayurvedaParikshanFromPayload(payload = {}) {
  return {
    ashtavidhaPariksha: pickFindings(payload, ashtavidhaFieldNames),
    dashavidhaPariksha: pickFindings(payload, dashavidhaFieldNames),
    srotasPariksha: pickFindings(payload, srotasFieldNames),
    sampraptiGhatak: pickFindings(payload, sampraptiFieldNames),
    prakruti: prakrutiFromPayload(payload),
    ayurvedaNotes: String(payload.ayurvedaNotes ?? "").trim()
  };
}
