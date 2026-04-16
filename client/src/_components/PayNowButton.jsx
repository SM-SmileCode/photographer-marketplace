import { useState } from "react";
import { initiateRazorpayPayment } from "../services/paymentService";

function PayNowButton({ bookingId, userName, userEmail, onPaid, payableAmount = 0, currency = "INR", className = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const needsCustomAmount = !payableAmount || payableAmount <= 0;

  const handlePay = async () => {
    if (needsCustomAmount) {
      const amt = Number(customAmount);
      if (!amt || amt <= 0) {
        setError("Please enter a valid amount.");
        return;
      }
    }
    setLoading(true);
    setError("");
    await initiateRazorpayPayment({
      bookingId,
      userName,
      userEmail,
      customAmount: needsCustomAmount ? Number(customAmount) : undefined,
      onSuccess: (response) => {
        setLoading(false);
        setPaid(true);
        onPaid?.(response);
      },
      onError: (msg) => {
        setLoading(false);
        if (msg !== "Payment cancelled.") setError(msg);
      },
    });
  };

  if (paid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        ✓ Payment Successful
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {needsCustomAmount ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">{currency}</span>
          <input
            type="number"
            min="1"
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setError(""); }}
            placeholder="Enter amount"
            className="w-32 rounded-lg border border-[var(--line)] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className={`rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60 ${className}`}
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export default PayNowButton;
