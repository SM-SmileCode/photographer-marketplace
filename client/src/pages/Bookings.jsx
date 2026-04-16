import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import {
  cancelMyBooking,
  createBooking,
  fetchMyBookings,
} from "../services/bookingService";
import { fetchPhotographerAvailableSlots } from "../services/availabilityService";
import { formatDate, formatTime } from "../utils/bookingFormatters";
import { getBookingStatusBadgeClass } from "../utils/bookingStatus";
import { pageThemeVars } from "../styles/themeVars";
import { useListData } from "../hooks/useListData";
import { useBookingsTranslation } from "../i18n/useBookingsTranslation";
import PhotographerDetailsCard from "./bookings/PhotographerDetailsCard";
import PayNowButton from "../_components/PayNowButton";

const initialFormState = {
  photographerId: "",
  eventType: "",
  eventDate: "",
  durationMinutes: "",
  slotName: "",
  startTime: "",
  endTime: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  customerNote: "",
  deliveryMethod: "other",
  deliveryMethodNote: "",
};

function resolveBookingFlow(value) {
  return String(value || "").toLowerCase() === "quick" ? "quick" : "normal";
}

function parseNonNegativeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function getAddOnKey(addOn) {
  const name = String(addOn?.name || "").trim();
  const price = parseNonNegativeNumber(addOn?.price);
  return `${name.toLowerCase()}|${price}`;
}

function isInstantBookingEntry(booking) {
  const history = Array.isArray(booking?.statusHistory)
    ? booking.statusHistory
    : [];

  return history.some(
    (entry) =>
      entry?.changedByRole === "system" &&
      entry?.fromStatus === "pending" &&
      entry?.toStatus === "accepted",
  );
}

function createInitialState({
  queryPhotographerId,
  initialBookingFlow = "normal",
}) {
  return {
    status: "",
    bookingFlow: resolveBookingFlow(initialBookingFlow),
    bookingFlowFilter: "all",
    submitting: false,
    error: "",
    ok: "",
    form: {
      ...initialFormState,
      photographerId: queryPhotographerId,
    },
    selectedPhotographer: null,
    availablePackages: [],
    selectedPackage: null,
    selectedAddOnKeys: [],
    additionalAmount: "",
    availableSlots: [],
    selectedSlotKey: "",
    slotLoading: false,
    slotError: "",
    resolvedDurationMinutes: null,
    bookingMode: "request_only",
  };
}

function getSlotKey(slot) {
  return `${slot.startAtUtc}|${slot.endAtUtc}`;
}

