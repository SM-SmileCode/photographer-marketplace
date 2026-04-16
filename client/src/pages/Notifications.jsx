import { useEffect, useState } from "react";
import {
  fetchMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "../services/notificationService";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function Notifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyNotifications({
        page: 1,
        limit: 50,
        unreadOnly: onlyUnread ? "true" : "",
      });
      setItems(data?.items || []);
      setUnreadCount(Number(data?.summary?.unreadCount || 0));
    } catch (loadError) {
      setError(loadError?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnread]);

  const handleMarkRead = async (notificationId) => {
    setBusy(true);
    setError("");
    try {
      await markMyNotificationRead(notificationId);
      await loadNotifications();
    } catch (readError) {
      setError(readError?.message || "Failed to mark notification as read.");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    setError("");
    try {
      await markAllMyNotificationsRead();
      await loadNotifications();
    } catch (readAllError) {
      setError(readAllError?.message || "Failed to mark notifications as read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                Notifications
              </p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                Your Updates
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Unread notifications: {unreadCount}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyUnread((prev) => !prev)}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#F2EEDF]"
              >
                {onlyUnread ? "Show all" : "Show unread"}
              </button>
              <button
                type="button"
                disabled={busy || unreadCount === 0}
                onClick={handleMarkAllRead}
                className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                Mark all read
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading notifications...</p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
            No notifications found.
          </p>
        ) : null}

        {!loading &&
          items.map((notification) => (
            <article
              key={notification._id}
              className={`rounded-2xl border p-4 ${
                notification.isRead
                  ? "border-[var(--line)] bg-[var(--surface)]"
                  : "border-[#A7D8D3] bg-[#F0FBF9]"
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">
                    {notification.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMarkRead(notification._id)}
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}

export default Notifications;
