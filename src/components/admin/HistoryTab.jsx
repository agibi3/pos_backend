import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { TEAL, TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, DataTable, SmallBtn } from "../common/UI.jsx";

export default function HistoryTab() {
  const { history, getSales, updateRow } = useSupabaseData();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState(history);
  const [busy, setBusy] = useState(false);

  const load = async (targetPage = page, receipt = search.trim()) => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), page_size: "50" });
      if (receipt) params.set("receipt_no", receipt);
      const result = await getSales(params.toString());
      setRows(result.items);
      setPages(result.pages || 1);
      setPage(result.page || targetPage);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(1, ""); }, []);

  const changeStatus = async (receiptNo, status) => {
    try {
      await updateRow("history", { status }, "receipt_no", receiptNo);
      await load(page, search.trim());
    } catch (e) {
      alert(e.message);
    }
  };

  const displayed = rows.map((r) => ({
    ...r,
    date: (r.date || "").slice(0, 19).replace("T", " "),
    price: naira(r.price),
    total: naira(r.total),
    status: (
      <select value={r.status || "paid"} onChange={(e) => changeStatus(r.receipt_no, e.target.value)} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "3px 5px" }}>
        <option value="paid">Paid</option><option value="pending">Pending</option><option value="not_paid">Not paid</option><option value="cancelled">Cancelled</option>
      </select>
    ),
  }));

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Sales history</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, maxWidth: 420 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#9aa3a0" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} placeholder="Search by receipt ID" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <SmallBtn onClick={() => load(1)} disabled={busy}>Search</SmallBtn>
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "receipt_no", label: "ID", width: "0.6fr" }, { key: "date", label: "Date", width: "1.4fr" },
            { key: "pmt_type", label: "Pmt type", width: "0.9fr" }, { key: "customer", label: "Customer", width: "1fr" },
            { key: "cashier", label: "Cashier", width: "1fr" }, { key: "prod", label: "Product", width: "1.2fr" },
            { key: "price", label: "Price", width: "0.8fr" }, { key: "qty", label: "Qty", width: "0.6fr" },
            { key: "total", label: "Total", width: "0.9fr" }, { key: "status", label: "Status", width: "1fr" },
          ]}
          rows={displayed}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, fontSize: 13 }}>
          <span>Page {page} of {pages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={page <= 1 || busy} onClick={() => load(page - 1)} style={{ padding: "6px 10px" }}>Previous</button>
            <button disabled={page >= pages || busy} onClick={() => load(page + 1)} style={{ padding: "6px 10px" }}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
