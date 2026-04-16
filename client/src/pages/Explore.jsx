import useExplore from "./explore/useExplore";
import ExploreFilters from "./explore/ExploreFilters";
import PhotographerCard from "./explore/PhotographerCard";
import { pageThemeVars } from "../styles/themeVars";
import { useLocation, Link } from "react-router-dom";

function Explore() {
  const {
    items,
    loading,
    error,
    filters,
    setFilter,
    resetFilters,
    page,
    setPage,
    pagination,
  } = useExplore();

  const location = useLocation();
  const isCustomer = location.pathname.startsWith("/customer");
  const profileBasePath = isCustomer ? "/customer/photographers" : "/photographers";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl" style={pageThemeVars}>

        <div className="mb-6">
          <h1 className="font-[Georgia,Times,'Times_New_Roman',serif] text-3xl text-[var(--text)]">
            Explore Photographers
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isCustomer
              ? "Browse and filter verified photographers to find your perfect match."
              : "Browse verified photographers. Sign in to filter, book, and manage everything."}
          </p>
        </div>

        {isCustomer ? (
          <ExploreFilters
            filters={filters}
            onFilterChange={setFilter}
            onReset={resetFilters}
          />
        ) : (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            <p className="text-sm text-[var(--muted)]">
              🔒 Sign in to filter by city, price, event type and more.
            </p>
            <Link
              to="/login"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Sign In
            </Link>
          </div>
        )}

        {loading && (
          <p className="text-[var(--muted)]">Loading photographers...</p>
        )}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <p className="text-[var(--muted)]">No photographers found.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <PhotographerCard
                    key={item.slug}
                    item={item}
                    basePath={profileBasePath}
                    isPublic={!isCustomer}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="form-btn border border-[var(--line)] text-[var(--text)] disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm text-[var(--muted)]">
                Page {pagination.page || page}/{pagination.totalPages || 1}
              </span>
              <button
                type="button"
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="form-btn border border-[var(--line)] text-[var(--text)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Explore;
