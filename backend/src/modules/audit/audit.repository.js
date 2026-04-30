import { query } from "../../config/postgres.js";
import { nullableUuid } from "../../utils/ids.js";

export async function createAuditLog(payload = {}) {
  await query(
    `
    INSERT INTO audit_logs (
      user_id, user_role, action, entity_type, entity_id, ip_address,
      user_agent, old_value, new_value, status
    )
    VALUES ($1, $2, $3, $4, $5, $6::inet, $7, $8::jsonb, $9::jsonb, $10)
    `,
    [
      nullableUuid(payload.userId),
      payload.userRole || "",
      payload.action,
      payload.entityType || "",
      nullableUuid(payload.entityId),
      payload.ipAddress || null,
      payload.userAgent || "",
      payload.oldValue ? JSON.stringify(payload.oldValue) : null,
      payload.newValue ? JSON.stringify(payload.newValue) : null,
      payload.status || "success"
    ]
  );
}
