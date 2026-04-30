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
    id: "ward-general",
    ward: "General Ward",
    roomType: "general",
    chargePerDay: 1500,
    packageIncludes: "Bed charges and diet only",
    perPerson: true
  },
  {
    id: "ward-semi-private",
    ward: "Semi Private Ward",
    roomType: "semi_private",
    chargePerDay: 2500,
    packageIncludes: "Bed charges and diet only",
    perPerson: false
  },
  {
    id: "ward-private",
    ward: "Private Ward",
    roomType: "private",
    chargePerDay: 3500,
    packageIncludes: "Bed charges and diet only",
    perPerson: true
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

export const panchkarmaTherapyRates = [
  ["SARVANG ABHYANG", 850],
  ["SARVANG SWEDAN", 500],
  ["LOCAL ABHYANGA", 425],
  ["LOCAL SWEDAN", 250],
  ["ARDHANG ABHYANG", 500],
  ["ARDHANG SWEDAN", 300],
  ["KATI VASTI", 500],
  ["GREEVA VASTI", 500],
  ["PRUSHTA VASTI", 1500],
  ["JANU VASTI", 750],
  ["LOCAL PICHU", 500],
  ["ANUVASAN VASTI", 500],
  ["KASHAYA VASTI", 850],
  ["TIKTA KSHEERA VASTI", 850],
  ["SANDHANEEYA KSHEER VASTI", 950],
  ["MADHU TAILIK VASTI", 850],
  ["VAITARAN VASTI", 500],
  ["RAJAYAPANA VASTI", 1250],
  ["UTTARA VASTI", 500],
  ["YONI POORANA", 500],
  ["SARVANGA SWEDA", 500],
  ["ARDHANGA SWEDA", 300],
  ["LOCAL SWEDA", 250],
  ["KASHAYA SWEDAN", 300],
  ["KASHAYA SWEDAN (FULL)", 600],
  ["KSHEERA DHOOMA", 350],
  ["KSHEERA DHOOMA (FULL)", 650],
  ["PODIKIZHI", 600],
  ["DHANYAMLA", 850],
  ["OIL CPS", 1250],
  ["PATRA PINDA SWEDAN", 1250],
  ["JAMBEER PINDA SWEDAN", 1500],
  ["NAVARA KIZHI", 2000],
  ["KASHAYA DHARA", 1500],
  ["KSHEERA DHARA", 1750],
  ["DHANYAMLADHARA", 1250],
  ["TAKRA DHARA", 2000],
  ["AVAGAHA", 300],
  ["AVAGAHA KASHAYA", 500],
  ["AVAGAHA OIL", 1500],
  ["PIZHICHIL", 1500],
  ["YONI KSHALANA", 200],
  ["VRANA SEKA", 300],
  ["VICHY SHOWER", 1000],
  ["UDWARTAN", 750],
  ["SHIRO PICHU", 250],
  ["SIRO VASTI", 1120],
  ["SIRO DHARA", 1250],
  ["SIRO DHARA OIL", 1250],
  ["SIRODHARA TAKRA", 1250],
  ["SIRODHARA KSHEERA", 1250],
  ["LEPA", 250],
  ["JANU LEPA", 250],
  ["LOCAL LEPA", 250],
  ["VAMANA", 5000],
  ["VIRECHANA", 2000],
  ["NASYA", 200],
  ["AGNIKARMA", 500],
  ["KARNA POORANAM", 300],
  ["AKSHI TARPANAM", 600],
  ["AKSHI DHARA", 350],
  ["PUTAPAKA", 600],
  ["COLON HYDRO THERAPY", 3000],
  ["ACUPUNCTURE", 300],
  ["CHIROPRACTIC", 400],
  ["MARMA THERAPY", 400],
  ["HEAL THERAPY", 100],
  ["TENS THERAPY", 100],
  ["CUPPING THERAPY", 300],
  ["ACUPRESSURE", 300],
  ["TRACTION", 300],
  ["PRIVATE YOGA", 400]
].map(([name, price], index) => ({
  id: `therapy-${String(index + 1).padStart(3, "0")}`,
  code: `PK-${String(index + 1).padStart(3, "0")}`,
  name,
  category: "Panchkarma & Therapy",
  defaultDurationMinutes: 45,
  price,
  roomType: "therapy",
  requiresRecovery: false,
  description: `${name} therapy as per SR-AIIMS Panchakarma and Therapy rate list.`
}));
