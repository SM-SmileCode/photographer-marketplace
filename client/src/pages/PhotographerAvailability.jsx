import { useEffect, useReducer, useState } from "react";
import { pageThemeVars } from "../styles/themeVars";
import {
  deleteMyAvailabilityOverride,
  fetchMyAvailability,
  fetchMyAvailabilityOverrides,
  saveMyAvailability,
  saveMyAvailabilityOverride,
  bulkBlockDates,
} from "../services/availabilityService";

const WEEK_DAYS = [
  { dayOfWeek: 0, label: "Sunday" },
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
];

function createEmptyWindow(startTime = "10:00", endTime = "18:00") {
  return { startTime, endTime };
}

function createEmptyOverrideForm() {
  return {
    date: "",
    mode: "blocked",
    note: "",
    windows: [createEmptyWindow()],
  };
}

const DURATION_FIELD_CONFIG = {
  slotStepMinutes: { minMinutes: 1 },
  minSessionMinutes: { minMinutes: 1 },
  maxSessionMinutes: { minMinutes: 1 },
  defaultSessionMinutes: { minMinutes: 1 },
  bufferBeforeMinutes: { minMinutes: 0 },
  bufferAfterMinutes: { minMinutes: 0 },
  minNoticeMinutes: { minMinutes: 0 },
};

const initialState = {
  availabilityForm: null,
  overrides: [],
  overrideForm: createEmptyOverrideForm(),
  loading: true,
  savingAvailability: false,
  savingOverride: false,
  deletingOverrideDate: "",
  error: "",
  message: "",
};

function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeStringToMinutes(value) {
  const [hours, minutes] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

function availabilityToFormState(availability) {
  return {
    timezone: availability.timezone || "Asia/Kolkata",
    slotStepMinutes: availability.slotStepMinutes ?? 30,
    minSessionMinutes: availability.minSessionMinutes ?? 60,
    maxSessionMinutes: availability.maxSessionMinutes ?? 480,
    defaultSessionMinutes: availability.defaultSessionMinutes ?? 120,
    bufferBeforeMinutes: availability.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: availability.bufferAfterMinutes ?? 0,
    minNoticeMinutes: availability.minNoticeMinutes ?? 120,
    maxAdvanceDays: availability.maxAdvanceDays ?? 60,
    bookingMode: availability.bookingMode || "request_only",
    isActive: Boolean(availability.isActive),
    vacationMode: Boolean(availability.vacationMode),
    weeklySchedule: (availability.weeklySchedule || [])
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        isWorking: Boolean(day.isWorking),
        windows: (day.windows || []).map((window) => ({
          startTime: minutesToTimeString(window.startMinute),
          endTime: minutesToTimeString(window.endMinute),
        })),
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  };
}

function availabilityToPayload(form) {
  return {
    timezone: form.timezone.trim(),
    slotStepMinutes: Number(form.slotStepMinutes),
    minSessionMinutes: Number(form.minSessionMinutes),
    maxSessionMinutes: Number(form.maxSessionMinutes),
    defaultSessionMinutes: Number(form.defaultSessionMinutes),
    bufferBeforeMinutes: Number(form.bufferBeforeMinutes),
    bufferAfterMinutes: Number(form.bufferAfterMinutes),
    minNoticeMinutes: Number(form.minNoticeMinutes),
    maxAdvanceDays: Number(form.maxAdvanceDays),
    bookingMode: form.bookingMode,
    isActive: Boolean(form.isActive),
    weeklySchedule: form.weeklySchedule.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isWorking: Boolean(day.isWorking),
      windows: day.isWorking
        ? day.windows.map((window) => ({
            startMinute: timeStringToMinutes(window.startTime),
            endMinute: timeStringToMinutes(window.endTime),
          }))
        : [],
    })),
  };
}

function overrideToFormState(override) {
  return {
    date: override.date,
    mode: override.mode,
    note: override.note || "",
    windows:
      override.mode === "custom_windows"
        ? (override.windows || []).map((window) => ({
            startTime: minutesToTimeString(window.startMinute),
            endTime: minutesToTimeString(window.endMinute),
          }))
        : [createEmptyWindow()],
  };
}

