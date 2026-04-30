import { createError } from "../utils/errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function hasMinLength(value, min) {
  return String(value || "").length >= min;
}

export const validators = {
  required(label) {
    return (value) => (isBlank(value) ? `${label} is required.` : "");
  },
  email(label = "Email") {
    return (value) => (!isBlank(value) && !EMAIL_PATTERN.test(String(value).trim()) ? `${label} must be a valid email address.` : "");
  },
  minLength(label, min) {
    return (value) => (!isBlank(value) && !hasMinLength(value, min) ? `${label} must be at least ${min} characters.` : "");
  },
  uuid(label = "ID") {
    return (value) => (!isBlank(value) && !UUID_PATTERN.test(String(value).trim()) ? `${label} must be a valid UUID.` : "");
  },
  oneOf(label, values) {
    return (value) => (!isBlank(value) && !values.includes(value) ? `${label} must be one of: ${values.join(", ")}.` : "");
  },
  optional(rule) {
    return (value, body) => (isBlank(value) ? "" : rule(value, body));
  }
};

export function validateBody(schema) {
  return (req, _res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      for (const rule of rules) {
        const message = rule(req.body?.[field], req.body || {});
        if (message) {
          errors.push(message);
          break;
        }
      }
    }

    if (errors.length) {
      return next(createError(errors.join(" "), 400));
    }

    return next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      for (const rule of rules) {
        const message = rule(req.params?.[field], req.params || {});
        if (message) {
          errors.push(message);
          break;
        }
      }
    }

    if (errors.length) {
      return next(createError(errors.join(" "), 400));
    }

    return next();
  };
}
