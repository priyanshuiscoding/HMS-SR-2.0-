import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

import { pgPool } from "../config/postgres.js";

const __filename = fileURLToPath(import.meta.url);
const knownPasswords = new Set(["Admin@123", "Welcome@123", "Password@123"]);

function requireValue(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function validatePassword(password) {
  if (
    password.length < 14
    || !/[a-z]/.test(password)
    || !/[A-Z]/.test(password)
    || !/\d/.test(password)
    || !/[^A-Za-z0-9]/.test(password)
    || knownPasswords.has(password)
    || /replace_with|password/i.test(password)
  ) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be unique, at least 14 characters, and include upper/lowercase, a number, and a symbol.");
  }
}

async function run() {
  const email = requireValue("INITIAL_ADMIN_EMAIL").toLowerCase();
  const password = requireValue("INITIAL_ADMIN_PASSWORD");
  const fullName = String(process.env.INITIAL_ADMIN_NAME || "HMS Administrator").trim();
  const employeeId = String(process.env.INITIAL_ADMIN_EMPLOYEE_ID || "SRA-ADMIN-001").trim();
  validatePassword(password);

  const client = await pgPool.connect();
  try {
    const existing = await client.query(
      "SELECT id, email, employee_id FROM users WHERE LOWER(email) = $1 OR employee_id = $2 LIMIT 1",
      [email, employeeId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].email.toLowerCase() !== email || existing.rows[0].employee_id !== employeeId) {
        throw new Error("INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_EMPLOYEE_ID conflicts with an existing user.");
      }
      console.log("Initial administrator already exists; no password was changed.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `
      INSERT INTO users (
        employee_id, full_name, email, phone, password_hash, role, department, designation, is_active, metadata
      )
      VALUES ($1, $2, $3, '', $4, 'admin', 'Administration', 'HMS Administrator', true, '{}'::jsonb)
      `,
      [employeeId, fullName, email, passwordHash]
    );
    console.log("Initial administrator created. Remove INITIAL_ADMIN_PASSWORD from the server environment now.");
  } finally {
    client.release();
    await pgPool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
