import "dotenv/config";
import connectDB from "../config/db.js";
import { backfillAllPhotographerReviewStats } from "../services/reviewService.js";

async function run() {
  const startedAt = Date.now();
  await connectDB();

  const result = await backfillAllPhotographerReviewStats({
    batchSize: Number(process.env.REVIEW_STATS_BACKFILL_BATCH_SIZE || 500),
  });

  const durationMs = Date.now() - startedAt;
  console.log("[review-stats-backfill] completed", {
    ...result,
    durationMs,
  });
  process.exit(0);
}

run().catch((error) => {
  console.error("[review-stats-backfill] failed", error);
  process.exit(1);
});
