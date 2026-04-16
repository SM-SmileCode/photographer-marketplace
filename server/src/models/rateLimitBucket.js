import mongoose from "mongoose";

const rateLimitBucketSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: false },
);

rateLimitBucketSchema.index({ key: 1, windowStart: 1 }, { unique: true });

export default mongoose.model(
  "RateLimitBucket",
  rateLimitBucketSchema,
  "rate_limit_buckets",
);
