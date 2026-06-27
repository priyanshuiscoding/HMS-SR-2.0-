import crypto from "crypto";

import { departments, demoUsers, roles } from "../config/constants.js";
import { consultationCharge, ipdWardCharges, panchkarmaTherapyRates } from "../config/hospitalData.js";
import { godownInventoryImport } from "./generated/godownInventory.generated.js";

function createPatientNumber(number) {
  return String(number).padStart(6, "0");
}

function currentYear() {
  return new Date().getFullYear();
}

function currentYearSuffix() {
  return String(currentYear()).slice(-2);
}

export function createId() {
  return crypto.randomUUID();
}

const doctorLookup = demoUsers.filter((user) => user.role === roles.DOCTOR);
const primaryAdmin = demoUsers.find((user) => user.role === roles.ADMIN) || demoUsers[0];
const primaryReceptionist = demoUsers.find((user) => user.role === roles.RECEPTION) || primaryAdmin;
const primaryPharmacist = demoUsers.find((user) => user.role === roles.PHARMACY) || primaryAdmin;
const today = new Date().toISOString().slice(0, 10);
const meeraPatientId = createId();
const rajeshPatientId = createId();
const sambhaviPatientId = createId();
const meeraAppointmentId = createId();
const meeraVisitId = createId();
const meeraAssessmentId = createId();
const meeraPrescriptionId = createId();
const meeraLabOrderId = createId();
const meeraBillId = createId();
const meeraDispenseId = createId();
const meeraPaymentId = createId();
const panchkarmaRoomId = createId();
const generalMaleWardRoomId = createId();
const generalFemaleWardRoomId = createId();
const semiPrivateMaleWardRoomId = createId();
const semiPrivateFemaleWardRoomId = createId();
const privateWardRoomId = createId();
const generalMaleWardBedTwoId = createId();
const rajeshAdmissionId = createId();
const abhyangaTherapyId = panchkarmaTherapyRates.find((therapy) => therapy.name === "SARVANG ABHYANG")?.id || "therapy-001";
const patraPindaTherapyId = panchkarmaTherapyRates.find((therapy) => therapy.name === "PATRA PINDA SWEDAN")?.id || "therapy-031";
const shirodharaTherapyId = panchkarmaTherapyRates.find((therapy) => therapy.name === "SIRO DHARA")?.id || "therapy-048";
const katiBastiTherapyId = panchkarmaTherapyRates.find((therapy) => therapy.name === "KATI VASTI")?.id || "therapy-007";
const meeraTherapyScheduleId = createId();
const rajeshTherapyScheduleId = createId();
const generalWardCharge = ipdWardCharges.find((ward) => ward.roomType === "general")?.chargePerDay || 1500;
const semiPrivateWardCharge = ipdWardCharges.find((ward) => ward.roomType === "semi_private")?.chargePerDay || 2500;
const privateWardCharge = ipdWardCharges.find((ward) => ward.roomType === "private")?.chargePerDay || 3500;

function createWardBeds(roomId, prefix, totalBeds, options = {}) {
  return Array.from({ length: totalBeds }, (_, index) => {
    const bedIndex = index + 1;
    const occupied = options.occupiedBedNumber === bedIndex;

    return {
      id: occupied && options.occupiedBedId ? options.occupiedBedId : createId(),
      roomId,
      bedNumber: `${prefix}-${String(bedIndex).padStart(2, "0")}`,
      bedLabel: `Bed ${bedIndex}`,
      status: occupied ? "occupied" : "available",
      patientId: occupied ? options.patientId || null : null,
      patientName: occupied ? options.patientName || "" : "",
      assignedAt: occupied ? options.assignedAt || "" : "",
      expectedDischargeDate: occupied ? options.expectedDischargeDate || "" : "",
      note: occupied ? options.note || "" : ""
    };
  });
}