function clearSelectedSlotFields(form) {
  return {
    ...form,
    slotName: "",
    startTime: "",
    endTime: "",
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_BOOKING_FLOW":
      return { ...state, bookingFlow: resolveBookingFlow(action.payload) };
    case "SET_BOOKING_FLOW_FILTER":
      return { ...state, bookingFlowFilter: action.payload || "all" };
    case "SET_SELECTED_PHOTOGRAPHER":
      return {
        ...state,
        selectedPhotographer: action.payload,
        bookingMode: action.payload?.bookingMode || "request_only",
        bookingFlow:
          action.payload?.bookingMode === "instant" ? "quick" : "normal",
      };
    case "SET_AVAILABLE_PACKAGES": {
      const incomingPackages = Array.isArray(action.payload)
        ? action.payload
        : [];
      const currentPackageId = state.selectedPackage?._id;
      const matchedPackage = incomingPackages.find(
        (pkg) => pkg?._id === currentPackageId,
      );

      return {
        ...state,
        availablePackages: incomingPackages,
        selectedPackage: matchedPackage || null,
        selectedAddOnKeys:
          matchedPackage && Array.isArray(matchedPackage.addOns)
            ? state.selectedAddOnKeys.filter((key) =>
                matchedPackage.addOns.some((item) => getAddOnKey(item) === key),
              )
            : [],
      };
    }
    case "SET_SELECTED_PACKAGE":
      return {
        ...state,
        selectedPackage: action.payload || null,
        selectedAddOnKeys: [],
        additionalAmount: "",
      };
    case "TOGGLE_PACKAGE_ADDON": {
      const key = action.payload;
      const hasKey = state.selectedAddOnKeys.includes(key);
      return {
        ...state,
        selectedAddOnKeys: hasKey
          ? state.selectedAddOnKeys.filter((item) => item !== key)
          : [...state.selectedAddOnKeys, key],
      };
    }
    case "SET_ADDITIONAL_AMOUNT":
      return { ...state, additionalAmount: action.payload };
    case "SET_FORM_FIELD":
      return {
        ...state,
        form: { ...state.form, [action.payload.name]: action.payload.value },
      };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: "", ok: "" };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "SET_ERROR":
      return { ...state, error: action.payload, ok: "" };
    case "SET_OK":
      return { ...state, ok: action.payload, error: "" };
    case "RESET_SLOT_STATE":
      return {
        ...state,
        availableSlots: action.payload?.clearSlots ? [] : state.availableSlots,
        selectedSlotKey: "",
        slotLoading: false,
        slotError: action.payload?.clearError ? "" : state.slotError,
        resolvedDurationMinutes: null,
        bookingMode: "request_only",
        form: clearSelectedSlotFields(state.form),
      };
    case "SLOT_LOAD_START":
      return {
        ...state,
        availableSlots: [],
        selectedSlotKey: "",
        slotLoading: true,
        slotError: "",
        resolvedDurationMinutes: null,
        bookingMode: "request_only",
        form: clearSelectedSlotFields(state.form),
      };
    case "SLOT_LOAD_SUCCESS":
      return {
        ...state,
        availableSlots: action.payload.slots,
        selectedSlotKey: "",
        slotLoading: false,
        slotError: "",
        resolvedDurationMinutes: action.payload.durationMinutes,
        bookingMode: action.payload.bookingMode || "request_only",
        bookingFlow:
          action.payload.bookingMode === "instant" ? "quick" : "normal",
        form: clearSelectedSlotFields(state.form),
      };
    case "SLOT_LOAD_ERROR":
      return {
        ...state,
        availableSlots: [],
        selectedSlotKey: "",
        slotLoading: false,
        slotError: action.payload,
        resolvedDurationMinutes: null,
        bookingMode: "request_only",
        form: clearSelectedSlotFields(state.form),
      };
    case "SELECT_SLOT":
      return {
        ...state,
        selectedSlotKey: getSlotKey(action.payload),
        form: {
          ...state.form,
          slotName: action.payload.slotName,
          startTime: action.payload.startTime,
          endTime: action.payload.endTime,
        },
      };
    case "RESET_AFTER_SUBMIT":
      return {
        ...state,
        submitting: false,
        form: {
          ...initialFormState,
          photographerId: action.payload.photographerId,
        },
        selectedPackage: null,
        selectedAddOnKeys: [],
        additionalAmount: "",
        availableSlots: [],
        selectedSlotKey: "",
        slotLoading: false,
        slotError: "",
        resolvedDurationMinutes: null,
        bookingMode: "request_only",
      };
    default:
      return state;
  }
}

