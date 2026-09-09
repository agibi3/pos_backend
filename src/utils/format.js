export const naira = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function parseAmt(v) {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Buckets SalesHistory rows into weekly / monthly / yearly totals for the bar chart. */
export function aggregateByPeriod(history, period) {
  const now = new Date();
  const rows = history
    .map((r) => ({ dt: new Date(r.date), amt: parseAmt(r.total) }))
    .filter((r) => !isNaN(r.dt.getTime()));

  if (period === "weekly") {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sums = new Array(7).fill(0);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    rows.forEach(({ dt, amt }) => {
      if (dt >= weekStart) sums[dt.getDay()] += amt;
    });
    return labels.map((l, i) => ({ label: l, value: sums[i] }));
  }

  if (period === "monthly") {
    const weeks = 5;
    const sums = new Array(weeks).fill(0);
    rows.forEach(({ dt, amt }) => {
      if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) {
        const wom = Math.min(Math.floor((dt.getDate() - 1) / 7), weeks - 1);
        sums[wom] += amt;
      }
    });
    return sums.map((v, i) => ({ label: `W${i + 1}`, value: v }));
  }

  // yearly
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sums = new Array(12).fill(0);
  rows.forEach(({ dt, amt }) => {
    if (dt.getFullYear() === now.getFullYear()) sums[dt.getMonth()] += amt;
  });
  return labels.map((l, i) => ({ label: l, value: sums[i] }));
}
