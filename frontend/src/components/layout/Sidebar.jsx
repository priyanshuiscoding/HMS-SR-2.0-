import { NavLink } from "../../router.jsx";
import brandLogo from "../../assets/certificates/shanti-ratnam-logo-full.png";
import { useAuth } from "../../hooks/useAuth.js";
import { canAccess, moduleKeyForPath } from "../../utils/accessModules.js";

const primaryLinks = [
  { label: "Dashboard", to: "/", roles: [] },
  { label: "Patients", to: "/patients", roles: ["admin", "reception", "doctor", "pharmacy", "lab", "therapist", "nursing", "housekeeping", "accounts", "hr"] },
  { label: "Appointments", to: "/appointments", roles: ["admin", "reception", "doctor"] },
  { label: "Calendar", to: "/calendar", roles: ["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"] },
  { label: "Certificates", to: "/certificates", roles: ["admin", "doctor", "reception"] },
  { label: "OPD", to: "/opd", roles: ["admin", "reception", "doctor", "nursing"] },
  { label: "Billing", to: "/billing", roles: ["admin", "accounts", "reception", "doctor"] },
  { label: "IPD", to: "/ipd", roles: ["admin", "accounts", "reception", "doctor", "nursing"] },
  { label: "Panchkarma", to: "/panchkarma", roles: ["admin", "accounts", "reception", "doctor", "therapist"] },
  { label: "Rooms", to: "/rooms", roles: ["admin", "accounts", "reception", "doctor", "nursing"] },
  { label: "Laboratory", to: "/laboratory", roles: ["admin", "doctor", "reception", "lab", "accounts"] },
  { label: "Pharmacy", to: "/pharmacy", roles: ["admin", "pharmacy", "doctor", "accounts"] },
  { label: "Inventory", to: "/inventory", roles: ["admin", "accounts", "nursing", "hr", "housekeeping"] },
  { label: "HR", to: "/hr", roles: ["admin", "hr"] }
];

const adminLinks = [
  { label: "Users", to: "/users", roles: ["admin", "hr"] },
  { label: "Reports", to: "/reports", roles: ["admin", "doctor", "accounts", "lab", "therapist", "reception", "nursing", "pharmacy"] },
  { label: "Settings", to: "/settings", roles: ["admin"], privileged: true }
];

export function Sidebar() {
  const { user } = useAuth();
  const isVisible = (link) => link.privileged
    ? link.roles.includes(user?.role)
    : canAccess({
      role: user?.role,
      grantedModules: user?.grantedModules || [],
      allowedRoles: link.roles,
      moduleKey: moduleKeyForPath(link.to)
    });
  const visiblePrimaryLinks = primaryLinks.filter(isVisible);
  const visibleAdminLinks = adminLinks.filter(isVisible);
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
        <img src={brandLogo} alt="Shanti Ratnam" className="brand-mark-badge" />
        <div className="brand-mark-text">
          <div className="brand-mark-title">SR-AIIMS HMS</div>
          {/* <div className="brand-mark-subtitle">Hospital Management</div> */}
        </div>
      </div>

      <div className="sidebar-section-title">Core Flow</div>
      {visiblePrimaryLinks.map(renderLink)}

      {visibleAdminLinks.length ? <div className="sidebar-section-title">Admin</div> : null}
      {visibleAdminLinks.map(renderLink)}
    </aside>
  );
}
