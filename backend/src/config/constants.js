import { staffWorkSchedules } from "./hospitalData.js";

export const roles = {
  ADMIN: "admin",
  RECEPTION: "reception",
  DOCTOR: "doctor",
  PHARMACY: "pharmacy",
  LAB: "lab",
  THERAPIST: "therapist",
  NURSING: "nursing",
  HOUSEKEEPING: "housekeeping",
  ACCOUNTS: "accounts",
  HR: "hr"
};

// Modules an admin can grant a user access to, on top of their base role.
// `key` MUST match the API mount segment in routes/index.js (used by authorize()).
// `path` is the matching frontend route (kept here so the catalog is the single
// source of truth shared by backend enforcement and the admin UI).
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

export const accessModuleKeys = accessModules.map((module) => module.key);

export function sanitizeGrantedModules(modules) {
  if (!Array.isArray(modules)) {
    return [];
  }

  return Array.from(
    new Set(
      modules
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => accessModuleKeys.includes(value))
    )
  );
}

const departmentOptions = [
  "Administration",
  "Clinical Department",
  "Housekeeping",
  "Nursing",
  "Panchkarma",
  "Pharmacy",
  "Reception",
  "Neuro Pain Management",
  "Diabetic Reversal Program",
  "Panchkarma Therapies",
  "Yoga & Wellness",
  "Orthopaedic Department",
  "Oncology Department",
  "Pulmonology Department",
  "Women's Health Department",
  "Gastroenterology Department",
  "Urology Department",
  "Neurology Department",
  "Sexual Health Department",
  "Skin And Hair Department",
  "Diet And Nutrition Department",
  "Yoga And Naturopathy Department",
  "Mental Wellbeing Department"
];

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.length > 10 ? `+${digits}` : digits;
}

function formatName(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/DR\./gi, "Dr. ")
    .replace(/MR\./gi, "Mr. ")
    .replace(/MRS\./gi, "Mrs. ")
    .replace(/MRS /gi, "Mrs. ")
    .replace(/MS\./gi, "Ms. ")
    .replace(/MISS\./gi, "Miss. ");

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((segment) => {
      if (/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss\.)$/i.test(segment)) {
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      }

      return segment
        .split("/")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join("/");
    })
    .join(" ");
}

function normalizeDepartment(value) {
  const department = String(value || "").trim();

  switch (department.toLowerCase()) {
    case "admin":
      return "Administration";
    case "clinical department":
      return "Clinical Department";
    case "housekeeping":
      return "Housekeeping";
    case "panchkarma":
      return "Panchkarma";
    case "managing director":
      return "Clinical Department";
    default:
      return department;
  }
}

function normalizePersonName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss)\.?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function schedulesForUser(fullName) {
  const normalizedName = normalizePersonName(fullName);
  const parts = normalizedName.split(" ").filter(Boolean);
  const firstLastKey = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : normalizedName;

  return staffWorkSchedules.filter((schedule) => {
    const scheduleName = normalizePersonName(schedule.name);
    return scheduleName === normalizedName || scheduleName === firstLastKey || normalizedName.endsWith(scheduleName);
  });
}

function inferRole(department, designation, fullName) {
  const normalizedDepartment = normalizeDepartment(department).toLowerCase();
  const normalizedDesignation = String(designation || "").toLowerCase();
  const normalizedName = String(fullName || "").toLowerCase();

  if (
    normalizedName.startsWith("dr.") ||
    normalizedDepartment === "clinical department" ||
    normalizedDesignation.includes("medical officer") ||
    normalizedDesignation.includes("joint & spine specialist")
  ) {
    return roles.DOCTOR;
  }

  if (normalizedDepartment === "administration" && normalizedDesignation.includes("hr")) {
    return roles.HR;
  }

  if (normalizedDepartment === "administration") {
    return roles.ADMIN;
  }

  if (normalizedDepartment === "reception") {
    return roles.RECEPTION;
  }

  if (normalizedDepartment === "pharmacy") {
    return roles.PHARMACY;
  }

  if (normalizedDepartment === "panchkarma") {
    return roles.THERAPIST;
  }

  if (normalizedDepartment === "nursing") {
    return roles.NURSING;
  }

  if (normalizedDepartment === "housekeeping") {
    return roles.HOUSEKEEPING;
  }

  return roles.ADMIN;
}

function defaultPasswordForRole(role) {
  switch (role) {
    case roles.ADMIN:
      return "Admin@123";
    case roles.RECEPTION:
      return "Reception@123";
    case roles.DOCTOR:
      return "Doctor@123";
    case roles.PHARMACY:
      return "Pharmacy@123";
    case roles.HR:
      return "Hr@12345";
    case roles.ACCOUNTS:
      return "Accounts@123";
    default:
      return "Welcome@123";
  }
}

