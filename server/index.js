import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import connectDB from "./src/config/db.js";
import UserRoutes from "./src/routes/UserRoutes.js";
import PhotographersProfileRoutes from "./src/routes/photographerRoutes.js";
import uploadRoute from "./src/routes/uploadRoute.js";
import bookingRoutes from "./src/routes/bookingRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import payoutRoutes from "./src/routes/payoutRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import wishlistRoutes from "./src/routes/wishlistRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import pushRoutes from "./src/routes/pushRoutes.js";
import Message from "./src/models/message.js";
import Booking from "./src/models/booking.js";
import PhotographerProfile from "./src/models/photographerProfile.js";
import { backfillAllPhotographerReviewStats } from "./src/services/reviewService.js";

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_DEV,
  "http://localhost:5173",
  "http://localhost:4173",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

app.use(cookieParser());
app.use(cors(corsOptions));
const PORT = process.env.PORT || 4000;
app.use(express.json());

app.use("/", UserRoutes);
app.use("/", PhotographersProfileRoutes);
app.use("/", uploadRoute);
app.use("/", bookingRoutes);
app.use("/", paymentRoutes);
app.use("/", payoutRoutes);
app.use("/", notificationRoutes);
app.use("/", adminRoutes);
app.use("/", wishlistRoutes);
app.use("/", chatRoutes);
app.use("/", pushRoutes);

// Socket.io setup
const io = new SocketServer(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
      ?.split(";")
      .find((c) => c.trim().startsWith("auth_token="))
      ?.split("=")[1];

    if (!token) return next(new Error("unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded.userId);
    socket.userRole = decoded.role;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

async function canAccessChat(userId, role, bookingId) {
  const booking = await Booking.findById(bookingId).select("customerId photographerId").lean();
  if (!booking) return false;
  if (role === "customer") return String(booking.customerId) === userId;
  if (role === "photographer") {
    const profile = await PhotographerProfile.findOne({ userId }).select("_id").lean();
    if (!profile) return false;
    return String(booking.photographerId) === String(profile._id);
  }
  return role === "admin";
}

io.on("connection", (socket) => {
  socket.on("join_booking_chat", async ({ bookingId }) => {
    try {
      const allowed = await canAccessChat(socket.userId, socket.userRole, bookingId);
      if (!allowed) return socket.emit("error", { message: "forbidden" });
      socket.join(`booking:${bookingId}`);
    } catch {
      socket.emit("error", { message: "Failed to join chat." });
    }
  });

  socket.on("send_message", async ({ bookingId, text }) => {
    try {
      const allowed = await canAccessChat(socket.userId, socket.userRole, bookingId);
      if (!allowed) return socket.emit("error", { message: "forbidden" });

      const safeText = String(text || "").trim().slice(0, 2000);
      if (!safeText) return;

      const message = await Message.create({
        bookingId,
        senderId: socket.userId,
        senderRole: socket.userRole,
        text: safeText,
        readBy: [socket.userId],
      });

      const populated = await Message.findById(message._id)
        .populate("senderId", "name profileImageUrl")
        .lean();

      io.to(`booking:${bookingId}`).emit("new_message", populated);
    } catch {
      socket.emit("error", { message: "Failed to send message." });
    }
  });

  socket.on("leave_booking_chat", ({ bookingId }) => {
    socket.leave(`booking:${bookingId}`);
  });
});

connectDB().then(async () => {
  if (process.env.BACKFILL_REVIEW_STATS_ON_BOOT === "true") {
    try {
      const result = await backfillAllPhotographerReviewStats({
        batchSize: Number(process.env.REVIEW_STATS_BACKFILL_BATCH_SIZE || 500),
      });
      console.log("[review-stats-backfill:on-boot] completed", result);
    } catch (error) {
      console.error("[review-stats-backfill:on-boot] failed", error);
      if (process.env.BACKFILL_REVIEW_STATS_FAIL_OPEN !== "true") process.exit(1);
    }
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
