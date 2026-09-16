import React from "react";
import { TEAL_DARK } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira, parseAmt } from "../../utils/format.js";
import { Card, EmptyState } from "../common/UI.jsx";

export default function PaymentsTab() {
  const { payments } = useSupabaseData();
  const total = payments.reduce((sum, p) => sum + parseAmt(p.value), 0);

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Payments</h2>
      <Card>
        {total === 0 ? (
          <EmptyState text="No paid sales recorded yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payments.map((p, i) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i === payments.length - 1 ? "none" : "1px solid #eee" }}>
                <span>{p.name}</span><strong>{naira(p.value)}</strong>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, fontWeight: 700 }}>
              <span>Total paid</span><span>{naira(total)}</span>
            </div>
          </div>
        )}
      </Card>
      <div style={{ color: "#7a8581", fontSize: 12.5, marginTop: 10 }}>Payment totals are calculated directly from paid sales in SalesHistory.</div>
    </div>
  );
}
