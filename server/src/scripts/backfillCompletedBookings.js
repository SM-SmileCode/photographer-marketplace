import "dotenv/config";
import connectDB from "../config/db.js";
import Booking from "../models/booking.js";
import PhotographerProfile from "../models/photographerProfile.js";

async function run() {
  await connectDB();

  const profiles = await PhotographerProfile.find().select("_id").lean();

  let updated = 0;
  for (const profile of profiles) {
    const count = await Booking.countDocuments({
      photographerId: profile._id,
      status: "completed",
    });

    await PhotographerProfile.findByIdAndUpdate(profile._id, {
      $set: { completedBookings: count },
    });

    updated += 1;
  }

  console.log(`[backfill:completedBookings] updated ${updated} profiles`);
  process.exit(0);
}

run().catch((error) => {
  console.error("[backfill:completedBookings] failed", error);
  process.exit(1);
});
