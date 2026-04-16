import { SAFE_API_URL, apiCall, parseResponse } from "./apiClient.js";

export async function createPaymentOrder(bookingId, customAmount) {
  const body = customAmount ? JSON.stringify({ customAmount }) : undefined;
  const res = await apiCall(`${SAFE_API_URL}/bookings/${bookingId}/payment/order`, {
    method: "POST",
    body,
  });
  return parseResponse(res, "Failed to create payment order.");
}

export async function verifyPayment(bookingId, payload) {
  const res = await apiCall(`${SAFE_API_URL}/bookings/${bookingId}/payment/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Failed to verify payment.");
}

export async function getPaymentStatus(bookingId) {
  const res = await apiCall(`${SAFE_API_URL}/bookings/${bookingId}/payment/status`);
  return parseResponse(res, "Failed to fetch payment status.");
}

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function initiateRazorpayPayment({ bookingId, userName, userEmail, customAmount, onSuccess, onError }) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    onError?.("Failed to load payment gateway. Please try again.");
    return;
  }

  let orderData;
  try {
    orderData = await createPaymentOrder(bookingId, customAmount);
  } catch (err) {
    onError?.(err?.message || "Failed to create payment order.");
    return;
  }

  if (orderData.alreadyPaid) {
    onSuccess?.({ alreadyPaid: true });
    return;
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency,
    name: "ShotSphere",
    description: `Booking ${orderData.bookingCode}`,
    order_id: orderData.orderId,
    prefill: { name: userName || "", email: userEmail || "" },
    theme: { color: "#0F766E" },
    handler: async (response) => {
      try {
        await verifyPayment(bookingId, {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        onSuccess?.(response);
      } catch (err) {
        onError?.(err?.message || "Payment verification failed.");
      }
    },
    modal: {
      ondismiss: () => onError?.("Payment cancelled."),
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}
