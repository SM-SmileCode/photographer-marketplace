import { useEffect, useRef, useState, useCallback } from "react";
import { Send } from "lucide-react";
import { connectSocket, fetchChatHistory, markChatRead } from "../services/chatService";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function toChatErrorMessage(rawMessage) {
  const text = String(rawMessage || "").toLowerCase();
  if (text.includes("forbidden") || text.includes("unauthorized")) {
    return "You do not have access to this booking chat.";
  }
  return rawMessage || "Failed to load messages.";
}

function BookingChat({ bookingId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!bookingId) return;

    let alive = true;
    let socket = null;
    setLoading(true);
    setError("");
    setMessages([]);

    (async () => {
      try {
        const data = await fetchChatHistory(bookingId);
        if (!alive) return;
        setMessages(data.messages || []);
        await markChatRead(bookingId).catch(() => {});

        socket = connectSocket();
        socketRef.current = socket;

        socket.emit("join_booking_chat", { bookingId });

        socket.on("new_message", (msg) => {
          setMessages((prev) => [...prev, msg]);
          markChatRead(bookingId).catch(() => {});
        });

        socket.on("error", (err) => setError(toChatErrorMessage(err?.message || "Socket error.")));
      } catch (err) {
        if (!alive) return;
        setError(toChatErrorMessage(err?.message));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (socket) {
        socket.emit("leave_booking_chat", { bookingId });
        socket.off("new_message");
        socket.off("error");
      }
    };
  }, [bookingId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const isAccessDenied = error === "You do not have access to this booking chat.";

  const handleSend = (e) => {
    e.preventDefault();
    if (isAccessDenied) return;
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current) return;
    socketRef.current.emit("send_message", { bookingId, text: trimmed });
    setText("");
  };

  if (loading) return <p className="text-sm text-[var(--muted)] p-4">Loading messages...</p>;

  return (
    <div className="flex flex-col h-[480px] rounded-2xl border border-[var(--line)] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--line)] bg-[var(--surface)]">
        <p className="text-sm font-semibold text-[var(--text)]">Booking Chat</p>
        <p className="text-xs text-[var(--muted)]">Messages are private to this booking.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center mt-8">No messages yet. Start the conversation.</p>
        ) : null}
        {messages.map((msg, index) => {
          const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUserId);
          const messageKey =
            msg._id ||
            `${String(msg.senderId?._id || msg.senderId || "unknown")}-${String(msg.createdAt || "")}-${index}`;
          return (
            <div key={messageKey} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                isMe
                  ? "bg-[var(--accent)] text-white rounded-br-sm"
                  : "bg-[#F5F2EA] text-[var(--text)] rounded-bl-sm"
              }`}>
                {!isMe && (
                  <p className="text-xs font-semibold mb-1 opacity-70">
                    {msg.senderId?.name || "User"}
                  </p>
                )}
                <p className="leading-relaxed">{msg.text}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-white/70 text-right" : "text-[var(--muted)]"}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 py-2 text-xs text-red-600">{error}</p> : null}

      <form onSubmit={handleSend} className="px-4 py-3 border-t border-[var(--line)] flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isAccessDenied
              ? "You cannot send messages in this booking."
              : "Type a message..."
          }
          disabled={isAccessDenied}
          className="flex-1 rounded-full border border-[var(--line)] bg-[#F5F2EA] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!text.trim() || isAccessDenied}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          <Send size={16} strokeWidth={2.2} />
        </button>
      </form>
    </div>
  );
}

export default BookingChat;