function overrideToPayload(form) {
  return {
    mode: form.mode,
    note: form.note.trim(),
    windows:
      form.mode === "custom_windows"
        ? form.windows.map((window) => ({
            startMinute: timeStringToMinutes(window.startTime),
            endMinute: timeStringToMinutes(window.endTime),
          }))
        : [],
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: "", message: "" };
    case "LOAD_SUCCESS":
      return {
        ...state,
        availabilityForm: action.payload.availabilityForm,
        overrides: action.payload.overrides,
        loading: false,
        error: "",
      };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "UPDATE_AVAILABILITY_FORM":
      return {
        ...state,
        availabilityForm: action.payload(state.availabilityForm),
      };
    case "UPDATE_OVERRIDE_FORM":
      return { ...state, overrideForm: action.payload(state.overrideForm) };
    case "SAVE_AVAILABILITY_START":
      return { ...state, savingAvailability: true, error: "", message: "" };
    case "SAVE_AVAILABILITY_SUCCESS":
      return {
        ...state,
        savingAvailability: false,
        availabilityForm: action.payload,
        message: "Availability settings saved.",
      };
    case "SAVE_AVAILABILITY_ERROR":
      return { ...state, savingAvailability: false, error: action.payload };
    case "SAVE_OVERRIDE_START":
      return { ...state, savingOverride: true, error: "", message: "" };
    case "SAVE_OVERRIDE_SUCCESS":
      return {
        ...state,
        savingOverride: false,
        overrides: action.payload,
        overrideForm: createEmptyOverrideForm(),
        message: "Availability override saved.",
      };
    case "SAVE_OVERRIDE_ERROR":
      return { ...state, savingOverride: false, error: action.payload };
    case "DELETE_OVERRIDE_START":
      return {
        ...state,
        deletingOverrideDate: action.payload,
        error: "",
        message: "",
      };
    case "DELETE_OVERRIDE_SUCCESS":
      return {
        ...state,
        deletingOverrideDate: "",
        overrides: action.payload.overrides,
        overrideForm:
          state.overrideForm.date === action.payload.date
            ? createEmptyOverrideForm()
            : state.overrideForm,
        message: "Availability override deleted.",
      };
    case "DELETE_OVERRIDE_ERROR":
      return { ...state, deletingOverrideDate: "", error: action.payload };
    case "RESET_OVERRIDE_FORM":
      return { ...state, overrideForm: createEmptyOverrideForm() };
    case "EDIT_OVERRIDE":
      return {
        ...state,
        overrideForm: overrideToFormState(action.payload),
        error: "",
        message: "",
      };
    case "BULK_BLOCK_START":
      return { ...state, error: "", message: "" };
    case "BULK_BLOCK_SUCCESS":
      return { ...state, message: action.payload, overrides: action.overrides };
    case "BULK_BLOCK_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

function PhotographerAvailability() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [units, setUnits] = useState({
    slotStepMinutes: "minutes",
    minSessionMinutes: "minutes",
    maxSessionMinutes: "minutes",
    defaultSessionMinutes: "minutes",
    bufferBeforeMinutes: "minutes",
    bufferAfterMinutes: "minutes",
    minNoticeMinutes: "minutes",
  });

  const [localVals, setLocalVals] = useState({
    slotStepMinutes: "",
    minSessionMinutes: "",
    maxSessionMinutes: "",
    defaultSessionMinutes: "",
    bufferBeforeMinutes: "",
    bufferAfterMinutes: "",
    minNoticeMinutes: "",
  });

  const [durationErrors, setDurationErrors] = useState({});

  const parseDurationToMinutes = (rawValue, selectedUnit, minMinutes = 0) => {
    const value = String(rawValue ?? "").trim().toLowerCase();
    if (!value) {
      return { error: "Required" };
    }

    let totalMinutes = NaN;

    if (value.includes(":")) {
      const match = value.match(/^(\d+)\s*:\s*(\d{1,2})$/);
      if (!match) {
        return { error: "Use hh:mm format (example: 1:30)." };
      }
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (minutes >= 60) {
        return { error: "Minutes must be between 0 and 59." };
      }
      totalMinutes = hours * 60 + minutes;
    } else {
      const hoursWithSuffix = value.match(
        /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)$/,
      );
      const minutesWithSuffix = value.match(
        /^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)$/,
      );
      const plainNumber = value.match(/^\d+(?:\.\d+)?$/);

      if (hoursWithSuffix) {
        totalMinutes = Number(hoursWithSuffix[1]) * 60;
      } else if (minutesWithSuffix) {
        totalMinutes = Number(minutesWithSuffix[1]);
      } else if (plainNumber) {
        const numericValue = Number(plainNumber[0]);
        totalMinutes =
          selectedUnit === "hours" ? numericValue * 60 : numericValue;
      } else {
        return {
          error: "Enter minutes, hours, or hh:mm (example: 90, 1.5h, 1:30).",
        };
      }
    }

    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
      return { error: "Invalid duration." };
    }

    const roundedMinutes = Math.round(totalMinutes);
    if (roundedMinutes < minMinutes) {
      return {
        error:
          minMinutes === 1
            ? "Must be at least 1 minute."
            : `Must be at least ${minMinutes} minutes.`,
      };
    }

    return { minutes: roundedMinutes };
  };

  const formatDurationValue = (mins, unit) => {
    if (unit === "hours") {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m === 0 ? String(h) : `${h}:${m.toString().padStart(2, '0')}`;
    }
    return String(mins);
  };

  useEffect(() => {
    if (state.availabilityForm && localVals.slotStepMinutes === "") {
      const initVals = {};
      Object.keys(localVals).forEach((name) => {
        const mins = state.availabilityForm[name] ?? 0;
        initVals[name] = formatDurationValue(mins, units[name]);
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalVals(initVals);
    }
  }, [state.availabilityForm, units]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDurationChange = (name, rawVal, unit) => {
    if (rawVal !== "" && /[^a-zA-Z0-9:.\s]/.test(rawVal)) {
      return;
    }
    setLocalVals((prev) => ({ ...prev, [name]: rawVal }));

    const parsed = parseDurationToMinutes(
      rawVal,
      unit,
      DURATION_FIELD_CONFIG[name]?.minMinutes ?? 0,
    );

    if (parsed.error) {
      setDurationErrors((prev) => ({ ...prev, [name]: parsed.error }));
      return;
    }

    setDurationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleDurationBlur = (name, unit) => {
    const rawVal = localVals[name];
    const parsed = parseDurationToMinutes(
      rawVal,
      unit,
      DURATION_FIELD_CONFIG[name]?.minMinutes ?? 0,
    );
    if (parsed.error) return;

    const mins = parsed.minutes;
    setLocalVals((prev) => ({
      ...prev,
      [name]: formatDurationValue(mins, unit),
    }));
    setDurationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleUnitChange = (name, newUnit) => {
    const parsed = parseDurationToMinutes(
      localVals[name],
      units[name],
      DURATION_FIELD_CONFIG[name]?.minMinutes ?? 0,
    );
    const mins = parsed.error
      ? state.availabilityForm?.[name] ?? 0
      : parsed.minutes;

    setUnits((prev) => ({ ...prev, [name]: newUnit }));
    setDurationErrors((prev) => ({ ...prev, [name]: "" }));
    setLocalVals((prev) => ({
      ...prev,
      [name]: formatDurationValue(mins, newUnit),
    }));
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        dispatch({ type: "LOAD_START" });
        const [availabilityRes, overrideRes] = await Promise.all([
          fetchMyAvailability(),
          fetchMyAvailabilityOverrides(),
        ]);

        if (!active) return;

        dispatch({
          type: "LOAD_SUCCESS",
          payload: {
            availabilityForm: availabilityToFormState(
              availabilityRes.availability,
            ),
            overrides: overrideRes.items || [],
          },
        });
      } catch (error) {
        if (!active) return;

        dispatch({
          type: "LOAD_ERROR",
          payload: error.message || "Failed to load availability.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateDay = (dayOfWeek, updater) => {
    dispatch({
      type: "UPDATE_AVAILABILITY_FORM",
      payload: (prev) => ({
        ...prev,
        weeklySchedule: prev.weeklySchedule.map((day) =>
          day.dayOfWeek === dayOfWeek ? updater(day) : day,
        ),
      }),
    });
  };

  const handleAvailabilityFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    dispatch({
      type: "UPDATE_AVAILABILITY_FORM",
      payload: (prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }),
    });
  };

  const handleBookingModeToggle = (bookingMode) => {
    dispatch({
      type: "UPDATE_AVAILABILITY_FORM",
      payload: (prev) => ({
        ...prev,
        bookingMode,
      }),
    });
  };

  const handleDayWorkingToggle = (dayOfWeek, checked) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      isWorking: checked,
      windows: checked
        ? day.windows.length
          ? day.windows
          : [createEmptyWindow()]
        : [],
    }));
  };

  const handleDayWindowChange = (dayOfWeek, index, field, value) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      windows: day.windows.map((window, windowIndex) =>
        windowIndex === index ? { ...window, [field]: value } : window,
      ),
    }));
  };

  const addDayWindow = (dayOfWeek) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      windows: [...day.windows, createEmptyWindow()],
    }));
  };

  const removeDayWindow = (dayOfWeek, index) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      windows: day.windows.filter((_, windowIndex) => windowIndex !== index),
    }));
  };

  const handleAvailabilitySubmit = async (e) => {
    e.preventDefault();

    const parsedDurations = {};
    const nextDurationErrors = {};

    Object.keys(DURATION_FIELD_CONFIG).forEach((field) => {
      const parsed = parseDurationToMinutes(
        localVals[field],
        units[field],
        DURATION_FIELD_CONFIG[field].minMinutes,
      );

      if (parsed.error) {
        nextDurationErrors[field] = parsed.error;
      } else {
        parsedDurations[field] = parsed.minutes;
      }
    });

    if (Object.keys(nextDurationErrors).length > 0) {
      setDurationErrors((prev) => ({ ...prev, ...nextDurationErrors }));
      return;
    }

    setDurationErrors((prev) => {
      const next = { ...prev };
      Object.keys(DURATION_FIELD_CONFIG).forEach((field) => {
        next[field] = "";
      });
      return next;
    });

    setLocalVals((prev) => {
      const next = { ...prev };
      Object.keys(DURATION_FIELD_CONFIG).forEach((field) => {
        next[field] = formatDurationValue(parsedDurations[field], units[field]);
      });
      return next;
    });

    const normalizedForm = {
      ...state.availabilityForm,
      ...parsedDurations,
    };

    try {
      dispatch({ type: "SAVE_AVAILABILITY_START" });
      const result = await saveMyAvailability(availabilityToPayload(normalizedForm));

      dispatch({
        type: "SAVE_AVAILABILITY_SUCCESS",
        payload: availabilityToFormState(result.availability),
      });
    } catch (error) {
      dispatch({
        type: "SAVE_AVAILABILITY_ERROR",
        payload: error.message || "Failed to save availability.",
      });
    }
  };

  const handleOverrideFieldChange = (e) => {
    const { name, value } = e.target;
    dispatch({
      type: "UPDATE_OVERRIDE_FORM",
      payload: (prev) => ({
        ...prev,
        [name]: value,
        windows:
          name === "mode" && value === "blocked"
            ? [createEmptyWindow()]
            : prev.windows,
      }),
    });
  };

  const handleOverrideWindowChange = (index, field, value) => {
    dispatch({
      type: "UPDATE_OVERRIDE_FORM",
      payload: (prev) => ({
        ...prev,
        windows: prev.windows.map((window, windowIndex) =>
          windowIndex === index ? { ...window, [field]: value } : window,
        ),
      }),
    });
  };

  const addOverrideWindow = () => {
    dispatch({
      type: "UPDATE_OVERRIDE_FORM",
      payload: (prev) => ({
        ...prev,
        windows: [...prev.windows, createEmptyWindow()],
      }),
    });
  };

  const removeOverrideWindow = (index) => {
    dispatch({
      type: "UPDATE_OVERRIDE_FORM",
      payload: (prev) => ({
        ...prev,
        windows: prev.windows.filter((_, windowIndex) => windowIndex !== index),
      }),
    });
  };

  const reloadOverrides = async () => {
    const overrideRes = await fetchMyAvailabilityOverrides();
    return overrideRes.items || [];
  };

  const [bulkForm, setBulkForm] = useReducer((s, a) => ({ ...s, ...a }), {
    from: "",
    to: "",
    note: "",
    saving: false,
  });

  const handleBulkBlock = async (e) => {
    e.preventDefault();
    if (!bulkForm.from || !bulkForm.to) return;
    setBulkForm({ saving: true });
    dispatch({ type: "BULK_BLOCK_START" });
    try {
      const result = await bulkBlockDates({
        from: bulkForm.from,
        to: bulkForm.to,
        note: bulkForm.note,
      });
      const overrides = await reloadOverrides();
      dispatch({
        type: "BULK_BLOCK_SUCCESS",
        payload: `Blocked ${result.blockedCount} date(s).`,
        overrides,
      });
      setBulkForm({ from: "", to: "", note: "", saving: false });
    } catch (error) {
      dispatch({
        type: "BULK_BLOCK_ERROR",
        payload: error.message || "Failed to bulk block dates.",
      });
      setBulkForm({ saving: false });
    }
  };

  const handleVacationToggle = async (checked) => {
    try {
      dispatch({
        type: "UPDATE_AVAILABILITY_FORM",
        payload: (prev) => ({ ...prev, vacationMode: checked }),
      });
      await saveMyAvailability({
        ...availabilityToPayload(state.availabilityForm),
        vacationMode: checked,
      });
      dispatch({
        type: "SAVE_AVAILABILITY_SUCCESS",
        payload: { ...state.availabilityForm, vacationMode: checked },
      });
    } catch (error) {
      dispatch({
        type: "SAVE_AVAILABILITY_ERROR",
        payload: error.message || "Failed to update vacation mode.",
      });
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();

    try {
      dispatch({ type: "SAVE_OVERRIDE_START" });
      await saveMyAvailabilityOverride(
        state.overrideForm.date,
        overrideToPayload(state.overrideForm),
      );

      dispatch({
        type: "SAVE_OVERRIDE_SUCCESS",
        payload: await reloadOverrides(),
      });
    } catch (error) {
      dispatch({
        type: "SAVE_OVERRIDE_ERROR",
        payload: error.message || "Failed to save override.",
      });
    }
  };

  const handleDeleteOverride = async (date) => {
    const confirmed = window.confirm(
      `Delete availability override for ${date}?`,
    );

    if (!confirmed) return;

    try {
      dispatch({ type: "DELETE_OVERRIDE_START", payload: date });
      await deleteMyAvailabilityOverride(date);
      dispatch({
        type: "DELETE_OVERRIDE_SUCCESS",
        payload: { overrides: await reloadOverrides(), date },
      });
    } catch (error) {
      dispatch({
        type: "DELETE_OVERRIDE_ERROR",
        payload: error.message || "Failed to delete override.",
      });
    }
  };

  if (state.loading || !state.availabilityForm) {
    return (
      <div
        className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8"
        style={pageThemeVars}
      >
        <div className="mx-auto max-w-6xl">
          <div className="card-surface">
            <p className="text-sm text-[var(--muted)]">
              Loading availability...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-surface">
          <p className="label-uppercase">Availability Settings</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">
            Manage your booking schedule
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Set your default weekly working hours, booking rules, and one-off
            blocked or custom dates. Customers will only see slots generated
            from this schedule.
          </p>

          {state.error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          {state.message ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {state.message}
            </p>
          ) : null}
        </section>

        <section className="card-surface">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Vacation Mode
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            When enabled, no new bookings can be made. Existing accepted
            bookings are unaffected.
          </p>
          <label className="mt-4 flex items-center gap-3 cursor-pointer">
            <div
              onClick={() =>
                handleVacationToggle(!state.availabilityForm.vacationMode)
              }
              className={`relative h-6 w-11 rounded-full transition-colors ${
                state.availabilityForm.vacationMode
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--line)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  state.availabilityForm.vacationMode ? "translate-x-5" : ""
                }`}
              />
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">
              {state.availabilityForm.vacationMode
                ? "Vacation mode ON — bookings paused"
                : "Vacation mode OFF"}
            </span>
          </label>
        </section>

        <section className="card-surface">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Bulk Block Dates
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Block a range of dates at once — useful for holidays or travel.
          </p>
          <form
            onSubmit={handleBulkBlock}
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_2fr_auto]"
          >
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-[var(--text)]">From</span>
              <input
                type="date"
                value={bulkForm.from}
                onChange={(e) => setBulkForm({ from: e.target.value })}
                className="input-base"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-[var(--text)]">To</span>
              <input
                type="date"
                value={bulkForm.to}
                onChange={(e) => setBulkForm({ to: e.target.value })}
                className="input-base"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold text-[var(--text)]">
                Note (optional)
              </span>
              <input
                type="text"
                value={bulkForm.note}
                onChange={(e) => setBulkForm({ note: e.target.value })}
                placeholder="e.g. Family vacation"
                className="input-base"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={bulkForm.saving}
                className="btn-primary disabled:opacity-70"
              >
                {bulkForm.saving ? "Blocking..." : "Block Dates"}
              </button>
            </div>
          </form>
        </section>

        <section className="card-surface">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">Rules</h2>
          </div>

          <form onSubmit={handleAvailabilitySubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Your Time Zone</span>
                <input
                  name="timezone"
                  value={state.availabilityForm.timezone}
                  onChange={handleAvailabilityFieldChange}
                  className="input-base"
                />
              </label>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">New slots every</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.slotStepMinutes === "hours" ? "1 or 1:30" : "30"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.slotStepMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "slotStepMinutes",
                        e.target.value,
                        units.slotStepMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "slotStepMinutes",
                        units.slotStepMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.slotStepMinutes}
                    onChange={(e) =>
                      handleUnitChange("slotStepMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.slotStepMinutes && <p className="text-xs text-red-600">{durationErrors.slotStepMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">
                  Shortest booking you accept
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.minSessionMinutes === "hours" ? "1 or 1:30" : "60"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.minSessionMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "minSessionMinutes",
                        e.target.value,
                        units.minSessionMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "minSessionMinutes",
                        units.minSessionMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.minSessionMinutes}
                    onChange={(e) =>
                      handleUnitChange("minSessionMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.minSessionMinutes && <p className="text-xs text-red-600">{durationErrors.minSessionMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">
                  Longest booking you accept
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.maxSessionMinutes === "hours" ? "8 or 8:00" : "480"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.maxSessionMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "maxSessionMinutes",
                        e.target.value,
                        units.maxSessionMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "maxSessionMinutes",
                        units.maxSessionMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.maxSessionMinutes}
                    onChange={(e) =>
                      handleUnitChange("maxSessionMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.maxSessionMinutes && <p className="text-xs text-red-600">{durationErrors.maxSessionMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">
                  Recommended booking length
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.defaultSessionMinutes === "hours" ? "2 or 2:00" : "120"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.defaultSessionMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "defaultSessionMinutes",
                        e.target.value,
                        units.defaultSessionMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "defaultSessionMinutes",
                        units.defaultSessionMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.defaultSessionMinutes}
                    onChange={(e) =>
                      handleUnitChange("defaultSessionMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.defaultSessionMinutes && <p className="text-xs text-red-600">{durationErrors.defaultSessionMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Prep time before booking</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.bufferBeforeMinutes === "hours" ? "0 or 0:30" : "0"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.bufferBeforeMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "bufferBeforeMinutes",
                        e.target.value,
                        units.bufferBeforeMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "bufferBeforeMinutes",
                        units.bufferBeforeMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.bufferBeforeMinutes}
                    onChange={(e) =>
                      handleUnitChange("bufferBeforeMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.bufferBeforeMinutes && <p className="text-xs text-red-600">{durationErrors.bufferBeforeMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Break after booking</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.bufferAfterMinutes === "hours" ? "0 or 0:30" : "0"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.bufferAfterMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "bufferAfterMinutes",
                        e.target.value,
                        units.bufferAfterMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "bufferAfterMinutes",
                        units.bufferAfterMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.bufferAfterMinutes}
                    onChange={(e) =>
                      handleUnitChange("bufferAfterMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.bufferAfterMinutes && <p className="text-xs text-red-600">{durationErrors.bufferAfterMinutes}</p>}
              </div>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">
                  How early should customers book?
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={units.minNoticeMinutes === "hours" ? "2 or 2:00" : "120"}
                    className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#0F766E]/20 flex-1 min-w-0"
                    value={localVals.minNoticeMinutes}
                    onChange={(e) =>
                      handleDurationChange(
                        "minNoticeMinutes",
                        e.target.value,
                        units.minNoticeMinutes,
                      )
                    }
                    onBlur={() =>
                      handleDurationBlur(
                        "minNoticeMinutes",
                        units.minNoticeMinutes,
                      )
                    }
                  />
                  <select
                    className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none shrink-0"
                    value={units.minNoticeMinutes}
                    onChange={(e) =>
                      handleUnitChange("minNoticeMinutes", e.target.value)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
                {durationErrors.minNoticeMinutes && <p className="text-xs text-red-600">{durationErrors.minNoticeMinutes}</p>}
              </div>

              <label className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">
                  How far ahead can customers book? (days)
                </span>
                <input
                  type="number"
                  min="1"
                  name="maxAdvanceDays"
                  value={state.availabilityForm.maxAdvanceDays}
                  onChange={handleAvailabilityFieldChange}
                  className="input-base"
                />
              </label>

              <div className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Booking style</span>
                <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => handleBookingModeToggle("request_only")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      state.availabilityForm.bookingMode === "request_only"
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text)]"
                    }`}
                  >
                    Normal booking
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBookingModeToggle("instant")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      state.availabilityForm.bookingMode === "instant"
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text)]"
                    }`}
                  >
                    Quick booking
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {state.availabilityForm.bookingMode === "instant"
                    ? "Customers get confirmed immediately when they book an available slot."
                    : "Customers send a request first, and you confirm manually."}
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={state.availabilityForm.isActive}
                  onChange={handleAvailabilityFieldChange}
                />
                Availability active
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Weekly schedule
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Add one or more working windows for each day you want to
                  accept bookings.
                </p>
              </div>

              <div className="space-y-4">
                {state.availabilityForm.weeklySchedule.map((day) => (
                  <article key={day.dayOfWeek} className="card-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[var(--text)]">
                          {WEEK_DAYS.find(
                            (item) => item.dayOfWeek === day.dayOfWeek,
                          )?.label || `Day ${day.dayOfWeek}`}
                        </h4>
                        <p className="text-sm text-[var(--muted)]">
                          {day.isWorking
                            ? `${day.windows.length} window(s) configured`
                            : "Not accepting bookings"}
                        </p>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={day.isWorking}
                          onChange={(e) =>
                            handleDayWorkingToggle(
                              day.dayOfWeek,
                              e.target.checked,
                            )
                          }
                        />
                        Working day
                      </label>
                    </div>

                    {day.isWorking ? (
                      <div className="mt-4 space-y-3">
                        {day.windows.map((window, index) => (
                          <div
                            key={`${day.dayOfWeek}-${index}`}
                            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                          >
                            <input
                              type="time"
                              value={window.startTime}
                              onChange={(e) =>
                                handleDayWindowChange(
                                  day.dayOfWeek,
                                  index,
                                  "startTime",
                                  e.target.value,
                                )
                              }
                              className="input-base"
                            />
                            <input
                              type="time"
                              value={window.endTime}
                              onChange={(e) =>
                                handleDayWindowChange(
                                  day.dayOfWeek,
                                  index,
                                  "endTime",
                                  e.target.value,
                                )
                              }
                              className="input-base"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeDayWindow(day.dayOfWeek, index)
                              }
                              disabled={day.windows.length === 1}
                              className="btn-secondary disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addDayWindow(day.dayOfWeek)}
                          className="btn-secondary"
                        >
                          Add window
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={state.savingAvailability}
                className="btn-primary disabled:opacity-70"
              >
                {state.savingAvailability ? "Saving..." : "Save availability"}
              </button>
            </div>
          </form>
        </section>

        <section className="card-surface">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              Date overrides
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Block a date entirely or replace that date with custom windows.
            </p>
          </div>

          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Date</span>
                <input
                  type="date"
                  name="date"
                  value={state.overrideForm.date}
                  onChange={handleOverrideFieldChange}
                  className="input-base"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--text)]">
                <span className="font-semibold">Mode</span>
                <select
                  name="mode"
                  value={state.overrideForm.mode}
                  onChange={handleOverrideFieldChange}
                  className="input-base"
                >
                  <option value="blocked">Blocked all day</option>
                  <option value="custom_windows">Custom windows</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-[var(--text)] md:col-span-2">
                <span className="font-semibold">Note</span>
                <input
                  name="note"
                  value={state.overrideForm.note}
                  onChange={handleOverrideFieldChange}
                  className="input-base"
                  placeholder="Optional reason for this override"
                />
              </label>
            </div>

            {state.overrideForm.mode === "custom_windows" ? (
              <div className="space-y-3">
                {state.overrideForm.windows.map((window, index) => (
                  <div
                    key={`override-window-${index}`}
                    className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      type="time"
                      value={window.startTime}
                      onChange={(e) =>
                        handleOverrideWindowChange(
                          index,
                          "startTime",
                          e.target.value,
                        )
                      }
                      className="input-base"
                    />
                    <input
                      type="time"
                      value={window.endTime}
                      onChange={(e) =>
                        handleOverrideWindowChange(
                          index,
                          "endTime",
                          e.target.value,
                        )
                      }
                      className="input-base"
                    />
                    <button
                      type="button"
                      onClick={() => removeOverrideWindow(index)}
                      disabled={state.overrideForm.windows.length === 1}
                      className="btn-secondary disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addOverrideWindow}
                  className="btn-secondary"
                >
                  Add override window
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET_OVERRIDE_FORM" })}
                className="btn-secondary"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={state.savingOverride}
                className="btn-primary disabled:opacity-70"
              >
                {state.savingOverride ? "Saving..." : "Save override"}
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {state.overrides.length ? (
              state.overrides.map((override) => (
                <article
                  key={override.date}
                  className="card-white flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[var(--text)]">
                      {override.date}
                    </p>
                    <p className="text-sm text-[var(--muted)] capitalize">
                      {override.mode === "blocked"
                        ? "Blocked all day"
                        : `${override.windows?.length || 0} custom window(s)`}
                    </p>
                    {override.note ? (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {override.note}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: "EDIT_OVERRIDE", payload: override })
                      }
                      className="btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOverride(override.date)}
                      disabled={state.deletingOverrideDate === override.date}
                      className="btn-secondary disabled:opacity-60"
                    >
                      {state.deletingOverrideDate === override.date
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No availability overrides yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PhotographerAvailability;
