import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

function GuestNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors ${isActive ? "text-[#0F766E]" : "text-[#6B7280] hover:text-[#1F2937]"}`;

  const navLinks = [
    { to: "/", label: "Home", end: true },
    { to: "/explore", label: "Explore Photographers" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/about", label: "About" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E1D4] bg-[#FFFCF6]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-lg font-semibold tracking-wide text-[#1F2937]" onClick={() => setIsMenuOpen(false)}>
          ShotSphere
        </Link>

        <nav className="hidden lg:block" aria-label="Main navigation">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={navLinkClass}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden lg:flex shrink-0 items-center gap-3">
          <NavLink to="/login" className="rounded-full border border-[#E7E1D4] px-4 py-2 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F5F2EA]">
            Login
          </NavLink>
          <NavLink to="/signup" className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0B5E58]">
            Signup
          </NavLink>
        </div>

        <div className="flex shrink-0 items-center gap-3 lg:hidden">
          <NavLink to="/login" className="rounded-full border border-[#E7E1D4] px-3 py-1.5 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F5F2EA]">
            Login
          </NavLink>
          <button type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[#E7E1D4] p-2 text-[#1F2937]"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-[#E7E1D4] bg-[#FFFCF6] px-4 py-4 lg:hidden">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className={navLinkClass} onClick={() => setIsMenuOpen(false)}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <NavLink to="/signup" onClick={() => setIsMenuOpen(false)}
              className="block w-full rounded-full bg-[#0F766E] px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-[#0B5E58]">
              Signup
            </NavLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default GuestNavbar;
