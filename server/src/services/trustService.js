import PhotographerProfile from "../models/photographerProfile.js";
import Review from "../models/review.js";

const DEFAULT_REVERIFICATION_DAYS = 180;
const DEFAULT_ABUSE_REPORT_THRESHOLD = 3;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const REVERIFICATION_INTERVAL_DAYS = Math.max(
  30,
  parsePositiveInt(process.env.PHOTOGRAPHER_REVERIFY_DAYS, DEFAULT_REVERIFICATION_DAYS),
);

const ABUSE_AUTO_FLAG_THRESHOLD = Math.max(
  1,
  parsePositiveInt(
    process.env.TRUST_AUTO_FLAG_REPORT_THRESHOLD,
    DEFAULT_ABUSE_REPORT_THRESHOLD,
  ),
);

function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

export function calculateNextReverificationDueAt(referenceDate = new Date()) {
  return addDays(referenceDate, REVERIFICATION_INTERVAL_DAYS);
}

export async function runPhotographerTrustMaintenance({
  now = new Date(),
} = {}) {
  const current = new Date(now);

  const dueReverificationResult = await PhotographerProfile.updateMany(
    {
      verificationStatus: "approved",
      "trustSignals.nextReverificationDueAt": { $ne: null, $lte: current },
    },
    {
      $set: {
        verificationStatus: "pending",
        "verificationChecklist.humanReviewCompleted": false,
        "verificationChecklist.reviewedById": null,
        "verificationChecklist.reviewedAt": null,
        "trustSignals.verificationLevel": "basic",
        "trustSignals.trustLabel": "Re-verification due",
        "trustSignals.pendingTrustReason": "Periodic re-verification due.",
      },
    },
  );

  const abuseSummary = await Review.aggregate([
    {
      $match: {
        $or: [{ reportCount: { $gt: 0 } }, { status: "flagged" }],
      },
    },
    {
      $group: {
        _id: "$photographerId",
        reportCount: { $sum: { $ifNull: ["$reportCount", 0] } },
        flaggedReviewCount: {
          $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] },
        },
      },
    },
  ]);

  const abuseProfileIds = abuseSummary
    .map((item) => item?._id)
    .filter(Boolean);

  if (abuseSummary.length > 0) {
    await PhotographerProfile.bulkWrite(
      abuseSummary.map((item) => {
        const riskScore = Math.max(
          Number(item.reportCount || 0),
          Number(item.flaggedReviewCount || 0),
        );
        return {
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                "trustSignals.riskFlags": riskScore,
                "trustSignals.lastRiskReviewAt": current,
              },
            },
          },
        };
      }),
      { ordered: false },
    );
  }

  const resetRiskFlagsFilter = {
    "trustSignals.riskFlags": { $ne: 0 },
  };
  if (abuseProfileIds.length > 0) {
    resetRiskFlagsFilter._id = { $nin: abuseProfileIds };
  }

  const resetRiskResult = await PhotographerProfile.updateMany(resetRiskFlagsFilter, {
    $set: { "trustSignals.riskFlags": 0 },
  });

  const abuseCandidateIds = abuseSummary
    .filter(
      (item) =>
        Number(item.reportCount || 0) >= ABUSE_AUTO_FLAG_THRESHOLD ||
        Number(item.flaggedReviewCount || 0) >= ABUSE_AUTO_FLAG_THRESHOLD,
    )
    .map((item) => item._id);

  let autoFlagResult = { modifiedCount: 0 };

  if (abuseCandidateIds.length > 0) {
    autoFlagResult = await PhotographerProfile.updateMany(
      {
        _id: { $in: abuseCandidateIds },
        verificationStatus: "approved",
      },
      {
        $set: {
          verificationStatus: "pending",
          "verificationChecklist.humanReviewCompleted": false,
          "verificationChecklist.reviewedById": null,
          "verificationChecklist.reviewedAt": null,
          "trustSignals.verificationLevel": "basic",
          "trustSignals.trustLabel": "Auto-flagged for abuse reports",
          "trustSignals.pendingTrustReason":
            "Profile auto-flagged due to abuse reports.",
          "trustSignals.lastAutoFlagAt": current,
          "trustSignals.lastAutoFlagReason":
            "Automated abuse-report threshold reached.",
          "trustSignals.lastRiskReviewAt": current,
        },
      },
    );
  }

  return {
    dueForReverification: Number(dueReverificationResult?.modifiedCount || 0),
    abuseRiskProfiles: abuseSummary.length,
    autoFlaggedForAbuse: Number(autoFlagResult?.modifiedCount || 0),
    resetRiskFlags: Number(resetRiskResult?.modifiedCount || 0),
  };
}
