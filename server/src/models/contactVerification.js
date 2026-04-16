import mongoose from "mongoose";

const contactVerificationSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["email", "phone"],
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["signup", "update_email", "update_phone"],
      required: true,
      index: true,
    },
    targetValue: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      default: null,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      min: 1,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },
    requestMeta: {
      ip: { type: String, trim: true, default: "" },
      userAgent: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true },
);

contactVerificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

contactVerificationSchema.index({
  channel: 1,
  purpose: 1,
  targetValue: 1,
  userId: 1,
  consumedAt: 1,
  createdAt: -1,
});

export default mongoose.model(
  "ContactVerification",
  contactVerificationSchema,
  "contact_verifications",
);
