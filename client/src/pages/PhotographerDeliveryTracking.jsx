import { useCallback, useState } from "react";
import { useListData } from "../hooks/useListData";
import { pageThemeVars } from "../styles/themeVars";
import { formatDate, formatTime } from "../utils/bookingFormatters";
import { useDeliveryTranslation } from "../i18n/useDeliveryTranslation";
import {
  fetchPhotographerDeliveries,
  updatePhotographerDeliveryFields,
  updatePhotographerDeliveryStatus,
} from "../services/bookingService";
import { PlusIcon } from "lucide-react";
import { uploadPhotographerImage } from "../services/photographerProfileService";

function PhotographerDeliveryTracking() {
  const { items, loading, error, reload } = useListData(
    () => fetchPhotographerDeliveries(),
    [],
  );
  const [savingId, setSavingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [drafts, setDrafts] = useState({});
  const [dragTarget, setDragTarget] = useState("");

  const { t } = useDeliveryTranslation();

  function formatDeliveryStatus(status = "") {
    return String(status)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatDeliveryMethod(method = "") {
    if (method === "in_app") return "In App";

    return String(method)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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

  function setDraft(id, patch) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }

  function clearDraft(deliveryId) {
    setDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, deliveryId)) {
        return prev;
      }

      const next = { ...prev };
      delete next[deliveryId];
      return next;
    });
  }

  function parseFiles(text = "") {
    return String(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [url, type = "image"] = line.split("|").map((v) => v.trim());
        return { url, type };
      });
  }

  function buildDeliveryPayload(draft = {}) {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(draft, "deliveryLink")) {
      payload.deliveryLink = draft.deliveryLink;
    }
    if (Object.prototype.hasOwnProperty.call(draft, "photographerNote")) {
      payload.photographerNote = draft.photographerNote;
    }
    if (Object.prototype.hasOwnProperty.call(draft, "previewFilesText")) {
      payload.previewFiles = parseFiles(draft.previewFilesText || "");
    }
    if (Object.prototype.hasOwnProperty.call(draft, "finalFilesText")) {
      payload.finalFiles = parseFiles(draft.finalFilesText || "");
    }

    return payload;
  }

  async function persistDraftChanges(
    deliveryId,
    { reloadAfterSave = true, clearDraftAfterSave = true } = {},
  ) {
    const payload = buildDeliveryPayload(drafts[deliveryId] || {});

    if (Object.keys(payload).length === 0) {
      return false;
    }

    await updatePhotographerDeliveryFields(deliveryId, payload);

    if (reloadAfterSave) {
      await reload();
    }

    if (clearDraftAfterSave) {
      clearDraft(deliveryId);
    }

    return true;
  }

  async function moveStatus(deliveryId, status) {
    setSavingId(deliveryId);
    setActionError("");
    let savedDraft = false;

    try {
      savedDraft = await persistDraftChanges(deliveryId, {
        reloadAfterSave: false,
        clearDraftAfterSave: false,
      });
      await updatePhotographerDeliveryStatus(deliveryId, status, "");
      await reload();
      clearDraft(deliveryId);
    } catch (e) {
      if (savedDraft) {
        await reload();
      }
      setActionError(e?.message || t("message.updateStatusFailed"));
    } finally {
      setSavingId("");
    }
  }

  const handleDeliveryFiles = useCallback(
    async (deliveryId, field, files, existingText = "") => {
      const validFiles = Array.from(files || []).filter(
        (file) =>
          file?.type?.startsWith("image/") || file?.type?.startsWith("video/"),
      );

      if (!validFiles.length) {
        setActionError(t("message.invalidFileType"));
        return;
      }

      setSavingId(deliveryId);
      setActionError("");

      try {
        const uploadedLines = await Promise.all(
          validFiles.map(async (file) => {
            const data = await uploadPhotographerImage(file);
            const mediaUrl = data?.mediaUrl || data?.imageUrl;
            if (!mediaUrl) {
              throw new Error(t("message.missingUploadUrl"));
            }
            const mediaType = data?.mediaType || (file.type.includes("video") ? "video" : "image");
            return `${mediaUrl}|${mediaType}`;
          }),
        );

        const merged = [
          ...String(existingText)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          ...uploadedLines,
        ];

        setDraft(deliveryId, { [field]: merged.join("\n") });
      } catch (error) {
        setActionError(error?.message || t("message.fileUploadFailed"));
      } finally {
        setSavingId("");
      }
    },
    [t],
  );

  const openDeliveryFilePicker = useCallback(
    (deliveryId, field, existingText = "") => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*";
      input.multiple = true;
      input.style.display = "none";
      document.body.appendChild(input);

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
        window.removeEventListener("focus", handleWindowFocus);
      };

      const handleWindowFocus = () => {
        // If picker is canceled, `change` may not fire in some browsers.
        setTimeout(cleanup, 0);
      };

      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        cleanup();
        if (!files.length) return;
        await handleDeliveryFiles(deliveryId, field, files, existingText);
      };

      window.addEventListener("focus", handleWindowFocus);
      input.click();
    },
    [handleDeliveryFiles],
  );

  const handleDragOver = useCallback((e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget(key);
  }, []);

  const handleDragLeave = useCallback((e, key) => {
    e.preventDefault();
    e.stopPropagation();
    setDragTarget((prev) => (prev === key ? "" : prev));
  }, []);

  const handleDropFiles = useCallback(
    async (e, deliveryId, field, existingText, key) => {
      e.preventDefault();
      e.stopPropagation();
      setDragTarget((prev) => (prev === key ? "" : prev));

      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      await handleDeliveryFiles(deliveryId, field, files, existingText);
    },
    [handleDeliveryFiles],
  );

  async function saveFields(deliveryId) {
    const payload = buildDeliveryPayload(drafts[deliveryId] || {});

    if (Object.keys(payload).length === 0) {
      setActionError(t("message.noChangesToSave"));
      return;
    }
    setSavingId(deliveryId);
    setActionError("");

    try {
      await persistDraftChanges(deliveryId);
    } catch (error) {
      setActionError(error?.message || t("message.saveDeliveryFailed"));
    } finally {
      setSavingId("");
    }
  }

  const deliveries = Array.isArray(items)
    ? items.filter((item) => item && typeof item === "object")
    : [];

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

        {!loading && !error && !deliveries.length ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            {t("message.noDelivery")}
          </p>
        ) : null}

        <div className="mt-4 space-y-4">
          {deliveries.map((delivery) => {
            const booking =
              delivery.bookingId && typeof delivery.bookingId === "object"
                ? delivery.bookingId
                : null;

            const customer =
              delivery.customerId && typeof delivery.customerId === "object"
                ? delivery.customerId
                : null;

            const draft = drafts[delivery._id] || {};
            const isSaving = savingId === delivery._id;
            const history = Array.isArray(delivery.statusHistory)
              ? [...delivery.statusHistory].sort(
                  (a, b) =>
                    new Date(b?.changedAt || 0).getTime() -
                    new Date(a?.changedAt || 0).getTime(),
                )
              : [];
            const expectedDeliveryDate = getExpectedDeliveryDate(
              delivery,
              booking,
            );
            const previewFilesText =
              draft.previewFilesText ??
              (Array.isArray(delivery.previewFiles)
                ? delivery.previewFiles.map((f) => `${f.url}|${f.type}`).join("\n")
                : "");
            const finalFilesText =
              draft.finalFilesText ??
              (Array.isArray(delivery.finalFiles)
                ? delivery.finalFiles.map((f) => `${f.url}|${f.type}`).join("\n")
                : "");
            const previewDropKey = `${delivery._id}:preview`;
            const finalDropKey = `${delivery._id}:final`;

            return (
              <article key={delivery._id} className="card-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">
                    {booking?.bookingCode || t("message.delivery")}
                  </p>
                  <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)]">
                    {formatDeliveryStatus(delivery.status)}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-[var(--text)]">
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
                      {t("labels.customer")}:
                    </span>{" "}
                    {customer?.name || t("message.noCustomer")}
                  </p>

                  <p>
                    <span className="font-semibold">
                      {t("labels.deliveryMethod")}:
                    </span>{" "}
                    {formatDeliveryMethod(delivery.deliveryMethod)}
                  </p>

                  {delivery.deliveryMethodNote ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.deliveryNote")}:
                      </span>{" "}
                      {delivery.deliveryMethodNote}
                    </p>
                  ) : null}

                  {delivery.deliveredAt ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.deliveredOn")}:
                      </span>{" "}
                      {formatDate(delivery.deliveredAt)}
                    </p>
                  ) : null}

                  {delivery.deliveryLink ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.deliveryLink")}:
                      </span>{" "}
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

                  {delivery.photographerNote ? (
                    <p>
                      <span className="font-semibold">
                        {t("labels.photographerNote")}:
                      </span>{" "}
                      {delivery.photographerNote}
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
                </div>

                {history.length ? (
                  <div className="mt-4 space-y-2 border-t border-[#e8e2d6] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {t("labels.deliveryHistory")}
                    </p>
                    <div className="space-y-1 text-xs text-[var(--text)]">
                      {history.map((h, idx) => (
                        <p key={`${delivery._id}-h-${idx}`}>
                          {formatHistoryDateTime(h?.changedAt)}:{" "}
                          {h?.fromStatus
                            ? formatDeliveryStatus(h.fromStatus)
                            : t("message.startStatus")}{" "}
                          {"->"} {formatDeliveryStatus(h?.toStatus || "")}
                          {h?.note ? ` (${h.note})` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-[var(--muted)]">
                    {t("message.noHistoryYet")}
                  </p>
                )}

                {delivery.status !== "customer_confirmed" ? (
                  <div className="mt-4 space-y-3 border-t border-[#e8e2d6] pt-3">
                    <div className="flex flex-wrap gap-2">
                      {delivery.status === "event_done" ? (
                        <button
                          type="button"
                          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => moveStatus(delivery._id, "editing")}
                        >
                          {t("actions.markEditing")}
                        </button>
                      ) : null}

                      {delivery.status === "editing" ? (
                        <button
                          type="button"
                          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() =>
                            moveStatus(delivery._id, "preview_uploaded")
                          }
                        >
                          {t("actions.markPreviewUploaded")}
                        </button>
                      ) : null}

                      {delivery.status === "preview_uploaded" ? (
                        <button
                          type="button"
                          className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() =>
                            moveStatus(delivery._id, "final_delivered")
                          }
                        >
                          {t("actions.markFinalDelivered")}
                        </button>
                      ) : null}
                    </div>

                    <input
                      className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                      placeholder={t("placeholders.deliveryLink")}
                      value={draft.deliveryLink ?? delivery.deliveryLink ?? ""}
                      onChange={(e) =>
                        setDraft(delivery._id, { deliveryLink: e.target.value })
                      }
                    />

                    <textarea
                      className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                      rows={2}
                      placeholder={t("placeholders.photographerNote")}
                      value={
                        draft.photographerNote ?? delivery.photographerNote ?? ""
                      }
                      onChange={(e) =>
                        setDraft(delivery._id, {
                          photographerNote: e.target.value,
                        })
                      }
                    />

                    <textarea
                      className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                      rows={3}
                      placeholder={t("placeholders.previewFiles")}
                      value={previewFilesText}
                      readOnly
                    />

                    <div
                      className={`rounded-lg border-2 border-dashed p-3 transition-all ${
                        dragTarget === previewDropKey
                          ? "border-[var(--accent)] bg-[var(--surface)]/70 ring-2 ring-[var(--accent)]/30"
                          : "border-[#d9d2c4] bg-white"
                      }`}
                      onDragOver={(e) => handleDragOver(e, previewDropKey)}
                      onDragEnter={(e) => handleDragOver(e, previewDropKey)}
                      onDragLeave={(e) => handleDragLeave(e, previewDropKey)}
                      onDrop={(e) =>
                        handleDropFiles(
                          e,
                          delivery._id,
                          "previewFilesText",
                          previewFilesText,
                          previewDropKey,
                        )
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[var(--muted)]">
                          {dragTarget === previewDropKey
                            ? t("message.dropPreviewFiles")
                            : t("message.dragPreviewFiles")}
                        </p>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() =>
                            openDeliveryFilePicker(
                              delivery._id,
                              "previewFilesText",
                              previewFilesText,
                            )
                          }
                        >
                          <PlusIcon className="h-4 w-4" />
                          {t("actions.selectFiles")}
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="w-full rounded-md border border-[#d9d2c4] px-3 py-2 text-sm"
                      rows={3}
                      placeholder={t("placeholders.finalFiles")}
                      value={finalFilesText}
                      readOnly
                    />

                    <div
                      className={`rounded-lg border-2 border-dashed p-3 transition-all ${
                        dragTarget === finalDropKey
                          ? "border-[var(--accent)] bg-[var(--surface)]/70 ring-2 ring-[var(--accent)]/30"
                          : "border-[#d9d2c4] bg-white"
                      }`}
                      onDragOver={(e) => handleDragOver(e, finalDropKey)}
                      onDragEnter={(e) => handleDragOver(e, finalDropKey)}
                      onDragLeave={(e) => handleDragLeave(e, finalDropKey)}
                      onDrop={(e) =>
                        handleDropFiles(
                          e,
                          delivery._id,
                          "finalFilesText",
                          finalFilesText,
                          finalDropKey,
                        )
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[var(--muted)]">
                          {dragTarget === finalDropKey
                            ? t("message.dropFinalFiles")
                            : t("message.dragFinalFiles")}
                        </p>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() =>
                            openDeliveryFilePicker(
                              delivery._id,
                              "finalFilesText",
                              finalFilesText,
                            )
                          }
                        >
                          <PlusIcon className="h-4 w-4" />
                          {t("actions.selectFiles")}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-md bg-[#1f2937] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                      disabled={isSaving}
                      onClick={() => saveFields(delivery._id)}
                    >
                      {isSaving
                        ? t("actions.saving")
                        : t("actions.saveDeliveryData")}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-md border border-[#e8e2d6] bg-[#f8f5ef] px-3 py-2 text-sm text-[var(--muted)]">
                    {t("message.readOnlyAfterCustomerConfirm")}
                  </p>
                )}
              </article>
            );
          })}
        </div>
        </section>
      </div>
    </div>
  );
}

export default PhotographerDeliveryTracking;
