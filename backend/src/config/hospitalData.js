export const consultationCharge = 200;

export const opdOperatingHours = {
  mondayToSaturday: [
    { start: "09:00", end: "13:30", label: "9:00 AM - 1:30 PM" },
    { start: "15:30", end: "19:30", label: "3:30 PM - 7:30 PM" }
  ],
  sunday: [{ start: "09:00", end: "12:30", label: "9:00 AM - 12:30 PM" }]
};

export const ipdWardCharges = [
  {
    id: "ward-general-male",
    ward: "General Male Ward",
    roomType: "general",
    chargePerDay: 1500,
    packageIncludes: "Bed charges and diet only",
    totalBeds: 10,
    perPerson: true
  },
  {
    id: "ward-general-female",
    ward: "General Female Ward",
    roomType: "general",
    chargePerDay: 1500,
    packageIncludes: "Bed charges and diet only",
    totalBeds: 6,
    perPerson: true
  },
  {
    id: "ward-semi-private-male",
    ward: "Semi Private Male Ward",
    roomType: "semi_private",
    chargePerDay: 2500,
    packageIncludes: "Bed charges and diet only",
    totalBeds: 5,
    perPerson: false
  },
  {
    id: "ward-semi-private-female",
    ward: "Semi Private Female Ward",
    roomType: "semi_private",
    chargePerDay: 2500,
    packageIncludes: "Bed charges and diet only",
    totalBeds: 2,
    perPerson: false
  },
  {
    id: "ward-private",
    ward: "Private Ward",
    roomType: "private",
    chargePerDay: 3500,
    packageIncludes: "Bed charges and diet only",
    totalBeds: 4,
    perPerson: true
  }
];

export const ipdTreatmentPackages = [
  {
    id: "ipd-joint-spine",
    name: "Joint And Spine Package",
    goal: "To Avoid The Possible Spine And Joint Complications",
    durationDays: 28,
    overview: "Assessment, internal medication, postural correction, physical therapies, daily follow-ups, Panchakarma therapies, and diet/lifestyle modification.",
    suggestedFor: ["Knee pain", "Disc prolapse", "Poor posture", "Sciatica", "Cervical spondylosis", "Back pain", "Osteo-arthritis", "Sports injury"]
  },
  {
    id: "ipd-diabetes",
    name: "Diabetes Package",
    goal: "Monitor Blood Sugar Level",
    durationDays: 21,
    overview: "Mud therapies, obesity seminars, naturopathy diet, yoga and meditation, daily follow-ups, hydrotherapy, Ayurvedic treatment, and cooking class.",
    suggestedFor: ["Pre-diabetes", "Type 2 diabetes support", "Sedentary lifestyle", "Family history of diabetes"]
  },
  {
    id: "ipd-detox",
    name: "Detox Package",
    goal: "Cleansing De-Addiction",
    durationDays: 21,
    overview: "Initial and final consultation, preparation phase, pre-cleansing, master cleansing, post detox phase, and regeneration phase.",
    suggestedFor: ["Obesity", "Weak immunity", "Alcohol or smoking addiction", "Fatty liver", "Sleep disturbance", "Digestive disorders"]
  },
  {
    id: "ipd-stress-management",
    name: "Stress Management Package",
    goal: "Let Body And Soul Come To Rest",
    durationDays: 14,
    overview: "Yoga and meditation, mindfulness, naturopathy diet, stress workshops, daily follow-ups, deep relaxation, Ayurvedic treatment, and Vichy shower.",
    suggestedFor: ["Stress", "Burnout", "Insomnia", "Muscular tension", "Anxiety", "Neck and shoulder problems"]
  },
  {
    id: "ipd-weight-management",
    name: "Weight Management",
    goal: "Weight Loss/Weight Gain",
    durationDays: 28,
    overview: "Colon therapy, cooking class, yoga and meditation, naturopathy diet, obesity seminars, daily follow-ups, hydrotherapy, Ayurvedic treatment, and mud therapies.",
    suggestedFor: ["Overweight", "Digestive problems", "High cholesterol", "Type II diabetes", "Hypertension", "Joint pain during movement"]
  },
  {
    id: "ipd-womens-health",
    name: "Women's Health Care Package",
    goal: "Balancing The Aggravated Dosha",
    durationDays: 21,
    overview: "Internal medication, local therapies, hydrotherapies, daily follow-ups, external therapies, diet/lifestyle modification, yogasan, pranayama, and meditation.",
    suggestedFor: ["Irregular periods", "Insomnia", "Anxiety", "UTI", "Hot flashes", "Mood swings", "Support healthy conception"]
  },
  {
    id: "ipd-rejuvenation",
    name: "Rejuvenation Package",
    goal: "Recovery, Vitalization",
    durationDays: 14,
    overview: "Panchakarma treatment, metabolic therapy, daily follow-ups, yoga and meditation, doctor's consultation, and naturopathic diet.",
    suggestedFor: ["Listlessness", "Powerlessness", "Cervical pain", "Exhaustion", "Muscular tension"]
  }
];

