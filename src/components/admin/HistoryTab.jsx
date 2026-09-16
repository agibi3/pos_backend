import React, { useEffect, useState } from "react";
import { Search, RefreshCcw } from "lucide-react";
import { TEAL, TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, DataTable, SmallBtn, StatusBadge, Modal } from "../common/UI.jsx";

function UpdateStatusModal({ onClose, notify }) {
  const { getSaleByReceipt, updateRow, refresh } = useSupabaseData();
  const [receiptNo, setReceiptNo] = useState("");
  const [sale, setSale] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const lookup = async () => {
    if (!receiptNo.trim()) return;
    setBusy(true);
    setErr("");
    setSale(null);
    try {
      const result = await getSaleByReceipt(receiptNo.trim());
      setSale(result);
    } catch (e) {
      setErr(e.message || "Receipt not found");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (status) => {
    setBusy(true);
    try {
      await updateRow("history", { status }, "receipt_no", sale.receipt_no);
      await refresh();
      notify(`Receipt ${sale.receipt_no} marked ${status.replace("_", " ")}`);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Update payment status" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          autoFocus
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Enter receipt / transaction ID"
          style={inputStyle}
        />
        <SmallBtn onClick={lookup} disabled={busy}>Find</SmallBtn>
      </div>

      {err && <div style={{ color: "#B3261E", fontSize: 13, marginBottom: 10 }}>{err}</div>}

      {sale && (
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Receipt:</strong> {sale.receipt_no}</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Customer:</strong> {sale.customer}</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Cashier:</strong> {sale.cashier}</div>
          <div style={{ fontSize: 13, marginBottom: 10 }}><strong>Total:</strong> {naira(sale.total)}</div>
          <div style={{ fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Current status:</strong> <StatusBadge status={sale.status} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => apply("paid")} disabled={busy} style={{ flex: 1, background: "#2E9E4F", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 600, cursor: "pointer" }}>Paid</button>
            <button onClick={() => apply("not_paid")} disabled={busy} style={{ flex: 1, background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 600, cursor: "pointer" }}>Not paid</button>
            <button onClick={() => apply("cancelled")} disabled={busy} style={{ flex: 1, background: "#8a938f", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function HistoryTab() {
  const { history, getSales } = useSupabaseData();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState(history);
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [feed, setFeed] = useState("");

  const notify = (text) => {
    setFeed(text);
    setTimeout(() => setFeed(""), 5000);
  };

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

  const displayed = rows.map((r) => ({
    ...r,
    date: (r.date || "").slice(0, 19).replace("T", " "),
    price: naira(r.price),
    total: naira(r.total),
    status: <StatusBadge status={r.status} />,
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: TEAL_DARK }}>Sales history</h2>
        <SmallBtn onClick={() => setShowModal(true)}>Update payment status</SmallBtn>
      </div>

      {feed && <div style={{ color: TEAL, fontSize: 13, marginBottom: 12 }}>{feed}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, maxWidth: 420 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "#9aa3a0" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)} placeholder="Search by receipt ID" style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <SmallBtn onClick={() => load(1)} disabled={busy}>Search</SmallBtn>
        <button onClick={() => load(page, search.trim())} disabled={busy} title="Refresh" style={{ border: "1px solid #DDE3E1", background: "#fff", borderRadius: 8, padding: "0 12px", cursor: "pointer" }}>
          <RefreshCcw size={15} />
        </button>
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

      {showModal && <UpdateStatusModal onClose={() => setShowModal(false)} notify={notify} />}
    </div>
  );
}
