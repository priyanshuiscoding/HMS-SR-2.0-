import { NavLink } from "react-router-dom";

const primaryLinks = [
  { label: "Dashboard", to: "/" },
  { label: "Patients", to: "/patients" },
  { label: "Appointments", to: "/appointments" },
  { label: "Calendar", to: "/calendar" },
  { label: "OPD", to: "/opd" },
  { label: "Billing", to: "/billing" },
  { label: "IPD", to: "/ipd" },
  { label: "Panchkarma", to: "/panchkarma" },
  { label: "Rooms", to: "/rooms" },
  { label: "Laboratory", to: "/laboratory" },
  { label: "Pharmacy", to: "/pharmacy" },
  { label: "Inventory", to: "/inventory" }
];

const adminLinks = [
  { label: "Users", to: "/users" },
  { label: "Reports", to: "/reports" },
  { label: "Settings", to: "/settings" }
];

export function Sidebar() {
  const renderLink = ({ label, to }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
    >
      <span>{label}</span>
      <span>+</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="brand-mark">
        <div className="brand-mark-badge">SR</div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.65, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            White - Blue - Saffron
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>SR-AIIMS HMS</div>
        </div>
      </div>

      <div className="sidebar-section-title">Core Flow</div>
      {primaryLinks.map(renderLink)}

      <div className="sidebar-section-title">Admin</div>
      {adminLinks.map(renderLink)}
    </aside>
  );
}
