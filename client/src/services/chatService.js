import { io } from "socket.io-client";
import { SAFE_API_URL, apiCall, parseResponse } from "./apiClient";

const SOCKET_URL = SAFE_API_URL;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export async function fetchChatHistory(bookingId) {
  const res = await apiCall(`${SAFE_API_URL}/chat/${bookingId}/messages`);
  return parseResponse(res, "Failed to fetch chat history.");
}

export async function markChatRead(bookingId) {
  const res = await apiCall(`${SAFE_API_URL}/chat/${bookingId}/read`, { method: "PATCH" });
  return parseResponse(res, "Failed to mark messages read.");
}

export async function fetchUnreadCount() {
  const res = await apiCall(`${SAFE_API_URL}/chat/unread-count`);
  return parseResponse(res, "Failed to fetch unread count.");
}
