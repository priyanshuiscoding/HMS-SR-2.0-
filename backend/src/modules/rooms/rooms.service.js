import { createId, db, getRoomMasters as getStaticRoomMasters } from "../../data/store.js";
import { createError } from "../../utils/errors.js";
import { getPatientById } from "../patients/patients.service.js";
import {
  assignBedRecord,
  createRoomRecord,
  dischargeBedRecord,
  findBedRecord,
  findRoomRecord,
  listBedRecords,
  listRoomRecords,
  roomNumberExists
} from "./rooms.repository.js";

const BLOCKED_BED_STATUSES = ["cleaning", "maintenance"];

function syncRoomMirror(room) {
  const index = db.rooms.findIndex((entry) => entry.id === room.id);
  if (index >= 0) {
    db.rooms[index] = room;
    return;
  }
  db.rooms.push(room);
}

function syncBedMirror(bed) {
  const index = db.beds.findIndex((entry) => entry.id === bed.id);
  if (index >= 0) {
    db.beds[index] = bed;
    return;
  }
  db.beds.push(bed);
}

export function syncRoomMirrors({ rooms = [], beds = [] } = {}) {
  db.rooms.splice(0, db.rooms.length, ...rooms);
  db.beds.splice(0, db.beds.length, ...beds);
}

export async function loadRoomMirrorsFromDatabase() {
  const [rooms, beds] = await Promise.all([listRoomRecords(), listBedRecords()]);
  syncRoomMirrors({ rooms, beds });
  return { rooms, beds };
}

function summarizeRoom(room, beds = db.beds) {
  const roomBeds = beds.filter((bed) => bed.roomId === room.id);
  const occupiedBeds = roomBeds.filter((bed) => bed.status === "occupied").length;
  const availableBeds = roomBeds.filter((bed) => bed.status === "available").length;
  const reservedBeds = roomBeds.filter((bed) => bed.status === "reserved").length;
  const maintenanceBeds = roomBeds.filter((bed) => BLOCKED_BED_STATUSES.includes(bed.status)).length;

  return {
    ...room,
    totalBeds: roomBeds.length,
    occupiedBeds,
    availableBeds,
    reservedBeds,
    maintenanceBeds,
    occupancyPercent: roomBeds.length ? Math.round((occupiedBeds / roomBeds.length) * 100) : 0,
    status: availableBeds > 0 ? "available" : occupiedBeds > 0 ? "full" : "blocked"
  };
}

async function roomOrThrow(roomId) {
  const room = await findRoomRecord(roomId);
  if (!room) {
    throw createError("Room not found.", 404);
  }
  syncRoomMirror(room);
  return room;
}

async function bedOrThrow(bedId) {
  const bed = await findBedRecord(bedId);
  if (!bed) {
    throw createError("Bed not found.", 404);
  }
  syncBedMirror(bed);
  return bed;
}

export async function listRooms(query = {}) {
  const [rooms, beds] = await Promise.all([listRoomRecords(), listBedRecords()]);
  syncRoomMirrors({ rooms, beds });

  let items = rooms.map((room) => summarizeRoom(room, beds));

  if (query.roomType) {
    items = items.filter((room) => room.roomType === query.roomType);
  }

  if (query.floor) {
    items = items.filter((room) => room.floor === query.floor);
  }

  if (query.status) {
    items = items.filter((room) => room.status === query.status);
  }

  return items.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
}

export async function getRoomDetails(roomId) {
  const room = await roomOrThrow(roomId);
  const beds = (await listBedRecords()).filter((bed) => bed.roomId === roomId).sort((a, b) => a.bedNumber.localeCompare(b.bedNumber));
  beds.forEach(syncBedMirror);

  return {
    item: summarizeRoom(room, beds),
    beds
  };
}

export async function getRoomsAvailability() {
  const rooms = await listRooms();
  const beds = await listBedRecords();

  return {
    summary: {
      totalRooms: rooms.length,
      totalBeds: beds.length,
      occupiedBeds: beds.filter((bed) => bed.status === "occupied").length,
      availableBeds: beds.filter((bed) => bed.status === "available").length,
      reservedBeds: beds.filter((bed) => bed.status === "reserved").length,
      blockedBeds: beds.filter((bed) => BLOCKED_BED_STATUSES.includes(bed.status)).length
    },
    items: rooms
  };
}

export async function createRoom(payload) {
  if (!payload.roomNumber || !payload.roomType || !payload.floor || !payload.bedCount) {
    throw createError("Room number, type, floor, and bed count are required.");
  }

  const roomNumber = payload.roomNumber.trim();
  if (await roomNumberExists(roomNumber)) {
    throw createError("A room with this room number already exists.");
  }

  const bedCount = Number(payload.bedCount || 0);
  if (bedCount <= 0) {
    throw createError("Bed count must be greater than zero.");
  }

  const room = {
    id: createId(),
    roomNumber,
    ward: payload.ward?.trim() || "General Ward",
    roomType: payload.roomType,
    floor: payload.floor.trim(),
    chargePerDay: Number(payload.chargePerDay || 0),
    nursingStation: payload.nursingStation?.trim() || "Main Ward",
    notes: payload.notes || "",
    metadata: {}
  };

  const beds = Array.from({ length: bedCount }).map((_, index) => ({
    id: createId(),
    bedNumber: `${room.roomNumber}-${index + 1}`,
    bedLabel: payload.bedPrefix ? `${payload.bedPrefix} ${index + 1}` : `Bed ${index + 1}`,
    status: "available"
  }));

  const created = await createRoomRecord({ ...room, beds });
  syncRoomMirror(created.item);
  created.beds.forEach(syncBedMirror);

  return {
    item: summarizeRoom(created.item, created.beds),
    beds: created.beds
  };
}

export async function assignBed(roomId, bedId, payload) {
  const room = await roomOrThrow(roomId);
  const bed = await bedOrThrow(bedId);

  if (bed.roomId !== room.id) {
    throw createError("Bed not found.", 404);
  }

  if (!payload.patientId) {
    throw createError("Patient is required for bed assignment.");
  }

  const patient = await getPatientById(payload.patientId);
  const patientName = patient.fullName || `${patient.firstName} ${patient.lastName}`.trim();
  const result = await assignBedRecord(roomId, bedId, {
    ...payload,
    patientName
  });

  if (!result) {
    throw createError("Bed not found.", 404);
  }

  if (result.conflict === "unassignable") {
    throw createError("This bed is not currently assignable.");
  }

  if (result.conflict === "patient_occupied") {
    throw createError("This patient already occupies another bed.");
  }

  syncBedMirror(result);
  return getRoomDetails(roomId);
}

export async function dischargeBed(roomId, bedId, payload) {
  await roomOrThrow(roomId);
  const result = await dischargeBedRecord(roomId, bedId, payload);

  if (!result) {
    throw createError("Bed not found.", 404);
  }

  if (result.conflict === "not_occupied") {
    throw createError("Only occupied beds can be discharged.");
  }

  syncBedMirror(result);
  return getRoomDetails(roomId);
}

export async function getRoomMasters() {
  const rooms = await listRoomRecords();

  return {
    ...getStaticRoomMasters(),
    floors: Array.from(new Set(rooms.map((room) => room.floor))).sort(),
    wards: Array.from(new Set(rooms.map((room) => room.ward))).sort(),
    roomStatuses: ["available", "full", "blocked"]
  };
}
