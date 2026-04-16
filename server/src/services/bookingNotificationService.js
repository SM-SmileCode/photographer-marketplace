import Booking from "../models/booking.js";
import Delivery from "../models/delivery.js";
import PhotographerProfile from "../models/photographerProfile.js";
import UserCollection from "../models/UserModel.js";
import { notifyUser } from "./notificationService.js";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function resolveActors({ customerId, photographerId }) {
  const [customer, photographerProfile] = await Promise.all([
    UserCollection.findById(customerId).select("_id name email").lean(),
    PhotographerProfile.findById(photographerId)
      .select("_id userId businessName")
      .lean(),
  ]);

  const photographerUser = photographerProfile?.userId
    ? await UserCollection.findById(photographerProfile.userId)
        .select("_id name email")
        .lean()
    : null;

  return {
    customer,
    photographerProfile,
    photographerUser,
  };
}

async function resolveBookingContext(bookingInput) {
  const booking =
    bookingInput && bookingInput._id
      ? bookingInput
      : await Booking.findById(bookingInput)
          .select("_id bookingCode customerId photographerId eventType eventDate status")
          .lean();

  if (!booking) return null;

  const actors = await resolveActors({
    customerId: booking.customerId,
    photographerId: booking.photographerId,
  });

  return { booking, ...actors };
}

async function resolveDeliveryContext(deliveryInput) {
  const delivery =
    deliveryInput && deliveryInput._id
      ? deliveryInput
      : await Delivery.findById(deliveryInput)
          .select("_id bookingId customerId photographerId status")
          .lean();

  if (!delivery) return null;

  const [bookingContext, actors] = await Promise.all([
    Booking.findById(delivery.bookingId)
      .select("_id bookingCode eventType eventDate")
      .lean(),
    resolveActors({
      customerId: delivery.customerId,
      photographerId: delivery.photographerId,
    }),
  ]);

  return {
    delivery,
    booking: bookingContext,
    ...actors,
  };
}

export async function notifyBookingCreated(bookingInput) {
  const context = await resolveBookingContext(bookingInput);
  if (!context) return;

  const { booking, customer, photographerUser, photographerProfile } = context;
  const customerName = customer?.name || "A customer";
  const eventDateText = formatDate(booking.eventDate) || "the selected date";
  const businessName = photographerProfile?.businessName || "your profile";

  if (photographerUser?._id) {
    const title = "New booking request";
    const message = `${customerName} requested ${booking.eventType} on ${eventDateText}.`;

    await notifyUser({
      userId: photographerUser._id,
      email: photographerUser.email || "",
      type: "booking_created",
      title,
      message,
      entityType: "booking",
      entityId: String(booking._id),
      metadata: { bookingCode: booking.bookingCode },
      emailSubject: `New booking request (${booking.bookingCode})`,
      emailText: `${message}\nBooking code: ${booking.bookingCode}`,
    });
  }

  if (customer?._id) {
    const title = "Booking request submitted";
    const message = `Your request for ${businessName} has been submitted.`;

    await notifyUser({
      userId: customer._id,
      email: customer.email || "",
      type: "booking_submitted",
      title,
      message,
      entityType: "booking",
      entityId: String(booking._id),
      metadata: { bookingCode: booking.bookingCode },
      emailSubject: `Booking request submitted (${booking.bookingCode})`,
      emailText: `${message}\nBooking code: ${booking.bookingCode}`,
    });
  }
}

export async function notifyBookingResponded(bookingInput) {
  const context = await resolveBookingContext(bookingInput);
  if (!context) return;

  const { booking, customer, photographerProfile } = context;
  if (!customer?._id) return;

  const isAccepted = booking.status === "accepted";
  const businessName = photographerProfile?.businessName || "Photographer";
  const title = isAccepted ? "Booking accepted" : "Booking update";
  const message = isAccepted
    ? `${businessName} accepted your booking request.`
    : `${businessName} updated your booking request to "${booking.status}".`;

  await notifyUser({
    userId: customer._id,
    email: customer.email || "",
    type: "booking_response",
    title,
    message,
    entityType: "booking",
    entityId: String(booking._id),
    metadata: { bookingCode: booking.bookingCode, status: booking.status },
    emailSubject: `${title} (${booking.bookingCode})`,
    emailText: `${message}\nBooking code: ${booking.bookingCode}`,
  });
}

export async function notifyBookingCancelledByCustomer(bookingInput) {
  const context = await resolveBookingContext(bookingInput);
  if (!context) return;

  const { booking, customer, photographerUser } = context;
  if (!photographerUser?._id) return;

  const customerName = customer?.name || "The customer";
  const title = "Booking cancelled";
  const message = `${customerName} cancelled booking ${booking.bookingCode}.`;

  await notifyUser({
    userId: photographerUser._id,
    email: photographerUser.email || "",
    type: "booking_cancelled",
    title,
    message,
    entityType: "booking",
    entityId: String(booking._id),
    metadata: { bookingCode: booking.bookingCode },
    emailSubject: `${title} (${booking.bookingCode})`,
    emailText: message,
  });
}

