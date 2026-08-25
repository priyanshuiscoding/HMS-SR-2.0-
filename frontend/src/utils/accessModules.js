// Mirrors the backend module catalog (config/constants.js). Keeps the frontend
// route guards and sidebar in sync with what an admin can grant. `key` matches the
// API module key stored in a user's grantedModules; `path` is the frontend route.
export const accessModules = [
  { key: "patients", label: "Patients", path: "/patients" },
  { key: "appointments", label: "Appointments", path: "/appointments" },
  { key: "calendar", label: "Calendar", path: "/calendar" },
  { key: "certificates", label: "Certificates", path: "/certificates" },
  { key: "opd", label: "OPD", path: "/opd" },
  { key: "ipd", label: "IPD", path: "/ipd" },
  { key: "billing", label: "Billing", path: "/billing" },
  { key: "panchkarma", label: "Panchkarma", path: "/panchkarma" },
  { key: "rooms", label: "Rooms & Beds", path: "/rooms" },
  { key: "lab", label: "Laboratory", path: "/laboratory" },
  { key: "pharmacy", label: "Pharmacy", path: "/pharmacy" },
  { key: "inventory", label: "Inventory", path: "/inventory" },
  { key: "hr", label: "HR", path: "/hr" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "users", label: "User Management", path: "/users" }
];

// Maps a top-level route segment (e.g. "laboratory") to its module key (e.g. "lab").
const SEGMENT_TO_MODULE = accessModules.reduce((acc, module) => {
  const segment = module.path.replace(/^\//, "");
  acc[segment] = module.key;
  return acc;
}, {});

export function moduleKeyForPath(pathname = "") {
  const segment = pathname.split("/").filter(Boolean)[0] || "";
  return SEGMENT_TO_MODULE[segment] || segment;
}

// True if the user may open a route, given the roles allowed on it plus any modules
// an admin has granted them directly.
export function canAccess({ role, grantedModules = [], allowedRoles, moduleKey }) {
  if (!allowedRoles?.length) {
    return true;
  }

  if (allowedRoles.includes(role)) {
    return true;
  }

  const privilegedModules = new Set(["users", "hr", "settings"]);
  if (role === "doctor" && moduleKey && !privilegedModules.has(moduleKey)) {
    return true;
  }

  return Boolean(moduleKey) && !privilegedModules.has(moduleKey) && grantedModules.includes(moduleKey);
}

export function canPerformModuleAction(user, moduleKey, allowedRoles = []) {
  if (allowedRoles.includes(user?.role)) {
    return true;
  }

  return Boolean(moduleKey)
    && !["users", "hr", "settings"].includes(moduleKey)
    && (user?.grantedModules || []).includes(moduleKey);
}
