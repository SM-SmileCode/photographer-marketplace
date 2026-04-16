import { saveSubscription, removeSubscription } from "../services/pushService.js";

export async function subscribePush(req, res) {
  try {
    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription object." });
    }
    await saveSubscription(req.user.userId, subscription);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save subscription." });
  }
}

export async function unsubscribePush(req, res) {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint is required." });
    await removeSubscription(req.user.userId, endpoint);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to remove subscription." });
  }
}

export function getVapidPublicKey(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: "Push not configured." });
  return res.status(200).json({ publicKey: key });
}
