import { useEffect, useReducer } from "react";
import { pageThemeVars } from "../styles/themeVars";
import { SAFE_API_URL, apiCall, parseResponse } from "../services/apiClient";

async function fetchPayouts(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await apiCall(`${SAFE_API_URL}/admin/payouts${q ? `?${q}` : ""}`);
  return parseResponse(res, "Failed to fetch payouts.");
}

async function fetchPayoutSummary() {
  const res = await apiCall(`${SAFE_API_URL}/admin/payouts/summary`);
  return parseResponse(res, "Failed to fetch payout summary.");
}

async function createPayout(payload) {
  const res = await apiCall(`${SAFE_API_URL}/admin/payouts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseResponse(res, "Failed to create payout.");
}

async function updatePayoutStatus(payoutId, status, note = "") {
  const res = await apiCall(`${SAFE_API_URL}/admin/payouts/${payoutId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
  return parseResponse(res, "Failed to update payout.");
}

const initialState = {
  payouts: [],
  summary: null,
  loading: true,
  error: "",
  message: "",
  statusFilter: "",
  form: { photographerId: "", amount: "", currency: "INR", note: "" },
  saving: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, payouts: action.payouts, summary: action.summary };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "SET_FILTER":
      return { ...state, statusFilter: action.payload };
    case "SET_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    case "SAVE_START":
      return { ...state, saving: true, error: "", message: "" };
    case "SAVE_SUCCESS":
      return { ...state, saving: false, message: action.payload, payouts: action.payouts, summary: action.summary, form: initialState.form };
    case "SAVE_ERROR":
      return { ...state, saving: false, error: action.payload };
    default:
      return state;
  }
}

function statusBadge(status) {
  const map = {
    pending: "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-blue-700",
    paid: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };
  return `rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${map[status] || "bg-gray-50 text-gray-700"}`;
}

function AdminPayouts() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = async (statusFilter = state.statusFilter) => {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const [data, summary] = await Promise.all([fetchPayouts(params), fetchPayoutSummary()]);
      dispatch({ type: "LOAD_SUCCESS", payouts: data.items || [], summary });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", payload: error.message });
    }
  };

  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = async (value) => {
    dispatch({ type: "SET_FILTER", payload: value });
    const params = value ? { status: value } : {};
    try {
      const data = await fetchPayouts(params);
      dispatch({ type: "LOAD_SUCCESS", payouts: data.items || [], summary: state.summary });
    } catch (error) {
      dispatch({ type: "LOAD_ERROR", payload: error.message });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    dispatch({ type: "SAVE_START" });
    try {
      await createPayout({
        photographerId: state.form.photographerId.trim(),
        amount: Number(state.form.amount),
        currency: state.form.currency,
        note: state.form.note,
      });
      const [data, summary] = await Promise.all([fetchPayouts(), fetchPayoutSummary()]);
      dispatch({ type: "SAVE_SUCCESS", payload: "Payout created.", payouts: data.items || [], summary });
    } catch (error) {
      dispatch({ type: "SAVE_ERROR", payload: error.message });
    }
  };

  const handleStatusUpdate = async (payoutId, status) => {
    try {
      await updatePayoutStatus(payoutId, status);
      await load();
    } catch (error) {
      dispatch({ type: "SAVE_ERROR", payload: error.message });
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8" style={pageThemeVars}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="card-hero sm:p-8">
          <p className="label-uppercase-lg">Admin</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl">Payout Management</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Track and manage photographer payouts.</p>
        </section>

        {state.summary && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Pending", value: state.summary.pending, cls: "text-amber-700" },
              { label: "Processing", value: state.summary.processing, cls: "text-blue-700" },
              { label: "Paid", value: state.summary.paid, cls: "text-emerald-700" },
              { label: "Total Paid (INR)", value: `₹${state.summary.totalPaid?.toLocaleString("en-IN")}`, cls: "text-[var(--accent)]" },
            ].map((c) => (
              <article key={c.label} className="card-surface">
                <p className="label-uppercase">{c.label}</p>
                <p className={`mt-2 text-2xl font-semibold ${c.cls}`}>{c.value}</p>
              </article>
            ))}
          </section>
        )}

        <section className="card-surface">
          <h2 className="text-lg font-semibold text-[var(--text)]">Create Payout</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              placeholder="Photographer Profile ID"
              value={state.form.photographerId}
              onChange={(e) => dispatch({ type: "SET_FORM", payload: { photographerId: e.target.value } })}
              className="form-input border-[var(--line)]"
              required
            />
            <input
              type="number"
              placeholder="Amount"
              value={state.form.amount}
              onChange={(e) => dispatch({ type: "SET_FORM", payload: { amount: e.target.value } })}
              className="form-input border-[var(--line)]"
              required
              min="1"
            />
            <input
              placeholder="Note (optional)"
              value={state.form.note}
              onChange={(e) => dispatch({ type: "SET_FORM", payload: { note: e.target.value } })}
              className="form-input border-[var(--line)]"
            />
            <button type="submit" disabled={state.saving} className="btn-primary disabled:opacity-70">
              {state.saving ? "Creating..." : "Create Payout"}
            </button>
          </form>
          {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
          {state.message && <p className="mt-3 text-sm text-emerald-700">{state.message}</p>}
        </section>

        <section className="card-surface">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text)]">Payouts</h2>
            <select
              value={state.statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="form-input w-40 border-[var(--line)]"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {state.loading ? (
            <p className="text-sm text-[var(--muted)]">Loading...</p>
          ) : state.payouts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No payouts found.</p>
          ) : (
            <div className="space-y-3">
              {state.payouts.map((payout) => (
                <article key={payout._id} className="card-white">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text)]">
                        {payout.photographerId?.businessName || "Photographer"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {payout.currency} {Number(payout.amount).toLocaleString("en-IN")}
                        {payout.note ? ` · ${payout.note}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(payout.createdAt).toLocaleDateString("en-IN")}
                        {payout.paidAt ? ` · Paid ${new Date(payout.paidAt).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={statusBadge(payout.status)}>{payout.status}</span>
                      {payout.status === "pending" && (
                        <button type="button" onClick={() => handleStatusUpdate(payout._id, "processing")}
                          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-[#F2EEDF]">
                          Mark Processing
                        </button>
                      )}
                      {payout.status === "processing" && (
                        <button type="button" onClick={() => handleStatusUpdate(payout._id, "paid")}
                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]">
                          Mark Paid
                        </button>
                      )}
                      {["pending", "processing"].includes(payout.status) && (
                        <button type="button" onClick={() => handleStatusUpdate(payout._id, "failed")}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                          Mark Failed
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminPayouts;
