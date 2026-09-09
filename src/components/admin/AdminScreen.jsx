import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { BG, TEAL, INK } from "../../theme.js";
import SummaryTab from "./SummaryTab.jsx";
import UsersTab from "./UsersTab.jsx";
import ProductsTab from "./ProductsTab.jsx";
import HistoryTab from "./HistoryTab.jsx";
import PaymentsTab from "./PaymentsTab.jsx";

const ADMIN_TABS = [
  { id: "summary", label: "Summary" },
  { id: "users", label: "Users" },
  { id: "products", label: "Manage Products" },
  { id: "history", label: "Sales History" },
  { id: "payments", label: "Payment" },
];

export default function AdminScreen({ onLogout }) {
  const [tab, setTab] = useState("summary");
  const [feed, setFeed] = useState("");

  const notify = (text) => {
    setFeed(text);
    setTimeout(() => setFeed(""), 5000);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: INK }}>
      <div style={{ background: TEAL, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onLogout} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <LogOut size={15} /> Sign out
        </button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Admin Dashboard</div>
        <div style={{ width: 90 }} />
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 190, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {ADMIN_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: tab === t.id ? TEAL : "transparent",
                color: tab === t.id ? "#fff" : INK,
                fontWeight: tab === t.id ? 600 : 500,
                fontSize: 13.5,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: "16px 24px 40px" }}>
          {feed && <div style={{ color: TEAL, fontSize: 13, marginBottom: 12 }}>{feed}</div>}
          {tab === "summary" && <SummaryTab />}
          {tab === "users" && <UsersTab notify={notify} />}
          {tab === "products" && <ProductsTab notify={notify} />}
          {tab === "history" && <HistoryTab />}
          {tab === "payments" && <PaymentsTab notify={notify} />}
        </div>
      </div>
    </div>
  );
}
