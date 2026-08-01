const DEFAULT_OR_PLACEHOLDER_SECRETS = new Set([
  "change_me_to_a_long_random_secret",
  "change_me_to_a_different_long_random_secret",
  "replace_with_64_plus_random_chars",
  "replace_with_a_different_64_plus_random_chars"
]);

const DEFAULT_OR_PLACEHOLDER_DATABASE_PASSWORDS = new Set([
  "",
  "hms_password",
  "replace_with_server_db_password"
]);

function hasStrongSecret(value) {
  return typeof value === "string"
    && value.length >= 48
    && new Set(value).size >= 12
    && !DEFAULT_OR_PLACEHOLDER_SECRETS.has(value);
}

function configuredDatabasePassword(env) {
  if (!env.databaseUrl) return env.dbPassword;
  try {
    return decodeURIComponent(new URL(env.databaseUrl).password || "");
  } catch {
    return "";
  }
}

export function productionReadinessFailures(env) {
  const failures = [];

  if (!env.persistenceEnabled) {
    failures.push("PERSISTENCE_ENABLED must be true.");
  }

  if (!hasStrongSecret(env.jwtAccessSecret) || !hasStrongSecret(env.jwtRefreshSecret)) {
    failures.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be unique strong secrets.");
  }

  if (env.jwtAccessSecret === env.jwtRefreshSecret) {
    failures.push("JWT access and refresh secrets must be different.");
  }

  if (DEFAULT_OR_PLACEHOLDER_DATABASE_PASSWORDS.has(configuredDatabasePassword(env))) {
    failures.push("DB_PASSWORD must be changed from the local/default value.");
  }

  if (!env.cookieSecure) {
    failures.push("COOKIE_SECURE must be true behind HTTPS.");
  }

  if (!env.trustProxy) {
    failures.push("TRUST_PROXY must be true when deployed behind a proxy or load balancer.");
  }


  if (!env.frontendUrls.length) {
    failures.push("FRONTEND_URL must contain at least one trusted HTTPS origin.");
  } else {
    for (const origin of env.frontendUrls) {
      try {
        const url = new URL(origin);
        if (url.protocol !== "https:") {
          failures.push(`FRONTEND_URL must use HTTPS in production: ${origin}`);
        }
        if (url.origin !== origin || url.username || url.password) {
          failures.push(`FRONTEND_URL entries must be origins only (no path, query, fragment, or credentials): ${origin}`);
        }
      } catch {
        failures.push(`FRONTEND_URL contains an invalid origin: ${origin}`);
      }
    }
  }

  if (!["lax", "strict", "none"].includes(env.cookieSameSite)) {
    failures.push("COOKIE_SAME_SITE must be lax, strict, or none.");
  }

  if (env.cookieSameSite === "none" && !env.cookieSecure) {
    failures.push("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none.");
  }

  if (env.otpDeliveryMode !== "disabled") {
    failures.push("OTP_DELIVERY_MODE must be disabled until a real email/SMS delivery provider is integrated.");
  }

  return failures;
}

export function assertProductionReady(env) {
  if (env.nodeEnv !== "production") {
    return;
  }

  const failures = productionReadinessFailures(env);
  if (failures.length) {
    throw new Error(`Production readiness failed: ${failures.join(" ")}`);
  }
}
