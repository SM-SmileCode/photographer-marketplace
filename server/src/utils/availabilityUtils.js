const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_IN_DAY = 24 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function getFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getZonedParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

export function isValidDateKey(dateKey) {
  return DATE_KEY_REGEX.test(String(dateKey || ""));
}

export function parseDateKey(dateKey) {
  if (!isValidDateKey(dateKey)) {
    throw new Error("date must be in YYYY-MM-DD format.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);

  return { year, month, day };
}

export function getDateKeyDayOfWeek(dateKey) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function formatDateKeyInTimeZone(date, timeZone) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

export function dateKeyDiffInDays(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);

  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) -
      Date.UTC(from.year, from.month - 1, from.day)) /
      DAY_MS,
  );
}

export function addDaysToDateKey(dateKey, days) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

export function timeStringToMinutes(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("time must be in HH:MM format.");
  }

  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes;

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    total >= MINUTES_IN_DAY
  ) {
    throw new Error("time must be a valid same-day HH:MM value.");
  }

  return total;
}

export function zonedDateTimeToUtc(dateKey, minuteOfDay, timeZone) {
  const { year, month, day } = parseDateKey(dateKey);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const naiveUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);

  let guess = new Date(naiveUtc);
  let offset = getTimeZoneOffsetMs(guess, timeZone);
  let result = new Date(naiveUtc - offset);
  const correctedOffset = getTimeZoneOffsetMs(result, timeZone);

  if (correctedOffset !== offset) {
    result = new Date(naiveUtc - correctedOffset);
  }

  return result;
}

export function getWindowsForDate({ availability, override, dateKey }) {
  if (!availability?.isActive) return [];

  if (override?.mode === "blocked") return [];
  if (override?.mode === "custom_windows") return override.windows || [];

  const dayOfWeek = getDateKeyDayOfWeek(dateKey);
  const dayConfig = (availability.weeklySchedule || []).find(
    (day) => day.dayOfWeek === dayOfWeek,
  );

  if (!dayConfig?.isWorking) return [];

  return dayConfig.windows || [];
}

export function generateSlotsForDate({
  availability,
  dateKey,
  override = null,
  sessionMinutes,
  now = new Date(),
}) {
  if (!availability) {
    throw new Error("Availability settings are required.");
  }

  if (!isValidDateKey(dateKey)) {
    throw new Error("date must be in YYYY-MM-DD format.");
  }

  const duration = Number(sessionMinutes ?? availability.defaultSessionMinutes);

  if (
    !Number.isInteger(duration) ||
    duration < availability.minSessionMinutes ||
    duration > availability.maxSessionMinutes
  ) {
    throw new Error("Requested duration is outside allowed limits.");
  }

  const currentDateKey = formatDateKeyInTimeZone(now, availability.timezone);
  const dayDiff = dateKeyDiffInDays(currentDateKey, dateKey);

  if (dayDiff < 0) return [];
  if (dayDiff > availability.maxAdvanceDays) return [];

  const minStartTime = new Date(
    now.getTime() + availability.minNoticeMinutes * 60 * 1000,
  );

  const windows = getWindowsForDate({ availability, override, dateKey });
  const slots = [];

  for (const window of windows) {
    const startMinute = Number(window.startMinute);
    const endMinute = Number(window.endMinute);

    for (
      let slotStart = startMinute;
      slotStart + duration <= endMinute;
      slotStart += availability.slotStepMinutes
    ) {
      const slotEnd = slotStart + duration;
      const startAtUtc = zonedDateTimeToUtc(
        dateKey,
        slotStart,
        availability.timezone,
      );
      const endAtUtc = zonedDateTimeToUtc(
        dateKey,
        slotEnd,
        availability.timezone,
      );

      if (startAtUtc < minStartTime) continue;

      slots.push({
        slotName: `${minutesToTimeString(slotStart)} - ${minutesToTimeString(
          slotEnd,
        )}`,
        startTime: minutesToTimeString(slotStart),
        endTime: minutesToTimeString(slotEnd),
        startMinute: slotStart,
        endMinute: slotEnd,
        startAtUtc,
        endAtUtc,
      });
    }
  }

  return slots;
}

export function filterConflictingSlots({
  slots,
  bookings,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0,
}) {
  return (slots || []).filter((slot) => {
    const slotStart = new Date(
      slot.startAtUtc.getTime() - bufferBeforeMinutes * 60 * 1000,
    );
    const slotEnd = new Date(
      slot.endAtUtc.getTime() + bufferAfterMinutes * 60 * 1000,
    );

    return !(bookings || []).some((booking) => {
      const bookingStart = new Date(booking.startAtUtc);
      const bookingEnd = new Date(booking.endAtUtc);

      return bookingStart < slotEnd && bookingEnd > slotStart;
    });
  });
}

export function findMatchingSlot({ slots, startAtUtc, endAtUtc }) {
  const requestedStart = new Date(startAtUtc).getTime();
  const requestedEnd = new Date(endAtUtc).getTime();

  return (slots || []).find(
    (slot) =>
      slot.startAtUtc.getTime() === requestedStart &&
      slot.endAtUtc.getTime() === requestedEnd,
  );
}
