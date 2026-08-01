import { logger } from "../config/logger.js";
import { createAuditLog } from "../modules/audit/audit.repository.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_KEYS = new Set(["password", "newpassword", "currentpassword", "otp", "token", "accesstoken", "refreshtoken", "secret"]);

function entityTypeFromPath(path = "") {
  return path.split("/").filter(Boolean)[0] || "system";
}

function redact(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) || /password|token|secret|otp/i.test(key) ? "[redacted]" : redact(entry)
    ])
  );
}

export function auditWrites(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) {
    return next();
  }

  res.on("finish", () => {
    if (!req.user?.sub || res.statusCode >= 400) {
      return;
    }

    createAuditLog({
      userId: req.user.sub,
      userRole: req.user.role,
      action: `${req.method} ${req.originalUrl}`,
      entityType: entityTypeFromPath(req.path),
      entityId: req.params?.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
      newValue: {
        params: req.params || {},
        query: req.query || {},
        body: redact(req.body || {})
      },
      status: "success"
    }).catch((error) => {
      logger.error(`Audit log write failed: ${error.message}`);
    });
  });

  return next();
}
