import crypto from "crypto";
import Razorpay from "razorpay";
import Booking from "../models/booking.js";
import PhotographerProfile from "../models/photographerProfile.js";

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.includes("xxxxxxx")) {
    throw { status: 503, message: "Payment gateway not configured." };
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function resolveAmount(booking) {
  const pricingAmount = Number(booking?.pricing?.finalAmount);
  if (Number.isFinite(pricingAmount) && pricingAmount > 0) {
    return {
      amount: pricingAmount,
      currency: booking?.pricing?.currency || booking?.payment?.currency || booking?.packageId?.currency || booking?.photographerId?.currency || "INR",
    };
  }

  const paymentAmount = Number(booking?.payment?.amount);
  if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
    return {
      amount: paymentAmount,
      currency: booking?.payment?.currency || booking?.packageId?.currency || booking?.photographerId?.currency || "INR",
    };
  }

  const packageAmount = Number(booking?.packageId?.basePrice);
  if (Number.isFinite(packageAmount) && packageAmount > 0) {
    return {
      amount: packageAmount,
      currency: booking?.packageId?.currency || booking?.photographerId?.currency || "INR",
    };
  }

  const profileStartingPrice = Number(booking?.photographerId?.startingPrice);
  if (Number.isFinite(profileStartingPrice) && profileStartingPrice > 0) {
    return {
      amount: profileStartingPrice,
      currency: booking?.photographerId?.currency || "INR",
    };
  }

  return {
    amount: 0,
    currency: booking?.payment?.currency || booking?.packageId?.currency || booking?.photographerId?.currency || "INR",
  };
}

export async function createPaymentOrder(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { bookingId } = req.params;

    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.user.userId,
      status: "accepted",
    })
      .populate("packageId", "basePrice currency name")
      .populate("photographerId", "startingPrice currency")
      .lean();

    if (!booking) {
      return res.status(404).json({ error: "Booking not found or not accepted." });
    }

    if (booking.payment?.status === "paid") {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        paymentId: booking.payment.paymentId,
      });
    }

    const { amount, currency } = (() => {
      const resolved = resolveAmount(booking);
      if (resolved.amount > 0) return resolved;

      const custom = Number(req.body?.customAmount);
      if (Number.isFinite(custom) && custom > 0) {
        return {
          amount: custom,
          currency: booking?.payment?.currency || booking?.photographerId?.currency || "INR",
        };
      }
      return resolved;
    })();
    if (amount <= 0) {
      return res.status(400).json({ error: "No payable amount found. Please enter the amount agreed with the photographer." });
    }

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: booking.bookingCode,
      notes: { bookingId: String(booking._id), bookingCode: booking.bookingCode },
    });

    await Booking.findByIdAndUpdate(bookingId, {
      $set: {
        "payment.orderId": order.id,
        "payment.amount": amount,
        "payment.currency": currency,
        "payment.status": "pending",
      },
    });

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingCode: booking.bookingCode,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Failed to create payment order." });
  }
}

export async function verifyPayment(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { bookingId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.includes("xxxxxxx")) {
      return res.status(503).json({ error: "Payment gateway not configured." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await Booking.findOneAndUpdate(
        { _id: bookingId, customerId: req.user.userId },
        { $set: { "payment.status": "failed" } },
      );
      return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, customerId: req.user.userId },
      {
        $set: {
          "payment.status": "paid",
          "payment.paymentId": razorpay_payment_id,
          "payment.orderId": razorpay_order_id,
          "payment.paidAt": new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Payment verification failed." });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const { bookingId } = req.params;
    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.user.userId,
    })
      .select("payment bookingCode status")
      .populate("packageId", "basePrice currency name")
      .populate("photographerId", "startingPrice currency")
      .lean();

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const { amount, currency } = resolveAmount(booking);

    return res.status(200).json({
      payment: booking.payment || {},
      bookingCode: booking.bookingCode,
      bookingStatus: booking.status,
      amount,
      currency,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch payment status." });
  }
}

export async function getPhotographerPaymentSummary(req, res) {
  try {
    if (!req.user || req.user.role !== "photographer") {
      return res.status(403).json({ error: "forbidden" });
    }

    const profile = await PhotographerProfile.findOne({ userId: req.user.userId })
      .select("_id currency")
      .lean();

    if (!profile) {
      return res.status(404).json({ error: "Photographer profile not found." });
    }

    const bookings = await Booking.find({
      photographerId: profile._id,
      "payment.status": "paid",
    })
      .select("payment bookingCode completedAt eventDate")
      .lean();

    const totalPaid = bookings.reduce((sum, b) => sum + (b.payment?.amount || 0), 0);
    const paidCount = bookings.length;

    return res.status(200).json({
      totalPaid: Math.round(totalPaid),
      paidCount,
      currency: profile.currency || "INR",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch payment summary." });
  }
}
