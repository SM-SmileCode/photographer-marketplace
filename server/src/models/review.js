import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },
    deliveryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
      unique: true,
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["published", "flagged", "hidden"],
      default: "published",
      index: true,
    },
    reportCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    reportedByIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "UserCollection",
        },
      ],
      default: [],
    },
    moderationNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    hiddenByRole: {
      type: String,
      enum: ["admin", "system", null],
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
      index: true,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ photographerId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, createdAt: -1 });
reviewSchema.index({ customerId: 1, bookingId: 1 }, { unique: true });
reviewSchema.index({ photographerId: 1, status: 1, createdAt: -1 });

reviewSchema.pre("validate", function () {
  if (this.status !== "hidden") {
    this.hiddenAt = null;
    this.hiddenByRole = null;
  }
});

export default mongoose.model("Review", reviewSchema, "reviews");
