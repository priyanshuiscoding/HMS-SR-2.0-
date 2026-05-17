import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import bcrypt from "bcrypt";

import { demoUsers } from "../config/constants.js";
import {
  consultationCharge,
  approvalPolicy,
  ipdWardCharges,
  invoiceProfiles,
  notificationTemplates,
  opdOperatingHours,
  panchkarmaTherapyRates,
  staffWorkSchedules
} from "../config/hospitalData.js";
import { pgPool } from "../config/postgres.js";
import { db } from "../data/store.js";
import { upsertSeedAppointment } from "../modules/appointments/appointments.repository.js";
import { upsertSeedBill, upsertSeedPayment, upsertSeedRefund } from "../modules/billing/billing.repository.js";
import { upsertSeedAssessment, upsertSeedPrescription, upsertSeedVisit } from "../modules/opd/opd.repository.js";
import { upsertSeedPatient } from "../modules/patients/patients.repository.js";

const __filename = fileURLToPath(import.meta.url);

function stableUuid(source) {
  const hash = crypto.createHash("sha1").update(String(source)).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

async function passwordHashForSeed(user) {
  return bcrypt.hash(String(user.password || "Welcome@123"), 12);
}

function normalizePersonName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss)\.?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findUserForSchedule(schedule) {
  const scheduleName = normalizePersonName(schedule.name);

  return demoUsers.find((user) => {
    const userName = normalizePersonName(user.fullName);
    const parts = userName.split(" ").filter(Boolean);
    const firstLastKey = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : userName;
    return scheduleName === userName || scheduleName === firstLastKey || userName.endsWith(scheduleName);
  });
}

async function seedHospitalSettings(client) {
  const settings = [
    ["consultation_charge", { amount: consultationCharge, currency: "INR" }, "Default OPD consultation charge."],
    ["opd_operating_hours", opdOperatingHours, "OPD schedule for weekday and Sunday operations."],
    ["ipd_ward_charges", ipdWardCharges, "IPD ward package charges. Packages include bed charges and diet only."],
    ["invoice_profiles", invoiceProfiles, "Print-ready invoice profiles for hospital and pharmacy billing."],
    ["approval_policy", approvalPolicy, "Accounts/admin approval rules for discounts and refunds."],
    ["notification_templates", notificationTemplates, "SMS/WhatsApp message templates. Providers remain disabled until credentials are configured."]
  ];

  for (const [key, value, description] of settings) {
    await client.query(
      `
      INSERT INTO hospital_settings (key, value, description)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW()
      `,
      [key, JSON.stringify(value), description]
    );
  }
}

async function seedUsers(client) {
  for (const user of demoUsers) {
    await client.query(
      `
      INSERT INTO users (
        id, employee_id, full_name, email, phone, password_hash, role, department, designation, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      ON CONFLICT (employee_id) DO UPDATE
      SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password_hash = CASE
          WHEN users.password_hash LIKE 'seed-sha256:%' THEN EXCLUDED.password_hash
          ELSE users.password_hash
        END,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        stableUuid(user.id),
        user.employeeId,
        user.fullName,
        user.email,
        user.phone || "",
        await passwordHashForSeed(user),
        user.role,
        user.department,
        user.designation || user.title || "",
        user.isActive !== false,
        JSON.stringify({ sourceId: user.id, title: user.title || "" })
      ]
    );
  }
}

async function seedStaffSchedules(client) {
  for (let index = 0; index < staffWorkSchedules.length; index += 1) {
    const schedule = staffWorkSchedules[index];
    const user = findUserForSchedule(schedule);

    await client.query(
      `
      INSERT INTO staff_work_schedules (
        id, user_id, staff_name, working_time, break_time, week_off, note, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        staff_name = EXCLUDED.staff_name,
        working_time = EXCLUDED.working_time,
        break_time = EXCLUDED.break_time,
        week_off = EXCLUDED.week_off,
        note = EXCLUDED.note,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        stableUuid(`staff-schedule:${index}:${schedule.name}:${schedule.workingTime}`),
        user ? stableUuid(user.id) : null,
        schedule.name,
        schedule.workingTime,
        schedule.breakTime || "",
        schedule.weekOff || "",
        schedule.note || "",
        JSON.stringify({ intakeRow: index + 1 })
      ]
    );
  }
}