export const db = {
  patients: [
    {
      id: meeraPatientId,
      uhid: `SRH${currentYearSuffix()}${createPatientNumber(1)}`,
      firstName: "Meera",
      lastName: "Sharma",
      dateOfBirth: "1991-07-16",
      gender: "female",
      bloodGroup: "B+",
      phone: "9876543201",
      altPhone: "9876543211",
      email: "meera.sharma@example.com",
      address: "Civil Lines, Sagar",
      city: "Sagar",
      state: "Madhya Pradesh",
      pincode: "470001",
      emergencyContactName: "Rahul Sharma",
      emergencyContactPhone: "9876543202",
      registrationDate: today,
      referredBy: "Website",
      createdBy: primaryReceptionist.id
    },
    {
      id: rajeshPatientId,
      uhid: `SRH${currentYearSuffix()}${createPatientNumber(2)}`,
      firstName: "Rajesh",
      lastName: "Patel",
      dateOfBirth: "1985-02-21",
      gender: "male",
      bloodGroup: "O+",
      phone: "9876543203",
      altPhone: "",
      email: "rajesh.patel@example.com",
      address: "Makronia, Sagar",
      city: "Sagar",
      state: "Madhya Pradesh",
      pincode: "470004",
      emergencyContactName: "Pooja Patel",
      emergencyContactPhone: "9876543204",
      registrationDate: today,
      referredBy: "Walk-in",
      createdBy: primaryReceptionist.id
    },
    {
      id: sambhaviPatientId,
      uhid: `SRH${currentYearSuffix()}${createPatientNumber(3)}`,
      registrationNumber: "5594",
      opdIpdNumber: "5594",
      patientType: "follow_up",
      title: "Miss",
      firstName: "Sambhavi",
      lastName: "Mishra",
      fullName: "Sambhavi Mishra",
      dateOfBirth: "",
      ageYears: 17,
      gender: "female",
      bloodGroup: "",
      maritalStatus: "single",
      occupation: "",
      phone: "9891771615",
      altPhone: "",
      email: "",
      houseStreet: "",
      areaVillage: "",
      address: "",
      cityDistrict: "",
      city: "",
      state: "",
      pincode: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      registrationDate: "2026-03-29",
      registrationTime: "12:39",
      referredBy: "Imported from OPD case sheet PDF",
      createdBy: primaryReceptionist.id,
      sourceDocument: "patient data/5594 29-Mar-2026 12-39-48.pdf",
      clinicalNotes: [
        "Scanned OPD case sheet OCR extracted.",
        "Readable details confirmed: female, age 17, reg/UHID 5594, mobile 9891771615.",
        "Handwritten complaints suggest weakness, fatigue/tiredness, mood changes, palpitations, constipation, headache, and white discharge, but some text remains partially unclear."]
    }
  ],
  appointments: [
    {
      id: createId(),
      appointmentNumber: `APT-${currentYear()}-00001`,
      patientId: null,
      patientName: "New Website Lead",
      doctorId: doctorLookup[0]?.id,
      appointmentDate: today,
      appointmentTime: "10:30",
      type: "new",
      department: "Neuro Pain Management",
      status: "confirmed",
      chiefComplaint: "Neck pain and migraine episodes",
      tokenNumber: 1,
      bookedBy: primaryReceptionist.id,
      source: "Website",
      smsSent: false
    },
    {
      id: createId(),
      appointmentNumber: `APT-${currentYear()}-00002`,
      patientId: null,
      patientName: "Rohit Verma",
      doctorId: doctorLookup[2]?.id,
      appointmentDate: today,
      appointmentTime: "12:10",
      type: "follow_up",
      department: "Yoga And Naturopathy Department",
      status: "scheduled",
      chiefComplaint: "Lifestyle correction review",
      tokenNumber: 2,
      bookedBy: primaryReceptionist.id,
      source: "Call",
      smsSent: false
    },
    {
      id: meeraAppointmentId,
      appointmentNumber: `APT-${currentYear()}-00003`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      doctorId: doctorLookup[0]?.id,
      appointmentDate: today,
      appointmentTime: "09:20",
      type: "follow_up",
      department: "Neuro Pain Management",
      status: "completed",
      chiefComplaint: "Persistent cervical stiffness with headache flare",
      tokenNumber: 3,
      bookedBy: primaryReceptionist.id,
      source: "Website",
      smsSent: true
    }
  ],
  opdVisits: [
    {
      id: meeraVisitId,
      opdNumber: `OPD-${currentYear()}-00001`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      doctorId: doctorLookup[0]?.id,
      appointmentId: meeraAppointmentId,
      visitDate: today,
      visitType: "follow_up",
      chiefComplaint: "Neck pain and migraine episodes",
      vitalsBp: "130/84",
      vitalsPulse: 82,
      vitalsTemp: 98.4,
      vitalsWeight: 74,
      vitalsHeight: 171,
      vitalsSpo2: 98,
      vitalsRr: 17,
      status: "completed",
      consultationFee: consultationCharge
    }
  ],
  ayurvedaAssessments: [
    {
      id: meeraAssessmentId,
      patientId: meeraPatientId,
      visitId: meeraVisitId,
      doctorId: doctorLookup[0]?.id,
      assessmentDate: today,
      prakritiVata: 7,
      prakritiPitta: 5,
      prakritiKapha: 3,
      prakritiDominant: "Vata",
      nadiPariksha: "Vata aggravation with cervical stiffness and sleep disturbance.",
      nadiType: "Vataja",
      agniStatus: "vishama",
      koshthaNature: "krura",
      vikritiAssessment: "Vata predominance with stress-linked flare up.",
      observations: "Recommend posture correction and abhyanga support."
    }
  ],
  prescriptions: [
    {
      id: meeraPrescriptionId,
      prescriptionNumber: `RX-${currentYear()}-00001`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      doctorId: doctorLookup[0]?.id,
      visitId: meeraVisitId,
      prescriptionDate: today,
      diagnosis: "Cervical spondylosis with stress-triggered migraine",
      diagnosisAyurvedic: "Manya graha with vata prakopa",
      nidana: "Poor posture, irregular sleep, excessive screen strain",
      samprapti: "Vata aggravation leading to neck stiffness and headache episodes.",
      chikitsaSutra: "Vata shamana, srotoshodhana, nidra normalization",
      dietRecommendations: "Warm food, hydration, avoid late-night meals and cold exposure",
      followUpDate: today,
      isDispensed: true,
      medicines: [
        {
          id: createId(),
          medicineId: "med-001",
          medicineName: "Mahayograj Guggulu",
          dose: "1 tab",
          frequency: "BD",
          route: "oral",
          timing: "After food",
          durationDays: 10,
          anupana: "Warm water",
          quantityDispensed: 20,
          specialInstructions: "Continue neck mobility exercises"
        }
      ]
    }
  ],
  labTestMasters: [
    {
      id: "lab-001",
      code: "CBC",
      name: "Complete Blood Count",
      department: "General Lab",
      price: 350,
      normalRange: "As per age and gender"
    },
    {
      id: "lab-002",
      code: "ESR",
      name: "ESR",
      department: "General Lab",
      price: 220,
      normalRange: "0-20 mm/hr"
    },
    {
      id: "lab-003",
      code: "BSF",
      name: "Blood Sugar Fasting",
      department: "Biochemistry",
      price: 180,
      normalRange: "70-100 mg/dL"
    },
    {
      id: "lab-004",
      code: "TSH",
      name: "TSH",
      department: "Hormonal",
      price: 450,
      normalRange: "0.4-4.0 mIU/L"
    }
  ],
  labOrders: [
    {
      id: meeraLabOrderId,
      orderNumber: `LAB-${currentYear()}-00001`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      orderedBy: doctorLookup[0]?.id,
      visitId: meeraVisitId,
      orderDate: today,
      priority: "routine",
      status: "reported",
      tests: [
        {
          id: createId(),
          testId: "lab-001",
          testName: "Complete Blood Count",
          result: "Within normal limits",
          remarks: "Mild stress markers noted"
        }
      ],
      reportUrl: "",
      sampleCollectionTime: `${today}T10:05:00`
    }
  ],
  bills: [
    {
      id: meeraBillId,
      billNumber: `BILL-${currentYear()}-00001`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      visitId: meeraVisitId,
      billType: "opd",
      billDate: today,
      subtotal: 550,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 550,
      paidAmount: 550,
      paymentStatus: "paid",
      createdBy: primaryAdmin.id,
      notes: "Follow-up consultation with CBC charge included.",
      items: [
        {
          id: createId(),
          description: "OPD Consultation Fee",
          category: "consultation",
          quantity: 1,
          unitPrice: consultationCharge,
          amount: consultationCharge
        },
        {
          id: createId(),
          description: "CBC",
          category: "lab",
          quantity: 1,
          unitPrice: 350,
          amount: 350
        }
      ]
    }
  ],
  payments: [
    {
      id: meeraPaymentId,
      receiptNumber: `RCT-${currentYear()}-00001`,
      billId: meeraBillId,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      paymentDate: `${today}T11:25:00`,
      amount: 550,
      paymentMode: "upi",
      referenceNumber: "UPI-SR-10231",
      receivedBy: primaryAdmin.id,
      note: "Collected at billing desk after consultation."
    }
  ],
  rooms: [
    {
      id: panchkarmaRoomId,
      roomNumber: "PK-201",
      ward: "Panchkarma Therapy",
      roomType: "therapy",
      floor: "Second Floor",
      chargePerDay: semiPrivateWardCharge,
      nursingStation: "Therapy Block",
      notes: "Suitable for supervised therapy recovery."
    },
    {
      id: generalMaleWardRoomId,
      roomNumber: "GMW-001",
      ward: "General Male Ward",
      roomType: "general",
      floor: "Ground Floor",
      chargePerDay: generalWardCharge,
      nursingStation: "General Ward Station",
      notes: "10-bed general male ward. Package includes bed charges and diet only."
    },
    {
      id: generalFemaleWardRoomId,
      roomNumber: "GFW-001",
      ward: "General Female Ward",
      roomType: "general",
      floor: "Ground Floor",
      chargePerDay: generalWardCharge,
      nursingStation: "General Ward Station",
      notes: "6-bed general female ward. Package includes bed charges and diet only."
    },
    {
      id: semiPrivateMaleWardRoomId,
      roomNumber: "SPMW-001",
      ward: "Semi Private Male Ward",
      roomType: "semi_private",
      floor: "First Floor",
      chargePerDay: semiPrivateWardCharge,
      nursingStation: "Semi Private Ward Station",
      notes: "5-bed semi-private male ward. Package includes bed charges and diet only."
    },
    {
      id: semiPrivateFemaleWardRoomId,
      roomNumber: "SPFW-001",
      ward: "Semi Private Female Ward",
      roomType: "semi_private",
      floor: "First Floor",
      chargePerDay: semiPrivateWardCharge,
      nursingStation: "Semi Private Ward Station",
      notes: "2-bed semi-private female ward. Package includes bed charges and diet only."
    },
    {
      id: privateWardRoomId,
      roomNumber: "PR-001",
      ward: "Private Ward",
      roomType: "private",
      floor: "First Floor",
      chargePerDay: privateWardCharge,
      nursingStation: "Private Ward Station",
      notes: "4 private beds. Package includes bed charges and diet only."
    }
  ],
  beds: [
    {
      id: createId(),
      roomId: panchkarmaRoomId,
      bedNumber: "PK-201-1",
      bedLabel: "Therapy Recovery Bed",
      status: "available",
      patientId: null,
      patientName: "",
      assignedAt: "",
      expectedDischargeDate: "",
      note: ""
    },
    ...createWardBeds(generalMaleWardRoomId, "GMW", 10, {
      occupiedBedNumber: 2,
      occupiedBedId: generalMaleWardBedTwoId,
      patientId: rajeshPatientId,
      patientName: "Rajesh Patel",
      assignedAt: `${today}T08:15:00`,
      expectedDischargeDate: `${currentYear()}-03-25`,
      note: "Short observation stay."
    }),
    ...createWardBeds(generalFemaleWardRoomId, "GFW", 6),
    ...createWardBeds(semiPrivateMaleWardRoomId, "SPMW", 5),
    ...createWardBeds(semiPrivateFemaleWardRoomId, "SPFW", 2),
    ...createWardBeds(privateWardRoomId, "PR", 4)
  ],
  ipdAdmissions: [
    {
      id: rajeshAdmissionId,
      admissionNumber: `IPD-${currentYear()}-00001`,
      patientId: rajeshPatientId,
      patientName: "Rajesh Patel",
      roomId: generalMaleWardRoomId,
      bedId: generalMaleWardBedTwoId,
      attendingDoctorId: doctorLookup[2]?.id || doctorLookup[0]?.id,
      admissionDate: today,
      admissionTime: "08:15",
      admissionSource: "opd",
      admissionType: "ipd",
      reasonForAdmission: "Short observation for dizziness and dehydration",
      diagnosis: "Acute weakness under observation",
      status: "active",
      expectedDischargeDate: `${currentYear()}-03-29`,
      admittedBy: primaryReceptionist.id,
      notes: [
        {
          id: createId(),
          noteDate: `${today}T08:45:00`,
          category: "admission",
          note: "Patient admitted for short monitored stay.",
          authorId: primaryReceptionist.id
        }
      ],
      vitals: [
        {
          id: createId(),
          recordedAt: `${today}T09:00:00`,
          bp: "118/76",
          pulse: 78,
          temp: 98.2,
          spo2: 99,
          rr: 18,
          weight: 68,
          notes: "Stable on admission.",
          recordedBy: primaryReceptionist.id
        }
      ],
      dischargeSummary: null,
      billId: ""
    }
  ],
  panchkarmaTherapies: panchkarmaTherapyRates,
  panchkarmaSchedules: [
    {
      id: meeraTherapyScheduleId,
      scheduleNumber: `PKS-${currentYear()}-00001`,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      therapyId: shirodharaTherapyId,
      therapyName: "SIRO DHARA",
      recommendedBy: doctorLookup[0]?.id || "",
      recommendedByName: doctorLookup[0]?.fullName || "Unassigned",
      linkedVisitId: meeraVisitId,
      prescriptionId: meeraPrescriptionId,
      therapyRoomId: panchkarmaRoomId,
      recoveryBedId: "",
      therapistId: "staff-013",
      therapistName: "Mrs. Rajni Sen",
      scheduledDate: today,
      scheduledTime: "14:30",
      estimatedDurationMinutes: 40,
      status: "scheduled",
      complaint: "Stress-linked headache with sleep disturbance",
      preparationNotes: "Light meal only. Keep scalp ready for oil-based therapy.",
      executionNotes: "",
      followUpAdvice: "",
      materialsUsed: [],
      sessionStartedAt: "",
      sessionCompletedAt: "",
      outcome: "",
      billId: "",
      billedAmount: 0,
      createdBy: primaryReceptionist.id
    },
    {
      id: rajeshTherapyScheduleId,
      scheduleNumber: `PKS-${currentYear()}-00002`,
      patientId: rajeshPatientId,
      patientName: "Rajesh Patel",
      therapyId: patraPindaTherapyId,
      therapyName: "PATRA PINDA SWEDAN",
      recommendedBy: doctorLookup[2]?.id || doctorLookup[0]?.id || "",
      recommendedByName: doctorLookup[2]?.fullName || doctorLookup[0]?.fullName || "Unassigned",
      linkedVisitId: "",
      prescriptionId: "",
      therapyRoomId: panchkarmaRoomId,
      recoveryBedId: "",
      therapistId: "staff-014",
      therapistName: "Mr. Yogesh Lariya",
      scheduledDate: today,
      scheduledTime: "11:00",
      estimatedDurationMinutes: 50,
      status: "completed",
      complaint: "Post-admission stiffness and body pain",
      preparationNotes: "Assess tolerance before fomentation.",
      executionNotes: "Completed with localized heat and post-session rest.",
      followUpAdvice: "Hydrate well and avoid cold exposure for the rest of the day.",
      materialsUsed: [
        {
          id: createId(),
          medicineId: "med-005",
          medicineName: "Nirgundi Taila",
          quantity: 1,
          unit: "bottle",
          notes: "Used for fomentation support"
        }
      ],
      sessionStartedAt: `${today}T11:05:00`,
      sessionCompletedAt: `${today}T11:58:00`,
      outcome: "Pain reduced and mobility improved after session.",
      billId: "",
      billedAmount: 1500,
      createdBy: primaryReceptionist.id
    }
  ],
  medicineMasters: [
    {
      id: "med-001",
      code: "SRA-MED-001",
      name: "Mahayograj Guggulu",
      formulation: "Tablet",
      category: "Ayurvedic Classical",
      unit: "tablet",
      reorderLevel: 40,
      price: 18,
      gstPercent: 5
    },
    {
      id: "med-002",
      code: "SRA-MED-002",
      name: "Dashmool Kwath",
      formulation: "Kwath",
      category: "Ayurvedic Classical",
      unit: "bottle",
      reorderLevel: 20,
      price: 140,
      gstPercent: 5
    },
    {
      id: "med-003",
      code: "SRA-MED-003",
      name: "Ashwagandha Churna",
      formulation: "Churna",
      category: "Ayurvedic Classical",
      unit: "jar",
      reorderLevel: 15,
      price: 165,
      gstPercent: 5
    },
    {
      id: "med-004",
      code: "SRA-MED-004",
      name: "Brahmi Vati",
      formulation: "Tablet",
      category: "Ayurvedic Classical",
      unit: "tablet",
      reorderLevel: 35,
      price: 14,
      gstPercent: 5
    },
    {
      id: "med-005",
      code: "SRA-MED-005",
      name: "Nirgundi Taila",
      formulation: "Taila",
      category: "External Therapy",
      unit: "bottle",
      reorderLevel: 12,
      price: 220,
      gstPercent: 12
    }
  ],
  suppliers: [
    {
      id: "sup-001",
      name: "Ayush Pharma Traders",
      phone: "9876500011",
      city: "Bhopal"
    },
    {
      id: "sup-002",
      name: "Kerala Wellness Distributors",
      phone: "9876500012",
      city: "Indore"
    }
  ],
  inventoryBatches: [
    {
      id: "batch-001",
      medicineId: "med-001",
      medicineName: "Mahayograj Guggulu",
      batchNumber: "MYG-2401",
      supplierId: "sup-001",
      receivedDate: today,
      expiryDate: `${currentYear() + 1}-12-31`,
      quantityReceived: 120,
      quantityAvailable: 100,
      purchasePrice: 11,
      sellingPrice: 18
    },
    {
      id: "batch-002",
      medicineId: "med-002",
      medicineName: "Dashmool Kwath",
      batchNumber: "DMK-2402",
      supplierId: "sup-002",
      receivedDate: today,
      expiryDate: `${currentYear()}-07-15`,
      quantityReceived: 18,
      quantityAvailable: 18,
      purchasePrice: 95,
      sellingPrice: 140
    },
    {
      id: "batch-003",
      medicineId: "med-003",
      medicineName: "Ashwagandha Churna",
      batchNumber: "AWC-2401",
      supplierId: "sup-001",
      receivedDate: today,
      expiryDate: `${currentYear() + 1}-10-30`,
      quantityReceived: 22,
      quantityAvailable: 8,
      purchasePrice: 108,
      sellingPrice: 165
    },
    {
      id: "batch-004",
      medicineId: "med-005",
      medicineName: "Nirgundi Taila",
      batchNumber: "NGT-2401",
      supplierId: "sup-002",
      receivedDate: today,
      expiryDate: `${currentYear()}-05-20`,
      quantityReceived: 10,
      quantityAvailable: 4,
      purchasePrice: 150,
      sellingPrice: 220
    }
  ],
  stockTransactions: [
    {
      id: createId(),
      transactionDate: `${today}T09:00:00`,
      medicineId: "med-001",
      medicineName: "Mahayograj Guggulu",
      batchId: "batch-001",
      type: "receipt",
      quantity: 120,
      referenceNumber: "GRN-2026-00001",
      note: "Opening pharmacy stock"
    },
    {
      id: createId(),
      transactionDate: `${today}T09:10:00`,
      medicineId: "med-003",
      medicineName: "Ashwagandha Churna",
      batchId: "batch-003",
      type: "receipt",
      quantity: 22,
      referenceNumber: "GRN-2026-00002",
      note: "Opening stock received"
    },
    {
      id: createId(),
      transactionDate: `${today}T09:20:00`,
      medicineId: "med-005",
      medicineName: "Nirgundi Taila",
      batchId: "batch-004",
      type: "receipt",
      quantity: 10,
      referenceNumber: "GRN-2026-00003",
      note: "External therapy stock"
    },
    {
      id: createId(),
      transactionDate: `${today}T11:58:00`,
      medicineId: "med-005",
      medicineName: "Nirgundi Taila",
      batchId: "batch-004",
      type: "therapy_issue",
      quantity: -1,
      referenceNumber: `PKS-${currentYear()}-00002`,
      note: "Patra Pinda Sweda material issue"
    }
  ],
  dispensations: [
    {
      id: meeraDispenseId,
      dispenseNumber: `DSP-${currentYear()}-00001`,
      prescriptionId: meeraPrescriptionId,
      patientId: meeraPatientId,
      patientName: "Meera Sharma",
      visitId: meeraVisitId,
      dispensedBy: primaryPharmacist.id,
      dispensedDate: `${today}T11:05:00`,
      status: "completed",
      items: [
        {
          id: createId(),
          medicineId: "med-001",
          medicineName: "Mahayograj Guggulu",
          batchId: "batch-001",
          quantity: 20,
          unitPrice: 18,
          amount: 360
        }
      ]
    }
  ]
};


