import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useUnreadIndicators } from "../hooks/useUnreadIndicators";
import { SAFE_API_URL } from "../services/apiClient";

function AdminNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadNotifications, refreshUnreadCounts } = useUnreadIndicators({
    includeMessages: false,
  });

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${
      isActive ? "text-[#0F766E]" : "text-[#6B7280] hover:text-[#1F2937]"
    }`;

  useEffect(() => {
    refreshUnreadCounts();
  }, [location.pathname, refreshUnreadCounts]);

  const getUnreadCount = (key) => {
    if (key === "notifications") return unreadNotifications;
    return 0;
  };

  const renderNavLabel = (label, unreadCount) => (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {unreadCount > 0 ? (
        <span
          className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-semibold leading-4 text-white"
          aria-label={`${unreadCount} unread`}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </span>
  );

  const handleLogout = async () => {
    setIsMenuOpen(false);
    try {
      await fetch(`${SAFE_API_URL}/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/login");
    }
  };

  const navLinks = [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/photographer-requests", label: "Photographer Requests" },
    { to: "/admin/reviews", label: "Reviews" },
    { to: "/admin/users", label: "Users" },
    { to: "/admin/bookings", label: "Bookings" },
    { to: "/admin/payouts", label: "Payouts" },
    { to: "/admin/reports", label: "Reports" },
    { to: "/admin/analytics", label: "Analytics" },
    { to: "/admin/notifications", label: "Notifications", unreadKey: "notifications" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E1D4] bg-[#FFFCF6]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-lg font-semibold tracking-wide text-[#1F2937]" onClick={() => setIsMenuOpen(false)}>
          ShotSphere
        </Link>
        <nav className="hidden flex-1 overflow-x-auto md:block" aria-label="Main navigation">
          <ul className="flex min-w-max items-center gap-3 sm:gap-5">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={navLinkClass}>
                  {renderNavLabel(link.label, getUnreadCount(link.unreadKey))}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <button type="button" onClick={handleLogout}
            className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B5E58]">
            Logout
          </button>
        </div>
        <button type="button"
          className="inline-flex items-center justify-center rounded-lg border border-[#E7E1D4] p-2 text-[#1F2937] md:hidden"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>
      {isMenuOpen ? (
        <div className="border-t border-[#E7E1D4] bg-[#FFFCF6] px-4 py-4 md:hidden">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={navLinkClass} onClick={() => setIsMenuOpen(false)}>
                  {renderNavLabel(link.label, getUnreadCount(link.unreadKey))}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <button type="button" onClick={handleLogout}
              className="w-full rounded-full bg-[#0F766E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B5E58]">
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default AdminNavbar;
