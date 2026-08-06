// Ayurvedic parikshan vocabulary transcribed from the hospital's assessment sheet.
// Every parikshan field accepts several findings at once, so the form stores arrays
// and doctors may also add a term that is not in the printed list.

export const ashtavidhaFields = [
  {
    name: "ashtaNadi",
    label: "नाडी (Nadi)",
    options: [
      "साम", "निराम", "क्षिण", "द्रूत", "गुरु", "वात", "पित", "कफ", "वातपित",
      "पितकफ", "कफवात", "त्रिदोष", "सर्पवत्", "मन्डुकवत्", "हंसवत्"
    ]
  },
  {
    name: "ashtaJihva",
    label: "जिहवा (Jihva)",
    options: [
      "साम", "निराम", "दारुण", "पिच्छिल", "स्फ़ुटित", "श्याम", "निलवर्ण", "शुष्क्",
      "वर्ण", "मुरवपाक", "सम्यक्", "निल", "श्वेत", "रक्तवर्ण"
    ]
  },
  {
    name: "ashtaMala",
    label: "मल (Mala)",
    options: [
      "सविबन्ध", "मुहु मुहु", "द्रव", "बध्ध्", "सरकत", "भोजनोतर", "सपूय", "पिच्छिल",
      "सम्यक्", "वेदनायुक्त", "Daily", "Alternate day", "शुष्क", "अपकव", "दौर्गन्ध्य",
      "रकतवर्ण", "पिताभवर्ण", "श्वेतवर्ण"
    ]
  },
  {
    name: "ashtaMutra",
    label: "मूत्र (Mutra)",
    options: [
      "सदाह्", "अल्पमुत्रता", "बहुमुत्रता", "सशुल", "रात्रिकालिनबहुमुत्रता", "शैयामूत्रता",
      "मेह्युकत", "अवरोधित", "अनियत्रित", "दीर्धकालीन", "सरकत", "फ़ेनिल", "पितवर्ण",
      "सम्यक्", "तैलसम", "श्वेत वर्ण"
    ]
  },
  {
    name: "ashtaNetra",
    label: "नेत्र (Netra)",
    options: [
      "कंडु", "पिच्छिल", "मलिन", "पित्", "निल", "स्त्राव", "श्याव", "शुष्क",
      "प्रकाश असहत्व", "सशुल", "दाह्", "क्षीण", "नेत्रविकार", "सम्यक्", "संकुचित",
      "विस्फारित", "श्वेत", "अरुण", "पित"
    ]
  },
  {
    name: "ashtaAkriti",
    label: "आकृति (Akriti)",
    options: ["कृश", "स्थूल", "मध्यम"]
  },
  {
    name: "ashtaShabda",
    label: "शब्द (Shabda)",
    options: ["गम्भीर", "स्निग्ध", "गदगद", "रुक्ष", "मिन्मिन"]
  },
  {
    name: "ashtaSparsha",
    label: "स्पर्श (Sparsha)",
    options: ["स्निग्ध", "शीत", "अनुष्णाशीत", "रुक्ष", "उष्ण", "शुष्क"]
  }
];

