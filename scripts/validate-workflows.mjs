import { db } from "../backend/src/data/store.js";
import { createAppointment, getAvailableSlots } from "../backend/src/modules/appointments/appointments.service.js";
import { createBill, collectPayment } from "../backend/src/modules/billing/billing.service.js";
import { admitPatient, addAdmissionNote, addAdmissionVitals, dischargeAdmission, loadIpdMirrorsFromDatabase } from "../backend/src/modules/ipd/ipd.service.js";
import { collectLabSample, createLabOrder, getLabMasters, getLabOrderDetails, saveLabResults } from "../backend/src/modules/laboratory/laboratory.service.js";
import { saveAssessment, completeVisit, createVisit, saveDischargeSummary, savePrescription, saveVitals } from "../backend/src/modules/opd/opd.service.js";
import { completePanchkarmaSession, createPanchkarmaSchedule, getPanchkarmaMasters, startPanchkarmaSession } from "../backend/src/modules/panchkarma/panchkarma.service.js";
import { dispensePrescription } from "../backend/src/modules/pharmacy/pharmacy.service.js";
import { createPatient, getPatientHistory } from "../backend/src/modules/patients/patients.service.js";
import { createRoom } from "../backend/src/modules/rooms/rooms.service.js";
import {
  getDailyOpdReport,
  getIpdCensusReport,
  getLabWorkloadReport,
  getPanchkarmaStatsReport,
  getPharmacySalesReport,
  getReportsOverview,
  getRevenueReport
} from "../backend/src/modules/reports/reports.service.js";
import { listDoctors, listUsers } from "../backend/src/modules/users/users.service.js";
import { query } from "../backend/src/config/postgres.js";

const results = [];
const today = new Date().toISOString().slice(0, 10);
const runId = String(Date.now()).slice(-6);
const users = await listUsers({ includeInactive: true });
const persistedDoctors = await listDoctors();
const actor = users.find((user) => user.role === "admin") || users[0];
const persistedDoctorId = persistedDoctors[0]?.id;
const mirrorDoctorId = db.appointments[0]?.doctorId;
let slotCursor = 0;
let patientCursor = 0;

if (!actor?.id || !persistedDoctorId || !mirrorDoctorId) {
  throw new Error("Workflow validation requires seeded users and doctors.");
}

await loadIpdMirrorsFromDatabase();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function nextAvailableSlot() {
  const response = await getAvailableSlots(today, persistedDoctorId);
  const slots = response.filter((slot) => !slot.isBooked);
  const slot = slots[slotCursor];
  slotCursor += 1;

  if (!slot) {
    throw new Error("No appointment slots available for workflow validation.");
  }

  return slot.time;
}

async function registerPatient(suffix, overrides = {}) {
  patientCursor += 1;
  return createPatient(
    {
      firstName: "Validate",
      lastName: suffix,
      phone: `9010${runId}${String(patientCursor).padStart(3, "0")}`,
      dateOfBirth: "1992-05-04",
      gender: "female",
      houseStreet: "Validation Street",
      cityDistrict: "Sagar",
      state: "Madhya Pradesh",
      ...overrides
    },
    actor.id
  );
}

async function stockedMedicineIdForValidation() {
  const stocked = await query(
    `
    SELECT m.id
    FROM medicine_masters m
    JOIN inventory_batches b ON b.medicine_id = m.id
    WHERE m.is_active = true
      AND b.quantity_available >= 1
    ORDER BY m.name ASC
    LIMIT 1
    `
  );

  if (stocked.rows[0]?.id) {
    return stocked.rows[0].id;
  }

  const medicine = await query("SELECT id, name, selling_price FROM medicine_masters WHERE is_active = true ORDER BY name ASC LIMIT 1");
  const item = medicine.rows[0];
  if (!item?.id) {
    return "";
  }

  await query(
    `
    INSERT INTO inventory_batches (
      medicine_id, medicine_name, batch_number, received_date, quantity_received, quantity_available, purchase_price, selling_price, metadata
    )
    VALUES ($1, $2, $3, $4, 5, 5, 0, $5, $6::jsonb)
    `,
    [item.id, item.name, `VAL-${runId}`, today, item.selling_price || 0, JSON.stringify({ validationSeed: true })]
  );

  return item.id;
}

async function run(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: "passed", detail });
  } catch (error) {
    results.push({ name, status: "failed", detail: error.message });
  }
}

