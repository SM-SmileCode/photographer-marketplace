import { useEffect, useState } from "react";
import { cancelAdminBooking, fetchAdminBookings } from "../services/adminService";

const STATUS_OPTIONS = [
  { value: "", label: "All Bookings" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusBadgeClass(status) {
  if (status === "accepted") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected" || status === "cancelled") {
    return "bg-red-50 text-red-700";
  }
  if (status === "completed") return "bg-sky-50 text-sky-700";
  if (status === "expired") return "bg-gray-100 text-gray-700";
  return "bg-amber-50 text-amber-700";
}

function AdminBookings() {
  const [statusFilter, setStatusFilter] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyBookingId, setBusyBookingId] = useState("");

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminBookings({
        page: 1,
        limit: 50,
        status: statusFilter,
      });
      setItems(data?.items || []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCancelBooking = async (bookingId) => {
    const reason =
      window.prompt("Cancellation reason (optional):", "Cancelled by admin.") || "";

    setBusyBookingId(bookingId);
    setError("");
    try {
      await cancelAdminBooking(bookingId, reason);
      await loadBookings();
    } catch (cancelError) {
      setError(cancelError?.message || "Failed to cancel booking.");
    } finally {
      setBusyBookingId("");
    }
  };

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label-uppercase-lg">Admin Workflow</p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                Booking Oversight
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Monitor booking states and cancel active bookings when required.
              </p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading bookings...</p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="card-surface text-sm text-[var(--muted)]">
              No bookings found for this filter.
            </p>
          ) : null}

          {!loading &&
            items.map((booking) => {
              const isBusy = busyBookingId === booking._id;
              const canCancel = ["pending", "accepted"].includes(booking?.status);
              return (
                <article key={booking._id} className="card-surface">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text)]">
                        {booking?.bookingCode || "Booking"}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {booking?.eventType || "-"} on {formatDate(booking?.eventDate)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Customer: {booking?.customerId?.name || "-"} | Photographer:{" "}
                        {booking?.photographerId?.businessName || "-"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Package: {booking?.packageId?.name || "Custom"} | Created:{" "}
                        {formatDate(booking?.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeClass(
                          booking?.status,
                        )}`}
                      >
                        {booking?.status || "pending"}
                      </span>
                      {canCancel ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleCancelBooking(booking._id)}
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF] disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {booking?.cancellationReason ? (
                    <p className="mt-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--text)]">
                      Cancellation reason: {booking.cancellationReason}
                    </p>
                  ) : null}
                </article>
              );
            })}
        </section>
      </div>
    </div>
  );
}

export default AdminBookings;
