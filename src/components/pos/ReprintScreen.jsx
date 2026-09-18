import React, { useState } from "react";
import { LogOut, Printer, Search, ArrowLeft } from "lucide-react";
import { BG, TEAL, INK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { ActionBtn, FieldLabel, StatusBadge, ConfirmDialog } from "../common/UI.jsx";
import Receipt from "./Receipt.jsx";

export default function ReprintScreen({ cashier, onBack, onLogout }) {
  const { getSaleByReceipt, setPaymentStatus, activeBranch } = useSupabaseData();
  const [receiptNo, setReceiptNo] = useState("");
  const [sale, setSale] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  const lookup = async () => {
    if (!receiptNo.trim()) return;
    setBusy(true);
    setFeed("");
    setSale(null);
    try {
      const result = await getSaleByReceipt(receiptNo.trim());
      setSale(result);
    } catch (e) {
      setFeed(e.message || "Receipt not found");
    } finally {
      setBusy(false);
    }
  };

  const markStatus = async (status) => {
    setBusy(true);
    try {
      await setPaymentStatus(sale.receipt_no, status);
      setSale({ ...sale, status });
      setFeed(`Marked ${status === "paid" ? "paid" : "not paid"} — you can reprint now`);
    } catch (e) {
      setFeed(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reprint = async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    window.print();
  };

  const cartFromSale = sale
    ? sale.items.map((it, i) => ({ id: `${sale.receipt_no}-${i}`, product: it.product, price: it.price, qty: it.qty, total: it.total }))
    : [];

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: INK }}>
      <div className="no-print" style={{ background: TEAL, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={15} /> Back to till
        </button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Reprint a receipt</div>
        <button onClick={() => setConfirmLogout(true)} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <LogOut size={15} /> Log out
        </button>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 18, padding: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", minWidth: 300 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 14 }}>
            <FieldLabel>Receipt / transaction ID</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="e.g. 1024"
                style={inputStyle}
              />
              <ActionBtn color={TEAL} onClick={lookup} disabled={busy} icon={<Search size={15} />}>Find</ActionBtn>
            </div>
          </div>

          {feed && <div style={{ color: "#B3261E", fontWeight: 600, fontSize: 13.5, marginBottom: 12 }}>{feed}</div>}

          {sale && (
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <strong>Receipt {sale.receipt_no}</strong>
                <StatusBadge status={sale.status} />
              </div>

              {sale.status === "order" ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: "#6b7674", marginBottom: 8 }}>This order hasn't been settled yet — mark it before reprinting:</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => markStatus("paid")} disabled={busy} style={{ flex: 1, background: "#2E9E4F", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 600, cursor: "pointer" }}>Paid</button>
                    <button onClick={() => markStatus("not_paid")} disabled={busy} style={{ flex: 1, background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 600, cursor: "pointer" }}>Not paid</button>
                  </div>
                </div>
              ) : null}

              <ActionBtn color="#2E9E4F" onClick={reprint} icon={<Printer size={15} />}>Reprint</ActionBtn>
            </div>
          )}
        </div>

        {sale && (
          <Receipt
            receiptNo={sale.receipt_no}
            cart={cartFromSale}
            customer={sale.customer}
            cashier={sale.cashier}
            pmtType={sale.pmt_type}
            status={sale.status}
            total={sale.total}
            branch={activeBranch}
          />
        )}
      </div>

      {sale && (
        <div className="print-only">
          <Receipt
            receiptNo={sale.receipt_no}
            cart={cartFromSale}
            customer={sale.customer}
            cashier={sale.cashier}
            pmtType={sale.pmt_type}
            status={sale.status}
            total={sale.total}
            branch={activeBranch}
          />
        </div>
      )}

      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: auto; margin: 6mm; }
        }
      `}</style>

      {confirmLogout && (
        <ConfirmDialog
          message="Log out of the till?"
          onYes={onLogout}
          onNo={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}