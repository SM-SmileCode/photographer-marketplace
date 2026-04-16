import mongoose from "mongoose";
import { makeBaseSlug, generateUniqueSlug } from "../utils/slug.js";
import { EVENT_TYPES, SERVICES } from "../config/photographerProfileConfig.js";

const urlValidator = {
  validator: function (v) {
    if (!v) {
      return true;
    }
    return /^https?:\/\/.+/.test(v);
  },
  message: "Invalid URL format",
};

const portfolioImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, validate: urlValidator },
    title: { type: String, trim: true, default: "" },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const photographerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserCollection",
      required: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(v) {
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message: "location.coordinates must be [lng, lat]",
        },
      },
    },
    experienceYears: {
      type: Number,
      min: 0,
      max: 80,
      default: 0,
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: "",
      validate: urlValidator,
    },
    coverImageUrl: {
      type: String,
      trim: true,
      default: "",
      validate: urlValidator,
    },
    portfolioImages: {
      type: [portfolioImageSchema],
      default: [],
    },
    eventTypes: {
      type: [{ type: String, enum: EVENT_TYPES }],
      default: [],
      index: true,
    },
    customEventTypes: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    services: {
      type: [{ type: String, enum: SERVICES }],
      default: [],
      index: true,
    },
    customServices: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
      uppercase: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    avgRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      set: (v) => Math.round(v * 10) / 10,
    },
    totalReviews: {
      type: Number,
      min: 0,
      default: 0,
    },
    ratingSum: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },
    completedBookings: {
      type: Number,
      min: 0,
      default: 0,
    },
    responseTimeMinutes: {
      type: Number,
      min: 0,
      default: null,
    },
    acceptanceRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    serviceRadiusKm: {
      type: Number,
      min: 0,
      default: 0,
    },
    serviceAreas: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    languages: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    instagramUrl: {
      type: String,
      trim: true,
      default: "",
      validate: urlValidator,
    },
    websiteUrl: {
      type: String,
      trim: true,
      default: "",
      validate: urlValidator,
    },
    verificationEvidence: {
      identityDocumentUrl: {
        type: String,
        trim: true,
        default: "",
        validate: urlValidator,
      },
      selfieWithIdUrl: {
        type: String,
        trim: true,
        default: "",
        validate: urlValidator,
      },
      originalSampleFileUrls: {
        type: [
          {
            type: String,
            trim: true,
            validate: urlValidator,
          },
        ],
        default: [],
      },
    },
    verificationChecklist: {
      identityVerified: {
        type: Boolean,
        default: false,
      },
      contactVerified: {
        type: Boolean,
        default: false,
      },
      portfolioVerified: {
        type: Boolean,
        default: false,
      },
      humanReviewCompleted: {
        type: Boolean,
        default: false,
      },
      reviewedById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserCollection",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      adminNote: {
        type: String,
        trim: true,
        default: "",
      },
    },
    trustSignals: {
      verificationLevel: {
        type: String,
        enum: ["none", "basic", "full"],
        default: "none",
      },
      onboardingVerifiedAt: {
        type: Date,
        default: null,
      },
      nextReverificationDueAt: {
        type: Date,
        default: null,
      },
      riskFlags: {
        type: Number,
        min: 0,
        default: 0,
      },
      lastRiskReviewAt: {
        type: Date,
        default: null,
      },
      trustLabel: {
        type: String,
        trim: true,
        default: "",
      },
      pendingTrustReason: {
        type: String,
        trim: true,
        default: "",
      },
      lastAutoFlagAt: {
        type: Date,
        default: null,
      },
      lastAutoFlagReason: {
        type: String,
        trim: true,
        default: "",
      },
    },
    contactVerificationSnapshot: {
      emailVerified: {
        type: Boolean,
        default: false,
      },
      phoneVerified: {
        type: Boolean,
        default: false,
      },
      emailVerifiedAt: {
        type: Date,
        default: null,
      },
      phoneVerifiedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

const syncVerificationFields = (target, status) => {
  target.isVerified = status === "approved";
  target.verifiedAt =
    status === "approved" ? target.verifiedAt || new Date() : null;
  if (status !== "rejected") target.rejectionReason = "";
};

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

const normalizeVerificationEvidence = (value) => {
  if (!isPlainObject(value)) return;
  if (Array.isArray(value.originalSampleFileUrls)) {
    value.originalSampleFileUrls = [
      ...new Set(
        value.originalSampleFileUrls
          .map((item) => String(item).trim())
          .filter(Boolean),
      ),
    ];
  }
};

const getSetBucket = (update) => {
  if (Array.isArray(update)) {
    let stage = update.find((s) => isPlainObject(s) && isPlainObject(s.$set));
    if (!stage) {
      stage = {
        $set: {},
      };
      update.push(stage);
    }
    return { $set: stage.$set, isPipeline: true };
  }
  if (!isPlainObject(update.$set)) update.$set = {};
  return { $set: update.$set, isPipeline: false };
};

photographerProfileSchema.pre("validate", async function () {
  if (
    this.isNew ||
    this.isModified("businessName") ||
    this.isModified("city") ||
    !this.slug
  ) {
    const baseSlug = makeBaseSlug(this.businessName, this.city);
    this.slug = await generateUniqueSlug(this.constructor, baseSlug, this._id);
  }

  if (Array.isArray(this.customEventTypes)) {
    this.customEventTypes = [
      ...new Set(
        this.customEventTypes.map((v) => String(v).trim()).filter(Boolean),
      ),
    ];
  }

  if (Array.isArray(this.customServices)) {
    this.customServices = [
      ...new Set(
        this.customServices.map((v) => String(v).trim()).filter(Boolean),
      ),
    ];
  }
  if (isPlainObject(this.verificationEvidence)) {
    normalizeVerificationEvidence(this.verificationEvidence);
  }
  syncVerificationFields(this, this.verificationStatus);
});
photographerProfileSchema.pre("insertMany", async function (docs) {
  for (const doc of docs) {
    if (!doc.slug) {
      const baseSlug = makeBaseSlug(doc.businessName, doc.city);
      doc.slug = await generateUniqueSlug(this, baseSlug, doc._id);
    }

    if (Array.isArray(doc.customEventTypes)) {
      doc.customEventTypes = [
        ...new Set(
          doc.customEventTypes.map((v) => String(v).trim()).filter(Boolean),
        ),
      ];
    }

    if (Array.isArray(doc.customServices)) {
      doc.customServices = [
        ...new Set(
          doc.customServices.map((v) => String(v).trim()).filter(Boolean),
        ),
      ];
    }
    if (isPlainObject(doc.verificationEvidence)) {
      normalizeVerificationEvidence(doc.verificationEvidence);
    }
    const status = doc.verificationStatus || "pending";
    syncVerificationFields(doc, status);
  }
});

photographerProfileSchema.pre(
  ["findOneAndUpdate", "updateOne"],
  async function () {
    const update = this.getUpdate();
    if (!update) return;

    const { $set, isPipeline } = getSetBucket(update);

    const incomingBusinessName = isPipeline
      ? $set.businessName
      : ($set.businessName ?? update.businessName);

    const incomingCity = isPipeline ? $set.city : ($set.city ?? update.city);

    if (incomingBusinessName || incomingCity) {
      const current = await this.model
        .findOne(this.getQuery())
        .select("_id businessName city");

      if (current) {
        const finalBusinessName = incomingBusinessName ?? current.businessName;
        const finalCity = incomingCity ?? current.city;
        const baseSlug = makeBaseSlug(finalBusinessName, finalCity);
        $set.slug = await generateUniqueSlug(this.model, baseSlug, current._id);
      }
    }
    if (Object.prototype.hasOwnProperty.call($set, "customEventTypes")) {
      $set.customEventTypes = [
        ...new Set(
          ($set.customEventTypes || [])
            .map((v) => String(v).trim())
            .filter(Boolean),
        ),
      ];
    } else if (
      !isPipeline &&
      Object.prototype.hasOwnProperty.call(update, "customEventTypes")
    ) {
      $set.customEventTypes = [
        ...new Set(
          (update.customEventTypes || [])
            .map((v) => String(v).trim())
            .filter(Boolean),
        ),
      ];
      delete update.customEventTypes;
    }

    if (Object.prototype.hasOwnProperty.call($set, "customServices")) {
      $set.customServices = [
        ...new Set(
          ($set.customServices || [])
            .map((v) => String(v).trim())
            .filter(Boolean),
        ),
      ];
    } else if (
      !isPipeline &&
      Object.prototype.hasOwnProperty.call(update, "customServices")
    ) {
      $set.customServices = [
        ...new Set(
          (update.customServices || [])
            .map((v) => String(v).trim())
            .filter(Boolean),
        ),
      ];
      delete update.customServices;
    }

    if (Object.prototype.hasOwnProperty.call($set, "verificationEvidence")) {
      normalizeVerificationEvidence($set.verificationEvidence);
    } else if (
      !isPipeline &&
      Object.prototype.hasOwnProperty.call(update, "verificationEvidence")
    ) {
      normalizeVerificationEvidence(update.verificationEvidence);
      $set.verificationEvidence = update.verificationEvidence;
      delete update.verificationEvidence;
    }

    const nextStatus = isPipeline
      ? $set.verificationStatus
      : ($set.verificationStatus ?? update.verificationStatus);

    if (typeof nextStatus === "string") {
      $set.verificationStatus = nextStatus;
      $set.isVerified = nextStatus === "approved";
      $set.verifiedAt = nextStatus === "approved" ? new Date() : null;
      if (nextStatus !== "rejected") $set.rejectionReason = "";
    }

    this.setUpdate(update);
  },
);
// indexes
photographerProfileSchema.index({ location: "2dsphere" });

photographerProfileSchema.index({
  verificationStatus: 1,
  isFeatured: 1,
  startingPrice: 1,
  isActive: 1,
});

photographerProfileSchema.index({
  businessName: "text",
  bio: "text",
  city: "text",
  state: "text",
});

export default mongoose.model(
  "PhotographerProfile",
  photographerProfileSchema,
  "photographer_profile",
);