function mergeImportedInventoryData() {
  const importedSuppliers = godownInventoryImport.suppliers.filter(
    (supplier) => !db.suppliers.some((existing) => existing.id === supplier.id)
  );
  const importedMedicines = godownInventoryImport.medicineMasters.filter(
    (medicine) => !db.medicineMasters.some((existing) => existing.id === medicine.id)
  );
  const importedBatches = godownInventoryImport.inventoryBatches.filter(
    (batch) => !db.inventoryBatches.some((existing) => existing.id === batch.id)
  );
  const importedTransactions = godownInventoryImport.stockTransactions.filter(
    (transaction) => !db.stockTransactions.some((existing) => existing.id === transaction.id)
  );

  db.suppliers.push(...importedSuppliers);
  db.medicineMasters.push(...importedMedicines);
  db.inventoryBatches.push(...importedBatches);
  db.stockTransactions.push(...importedTransactions);
}

mergeImportedInventoryData();

export function getDoctors() {
  return demoUsers
    .filter((user) => user.role === roles.DOCTOR)
    .map(({ password, ...doctor }) => doctor);
}

export function getTherapists() {
  return demoUsers
    .filter((user) => user.role === roles.THERAPIST)
    .map(({ password, ...therapist }) => therapist);
}

export function getUsers() {
  return demoUsers.map(({ password, ...user }) => user);
}

