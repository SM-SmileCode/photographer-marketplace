import mongoose from "mongoose";

const MINUTES_IN_DAY = 24 * 60;

const defaultWeeklySchedule = [
  { dayOfWeek: 0, isWorking: false, windows: [] },
  {
    dayOfWeek: 1,
    isWorking: true,
    windows: [{ startMinute: 10 * 60, endMinute: 18 * 60 }],
  },
  {
    dayOfWeek: 2,
    isWorking: true,
    windows: [{ startMinute: 10 * 60, endMinute: 18 * 60 }],
  },
  {
    dayOfWeek: 3,
    isWorking: true,
    windows: [{ startMinute: 10 * 60, endMinute: 18 * 60 }],
  },
  {
    dayOfWeek: 4,
    isWorking: true,
    windows: [{ startMinute: 10 * 60, endMinute: 18 * 60 }],
  },
  {
    dayOfWeek: 5,
    isWorking: true,
    windows: [{ startMinute: 10 * 60, endMinute: 18 * 60 }],
  },
  { dayOfWeek: 6, isWorking: false, windows: [] },
];

function normalizeWindows(windows = []) {
  const normalized = (windows || [])
    .map((window) => ({
      startMinute: Number(window?.startMinute),
      endMinute: Number(window?.endMinute),
    }))
    .sort((a, b) => a.startMinute - b.startMinute);

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];

    if (
      !Number.isInteger(current.startMinute) ||
      !Number.isInteger(current.endMinute)
    ) {
      throw new Error("Availability windows must use whole-minute values.");
    }

    if (
      current.startMinute < 0 ||
      current.endMinute > MINUTES_IN_DAY ||
      current.startMinute >= current.endMinute
    ) {
      throw new Error("Availability windows must be within the same day.");
    }

    if (i > 0 && current.startMinute < normalized[i - 1].endMinute) {
      throw new Error("Availability windows cannot overlap.");
    }
  }

  return normalized;
}

const availabilityWindowSchema = new mongoose.Schema(
  {
    startMinute: {
      type: Number,
      required: true,
      min: 0,
      max: MINUTES_IN_DAY - 1,
    },
    endMinute: {
      type: Number,
      required: true,
      min: 1,
      max: MINUTES_IN_DAY,
    },
  },
  { _id: false },
);

const weeklyScheduleDaySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    isWorking: {
      type: Boolean,
      default: false,
    },
    windows: {
      type: [availabilityWindowSchema],
      default: [],
    },
  },
  { _id: false },
);

const photographerAvailabilitySchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotographerProfile",
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: "Asia/Kolkata",
      trim: true,
    },
    slotStepMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 5,
      max: 240,
    },
    minSessionMinutes: {
      type: Number,
      required: true,
      default: 60,
      min: 15,
      max: 720,
    },
    maxSessionMinutes: {
      type: Number,
      required: true,
      default: 480,
      min: 15,
      max: 1440,
    },
    defaultSessionMinutes: {
      type: Number,
      required: true,
      default: 120,
      min: 15,
      max: 720,
    },
    bufferBeforeMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 240,
    },
    bufferAfterMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 240,
    },
    minNoticeMinutes: {
      type: Number,
      default: 120,
      min: 0,
      max: 10080,
    },
    maxAdvanceDays: {
      type: Number,
      default: 60,
      min: 1,
      max: 365,
    },
    bookingMode: {
      type: String,
      enum: ["request_only", "instant"],
      default: "request_only",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    vacationMode: {
      type: Boolean,
      default: false,
    },
    vacationFrom: {
      type: String,
      trim: true,
      default: "",
      match: [/^(\d{4}-\d{2}-\d{2})?$/, "vacationFrom must be YYYY-MM-DD"],
    },
    vacationTo: {
      type: String,
      trim: true,
      default: "",
      match: [/^(\d{4}-\d{2}-\d{2})?$/, "vacationTo must be YYYY-MM-DD"],
    },
    vacationNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    weeklySchedule: {
      type: [weeklyScheduleDaySchema],
      default: () => defaultWeeklySchedule.map((day) => ({ ...day })),
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length !== 7) return false;
          const uniqueDays = new Set(value.map((day) => day.dayOfWeek));
          return uniqueDays.size === 7;
        },
        message: "weeklySchedule must contain exactly one entry for each day.",
      },
    },
  },
  { timestamps: true },
);

photographerAvailabilitySchema.pre("validate", function () {
  if (!Array.isArray(this.weeklySchedule)) return;

  this.weeklySchedule = this.weeklySchedule
    .map((day) => ({
      dayOfWeek: Number(day.dayOfWeek),
      isWorking: Boolean(day.isWorking),
      windows: normalizeWindows(day.windows),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  if (
    !Number.isInteger(this.slotStepMinutes) ||
    !Number.isInteger(this.minSessionMinutes) ||
    !Number.isInteger(this.maxSessionMinutes) ||
    !Number.isInteger(this.defaultSessionMinutes)
  ) {
    throw new Error("Availability durations must be whole-minute values.");
  }

  if (this.minSessionMinutes > this.maxSessionMinutes) {
    throw new Error("minSessionMinutes cannot exceed maxSessionMinutes.");
  }

  if (
    this.defaultSessionMinutes < this.minSessionMinutes ||
    this.defaultSessionMinutes > this.maxSessionMinutes
  ) {
    throw new Error(
      "defaultSessionMinutes must be between minSessionMinutes and maxSessionMinutes.",
    );
  }

  for (const day of this.weeklySchedule) {
    if (!day.isWorking) {
      day.windows = [];
      continue;
    }

    if (!day.windows.length) {
      throw new Error("Working days must contain at least one availability window.");
    }
  }
});

export default mongoose.model(
  "PhotographerAvailability",
  photographerAvailabilitySchema,
  "photographer_availability",
);
