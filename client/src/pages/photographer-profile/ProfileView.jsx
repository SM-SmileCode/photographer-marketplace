import React from "react";
import { Camera, PlusIcon, X } from "lucide-react";
import { removePortfolioImage } from "../../services/photographerProfileService";

function ProfileView({
  profile,
  onProfileImageClick,
  isProfileImageUploading,
  onCoverImageClick,
  isCoverImageUploading,
  onAddGalleryClick,
  onPortfolioFiles,
  isPortfolioUploading,
  onPortfolioUpdate,
}) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [removingIndex, setRemovingIndex] = React.useState(null);
  const [locationLabel, setLocationLabel] = React.useState("");

  React.useEffect(() => {
    const coords = profile?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return;
    const [lng, lat] = coords;
    if (!lat || !lng || (lat === 0 && lng === 0)) return;

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then((r) => r.json())
      .then((data) => {
        const addr = data?.address || {};
        const label = [
          addr.suburb || addr.neighbourhood || addr.village,
          addr.city || addr.town || addr.county,
          addr.state,
        ].filter(Boolean).join(", ");
        setLocationLabel(label || "");
      })
      .catch(() => {});
  }, [profile?.location?.coordinates]);

  const handleRemovePortfolioImage = async (index) => {
    if (removingIndex !== null) return;
    setRemovingIndex(index);
    try {
      const result = await removePortfolioImage(index);
      onPortfolioUpdate?.(result.profile);
    } catch {
      // silently fail — parent error handling can be added if needed
    } finally {
      setRemovingIndex(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
    if (files.length > 0 && onPortfolioFiles) {
      onPortfolioFiles(files);
    }
  };

  if (!profile) return null;

  const locationText = [profile.city, profile.state].filter(Boolean).join(", ");
  const priceText =
    profile.startingPrice != null
      ? `${profile.currency || "INR"} ${profile.startingPrice}`
      : "Price not set";

  const ratingText =
    profile.totalReviews > 0
      ? `${profile.avgRating || 0} (${profile.totalReviews} reviews)`
      : "No reviews yet";

  const checks = [
    { label: "Business Name", ok: Boolean(profile.businessName) },
    { label: "Location", ok: Boolean(profile.city && profile.state) },
    { label: "Starting Price", ok: Boolean(profile.startingPrice != null) },
    { label: "Bio", ok: Boolean(profile.bio) },
    { label: "Profile Image", ok: Boolean(profile.profileImageUrl) },
    { label: "Services", ok: (profile.services?.length || 0) > 0 },
    { label: "Portfolio", ok: (profile.portfolioImages?.length || 0) > 0 },
  ];
  const missingFields = checks
    .filter((item) => !item.ok)
    .map((item) => item.label);
  const completion = Math.round(
    ((checks.length - missingFields.length) / checks.length) * 100,
  );

  return (
    <>
      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="p-3 sm:p-3">
          <div className="relative">
            <div className="h-[200px] overflow-hidden rounded-xl sm:h-60">
              {profile.coverImageUrl ? (
                <img
                  src={profile.coverImageUrl}
                  alt={`${profile.businessName || "Photographer"} cover`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-[#dbeafe] to-[#fce7f3]" />
              )}

              <button
                type="button"
                onClick={onCoverImageClick}
                disabled={isCoverImageUploading}
                className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black/80"
              >
                <Camera size={16} strokeWidth={2.2} />
              </button>
            </div>

            <div className="avatar-top-rings absolute bottom-0 left-4 z-20 h-28 w-28 translate-y-1/2 outline-2 outline-[var(--accent)] outline-offset-4 sm:left-6 sm:h-32 sm:w-32">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={profile.businessName || "Profile"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--muted)]">
                  No Photo
                </div>
              )}

              <button
                type="button"
                onClick={onProfileImageClick}
                disabled={isProfileImageUploading}
                className="absolute bottom-3 right-5 inline-flex z-10 h-8 w-8 items-center justify-center rounded-full cursor-pointer bg-gray-100/10 text-white shadow-md backdrop-blur-sm transition hover:scale-105 hover:bg-gray-100/40"
              >
                <Camera size={18} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div className="mt-16 sm:mt-20 sm:pl-40">
            <h2 className="text-2xl font-semibold capitalize text-[var(--text)]">
              {profile.businessName || "Photographer"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {locationText || "Location not set"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="bioExtraInfo">{priceText}</span>
              <span className="bioExtraInfo">{ratingText}</span>
              <span className="bioExtraInfo">
                {profile.isVerified ? "Verified" : "Not Verified"}
              </span>
              <span
                className={`bioExtraInfo ${
                  profile.isFeatured
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : ""
                }`}
              >
                {profile.isFeatured ? "⭐ Featured" : "○ Standard"}
              </span>
              <span className="bioExtraInfo">
                {profile.experienceYears || 0} yrs exp
              </span>
              {profile.responseTimeMinutes != null && (
                <span className="bioExtraInfo">
                  {profile.responseTimeMinutes > 60
                    ? `${profile.responseTimeMinutes / 60} hour${profile.responseTimeMinutes / 60 === 1 ? '' : 's'} reply`
                    : `${profile.responseTimeMinutes} min reply`}                </span>
              )}
              {profile.acceptanceRate != null && (
                <span className="bioExtraInfo">
                  {profile.acceptanceRate}% accepted
                </span>
              )}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text)]">
              {profile.bio || "No bio added yet."}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">
            Profile Health
          </h3>
          <span className="text-sm font-semibold text-[var(--text)]">
            {completion}% Complete
          </span>
        </div>

        <div className="mb-3 h-2 w-full rounded-full bg-[var(--line)]">
          <div
            className="h-2 rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>

        {missingFields.length > 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Missing : {missingFields.join(", ")}
          </p>
        ) : (
          <p className="text-sm text-[var(--accent)]">
            All key profile fields are completed.
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <h3 className="profile-section-title">About & Operations</h3>
          </div>

          <div>
            <p className="heading text-[var(--muted)]">Experience</p>
            <p className="heading-value text-[var(--text)]">
              {profile.experienceYears} years
            </p>
          </div>

          {profile.address && (
            <div>
              <p className="heading text-[var(--muted)]">Address</p>
              <p className="heading-value text-[var(--text)]">
                {profile.address}
              </p>
            </div>
          )}

          {typeof profile.serviceRadiusKm === "number" && (
            <div>
              <p className="heading text-[var(--muted)]">Service Radius</p>
              <p className="heading-value text-[var(--text)]">
                {profile.serviceRadiusKm} km
              </p>
            </div>
          )}

          {profile.responseTimeMinutes != null && (
            <div>
              <p className="heading text-[var(--muted)]">Response Time</p>
              <p className="heading-value text-[var(--text)]">
                {profile.responseTimeMinutes > 60
                  ? `${profile.responseTimeMinutes / 60} hour${profile.responseTimeMinutes / 60 === 1 ? '' : 's'}`
                  : `${profile.responseTimeMinutes} min`}
              </p>
            </div>
          )}

          {profile.acceptanceRate != null && (
            <div>
              <p className="heading text-[var(--muted)]">Acceptance Rate</p>
              <p className="heading-value text-[var(--text)]">
                {profile.acceptanceRate}%
              </p>
            </div>
          )}

          {profile.completedBookings != null && (
            <div>
              <p className="heading text-[var(--muted)]">Completed Bookings</p>
              <p className="heading-value text-[var(--text)]">
                {profile.completedBookings}
              </p>
            </div>
          )}

          {profile.bio && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="heading text-[var(--muted)]">Bio</p>
              <p className="heading-value text-[var(--text)]">{profile.bio}</p>
            </div>
          )}

          {profile.languages?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Languages</p>
              <p className="heading-value text-[var(--text)]">
                {profile.languages.join(", ")}
              </p>
            </div>
          )}

          {profile.serviceAreas?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Service Areas</p>
              <p className="heading-value text-[var(--text)]">
                {profile.serviceAreas.join(", ")}
              </p>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-4">
            <h3 className="profile-section-title">Services & Events</h3>
          </div>

          {profile.eventTypes?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Event Types</p>
              <p className="heading-value text-[var(--text)]">
                {profile.eventTypes.join(", ")}
              </p>
            </div>
          )}

          {profile.customEventTypes?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Custom Event Types</p>
              <p className="heading-value text-[var(--text)]">
                {profile.customEventTypes.join(", ")}
              </p>
            </div>
          )}

          {profile.services?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Services</p>
              <p className="heading-value text-[var(--text)]">
                {profile.services.join(", ")}
              </p>
            </div>
          )}

          {profile.customServices?.length > 0 && (
            <div className="sm:col-span-2">
              <p className="heading text-[var(--muted)]">Custom Services</p>
              <p className="heading-value text-[var(--text)]">
                {profile.customServices.join(", ")}
              </p>
            </div>
          )}

          {(profile.instagramUrl || profile.websiteUrl) && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="sm:col-span-2 lg:col-span-4 mt-2">
                <h3 className="profile-section-title">Links</h3>
              </div>

              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {profile.instagramUrl && (
                  <a
                    href={profile.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--text)] underline"
                  >
                    Instagram
                  </a>
                )}
                {profile.websiteUrl && (
                  <a
                    href={profile.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[var(--text)] underline"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          )}

          {Array.isArray(profile.location?.coordinates) &&
            profile.location.coordinates.length === 2 &&
            (profile.location.coordinates[0] !== 0 || profile.location.coordinates[1] !== 0) && (
              <div className="sm:col-span-2">
                <p className="heading text-[var(--muted)]">Location</p>
                <p className="heading-value text-[var(--text)]">
                  📍 {locationLabel || `${Number(profile.location.coordinates[1]).toFixed(4)}, ${Number(profile.location.coordinates[0]).toFixed(4)}`}
                </p>
              </div>
            )}

          <div className="sm:col-span-2 lg:col-span-4 mt-2">
            <h3 className="profile-section-title flex items-center gap-3">
              Gallery
              <div className="flex items-center gap-2 text-[var(--accent)]">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
            </h3>
          </div>

          {profile.portfolioImages?.length > 0 ? (
            <div
              className="sm:col-span-2 lg:col-span-4 relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnter={handleDragOver}
            >
              <div
                className={`mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-all duration-200 ${
                  isDragOver
                    ? "ring-4 ring-[var(--accent)] ring-opacity-50 rounded-xl p-4 bg-[var(--surface)]/80 backdrop-blur-sm"
                    : ""
                }`}
              >
                {profile.portfolioImages.map((item, index) => {
                  const src = typeof item === "string" ? item : item?.url;
                  if (!src) return null;

                  const mediaType =
                    item?.mediaType === "video" ? "video" : "image";
                  const thumbnailUrl =
                    typeof item === "string" ? "" : item?.thumbnailUrl || "";

                  return (
                    <div
                      key={`${src}-${index}`}
                      className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-white"
                    >
                      <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <div className="relative flex aspect-[3/4] items-center justify-center bg-[#F8F6F1] p-2">
                          {mediaType === "video" ? (
                            <video
                              src={src}
                              controls
                              preload="metadata"
                              poster={thumbnailUrl || undefined}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <img
                              src={src}
                              alt={item?.title || `Portfolio ${index + 1}`}
                              className="h-full w-full object-contain"
                            />
                          )}

                          {mediaType === "video" && (
                            <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                              VIDEO
                            </span>
                          )}
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemovePortfolioImage(index)}
                        disabled={removingIndex !== null}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-red-600 disabled:opacity-50"
                        title="Remove"
                      >
                        {removingIndex === index ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <X size={14} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div
                className={`absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[var(--accent)]/10 rounded-xl z-10 ${
                  isDragOver ? "opacity-100 bg-[var(--accent)]/20" : ""
                }`}
              >
                <p className="text-center text-lg font-medium text-[var(--accent)] px-4 py-8">
                  {isDragOver
                    ? "Drop here"
                    : "Drag images/videos here or use button below"}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="sm:col-span-2 lg:col-span-4 flex justify-center"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnter={handleDragOver}
            >
              <div
                className={`w-full py-12 transition-all duration-200 ${
                  isDragOver
                    ? "ring-4 ring-[var(--accent)] ring-opacity-50 rounded-xl p-8 bg-[var(--surface)]/80 backdrop-blur-sm"
                    : ""
                }`}
              >
                <p
                  className={`text-sm text-[var(--muted)] text-center mb-4 ${
                    isDragOver
                      ? "text-[var(--accent)] text-lg font-medium mb-8"
                      : ""
                  }`}
                >
                  {isDragOver
                    ? "Drop images/videos here (or click Add Portfolio Media)"
                    : "Drag images/videos here or click Add Portfolio Media"}
                </p>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-4">
            <div className="flex justify-center gap-4 mb-6">
              {/* Drag Drop Area - Always Visible */}
              <div
                className="group flex flex-col items-center p-2 border-2 border-dashed border-[var(--accent)] rounded-lg bg-[var(--surface)]/50 hover:border-[var(--accent-hover)] cursor-pointer transition-all hover:shadow-sm hover:scale-105 w-40 h-14"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnter={handleDragOver}
              >
                <svg
                  className="h-6 w-6 text-[var(--accent)] group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-xs font-medium text-[var(--accent)] mt-1 text-center">
                  Drag &amp; drop files
                </p>
              </div>

              {/* Select Button - Always Visible */}
              <div className="flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={onAddGalleryClick}
                  disabled={isPortfolioUploading}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-full bg-[var(--accent)] p-3 text-xs font-semibold text-white shadow-md transition-all hover:bg-[var(--accent-hover)] hover:shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed w-32 h-14 border-2 border-transparent hover:border-[var(--accent)]/50"
                >
                  <span className="font-semibold flex items-center gap-1.5 text-sm">
                    <PlusIcon className="h-5 w-5 flex-shrink-0" />
                    Select files
                  </span>
                  <span className="text-[10px] opacity-90 leading-tight">
                    Click to browse
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfileView;