function Bookings() {
  const { t } = useBookingsTranslation();
  const { user } = useOutletContext() || {};
  const failedLoadSlotsMessage = t("bookings.failedLoadSlots");
  const [searchParams] = useSearchParams();

  const queryPhotographerId = searchParams.get("photographerId") ?? "";
  const queryBookingFlow = searchParams.get("bookingFlow") ?? "normal";
  const isPhotographerLocked = Boolean(queryPhotographerId);
  const [state, dispatch] = useReducer(reducer, {
    queryPhotographerId,
    initialBookingFlow: queryBookingFlow,
  }, createInitialState);

  const selectedPhotographerId = (
    queryPhotographerId || state.form.photographerId
  ).trim();
  const shouldShowPhotographerCard = /^[a-f\d]{24}$/i.test(
    selectedPhotographerId,
  );
  const selectedSlot =
    state.availableSlots.find(
      (slot) => getSlotKey(slot) === state.selectedSlotKey,
    ) || null;
  const isInstantBookingMode = state.bookingMode === "instant";
  const isQuickBookingSelected = state.bookingFlow === "quick";
  const selectedPackage = state.selectedPackage;
  const selectedPackageAddOns = Array.isArray(selectedPackage?.addOns)
    ? selectedPackage.addOns
    : [];
  const selectedAddOns = selectedPackageAddOns.filter((item) =>
    state.selectedAddOnKeys.includes(getAddOnKey(item)),
  );
  const baseAmount = parseNonNegativeNumber(selectedPackage?.basePrice);
  const addOnsTotal = selectedAddOns.reduce(
    (sum, item) => sum + parseNonNegativeNumber(item?.price),
    0,
  );
  const additionalAmount = parseNonNegativeNumber(state.additionalAmount);
  const finalAmount = baseAmount + addOnsTotal + additionalAmount;
  const selectedCurrency =
    selectedPackage?.currency ||
    state.selectedPhotographer?.currency ||
    "INR";

  const today = new Date();
  const minEventDate = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const bookingsFetcher = useMemo(
    () => (params) =>
      fetchMyBookings({ status: state.status, page: 1, limit: 20, ...params }),
    [state.status],
  );

  const {
    items,
    loading,
    error: listError,
    reload: reloadBookings,
  } = useListData(bookingsFetcher, [bookingsFetcher]);

  const filteredBookings = useMemo(() => {
    if (state.bookingFlowFilter === "quick") {
      return items.filter((booking) => isInstantBookingEntry(booking));
    }

    if (state.bookingFlowFilter === "normal") {
      return items.filter((booking) => !isInstantBookingEntry(booking));
    }

    return items;
  }, [items, state.bookingFlowFilter]);

  useEffect(() => {
    if (!shouldShowPhotographerCard || !state.form.eventDate) {
      dispatch({
        type: "RESET_SLOT_STATE",
        payload: { clearSlots: true, clearError: true },
      });
      return;
    }

    let isMounted = true;
    dispatch({ type: "SLOT_LOAD_START" });

    (async () => {
      try {
        const data = await fetchPhotographerAvailableSlots(
          selectedPhotographerId,
          {
            date: state.form.eventDate,
            durationMinutes: state.form.durationMinutes.trim() || undefined,
          },
        );

        if (!isMounted) return;

        dispatch({
          type: "SLOT_LOAD_SUCCESS",
          payload: {
            slots: data?.slots || [],
            durationMinutes: data?.durationMinutes || null,
            bookingMode: data?.bookingMode || "request_only",
          },
        });
      } catch (error) {
        if (!isMounted) return;

        dispatch({
          type: "SLOT_LOAD_ERROR",
          payload: error.message || failedLoadSlotsMessage,
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [
    failedLoadSlotsMessage,
    selectedPhotographerId,
    shouldShowPhotographerCard,
    state.form.durationMinutes,
    state.form.eventDate,
  ]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "photographerId" && isPhotographerLocked) return;

    dispatch({
      type: "SET_FORM_FIELD",
      payload: { name, value },
    });
  };

  const handleSlotSelect = (slot) => {
    dispatch({ type: "SELECT_SLOT", payload: slot });
  };

  const handleBookingFlowToggle = (flow) => {
    if (flow === "quick" && !isInstantBookingMode) return;
    dispatch({ type: "SET_BOOKING_FLOW", payload: flow });
  };

  const allowedEventTypes = [
    ...(state.selectedPhotographer?.eventTypes || []),
    ...(state.selectedPhotographer?.customEventTypes || []),
  ].filter(Boolean);

  const handlePhotographerLoad = useCallback((data) => {
    dispatch({ type: "SET_SELECTED_PHOTOGRAPHER", payload: data });
  }, [dispatch]);

  const handlePackagesLoad = useCallback((packages) => {
    dispatch({ type: "SET_AVAILABLE_PACKAGES", payload: packages });
  }, [dispatch]);

  const handlePackageSelect = useCallback((pkg) => {
    dispatch({ type: "SET_SELECTED_PACKAGE", payload: pkg || null });
  }, [dispatch]);

  const handleAddOnToggle = (addOn) => {
    dispatch({
      type: "TOGGLE_PACKAGE_ADDON",
      payload: getAddOnKey(addOn),
    });
  };

  const handleAdditionalAmountChange = (e) => {
    dispatch({
      type: "SET_ADDITIONAL_AMOUNT",
      payload: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (state.submitting) return;
    dispatch({ type: "SUBMIT_START" });

    const effectivePhotographerId = selectedPhotographerId;
    const required = [
      ["eventType", state.form.eventType],
      ["eventDate", state.form.eventDate],
      ["address", state.form.address],
      ["city", state.form.city],
      ["state", state.form.state],
      ["pincode", state.form.pincode],
    ];

    if (!effectivePhotographerId) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.photographerIdRequired"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    const missing = required.find(([, value]) => !String(value).trim());

    if (missing) {
      dispatch({
        type: "SET_ERROR",
        payload: `${t(`labels.${missing[0]}`)} ${t("bookings.requiredSuffix")}`,
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (state.bookingFlow === "quick" && !isInstantBookingMode) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.quickBookingDisabled"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (state.availablePackages.length > 0 && !selectedPackage) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.packageRequired"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (Number(state.additionalAmount || 0) < 0) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.invalidAdditionalAmount"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (!selectedSlot) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.selectedSlotRequired"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    const startAtUtc = new Date(selectedSlot.startAtUtc);
    const endAtUtc = new Date(selectedSlot.endAtUtc);

    if (
      Number.isNaN(startAtUtc.getTime()) ||
      Number.isNaN(endAtUtc.getTime())
    ) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.invalidDateTime"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (startAtUtc <= new Date()) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.startTimeFuture"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    if (endAtUtc <= startAtUtc) {
      dispatch({
        type: "SET_ERROR",
        payload: t("bookings.endTimeAfterStart"),
      });
      dispatch({ type: "SUBMIT_END" });
      return;
    }

    try {
      const idempotencyKey = [
        "web",
        effectivePhotographerId,
        state.form.eventDate,
        selectedSlot.startTime,
        selectedSlot.endTime,
        selectedPackage?._id || "custom",
        finalAmount || 0,
      ].join("-");

      const result = await createBooking({
        photographerId: effectivePhotographerId,
        packageId: selectedPackage?._id || null,
        selectedAddOns: selectedAddOns.map((item) => item.name),
        additionalAmount,
        eventType: state.form.eventType.trim().toLowerCase(),
        eventDate: state.form.eventDate,
        timezone: "Asia/Kolkata",
        slotName: selectedSlot.slotName,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        startAtUtc: startAtUtc.toISOString(),
        endAtUtc: endAtUtc.toISOString(),
        eventLocation: {
          address: state.form.address.trim(),
          city: state.form.city.trim(),
          state: state.form.state.trim(),
          pincode: state.form.pincode.trim(),
        },
        customerNote: state.form.customerNote,
        deliveryMethod: state.form.deliveryMethod,
        deliveryMethodNote: state.form.deliveryMethodNote,
        source: "web",
        idempotencyKey,
      });
      const wasInstantBooking =
        Boolean(result?.instant) || result?.booking?.status === "accepted";

      dispatch({
        type: "SET_OK",
        payload: wasInstantBooking
          ? t("bookings.instantBookingConfirmed")
          : t("bookings.bookingRequestSent"),
      });
      dispatch({
        type: "RESET_AFTER_SUBMIT",
        payload: {
          photographerId: isPhotographerLocked ? queryPhotographerId : "",
        },
      });

      await reloadBookings();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("bookings.failedCreateBooking"),
      });
      dispatch({ type: "SUBMIT_END" });
    }
  };

  const handleCancel = async (bookingId) => {
    const reason =
      window.prompt(t("bookings.cancellationReasonPrompt"), "") ?? "";

    try {
      await cancelMyBooking(bookingId, reason);
      await reloadBookings();
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error.message || t("bookings.failedCancelBooking"),
      });
    }
  };

  return (
    <div
      className="mx-auto max-w-6xl space-y-6 px-4 py-8"
      style={pageThemeVars}
    >
      {shouldShowPhotographerCard ? (
        <PhotographerDetailsCard
          photographerId={selectedPhotographerId}
          onPhotographerLoad={handlePhotographerLoad}
          onPackagesLoad={handlePackagesLoad}
          selectedPackageId={selectedPackage?._id || ""}
          onPackageSelect={handlePackageSelect}
        />
      ) : null}

      <section className="card-surface">
        <h1 className="text-xl font-semibold text-[var(--text)]">
          {t("bookings.createBooking")}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              {t("bookings.bookingFlowLabel")}
            </p>
            <div className="mt-2 inline-flex rounded-full border border-[var(--line)] bg-white p-1">
              <button
                type="button"
                onClick={() => handleBookingFlowToggle("normal")}
                disabled={isInstantBookingMode}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  !isQuickBookingSelected
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text)]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t("bookings.normalBooking")}
              </button>
              <button
                type="button"
                onClick={() => handleBookingFlowToggle("quick")}
                disabled={!isInstantBookingMode}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isQuickBookingSelected
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text)]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t("bookings.quickBooking")}
              </button>
            </div>
            {!isInstantBookingMode ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {t("bookings.quickBookingDisabled")}
              </p>
            ) : null}
          </div>

          <input
            name="photographerId"
            value={queryPhotographerId || state.form.photographerId || ""}
            onChange={handleFormChange}
            readOnly={isPhotographerLocked}
            placeholder={t("labels.photographerId")}
            className="form-input border-[var(--line)]"
          />

          <select
            name="eventType"
            value={state.form.eventType}
            onChange={handleFormChange}
            disabled={allowedEventTypes.length === 0}
            className="form-input border-[var(--line)]"
          >
            <option value="">
              {allowedEventTypes.length === 0
                ? t("bookings.noEventTypesAvailable")
                : t("labels.eventType")}
            </option>
            {allowedEventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="eventDate"
            value={state.form.eventDate}
            onChange={handleFormChange}
            min={minEventDate}
            placeholder={t("labels.eventDate")}
            className="form-input border-[var(--line)]"
          />

          <select
            name="durationMinutes"
            value={state.form.durationMinutes}
            onChange={handleFormChange}
            className="form-input border-[var(--line)]"
          >
            <option value="">{t("bookings.useRecommendedDuration")}</option>
            <option value="60">{t("bookings.oneHour")}</option>
            <option value="120">{t("bookings.twoHours")}</option>
            <option value="180">{t("bookings.threeHours")}</option>
            <option value="240">{t("bookings.fourHours")}</option>
            <option value="300">{t("bookings.fiveHours")}</option>
            <option value="360">{t("bookings.sixHours")}</option>
            <option value="420">{t("bookings.sevenHours")}</option>
            <option value="480">{t("bookings.eightHours")}</option>
          </select>

          <div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--text)]">
              {t("bookings.packageAndPricing")}
            </p>

            {!state.availablePackages.length ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {t("bookings.noPackagesConfigured")}
              </p>
            ) : null}

            {state.availablePackages.length > 0 && !selectedPackage ? (
              <p className="mt-2 text-sm text-amber-700">
                {t("bookings.packageRequired")}
              </p>
            ) : null}

            {selectedPackage ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg bg-[var(--surface)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {t("bookings.selectedPackageLabel")}: {selectedPackage.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {selectedCurrency} {baseAmount.toLocaleString("en-IN")} ({selectedPackage.hoursIncluded}h)
                  </p>
                </div>

                {selectedPackageAddOns.length ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {t("bookings.selectAddOns")}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedPackageAddOns.map((addOn, index) => {
                        const key = getAddOnKey(addOn);
                        const isChecked = state.selectedAddOnKeys.includes(key);
                        return (
                          <label
                            key={`${key}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                          >
                            <span className="text-[var(--text)]">{addOn.name}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-[var(--muted)]">
                                +{selectedCurrency} {parseNonNegativeNumber(addOn.price).toLocaleString("en-IN")}
                              </span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleAddOnToggle(addOn)}
                              />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                  <p className="text-sm text-[var(--muted)]">
                    {t("bookings.additionalAmountHelp")}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--muted)]">{selectedCurrency}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={state.additionalAmount}
                      onChange={handleAdditionalAmountChange}
                      placeholder={t("bookings.additionalAmount")}
                      className="form-input border-[var(--line)]"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--line)] bg-[#f8f6ef] px-3 py-3 text-sm text-[var(--text)]">
                  <p>
                    {t("bookings.basePriceLine")}: {selectedCurrency} {baseAmount.toLocaleString("en-IN")}
                  </p>
                  <p>
                    {t("bookings.addOnsLine")}: {selectedCurrency} {addOnsTotal.toLocaleString("en-IN")}
                  </p>
                  <p>
                    {t("bookings.additionalAmountLine")}: {selectedCurrency} {additionalAmount.toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-base font-semibold">
                    {t("bookings.finalAmountLine")}: {selectedCurrency} {finalAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {t("bookings.availableSlots")}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {!shouldShowPhotographerCard
                    ? t("bookings.choosePhotographerFirst")
                    : !state.form.eventDate
                      ? t("bookings.chooseDateForSlots")
                      : state.resolvedDurationMinutes
                        ? `${t("bookings.slotDurationPrefix")} ${state.resolvedDurationMinutes} ${t("bookings.minutesSuffix")}`
                        : t("bookings.selectAvailableSlot")}
                </p>

                {shouldShowPhotographerCard && state.form.eventDate ? (
                  <div className="mt-2 space-y-1">
                    <span className="bioExtraInfo">
                      {isInstantBookingMode
                        ? t("bookings.instantBadge")
                        : t("bookings.normalBadge")}
                    </span>
                    <p className="text-xs text-[var(--muted)]">
                      {isInstantBookingMode
                        ? t("bookings.instantModeDesc")
                        : t("bookings.normalModeDesc")}
                    </p>
                  </div>
                ) : null}
              </div>

              {selectedSlot ? (
                <span className="bioExtraInfo">{selectedSlot.slotName}</span>
              ) : null}
            </div>

            <div className="mt-4">
              {state.slotLoading ? (
                <p className="text-sm text-[var(--muted)]">
                  {t("bookings.loadingSlots")}
                </p>
              ) : null}

              {!state.slotLoading && state.slotError ? (
                <p className="text-sm text-red-600">{state.slotError}</p>
              ) : null}

              {!state.slotLoading &&
              !state.slotError &&
              shouldShowPhotographerCard &&
              state.form.eventDate &&
              !state.availableSlots.length ? (
                <p className="text-sm text-[var(--muted)]">
                  {t("bookings.noAvailableSlots")}
                </p>
              ) : null}

              {!state.slotLoading &&
              !state.slotError &&
              state.availableSlots.length ? (
                <div className="flex flex-wrap gap-2">
                  {state.availableSlots.map((slot) => {
                    const slotKey = getSlotKey(slot);
                    const isSelected = slotKey === state.selectedSlotKey;

                    return (
                      <button
                        key={slotKey}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--line)] bg-white text-[var(--text)] hover:bg-[#f4f1ea]"
                        }`}
                      >
                        {slot.slotName}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {selectedSlot ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {t("bookings.selectedSlotSummary")}{" "}
                {formatTime(selectedSlot.startTime)} -{" "}
                {formatTime(selectedSlot.endTime)}
              </p>
            ) : null}
          </div>

          <input
            name="address"
            value={state.form.address}
            onChange={handleFormChange}
            placeholder={t("labels.address")}
            className="form-input border-[var(--line)]"
          />

          <input
            name="city"
            value={state.form.city}
            onChange={handleFormChange}
            placeholder={t("labels.city")}
            className="form-input border-[var(--line)]"
          />

          <input
            name="state"
            value={state.form.state}
            onChange={handleFormChange}
            placeholder={t("labels.state")}
            className="form-input border-[var(--line)]"
          />

          <input
            name="pincode"
            value={state.form.pincode}
            onChange={handleFormChange}
            placeholder={t("labels.pincode")}
            className="form-input border-[var(--line)]"
          />

          <select
            name="deliveryMethod"
            value={state.form.deliveryMethod}
            onChange={handleFormChange}
            className="form-input border-[var(--line)]"
          >
            <option value="other">Other</option>
            <option value="physical">Physical Delivery</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="drive">Google Drive</option>
            <option value="email">Email</option>
            <option value="in_app">In App</option>
          </select>

          <textarea
            name="deliveryMethodNote"
            value={state.form.deliveryMethodNote}
            onChange={handleFormChange}
            placeholder={t("labels.deliveryNote")}
            rows={2}
            className="form-input border-[var(--line)] md:col-span-2"
          />

          <textarea
            name="customerNote"
            value={state.form.customerNote}
            onChange={handleFormChange}
            placeholder={t("labels.customerNote")}
            rows={3}
            className="form-input border-[var(--line)] md:col-span-2"
          />

          <div className="flex justify-center md:col-span-2">
            <button
              type="submit"
              disabled={state.submitting}
              className="form-btn bg-[var(--accent)] text-white disabled:opacity-70"
            >
              {state.submitting
                ? t("buttons.submitting")
                : isQuickBookingSelected && isInstantBookingMode
                  ? t("buttons.sendInstantBooking")
                  : t("buttons.sendBookingRequest")}
            </button>
          </div>
        </form>

        {state.error ? (
          <p className="mt-3 text-sm text-red-600">{state.error}</p>
        ) : null}
        {state.ok ? (
          <p className="mt-3 text-sm text-emerald-700">{state.ok}</p>
        ) : null}
      </section>

      <section className="card-surface">
        <div className="mb-4 space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {t("bookings.myBookings")}
            </h2>
            <select
              value={state.status}
              onChange={(e) =>
                dispatch({ type: "SET_STATUS", payload: e.target.value })
              }
              className="form-input w-44 border-[var(--line)]"
            >
              <option value="">{t("bookings.all")}</option>
              <option value="pending">{t("bookings.pending")}</option>
              <option value="accepted">{t("bookings.accepted")}</option>
              <option value="rejected">{t("bookings.rejected")}</option>
              <option value="cancelled">{t("bookings.cancelled")}</option>
              <option value="completed">{t("bookings.completed")}</option>
              <option value="expired">{t("bookings.expired")}</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t("bookings.bookingFlowFilterLabel")}
            </span>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "SET_BOOKING_FLOW_FILTER", payload: "all" })
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                state.bookingFlowFilter === "all"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--text)]"
              }`}
            >
              {t("bookings.allModes")}
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "SET_BOOKING_FLOW_FILTER", payload: "normal" })
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                state.bookingFlowFilter === "normal"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--text)]"
              }`}
            >
              {t("bookings.normalOnly")}
            </button>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "SET_BOOKING_FLOW_FILTER", payload: "quick" })
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                state.bookingFlowFilter === "quick"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--text)]"
              }`}
            >
              {t("bookings.instantOnly")}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">
            {t("bookings.loadingBookings")}
          </p>
        ) : null}
        {!loading && !filteredBookings.length ? (
          <p className="text-sm text-[var(--muted)]">
            {state.bookingFlowFilter === "all"
              ? t("bookings.noBookingYet")
              : t("bookings.noBookingInSelectedMode")}
          </p>
        ) : null}
        {listError ? <p className="text-sm text-red-600">{listError}</p> : null}

        <div className="space-y-3">
          {filteredBookings.map((booking) => {
            const canCancel = ["pending", "accepted"].includes(booking.status);
            const statusLabel = t(`bookings.${booking.status}`);
            const photographer =
              booking.photographerId &&
              typeof booking.photographerId === "object"
                ? booking.photographerId
                : null;
            const location = [
              booking.eventLocation?.address,
              booking.eventLocation?.city,
              booking.eventLocation?.state,
              booking.eventLocation?.pincode,
            ].filter(Boolean);
            const noteLabel =
              booking.status === "rejected" && booking.rejectionReason
                ? t("bookings.rejectionReason")
                : booking.status === "cancelled" && booking.cancellationReason
                  ? t("bookings.cancellationReason")
                  : booking.photographerResponseNote
                    ? t("bookings.responseNote")
                    : "";
            const noteValue =
              booking.status === "rejected" && booking.rejectionReason
                ? booking.rejectionReason
                : booking.status === "cancelled" && booking.cancellationReason
                  ? booking.cancellationReason
                  : booking.photographerResponseNote;
            const isInstantAutoAccepted = isInstantBookingEntry(booking);
            const paymentAmount = Number(booking?.payment?.amount);
            const finalQuotedAmount = Number(booking?.pricing?.finalAmount);
            const packageAmount =
              booking?.packageId && typeof booking.packageId === "object"
                ? Number(booking.packageId.basePrice)
                : NaN;
            const startingAmount = Number(photographer?.startingPrice);
            const payableAmount =
              Number.isFinite(paymentAmount) && paymentAmount > 0
                ? paymentAmount
                : Number.isFinite(finalQuotedAmount) && finalQuotedAmount > 0
                  ? finalQuotedAmount
                : Number.isFinite(packageAmount) && packageAmount > 0
                  ? packageAmount
                  : Number.isFinite(startingAmount) && startingAmount > 0
                    ? startingAmount
                    : 0;
            const payableCurrency =
              booking?.payment?.currency ||
              booking?.pricing?.currency ||
              (booking?.packageId && typeof booking.packageId === "object"
                ? booking.packageId.currency
                : "") ||
              photographer?.currency ||
              "INR";
            const canPayNow =
              booking.status === "accepted" &&
              booking.payment?.status !== "paid";

            return (
              <article key={booking._id} className="card-white">
                <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">
                  {booking.bookingCode}
                </p>

                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
                    Booking Details
                  </p>
                  <div className="space-y-1 text-sm text-[var(--text)]">
                    <p className="text-sm capitalize">
                      <span className="font-semibold">Event-Type :</span>{" "}
                      {booking.eventType}
                    </p>
                    <p className="text-sm capitalize">
                      <span className="font-semibold">Booking-Date :</span>{" "}
                      {formatDate(booking.eventDate)}
                    </p>
                    <p className="text-sm capitalize">
                      <span className="font-semibold">Scheduled For :</span>{" "}
                      {formatTime(booking.startTime)} -{" "}
                      {formatTime(booking.endTime)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-[var(--text)]">
                    Photographer
                  </p>
                  <div className="space-y-1 text-sm text-[var(--text)]">
                    <p className="text-[var(--text)] capitalize">
                      <span className="font-semibold">
                        {t("labels.photographer")} :
                      </span>{" "}
                      {photographer?.businessName ||
                        t("bookings.photographerUnavailable")}
                    </p>

                    {photographer?.city || photographer?.state ? (
                      <p className="text-[var(--muted)]">
                        {[photographer.city, photographer.state]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    ) : null}
                    <p className="text-[var(--muted)]">
                      <span className="font-semibold text-[var(--text)]">
                        {t("labels.location")}:
                      </span>{" "}
                      {location.join(", ") || t("bookings.locationUnavailable")}
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

                {isInstantAutoAccepted ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    {t("bookings.instantAutoAccepted")}
                  </p>
                ) : null}

                {noteLabel && noteValue ? (
                  <p className="mt-3 rounded-lg bg-[#f8f6ef] px-3 py-2 text-sm text-[var(--text)]">
                    {noteLabel}: {noteValue}
                  </p>
                ) : null}

                {Number.isFinite(finalQuotedAmount) && finalQuotedAmount > 0 ? (
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">
                    {t("bookings.finalAmountLine")}: {payableCurrency}{" "}
                    {finalQuotedAmount.toLocaleString("en-IN")}
                  </p>
                ) : null}

                {booking.status === "accepted" && booking.payment?.status === "paid" ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Payment Paid
                  </span>
                ) : null}

                {canPayNow ? (
                  <div className="mt-2">
                    <PayNowButton
                      bookingId={booking._id}
                      userName={user?.name}
                      userEmail={user?.email}
                      payableAmount={payableAmount}
                      currency={payableCurrency}
                      onPaid={() => reloadBookings()}
                    />
                  </div>
                ) : null}

                {canCancel ? (
                  <button
                    type="button"
                    onClick={() => handleCancel(booking._id)}
                    className="mt-2 rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--text)]"
                  >
                    {t("buttons.cancel")}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Bookings;