export const invoiceProfiles = {
  pharmacy: {
    sellerName: "SU-RA MEDICAL STORES",
    addressLines: ["NEHA NAGAR MAKRONIYA SAGAR (M.P)", "PIN - 470004"],
    phone: "07582-357300",
    website: "shantiratnam.com",
    email: "shantiratnam@gmail.com",
    gstin: "23BISPB2894Q1ZJ",
    invoiceTitle: "GST INVOICE",
    terms: [
      "MEDICINE ONCE PREPARED AND SOLD WILL NOT BE TAKEN BACK OR EXCHANGED.",
      "All disputes subject to SAGAR jurisdiction only."
    ]
  },
  hospital: {
    sellerName: "SR-AIIMS Hospital",
    addressLines: ["Sagar, Madhya Pradesh"],
    phone: "",
    website: "shantiratnam.com",
    email: "",
    gstin: "",
    invoiceTitle: "HOSPITAL INVOICE",
    terms: ["All billing corrections require accounts approval."]
  }
};

export const approvalPolicy = {
  discount: {
    allowedRoles: ["admin", "accounts"],
    reasonRequired: true,
    highValueThreshold: 1000,
    highValueApprovalRole: "admin"
  },
  refund: {
    allowedRoles: ["admin", "accounts"],
    reasonRequired: true,
    approvalRequired: true,
    approvalRole: "admin"
  }
};

export const notificationTemplates = {
  appointmentConfirmation: {
    channel: "sms_or_whatsapp",
    enabled: false,
    template: "Dear {patientName}, your appointment with {doctorName} is booked for {appointmentDate} at {appointmentTime}."
  },
  paymentReceipt: {
    channel: "sms_or_whatsapp",
    enabled: false,
    template: "Dear {patientName}, payment of Rs. {amount} received against {billNumber}. Thank you."
  }
};