export const dashavidhaFields = [
  {
    name: "dashaPrakriti",
    label: "प्रकृति (Prakriti)",
    options: ["वात", "पित", "कफ", "वातपित", "वातकफ", "पितकफ", "त्रिदोष", "हीन"]
  },
  {
    name: "dashaSatmyaAbhyavaharana",
    label: "सातम्य — आभ्यवहरण",
    options: ["उत्तम", "मध्यम", "हीन"]
  },
  {
    name: "dashaSatmyaJarana",
    label: "सातम्य — जरण",
    options: ["मन्द", "विषं", "तीक्ष्ण", "सम"]
  },
  {
    name: "dashaSara",
    label: "सार (Sara)",
    options: ["त्वक्", "रक्त", "मांसा", "मेद", "अस्थि", "मज्जा", "शुक्र", "ओज"]
  },
  {
    name: "dashaVaya",
    label: "वयस (Vaya)",
    options: ["शैशव", "बाल्य", "कौमार", "युवा", "मध्यम", "वार्धक्य"]
  },
  {
    name: "dashaDesha",
    label: "देशं (Desha)",
    options: ["जङ्गल", "अनूप", "साधारण"]
  },
  {
    name: "dashaKala",
    label: "काल (Kala)",
    options: ["शिशिर", "वसन्त", "ग्रीष्म", "वर्षा", "शरद", "हेमन्त"]
  },
  {
    name: "dashaSatva",
    label: "सत्व (Satva)",
    options: ["उत्तम", "मध्यम", "हीन"]
  },
  {
    name: "dashaSamhanana",
    label: "संहनन (Samhanana)",
    options: ["उत्तम", "मध्यम", "हीन"]
  },
  {
    name: "dashaPramana",
    label: "प्रमाणत (Pramana)",
    options: ["उत्तम", "मध्यम", "हीन"]
  },
  {
    name: "dashaSharirBala",
    label: "शरीर बलं (Sharir Bala)",
    options: ["उत्तम", "मध्यम"]
  },
  {
    name: "dashaManasPrakriti",
    label: "मानस प्रकृति (Manas Prakriti)",
    options: ["सात्विक", "राजसिक", "तामसिक"]
  }
];

export const srotasFields = [
  {
    name: "srotasPranavaha",
    label: "प्राणवह (Pranavaha)",
    options: ["अल्पाल्प श्वास", "कुपित श्वास", "सशब्द", "सशुल", "अभिक्ष्ण श्वास"]
  },
  {
    name: "srotasUdakavaha",
    label: "उदकवह (Udakavaha)",
    options: ["जिव्हाशोष", "कण्ठशोष", "ओष्ठशोष", "तृष्णा", "तालुशोष"]
  },
  {
    name: "srotasAnnavaha",
    label: "अन्नवह (Annavaha)",
    options: ["अन्नाभिलाष", "अविपाक", "अरुचि", "छर्दि"]
  },
  {
    name: "srotasRasavaha",
    label: "रसवह (Rasavaha)",
    options: [
      "मुख्वैरस्य", "ज्वर", "अरसज्ञता", "पाण्डु", "हृल्लास", "अवसाद", "गौरव", "क्लैब्य",
      "तन्द्रा", "अंगमर्द", "अग्निमांध", "वलित", "पालित्य", "अरुचि", "अश्रद्धा"
    ]
  },
  {
    name: "srotasRaktavaha",
    label: "रक्तवह (Raktavaha)",
    options: [
      "पिडका", "कुष्ठ", "रक्तप्रदर", "चर्मरोग", "मुरवपाक", "कमला", "वीसर्प", "गुदपाक",
      "प्लीहा", "पामा", "रक्तपित्त", "गुल्म", "निलिका", "व्यङ्ग्", "चर्मदल", "श्वित्र",
      "तिलकालक", "कोठ"
    ]
  },
  {
    name: "srotasMamsavaha",
    label: "मांसवह (Mamsavaha)",
    options: ["अर्बुद", "उपजिव्हिका", "अलजि", "पुतिमांस", "गण्डमाला", "आधिमांस", "कील", "गलशालुक"]
  },
  {
    name: "srotasMedovaha",
    label: "मेदोवह (Medovaha)",
    options: ["मलाधिक्य", "तन्द्रा", "हस्तपाददाह", "गात्रास्निग्धता", "हस्तपादसुप्तत", "आलस्य", "प्रमेह", "स्थोल्य"]
  },
  {
    name: "srotasAsthivaha",
    label: "अस्थि (Asthivaha)",
    options: [
      "अध्यस्थि", "अस्थिशुल", "अधिदन्त", "दन्तशुल", "खालीत्य", "पालित्य", "अस्थिभेद",
      "केश", "केश लोम श्मश्रु दोष", "नखो विकार"
    ]
  },
  {
    name: "srotasMajjavaha",
    label: "मज्जावह (Majjavaha)",
    options: ["पर्वशुल", "मुर्च्छा", "भ्रम", "मिथ्याज्ञान", "तिमिर", "अरुषाम स्थुल मुलानम्"]
  },
  {
    name: "srotasShukravaha",
    label: "शुक्र (Shukravaha)",
    options: ["क्लैब्य", "गर्भपात", "अहर्षणं", "संतानविकृति"]
  },
  {
    name: "srotasArtavavaha",
    label: "आर्तववह (Artavavaha)",
    options: ["अल्पार्तव", "अत्यार्तव", "अनार्तव", "वन्ध्यत्व", "विषमार्तव"]
  },
  {
    name: "srotasMutravaha",
    label: "मूत्रवह (Mutravaha)",
    options: ["बहुलमुत्रता", "अभिक्ष्ण", "अल्पमूत्रता", "सशुलमुत्रता"]
  },
  {
    name: "srotasPurishavaha",
    label: "पुरिषवह (Purishavaha)",
    options: ["अल्पाल्प", "अतिद्रव", "सशुल", "ग्रथित"]
  },
  {
    name: "srotasSwedavaha",
    label: "स्वेदवह (Swedavaha)",
    options: ["अस्वेद", "लोमहर्ष", "अतिस्वेद", "अङ्गपरिदाह"]
  }
];

