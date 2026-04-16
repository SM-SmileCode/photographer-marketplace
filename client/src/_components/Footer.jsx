import React from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

function Footer() {
  const year = new Date().getFullYear();

  const footerSections = [
    {
      title: "Product",
      links: [
        { label: "Explore Photographers", to: "/explore" },
        { label: "How It Works", to: "/about" },
        { label: "Pricing", to: "/pricing" },
        { label: "Features", to: "/features" },
      ],
    },
    {
      title: "For Photographers",
      links: [
        { label: "Become a Photographer", to: "/signup" },
        { label: "Photographer Dashboard", to: "/photographer/dashboard" },
        { label: "Earnings", to: "/photographer/earnings" },
        { label: "Support", to: "/support" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", to: "/about" },
        { label: "Blog", to: "/blog" },
        { label: "Careers", to: "/careers" },
        { label: "Contact", to: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy" },
        { label: "Terms of Service", to: "/terms" },
        { label: "Cookie Policy", to: "/cookies" },
        { label: "Refund Policy", to: "/refund" },
      ],
    },
  ];

  const socialLinks = [
    { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
    { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
    { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  ];

  return (
    <footer className="border-t border-[#E7E1D4] bg-[#FFFCF6]">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Top Section: Brand + Newsletter */}
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold tracking-wide text-[#1F2937]">
              ShotSphere
            </h2>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[#6B7280]">
              Connect with trusted photographers and bring your vision to life. Whether you're looking for a professional photoshoot or want to showcase your photography skills, ShotSphere is your go-to platform.
            </p>
            <div className="mt-2 flex gap-1">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E7E1D4] text-[#6B7280] transition hover:border-[#0F766E] hover:bg-[#0F766E] hover:text-white"
                  >
                    <Icon size={12} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Newsletter Signup */}
          <div className="rounded-2xl border border-[#E7E1D4] bg-white p-3">
            <h3 className="text-sm font-semibold text-[#1F2937]">
              Stay Updated
            </h3>
            <p className="mt-1 text-[11px] text-[#6B7280]">
              Subscribe to get the latest photography tips, ShotSphere updates, and exclusive offers.
            </p>
            <form className="mt-1 flex flex-col gap-1 sm:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 rounded-lg border border-[#E7E1D4] bg-white px-2.5 py-1 text-[11px] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20"
                required
              />
              <button
                type="submit"
                className="rounded-lg bg-[#0F766E] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#0B5E58]"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-1 text-[11px] text-[#6B7280]">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>

        {/* Links Grid */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1F2937]">
                {section.title}
              </h4>
              <ul className="mt-1 space-y-1">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[11px] text-[#6B7280] transition hover:text-[#0F766E] hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact Info */}
        <div className="mb-4 grid gap-3 rounded-2xl border border-[#E7E1D4] bg-white p-3 sm:grid-cols-3">
          <div className="flex gap-1">
            <Mail className="h-3 w-3 flex-shrink-0 text-[#0F766E]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                Email
              </p>
              <a
                href="mailto:support@shotsphere.com"
                className="mt-0 text-[11px] text-[#1F2937] hover:text-[#0F766E]"
              >
                support@shotsphere.com
              </a>
            </div>
          </div>
          <div className="flex gap-1">
            <Phone className="h-3 w-3 flex-shrink-0 text-[#0F766E]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                Phone
              </p>
              <a
                href="tel:+1234567890"
                className="mt-0 text-[11px] text-[#1F2937] hover:text-[#0F766E]"
              >
                +1 (234) 567-890
              </a>
            </div>
          </div>
          <div className="flex gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0 text-[#0F766E]" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                Location
              </p>
              <p className="mt-0 text-[11px] text-[#1F2937]">
                San Francisco, CA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#E7E1D4] bg-[#F9F7F3] px-4 py-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-[#6B7280]">
              &copy; {year} ShotSphere. All rights reserved.
            </p>
            <div className="flex gap-3 text-[11px] text-[#6B7280]">
              <Link to="/privacy" className="hover:text-[#0F766E]">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-[#0F766E]">
                Terms
              </Link>
              <Link to="/sitemap" className="hover:text-[#0F766E]">
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
