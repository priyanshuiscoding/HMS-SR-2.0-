import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "../pages/auth/Login.jsx";
import { AppointmentsPage } from "../pages/appointments/AppointmentsPage.jsx";
import { BillingPage } from "../pages/billing/BillingPage.jsx";
import { CalendarPage } from "../pages/calendar/CalendarPage.jsx";
import { DashboardPage } from "../pages/dashboard/Dashboard.jsx";
import { InventoryPage } from "../pages/inventory/InventoryPage.jsx";
import { HrPage } from "../pages/hr/HrPage.jsx";
import { IpdPage } from "../pages/ipd/IpdPage.jsx";
import { LaboratoryPage } from "../pages/laboratory/LaboratoryPage.jsx";
import { OpdPage } from "../pages/opd/OpdPage.jsx";
import { PanchkarmaPage } from "../pages/panchkarma/PanchkarmaPage.jsx";
import { PharmacyPage } from "../pages/pharmacy/PharmacyPage.jsx";
import { PatientProfilePage } from "../pages/patients/PatientProfilePage.jsx";
import { PatientsPage } from "../pages/patients/PatientsPage.jsx";
import { PlaceholderPage } from "../pages/placeholders/PlaceholderPage.jsx";
import { ReportsPage } from "../pages/reports/ReportsPage.jsx";
import { RoomsPage } from "../pages/rooms/RoomsPage.jsx";
import { UsersPage } from "../pages/users/UsersPage.jsx";
import { ProtectedRoute } from "./ProtectedRoute.jsx";

const patientReadRoles = ["admin", "reception", "doctor", "pharmacy", "lab", "therapist", "nursing", "housekeeping", "accounts", "hr"];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute allowedRoles={patientReadRoles}><PatientsPage /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute allowedRoles={patientReadRoles}><PatientProfilePage /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute allowedRoles={["admin", "reception", "doctor"]}><AppointmentsPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute allowedRoles={["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"]}><CalendarPage /></ProtectedRoute>} />
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
  );
}


