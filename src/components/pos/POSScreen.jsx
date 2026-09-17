import React, { useEffect, useState } from "react";
import { LogOut, Printer, ShoppingCart, RotateCcw } from "lucide-react";
import { BG, TEAL, TEAL_DARK, AMBER, INK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { ActionBtn, FieldLabel, Select, ConfirmDialog } from "../common/UI.jsx";
import Receipt from "./Receipt.jsx";
import ReprintScreen from "./ReprintScreen.jsx";

const PAYMENT_STATUSES = [
  { value: "order", label: "Order (not settled yet)" },
  { value: "paid", label: "Paid" },
  { value: "not_paid", label: "Not paid" },
];

export default function POSScreen({ cashier, onLogout }) {
  const { products, insertRows, refresh, activeBranch } = useSupabaseData();

  const [screen, setScreen] = useState("sell"); // 'sell' | 'reprint'
  const [cart, setCart] = useState([]);
  const [product, setProduct] = useState("");
  const [prodId, setProdId] = useState("");
  const [priceType, setPriceType] = useState("retail"); // 'retail' | 'bulk'
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [total, setTotal] = useState("");
  const [customer, setCustomer] = useState("Customer");
  const [pmtType, setPmtType] = useState("Cash");
  const [pmtStatus, setPmtStatus] = useState("paid");
  const [feed, setFeed] = useState("");
  const [receiptNo, setReceiptNo] = useState("1001");
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null); // 'all' | 'last' | null

  useEffect(() => {
    if (!feed) return;
    const t = setTimeout(() => setFeed(""), 4000);
    return () => clearTimeout(t);
  }, [feed]);

  const cartTotal = cart.reduce((s, r) => s + r.total, 0);

  const handleProductPick = (name) => {
    setProduct(name);
    const p = products.find((p) => p.prod_name === name);
    setProdId(p ? p.prod_id : "");
    setPrice(p ? String(priceType === "bulk" ? p.bulk_price : p.prod_price) : "");
  };

  const handlePriceTypeChange = (type) => {
    setPriceType(type);
    const p = products.find((p) => p.prod_name === product);
    if (p) setPrice(String(type === "bulk" ? p.bulk_price : p.prod_price));
  };

  const addToCart = () => {
    if (!product || !price || (!qty && !total)) {
      setFeed("Please select a product, and enter quantity or a total price");
      return;
    }
    const priceNum = parseFloat(price);
    const qtyNum = qty ? parseFloat(qty) : parseFloat(total) / priceNum;
    const totalNum = qty ? priceNum * qtyNum : parseFloat(total);
    if (isNaN(qtyNum) || isNaN(totalNum)) {
      setFeed("That quantity or total isn't valid");
      return;
    }
    setCart((c) => [
      ...c,
      { id: crypto.randomUUID(), product, prod_id: prodId || null, price: priceNum, qty: Math.round(qtyNum * 100) / 100, total: Math.round(totalNum * 100) / 100 },
    ]);
    setProduct("");
    setProdId("");
    setPriceType("retail");
    setPrice("");
    setQty("");
    setTotal("");
  };

  const clearAll = () => {
    setCart([]);
    setConfirmClear(null);
  };
  const clearLast = () => {
    setCart((c) => c.slice(0, -1));
    setConfirmClear(null);
  };

  const printReceipt = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const rows = cart.map((item) => ({
        receipt_no: "",
        date: new Date().toISOString(),
        pmt_type: pmtType,
        customer,
        cashier,
        prod: item.product,
        prod_id: item.prod_id || null,
        price: item.price,
        qty: item.qty,
        total: item.total,
        status: pmtStatus,
      }));
      const saved = await insertRows("history", rows);
      const assignedReceipt = String(saved[0]?.receipt_no || receiptNo);
      setReceiptNo(assignedReceipt);
      // The server assigns the receipt number atomically. Give React one paint before printing.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      window.print();
      await refresh();
      setCart([]);
      setFeed("Receipt saved and sent to print");
    } catch (e) {
      setFeed("Saved locally, but the server didn't confirm — check your connection");
    } finally {
      setSaving(false);
    }
  };

  if (screen === "reprint") {
    return <ReprintScreen cashier={cashier} onBack={() => setScreen("sell")} onLogout={onLogout} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: INK }}>
      <div className="no-print" style={{ background: TEAL, color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13 }}>
          <span style={{ opacity: 0.75 }}>Cashier </span>
          <strong>{cashier}</strong>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, color: AMBER }}>{activeBranch?.name || "Mai_Ganima Energiez Transacts"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setScreen("reprint")} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <RotateCcw size={15} /> Reprint
          </button>
          <button onClick={onLogout} style={{ background: "#C0392B", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      </div>

      {feed && <div className="no-print" style={{ textAlign: "center", color: "#B3261E", fontWeight: 600, padding: "8px 0", fontSize: 13.5 }}>{feed}</div>}

      <div className="no-print" style={{ display: "flex", gap: 18, padding: 20, alignItems: "flex-start", flexWrap: "wrap", overflowX: "auto" }}>
        <div style={{ flex: "1 1 560px", minWidth: 340 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <ActionBtn color="#C0392B" onClick={() => setConfirmClear("all")}>Clear All</ActionBtn>
            <ActionBtn color={TEAL} onClick={addToCart} icon={<ShoppingCart size={15} />}>Add to Cart</ActionBtn>
            <ActionBtn color="#2E9E4F" onClick={printReceipt} icon={<Printer size={15} />} disabled={saving}>
              {saving ? "Saving…" : "Print"}
            </ActionBtn>
            <ActionBtn color="#C0392B" onClick={() => setConfirmClear("last")}>Clear Last Row</ActionBtn>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Select label="Customer" value={customer} onChange={setCustomer} options={["Customer", "Vinerate Gas", "Sunshine Gas"]} allowCustom />
            <Select label="Payment" value={pmtType} onChange={setPmtType} options={["Cash", "Check", "Card"]} />
            <div style={{ flex: 1 }}>
              <FieldLabel>Payment status</FieldLabel>
              <select value={pmtStatus} onChange={(e) => setPmtStatus(e.target.value)} style={inputStyle}>
                {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <FieldLabel>Product</FieldLabel>
                <select value={product} onChange={(e) => handleProductPick(e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.prod_id} value={p.prod_name}>{p.prod_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Price type</FieldLabel>
                <select value={priceType} onChange={(e) => handlePriceTypeChange(e.target.value)} style={inputStyle}>
                  <option value="retail">End-user</option>
                  <option value="bulk">Bulk</option>
                </select>
              </div>
              <div>
                <FieldLabel>Price</FieldLabel>
                <input value={price} readOnly style={{ ...inputStyle, background: "#F5F5F5", textAlign: "right" }} />
              </div>
              <div>
                <FieldLabel>Quantity</FieldLabel>
                <input
                  value={qty}
                  onChange={(e) => { setQty(e.target.value); if (e.target.value) setTotal(""); }}
                  style={{ ...inputStyle, textAlign: "right" }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <FieldLabel>Total</FieldLabel>
                <input
                  value={total}
                  onChange={(e) => { setTotal(e.target.value); if (e.target.value) setQty(""); }}
                  style={{ ...inputStyle, textAlign: "right" }}
                  placeholder="0.00"
                  onKeyDown={(e) => e.key === "Enter" && addToCart()}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 14px", background: TEAL_DARK, color: "#fff", fontSize: 12.5, fontWeight: 600 }}>
              <div>Product</div>
              <div style={{ textAlign: "right" }}>Price</div>
              <div style={{ textAlign: "right" }}>Qty</div>
              <div style={{ textAlign: "right" }}>Total</div>
            </div>
            {cart.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94A19E", fontSize: 13 }}>Cart is empty — add a product above.</div>
            ) : (
              cart.map((row) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "9px 14px", fontSize: 13.5, borderTop: "1px solid #F0F0EE" }}>
                  <div>{row.product}</div>
                  <div style={{ textAlign: "right" }}>{row.price.toFixed(2)}</div>
                  <div style={{ textAlign: "right" }}>{row.qty}</div>
                  <div style={{ textAlign: "right" }}>{row.total.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: "0 0 320px", width: 320 }}>
          <Receipt receiptNo={receiptNo} cart={cart} customer={customer} cashier={cashier} pmtType={pmtType} status={pmtStatus} total={cartTotal} branch={activeBranch} />
        </div>
      </div>

      {/* print-only receipt */}
      <div className="print-only">
        <Receipt receiptNo={receiptNo} cart={cart} customer={customer} cashier={cashier} pmtType={pmtType} status={pmtStatus} total={cartTotal} branch={activeBranch} />
      </div>

      {confirmClear && (
        <div className="no-print">
          <ConfirmDialog
            message={confirmClear === "all" ? "Clear the whole cart?" : "Remove the last item?"}
            onYes={confirmClear === "all" ? clearAll : clearLast}
            onNo={() => setConfirmClear(null)}
          />
        </div>
      )}

      <style>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}