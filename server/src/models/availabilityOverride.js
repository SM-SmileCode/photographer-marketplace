import mongoose from "mongoose";

const MINUTES_IN_DAY = 24 * 60;

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
      throw new Error("Override windows must use whole-minute values.");
    }

    if (
      current.startMinute < 0 ||
      current.endMinute > MINUTES_IN_DAY ||
      current.startMinute >= current.endMinute
    ) {
      throw new Error("Override windows must be within the same day.");
    }

    if (i > 0 && current.startMinute < normalized[i - 1].endMinute) {
      throw new Error("Override windows cannot overlap.");
    }
  }

  return normalized;
}

const overrideWindowSchema = new mongoose.Schema(
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

const availabilityOverrideSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotographerProfile",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    mode: {
      type: String,
      enum: ["blocked", "custom_windows"],
      required: true,
    },
    windows: {
      type: [overrideWindowSchema],
      default: [],
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    source: {
      type: String,
      enum: ["photographer", "admin", "system"],
      default: "photographer",
    },
  },
  { timestamps: true },
);

availabilityOverrideSchema.pre("validate", function () {
  this.windows = normalizeWindows(this.windows);

  if (this.mode === "blocked") {
    this.windows = [];
  }

  if (this.mode === "custom_windows" && !this.windows.length) {
    throw new Error("custom_windows overrides must contain at least one window.");
  }
});

availabilityOverrideSchema.index(
  { photographerId: 1, date: 1 },
  { unique: true },
);

export default mongoose.model(
  "AvailabilityOverride",
  availabilityOverrideSchema,
  "availability_overrides",
);
