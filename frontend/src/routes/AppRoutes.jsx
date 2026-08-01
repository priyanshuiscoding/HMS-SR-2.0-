import { lazy, Suspense } from "react";

import { Navigate, Route, Routes } from "../router.jsx";

import { ProtectedRoute } from "./ProtectedRoute.jsx";

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const LoginPage = lazyNamed(() => import("../pages/auth/Login.jsx"), "LoginPage");
const AppointmentsPage = lazyNamed(() => import("../pages/appointments/AppointmentsPage.jsx"), "AppointmentsPage");
const BillingPage = lazyNamed(() => import("../pages/billing/BillingPage.jsx"), "BillingPage");
const CalendarPage = lazyNamed(() => import("../pages/calendar/CalendarPage.jsx"), "CalendarPage");
const CertificatesPage = lazyNamed(() => import("../pages/certificates/CertificatesPage.jsx"), "CertificatesPage");
const DashboardPage = lazyNamed(() => import("../pages/dashboard/Dashboard.jsx"), "DashboardPage");
const InventoryPage = lazyNamed(() => import("../pages/inventory/InventoryPage.jsx"), "InventoryPage");
const HrPage = lazyNamed(() => import("../pages/hr/HrPage.jsx"), "HrPage");
const IpdPage = lazyNamed(() => import("../pages/ipd/IpdPage.jsx"), "IpdPage");
const LaboratoryPage = lazyNamed(() => import("../pages/laboratory/LaboratoryPage.jsx"), "LaboratoryPage");
const OpdPage = lazyNamed(() => import("../pages/opd/OpdPage.jsx"), "OpdPage");
const PanchkarmaPage = lazyNamed(() => import("../pages/panchkarma/PanchkarmaPage.jsx"), "PanchkarmaPage");
const PharmacyPage = lazyNamed(() => import("../pages/pharmacy/PharmacyPage.jsx"), "PharmacyPage");
const PatientProfilePage = lazyNamed(() => import("../pages/patients/PatientProfilePage.jsx"), "PatientProfilePage");
const PatientsPage = lazyNamed(() => import("../pages/patients/PatientsPage.jsx"), "PatientsPage");
const PlaceholderPage = lazyNamed(() => import("../pages/placeholders/PlaceholderPage.jsx"), "PlaceholderPage");
const ReportsPage = lazyNamed(() => import("../pages/reports/ReportsPage.jsx"), "ReportsPage");
const RoomsPage = lazyNamed(() => import("../pages/rooms/RoomsPage.jsx"), "RoomsPage");
const UsersPage = lazyNamed(() => import("../pages/users/UsersPage.jsx"), "UsersPage");

const patientReadRoles = ["admin", "reception", "doctor", "pharmacy", "lab", "therapist", "nursing", "housekeeping", "accounts", "hr"];

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading module…</div>}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute allowedRoles={patientReadRoles}><PatientsPage /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={patientReadRoles}><PatientProfilePage /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute allowedRoles={["admin", "reception", "doctor"]}><AppointmentsPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute allowedRoles={["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"]}><CalendarPage /></ProtectedRoute>} />
      <Route path="/certificates" element={<ProtectedRoute allowedRoles={["admin", "doctor", "reception"]}><CertificatesPage /></ProtectedRoute>} />
      <Route path="/opd" element={<ProtectedRoute allowedRoles={["admin", "reception", "doctor", "nursing"]}><OpdPage /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute allowedRoles={["admin", "accounts", "reception", "doctor"]}><BillingPage /></ProtectedRoute>} />
      <Route path="/ipd" element={<ProtectedRoute allowedRoles={["admin", "accounts", "reception", "doctor", "nursing"]}><IpdPage /></ProtectedRoute>} />
      <Route path="/panchkarma" element={<ProtectedRoute allowedRoles={["admin", "accounts", "reception", "doctor", "therapist"]}><PanchkarmaPage /></ProtectedRoute>} />
      <Route path="/rooms" element={<ProtectedRoute allowedRoles={["admin", "accounts", "reception", "doctor", "nursing"]}><RoomsPage /></ProtectedRoute>} />
      <Route path="/laboratory" element={<ProtectedRoute allowedRoles={["admin", "doctor", "reception", "lab", "accounts"]}><LaboratoryPage /></ProtectedRoute>} />
      <Route path="/pharmacy" element={<ProtectedRoute allowedRoles={["admin", "pharmacy", "doctor", "accounts"]}><PharmacyPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute allowedRoles={["admin", "accounts", "nursing", "hr", "housekeeping"]}><InventoryPage /></ProtectedRoute>} />
      <Route path="/hr" element={<ProtectedRoute allowedRoles={["admin", "hr"]}><HrPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={["admin", "hr"]}><UsersPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "doctor", "accounts", "lab", "therapist", "reception", "nursing", "pharmacy"]}><ReportsPage /></ProtectedRoute>} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PlaceholderPage
              title="System settings will hold rooms, medicines, SMS, and operational masters."
              copy="This area is intentionally held back until the core data model is live and validated."
            />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}


