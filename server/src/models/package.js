import mongoose from "mongoose";

const addOnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxLength: 100 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const packageSchema = new mongoose.Schema(
  {
    photographerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhotographerProfile",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, maxLength: 100 },
    description: { type: String, trim: true, default: "", maxLength: 1000 },

    basePrice: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      trim: true,
      default: "INR",
      uppercase: true,
      maxLength: 3,
    },

    hoursIncluded: { type: Number, required: true, min: 0.5, max: 24 },
    photosIncluded: { type: Number, min: 0, default: null },
    deliveryDays: { type: Number, required: true, min: 1, max: 365 },

    includes: {
      type: [{ type: String, trim: true, maxLength: 100 }],
      default: [],
    },

    addOns: { type: [addOnSchema], default: [] },

    extraHourPrice: { type: Number, min: 0, default: null },
    travelCostPerKm: { type: Number, min: 0, default: null },

    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  },
);

packageSchema.pre("save", function () {
  if (this.isModified("includes")) {
    this.includes = [
      ...new Set(this.includes.map((v) => v.trim()).filter(Boolean)),
    ];
  }
});

packageSchema.index({ photographerId: 1, isActive: 1 });
packageSchema.index({ photographerId: 1, createdAt: 1 });

export default mongoose.model("Package", packageSchema, "packages")