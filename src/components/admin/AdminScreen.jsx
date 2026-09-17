import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { BG, TEAL, INK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import SummaryTab from "./SummaryTab.jsx";
import UsersTab from "./UsersTab.jsx";
import ProductsTab from "./ProductsTab.jsx";
import InventoryTab from "./InventoryTab.jsx";
import HistoryTab from "./HistoryTab.jsx";
import PaymentsTab from "./PaymentsTab.jsx";
import BranchesTab from "./BranchesTab.jsx";

const BRANCH_SCOPED_TABS = [
  { id: "summary", label: "Summary" },
  { id: "users", label: "Users" },
  { id: "products", label: "Manage Products" },
  { id: "inventory", label: "Inventory" },
  { id: "history", label: "Sales History" },
  { id: "payments", label: "Payment" },
];

export default function AdminScreen({ onLogout }) {
  const { currentUser, branches, activeBranchId, chooseBranch, activeBranch } = useSupabaseData();
  const isOverallAdmin = currentUser.role === "overall_admin";
  const [tab, setTab] = useState(isOverallAdmin && !activeBranchId ? "branches" : "summary");
  const [feed, setFeed] = useState("");

  const notify = (text) => {
    setFeed(text);
    setTimeout(() => setFeed(""), 5000);
  };

  const tabs = isOverallAdmin ? [...BRANCH_SCOPED_TABS, { id: "branches", label: "Branches" }] : BRANCH_SCOPED_TABS;
  const needsBranch = isOverallAdmin && !activeBranchId && tab !== "branches";

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: INK }}>
      <div style={{ background: TEAL, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <button onClick={onLogout} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <LogOut size={15} /> Sign out
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{isOverallAdmin ? "Overall Admin" : activeBranch?.name || "Admin Dashboard"}</div>
          {!isOverallAdmin && <div style={{ fontSize: 11.5, opacity: 0.8 }}>{activeBranch?.address}</div>}
        </div>
        {isOverallAdmin ? (
          <select
            value={activeBranchId}
            onChange={(e) => chooseBranch(e.target.value)}
            style={{ ...inputStyle, width: 200, background: "#fff" }}
          >
            <option value="">Select a branch to manage…</option>
            {branches.map((b) => <option key={b.branchId} value={b.branchId}>{b.name}</option>)}
          </select>
        ) : (
          <div style={{ width: 90 }} />
        )}
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: 190, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {tabs.map((t) => (
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
          {needsBranch ? (
            <div style={{ color: "#8a938f", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
              {branches.length === 0
                ? <>No branches yet — head to the <strong>Branches</strong> tab to create the first one.</>
                : <>Pick a branch from the dropdown above to manage its products, users, sales and payments.</>}
            </div>
          ) : (
            <>
              {tab === "summary" && <SummaryTab />}
              {tab === "users" && <UsersTab notify={notify} />}
              {tab === "products" && <ProductsTab notify={notify} />}
              {tab === "inventory" && <InventoryTab notify={notify} />}
              {tab === "history" && <HistoryTab />}
              {tab === "payments" && <PaymentsTab notify={notify} />}
              {tab === "branches" && isOverallAdmin && <BranchesTab notify={notify} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}