export const sampraptiFields = [
  {
    name: "sampraptiDosha",
    label: "दोष (Dosha)",
    options: ["वात", "पित्त", "कफ", "वातपित्त", "वातकफ", "पित्तकफ", "त्रिदोष"]
  },
  {
    name: "sampraptiDushya",
    label: "दुष्य (Dushya)",
    options: ["रस", "रक्त", "मांस", "मेद", "अस्थि", "मज्जा", "शुक्र"]
  },
  {
    name: "sampraptiSrotas",
    label: "स्रोतस (Srotas)",
    options: [
      "प्राणवह", "उदकवहस्रोतस्", "अन्नवहस्रोतस्", "रसवहस्रोतस्", "रक्तवहस्रोतस्", "मांसवह",
      "मेदोवहस्रोतस्", "अस्थिवहस्रोतस्", "मज्जावह", "शुक्रवह", "आर्तववह", "मुत्रवहस्रोतस्",
      "पुरीषवह", "स्वेदवहस्रोतस्"
    ]
  },
  {
    name: "sampraptiMala",
    label: "मल (Mala)",
    options: ["पुरीष", "मूत्र", "स्वेद"]
  },
  {
    name: "sampraptiAdhishthana",
    label: "अधिष्ठान (Adhishthana)",
    options: ["आभ्यन्तर", "मध्यम", "बाह्य"]
  },
  {
    name: "sampraptiSrotodushti",
    label: "स्त्रोतोदुष्टि (Srotodushti)",
    options: ["संग", "ग्रन्थि", "विमार्गगमन", "अतिप्रवृत्ति"]
  },
  {
    name: "sampraptiSwabhava",
    label: "स्वभाव (Swabhava)",
    options: ["आशुकारि", "दारुण", "चिरकारि"]
  },
  {
    name: "sampraptiSadhyasadhyatva",
    label: "साध्यसाध्यत्व (Sadhyasadhyatva)",
    options: ["सुखसाध्य", "कष्टसाध्य", "याप्य", "असाध्य"]
  },
  {
    name: "sampraptiSamata",
    label: "सामता (Samata)",
    options: ["आमाजीर्ण", "रसशेषाजीर्ण", "दिनपाकी अजीर्ण", "विदग्धाजीर्ण", "विष्टब्धाजीर्ण"]
  },
  {
    name: "sampraptiAgni",
    label: "अग्नि (Agni)",
    options: [
      "जठराग्नि", "रसाग्नि", "रक्ताग्नि", "मांसाग्नि", "मेदोअग्नि", "मज्जाग्नि", "शुक्राग्नि",
      "आकाशमहाभूताग्नि", "वायुमहाभूताग्नि", "तेजोमहाभूताग्नि", "जलमहाभूताग्नि", "पृथ्विमहाभूताग्नि"
    ]
  }
];

export const ayurvedaSections = [
  { key: "ashtavidha", title: "Ashtvidh Pariksha", fields: ashtavidhaFields },
  { key: "dashavidha", title: "Dashavidh Pariksha", fields: dashavidhaFields },
  { key: "srotas", title: "Srotas Pariksha", fields: srotasFields },
  { key: "samprapti", title: "Samprapti Ghatak", fields: sampraptiFields }
];

