import React from "react";
import { TEAL_DARK } from "../../theme.js";
import { naira } from "../../utils/format.js";
import { StatusBadge } from "../common/UI.jsx";
import Barcode from "./Barcode.jsx";

const ReceiptRow = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ color: "#666" }}>{k}</span>
    <span>{v}</span>
  </div>
);

export default function Receipt({ receiptNo, cart, customer, cashier, pmtType, status, total, branch }) {
  const name = branch?.name || "Mai_Ganima Energiez";
  const address = branch?.address || "No.2 XR, Nizzan Zamani";
  const phone = branch?.phone || "+2348033457853";

  return (
    <div style={{ width: 300, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", fontSize: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ color: "#2E9E4F", fontWeight: 700, fontSize: 13 }}>SALES RECEIPT</div>
        <div style={{ fontWeight: 700, marginTop: 2 }}>{name}</div>
        <div style={{ color: "#666" }}>{address}</div>
      </div>
      <div style={{ borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "8px 0", lineHeight: 1.7 }}>
        <ReceiptRow k="Receipt ID:" v={receiptNo} />
        <ReceiptRow k="Tel:" v={phone} />
        <ReceiptRow k="Customer:" v={customer} />
        {status === "paid" && <ReceiptRow k="Payment:" v={pmtType} />}
        <ReceiptRow k="Cashier:" v={cashier} />
        <ReceiptRow k="Date:" v={new Date().toLocaleString()} />
        {status && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#666" }}>Status:</span>
            <StatusBadge status={status} />
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontWeight: 700, padding: "8px 0 4px", borderBottom: "2px solid #2E9E4F" }}>
        <div>Product</div>
        <div style={{ textAlign: "right" }}>Price</div>
        <div style={{ textAlign: "right" }}>Qty</div>
        <div style={{ textAlign: "right" }}>Total</div>
      </div>
      {cart.map((r) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "4px 0" }}>
          <div>{r.product}</div>
          <div style={{ textAlign: "right" }}>{r.price.toFixed(2)}</div>
          <div style={{ textAlign: "right" }}>{r.qty}</div>
          <div style={{ textAlign: "right" }}>{r.total.toFixed(2)}</div>
        </div>
      ))}
      <div style={{ textAlign: "center", background: TEAL_DARK, color: "#fff", borderRadius: 6, padding: "6px 0", marginTop: 10, fontWeight: 700 }}>
        Total: {naira(total)}
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <Barcode value={receiptNo} />
      </div>
      <div style={{ textAlign: "center", marginTop: 10, color: "#444" }}>
        <div>Thanks for your patronage</div>
        <div>Please call again!</div>
      </div>
    </div>
  );
}
