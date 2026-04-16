import { useEffect, useMemo, useState } from "react";
import { fetchPhotographerEarnings } from "../services/bookingService";
import { pageThemeVars } from "../styles/themeVars";

function formatCurrency(value, currency = "INR") {
  return `${currency} ${Number(value || 0).toLocaleString("en-IN")}`;
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

function formatStatus(status = "") {
  return String(status)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PhotographerEarnings() {
  const [data, setData] = useState({
    summary: {
      currency: "INR",
      totalGross: 0,
      totalCompletedBookings: 0,
      thisMonthGross: 0,
      thisMonthCompletedBookings: 0,
      pendingDeliveries: 0,
      pendingPotentialGross: 0,
    },
    trend: [],
    recentCompleted: [],
    pendingDeliveryQueue: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchPhotographerEarnings();
        if (!isMounted) return;
        setData({
          summary: response?.summary || data.summary,
          trend: response?.trend || [],
          recentCompleted: response?.recentCompleted || [],
          pendingDeliveryQueue: response?.pendingDeliveryQueue || [],
        });
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.message || "Failed to load earnings.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxTrend = useMemo(
    () => Math.max(...data.trend.map((item) => Number(item?.gross || 0)), 1),
    [data.trend],
  );

  const cards = [
    {
      title: "Total Gross",
      value: formatCurrency(data.summary.totalGross, data.summary.currency),
      hint: `${data.summary.totalCompletedBookings} completed bookings`,
    },
    {
      title: "This Month",
      value: formatCurrency(data.summary.thisMonthGross, data.summary.currency),
      hint: `${data.summary.thisMonthCompletedBookings} completed this month`,
    },
    {
      title: "Pending Deliveries",
      value: String(data.summary.pendingDeliveries || 0),
      hint: "Deliveries not yet customer confirmed",
    },
    {
      title: "Pending Potential",
      value: formatCurrency(
        data.summary.pendingPotentialGross,
        data.summary.currency,
      ),
      hint: "Potential conversion from in-progress deliveries",
    },
  ];

  return (
    <div
      className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] px-4 py-8 text-[var(--text)] sm:px-6 lg:px-8"
      style={pageThemeVars}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="card-hero sm:p-8">
          <p className="label-uppercase-lg">Photographer Workflow</p>
          <h1 className="mt-2 font-[Georgia,Times,'Times_New_Roman',serif] text-3xl sm:text-4xl">
            Earnings Overview
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Track completed booking revenue and expected payout from pending
            deliveries.
          </p>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.title} className="card-surface">
              <p className="label-uppercase">{card.title}</p>
              <p className="mt-3 text-2xl font-semibold">
                {loading ? "..." : card.value}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.hint}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <article className="card-surface lg:col-span-3">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Booking Gross Trend (6 Months)
            </h2>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Loading trend...</p>
            ) : null}
            {!loading && data.trend.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                No trend data available yet.
              </p>
            ) : null}
            {!loading && data.trend.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.trend.map((point) => {
                  const gross = Number(point?.gross || 0);
                  const percent = Math.round((gross / maxTrend) * 100);
                  return (
                    <article key={point.month} className="card-white">
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {point.month}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[var(--text)]">
                        {formatCurrency(gross, data.summary.currency)}
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-[#E8E3D6]">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </article>

          <article className="card-surface lg:col-span-2">
            <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
              Pending Delivery Queue
            </h2>
            <ul className="mt-4 space-y-3">
              {loading ? (
                <li className="card-white text-sm text-[var(--muted)]">Loading...</li>
              ) : null}
              {!loading && data.pendingDeliveryQueue.length === 0 ? (
                <li className="card-white text-sm text-[var(--muted)]">
                  No active deliveries in queue.
                </li>
              ) : null}
              {data.pendingDeliveryQueue.map((item) => (
                <li key={item._id} className="card-white">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {item.bookingCode}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatStatus(item.status)}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="card-surface">
          <h2 className="font-[Georgia,Times,'Times_New_Roman',serif] text-2xl">
            Recent Completed Bookings
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading completed bookings...</p>
          ) : null}
          {!loading && data.recentCompleted.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              No completed bookings yet.
            </p>
          ) : null}
          {!loading && data.recentCompleted.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.recentCompleted.map((item) => (
                <article key={item._id} className="card-white">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {item.bookingCode} | {formatStatus(item.eventType)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Customer: {item.customerName} | Completed:{" "}
                        {formatDate(item.completedAt)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {formatCurrency(item.amount, item.currency)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default PhotographerEarnings;