function seedPatientPayload(patient) {
  const fullName = patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();

  return {
    ...patient,
    id: stableUuid(`patient:${patient.uhid || patient.registrationNumber || patient.phone || fullName}`),
    fullName,
    registrationNumber: patient.registrationNumber || "",
    opdIpdNumber: patient.opdIpdNumber || "",
    patientType: patient.patientType || "new",
    title: patient.title || "",
    dateOfBirth: patient.dateOfBirth || null,
    ageYears: patient.ageYears || null,
    gender: patient.gender || "",
    address: patient.address || [patient.houseStreet, patient.areaVillage, patient.cityDistrict || patient.city, patient.state]
      .filter(Boolean)
      .join(", "),
    cityDistrict: patient.cityDistrict || patient.city || "",
    registrationDate: patient.registrationDate || new Date().toISOString().slice(0, 10),
    registrationTime: patient.registrationTime || null,
    createdBy: null,
    metadata: {
      sourceId: patient.id,
      importedFromSeed: true
    }
  };
}

async function seedPatients(client) {
  for (const patient of db.patients) {
    await upsertSeedPatient(client, seedPatientPayload(patient));
  }
}

function seedAppointmentPayload(appointment) {
  const patient = appointment.patientId ? db.patients.find((entry) => entry.id === appointment.patientId) : null;

  return {
    ...appointment,
    id: stableUuid(`appointment:${appointment.appointmentNumber || appointment.id}`),
    patientId: patient ? stableUuid(`patient:${patient.uhid || patient.registrationNumber || patient.phone || patient.fullName}`) : null,
    doctorId: appointment.doctorId ? stableUuid(appointment.doctorId) : null,
    bookedBy: appointment.bookedBy ? stableUuid(appointment.bookedBy) : null,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    patientAge: appointment.patientAge || null,
    patientGender: appointment.patientGender || "",
    patientMobile: appointment.patientMobile || "",
    tokenNumber: appointment.tokenNumber || 1,
    smsSent: appointment.smsSent || false,
    metadata: {
      sourceId: appointment.id,
      importedFromSeed: true
    }
  };
}

function stablePatientId(originalPatientId) {
  const patient = db.patients.find((entry) => entry.id === originalPatientId);
  return patient ? stableUuid(`patient:${patient.uhid || patient.registrationNumber || patient.phone || patient.fullName}`) : null;
}

function stableAppointmentId(originalAppointmentId) {
  const appointment = db.appointments.find((entry) => entry.id === originalAppointmentId);
  return appointment ? stableUuid(`appointment:${appointment.appointmentNumber || appointment.id}`) : null;
}

function stableVisitId(originalVisitId) {
  const visit = db.opdVisits.find((entry) => entry.id === originalVisitId);
  return visit ? stableUuid(`opd:${visit.opdNumber || visit.id}`) : null;
}

function stableBillId(originalBillId) {
  const bill = db.bills.find((entry) => entry.id === originalBillId);
  return bill ? stableUuid(`bill:${bill.billNumber || bill.id}`) : null;
}

function stableBedId(originalBedId) {
  const bed = db.beds.find((entry) => entry.id === originalBedId);
  return bed ? stableUuid(`bed:${bed.bedNumber}`) : null;
}

async function seedAppointments(client) {
  for (const appointment of db.appointments) {
    await upsertSeedAppointment(client, seedAppointmentPayload(appointment));
  }
}

function seedVisitPayload(visit) {
  return {
    ...visit,
    id: stableUuid(`opd:${visit.opdNumber || visit.id}`),
    patientId: stablePatientId(visit.patientId),
    doctorId: visit.doctorId ? stableUuid(visit.doctorId) : null,
    appointmentId: stableAppointmentId(visit.appointmentId),
    metadata: {
      sourceId: visit.id,
      importedFromSeed: true
    }
  };
}

function seedAssessmentPayload(assessment) {
  return {
    ...assessment,
    id: stableUuid(`assessment:${assessment.id}`),
    patientId: stablePatientId(assessment.patientId),
    visitId: stableVisitId(assessment.visitId),
    doctorId: assessment.doctorId ? stableUuid(assessment.doctorId) : null,
    metadata: {
      sourceId: assessment.id,
      importedFromSeed: true
    }
  };
}

