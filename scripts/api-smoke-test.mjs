const baseUrl = String(process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const email = String(process.env.SMOKE_EMAIL || "").trim();
const password = String(process.env.SMOKE_PASSWORD || "");
const nursingEmail = String(process.env.SMOKE_NURSING_EMAIL || "").trim();
const nursingPassword = String(process.env.SMOKE_NURSING_PASSWORD || "");
const doctorEmail = String(process.env.SMOKE_DOCTOR_EMAIL || "").trim();
const doctorPassword = String(process.env.SMOKE_DOCTOR_PASSWORD || "");
const missingId = "00000000-0000-0000-0000-000000000000";
const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
}

function cookieFrom(response) {
  const setCookie = response.headers.get("set-cookie") || "";
  return setCookie.split(";")[0];
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
}

async function expectStatus(name, path, expected, options = {}) {
  try {
    const response = await request(path, options);
    if (response.status !== expected) {
      const payload = await response.text();
      throw new Error(`expected ${expected}, received ${response.status}: ${payload.slice(0, 160)}`);
    }
    record(name, "passed", `${response.status} ${path}`);
    return response;
  } catch (error) {
    record(name, "failed", error.message);
    return null;
  }
}

await expectStatus("Liveness", "/health", 200);
await expectStatus("Database readiness", "/ready", 200);
await expectStatus("Protected API rejects anonymous access", "/api/v1/system/overview", 401);
await expectStatus("Weak reset password rejected", "/api/v1/auth/reset-password", 400, {
  method: "POST",
  body: JSON.stringify({ email: "nobody@example.invalid", otp: "123456", newPassword: "weakpass" })
});
await expectStatus("Oversized auth request rejected", "/api/v1/auth/login", 413, {
  method: "POST",
  body: JSON.stringify({ email: `${"x".repeat(70000)}@example.invalid`, password: "irrelevant" })
});

for (const path of [
  "/api/v1/opd/visits/00000000-0000-0000-0000-000000000000/vitals",
  "/api/v1/opd/visits/00000000-0000-0000-0000-000000000000/systemic-examination",
  "/api/v1/opd/visits/00000000-0000-0000-0000-000000000000/history-taking"
]) {
  await expectStatus(`Anonymous write blocked: ${path.split("/").pop()}`, path, 401, {
    method: "PUT",
    body: "{}"
  });
}

