import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { fetchMyWishlist, removeFromMyWishlist } from "../services/wishlistService";
import { pageThemeVars } from "../styles/themeVars";

function formatPrice(currency, value) {
  return `${currency || "INR"} ${Number(value || 0).toLocaleString("en-IN")}`;
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

function Wishlist() {
  const { user } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyPhotographerId, setBusyPhotographerId] = useState("");

  const loadWishlist = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyWishlist({ page: 1, limit: 100 });
      setItems(data?.items || []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load wishlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "customer") loadWishlist();
    else setLoading(false);
  }, [user?.role]);

  const handleRemove = async (photographerId) => {
    setBusyPhotographerId(photographerId);
    setError("");
    try {
      await removeFromMyWishlist(photographerId);
      await loadWishlist();
    } catch (removeError) {
      setError(removeError?.message || "Failed to remove from wishlist.");
    } finally {
      setBusyPhotographerId("");
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-hero sm:p-8">
          <p className="label-uppercase-lg">Customer Workflow</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl sm:text-4xl">
            Saved Photographers
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Keep track of photographers you want to compare or book later.
          </p>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--muted)]">Loading wishlist...</p> : null}

        {!loading && items.length === 0 ? (
          <section className="card-surface">
            <p className="text-sm text-[var(--muted)]">
              Your wishlist is empty. Explore photographers and save profiles to
              compare them later.
            </p>
            <Link to="/customer/explore" className="mt-3 inline-flex btn-primary">
              Explore Photographers
            </Link>
          </section>
        ) : null}

        {!loading && items.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const photographer = item?.photographer;
              if (!photographer?._id) return null;
              const isBusy = busyPhotographerId === photographer._id;
              const verifiedDate = formatVerifiedDate(photographer?.verifiedAt);

              return (
                <article key={item._id} className="card-surface">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-[var(--line)] bg-white">
                      {photographer.profileImageUrl ? (
                        <img
                          src={photographer.profileImageUrl}
                          alt={photographer.businessName || "Photographer"}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text)]">
                        {photographer.businessName || "Photographer"}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        {photographer.city || "-"}, {photographer.state || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <span className="bioExtraInfo">
                      {photographer.totalReviews > 0
                        ? `${photographer.avgRating || 0} (${photographer.totalReviews})`
                        : "No reviews"}
                    </span>
                    <span className="bioExtraInfo">
                      {formatPrice(photographer.currency, photographer.startingPrice)}
                    </span>
                    <span className="bioExtraInfo">
                      {photographer.isVerified
                        ? photographer?.trustSignals?.trustLabel || "Verified Photographer"
                        : "Verification Pending"}
                    </span>
                    {photographer.isVerified && verifiedDate ? (
                      <span className="bioExtraInfo">Verified on {verifiedDate}</span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={`/customer/photographers/${photographer.slug}`}
                      className="btn-primary"
                    >
                      View Profile
                    </Link>
                    <Link
                      to={`/bookings?photographerId=${photographer._id}`}
                      className="btn-secondary"
                    >
                      Book Now
                    </Link>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRemove(photographer._id)}
                      className="btn-secondary"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default Wishlist;
