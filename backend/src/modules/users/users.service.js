import { accessModules, roles, sanitizeGrantedModules } from "../../config/constants.js";
import { createError } from "../../utils/errors.js";
import {
  createUserRecord,
  emailExists,
  findUserById,
  publicUsers,
  softDeleteUserRecord,
  updateUserModuleAccessRecord,
  updateUserRecord
} from "./users.repository.js";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function ensureRole(role) {
  if (!Object.values(roles).includes(role)) {
    throw createError("Invalid role provided.");
  }
}

async function ensureUserExists(id, options = {}) {
  const user = await findUserById(id, options);

  if (!user) {
    throw createError("User not found.", 404);
  }

  return user;
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function normalizeEmail(email) {
  const nextEmail = normalize(email);

  if (!nextEmail) {
    throw createError("Email is required.");
  }

  return nextEmail;
}

async function checkDuplicateEmail(email, excludeId = "") {
  const exists = await emailExists(email, excludeId);

  if (exists) {
    throw createError("A user with this email already exists.");
  }
}

export function listUsers(query = {}) {
  return publicUsers(query);
}

export function getUserById(id) {
  return ensureUserExists(id, { includeInactive: true }).then(sanitizeUser);
}

export async function createUser(payload = {}) {
  if (!payload.fullName || !payload.employeeId || !payload.email || !payload.password || !payload.role || !payload.department) {
    throw createError("Full name, employee ID, email, password, role, and department are required.");
  }

  ensureRole(payload.role);

  const email = normalizeEmail(payload.email);
  await checkDuplicateEmail(email);

  return createUserRecord({
    employeeId: String(payload.employeeId).trim(),
    fullName: String(payload.fullName).trim(),
    email,
    password: String(payload.password),
    role: payload.role,
    department: String(payload.department).trim(),
    title: String(payload.title || payload.designation || payload.department).trim(),
    designation: String(payload.designation || payload.title || payload.department).trim(),
    phone: String(payload.phone || "").trim(),
    isActive: payload.isActive !== false
  });
}

export async function updateUser(id, payload = {}) {
  const user = await ensureUserExists(id, { includeInactive: true });

  if (payload.role) {
    ensureRole(payload.role);
  }

  if (payload.email) {
    const email = normalizeEmail(payload.email);
    await checkDuplicateEmail(email, user.id);
    payload.email = email;
  }

  return updateUserRecord(id, {
    ...payload,
    email: payload.email || user.email
  });
}

export function softDeleteUser(id) {
  return softDeleteUserRecord(id);
}

export function getModuleCatalog() {
  return accessModules;
}

export async function setUserModuleAccess(id, modules) {
  await ensureUserExists(id, { includeInactive: true });

  if (modules !== undefined && !Array.isArray(modules)) {
    throw createError("Modules must be provided as an array.");
  }

  return updateUserModuleAccessRecord(id, sanitizeGrantedModules(modules));
}

export function listDoctors() {
  return publicUsers({ role: roles.DOCTOR });
}

export function listTherapists() {
  return publicUsers({ role: roles.THERAPIST });
}

export async function getUsersSummaryFromDatabase() {
  const users = await publicUsers({ includeInactive: true });
  const activeUsers = users.filter((user) => user.isActive);
  const roleSummary = Object.values(
    activeUsers.reduce((summary, user) => {
      if (!summary[user.role]) {
        summary[user.role] = { role: user.role, count: 0 };
      }

      summary[user.role].count += 1;
      return summary;
    }, {})
  ).sort((left, right) => right.count - left.count || left.role.localeCompare(right.role));

  const departmentSummary = Object.values(
    activeUsers.reduce((summary, user) => {
      if (!summary[user.department]) {
        summary[user.department] = { department: user.department, count: 0 };
      }

      summary[user.department].count += 1;
      return summary;
    }, {})
  ).sort((left, right) => right.count - left.count || left.department.localeCompare(right.department));

  return {
    totalEmployees: users.length,
    activeEmployees: activeUsers.length,
    doctors: activeUsers.filter((user) => user.role === roles.DOCTOR).length,
    departments: departmentSummary.length,
    roles: roleSummary,
    departmentsList: departmentSummary
  };
}
