import { useEffect, useMemo, useState } from "react";
import { fetchAdminAnalytics } from "../services/adminService";

function toDistributionRows(rows = []) {
  return rows
    .map((row) => ({
      label: row?._id || "unknown",
      value: Number(row?.count || 0),
    }))
    .sort((a, b) => b.value - a.value);
}

function formatLabel(label) {
  return String(label || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function DistributionBlock({ title, rows }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <article className="card-surface">
      <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-xl">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No data available.</p>
        ) : null}
        {rows.map((row) => {
          const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text)]">{formatLabel(row.label)}</span>
                <span className="font-semibold text-[var(--text)]">
                  {row.value.toLocaleString("en-IN")} ({percent}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E8E3D6]">
                <div
                  className="h-2 rounded-full bg-[var(--accent)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function AdminAnalytics() {
  const [data, setData] = useState({
    generatedAt: "",
    bookingStatus: [],
    deliveryStatus: [],
    userRoles: [],
    profileStatus: [],
    bookingsTrend: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchAdminAnalytics();
        if (!isMounted) return;
        setData({
          generatedAt: response?.generatedAt || "",
          bookingStatus: response?.bookingStatus || [],
          deliveryStatus: response?.deliveryStatus || [],
          userRoles: response?.userRoles || [],
          profileStatus: response?.profileStatus || [],
          bookingsTrend: response?.bookingsTrend || [],
        });
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.message || "Failed to load analytics.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const bookingStatusRows = useMemo(
    () => toDistributionRows(data.bookingStatus),
    [data.bookingStatus],
  );
  const deliveryStatusRows = useMemo(
    () => toDistributionRows(data.deliveryStatus),
    [data.deliveryStatus],
  );
  const userRoleRows = useMemo(
    () => toDistributionRows(data.userRoles),
    [data.userRoles],
  );
  const profileStatusRows = useMemo(
    () => toDistributionRows(data.profileStatus),
    [data.profileStatus],
  );

  const maxTrendValue = useMemo(
    () =>
      Math.max(
        ...data.bookingsTrend.map((point) => Number(point?.bookings || 0)),
        1,
      ),
    [data.bookingsTrend],
  );

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
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-surface">
          <p className="label-uppercase-lg">Admin Workflow</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
            ShotSphere Analytics
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Live breakdown of booking, delivery, user, and profile trends.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Generated at: {formatDateTime(data.generatedAt)}
          </p>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading analytics...</p>
        ) : null}

        {!loading ? (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <DistributionBlock title="Booking Status" rows={bookingStatusRows} />
              <DistributionBlock title="Delivery Status" rows={deliveryStatusRows} />
              <DistributionBlock title="User Roles" rows={userRoleRows} />
              <DistributionBlock
                title="Photographer Verification Status"
                rows={profileStatusRows}
              />
            </section>

            <section className="card-surface">
              <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                Last 6 Months Booking Trend
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.bookingsTrend.map((point) => {
                  const value = Number(point?.bookings || 0);
                  const percentage = Math.round((value / maxTrendValue) * 100);
                  return (
                    <article key={point.month} className="card-white">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {point.month}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">
                        {value.toLocaleString("en-IN")}
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-[#E8E3D6]">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default AdminAnalytics;
