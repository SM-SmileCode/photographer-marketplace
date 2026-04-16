import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["customer", "photographer", "admin"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserCollection" }],
  },
  { timestamps: true },
);

messageSchema.index({ bookingId: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema, "messages");
