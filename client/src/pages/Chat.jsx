import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { fetchMyBookings, fetchPhotographerBooking } from "../services/bookingService";
import BookingChat from "../_components/BookingChat";
import { pageThemeVars } from "../styles/themeVars";

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Chat() {
  const { user } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedBookingId = searchParams.get("bookingId") || "";

  const isPhotographer = user?.role === "photographer";

  useEffect(() => {
    (async () => {
      try {
        const fetcher = isPhotographer ? fetchPhotographerBooking : fetchMyBookings;
        const data = await fetcher({ page: 1, limit: 50 });
        const items = (data?.items || []).filter((b) =>
          ["accepted", "completed"].includes(b.status)
        );
        setBookings(items);
        if (items.length > 0) {
          const selectedExists = items.some((b) => b._id === selectedBookingId);
          if (!selectedExists) {
            setSearchParams({ bookingId: items[0]._id }, { replace: true });
          }
        } else if (selectedBookingId) {
          setSearchParams({}, { replace: true });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [isPhotographer, selectedBookingId, setSearchParams]);

  const selectedBooking = bookings.find((b) => b._id === selectedBookingId) || null;

  const getOtherParty = (booking) => {
    if (isPhotographer) {
      const c = booking.customerId;
      return typeof c === "object" ? c.name || "Customer" : "Customer";
    }
    const p = booking.photographerId;
    return typeof p === "object" ? p.businessName || "Photographer" : "Photographer";
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl text-[var(--text)]">
          Messages
        </h1>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading conversations...</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No active bookings to chat about yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="space-y-2">
              {bookings.map((booking) => (
                <button
                  key={booking._id}
                  type="button"
                  onClick={() => setSearchParams({ bookingId: booking._id })}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    booking._id === selectedBookingId
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--line)] bg-white hover:bg-[#F5F2EA]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--text)] capitalize">
                    {getOtherParty(booking)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)] capitalize">
                    {booking.eventType} · {formatDate(booking.eventDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {booking.bookingCode}
                  </p>
                </button>
              ))}
            </aside>

            <div>
              {selectedBooking ? (
                <BookingChat
                  bookingId={selectedBooking._id}
                  currentUserId={user?.userId}
                />
              ) : (
                <div className="flex h-[480px] items-center justify-center rounded-2xl border border-[var(--line)] bg-white">
                  <p className="text-sm text-[var(--muted)]">Select a conversation</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