export const prakrutiDoshas = ["Vata", "Pitta", "Kapha"];

export const prakrutiDoshaHeadings = {
  Vata: "Vata (ether and air)",
  Pitta: "Pitta (fire and water)",
  Kapha: "Kapha (water and earth)"
};

export const prakrutiTraits = [
  {
    name: "prakrutiBodyWeightFrame",
    label: "Body weight and frame",
    Vata: ["lean", "light weight", "cannot gain weight easily but can shed it rapidly"],
    Pitta: ["well proportioned frame", "average weight", "can gain as well as shed weight easily"],
    Kapha: ["broad and robust frame", "heavy bodied", "can gain weight easily but cannot shed it as fast"]
  },
  {
    name: "prakrutiSkin",
    label: "Skin",
    Vata: ["dry, rough to touch", "dull, darkish skin"],
    Pitta: ["soft, oily, warm to touch", "glowing skin, whether fair or dark"],
    Kapha: ["thick, supple, cool to touch", "pale skin, whitish complexion"]
  },
  {
    name: "prakrutiFingernails",
    label: "Fingernails",
    Vata: ["rough and brittle", "small", "dull in colour"],
    Pitta: ["tough", "medium", "pinkish in colour"],
    Kapha: ["smooth", "large and wide", "whitish in colour"]
  },
  {
    name: "prakrutiHair",
    label: "Hair",
    Vata: ["dry and coarse", "curly or difficult to manage, prone to split ends", "dark brown to black"],
    Pitta: ["smooth and fine", "sparse, tending towards early greying or balding", "light to auburn"],
    Kapha: ["silky and lustrous", "thick", "medium to brown"]
  },
  {
    name: "prakrutiForehead",
    label: "Forehead",
    Vata: ["small"],
    Pitta: ["medium"],
    Kapha: ["large"]
  },
  {
    name: "prakrutiEyes",
    label: "Eyes",
    Vata: ["small and active", "brown to dark brown pupils", "dull sclerae", "dry"],
    Pitta: ["sharp and penetrating", "light pupils — brown, green or gray", "yellowish sclerae", "medium in size"],
    Kapha: ["moist", "large and attractive with thick lashes", "bright blue or black pupils", "clear white sclerae"]
  },
  {
    name: "prakrutiLips",
    label: "Lips",
    Vata: ["thin", "darkish in colour"],
    Pitta: ["medium", "pinkish in colour"],
    Kapha: ["large", "pale in colour"]
  },
  {
    name: "prakrutiThirst",
    label: "Thirst",
    Vata: ["variable"],
    Pitta: ["excessive"],
    Kapha: ["scanty"]
  },
  {
    name: "prakrutiExcretions",
    label: "Excretions",
    Vata: ["frequently constipated", "hard and gaseous stools", "less sweating and urination"],
    Pitta: ["regular, soft and loose", "often burning stools", "profuse sweating and urination, strong body odour"],
    Kapha: ["regular, thick and oily stools", "moderate sweating and urination"]
  },
  {
    name: "prakrutiVoiceSpeech",
    label: "Voice and speech",
    Vata: ["weak, hoarse or shrill voice", "talks rapidly rather than clearly"],
    Pitta: ["commanding and sharp voice", "persuasive and motivating"],
    Kapha: ["gentle and pleasing voice", "talks less, keeps secrets within"]
  },
  {
    name: "prakrutiWorkingStyle",
    label: "Working style",
    Vata: ["fast work", "starts impulsively, but does not necessarily complete"],
    Pitta: ["determined worker", "highly task and goal oriented"],
    Kapha: ["methodical worker", "slow to begin, but always sees a task to completion"]
  },
  {
    name: "prakrutiMentalMakeUp",
    label: "Mental make-up",
    Vata: ["restless and easily distracted", "curious mind"],
    Pitta: ["passionate and generative", "assertive mind"],
    Kapha: ["calm and stable", "logical mind"]
  },
  {
    name: "prakrutiTemperament",
    label: "Temperament",
    Vata: ["insecure and impatient", "hardly ever content, always searching", "quick in emotional reactions and outbursts"],
    Pitta: ["aggressive and impatient", "dominating and cynical", "intense emotions of like or dislike, love or hate"],
    Kapha: ["comfortable and patient", "laid back", "slow to change", "does not get angry, has calm endurance"]
  },
  {
    name: "prakrutiRelationships",
    label: "Relationships",
    Vata: ["forgives and forgets easily", "frequently in and out of love"],
    Pitta: ["holds grudges for long", "enters into intense relationships"],
    Kapha: ["forgives, but never forgets", "deeply attached in love and grounded in family"]
  },
  {
    name: "prakrutiWeatherPreferences",
    label: "Weather preferences",
    Vata: ["sunny, warm and rainy climate"],
    Pitta: ["cool, pleasant climate"],
    Kapha: ["comfortable anywhere except in humid climate"]
  },
  {
    name: "prakrutiMoneyMatters",
    label: "Money matters",
    Vata: ["spends easily, does not care to earn or save much"],
    Pitta: ["plans well before spending"],
    Kapha: ["does not spend easily, likes to accumulate"]
  },
  {
    name: "prakrutiMemory",
    label: "Memory",
    Vata: ["quick grasp but poor retention"],
    Pitta: ["quick grasp and strong retention"],
    Kapha: ["slow grasp but strong retention"]
  },
  {
    name: "prakrutiDreams",
    label: "Dreams",
    Vata: ["anxious and many", "dreams relate to flying, jumping, climbing, running"],
    Pitta: ["moderate in number", "dreams relate to anger, conflict"],
    Kapha: ["fewer in number", "dreams relate to romance, water, pathos or empathy"]
  },
  {
    name: "prakrutiSleep",
    label: "Sleep",
    Vata: ["less and disturbed"],
    Pitta: ["less but sound"],
    Kapha: ["deep and prolonged"]
  }
];