export async function notifyBookingCompleted(bookingInput) {
  const context = await resolveBookingContext(bookingInput);
  if (!context) return;

  const { booking, customer } = context;
  if (!customer?._id) return;

  const title = "Event marked completed";
  const message = `Your event is marked completed. Delivery processing has started.`;

  await notifyUser({
    userId: customer._id,
    email: customer.email || "",
    type: "booking_completed",
    title,
    message,
    entityType: "booking",
    entityId: String(booking._id),
    metadata: { bookingCode: booking.bookingCode },
    emailSubject: `${title} (${booking.bookingCode})`,
    emailText: `${message}\nBooking code: ${booking.bookingCode}`,
  });
}

function getDeliveryStatusMessage(status) {
  if (status === "editing") {
    return {
      title: "Delivery update: Editing started",
      message: "Your photographer has started editing your event media.",
    };
  }
  if (status === "preview_uploaded") {
    return {
      title: "Delivery update: Preview uploaded",
      message: "Preview files are now available for your review.",
    };
  }
  if (status === "final_delivered") {
    return {
      title: "Delivery update: Final delivery ready",
      message: "Final media files have been delivered.",
    };
  }
  if (status === "customer_confirmed") {
    return {
      title: "Delivery confirmed",
      message: "Delivery has been confirmed by customer.",
    };
  }
  return {
    title: "Delivery update",
    message: `Delivery moved to "${status}".`,
  };
}

export async function notifyDeliveryStatusChanged(deliveryInput) {
  const context = await resolveDeliveryContext(deliveryInput);
  if (!context) return;

  const { delivery, booking, customer } = context;
  if (!customer?._id) return;

  const statusMessage = getDeliveryStatusMessage(delivery.status);
  await notifyUser({
    userId: customer._id,
    email: customer.email || "",
    type: "delivery_status_updated",
    title: statusMessage.title,
    message: statusMessage.message,
    entityType: "delivery",
    entityId: String(delivery._id),
    metadata: {
      bookingCode: booking?.bookingCode || "",
      status: delivery.status,
    },
    emailSubject: `${statusMessage.title} (${booking?.bookingCode || "delivery"})`,
    emailText: `${statusMessage.message}\nBooking code: ${booking?.bookingCode || "-"}`,
  });
}

export async function notifyDeliveryConfirmedByCustomer(deliveryInput) {
  const context = await resolveDeliveryContext(deliveryInput);
  if (!context) return;

  const { delivery, booking, customer, photographerUser } = context;
  if (!photographerUser?._id) return;

  const customerName = customer?.name || "Customer";
  const title = "Delivery confirmed by customer";
  const message = `${customerName} confirmed delivery for booking ${booking?.bookingCode || ""}.`;

  await notifyUser({
    userId: photographerUser._id,
    email: photographerUser.email || "",
    type: "delivery_confirmed",
    title,
    message,
    entityType: "delivery",
    entityId: String(delivery._id),
    metadata: {
      bookingCode: booking?.bookingCode || "",
      status: delivery.status,
    },
    emailSubject: title,
    emailText: message,
  });
}

export async function notifyDeliveryFeedbackAdded(deliveryInput) {
  const context = await resolveDeliveryContext(deliveryInput);
  if (!context) return;

  const { delivery, booking, photographerUser } = context;
  if (!photographerUser?._id) return;

  const title = "New customer delivery feedback";
  const message = `Customer added feedback on booking ${booking?.bookingCode || ""}.`;

  await notifyUser({
    userId: photographerUser._id,
    email: photographerUser.email || "",
    type: "delivery_feedback",
    title,
    message,
    entityType: "delivery",
    entityId: String(delivery._id),
    metadata: { bookingCode: booking?.bookingCode || "" },
    emailSubject: title,
    emailText: message,
  });
}

export async function notifyReviewSubmitted(review) {
  if (!review?.photographerId) return;

  const photographerProfile = await PhotographerProfile.findById(
    review.photographerId,
  )
    .select("_id userId businessName")
    .lean();

  if (!photographerProfile?.userId) return;

  const photographerUser = await UserCollection.findById(photographerProfile.userId)
    .select("_id email")
    .lean();

  if (!photographerUser?._id) return;

  const customerName = review?.customerId?.name || "A customer";
  const title = "New customer review";
  const message = `${customerName} rated your service ${review.rating}/5.`;

  await notifyUser({
    userId: photographerUser._id,
    email: photographerUser.email || "",
    type: "review_submitted",
    title,
    message,
    entityType: "review",
    entityId: String(review._id),
    metadata: {
      rating: review.rating,
      bookingCode: review?.bookingId?.bookingCode || "",
    },
    emailSubject: title,
    emailText: message,
  });
}