export function getUsersSummary() {
  const users = getUsers();
  const roleSummary = Object.values(
    users.reduce((summary, user) => {
      if (!summary[user.role]) {
        summary[user.role] = { role: user.role, count: 0 };
      }

      summary[user.role].count += 1;
      return summary;
    }, {})
  ).sort((left, right) => right.count - left.count || left.role.localeCompare(right.role));

  const departmentSummary = Object.values(
    users.reduce((summary, user) => {
      if (!summary[user.department]) {
        summary[user.department] = { department: user.department, count: 0 };
      }

      summary[user.department].count += 1;
      return summary;
    }, {})
  ).sort((left, right) => right.count - left.count || left.department.localeCompare(right.department));

  return {
    totalEmployees: users.length,
    activeEmployees: users.filter((user) => user.isActive).length,
    doctors: users.filter((user) => user.role === roles.DOCTOR).length,
    departments: departmentSummary.length,
    roles: roleSummary,
    departmentsList: departmentSummary
  };
}

export function getDepartments() {
  return departments;
}

export function nextUhid() {
  return `SRH${currentYearSuffix()}${createPatientNumber(db.patients.length + 1)}`;
}

export function nextAppointmentNumber() {
  return `APT-${currentYear()}-${String(db.appointments.length + 1).padStart(5, "0")}`;
}

