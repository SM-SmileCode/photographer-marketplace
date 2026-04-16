import { useEffect, useState } from "react";
import {
  fetchAdminUsers,
  updateAdminUserBlockStatus,
} from "../services/adminService";

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "customer", label: "Customers" },
  { value: "photographer", label: "Photographers" },
  { value: "admin", label: "Admins" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Users" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUserId, setBusyUserId] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminUsers({
        page: 1,
        limit: 50,
        role: roleFilter,
        status: statusFilter,
        search,
      });
      setItems(data?.items || data?.users || []);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter, search]);

  const handleToggleBlock = async (userId, isBlocked) => {
    setBusyUserId(userId);
    setError("");
    try {
      await updateAdminUserBlockStatus(userId, !isBlocked);
      await loadUsers();
    } catch (updateError) {
      setError(updateError?.message || "Failed to update user status.");
    } finally {
      setBusyUserId("");
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
          <p className="label-uppercase-lg">Admin Workflow</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">
            User Management
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Search accounts and block or unblock users as needed.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name/email/phone"
              className="sm:col-span-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
        </section>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="space-y-3">
          {loading ? <p className="text-sm text-[var(--muted)]">Loading users...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="card-surface text-sm text-[var(--muted)]">
              No users found for this filter.
            </p>
          ) : null}

          {!loading &&
            items.map((user) => {
              const isBusy = busyUserId === user._id;
              const isBlocked = Boolean(user?.isBlocked);
              return (
                <article key={user._id} className="card-surface">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text)]">
                        {user?.name || "Unnamed user"}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {user?.email || "-"} | {user?.phone || "-"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Role: {user?.role || "-"} | Joined:{" "}
                        {formatDate(user?.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isBlocked
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isBlocked ? "Blocked" : "Active"}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleBlock(user._id, isBlocked)}
                        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[#F2EEDF] disabled:opacity-60"
                      >
                        {isBlocked ? "Unblock" : "Block"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </section>
      </div>
    </div>
  );
}

export default AdminUsers;