if (!email || !password) {
  record("Authenticated endpoint suite", "failed", "Set SMOKE_EMAIL and SMOKE_PASSWORD to a dedicated active admin test account.");
} else {
  const login = await expectStatus("Login", "/api/v1/auth/login", 200, {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  if (login) {
    const loginPayload = await login.json();
    const initialCookie = cookieFrom(login);
    const accessToken = loginPayload.accessToken;

    if (loginPayload.refreshToken) record("Refresh token is HttpOnly-only", "failed", "Login JSON exposed refreshToken.");
    else if (!initialCookie.startsWith("refreshToken=")) record("Refresh cookie issued", "failed", "Login did not issue a refresh cookie.");
    else record("Refresh token is HttpOnly-only", "passed");

    const rawRefreshToken = initialCookie.slice("refreshToken=".length);
    await expectStatus("Refresh token cannot authorize API calls", "/api/v1/system/overview", 401, {
      headers: { Authorization: `Bearer ${rawRefreshToken}` }
    });

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const readEndpoints = [
      ["Current user", "/api/v1/auth/me"],
      ["System overview", "/api/v1/system/overview"],
      ["Patients", "/api/v1/patients"],
      ["Patient pagination", "/api/v1/patients?page=2&pageSize=2"],
      ["Paginated patient text search", "/api/v1/patients?search=Validate%20Opd&page=1&pageSize=2"],
      ["Appointments", "/api/v1/appointments"],
      ["Appointment masters", "/api/v1/appointments/masters"],
      ["OPD queue", "/api/v1/opd/queue"],
      ["OPD masters", "/api/v1/opd/masters"],
      ["OPD clinical history", "/api/v1/opd/history?search=Validate%20Opd&page=1&pageSize=2"],
      ["Laboratory summary", "/api/v1/lab/summary"],
      ["Laboratory tests", "/api/v1/lab/tests"],
      ["Billing summary", "/api/v1/billing/summary"],
      ["Billing masters", "/api/v1/billing/masters"],
      ["Panchkarma summary", "/api/v1/panchkarma/summary"],
      ["Panchkarma masters", "/api/v1/panchkarma/masters"],
      ["Pharmacy stock", "/api/v1/pharmacy/stock"],
      ["Pharmacy masters", "/api/v1/pharmacy/masters"],
      ["Inventory masters", "/api/v1/inventory/masters"],
      ["IPD summary", "/api/v1/ipd/summary"],
      ["IPD masters", "/api/v1/ipd/masters"],
      ["Room availability", "/api/v1/rooms/availability"],
      ["Room masters", "/api/v1/rooms/masters"],
      ["Reports overview", "/api/v1/reports/overview"],
      ["HR overview", "/api/v1/hr/overview"],
      ["Calendar", "/api/v1/calendar/events"],
      ["Certificates", "/api/v1/certificates"],
      ["Users", "/api/v1/users"]
    ];

    for (const [name, path] of readEndpoints) {
      await expectStatus(name, path, 200, { headers: authHeaders });
    }
    await expectStatus("Patient archive requires a reason", `/api/v1/patients/${missingId}`, 400, {
      method: "DELETE",
      headers: authHeaders,
      body: JSON.stringify({ reason: "" })
    });
    await expectStatus("User creation requires an explicit strong password", "/api/v1/users", 400, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: "SMOKE-NOT-CREATED",
        fullName: "Smoke Check",
        email: "smoke-check@example.invalid",
        role: "reception",
        department: "Reception"
      })
    });

    const refresh = await expectStatus("Refresh rotation", "/api/v1/auth/refresh", 200, {
      method: "POST",
      headers: { Cookie: initialCookie },
      body: "{}"
    });

    if (refresh) {
      const refreshPayload = await refresh.json();
      const rotatedCookie = cookieFrom(refresh);
      if (refreshPayload.refreshToken) record("Rotated token remains HttpOnly-only", "failed", "Refresh JSON exposed refreshToken.");
      else record("Rotated token remains HttpOnly-only", "passed");
      await expectStatus("Refresh replay rejected", "/api/v1/auth/refresh", 401, {
        method: "POST",
        headers: { Cookie: initialCookie },
        body: "{}"
      });
      await expectStatus("Logout revokes refresh session", "/api/v1/auth/logout", 200, {
        method: "POST",
        headers: { Cookie: rotatedCookie },
        body: "{}"
      });
      await expectStatus("Revoked refresh rejected", "/api/v1/auth/refresh", 401, {
        method: "POST",
        headers: { Cookie: rotatedCookie },
        body: "{}"
      });
    }
  }
}

async function roleSession(label, roleEmail, rolePassword) {
  const response = await expectStatus(`${label} login`, "/api/v1/auth/login", 200, {
    method: "POST",
    body: JSON.stringify({ email: roleEmail, password: rolePassword })
  });
  if (!response) return null;
  const payload = await response.json();
  return { token: payload.accessToken, cookie: cookieFrom(response) };
}

if (nursingEmail && nursingPassword) {
  const nursing = await roleSession("Nursing", nursingEmail, nursingPassword);
  if (nursing) {
    const headers = { Authorization: `Bearer ${nursing.token}` };
    await expectStatus("Nursing may enter general examination", `/api/v1/opd/visits/${missingId}/vitals`, 404, {
      method: "PUT", headers, body: "{}"
    });
    await expectStatus("Nursing cannot enter systemic examination", `/api/v1/opd/visits/${missingId}/systemic-examination`, 403, {
      method: "PUT", headers, body: "{}"
    });
    await expectStatus("Nursing cannot enter history taking", `/api/v1/opd/visits/${missingId}/history-taking`, 403, {
      method: "PUT", headers, body: "{}"
    });
    await expectStatus("Nursing logout", "/api/v1/auth/logout", 200, {
      method: "POST", headers: { Cookie: nursing.cookie }, body: "{}"
    });
  }
}

if (doctorEmail && doctorPassword) {
  const doctor = await roleSession("Doctor", doctorEmail, doctorPassword);
  if (doctor) {
    const headers = { Authorization: `Bearer ${doctor.token}` };
    await expectStatus("Doctor may enter systemic examination", `/api/v1/opd/visits/${missingId}/systemic-examination`, 404, {
      method: "PUT", headers, body: "{}"
    });
    await expectStatus("Doctor may enter history taking", `/api/v1/opd/visits/${missingId}/history-taking`, 404, {
      method: "PUT", headers, body: "{}"
    });
    await expectStatus("Doctor logout", "/api/v1/auth/logout", 200, {
      method: "POST", headers: { Cookie: doctor.cookie }, body: "{}"
    });
  }
}

const failed = results.filter((item) => item.status === "failed");
console.log(JSON.stringify({ baseUrl, results, failed: failed.length }, null, 2));
if (failed.length) process.exitCode = 1;