const employeeSeedRows = [
  {
    employeeId: "SRA-EMP-001",
    fullName: "DR.SAURABH BHARILL",
    department: "Managing Director",
    designation: "Managing Director",
    phone: ""
  },
  {
    employeeId: "SRA-EMP-002",
    fullName: "DR. M SENTHILKUMAR",
    department: "Clinical Department",
    designation: "RMO (Joint & Spine Specialist)",
    phone: "+91 63858 99964"
  },
  {
    employeeId: "SRA-EMP-003",
    fullName: "DR.RIYA BHARGAV",
    department: "Clinical Department",
    designation: "Ayurvedic Medical Officer (AMO)",
    phone: "+91 97528 39244"
  },
  {
    employeeId: "SRA-EMP-004",
    fullName: "DR. SANKET CHINTEWAR",
    department: "Clinical Department",
    designation: "Junior Medical Officer (JMO)",
    phone: "+91 88550 90878"
  },
  {
    employeeId: "SRA-EMP-005",
    fullName: "MR.PRADEEP JAIN",
    department: "Admin",
    designation: "Hospital Manager",
    phone: "+91 87208 95586"
  },
  {
    employeeId: "SRA-EMP-006",
    fullName: "MS. KHUSHBOO GOVA",
    department: "Admin",
    designation: "HR Assistant",
    phone: "+91 82698 26288"
  },
  {
    employeeId: "SRA-EMP-007",
    fullName: "MRS SABNAM KHAN",
    department: "Housekeeping",
    designation: "Housekeeping",
    phone: "+91 92385 24938"
  },
  {
    employeeId: "SRA-EMP-008",
    fullName: "MRS PREETI PATEL",
    department: "Housekeeping",
    designation: "Housekeeping",
    phone: "+91 94256 10131"
  },
  {
    employeeId: "SRA-EMP-009",
    fullName: "MRS JYOTI AHIRWAR",
    department: "Housekeeping",
    designation: "Housekeeping",
    phone: "6264386206"
  },
  {
    employeeId: "SRA-EMP-010",
    fullName: "MR. BRIJENDEA",
    department: "Nursing",
    designation: "Nursing Staff",
    phone: "+91 62674 91118"
  },
  {
    employeeId: "SRA-EMP-011",
    fullName: "MS. REKHA RAJAK",
    department: "Nursing",
    designation: "Nursing Staff",
    phone: "+91 82696 57142"
  },
  {
    employeeId: "SRA-EMP-012",
    fullName: "MRS. NEETU SHARMA",
    department: "Panchkarma",
    designation: "Panchkarma Supervisor",
    phone: "+91 99810 54600"
  },
  {
    employeeId: "SRA-EMP-013",
    fullName: "MRS RAJNI SEN",
    department: "Panchkarma",
    designation: "Panchkarma Therapist",
    phone: "+91 99076 54035"
  },
  {
    employeeId: "SRA-EMP-014",
    fullName: "MR YOGESH LARIYA",
    department: "Panchkarma",
    designation: "Panchkarma Therapist",
    phone: "+91 92012 50296"
  },
  {
    employeeId: "SRA-EMP-015",
    fullName: "MRS GAYATRI",
    department: "Panchkarma",
    designation: "Panchkarma Therapist",
    phone: "+91 92012 50296"
  },
  {
    employeeId: "SRA-EMP-016",
    fullName: "MR ROHIT YADAV",
    department: "Panchkarma",
    designation: "Panchkarma Therapist",
    phone: "+91 7489 878 933"
  },
  {
    employeeId: "SRA-EMP-017",
    fullName: "MR RISHI JAIN",
    department: "Pharmacy",
    designation: "Pharmacy Manager",
    phone: "+91 75809 38485"
  },
  {
    employeeId: "SRA-EMP-018",
    fullName: "MR SURAJ RAIKWAR",
    department: "Pharmacy",
    designation: "Pharmacy Executive",
    phone: "+91 78793 08018"
  },
  {
    employeeId: "SRA-EMP-019",
    fullName: "MISS.AARTI CHAKRAVARTI",
    department: "Reception",
    designation: "Receptionist (Supervisor)",
    phone: "+91 62639 91324"
  },
  {
    employeeId: "SRA-EMP-020",
    fullName: "MR. KHILAN KUMAR",
    department: "Reception",
    designation: "Receptionist",
    phone: "+91 62695 57242"
  },
  {
    employeeId: "SRA-EMP-021",
    fullName: "MRS SATYAM NAMDEV",
    department: "Reception",
    designation: "Receptionist",
    phone: "+91 89825 65845"
  }
];

export const demoUsers = employeeSeedRows.map((entry, index) => {
  const fullName = formatName(entry.fullName);
  const department = normalizeDepartment(entry.department);
  const role = inferRole(department, entry.designation, fullName);
  const emailPrefix = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss\.)\s+/i, "");
  const generatedEmail = `${slugify(emailPrefix).replace(/-/g, ".")}@sraiims.in`;

  let email = generatedEmail;
  let password = defaultPasswordForRole(role);

  if (fullName === "Mr. Pradeep Jain") {
    email = "admin@sraiims.in";
    password = "Admin@123";
  } else if (fullName === "Miss. Aarti Chakravarti") {
    email = "reception@sraiims.in";
    password = "Reception@123";
  } else if (fullName === "Dr. Saurabh Bharill") {
    email = "doctor@sraiims.in";
    password = "Doctor@123";
  } else if (fullName === "Ms. Khushboo Gova") {
    email = "hr@sraiims.in";
    password = "Hr@12345";
  }

  return {
    id: `staff-${String(index + 1).padStart(3, "0")}`,
    employeeId: entry.employeeId,
    fullName,
    email,
    password,
    role,
    department,
    title: entry.designation || department,
    designation: entry.designation || department,
    phone: cleanPhone(entry.phone),
    workSchedules: schedulesForUser(fullName),
    isActive: true
  };
});

export const departments = Array.from(new Set([...departmentOptions, ...demoUsers.map((user) => user.department)])).sort();
