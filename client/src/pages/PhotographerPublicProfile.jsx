import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { fetchPhotographersBySlug } from "../services/exploreService";
import {
  fetchPhotographerReviewsBySlug,
  reportReviewAbuse,
} from "../services/reviewService";
import { SAFE_API_URL } from "../services/apiClient";
import { pageThemeVars } from "../styles/themeVars";
import {
  addToMyWishlist,
  checkMyWishlistItem,
  removeFromMyWishlist,
} from "../services/wishlistService";

function PhotographerPublicProfile() {
  const { slug } = useParams();
  const location = useLocation();
  const exploreBackPath = location.pathname.startsWith("/customer/")
    ? "/customer/explore"
    : "/explore";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [reportingReviewId, setReportingReviewId] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  function formatReviewDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatVerifiedDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function renderStars(rating = 0) {
    return Array.from({ length: 5 }, (_, index) =>
      index < rating ? "\u2605" : "\u2606",
    ).join("");
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setReviewsLoading(true);
        setError("");
        setReviewsError("");

        const [profileResult, reviewsResult] = await Promise.allSettled([
          fetchPhotographersBySlug(slug),
          fetchPhotographerReviewsBySlug(slug, { page: 1, limit: 6 }),
        ]);

        if (!alive) return;

        if (profileResult.status === "rejected") {
          throw profileResult.reason;
        }

        setProfile(profileResult.value);

        if (reviewsResult.status === "fulfilled") {
          setReviews(reviewsResult.value.items || []);
        } else {
          setReviews([]);
          setReviewsError(
            reviewsResult.reason?.message || "Failed to load reviews",
          );
        }
      } catch (error) {
        if (!alive) return;
        setError(error.message || "Failed to load photographer profile");
      } finally {
        if (alive) {
          setLoading(false);
          setReviewsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${SAFE_API_URL}/me`, {
          credentials: "include",
        });

        if (!alive) return;

        if (!res.ok) {
          setSessionUser(null);
          setSessionLoading(false);
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setSessionUser(data?.user || null);
      } catch {
        if (alive) {
          setSessionUser(null);
        }
      } finally {
        if (alive) {
          setSessionLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (
        sessionLoading ||
        sessionUser?.role !== "customer" ||
        !profile?._id
      ) {
        if (alive) {
          setIsWishlisted(false);
          setWishlistError("");
        }
        return;
      }

      try {
        const result = await checkMyWishlistItem(profile._id);
        if (!alive) return;
        setIsWishlisted(Boolean(result?.saved));
      } catch {
        // silently ignore — non-customer roles get 403 which is expected
        if (!alive) return;
        setIsWishlisted(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile?._id, sessionLoading, sessionUser?.role]);

  const handleToggleWishlist = async () => {
    if (!profile?._id || sessionUser?.role !== "customer") return;

    setWishlistBusy(true);
    setWishlistError("");
    try {
      if (isWishlisted) {
        await removeFromMyWishlist(profile._id);
        setIsWishlisted(false);
      } else {
        await addToMyWishlist(profile._id);
        setIsWishlisted(true);
      }
    } catch (error) {
      setWishlistError(error?.message || "Failed to update wishlist.");
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleReportReview = async (reviewId) => {
    if (!sessionUser) {
      setReportError("Please log in to report abusive reviews.");
      setReportMessage("");
      return;
    }

    setReportingReviewId(reviewId);
    setReportError("");
    setReportMessage("");
    try {
      const result = await reportReviewAbuse(
        reviewId,
        "Abuse report submitted from public profile.",
      );
      if (result?.report?.alreadyReported) {
        setReportMessage("You already reported this review.");
      } else {
        setReportMessage("Review reported. Our moderation team will review it.");
      }
    } catch (error) {
      setReportError(error?.message || "Failed to report review.");
    } finally {
      setReportingReviewId("");
    }
  };

  const eventTypes = [
    ...(profile?.eventTypes || []),
    ...(profile?.customEventTypes || []),
  ].filter(Boolean);

  const services = [
    ...(profile?.services || []),
    ...(profile?.customServices || []),
  ].filter(Boolean);

  const galleryItems = (profile?.portfolioImages || [])
    .map((item, idx) => {
      const src = typeof item === "string" ? item : item?.url;
      if (!src) return null;

      const mediaType = item?.mediaType === "video" ? "video" : "image";
      const thumbnailUrl =
        typeof item === "string" ? "" : item?.thumbnailUrl || "";

      return {
        id: `${src}-${idx}`,
        src,
        mediaType,
        thumbnailUrl,
      };
    })
    .filter(Boolean);

  const filteredGalleryItems = galleryItems.filter((item) => {
    if (mediaFilter === "all") return true;
    return item.mediaType === mediaFilter;
  });

  const isInstantBooking =
    profile?.bookingMode === "instant" || profile?.isInstantBooking;
  const bookingParams = new URLSearchParams({
    photographerId: profile?._id || "",
  });
  if (isInstantBooking) {
    bookingParams.set("bookingFlow", "quick");
  }
  const bookingPath = `/bookings?${bookingParams.toString()}`;
  const loginRedirectPath = `/login?redirect=${encodeURIComponent(bookingPath)}`;
  const rolePaths = {
    customer: bookingPath,
    photographer: "/photographer/dashboard",
    admin: "/admin",
  };
  const actionTarget = sessionLoading
    ? bookingPath
    : sessionUser?.role
      ? rolePaths[sessionUser.role] || "/login"
      : loginRedirectPath;
  const verifiedDate = formatVerifiedDate(profile?.verifiedAt);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-[var(--muted)]">
          Loading profile ...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <p className="text-red-600">{error || "Photographer not found"}</p>
          <Link
            to={exploreBackPath}
            className="inline-flex rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div
        className="mx-auto max-w-5xl"
        style={pageThemeVars}
      >
        <Link
          to={exploreBackPath}
          className="mb-4 inline-flex text-sm font-medium text-[var(--accent)]"
        >
          {"\u2190"} Back to Explore
        </Link>

        <section className="overflow-hidden rounded-2xl card-surface">
          <div className="h-48 bg-[#f0ede5] sm:h-64">
            {profile.coverImageUrl ? (
              <img
                src={profile.coverImageUrl}
                alt={`${profile.businessName || "Photographer"} cover`}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-[var(--line)] bg-white sm:h-24 sm:w-24">
                {profile.profileImageUrl ? (
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.businessName || "Photographer"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
                    No Photo
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h1 className="text-2xl font-semibold capitalize text-[var(--text)]">
                  {profile.businessName || "Photographer"}
                </h1>
                <p className="text-sm text-[var(--muted)]">
                  {[profile.city, profile.state].filter(Boolean).join(", ") ||
                    "Location not set"}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-sm">
                  <span className="bioExtraInfo">
                    {profile.currency || "INR"} {profile.startingPrice ?? "-"}
                  </span>
                  <span className="bioExtraInfo">
                    {profile.totalReviews > 0
                      ? `${profile.avgRating || 0} (${profile.totalReviews})`
                      : "No Reviews"}
                  </span>
                  <span className="bioExtraInfo">
                    {profile.isVerified
                      ? profile?.trustSignals?.trustLabel || "Verified Photographer"
                      : "Verification Pending"}
                  </span>
                  {profile.isVerified && verifiedDate ? (
                    <span className="bioExtraInfo">Verified on {verifiedDate}</span>
                  ) : null}

                  {profile.isFeatured ? (
                    <span className="bioExtraInfo">{"\u2B50"} Featured</span>
                  ) : null}
                  {isInstantBooking ? (
                    <span className="bioExtraInfo">{"\u26A1"} Instant booking</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
                  About
                </h2>
                <p className="text-sm leading-6 text-[var(--text)]">
                  {profile.bio || "No bio added yet."}
                </p>
              </section>

              <section className="card-white">
                <h2 className="text-base font-semibold text-[var(--text)]">
                  Ready to Book?
                </h2>

                <p className="mt-1 text-sm text-[var(--muted)]">
                  {isInstantBooking
                    ? "This photographer accepts instant bookings for available slots."
                    : "Send a booking request and the photographer will confirm manually."}
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to={actionTarget}
                    className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2 
                                  text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    {isInstantBooking ? "Book Instantly" : "Book Now"}
                  </Link>
                  <Link
                    to={actionTarget}
                    className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 
                                  text-sm font-semibold text-[var(--text)] transition hover:bg-white"
                  >
                    Message Photographer
                  </Link>
                  {sessionUser?.role === "customer" ? (
                    <button
                      type="button"
                      disabled={wishlistBusy}
                      onClick={handleToggleWishlist}
                      className="inline-flex items-center rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF] disabled:opacity-60"
                    >
                      {isWishlisted ? "Saved" : "Save to Wishlist"}
                    </button>
                  ) : null}
                </div>
                {wishlistError ? (
                  <p className="mt-2 text-sm text-red-600">{wishlistError}</p>
                ) : null}
              </section>

              <section className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">
                    Event Types
                  </h3>
                  {eventTypes.length ? (
                    <div className="flex flex-wrap gap-2">
                      {eventTypes.map((item, index) => (
                        <span key={`${item}-${index}`} className="bioExtraInfo capitalize">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Not added</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">
                    Services
                  </h3>
                  {services.length ? (
                    <div className="flex flex-wrap gap-2">
                      {services.map((item, index) => (
                        <span key={`${item}-${index}`} className="bioExtraInfo capitalize">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Not added</p>
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-base font-semibold text-[var(--text)]">
                  Gallery
                </h2>

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaFilter("all")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      mediaFilter === "all"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text)]"
                    }`}
                  >
                    All ({galleryItems.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaFilter("image")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      mediaFilter === "image"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text)]"
                    }`}
                  >
                    Photos (
                    {galleryItems.filter((i) => i.mediaType === "image").length}
                    )
                  </button>

                  <button
                    type="button"
                    onClick={() => setMediaFilter("video")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      mediaFilter === "video"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--text)]"
                    }`}
                  >
                    Videos (
                    {galleryItems.filter((i) => i.mediaType === "video").length}
                    )
                  </button>
                </div>

                {filteredGalleryItems.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredGalleryItems.map((item) =>
                      item.mediaType === "video" ? (
                        <div
                          key={item.id}
                          className="relative aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-white"
                        >
                          <video
                            src={item.src}
                            controls
                            preload="metadata"
                            poster={item.thumbnailUrl || undefined}
                            className="h-full w-full object-contain"
                          />
                          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                            VIDEO
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setLightboxSrc(item.src)}
                          className="aspect-square overflow-hidden rounded-xl border border-[var(--line)] bg-white "
                        >
                          <img
                            src={item.src}
                            alt="Portfolio"
                            className="h-full w-full object-cover transition duration-200 hover:scale-105"
                          />
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    {galleryItems.length
                      ? `No ${mediaFilter === "image" ? "photos" : "videos"} found.`
                      : "No gallery images yet."}
                  </p>
                )}
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    Reviews
                  </h2>
                  <p className="text-sm text-[var(--muted)]">
                    {profile.totalReviews > 0
                      ? `${profile.totalReviews} review${profile.totalReviews === 1 ? "" : "s"}`
                      : "No reviews yet"}
                  </p>
                </div>

                {reviewsLoading ? (
                  <p className="text-sm text-[var(--muted)]">Loading reviews ...</p>
                ) : null}
                {!reviewsLoading && reviewsError ? (
                  <p className="text-sm text-red-600">{reviewsError}</p>
                ) : null}
                {!reviewsLoading && !reviewsError && !reviews.length ? (
                  <p className="text-sm text-[var(--muted)]">
                    No public reviews yet.
                  </p>
                ) : null}
                {reportMessage ? (
                  <p className="mb-3 text-sm text-emerald-700">{reportMessage}</p>
                ) : null}
                {reportError ? (
                  <p className="mb-3 text-sm text-red-600">{reportError}</p>
                ) : null}

                {!reviewsLoading && reviews.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {reviews.map((review) => (
                      <article
                        key={review._id}
                        className="rounded-xl border border-[var(--line)] bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">
                              {review.customerId?.name || "Customer"}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {formatReviewDate(review.createdAt)}
                              {review.bookingId?.eventType
                                ? ` • ${review.bookingId.eventType}`
                                : ""}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-amber-600">
                            {renderStars(review.rating)} {review.rating}/5
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--text)]">
                          {review.comment || "Rated without a written review."}
                        </p>
                        {sessionUser ? (
                          <button
                            type="button"
                            onClick={() => handleReportReview(review._id)}
                            disabled={reportingReviewId === review._id}
                            className="mt-3 rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF] disabled:opacity-60"
                          >
                            {reportingReviewId === review._id
                              ? "Reporting..."
                              : "Report abuse"}
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </section>
      </div>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxSrc("")}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxSrc("")}
              className="absolute right-2 top-2 rounded bg-black/60 px-3 py-1 text-sm text-white"
            >
              Close
            </button>
            <img
              src={lightboxSrc}
              alt="Portfolio preview"
              className="max-h-[90vh] max-w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotographerPublicProfile;
