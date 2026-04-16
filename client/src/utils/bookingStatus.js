export function getBookingStatusBadgeClass(status) {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    case "cancelled":
      return "bg-slate-100 text-slate-700";
    case "completed":
      return "bg-sky-50 text-sky-700";
    case "expired":
      return "bg-stone-100 text-stone-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
