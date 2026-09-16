import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TEAL, TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, EmptyState } from "../common/UI.jsx";

export default function SummaryTab() {
  const { apiUrl, token, activeBranchId } = useSupabaseData();
  const [period, setPeriod] = useState("weekly");
  const [summary, setSummary] = useState({ chart: [], total_sales: 0, paid_sales: 0, outstanding: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeBranchId) return;
    let active = true;
    fetch(`${apiUrl}/summary?period=${period}&branch_id=${encodeURIComponent(activeBranchId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.detail || "Unable to load summary"); return body; })
      .then((body) => { if (active) { setSummary(body); setError(""); } })
      .catch((e) => active && setError(e.message)) ;
    return () => { active = false; };
  }, [apiUrl, token, period, activeBranchId]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: TEAL_DARK }}>Summary</h2>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ ...inputStyle, width: 130 }}>
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
        </select>
      </div>
      {error && <div style={{ color: "#B3261E", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          ["Sales", summary.total_sales],
          ["Paid", summary.paid_sales],
          ["Outstanding", summary.outstanding],
        ].map(([label, value]) => (
          <Card key={label} style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: 12.5, color: "#8a938f", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: TEAL_DARK }}>{naira(value)}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontSize: 13, color: "#8a938f", marginBottom: 8 }}>Sales ({period})</div>
        {!summary.chart.length ? <EmptyState text="No sales in this period yet." /> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary.chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
              <Tooltip formatter={(v) => naira(v)} /><Bar dataKey="value" fill={TEAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
