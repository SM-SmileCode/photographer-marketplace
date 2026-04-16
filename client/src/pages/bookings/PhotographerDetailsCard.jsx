import { useEffect, useState } from "react";
import { fetchPhotographerById } from "../../services/exploreService";
import { fetchPhotographerPackages } from "../../services/packageService";
import { useBookingsTranslation } from "../../i18n/useBookingsTranslation";

function formatVerifiedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PhotographerDetailsCard({
  photographerId,
  onPhotographerLoad,
  onPackagesLoad,
  selectedPackageId,
  onPackageSelect,
}) {
  const { t } = useBookingsTranslation();
  const [photographer, setPhotographer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packages, setPackages] = useState([]);
  const hasCompletePhotographerId = /^[a-f\d]{24}$/i.test(photographerId);
  const failedToLoadMessage = t("photographerDetails.failedToLoad");

  useEffect(() => {
    if (!hasCompletePhotographerId) {
      setPhotographer(null);
      setPackages([]);
      onPackagesLoad?.([]);
      setLoading(false);
      setError("");
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const [data, pkgData] = await Promise.allSettled([
          fetchPhotographerById(photographerId),
          fetchPhotographerPackages(photographerId),
        ]);

        if (!isMounted) return;

        if (data.status === "fulfilled") {
          setPhotographer(data.value);
          onPhotographerLoad?.(data.value);
        } else {
          throw data.reason;
        }

        if (pkgData.status === "fulfilled") {
          const loadedPackages = pkgData.value?.packages || [];
          setPackages(loadedPackages);
          onPackagesLoad?.(loadedPackages);
        } else {
          setPackages([]);
          onPackagesLoad?.([]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || failedToLoadMessage);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [
    failedToLoadMessage,
    hasCompletePhotographerId,
    onPhotographerLoad,
    onPackagesLoad,
    photographerId,
  ]);

  if (!hasCompletePhotographerId) return null;

  const services = [...(photographer?.services || []), ...(photographer?.customServices || [])]
    .filter(Boolean)
    .slice(0, 3);

  const languages = [...(photographer?.languages || [])].filter(Boolean);
  const verifiedDate = formatVerifiedDate(photographer?.verifiedAt);
  const isInstantBooking =
    photographer?.bookingMode === "instant" || photographer?.isInstantBooking;

  return (
    <section className="card-surface">
      <h2 className="label-uppercase">{t("photographerDetails.selectedPhotographer")}</h2>

      {loading ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          {t("photographerDetails.loadingPhotographer")}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {!loading && !error && photographer ? (
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--text)] capitalize">
              {photographer.businessName || t("photographerDetails.photographerFallback")}
            </h2>

            <p className="text-sm text-[var(--muted)]">
              {[photographer.city, photographer.state].filter(Boolean).join(", ") ||
                t("photographerDetails.locationNotSet")}
            </p>

            {services.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {t("photographerDetails.services")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {services.map((service, index) => (
                    <span key={`${service}-${index}`} className="bioExtraInfo capitalize">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {languages.length ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--text)]">
                  {t("photographerDetails.languages")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {languages.map((language, index) => (
                    <span key={`${language}-${index}`} className="bioExtraInfo">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <span className="bioExtraInfo">
                {isInstantBooking ? t("bookings.instantBadge") : t("bookings.normalBadge")}
              </span>
              <span className="bioExtraInfo">
                {photographer.currency || "INR"} {photographer.startingPrice ?? "-"}
              </span>
              <span className="bioExtraInfo">
                {photographer.totalReviews > 0
                  ? `${photographer.avgRating || 0} (${photographer.totalReviews})`
                  : t("photographerDetails.noReviews")}
              </span>
              <span className="bioExtraInfo">
                {photographer.isVerified
                  ? photographer?.trustSignals?.trustLabel || "Verified Photographer"
                  : t("photographerDetails.notVerified")}
              </span>
              {photographer.isVerified && verifiedDate ? (
                <span className="bioExtraInfo">Verified on {verifiedDate}</span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {isInstantBooking ? t("bookings.instantModeDesc") : t("bookings.normalModeDesc")}
            </p>
          </div>

          <div className="h-32 w-32 overflow-hidden rounded-full border border-[var(--line)] bg-white md:h-36 md:w-36">
            {photographer.profileImageUrl ? (
              <img
                src={photographer.profileImageUrl}
                alt={photographer.businessName || "Photographer"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--muted)]">
                {(photographer.businessName || "P").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {packages.length > 0 ? (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="mb-3 text-sm font-semibold text-[var(--text)]">{t("bookings.selectPackage")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg._id;
              return (
                <button
                  key={pkg._id}
                  type="button"
                  onClick={() => onPackageSelect?.(isSelected ? null : pkg)}
                  className={`rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[var(--accent)] bg-[#f0faf9]"
                      : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--text)]">{pkg.name}</p>
                  {pkg.description ? (
                    <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{pkg.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="bioExtraInfo">
                      {pkg.currency || "INR"} {pkg.basePrice}
                    </span>
                    {pkg.hoursIncluded ? <span className="bioExtraInfo">{pkg.hoursIncluded}h</span> : null}
                    {pkg.photosIncluded ? <span className="bioExtraInfo">{pkg.photosIncluded} photos</span> : null}
                  </div>
                  {Array.isArray(pkg.addOns) && pkg.addOns.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {pkg.addOns.length} add-on{pkg.addOns.length > 1 ? "s" : ""} available
                    </p>
                  ) : null}
                  {isSelected ? (
                    <p className="mt-2 text-xs font-semibold text-[var(--accent)]">Selected</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-sm text-[var(--muted)]">
        <span className="bioExtraInfo">
          {t("labels.photographerId")}: {photographerId}
        </span>
      </p>
    </section>
  );
}

export default PhotographerDetailsCard;
