import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { fetchAdminDashboardMetrics } from "../services/adminService";

const fallbackMetrics = {
  summaryCards: [
    {
      title: "Pending Verifications",
      value: 0,
      hint: "Photographer profiles awaiting review",
    },
    {
      title: "Total Active Users",
      value: 0,
      hint: "Customers + photographers currently active",
    },
    {
      title: "Pending Bookings",
      value: 0,
      hint: "Booking requests awaiting photographer response",
    },
    {
      title: "Bookings This Month",
      value: 0,
      hint: "Total booking requests created this month",
    },
  ],
  verificationQueue: [],
  systemAlerts: [],
  quickStats: [],
};

function formatMetricValue(value) {
  if (typeof value === "number") return value.toLocaleString("en-IN");
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed.toLocaleString("en-IN");
  return String(value ?? "-");
}

function AdminDashboard() {
  const { user } = useOutletContext() || {};
  const displayName = user?.name || "Admin";
  const [metrics, setMetrics] = useState(fallbackMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const data = await fetchAdminDashboardMetrics();
        if (!isMounted) return;

        setMetrics({
          summaryCards: Array.isArray(data?.summaryCards)
            ? data.summaryCards
            : fallbackMetrics.summaryCards,
          verificationQueue: Array.isArray(data?.verificationQueue)
            ? data.verificationQueue
            : [],
          systemAlerts: Array.isArray(data?.systemAlerts)
            ? data.systemAlerts
            : [],
          quickStats: Array.isArray(data?.quickStats) ? data.quickStats : [],
        });
        setError("");
      } catch (fetchError) {
        if (!isMounted) return;
        setMetrics(fallbackMetrics);
        setError(fetchError?.message || "Failed to load admin dashboard data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="card-hero sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label-uppercase-lg">
                Admin Control Center
              </p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl leading-tight sm:text-4xl">
                Welcome back, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
                Oversee users, verifications, bookings, and performance with a
                single operational view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/photographer-requests"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                Review Requests
              </Link>
              <Link
                to="/admin/reports"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F2EEDF]"
              >
                Open Reports
              </Link>
              <Link
                to="/admin/reviews"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F2EEDF]"
              >
                Review Moderation
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.summaryCards.map((card) => (
            <article
              key={card.title}
              className="card-surface"
            >
              <p className="label-uppercase">
                {card.title}
              </p>
              <p className="mt-3 text-3xl font-semibold">
                {loading ? "..." : formatMetricValue(card.value)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.hint}</p>
            </article>
          ))}
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-5">
          <article className="card-surface lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                Photographer Verification Queue
              </h2>
              <Link
                to="/admin/photographer-requests"
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {metrics.verificationQueue.map((item) => (
                <div
                  key={`${item.name}-${item.submitted}`}
                  className="card-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "Pending"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {item.city} | {item.experience} experience
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Submitted: {item.submitted}
                  </p>
                </div>
              ))}
              {!loading && metrics.verificationQueue.length === 0 ? (
                <p className="card-white text-sm text-[var(--muted)]">
                  No pending verification requests right now.
                </p>
              ) : null}
            </div>
          </article>

          <article className="card-surface lg:col-span-2">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              System Alerts
            </h2>
            <ul className="mt-4 space-y-3">
              {metrics.systemAlerts.map((alert) => (
                <li
                  key={alert}
                  className="card-white px-4 py-3 text-sm text-[var(--muted)]"
                >
                  {alert}
                </li>
              ))}
              {!loading && metrics.systemAlerts.length === 0 ? (
                <li className="card-white px-4 py-3 text-sm text-[var(--muted)]">
                  No active alerts.
                </li>
              ) : null}
            </ul>
            <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] bg-[#FFFDF8] p-4">
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                Quick Actions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  to="/admin/users"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Users
                </Link>
                <Link
                  to="/admin/bookings"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Bookings
                </Link>
                <Link
                  to="/admin/analytics"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Analytics
                </Link>
              </div>
            </div>
          </article>
        </section>

        <section className="card-surface">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              ShotSphere Activity Snapshot
            </h2>
            <Link
              to="/admin/analytics"
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Open analytics
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.quickStats.map((stat) => (
              <div
                key={stat.label}
                className="card-white"
              >
                <p className="label-uppercase">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {loading ? "..." : formatMetricValue(stat.value)}
                </p>
              </div>
            ))}
            {!loading && metrics.quickStats.length === 0 ? (
              <p className="card-white text-sm text-[var(--muted)] sm:col-span-2 lg:col-span-4">
                Quick stats are currently unavailable.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboard;