// Field names grouped the way they are persisted (one JSONB column per group).
export const ayurvedaFieldGroups = {
  ashtavidhaPariksha: ashtavidhaFields.map((field) => field.name),
  dashavidhaPariksha: dashavidhaFields.map((field) => field.name),
  srotasPariksha: srotasFields.map((field) => field.name),
  sampraptiGhatak: sampraptiFields.map((field) => field.name)
};

export const ayurvedaMultiValueFields = Object.values(ayurvedaFieldGroups).flat();

export const prakrutiTraitFields = prakrutiTraits.map((trait) => trait.name);

// Counts and the dominant dosha are derived from the trait picks, never typed.
export const prakrutiDerivedFields = [
  "prakrutiVataCount",
  "prakrutiPittaCount",
  "prakrutiKaphaCount",
  "prakrutiDominant"
];

export const initialAyurvedaFields = {
  ...Object.fromEntries(ayurvedaMultiValueFields.map((name) => [name, []])),
  ...Object.fromEntries(prakrutiTraitFields.map((name) => [name, ""])),
  ...Object.fromEntries(prakrutiDerivedFields.map((name) => [name, ""])),
  ayurvedaNotes: ""
};

export function calculatePrakruti(form) {
  const counts = { Vata: 0, Pitta: 0, Kapha: 0 };
  prakrutiTraitFields.forEach((name) => {
    const value = form[name];
    if (counts[value] !== undefined) counts[value] += 1;
  });

  const answered = counts.Vata + counts.Pitta + counts.Kapha;
  const highest = Math.max(counts.Vata, counts.Pitta, counts.Kapha);
  const leaders = prakrutiDoshas.filter((dosha) => counts[dosha] === highest);
  // Two or three doshas within one pick of each other read as a dual/tridoshic prakruti.
  const dominant = !answered ? "" : leaders.length === 3 ? "Tridosha (सम)" : leaders.join("-");

  return {
    prakrutiVataCount: answered ? String(counts.Vata) : "",
    prakrutiPittaCount: answered ? String(counts.Pitta) : "",
    prakrutiKaphaCount: answered ? String(counts.Kapha) : "",
    prakrutiDominant: dominant
  };
}
