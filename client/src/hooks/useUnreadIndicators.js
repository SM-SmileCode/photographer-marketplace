import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUnreadCount as fetchChatUnreadCount } from "../services/chatService";
import { fetchMyNotifications } from "../services/notificationService";

const REFRESH_INTERVAL_MS = 30_000;

function toSafeUnreadCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function isExpectedAuthError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  return status === 401 || status === 403;
}

export function useUnreadIndicators({ includeMessages = true } = {}) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const isMountedRef = useRef(false);

  const refreshUnreadCounts = useCallback(async () => {
    const [notificationsResult, messagesResult] = await Promise.allSettled([
      fetchMyNotifications({ page: 1, limit: 1 }),
      includeMessages ? fetchChatUnreadCount() : Promise.resolve({ unread: 0 }),
    ]);

    if (!isMountedRef.current) return;

    if (notificationsResult.status === "fulfilled") {
      setUnreadNotifications(
        toSafeUnreadCount(notificationsResult.value?.summary?.unreadCount),
      );
    } else if (isExpectedAuthError(notificationsResult.reason)) {
      setUnreadNotifications(0);
    }

    if (messagesResult.status === "fulfilled") {
      setUnreadMessages(toSafeUnreadCount(messagesResult.value?.unread));
    } else if (isExpectedAuthError(messagesResult.reason)) {
      setUnreadMessages(0);
    }
  }, [includeMessages]);

  useEffect(() => {
    isMountedRef.current = true;

    const guardedRefresh = async () => {
      await refreshUnreadCounts();
    };

    guardedRefresh();

    const intervalId = setInterval(guardedRefresh, REFRESH_INTERVAL_MS);
    const onFocus = () => {
      guardedRefresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        guardedRefresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUnreadCounts]);

  return {
    unreadMessages,
    unreadNotifications,
    refreshUnreadCounts,
  };
}