export const staffWorkSchedules = [
  { name: "Ms. Rekha Rajak", workingTime: "10-2, 3-closing", breakTime: "2-3", weekOff: "" },
  { name: "Mr Vijendra Rathod", workingTime: "8-1, 3-7:30", breakTime: "1-3", weekOff: "Sun" },
  { name: "Ms Aarti Chakravarti", workingTime: "10-2:30, 3:30-closing", breakTime: "2:30-3:30", weekOff: "Tue" },
  { name: "Mr Khilan", workingTime: "8-12, 1-6:30", breakTime: "12-1", weekOff: "Sat" },
  { name: "Satyam Namdev", workingTime: "9-12, 1:30-7:30", breakTime: "12-1:30", weekOff: "Fri" },
  { name: "Mr Yogesh Lariya", workingTime: "8-12, 3-8", breakTime: "12-3", weekOff: "Sun" },
  { name: "Mrs Gayatri", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Sun" },
  { name: "Mrs Neetu Sharma", workingTime: "9:30-3, 4-7:30", breakTime: "3-4", weekOff: "" },
  { name: "Mrs Rajni Sen", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Mon" },
  { name: "Mr Khilan", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Sat", note: "Second schedule entry provided for the same staff name." },
  { name: "Mr Suraj Raikwar", workingTime: "9-12, 2-closing", breakTime: "12-2", weekOff: "Fri" },
  { name: "Mr Rishi Jain", workingTime: "10-2, 3-closing", breakTime: "2-3", weekOff: "Sun" },
  { name: "Dr Senthil Kumar", workingTime: "9-1:30, 3:30-closing", breakTime: "1:30-3:30", weekOff: "" },
  { name: "Dr Riya Bhargav", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Tue" },
  { name: "Mr Pradeep Jain", workingTime: "9-2:30, 3:30-closing", breakTime: "", weekOff: "1st & 3rd Sun" },
  { name: "Ms Khushboo Gova", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Fri-Sun" },
  { name: "Mrs Preeti Patel", workingTime: "9-1, 2-7", breakTime: "1-2", weekOff: "Sun" },
  { name: "Mrs Sabnam", workingTime: "8:30-6", breakTime: "12-1", weekOff: "Fri" },
  { name: "Mrs Jyoti Ahirwar", workingTime: "8:30-6", breakTime: "12-1", weekOff: "Wed" }
];

// Rates transcribed from "Updated Panchakarma, Naturopathy & Yoga Rate List 2026"
// (Shanti Ratnam). Order and section headings follow the printed sheet, so the
// serial numbers here line up with the rate card the desk works from.
export const panchkarmaTherapyRates = [
  ["SARVANG ABHYANG", 1100, "Abhyanga Therapies"],
  ["SARVANG SWEDAN", 600, "Abhyanga Therapies"],
  ["LOCAL ABHYANGA", 500, "Abhyanga Therapies"],
  ["LOCAL SWEDAN", 350, "Abhyanga Therapies"],
  ["ARDHANG ABHYANG", 750, "Abhyanga Therapies"],
  ["ARDHANG SWEDAN", 400, "Abhyanga Therapies"],
  ["KATI VASTI", 600, "Local Vastis"],
  ["GREEVA VASTI", 600, "Local Vastis"],
  ["PRUSHTA VASTI", 1900, "Local Vastis"],
  ["JANU VASTI", 900, "Local Vastis"],
  ["LOCAL PICHU", 600, "Local Vastis"],
  ["ANUVASAN VASTI", 600, "Basti Karma"],
  ["KASHAYA VASTI / ASTHAPAN VASTI", 1100, "Basti Karma"],
  ["TIKTA KSHEERA VASTI", 1100, "Basti Karma"],
  ["SANDHANEEYA KSHEER VASTI", 1200, "Basti Karma"],
  ["MADHU TAILIK VASTI", 1100, "Basti Karma"],
  ["VAITARAN VASTI", 600, "Basti Karma"],
  ["RAJAYAPANA VASTI", 1600, "Basti Karma"],
  ["UTTARA VASTI", 650, "Basti Karma"],
  ["YONI POORANA", 650, "Basti Karma"],
  ["SARVANGAN SWEDA", 600, "Swedana Therapies"],
  ["ARDHANGAN SWEDA", 400, "Swedana Therapies"],
  // The printed list carries LOCAL SWEDAN twice, once under Abhyanga and again
  // here; the suffix keeps the two rows distinguishable in the picker.
  ["LOCAL SWEDAN (SWEDANA)", 350, "Swedana Therapies"],
  ["KASHAYA SWEDAN (LOCAL)", 400, "Swedana Therapies"],
  ["KASHAYA SWEDAN (SARVANGA)", 800, "Swedana Therapies"],
  ["KSHEERA DHOOMA (LOCAL)", 450, "Swedana Therapies"],
  ["KSHEERA DHOOMA (SARVANGA)", 800, "Swedana Therapies"],
  ["CPS (DRY) / PODIKIZHI", 800, "Swedana Therapies"],
  ["CPS (DHANYAMLA)", 1100, "Swedana Therapies"],
  ["CPS (OIL)", 1600, "Swedana Therapies"],
  ["PPS (PATRA PINDA SWEDAN)", 1600, "Swedana Therapies"],
  ["JPS (JAMBEER PINDA SWEDAN) / NARANGA KIZHI", 1900, "Swedana Therapies"],
  ["NAVARA KIZHI", 2500, "Swedana Therapies"],
  ["KASHAYA DHARA (WHOLE BODY)", 1900, "Swedana Therapies"],
  ["KSHEERA KASHAYA (WHOLE BODY)", 2200, "Swedana Therapies"],
  ["DHANYAMLADHARA", 1600, "Swedana Therapies"],
  ["TAKRA DHARA (WHOLE BODY)", 2500, "Swedana Therapies"],
  ["AVAGAHA (PLAIN) / HIP BATH", 400, "Swedana Therapies"],
  ["AVAGAHA (KASHAYA)", 650, "Swedana Therapies"],
  ["AVAGAHA (OIL)", 1900, "Swedana Therapies"],
  ["PIZHICHIL (WHOLE BODY)", 1900, "Swedana Therapies"],
  ["YONI KSHALANA", 250, "Swedana Therapies"],
  ["VRANA SEKA", 400, "Swedana Therapies"],
  ["VICHY SHOWER", 1250, "Swedana Therapies"],
  ["UDWARTAN", 950, "Swedana Therapies"],
  ["SHIRO PICHU", 300, "Urdhwanga"],
  ["SIRO VASTI", 1400, "Urdhwanga"],
  ["SIRO DHARA - KASHAYA", 1600, "Urdhwanga"],
  ["SIRO DHARA - OIL", 1600, "Urdhwanga"],
  ["SIRODHARA - TAKRA", 1600, "Urdhwanga"],
  ["SIRODHARA - KSHEERA", 1600, "Urdhwanga"],
  ["LEPA (LOCAL)", 300, "Urdhwanga"],
  ["JANU LEPA", 300, "Urdhwanga"],
  ["LOCAL LEPA (OIL)", 300, "Urdhwanga"],
  ["VAMANA", 6200, "Urdhwanga"],
  ["VIRECHANA", 6500, "Urdhwanga"],
  ["NASYA", 200, "Urdhwanga"],
  ["AGNIKARMA", 600, "Urdhwanga"],
  ["KARNA POORANAM", 400, "Urdhwanga"],
  ["AKSHI TARPANAM / NETRA TARPANAM", 800, "Urdhwanga"],
  ["AKSHI DHARA", 400, "Urdhwanga"],
  ["PUTAPAKA", 800, "Urdhwanga"],
  ["COLON HYDRO THERAPY", 5000, "Naturopathy & Yoga"],
  ["ACUPUNCTURE", 400, "Naturopathy & Yoga"],
  ["CHIROPRACTIC", 500, "Naturopathy & Yoga"],
  ["MARMA THERAPY", 500, "Naturopathy & Yoga"],
  ["HEAL THERAPY", 200, "Naturopathy & Yoga"],
  ["TENS THERAPY", 200, "Naturopathy & Yoga"],
  ["CUPPING THERAPY", 400, "Naturopathy & Yoga"],
  ["ACUPRESSURE", 400, "Naturopathy & Yoga"],
  ["TRACTION", 400, "Naturopathy & Yoga"],
  ["PRIVATE YOGA", 500, "Naturopathy & Yoga"],
  ["GENRAL YOGA (MONTHLY)", 1500, "Naturopathy & Yoga"],
  ["RAKTAMOKSHAN", 1000, "Naturopathy & Yoga"],
  ["MUD PACK", 250, "Naturopathy & Yoga"],
  ["NABHI CORRECTION", 100, "Naturopathy & Yoga"],
  ["JAL NETI & EYE WASH", 200, "Naturopathy & Yoga"],
  ["DHUPAM", 100, "Naturopathy & Yoga"]
].map(([name, price, section], index) => ({
  id: `therapy-${String(index + 1).padStart(3, "0")}`,
  code: `PK-${String(index + 1).padStart(3, "0")}`,
  name,
  category: section,
  defaultDurationMinutes: 45,
  price,
  roomType: "therapy",
  requiresRecovery: false,
  description: `${name} as per SR-AIIMS Panchakarma, Naturopathy and Yoga rate list 2026.`
}));