await run("Register patient to OPD billing flow", async () => {
  const patient = await registerPatient("Opd");
  const medicineId = await stockedMedicineIdForValidation();
  const appointment = await createAppointment(
    {
      patientId: patient.id,
      doctorId: persistedDoctorId,
      appointmentDate: today,
      appointmentTime: await nextAvailableSlot(),
      department: "Clinical Department",
      chiefComplaint: "Fatigue and stiffness"
    },
    actor.id
  );
  const visit = await createVisit({ appointmentId: appointment.id });
  await saveVitals(visit.id, { vitalsBp: "120/80", vitalsPulse: 74, vitalsTemp: 98.4 });
  await saveAssessment(visit.id, { prakritiDominant: "Vata", observations: "Stable" }, persistedDoctorId);
  const prescription = await savePrescription(
    visit.id,
    {
      diagnosis: "General fatigue",
      dietRecommendations: "Light warm diet",
      followUpDate: today,
      metadata: {
        dietPlan: { recommendedDiet: "Light warm diet", foodsToInclude: "Moong soup", foodsToAvoid: "Cold drinks" }
      },
      medicines: [{ medicineId, quantityDispensed: 1, dose: "1 tab", frequency: "BD", durationDays: 5 }]
    },
    persistedDoctorId
  );
  const dischargeSummary = await saveDischargeSummary(
    visit.id,
    {
      status: "forwarded",
      clinicalCourse: "OPD treatment completed and patient discharged with advice.",
      finalDiagnosis: "General fatigue",
      conditionOnDischarge: "stable",
      advice: "Continue medicines and diet plan.",
      followUpDate: today
    },
    persistedDoctorId
  );
  const labMasters = await getLabMasters();
  assert(labMasters.tests[0]?.id, "Expected at least one lab test master for validation.");
  await createLabOrder({ visitId: visit.id, patientId: patient.id, patientName: patient.fullName, orderedBy: actor.id, tests: [labMasters.tests[0].id] });
  await completeVisit(visit.id);
  const bill = await createBill({
    patientId: patient.id,
    visitId: visit.id,
    billType: "opd",
    items: [{ description: "Consultation", category: "consultation", quantity: 1, unitPrice: 500 }]
  });
  const payment = await collectPayment(bill.id, { amount: 250, paymentMode: "cash", receivedBy: actor.id });
  const dispensation = await dispensePrescription(prescription.id, { items: [{ medicineId, quantity: 1 }] }, actor.id);

  assert(payment.bill.paymentStatus === "partial", "Expected OPD bill to become partial after payment.");
  assert(dispensation.items.length === 1, "Expected prescription dispense item to be created.");
  assert(dischargeSummary.status === "forwarded", "Expected OPD discharge summary to be forwarded.");

  return `Patient ${patient.uhid}, visit ${visit.opdNumber}, discharge ${dischargeSummary.summaryNumber}, bill ${bill.billNumber}`;
});

await run("Laboratory collection to reporting flow", async () => {
  const patient = await registerPatient("Lab", { gender: "male", dateOfBirth: "1991-03-14" });
  const appointment = await createAppointment(
    {
      patientId: patient.id,
      doctorId: persistedDoctorId,
      appointmentDate: today,
      appointmentTime: await nextAvailableSlot(),
      department: "Clinical Department",
      chiefComplaint: "Needs investigations"
    },
    actor.id
  );
  const visit = await createVisit({ appointmentId: appointment.id });
  const labMasters = await getLabMasters();
  const selectedTests = labMasters.tests.slice(0, 2);
  assert(selectedTests.length >= 2, "Expected at least two lab test masters for validation.");
  const order = await createLabOrder({
    visitId: visit.id,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    orderedBy: actor.id,
    tests: selectedTests.map((test) => test.id)
  });
  await collectLabSample(order.id, { sampleType: "blood" }, actor.id);
  await saveLabResults(
    order.id,
    {
      processingSummary: "CBC and ESR processed successfully",
      markReported: true,
      tests: [
        { testId: selectedTests[0].id, result: "Normal", resultFlag: "normal", remarks: "Within range" },
        { testId: selectedTests[1].id, result: "18 mm/hr", resultFlag: "borderline", remarks: "Slightly elevated" }
      ]
    },
    actor.id
  );
  await createBill({
    patientId: patient.id,
    visitId: visit.id,
    billType: "lab",
    createdBy: actor.id,
    charges: [{ source: "lab", sourceId: order.id }]
  });
  const detail = await getLabOrderDetails(order.id);

  assert(detail.status === "reported", "Expected lab order to be reported.");
  assert(detail.billId, "Expected lab order to have a bill.");
  assert(detail.reportUrl, "Expected reported lab order to have a report URL.");

  return `Order ${detail.orderNumber}, bill ${detail.billId}`;
});

