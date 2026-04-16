import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { fetchMyBookings, fetchMyDeliveries } from "../services/bookingService";
import { pageThemeVars } from "../styles/themeVars";

function formatStatus(status = "") {
  return String(status)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatLocation(eventLocation = {}) {
  const parts = [eventLocation?.city, eventLocation?.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Location not provided";
}

function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function Dashboard() {
  const { user } = useOutletContext() || {};
  const displayName = user?.name || "there";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    upcoming: 0,
    pending: 0,
    deliveryInProgress: 0,
    completed: 0,
    totalSpent: 0,
    totalBookings: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);

  useEffect(() => {
    let alive = true;

    const getTotal = (result) => Number(result?.pagination?.total || 0);

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const [
          pendingBookings,
          acceptedBookings,
          completedBookingsResult,
          bookingsFeed,
          deliveriesFeed,
          eventDoneDeliveries,
          editingDeliveries,
          previewDeliveries,
          finalDeliveries,
          allBookings,
        ] = await Promise.all([
          fetchMyBookings({ status: "pending", page: 1, limit: 1 }),
          fetchMyBookings({ status: "accepted", page: 1, limit: 1 }),
          fetchMyBookings({ status: "completed", page: 1, limit: 5 }),
          fetchMyBookings({ page: 1, limit: 50 }),
          fetchMyDeliveries({ page: 1, limit: 50 }),
          fetchMyDeliveries({ status: "event_done", page: 1, limit: 1 }),
          fetchMyDeliveries({ status: "editing", page: 1, limit: 1 }),
          fetchMyDeliveries({ status: "preview_uploaded", page: 1, limit: 1 }),
          fetchMyDeliveries({ status: "final_delivered", page: 1, limit: 1 }),
          fetchMyBookings({ page: 1, limit: 50 }),
        ]);

        if (!alive) return;

        const allItems = Array.isArray(allBookings?.items) ? allBookings.items : [];
        const totalSpent = allItems.reduce((sum, b) => {
          if (b?.payment?.status === "paid") return sum + (b.payment?.amount || 0);
          return sum;
        }, 0);

        setSummary({
          upcoming: getTotal(acceptedBookings),
          pending: getTotal(pendingBookings),
          deliveryInProgress:
            getTotal(eventDoneDeliveries) +
            getTotal(editingDeliveries) +
            getTotal(previewDeliveries) +
            getTotal(finalDeliveries),
          completed: getTotal(completedBookingsResult),
          totalSpent,
          totalBookings: allItems.length,
        });

        const now = new Date();
        const feedBookings = Array.isArray(bookingsFeed?.items) ? bookingsFeed.items : [];
        const feedDeliveries = Array.isArray(deliveriesFeed?.items) ? deliveriesFeed.items : [];

        const upcoming = feedBookings
          .filter((b) => b?.status === "accepted")
          .filter((b) => {
            const end = new Date(b?.endAtUtc || b?.eventDate);
            return !Number.isNaN(end.getTime()) && end >= now;
          })
          .sort((a, b) => {
            const aTime = new Date(a?.startAtUtc || a?.eventDate || 0).getTime();
            const bTime = new Date(b?.startAtUtc || b?.eventDate || 0).getTime();
            return aTime - bTime;
          })
          .slice(0, 3)
          .map((b) => ({
            id: b?._id || b?.bookingCode,
            title: b?.eventType ? formatStatus(b.eventType) : "Shoot",
            photographer:
              b?.photographerId && typeof b.photographerId === "object"
                ? b.photographerId.businessName || "Photographer"
                : "Photographer",
            photographerId:
              b?.photographerId && typeof b.photographerId === "object"
                ? b.photographerId._id
                : null,
            date: formatShortDate(b?.eventDate),
            location: formatLocation(b?.eventLocation),
            status: formatStatus(b?.status || ""),
          }));
        setUpcomingBookings(upcoming);

        const completed = Array.isArray(completedBookingsResult?.items)
          ? completedBookingsResult.items.slice(0, 3).map((b) => ({
              id: b?._id,
              title: b?.eventType ? formatStatus(b.eventType) : "Shoot",
              photographerId:
                b?.photographerId && typeof b.photographerId === "object"
                  ? b.photographerId._id
                  : null,
              photographer:
                b?.photographerId && typeof b.photographerId === "object"
                  ? b.photographerId.businessName || "Photographer"
                  : "Photographer",
              date: formatShortDate(b?.eventDate),
            }))
          : [];
        setCompletedBookings(completed);

        const bookingActivity = feedBookings.map((b) => ({
          at: new Date(b?.updatedAt || b?.createdAt || 0).getTime(),
          message: `Booking ${b?.bookingCode || "N/A"} is ${formatStatus(b?.status || "")}.`,
        }));
        const deliveryActivity = feedDeliveries.map((d) => ({
          at: new Date(d?.updatedAt || d?.createdAt || 0).getTime(),
          message: `Delivery ${d?.bookingId?.bookingCode || d?._id || "N/A"} is ${formatStatus(d?.status || "")}.`,
        }));
        const activity = [...bookingActivity, ...deliveryActivity]
          .sort((a, b) => b.at - a.at)
          .slice(0, 3)
          .map((item) => item.message);
        setRecentActivity(activity.length ? activity : ["No recent activity yet."]);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadDashboard();
    return () => { alive = false; };
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        title: "Upcoming Bookings",
        value: String(summary.upcoming).padStart(2, "0"),
        hint: "Accepted bookings",
      },
      {
        title: "Pending Requests",
        value: String(summary.pending).padStart(2, "0"),
        hint: "Awaiting photographer response",
      },
      {
        title: "Delivery In Progress",
        value: String(summary.deliveryInProgress).padStart(2, "0"),
        hint: "Not yet customer confirmed",
      },
      {
        title: "Completed Shoots",
        value: String(summary.completed).padStart(2, "0"),
        hint: "Bookings marked completed",
      },
      {
        title: "Total Bookings",
        value: String(summary.totalBookings).padStart(2, "0"),
        hint: "All time bookings",
      },
      {
        title: "Total Spent",
        value: formatCurrency(summary.totalSpent),
        hint: "Paid via Razorpay",
      },
    ],
    [summary],
  );

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="card-hero sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">
                Customer Dashboard
              </p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl leading-tight sm:text-4xl">
                Welcome back, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
                Track bookings, monitor responses, and keep your upcoming shoots
                organized in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/customer/explore"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                Explore Photographers
              </Link>
              <Link
                to="/bookings"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F2EEDF]"
              >
                My Bookings
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <article key={card.title} className="card-surface">
              <p className="label-uppercase">{card.title}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.hint}</p>
            </article>
          ))}
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="grid gap-6 lg:grid-cols-5">
          <article className="card-surface lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                Upcoming Bookings
              </h2>
              <Link
                to="/bookings"
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                View all
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading...</p>
              ) : null}
              {!loading && !upcomingBookings.length ? (
                <p className="text-sm text-[var(--muted)]">
                  No upcoming accepted bookings.
                </p>
              ) : null}
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="card-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{booking.title}</h3>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {booking.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Photographer: {booking.photographer}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {booking.date} | {booking.location}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="card-surface lg:col-span-2">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Recent Activity
            </h2>
            <ul className="mt-4 space-y-3">
              {loading ? (
                <li className="card-white px-4 py-3 text-sm text-[var(--muted)]">
                  Loading...
                </li>
              ) : null}
              {recentActivity.map((activity) => (
                <li
                  key={activity}
                  className="card-white px-4 py-3 text-sm text-[var(--muted)]"
                >
                  {activity}
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] bg-[#FFFDF8] p-4">
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                Profile Health
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Keep contact details updated for faster booking confirmation.
              </p>
              <Link
                to="/profile"
                className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Go to profile
              </Link>
            </div>
          </article>
        </section>

        {completedBookings.length > 0 ? (
          <section className="card-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                Book Again
              </h2>
              <Link
                to="/bookings"
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                View all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {completedBookings.map((b) => (
                <div key={b.id} className="card-white flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{b.title}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {b.photographer} · {b.date}
                    </p>
                  </div>
                  {b.photographerId ? (
                    <Link
                      to={`/bookings?photographerId=${b.photographerId}`}
                      className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                    >
                      Re-book
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default Dashboard;
