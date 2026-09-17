import React, { useState } from "react";
import { TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, FieldLabel, SmallBtn, EmptyState } from "../common/UI.jsx";

export default function InventoryTab({ notify }) {
  const { products, restockProduct, refresh } = useSupabaseData();
  const [prodId, setProdId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);

  const doRestock = async () => {
    const qtyNum = parseFloat(quantity);
    const costNum = parseFloat(unitCost);
    if (!prodId || !quantity || isNaN(qtyNum) || qtyNum <= 0) return notify("Pick a product and enter a valid quantity");
    if (!unitCost || isNaN(costNum) || costNum < 0) return notify("Enter the unit cost for this new stock");
    setBusy(true);
    try {
      await restockProduct(prodId, qtyNum, costNum);
      await refresh();
      setProdId("");
      setQuantity("");
      setUnitCost("");
      notify("Stock updated");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Inventory</h2>
      <Card style={{ marginBottom: 16 }}>
        {products.length === 0 ? (
          <EmptyState text="No products yet — add some in Manage Products first." />
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #EEECE6" }}>
            <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr 1fr 1fr 1fr", background: TEAL_DARK, color: "#fff", fontSize: 12, fontWeight: 600, padding: "9px 12px" }}>
              <div>ID</div>
              <div>Product</div>
              <div style={{ textAlign: "right" }}>Stock level</div>
              <div style={{ textAlign: "right" }}>Unit cost</div>
              <div style={{ textAlign: "right" }}>Avg cost</div>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {products.map((p, i) => (
                <div
                  key={p.prod_id}
                  style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr 1fr 1fr 1fr", padding: "8px 12px", fontSize: 13, borderTop: "1px solid #F2F1EC", background: i % 2 ? "#FAFAF7" : "#fff" }}
                >
                  <div>{p.prod_id}</div>
                  <div>{p.prod_name}</div>
                  <div style={{ textAlign: "right", fontWeight: 600, color: p.stock_level < 0 ? "#C0392B" : "inherit" }}>
                    {p.stock_level}
                    {p.stock_level < 0 && " (backorder)"}
                  </div>
                  <div style={{ textAlign: "right" }}>{naira(p.unit_cost)}</div>
                  <div style={{ textAlign: "right" }}>{naira(p.avg_cost)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Update stock (restock)</div>
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Product</FieldLabel>
          <select style={inputStyle} value={prodId} onChange={(e) => setProdId(e.target.value)}>
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.prod_id} value={p.prod_id}>{p.prod_name} ({p.prod_id})</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Quantity received</FieldLabel>
          <input style={inputStyle} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.00" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Unit cost of this new stock</FieldLabel>
          <input style={inputStyle} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0.00" />
        </div>
        <SmallBtn onClick={doRestock} disabled={busy}>{busy ? "Saving…" : "Add stock"}</SmallBtn>
      </Card>
    </div>
  );
}