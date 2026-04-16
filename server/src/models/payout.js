import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotographerProfile",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed"],
      default: "pending",
      index: true,
    },
    note: { type: String, trim: true, default: "" },
    paidAt: { type: Date, default: null },
    processedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      default: null,
    },
    bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Booking" }],
  },
  { timestamps: true },
);

export default mongoose.model("Payout", payoutSchema, "payouts");
