const DEFAULT_OR_PLACEHOLDER_SECRETS = new Set([
  "change_me_to_a_long_random_secret",
  "change_me_to_a_different_long_random_secret",
  "replace_with_64_plus_random_chars",
  "replace_with_a_different_64_plus_random_chars"
]);

function hasStrongSecret(value) {
  return typeof value === "string" && value.length >= 48 && !DEFAULT_OR_PLACEHOLDER_SECRETS.has(value);
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

  if (!env.cookieSecure) {
    failures.push("COOKIE_SECURE must be true behind HTTPS.");
  }

  if (!env.trustProxy) {
    failures.push("TRUST_PROXY must be true when deployed behind a proxy or load balancer.");
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