function seedPrescriptionPayload(prescription) {
  return {
    ...prescription,
    id: stableUuid(`prescription:${prescription.prescriptionNumber || prescription.id}`),
    patientId: stablePatientId(prescription.patientId),
    doctorId: prescription.doctorId ? stableUuid(prescription.doctorId) : null,
    visitId: stableVisitId(prescription.visitId),
    medicines: (prescription.medicines || []).map((medicine) => ({
      ...medicine,
      id: stableUuid(`prescription-medicine:${prescription.prescriptionNumber || prescription.id}:${medicine.id || medicine.medicineName}`)
    })),
    metadata: {
      sourceId: prescription.id,
      importedFromSeed: true
    }
  };
}

async function seedOpdData(client) {
  for (const visit of db.opdVisits) {
    await upsertSeedVisit(client, seedVisitPayload(visit));
  }

  for (const assessment of db.ayurvedaAssessments) {
    await upsertSeedAssessment(client, seedAssessmentPayload(assessment));
  }

  for (const prescription of db.prescriptions) {
    await upsertSeedPrescription(client, seedPrescriptionPayload(prescription));
  }
}

async function seedPanchkarmaTherapies(client) {
  for (const therapy of panchkarmaTherapyRates) {
    await client.query(
      `
      INSERT INTO panchkarma_therapy_masters (
        id, code, name, category, default_duration_minutes, price, room_type, requires_recovery, description, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (code) DO UPDATE
      SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        default_duration_minutes = EXCLUDED.default_duration_minutes,
        price = EXCLUDED.price,
        room_type = EXCLUDED.room_type,
        requires_recovery = EXCLUDED.requires_recovery,
        description = EXCLUDED.description,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        stableUuid(therapy.id),
        therapy.code,
        therapy.name,
        therapy.category,
        therapy.defaultDurationMinutes,
        therapy.price,
        therapy.roomType,
        therapy.requiresRecovery,
        therapy.description,
        JSON.stringify({ sourceId: therapy.id })
      ]
    );
  }
}

async function seedRoomsAndBeds(client) {
  for (const room of db.rooms) {
    const beds = db.beds.filter((bed) => bed.roomId === room.id);
    await client.query(
      `
      INSERT INTO rooms (
        id, room_number, room_type, floor, ward, total_beds, daily_rate, nursing_station, notes, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (room_number) DO UPDATE
      SET
        room_type = EXCLUDED.room_type,
        floor = EXCLUDED.floor,
        ward = EXCLUDED.ward,
        total_beds = EXCLUDED.total_beds,
        daily_rate = EXCLUDED.daily_rate,
        nursing_station = EXCLUDED.nursing_station,
        notes = EXCLUDED.notes,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        stableUuid(`room:${room.roomNumber}`),
        room.roomNumber,
        room.roomType,
        room.floor || "",
        room.ward,
        beds.length,
        room.chargePerDay || 0,
        room.nursingStation || "",
        room.notes || "",
        JSON.stringify({ sourceId: room.id })
      ]
    );

    for (const bed of beds) {
      await client.query(
        `
        INSERT INTO beds (
          id, room_id, bed_number, bed_label, status, patient_name, note, admission_type, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (bed_number) DO UPDATE
        SET
          room_id = EXCLUDED.room_id,
          bed_label = EXCLUDED.bed_label,
          status = EXCLUDED.status,
          patient_name = EXCLUDED.patient_name,
          note = EXCLUDED.note,
          admission_type = EXCLUDED.admission_type,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        `,
        [
          stableUuid(`bed:${bed.bedNumber}`),
          stableUuid(`room:${room.roomNumber}`),
          bed.bedNumber,
          bed.bedLabel || "",
          bed.status || "available",
          bed.patientName || "",
          bed.note || "",
          bed.admissionType || "",
          JSON.stringify({ sourceId: bed.id })
        ]
      );
    }
  }
}

async function seedLabTests(client) {
  for (const test of db.labTestMasters) {
    await client.query(
      `
      INSERT INTO lab_test_masters (id, code, name, department, price, normal_range, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name, department = EXCLUDED.department, price = EXCLUDED.price, normal_range = EXCLUDED.normal_range, metadata = EXCLUDED.metadata, updated_at = NOW()
      `,
      [stableUuid(test.id), test.code, test.name, test.department || "", test.price || 0, test.normalRange || "", JSON.stringify({ sourceId: test.id })]
    );
  }
}

