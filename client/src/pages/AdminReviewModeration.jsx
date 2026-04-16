import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminModerationReviews,
  moderateAdminReviewStatus,
} from "../services/reviewService";

const STATUS_OPTIONS = [
  { value: "flagged", label: "Flagged" },
  { value: "hidden", label: "Hidden" },
  { value: "published", label: "Published" },
  { value: "all", label: "All" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function AdminReviewModeration() {
  const [statusFilter, setStatusFilter] = useState("flagged");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    published: 0,
    flagged: 0,
    hidden: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyReviewId, setBusyReviewId] = useState("");
  const [notesByReviewId, setNotesByReviewId] = useState({});

  const currentFilterLabel = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || "Reviews",
    [statusFilter],
  );

  const loadReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminModerationReviews({
        status: statusFilter,
        page: 1,
        limit: 50,
      });
      setItems(data?.items || []);
      setSummary(
        data?.summary || {
          published: 0,
          flagged: 0,
          hidden: 0,
        },
      );
    } catch (loadError) {
      setError(loadError?.message || "Failed to load moderation reviews.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateReviewStatus = async (reviewId, status) => {
    setBusyReviewId(reviewId);
    setError("");
    try {
      await moderateAdminReviewStatus(reviewId, {
        status,
        moderationNote: notesByReviewId[reviewId] || "",
      });
      await loadReviews();
    } catch (moderationError) {
      setError(moderationError?.message || "Failed to moderate review.");
    } finally {
      setBusyReviewId("");
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={{
        "--bg": "#F5F2EA",
        "--surface": "#FFFCF6",
        "--text": "#1F2937",
        "--muted": "#6B7280",
        "--line": "#E7E1D4",
        "--accent": "#0F766E",
        "--accent-hover": "#0B5E58",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
                Review Moderation
              </p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                {currentFilterLabel} Reviews
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Flag, hide, or republish customer reviews from one moderation queue.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)] uppercase">Published</p>
              <p className="mt-2 text-2xl font-semibold">{summary.published}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)] uppercase">Flagged</p>
              <p className="mt-2 text-2xl font-semibold">{summary.flagged}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)] uppercase">Hidden</p>
              <p className="mt-2 text-2xl font-semibold">{summary.hidden}</p>
            </div>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading moderation queue...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
              No reviews found for this filter.
            </p>
          ) : null}

          {!loading &&
            items.map((review) => {
              const reviewId = review?._id;
              const isBusy = busyReviewId === reviewId;

              return (
                <article
                  key={reviewId}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {review?.customerId?.name || "Customer"} {"->"}{" "}
                        {review?.photographerId?.businessName || "Photographer"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Booking: {review?.bookingId?.bookingCode || "-"} | Rating:{" "}
                        {review?.rating || 0}/5 | Status: {review?.status || "-"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Created: {formatDate(review?.createdAt)} | Reports:{" "}
                        {review?.reportCount || 0}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm">
                    {review?.comment || "Rated without a written review."}
                  </p>

                  <textarea
                    value={notesByReviewId[reviewId] ?? review?.moderationNote ?? ""}
                    onChange={(e) =>
                      setNotesByReviewId((prev) => ({
                        ...prev,
                        [reviewId]: e.target.value,
                      }))
                    }
                    rows={2}
                    maxLength={300}
                    placeholder="Moderation note (optional)"
                    className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => updateReviewStatus(reviewId, "published")}
                      className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => updateReviewStatus(reviewId, "flagged")}
                      className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#F2EEDF] disabled:opacity-60"
                    >
                      Flag
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => updateReviewStatus(reviewId, "hidden")}
                      className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
                    >
                      Hide
                    </button>
                  </div>
                </article>
              );
            })}
        </section>
      </div>
    </div>
  );
}

export default AdminReviewModeration;