export function nextOpdNumber() {
  return `OPD-${currentYear()}-${String(db.opdVisits.length + 1).padStart(5, "0")}`;
}

export function nextPrescriptionNumber() {
  return `RX-${currentYear()}-${String(db.prescriptions.length + 1).padStart(5, "0")}`;
}

export function nextLabOrderNumber() {
  return `LAB-${currentYear()}-${String(db.labOrders.length + 1).padStart(5, "0")}`;
}

export function nextIpdNumber() {
  return `IPD-${currentYear()}-${String(db.ipdAdmissions.length + 1).padStart(5, "0")}`;
}

export function nextPanchkarmaScheduleNumber() {
  return `PKS-${currentYear()}-${String(db.panchkarmaSchedules.length + 1).padStart(5, "0")}`;
}

export function nextBillNumber() {
  return `BILL-${currentYear()}-${String(db.bills.length + 1).padStart(5, "0")}`;
}

export function nextReceiptNumber() {
  return `RCT-${currentYear()}-${String(db.payments.length + 1).padStart(5, "0")}`;
}

export function nextGrnNumber() {
  const count = db.stockTransactions.filter((item) => item.type === "receipt").length + 1;
  return `GRN-${currentYear()}-${String(count).padStart(5, "0")}`;
}

export function nextDispenseNumber() {
  return `DSP-${currentYear()}-${String(db.dispensations.length + 1).padStart(5, "0")}`;
}

export function getMedicineMasters() {
  return db.medicineMasters;
}

export function getLabTestMasters() {
  return db.labTestMasters;
}

export function getSuppliers() {
  return db.suppliers;
}

export function getGodownImportSummary() {
  return godownInventoryImport.summary;
}

export function getRoomMasters() {
  return {
    roomTypes: ["general", "semi_private", "private", "deluxe", "icu", "therapy"],
    bedStatuses: ["available", "occupied", "reserved", "cleaning", "maintenance"]
  };
}





