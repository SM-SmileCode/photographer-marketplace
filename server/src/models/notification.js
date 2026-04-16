import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      required: true,
      index: true,
    },
    type: {
      type: String,
      trim: true,
      default: "system",
      index: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },
    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },
    entityType: {
      type: String,
      trim: true,
      default: "",
    },
    entityId: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

notificationSchema.pre("validate", function () {
  if (!this.isRead) {
    this.readAt = null;
    return;
  }

  if (!this.readAt) {
    this.readAt = new Date();
  }
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema, "notifications");
