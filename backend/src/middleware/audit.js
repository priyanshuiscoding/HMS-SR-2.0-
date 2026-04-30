import { logger } from "../config/logger.js";
import { createAuditLog } from "../modules/audit/audit.repository.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function entityTypeFromPath(path = "") {
  return path.split("/").filter(Boolean)[0] || "system";
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
        query: req.query || {}
      },
      status: "success"
    }).catch((error) => {
      logger.error(`Audit log write failed: ${error.message}`);
    });
  });

  return next();
}