async function seedMedicineAndInventoryMasters(client) {
  for (const supplier of db.suppliers) {
    await client.query(
      `
      INSERT INTO suppliers (id, name, phone, city, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (name) DO UPDATE
      SET phone = EXCLUDED.phone, city = EXCLUDED.city, metadata = EXCLUDED.metadata, updated_at = NOW()
      `,
      [stableUuid(supplier.id), supplier.name, supplier.phone || "", supplier.city || "", JSON.stringify({ sourceId: supplier.id })]
    );
  }

  for (const medicine of db.medicineMasters) {
    await client.query(
      `
      INSERT INTO medicine_masters (
        id, medicine_code, name, category, formulation, unit, selling_price, reorder_level, gst_percentage, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      ON CONFLICT (medicine_code) DO UPDATE
      SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        formulation = EXCLUDED.formulation,
        unit = EXCLUDED.unit,
        selling_price = EXCLUDED.selling_price,
        reorder_level = EXCLUDED.reorder_level,
        gst_percentage = EXCLUDED.gst_percentage,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        stableUuid(medicine.id),
        medicine.code,
        medicine.name,
        medicine.category || "",
        medicine.formulation || "",
        medicine.unit || "unit",
        medicine.price || medicine.sellingPrice || 0,
        medicine.reorderLevel || 0,
        medicine.gstPercent || 0,
        JSON.stringify({ sourceId: medicine.id })
      ]
    );
  }
}

function seedBillPayload(bill) {
  return {
    ...bill,
    id: stableUuid(`bill:${bill.billNumber || bill.id}`),
    patientId: stablePatientId(bill.patientId),
    visitId: stableVisitId(bill.visitId),
    bedId: stableBedId(bill.bedId),
    createdBy: bill.createdBy ? stableUuid(bill.createdBy) : null,
    items: (bill.items || []).map((item) => ({
      ...item,
      id: stableUuid(`bill-item:${bill.billNumber || bill.id}:${item.id || item.description}`)
    })),
    metadata: {
      ...(bill.metadata || {}),
      sourceId: bill.id,
      importedFromSeed: true
    }
  };
}

function seedPaymentPayload(payment) {
  return {
    ...payment,
    id: stableUuid(`payment:${payment.receiptNumber || payment.id}`),
    billId: stableBillId(payment.billId),
    patientId: stablePatientId(payment.patientId),
    receivedBy: payment.receivedBy ? stableUuid(payment.receivedBy) : null,
    metadata: {
      ...(payment.metadata || {}),
      sourceId: payment.id,
      importedFromSeed: true
    }
  };
}

function seedRefundPayload(refund) {
  return {
    ...refund,
    id: stableUuid(`refund:${refund.refundNumber || refund.id}`),
    billId: stableBillId(refund.billId),
    patientId: stablePatientId(refund.patientId),
    approvedBy: refund.approvedBy ? stableUuid(refund.approvedBy) : null,
    metadata: {
      ...(refund.metadata || {}),
      sourceId: refund.id,
      importedFromSeed: true
    }
  };
}

async function seedBillingData(client) {
  for (const bill of db.bills) {
    await upsertSeedBill(client, seedBillPayload(bill));
  }

  for (const payment of db.payments) {
    await upsertSeedPayment(client, seedPaymentPayload(payment));
  }

  for (const refund of db.refunds || []) {
    await upsertSeedRefund(client, seedRefundPayload(refund));
  }
}

async function run() {
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");
    await seedHospitalSettings(client);
    await seedUsers(client);
    await seedStaffSchedules(client);
    // Patient-linked demo rows are intentionally not seeded in production data.
    // Use `npm run db:import-old-patients` to load the legacy patient register.
    await seedPanchkarmaTherapies(client);
    await seedRoomsAndBeds(client);
    await seedLabTests(client);
    await seedMedicineAndInventoryMasters(client);
    // Billing seed data is patient-linked demo history, so it stays out with the demo patients.
    await client.query("COMMIT");
    console.log("Database seed complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pgPool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
