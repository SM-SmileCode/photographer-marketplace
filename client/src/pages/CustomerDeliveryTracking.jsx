import { useState } from "react";
import { useListData } from "../hooks/useListData";
import {
  fetchMyDeliveries,
  confirmMyDelivery,
  updateMyDeliveryFeedback,
} from "../services/bookingService";
import { submitMyDeliveryReview } from "../services/reviewService";
import { pageThemeVars } from "../styles/themeVars";
import { formatDate, formatTime } from "../utils/bookingFormatters";
import { useDeliveryTranslation } from "../i18n/useDeliveryTranslation";

function CustomerDeliveryTracking() {
  const { items, loading, error, reload } = useListData(
    () => fetchMyDeliveries(),
    [],
  );
  const [savingId, setSavingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const { t } = useDeliveryTranslation();

  const deliveries = Array.isArray(items)
    ? items.filter((item) => item && typeof item === "object")
    : [];

  function setDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
        _feedbackJustSaved: false,
        _confirmJustSaved: false,
      },
    }));
  }

  function clearDraftFields(id, keys) {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;

      const nextDraft = { ...current };
      keys.forEach((key) => {
        delete nextDraft[key];
      });

      const next = { ...prev };
      if (Object.keys(nextDraft).length === 0) {
        delete next[id];
      } else {
        next[id] = nextDraft;
      }

      return next;
    });
  }

  function formatStatus(status = "") {
    return String(status)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getFilterKey(status = "") {
    if (["event_done", "editing", "preview_uploaded"].includes(status)) {
      return "inProgress";
    }
    if (status === "final_delivered") {
      return "awaitingYou";
    }
    if (status === "customer_confirmed") {
      return "completed";
    }
    return "all";
  }

  function formatHistoryDateTime(value) {
    if (!value) return t("message.noDateTime");
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return t("message.noDateTime");
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function getExpectedDeliveryDate(delivery, booking) {
    const fromApi = delivery?.expectedDeliveryDate
      ? new Date(delivery.expectedDeliveryDate)
      : null;
    if (fromApi && !Number.isNaN(fromApi.getTime())) {
      return fromApi;
    }

    const eventDate = booking?.eventDate;
    const packageInfo =
      booking?.packageId && typeof booking.packageId === "object"
        ? booking.packageId
        : null;
    const deliveryDays = Number(packageInfo?.deliveryDays);
    if (!eventDate || !Number.isFinite(deliveryDays) || deliveryDays <= 0) {
      return null;
    }
    const base = new Date(eventDate);
    if (Number.isNaN(base.getTime())) return null;
    base.setDate(base.getDate() + deliveryDays);
    return base;
  }

  const filterOptions = [
    { key: "all", label: t("filters.all") },
    { key: "inProgress", label: t("filters.inProgress") },
    { key: "awaitingYou", label: t("filters.awaitingYou") },
    { key: "completed", label: t("filters.completed") },
  ];

  const filterCounts = deliveries.reduce(
    (acc, d) => {
      const k = getFilterKey(d?.status || "");
      acc.all += 1;
      if (acc[k] !== undefined) acc[k] += 1;
      return acc;
    },
    { all: 0, inProgress: 0, awaitingYou: 0, completed: 0 },
  );

  const filteredDeliveries =
    statusFilter === "all"
      ? deliveries
      : deliveries.filter(
          (d) => getFilterKey(d?.status || "") === statusFilter,
        );

  async function handleConfirm(deliveryId) {
    const draft = drafts[deliveryId] || {};
    setSavingId(deliveryId);
    setActionError("");
    try {
      await confirmMyDelivery(deliveryId, draft.confirmNote || "");
      await reload();
      setDrafts((prev) => ({
        ...prev,
        [deliveryId]: {
          ...(prev[deliveryId] || {}),
          confirmNote: "",
          _confirmJustSaved: true,
        },
      }));
    } catch (e) {
      setActionError(e?.message || t("message.confirmFailed"));
    } finally {
      setSavingId("");
    }
  }

  async function handleFeedback(deliveryId) {
    const draft = drafts[deliveryId] || {};
    const feedback = (draft.customerFeedback || "").trim();

    if (!feedback) {
      setActionError(t("message.feedbackRequired"));
      return;
    }

    setSavingId(deliveryId);
    setActionError("");
    try {
      await updateMyDeliveryFeedback(deliveryId, feedback);
      await reload();
      setDrafts((prev) => ({
        ...prev,
        [deliveryId]: {
          ...(prev[deliveryId] || {}),
          customerFeedback: "",
          _feedbackJustSaved: true,
        },
      }));
    } catch (e) {
      setActionError(e?.message || t("message.feedbackFailed"));
    } finally {
      setSavingId("");
    }
  }

  async function handleReview(deliveryId) {
    const draft = drafts[deliveryId] || {};
    const rating = Number(draft.reviewRating ?? 0);
    const comment = draft.reviewComment ?? "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setActionError(t("message.reviewRatingRequired"));
      return;
    }

    setSavingId(deliveryId);
    setActionError("");

    try {
      await submitMyDeliveryReview(deliveryId, { rating, comment });
      await reload();
      clearDraftFields(deliveryId, ["reviewRating", "reviewComment"]);
    } catch (e) {
      setActionError(e?.message || t("message.reviewFailed"));
    } finally {
      setSavingId("");
    }
  }

  function renderStars(rating = 0) {
    return Array.from({ length: 5 }, (_, index) =>
      index < rating ? "\u2605" : "\u2606",
    ).join("");
  }
  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-surface">
        <h1 className="text-xl font-semibold text-[var(--text)]">
          {t("title.deliveryTracking")}
        </h1>

        {loading ? <p>{t("message.loading")}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {actionError ? (
          <p className="mt-4 text-sm text-red-600">{actionError}</p>
        ) : null}

        {!loading && !error && deliveries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            {t("message.noDelivery")}
          </p>
        ) : null}

        {!loading &&
        !error &&
        deliveries.length > 0 &&
        filteredDeliveries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            {t("message.noDeliveryForFilter")}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {t("labels.status")}:
          </span>
          {filterOptions.map((option) => {
            const active = statusFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-[#1f2937] text-white"
                    : "bg-[#f4f1ea] text-[var(--text)] hover:bg-[#e9e3d7]"
                }`}
              >
                {option.label} ({filterCounts[option.key] || 0})
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {filteredDeliveries.map((delivery) => {
            const booking =
              delivery.bookingId && typeof delivery.bookingId === "object"
                ? delivery.bookingId
                : null;
            const photographer =
              delivery.photographerId &&
              typeof delivery.photographerId === "object"
                ? delivery.photographerId
                : null;

            const draft = drafts[delivery._id] || {};
            const isSaving = savingId === delivery._id;
            const canConfirm = delivery.status === "final_delivered";
            const canFeedback = [
              "final_delivered",
              "customer_confirmed",
            ].includes(delivery.status);
            const canReview = delivery.status === "customer_confirmed";
            const expectedDeliveryDate = getExpectedDeliveryDate(
              delivery,
              booking,
            );
            const review =
              delivery.review && typeof delivery.review === "object"
                ? delivery.review
                : null;
            const reviewRating = Number(draft.reviewRating ?? review?.rating ?? 0);
            const reviewComment = draft.reviewComment ?? review?.comment ?? "";

            const history = Array.isArray(delivery.statusHistory)
              ? [...delivery.statusHistory].sort(
                  (a, b) =>
                    new Date(b?.changedAt || 0).getTime() -
                    new Date(a?.changedAt || 0).getTime(),
                )
              : [];

            return (
              <article key={delivery._id} className="card-white space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">
                    {booking?.bookingCode || t("message.delivery")}
                  </p>
                  <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)]">
                    {formatStatus(delivery.status)}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-[var(--text)]">
                  <p>
                    <span className="font-semibold">
                      {booking?.eventType || t("message.noEvent")}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">{t("labels.date")}:</span>{" "}
                    {booking?.eventDate
                      ? formatDate(booking.eventDate)
                      : t("message.noEvent")}
                  </p>
                  <p>
                    <span className="font-semibold">{t("labels.time")}:</span>{" "}
                    {booking?.startTime && booking?.endTime
                      ? `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
                      : t("message.noStartOrEndTime")}
                  </p>
                  <p>
                    <span className="font-semibold">
                      {t("labels.expectedDeliveryDate")}:
                    </span>{" "}
                    {expectedDeliveryDate
                      ? formatDate(expectedDeliveryDate)
                      : t("message.noExpectedDeliveryDate")}
                  </p>
                  <p>
                    <span className="font-semibold">
                      {t("labels.photographer")}:
                    </span>{" "}
                    {photographer?.businessName || t("message.noPhotographer")}
                  </p>
                  {delivery.deliveryLink ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.deliveryLink")}:
                      </span>
                      <a
                        href={delivery.deliveryLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {t("actions.open")}
                      </a>
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <p className="font-semibold">{t("labels.previewFiles")}:</p>
                    {Array.isArray(delivery.previewFiles) &&
                    delivery.previewFiles.length > 0 ? (
                      <ul className="space-y-1">
                        {delivery.previewFiles.map((file, idx) => (
                          <li key={`${delivery._id}-preview-${idx}`}>
                            <a
                              href={file?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              {t("actions.open")}{" "}
                              {file?.type ? `(${file.type})` : ""}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        {t("message.noFiles")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">{t("labels.finalFiles")}:</p>
                    {Array.isArray(delivery.finalFiles) &&
                    delivery.finalFiles.length > 0 ? (
                      <ul className="space-y-1">
                        {delivery.finalFiles.map((file, idx) => (
                          <li key={`${delivery._id}-final-${idx}`}>
                            <a
                              href={file?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              {t("actions.open")}{" "}
                              {file?.type ? `(${file.type})` : ""}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        {t("message.noFiles")}
                      </p>
                    )}
                  </div>
                  {delivery.photographerNote ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.photographerNote")}:
                      </span>
                      {delivery.photographerNote}
                    </p>
                  ) : null}
                  {delivery.customerFeedback ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.yourFeedback")}:
                      </span>{" "}
                      {delivery.customerFeedback}
                    </p>
                  ) : null}
                  {review ? (
                    <p>
                      <span className="font-semibold">{t("labels.yourReview")}:</span>{" "}
                      {renderStars(review.rating)}
                      {review.comment ? ` - ${review.comment}` : ""}
                    </p>
                  ) : null}
                </div>

                {history.length ? (
                  <div className="space-y-2 border-t border-[#e8e2d6] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {t("labels.deliveryHistory")}
                    </p>
                    <div className="space-y-1 text-xs text-[var(--text)]">
                      {history.map((h, idx) => (
                        <p key={`${delivery._id}-h-${idx}`}>
                          {formatHistoryDateTime(h?.changedAt)}:{" "}
                          {h?.fromStatus
                            ? formatStatus(h.fromStatus)
                            : t("message.startStatus")}{" "}
                          {"->"} {formatStatus(h?.toStatus || "")}
                          {h?.note ? ` (${h.note})` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!history.length ? (
                  <p className="text-xs text-[var(--muted)]">
                    {t("message.noHistoryYet")}
                  </p>
                ) : null}

                <div className="space-y-2 border-t border-[#e8e2d6] pt-3">
                  {canConfirm ? (
                    <>
                      <textarea
                        rows={2}
                        className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                        placeholder={t("placeholders.confirmNote")}
                        value={
                          draft._confirmJustSaved
                            ? ""
                            : draft.confirmNote ?? ""
                        }
                        onChange={(e) =>
                          setDraft(delivery._id, {
                            confirmNote: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="rounded-md bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() => handleConfirm(delivery._id)}
                      >
                        {isSaving
                          ? t("actions.saving")
                          : t("actions.confirmDelivery")}
                      </button>
                    </>
                  ) : null}

                  {canFeedback ? (
                    <>
                      <textarea
                        rows={3}
                        className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                        placeholder={t("placeholders.feedback")}
                        value={
                          draft._feedbackJustSaved
                            ? ""
                            : draft.customerFeedback ?? ""
                        }
                        onChange={(e) =>
                          setDraft(delivery._id, {
                            customerFeedback: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="rounded-md bg-[#1f2937] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() => handleFeedback(delivery._id)}
                      >
                        {isSaving
                          ? t("actions.saving")
                          : t("actions.saveFeedback")}
                      </button>
                    </>
                  ) : null}

                  {canReview ? (
                    <>
                      <div className="space-y-2 rounded-lg border border-[#e8e2d6] bg-[#fcfaf4] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {review ? t("actions.updateReview") : t("actions.submitReview")}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {Array.from({ length: 5 }, (_, index) => {
                            const starValue = index + 1;
                            const isActive = starValue <= reviewRating;
                            return (
                              <button
                                key={`${delivery._id}-review-${starValue}`}
                                type="button"
                                onClick={() =>
                                  setDraft(delivery._id, {
                                    reviewRating: starValue,
                                  })
                                }
                                className={`text-2xl leading-none transition ${
                                  isActive
                                    ? "text-amber-500"
                                    : "text-[#cbbfa6] hover:text-amber-400"
                                }`}
                                aria-label={`Rate ${starValue} star${starValue === 1 ? "" : "s"}`}
                              >
                                {isActive ? "\u2605" : "\u2606"}
                              </button>
                            );
                          })}
                          <span className="text-sm text-[var(--muted)]">
                            {reviewRating ? `${reviewRating}/5` : t("message.reviewRatingRequired")}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                          placeholder={t("placeholders.review")}
                          value={reviewComment}
                          onChange={(e) =>
                            setDraft(delivery._id, {
                              reviewComment: e.target.value,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="rounded-md bg-[#7c5a1f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => handleReview(delivery._id)}
                        >
                          {isSaving
                            ? t("actions.saving")
                            : review
                              ? t("actions.updateReview")
                              : t("actions.submitReview")}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        </section>
      </div>
    </div>
  );
}

export default CustomerDeliveryTracking;
