import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminReports } from "../services/adminService";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminReports() {
  const [summary, setSummary] = useState({
    flaggedReviews: 0,
    hiddenReviews: 0,
    stalePendingBookings: 0,
    blockedUsers: 0,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAdminReports();
        if (!isMounted) return;
        setSummary(
          data?.summary || {
            flaggedReviews: 0,
            hiddenReviews: 0,
            stalePendingBookings: 0,
            blockedUsers: 0,
          },
        );
        setItems(data?.items || []);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.message || "Failed to load reports.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const cards = [
    { label: "Flagged Reviews", value: summary.flaggedReviews },
    { label: "Hidden Reviews", value: summary.hiddenReviews },
    { label: "Stale Pending Bookings", value: summary.stalePendingBookings },
    { label: "Blocked Users", value: summary.blockedUsers },
  ];

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
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="label-uppercase-lg">Admin Workflow</p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                Compliance & Risk Reports
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Track moderation risks and stale operational items.
              </p>
            </div>
            <Link
              to="/admin/reviews"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Open Review Moderation
            </Link>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="card-surface">
              <p className="label-uppercase">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold">
                {loading ? "..." : Number(card.value || 0).toLocaleString("en-IN")}
              </p>
            </article>
          ))}
        </section>

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Top Flagged Reviews
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading reports...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No flagged review records available.
            </p>
          ) : null}

          {!loading ? (
            <div className="mt-4 space-y-3">
              {items.map((review) => (
                <article key={review._id} className="card-white">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {review?.photographerId?.businessName || "Photographer"} |{" "}
                    {review?.bookingId?.bookingCode || "No booking code"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Customer: {review?.customerId?.name || "Customer"} | Reports:{" "}
                    {review?.reportCount || 0} | Rating: {review?.rating || 0}/5
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {review?.comment || "Rated without a written review."}
                  </p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Created: {formatDate(review?.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default AdminReports;
