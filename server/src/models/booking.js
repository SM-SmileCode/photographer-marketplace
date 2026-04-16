import mongoose from "mongoose";

const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "completed",
  "expired",
];

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, enum: BOOKING_STATUSES, default: null },
    toStatus: { type: String, enum: BOOKING_STATUSES, required: true },
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

const pricingAddOnSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    price: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    packageName: { type: String, trim: true, default: "" },
    basePrice: { type: Number, min: 0, default: 0 },
    selectedAddOns: { type: [pricingAddOnSchema], default: [] },
    addOnsTotal: { type: Number, min: 0, default: 0 },
    additionalAmount: { type: Number, min: 0, default: 0 },
    finalAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: "INR" },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },

    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      default: null,
      index: true,
    },

    eventType: { type: String, required: true, trim: true, lowercase: true },
    eventDate: { type: Date, required: true, index: true },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },

    slotName: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    startAtUtc: { type: Date, required: true, index: true },
    endAtUtc: { type: Date, required: true, index: true },

    eventLocation: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator(v) {
            if (!v) return true;
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message: "coordinates must be [lng, lat]",
        },
      },
    },

    customerNote: { type: String, trim: true, default: "" },
    photographerResponseNote: { type: String, trim: true, default: "" },

    deliveryMethod: {
      type: String,
      enum: ["physical", "whatsapp", "drive", "email", "in_app", "other"],
      required: true,
      default: "other",
    },
    deliveryMethodNote: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: "" },
    cancellationReason: { type: String, trim: true, default: "" },
    cancelledBy: {
      type: String,
      enum: ["customer", "photographer", "admin", "system", ""],
      default: "",
    },

    expiresAt: { type: Date, default: null },

    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    statusHistory: { type: [statusHistorySchema], default: [] },

    source: { type: String, enum: ["web", "app", "admin"], default: "web" },
    idempotencyKey: { type: String, trim: true, default: null },
    pricing: { type: pricingSchema, default: undefined },

    payment: {
      status: {
        type: String,
        enum: ["not_required", "pending", "paid", "failed", "refunded"],
        default: "pending",
        index: true,
      },
      orderId: { type: String, trim: true, default: "" },
      paymentId: { type: String, trim: true, default: "" },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      paidAt: { type: Date, default: null },
      refundedAt: { type: Date, default: null },
      refundId: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

const validTransitions = {
  pending: ["accepted", "rejected", "cancelled", "expired"],
  accepted: ["completed", "cancelled", "rejected"],
  rejected: [],
  cancelled: [],
  completed: [],
  expired: [],
};

bookingSchema.pre("validate", function () {
  if (this.isNew && this.status === "pending" && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  if (this.startAtUtc && this.endAtUtc && this.endAtUtc <= this.startAtUtc) {
    throw new Error("endAtUtc must be greater than startAtUtc");
  }

  if (this.isModified("status") && !this.isNew) {
    const currentStatus = this._previousDocumentStatus || null;
    const newStatus = this.status;

    if (
      currentStatus &&
      !validTransitions[currentStatus]?.includes(newStatus)
    ) {
      throw new Error(`Invalid transition: ${currentStatus} -> ${newStatus}`);
    }
  }
});

bookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ photographerId: 1, status: 1, eventDate: 1 });
bookingSchema.index({
  photographerId: 1,
  status: 1,
  startAtUtc: 1,
  endAtUtc: 1,
});
bookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

export default mongoose.model("Booking", bookingSchema, "bookings");
