import bcrypt from "bcrypt";
import crypto from "crypto";

import { query } from "../../config/postgres.js";

function toCamelUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    passwordHash: row.password_hash,
    role: row.role,
    grantedModules: Array.isArray(row.granted_modules) ? row.granted_modules : [],
    department: row.department || "",
    title: row.metadata?.title || row.designation || row.department || "",
    designation: row.designation || "",
    isActive: row.is_active,
    lastLogin: row.last_login || "",
    workSchedules: row.work_schedules || [],
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const BCRYPT_ROUNDS = 12;

function seedPasswordHash(email, password) {
  return `seed-sha256:${crypto.createHash("sha256").update(`${email}:${password}`).digest("hex")}`;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function hashPasswordForStorage(_email, password) {
  return bcrypt.hash(String(password || "Welcome@123"), BCRYPT_ROUNDS);
}

export async function verifyPassword(user, password) {
  if (!user?.passwordHash) {
    return false;
  }

  if (user.passwordHash.startsWith("$2")) {
    return bcrypt.compare(String(password || ""), user.passwordHash);
  }

  if (user.passwordHash.startsWith("seed-sha256:")) {
    return user.passwordHash === seedPasswordHash(String(user.email || "").toLowerCase(), password);
  }

  return false;
}

export async function findUsers(queryParams = {}) {
  const search = String(queryParams.search || "").trim().toLowerCase();
  const role = String(queryParams.role || "").trim().toLowerCase();
  const department = String(queryParams.department || "").trim().toLowerCase();
  const includeInactive = String(queryParams.includeInactive || "false").toLowerCase() === "true";
  const conditions = ["u.deleted_at IS NULL"];
  const params = [];

  if (!includeInactive) {
    conditions.push("u.is_active = true");
  }

  if (role) {
    params.push(role);
    conditions.push(`LOWER(u.role) = $${params.length}`);
  }

  if (department) {
    params.push(department);
    conditions.push(`LOWER(u.department) = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`
      (
        LOWER(u.full_name) LIKE $${params.length}
        OR LOWER(u.employee_id) LIKE $${params.length}
        OR LOWER(u.email) LIKE $${params.length}
        OR LOWER(u.phone) LIKE $${params.length}
        OR LOWER(u.department) LIKE $${params.length}
        OR LOWER(u.designation) LIKE $${params.length}
      )
    `);
  }

  const result = await query(
    `
    SELECT
      u.*,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sws.id,
            'staffName', sws.staff_name,
            'workingTime', sws.working_time,
            'breakTime', sws.break_time,
            'weekOff', sws.week_off,
            'note', sws.note
          )
        ) FILTER (WHERE sws.id IS NOT NULL),
        '[]'::jsonb
      ) AS work_schedules
    FROM users u
    LEFT JOIN staff_work_schedules sws ON sws.user_id = u.id AND sws.is_active = true
    WHERE ${conditions.join(" AND ")}
    GROUP BY u.id
    ORDER BY u.full_name ASC
    `,
    params
  );

  return result.rows.map(toCamelUser);
}

export async function findUserById(id, { includeInactive = false } = {}) {
  const result = await query(
    `
    SELECT
      u.*,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sws.id,
            'staffName', sws.staff_name,
            'workingTime', sws.working_time,
            'breakTime', sws.break_time,
            'weekOff', sws.week_off,
            'note', sws.note
          )
        ) FILTER (WHERE sws.id IS NOT NULL),
        '[]'::jsonb
      ) AS work_schedules
    FROM users u
    LEFT JOIN staff_work_schedules sws ON sws.user_id = u.id AND sws.is_active = true
    WHERE u.id = $1 AND u.deleted_at IS NULL ${includeInactive ? "" : "AND u.is_active = true"}
    GROUP BY u.id
    `,
    [id]
  );

  return toCamelUser(result.rows[0]);
}

export async function findUserByEmail(email, { includeInactive = false } = {}) {
  const result = await query(
    `
    SELECT
      u.*,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sws.id,
            'staffName', sws.staff_name,
            'workingTime', sws.working_time,
            'breakTime', sws.break_time,
            'weekOff', sws.week_off,
            'note', sws.note
          )
        ) FILTER (WHERE sws.id IS NOT NULL),
        '[]'::jsonb
      ) AS work_schedules
    FROM users u
    LEFT JOIN staff_work_schedules sws ON sws.user_id = u.id AND sws.is_active = true
    WHERE LOWER(u.email) = LOWER($1) AND u.deleted_at IS NULL ${includeInactive ? "" : "AND u.is_active = true"}
    GROUP BY u.id
    `,
    [email]
  );

  return toCamelUser(result.rows[0]);
}

export async function emailExists(email, excludeId = "") {
  const result = await query(
    "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id::text <> COALESCE($2, '') AND deleted_at IS NULL LIMIT 1",
    [email, excludeId || ""]
  );
  return result.rowCount > 0;
}

export async function createUserRecord(payload) {
  const passwordHash = await hashPasswordForStorage(payload.email, payload.password || "Welcome@123");
  const result = await query(
    `
    INSERT INTO users (
      employee_id, full_name, email, phone, password_hash, role, department, designation, is_active, metadata
    )
    VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING *
    `,
    [
      payload.employeeId,
      payload.fullName,
      payload.email,
      payload.phone || "",
      passwordHash,
      payload.role,
      payload.department,
      payload.designation || payload.title || payload.department,
      payload.isActive !== false,
      JSON.stringify({ title: payload.title || payload.designation || payload.department })
    ]
  );

  return publicUser(toCamelUser(result.rows[0]));
}

export async function updateUserRecord(id, payload) {
  const fields = [];
  const params = [];

  const setField = (column, value) => {
    params.push(value);
    fields.push(`${column} = $${params.length}`);
  };

  if (payload.employeeId) setField("employee_id", String(payload.employeeId).trim());
  if (payload.fullName) setField("full_name", String(payload.fullName).trim());
  if (payload.email) setField("email", String(payload.email).trim().toLowerCase());
  if (payload.phone !== undefined) setField("phone", String(payload.phone || "").trim());
  if (payload.role) setField("role", payload.role);
  if (payload.department) setField("department", String(payload.department).trim());
  if (payload.designation || payload.title) setField("designation", String(payload.designation || payload.title).trim());
  if (payload.password) setField("password_hash", await hashPasswordForStorage(payload.email || "", payload.password));
  if (payload.isActive !== undefined) setField("is_active", Boolean(payload.isActive));

  if (!fields.length) {
    return publicUser(await findUserById(id, { includeInactive: true }));
  }

  params.push(id);
  const result = await query(
    `
    UPDATE users
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${params.length} AND deleted_at IS NULL
    RETURNING *
    `,
    params
  );

  return publicUser(toCamelUser(result.rows[0]));
}

export async function updateUserPasswordHash(id, passwordHash) {
  await query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", [id, passwordHash]);
}

// Lightweight lookup used by the per-request access middleware. Deliberately avoids
// the work_schedules join so it stays cheap on the hot path.
export async function getUserAccessById(id) {
  const result = await query(
    "SELECT id, role, is_active, granted_modules FROM users WHERE id = $1 AND deleted_at IS NULL",
    [id]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    isActive: row.is_active,
    grantedModules: Array.isArray(row.granted_modules) ? row.granted_modules : []
  };
}

export async function updateUserModuleAccessRecord(id, grantedModules) {
  const result = await query(
    `
    UPDATE users
    SET granted_modules = $2::jsonb, updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [id, JSON.stringify(grantedModules)]
  );

  return publicUser(toCamelUser(result.rows[0]));
}

export async function softDeleteUserRecord(id) {
  const result = await query(
    `
    UPDATE users
    SET is_active = false, deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING *
    `,
    [id]
  );

  return publicUser(toCamelUser(result.rows[0]));
}

export async function publicUsers(queryParams = {}) {
  const users = await findUsers(queryParams);
  return users.map(publicUser);
}
