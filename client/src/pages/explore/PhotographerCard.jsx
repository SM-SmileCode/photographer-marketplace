import { Link } from "react-router-dom";

function formatVerifiedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PhotographerCard({ item, basePath = "/photographers", isPublic = false }) {
  const services = [...(item.services || []), ...(item.customServices || [])]
    .filter(Boolean)
    .slice(0, 3);
  const verifiedDate = formatVerifiedDate(item?.verifiedAt);
  const isInstantBooking = item?.bookingMode === "instant" || item?.isInstantBooking;

  return (
    <article className="mx-auto w-full max-w-[260px] rounded-2xl border border-[var(--line)]  bg-white p-4">
      <div className="flex justify-center pt-4">
        <div className="h-32 w-32 overflow-hidden rounded-full border border-[var(--line)] bg-white sm:h-36 sm:w-36">
          {item.profileImageUrl ? (
            <img
              src={item.profileImageUrl}
              alt={item.businessName || "Photographer"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
              No Photo
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex items-center flex-col text-center">
        <h1 className="text-lg font-semibold text-[var(--text)] capitalize">
          {item.businessName}
        </h1>
        {isInstantBooking ? (
          <span className="mt-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            Instant booking
          </span>
        ) : null}
        <p className="text-sm text-[var(--muted)]">
          {item.city}, {item.state}
        </p>

        {services.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
            {services.map((service) => (
              <span key={service} className="bioExtraInfo capitalize">
                {service}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="bioExtraInfo">
            {item.totalReviews > 0
              ? `${item.avgRating || 0} (${item.totalReviews})`
              : "No Reviews"}
          </span>
          <span className="bioExtraInfo">
            {item.isVerified
              ? item?.trustSignals?.trustLabel || "Verified Photographer"
              : "Verification Pending"}
          </span>
          {item.isVerified && verifiedDate ? (
            <span className="bioExtraInfo">Verified on {verifiedDate}</span>
          ) : null}
        </div>
        <div className="mt-3">
          <Link
            to={`${basePath}/${item.slug}`}
            className="btn-primary block text-center w-full"
          >
            View Profile
          </Link>
        </div>
      </div>
    </article>
  );
}

export default PhotographerCard;
