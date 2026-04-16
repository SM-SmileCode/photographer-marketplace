import webpush from "web-push";
import PushSubscription from "../models/pushSubscription.js";

let initialized = false;

function initWebPush() {
  if (initialized) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:admin@shotsphere.local";
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(email, publicKey, privateKey);
  initialized = true;
}

export async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  await PushSubscription.findOneAndUpdate(
    { userId, endpoint },
    { userId, endpoint, keys },
    { upsert: true, runValidators: true },
  );
}

export async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ userId, endpoint });
}

export async function sendPushToUser(userId, payload) {
  initWebPush();
  if (!initialized) return;

  const subscriptions = await PushSubscription.find({ userId }).lean();
  const dead = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload),
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          dead.push(sub._id);
        }
      }
    }),
  );

  if (dead.length) {
    await PushSubscription.deleteMany({ _id: { $in: dead } });
  }
}
