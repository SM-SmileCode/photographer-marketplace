import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminPhotographerRequests,
  updateAdminPhotographerRequestStatus,
} from "../services/adminService";

const FILTER_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function getStatusBadgeClass(status) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toBoolean(value) {
  return value === true;
}

function getChecklistDraft(profile = {}) {
  const checklist = profile?.verificationChecklist || {};
  return {
    identityVerified: toBoolean(checklist.identityVerified),
    contactVerified: toBoolean(checklist.contactVerified),
    portfolioVerified: toBoolean(checklist.portfolioVerified),
    humanReviewCompleted: toBoolean(checklist.humanReviewCompleted),
    adminNote: String(checklist.adminNote || ""),
  };
}

function renderEvidenceValue(label, value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return (
      <p className="text-xs text-[var(--muted)]">
        {label}: Not provided
      </p>
    );
  }

  const looksLikeUrl = /^https?:\/\//i.test(safeValue);
  if (!looksLikeUrl) {
    return (
      <p className="text-xs text-[var(--text)]">
        {label}: {safeValue}
      </p>
    );
  }

  return (
    <p className="text-xs">
      <span className="text-[var(--muted)]">{label}:</span>{" "}
      <a
        href={safeValue}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-[var(--accent)] underline"
      >
        Open evidence
      </a>
    </p>
  );
}

function AdminPhotographerRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyProfileId, setBusyProfileId] = useState("");
  const [reasonsByProfileId, setReasonsByProfileId] = useState({});
  const [checklistsByProfileId, setChecklistsByProfileId] = useState({});

  const title = useMemo(
    () =>
      FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ||
      "Photographer",
    [statusFilter],
  );

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminPhotographerRequests({
        status: statusFilter,
        page: 1,
        limit: 50,
      });
      const loadedItems = data?.items || [];
      setItems(loadedItems);
      setChecklistsByProfileId(
        loadedItems.reduce((acc, profile) => {
          if (profile?._id) {
            acc[profile._id] = getChecklistDraft(profile);
          }
          return acc;
        }, {}),
      );
    } catch (loadError) {
      setError(loadError?.message || "Failed to load photographer requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateChecklistField = (profileId, field, value) => {
    setChecklistsByProfileId((prev) => ({
      ...prev,
      [profileId]: {
        ...(prev[profileId] || {}),
        [field]: value,
      },
    }));
  };

  const resolveChecklist = (profile) =>
    checklistsByProfileId[profile?._id] || getChecklistDraft(profile);

  const handleApprove = async (profileId) => {
    const profile = items.find((item) => String(item?._id) === String(profileId));
    const checklist = resolveChecklist(profile);

    setBusyProfileId(profileId);
    setError("");
    try {
      await updateAdminPhotographerRequestStatus(profileId, {
        action: "approve",
        verificationChecklist: checklist,
        adminNote: checklist.adminNote || "",
      });
      await loadRequests();
    } catch (approveError) {
      setError(approveError?.message || "Failed to approve request.");
    } finally {
      setBusyProfileId("");
    }
  };

  const handleReject = async (profileId) => {
    const reason = String(reasonsByProfileId[profileId] || "").trim();
    const profile = items.find((item) => String(item?._id) === String(profileId));
    const checklist = resolveChecklist(profile);
    if (!reason) {
      setError("Please provide a rejection reason.");
      return;
    }

    setBusyProfileId(profileId);
    setError("");
    try {
      await updateAdminPhotographerRequestStatus(profileId, {
        action: "reject",
        rejectionReason: reason,
        verificationChecklist: checklist,
        adminNote: checklist.adminNote || "",
      });
      await loadRequests();
    } catch (rejectError) {
      setError(rejectError?.message || "Failed to reject request.");
    } finally {
      setBusyProfileId("");
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
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-surface">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label-uppercase-lg">Admin Workflow</p>
              <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
                {title} Photographer Requests
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Review photographer onboarding requests and approve or reject with
                clear notes.
              </p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading requests...</p>
          ) : null}

          {!loading && items.length === 0 ? (
            <p className="card-surface text-sm text-[var(--muted)]">
              No requests found for this filter.
            </p>
          ) : null}

          {!loading &&
            items.map((profile) => {
              const profileId = profile?._id;
              const isBusy = busyProfileId === profileId;
              const canModerate = profile?.verificationStatus === "pending";
              const checklist = resolveChecklist(profile);
              const evidence = profile?.verificationEvidence || {};
              const sampleFiles = Array.isArray(evidence.originalSampleFileUrls)
                ? evidence.originalSampleFileUrls
                : [];
              const isContactSnapshotVerified =
                profile?.contactVerificationSnapshot?.emailVerified;

              return (
                <article key={profileId} className="card-surface">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text)]">
                        {profile?.businessName || "Business name not set"}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {profile?.city || "-"}, {profile?.state || "-"} |{" "}
                        {Number(profile?.experienceYears || 0)} years experience
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Owner: {profile?.userId?.name || "-"} |{" "}
                        {profile?.userId?.email || "-"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Contact proof: Email{" "}
                        {profile?.userId?.isEmailVerified ? "verified" : "not verified"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Snapshot at profile review:{" "}
                        {isContactSnapshotVerified ? "email verified" : "pending"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Submitted on {formatDate(profile?.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeClass(
                        profile?.verificationStatus,
                      )}`}
                    >
                      {profile?.verificationStatus || "pending"}
                    </span>
                  </div>

                  {profile?.rejectionReason ? (
                    <p className="mt-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--text)]">
                      Last rejection reason: {profile.rejectionReason}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-3">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      Verification Evidence
                    </p>
                    <div className="mt-2 space-y-1">
                      {renderEvidenceValue(
                        "Government ID",
                        evidence.identityDocumentUrl,
                      )}
                      {renderEvidenceValue("Selfie with ID", evidence.selfieWithIdUrl)}
                      <div className="pt-1">
                        <p className="text-xs text-[var(--muted)]">
                          Original sample files:{" "}
                          {sampleFiles.length ? sampleFiles.length : 0}
                        </p>
                        {sampleFiles.length ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {sampleFiles.map((fileUrl) => (
                              <a
                                key={fileUrl}
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]"
                              >
                                Sample
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {canModerate ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-[var(--line)] bg-white p-3">
                        <p className="text-sm font-semibold text-[var(--text)]">
                          Human Review Checklist (Required for approval)
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={checklist.identityVerified}
                              onChange={(e) =>
                                updateChecklistField(
                                  profileId,
                                  "identityVerified",
                                  e.target.checked,
                                )
                              }
                            />
                            Identity document verified
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={checklist.contactVerified}
                              onChange={(e) =>
                                updateChecklistField(
                                  profileId,
                                  "contactVerified",
                                  e.target.checked,
                                )
                              }
                            />
                            Email OTP proof verified
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={checklist.portfolioVerified}
                              onChange={(e) =>
                                updateChecklistField(
                                  profileId,
                                  "portfolioVerified",
                                  e.target.checked,
                                )
                              }
                            />
                            Portfolio authenticity verified
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={checklist.humanReviewCompleted}
                              onChange={(e) =>
                                updateChecklistField(
                                  profileId,
                                  "humanReviewCompleted",
                                  e.target.checked,
                                )
                              }
                            />
                            Human review complete
                          </label>
                        </div>
                        <textarea
                          value={checklist.adminNote || ""}
                          onChange={(e) =>
                            updateChecklistField(profileId, "adminNote", e.target.value)
                          }
                          rows={2}
                          maxLength={1000}
                          placeholder="Admin review notes"
                          className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        />
                      </div>

                      <textarea
                        value={reasonsByProfileId[profileId] || ""}
                        onChange={(e) =>
                          setReasonsByProfileId((prev) => ({
                            ...prev,
                            [profileId]: e.target.value,
                          }))
                        }
                        rows={2}
                        maxLength={500}
                        placeholder="Add rejection reason (required only if rejecting)"
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(profileId)}
                          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleReject(profileId)}
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF] disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-3 text-xs text-[var(--muted)]">
                      <p>
                        Checklist snapshot: Identity{" "}
                        {profile?.verificationChecklist?.identityVerified
                          ? "checked"
                          : "pending"}{" "}
                        | Contact{" "}
                        {profile?.verificationChecklist?.contactVerified
                          ? "checked"
                          : "pending"}{" "}
                        | Portfolio{" "}
                        {profile?.verificationChecklist?.portfolioVerified
                          ? "checked"
                          : "pending"}
                      </p>
                      <p className="mt-1">
                        Reviewed on{" "}
                        {formatDate(profile?.verificationChecklist?.reviewedAt)}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
        </section>
      </div>
    </div>
  );
}

export default AdminPhotographerRequests;
