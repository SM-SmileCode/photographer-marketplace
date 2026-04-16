import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true },
);

wishlistSchema.index({ customerId: 1, photographerId: 1 }, { unique: true });
wishlistSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("Wishlist", wishlistSchema, "wishlists");
