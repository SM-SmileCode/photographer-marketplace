import { useEffect, useState } from "react";
import {
  registerPushSubscription,
  unregisterPushSubscription,
  isPushSupported,
  getPushPermission,
} from "../services/pushService";

function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getPushPermission());
  }, []);

  if (!supported) return null;

  const isEnabled = permission === "granted";

  const handleToggle = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (isEnabled) {
        await unregisterPushSubscription();
        setMessage("Push notifications disabled.");
        setPermission("default");
      } else {
        await registerPushSubscription();
        setPermission(getPushPermission());
        setMessage("Push notifications enabled.");
      }
    } catch (err) {
      setMessage(err?.message || "Failed to update push notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-3">
        <div
          onClick={!loading ? handleToggle : undefined}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            isEnabled ? "bg-[var(--accent)]" : "bg-[var(--line)]"
          } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            isEnabled ? "translate-x-5" : ""
          }`} />
        </div>
        <span className="text-sm font-semibold text-[var(--text)]">
          {loading ? "Updating..." : isEnabled ? "Push notifications ON" : "Push notifications OFF"}
        </span>
      </label>
      {message && <p className="text-xs text-[var(--muted)]">{message}</p>}
      {permission === "denied" && (
        <p className="text-xs text-red-600">Notifications blocked in browser settings.</p>
      )}
    </div>
  );
}

export default PushNotificationToggle;
