import { useReducer } from "react";
import {
  fetchPhotographerBooking,
  markBookingCompleted,
  respondToBooking,
} from "../services/bookingService";
import { formatDate, formatTime } from "../utils/bookingFormatters";
import { getBookingStatusBadgeClass } from "../utils/bookingStatus";
import { pageThemeVars } from "../styles/themeVars";
import { useListData } from "../hooks/useListData";
import { useBookingsTranslation } from "../i18n/useBookingsTranslation";

const initialState = {
  status: "pending",
  actingId: "",
  error: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "ACTION_START":
      return { ...state, actingId: action.payload, error: "" };
    case "ACTION_END":
      return { ...state, actingId: "" };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

function PhotographerBookingRequests() {
  const { t } = useBookingsTranslation();
  const [state, dispatch] = useReducer(reducer, initialState);

  const formatUtcDateTime = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return t("photographerRequests.completeDateUnavailable");
    }
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const {
    items,
    loading,
    error: listError,
    reload,
  } = useListData(
    (params) =>
      fetchPhotographerBooking({
        status: state.status,
        page: 1,
        limit: 20,
        ...params,
      }),
    [state.status],
  );

  const handleAction = async (bookingId, action) => {
    {
      /* === PhotographerBookingRequests.jsx - Prompts for accept/reject === */
    }
    const note =
      window.prompt(
        action === "accept"
          ? t("photographerRequests.addConfirmationNote")
          : t("photographerRequests.addRejectionReason"),
        "",
      ) ?? "";

    dispatch({ type: "ACTION_START", payload: bookingId });

    try {
      await respondToBooking(bookingId, { action, note });
      await reload();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("photographerRequests.failedUpdateRequest"),
      });
    } finally {
      dispatch({ type: "ACTION_END" });
    }
  };

  const handleComplete = async (bookingId) => {
    if (!window.confirm(t("photographerRequests.confirmMessage"))) return;

    dispatch({
      type: "ACTION_START",
      payload: bookingId,
    });

    try {
      await markBookingCompleted(bookingId);
      await reload();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("photographerRequests.failedMessage"),
      });
    } finally {
      dispatch({
        type: "ACTION_END",
      });
    }
  };

  const activeTab = state.status === "pending" ? "pending" : "history";

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-surface">
        {/* === PhotographerBookingRequests.jsx - Section title === */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-[var(--text)]">
            {t("photographerRequests.bookingRequests")}
          </h1>

          {/* === PhotographerBookingRequests.jsx - Tab buttons === */}
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white p-2">
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "SET_STATUS", payload: "pending" })
              }
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === "pending"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text)] hover:bg-[#f4f1ea]"
              }`}
            >
              {t("photographerRequests.pendingTab")}
            </button>

            <button
              type="button"
              onClick={() => dispatch({ type: "SET_STATUS", payload: "" })}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === "history"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text)] hover:bg-[#f4f1ea]"
              }`}
            >
              {t("photographerRequests.historyTab")}
            </button>
          </div>
        </div>

        {state.error ? (
          <p className="mb-3 text-sm text-red-600">{state.error}</p>
        ) : null}
        {listError ? (
          <p className="mb-3 text-sm text-red-600">{listError}</p>
        ) : null}

        {/* === PhotographerBookingRequests.jsx - Loading state === */}
        {loading ? (
          <p className="text-sm text-[var(--muted)]">
            {t("photographerRequests.loadingRequests")}
          </p>
        ) : null}

        {/* === PhotographerBookingRequests.jsx - Empty states === */}
        {!loading && !items.length ? (
          <p className="text-sm text-[var(--muted)]">
            {activeTab === "pending"
              ? t("photographerRequests.noPendingRequests")
              : t("photographerRequests.noBookingHistory")}
          </p>
        ) : null}

        <div className="space-y-3">
          {items.map((booking) => {
            const isPending = booking.status === "pending";
            const isActing = state.actingId === booking._id;
            const statusLabel = t(`bookings.${booking.status}`);
            const customer =
              booking.customerId && typeof booking.customerId === "object"
                ? booking.customerId
                : null;
            const endAt = booking?.endAtUtc ? new Date(booking.endAtUtc) : null;
            const hasValidEndAt = endAt && !Number.isNaN(endAt.getTime());
            const canCompleteNow = hasValidEndAt ? endAt <= new Date() : false;
            const disableComplete = isActing || !canCompleteNow;
            const location = [
              booking.eventLocation?.address,
              booking.eventLocation?.city,
              booking.eventLocation?.state,
              booking.eventLocation?.pincode,
            ].filter(Boolean);

            return (
              <article key={booking._id} className="card-white">
                <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">
                  {booking.bookingCode}
                </p>

                {/* BOOKING DETAILS */}
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
                    Booking Details
                  </p>
                  <div className="space-y-1 text-sm text-[var(--text)]">
                    <p className="capitalize">
                      <span className="font-semibold">
                        {t("labels.eventType")} :
                      </span>{" "}
                      {booking.eventType}
                    </p>
                    <p className="capitalize">
                      <span className="font-semibold">
                        {t("labels.eventDate")} :
                      </span>{" "}
                      {formatDate(booking.eventDate)}
                    </p>
                    <p className="capitalize">
                      <span className="font-semibold">Scheduled For :</span>{" "}
                      {formatTime(booking.startTime)} -{" "}
                      {formatTime(booking.endTime)}
                    </p>
                  </div>
                </div>

                {/* CUSTOMER */}
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-[var(--text)]">
                    Customer
                  </p>
                  <div className="space-y-1 text-sm text-[var(--text)]">
                    <p className="capitalize">
                      <span className="font-semibold">
                        {t("labels.customer")} :
                      </span>{" "}
                      {customer?.name ||
                        t("photographerRequests.customerUnavailable")}
                    </p>

                    {customer?.email ? (
                      <p className="text-[var(--muted)]">
                        <span className="font-semibold text-[var(--text)]">
                          {t("labels.email")}:
                        </span>{" "}
                        {customer.email}
                      </p>
                    ) : null}

                    {customer?.phone ? (
                      <p className="text-[var(--muted)]">
                        <span className="font-semibold text-[var(--text)]">
                          {t("labels.phone")}:
                        </span>{" "}
                        {customer.phone}
                      </p>
                    ) : null}

                    <p className="text-[var(--muted)]">
                      <span className="font-semibold text-[var(--text)]">
                        {t("labels.location")}:
                      </span>{" "}
                      {location.join(", ") ||
                        t("photographerRequests.locationUnavailable")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getBookingStatusBadgeClass(
                      booking.status,
                    )}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* === PhotographerBookingRequests.jsx - Customer note display === */}
                {booking.customerNote ? (
                  <p className="mt-3 rounded-lg bg-[#f8f6ef] px-3 py-2 text-sm text-[var(--text)]">
                    {t("photographerRequests.noteLabel")} {booking.customerNote}
                  </p>
                ) : null}

                {/* === PhotographerBookingRequests.jsx - Accept/Reject buttons === */}
                {isPending ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleAction(booking._id, "accept")}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isActing ? t("buttons.updating") : t("buttons.accept")}
                    </button>

                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleAction(booking._id, "reject")}
                      className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isActing ? t("buttons.updating") : t("buttons.reject")}
                    </button>
                  </div>
                ) : null}
                {booking.status === "accepted" ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={disableComplete}
                      onClick={() => handleComplete(booking._id)}
                      className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isActing ? t("buttons.updating") : t("buttons.complete")}
                    </button>
                    {!canCompleteNow ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {t("photographerRequests.completeAvailableAfter")}{" "}
                        {formatUtcDateTime(booking?.endAtUtc)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        </section>
      </div>
    </div>
  );
}

export default PhotographerBookingRequests;
