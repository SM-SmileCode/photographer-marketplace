import mongoose from "mongoose";

const DELIVERY_STATUSES = [
  "event_done",
  "editing",
  "preview_uploaded",
  "final_delivered",
  "customer_confirmed",
];

const urlValidator = {
  validator: (v) => !v || /^https?:\/\/.+/.test(v),
  message: "Invalid URL format",
};

const fileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, validate: urlValidator },
    type: { type: String, enum: ["image", "video", "zip"], required: true },
  },
  { _id: false },
);

const deliveryStatusHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: DELIVERY_STATUSES, default: null },
    toStatus: { type: String, enum: DELIVERY_STATUSES, required: true },
    changedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    changedByRole: {
      type: String,
      enum: ["customer", "photographer", "admin", "system"],
      required: true,
    },
    note: { type: String, trim: true, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const validDeliveryTransitions = {
  event_done: ["editing"],
  editing: ["preview_uploaded"],
  preview_uploaded: ["final_delivered"],
  final_delivered: ["customer_confirmed"],
  customer_confirmed: [],
};
const deliverySchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      required: true,
      index: true,
    },
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotographerProfile",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: DELIVERY_STATUSES,
      default: "event_done",
      index: true,
    },

    deliveryMethod: {
      type: String,
      enum: ["physical", "whatsapp", "drive", "email", "in_app", "other"],
      required: true,
    },

    deliveryMethodNote: { type: String, trim: true, default: "" },
    deliveryLink: {
      type: String,
      trim: true,
      default: "",
      validate: urlValidator,
    },

    previewFiles: {
      type: [fileSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 50,
        message: "Max 50 preview files",
      },
    },
    finalFiles: {
      type: [fileSchema],
      default: [],
      validate: {
        validator: (v) => v.length <= 500,
        message: "Max 500 final files",
      },
    },

    photographerNote: { type: String, trim: true, default: "" },
    customerFeedback: { type: String, trim: true, default: "" },

    previewUploadedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    customerConfirmedAt: { type: Date, default: null },

    statusHistory: { type: [deliveryStatusHistorySchema], default: [] },
  },
  { timestamps: true },
);

deliverySchema.pre("validate", function () {
  if (this.status === "final_delivered" && this.finalFiles.length === 0) {
    throw new Error("Cannot deliver without final files");
  }

  if (this.status !== "customer_confirmed" && this.customerConfirmedAt) {
    this.customerConfirmedAt = null;
  }

  if (this.isModified("status") && !this.isNew) {
    const currentStatus =
      this.statusHistory[this.statusHistory.length - 1]?.toStatus ||
      "event_done";
    const newStatus = this.status;

    if (!validDeliveryTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid delivery transition: ${currentStatus} -> ${newStatus}`,
      );
    }
  }
});

deliverySchema.index({ photographerId: 1, status: 1 });
deliverySchema.index({ customerId: 1, status: 1 });

export default mongoose.model("Delivery", deliverySchema, "deliveries");