await run("IPD admission to discharge billing flow", async () => {
  const patient = await registerPatient("Ipd", { gender: "male", dateOfBirth: "1988-08-12" });
  let room = db.rooms.find((entry) => entry.roomType === "private" && db.beds.some((bed) => bed.roomId === entry.id && bed.status === "available"));
  let bed = room ? db.beds.find((entry) => entry.roomId === room.id && entry.status === "available") : null;

  if (!room || !bed) {
    const createdRoom = await createRoom({
      roomNumber: `VAL-${runId}`,
      roomType: "private",
      floor: "Validation Floor",
      ward: "Validation Ward",
      bedCount: 1,
      chargePerDay: 1500
    });
    room = createdRoom.item;
    bed = createdRoom.beds[0];
  }

  const admission = await admitPatient(
    {
      patientId: patient.id,
      roomId: room.id,
      bedId: bed.id,
      attendingDoctorId: persistedDoctorId,
      reasonForAdmission: "Observation stay"
    },
    actor.id
  );
  await addAdmissionNote(admission.id, { category: "progress", note: "Responding well" }, actor.id);
  await addAdmissionVitals(admission.id, { bp: "118/76", pulse: 70 }, actor.id);
  const discharged = await dischargeAdmission(admission.id, { dischargeNote: "Recovered" }, actor.id);
  const bill = await createBill({
    patientId: patient.id,
    bedId: bed.id,
    billType: "ipd",
    createdBy: actor.id,
    charges: [{ source: "ipd", sourceId: admission.id }]
  });

  assert(discharged.status === "discharged", "Expected IPD admission to be discharged.");
  assert(bill.id, "Expected discharged IPD admission to create a centralized bill.");

  return `Admission ${admission.admissionNumber}, bill ${bill.billNumber}`;
});

await run("Panchkarma schedule to therapy billing flow", async () => {
  const patient = await registerPatient("Therapy", { dateOfBirth: "1994-11-09" });
  const masters = await getPanchkarmaMasters();
  const therapyRoom = db.rooms.find((entry) => entry.roomType === "therapy");
  const therapistId = masters.therapists[0]?.id;
  const therapyId = masters.therapies[0]?.id;
  const materialMedicineId = await stockedMedicineIdForValidation();
  assert(therapistId && therapyId && materialMedicineId, "Expected Panchkarma validation data to include therapist, therapy, and stocked material medicine.");
  const schedule = await createPanchkarmaSchedule(
    {
      patientId: patient.id,
      therapyId,
      therapistId,
      recommendedBy: persistedDoctorId,
      therapyRoomId: therapyRoom.id,
      scheduledDate: today,
      scheduledTime: "12:00",
      complaint: "Stress relief"
    },
    actor.id
  );
  await startPanchkarmaSession(schedule.id, {}, actor.id);
  const completed = await completePanchkarmaSession(
    schedule.id,
    {
      outcome: "Session tolerated well",
      addMaterialCharges: true,
      materialsUsed: [{ medicineId: materialMedicineId, quantity: 1 }]
    },
    actor.id
  );
  const bill = await createBill({
    patientId: patient.id,
    visitId: schedule.linkedVisitId || "",
    billType: "therapy",
    createdBy: actor.id,
    charges: [{ source: "therapy", sourceId: schedule.id }]
  });

  assert(completed.status === "completed", "Expected Panchkarma session to be completed.");
  assert(bill.id, "Expected completed Panchkarma session to create a centralized bill.");

  return `Schedule ${schedule.scheduleNumber}, bill ${bill.billNumber}`;
});

await run("Patient timeline integration", async () => {
  const latestPatient = db.patients.find((entry) => entry.lastName === "Therapy" && entry.phone.includes(runId));
  const history = await getPatientHistory(latestPatient.id);

  assert(history.timeline.some((item) => item.type === "panchkarma"), "Expected Panchkarma timeline item.");
  assert(history.bills.length > 0, "Expected patient history to include bills.");

  return `Timeline entries ${history.timeline.length}`;
});

await run("Operational reports generation", async () => {
  const [overview, opd, ipd, revenue, pharmacy, lab, panchkarma] = await Promise.all([
    getReportsOverview({ dateFrom: today, dateTo: today }),
    getDailyOpdReport({ date: today }),
    getIpdCensusReport({ date: today }),
    getRevenueReport({ dateFrom: today, dateTo: today }),
    getPharmacySalesReport({ dateFrom: today, dateTo: today }),
    getLabWorkloadReport({ dateFrom: today, dateTo: today }),
    getPanchkarmaStatsReport({ dateFrom: today, dateTo: today })
  ]);

  assert(overview.revenue >= 0, "Expected reports overview revenue to be numeric.");
  assert(opd.summary.totalVisits >= 0, "Expected OPD report summary.");
  assert(ipd.summary.totalBeds > 0, "Expected IPD census to include beds.");
  assert(revenue.summary.totalBills >= 0, "Expected revenue report summary.");
  assert(pharmacy.summary.prescriptionsDispensed >= 0, "Expected pharmacy report summary.");
  assert(lab.summary.totalOrders >= 0, "Expected lab workload summary.");
  assert(panchkarma.summary.totalSessions >= 0, "Expected Panchkarma report summary.");

  return `Overview revenue ${overview.revenue}, OPD visits ${opd.summary.totalVisits}`;
});

const failed = results.filter((item) => item.status === "failed");

console.log(JSON.stringify({ results, failed: failed.length }, null, 2));

if (failed.length) {
  process.exitCode = 1;
}
