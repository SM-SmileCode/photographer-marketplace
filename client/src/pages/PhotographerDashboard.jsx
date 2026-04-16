import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  fetchPhotographerBooking,
  fetchPhotographerDeliveries,
} from "../services/bookingService";
import { pageThemeVars } from "../styles/themeVars";
import { formatDate, formatTime } from "../utils/bookingFormatters";

function formatStatus(status = "") {
  return String(status)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLocation(eventLocation = {}) {
  const parts = [eventLocation?.city, eventLocation?.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "Location not provided";
}

function PhotographerDashboard() {
  const { user } = useOutletContext() || {};
  const displayName = user?.name || "Photographer";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    newRequests: 0,
    todayShoots: 0,
    pendingDeliveries: 0,
    completedShoots: 0,
  });
  const [bookingRequests, setBookingRequests] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [deliveryQueue, setDeliveryQueue] = useState([]);
  const [deliverySnapshot, setDeliverySnapshot] = useState({
    finalDelivered: 0,
    confirmed: 0,
  });

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const [
          pendingRequestsResult,
          acceptedBookingsResult,
          completedBookingsResult,
          deliveriesResult,
        ] = await Promise.all([
          fetchPhotographerBooking({ status: "pending", page: 1, limit: 20 }),
          fetchPhotographerBooking({ status: "accepted", page: 1, limit: 50 }),
          fetchPhotographerBooking({ status: "completed", page: 1, limit: 1 }),
          fetchPhotographerDeliveries(),
        ]);

        if (!alive) return;

        const pendingRequests = Array.isArray(pendingRequestsResult?.items)
          ? pendingRequestsResult.items
          : [];
        const acceptedBookings = Array.isArray(acceptedBookingsResult?.items)
          ? acceptedBookingsResult.items
          : [];
        const deliveries = Array.isArray(deliveriesResult?.items)
          ? deliveriesResult.items
          : [];
        const now = new Date();

        const todaysAcceptedShoots = acceptedBookings
          .filter((booking) => {
            const eventDate = new Date(booking?.eventDate);
            return !Number.isNaN(eventDate.getTime()) && isSameCalendarDay(eventDate, now);
          })
          .sort((a, b) => {
            const aStart = new Date(a?.startAtUtc || a?.eventDate || 0).getTime();
            const bStart = new Date(b?.startAtUtc || b?.eventDate || 0).getTime();
            return aStart - bStart;
          });

        const activeDeliveryStatuses = [
          "event_done",
          "editing",
          "preview_uploaded",
          "final_delivered",
        ];
        const pendingDeliveryItems = deliveries.filter((delivery) =>
          activeDeliveryStatuses.includes(delivery?.status),
        );

        setSummary({
          newRequests: Number(pendingRequestsResult?.pagination?.total || 0),
          todayShoots: todaysAcceptedShoots.length,
          pendingDeliveries: pendingDeliveryItems.length,
          completedShoots: Number(completedBookingsResult?.pagination?.total || 0),
        });

        setBookingRequests(
          pendingRequests.slice(0, 3).map((request) => {
            const customer =
              request?.customerId && typeof request.customerId === "object"
                ? request.customerId
                : null;
            return {
              id:
                request?._id ||
                request?.bookingCode ||
                `${request?.eventType || "event"}-${request?.eventDate || "date"}`,
              client: customer?.name || "Customer",
              project: request?.eventType ? formatStatus(request.eventType) : "Shoot",
              date: formatDate(request?.eventDate),
              location: formatLocation(request?.eventLocation),
            };
          }),
        );

        setTodaySchedule(
          todaysAcceptedShoots.slice(0, 3).map((booking) => ({
            id:
              booking?._id ||
              booking?.bookingCode ||
              `${booking?.eventType || "event"}-${booking?.startAtUtc || booking?.eventDate || "time"}`,
            time:
              booking?.startTime && booking?.endTime
                ? `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
                : "Time not available",
            item: `${booking?.eventType ? formatStatus(booking.eventType) : "Shoot"} (${booking?.bookingCode || "N/A"})`,
          })),
        );

        setDeliveryQueue(
          pendingDeliveryItems
            .sort((a, b) => {
              const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
              const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
              return bTime - aTime;
            })
            .slice(0, 3)
            .map((delivery) => ({
              id:
                delivery?._id ||
                `${delivery?.bookingId?.bookingCode || "delivery"}-${delivery?.status || "status"}`,
              label: `${delivery?.bookingId?.bookingCode || "N/A"} - ${formatStatus(
                delivery?.status || "",
              )}`,
            })),
        );

        setDeliverySnapshot({
          finalDelivered: deliveries.filter((d) => d?.status === "final_delivered").length,
          confirmed: deliveries.filter((d) => d?.status === "customer_confirmed").length,
        });
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load photographer dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      alive = false;
    };
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        title: "New Requests",
        value: String(summary.newRequests).padStart(2, "0"),
        hint: "Pending booking requests",
      },
      {
        title: "Today's Shoots",
        value: String(summary.todayShoots).padStart(2, "0"),
        hint: "Accepted bookings today",
      },
      {
        title: "Pending Deliveries",
        value: String(summary.pendingDeliveries).padStart(2, "0"),
        hint: "Waiting for customer confirmation",
      },
      {
        title: "Completed Shoots",
        value: String(summary.completedShoots).padStart(2, "0"),
        hint: "Bookings marked completed",
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
              <p className="label-uppercase-lg">Photographer Dashboard</p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl leading-tight sm:text-4xl">
                Welcome back, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted)] sm:text-base">
                Manage booking requests, schedule shoots, and track delivery
                progress from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/photographer/booking-requests"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                View Requests
              </Link>
              <Link
                to="/photographer/availability"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[#F2EEDF]"
              >
                Update Availability
              </Link>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.title} className="card-surface">
              <p className="label-uppercase">{card.title}</p>
              <p className="mt-3 text-3xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.hint}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <article className="card-surface lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
                Booking Requests
              </h2>
              <Link
                to="/photographer/booking-requests"
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                Manage all
              </Link>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading...</p>
              ) : null}
              {!loading && !bookingRequests.length ? (
                <p className="text-sm text-[var(--muted)]">
                  No pending booking requests.
                </p>
              ) : null}
              {bookingRequests.map((request) => (
                <div key={request.id} className="card-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{request.project}</h3>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Client: {request.client}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {request.date} | {request.location}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="card-surface lg:col-span-2">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Today's Schedule
            </h2>
            <ul className="mt-4 space-y-3">
              {loading ? (
                <li className="card-white">
                  <p className="text-sm text-[var(--muted)]">Loading...</p>
                </li>
              ) : null}
              {!loading && !todaySchedule.length ? (
                <li className="card-white">
                  <p className="text-sm text-[var(--muted)]">
                    No accepted shoots scheduled for today.
                  </p>
                </li>
              ) : null}
              {todaySchedule.map((slot) => (
                <li key={slot.id} className="card-white">
                  <p className="text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                    {slot.time}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">{slot.item}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] bg-[#FFFDF8] p-4">
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--muted)] uppercase">
                Quick Access
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  to="/photographer/packages"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Packages
                </Link>
                <Link
                  to="/photographer/availability"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Calendar
                </Link>
                <Link
                  to="/photographer/delivery-tracking"
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]"
                >
                  Deliveries
                </Link>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="card-surface">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Delivery Queue
            </h2>
            <ul className="mt-4 space-y-3">
              {loading ? (
                <li className="card-white text-sm text-[var(--muted)]">Loading...</li>
              ) : null}
              {!loading && !deliveryQueue.length ? (
                <li className="card-white text-sm text-[var(--muted)]">
                  No pending deliveries right now.
                </li>
              ) : null}
              {deliveryQueue.map((item) => (
                <li key={item.id} className="card-white text-sm text-[var(--muted)]">
                  {item.label}
                </li>
              ))}
            </ul>
          </article>

          <article className="card-surface">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Delivery Snapshot
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="card-white">
                <p className="label-uppercase">Final Delivered</p>
                <p className="mt-2 text-2xl font-semibold">
                  {String(deliverySnapshot.finalDelivered).padStart(2, "0")}
                </p>
              </div>
              <div className="card-white">
                <p className="label-uppercase">Customer Confirmed</p>
                <p className="mt-2 text-2xl font-semibold">
                  {String(deliverySnapshot.confirmed).padStart(2, "0")}
                </p>
              </div>
            </div>
            <Link
              to="/photographer/delivery-tracking"
              className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Open delivery tracking
            </Link>
          </article>
        </section>
      </div>
    </div>
  );
}

export default PhotographerDashboard;
