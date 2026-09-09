import React, { useState } from "react";
import { TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, DataTable, FormRow, SmallBtn } from "../common/UI.jsx";

const FIELD_MAP = { "Prod ID": "prod_id", "Prod Name": "prod_name", "Unit Type": "unit_type", "Unit Price": "prod_price" };

export default function ProductsTab({ notify }) {
  const { products, insertRow, updateRow, refresh } = useSupabaseData();
  const [form, setForm] = useState({ prod_id: "", prod_name: "", unit_type: "", prod_price: "" });
  const [update, setUpdate] = useState({ field: "Prod Name", to: "", prod_id: "" });
  const [busy, setBusy] = useState(false);

  const addProduct = async () => {
    if (!form.prod_id || !form.prod_name || !form.unit_type || !form.prod_price) return notify("Fill all fields to add a product");
    setBusy(true);
    try {
      await insertRow("products", { ...form, prod_price: parseFloat(form.prod_price) });
      await refresh();
      setForm({ prod_id: "", prod_name: "", unit_type: "", prod_price: "" });
      notify("Product added successfully");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateProduct = async () => {
    if (!update.to || !update.prod_id) return notify("Fill all fields to update a product");
    setBusy(true);
    try {
      await updateRow("products", { [FIELD_MAP[update.field]]: update.to }, "prod_id", update.prod_id);
      await refresh();
      setUpdate({ field: "Prod Name", to: "", prod_id: "" });
      notify("Product updated successfully");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Manage products</h2>
      <Card style={{ marginBottom: 16 }}>
        <DataTable
          columns={[
            { key: "prod_id", label: "ID", width: "0.6fr" },
            { key: "prod_name", label: "Product", width: "1.4fr" },
            { key: "unit_type", label: "Unit type", width: "1fr" },
            { key: "prod_price", label: "Price", width: "1fr" },
          ]}
          rows={products.map((p) => ({ ...p, prod_price: naira(p.prod_price) }))}
        />
      </Card>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add product</div>
          <FormRow label="Product ID"><input style={inputStyle} value={form.prod_id} onChange={(e) => setForm({ ...form, prod_id: e.target.value })} /></FormRow>
          <FormRow label="Product name"><input style={inputStyle} value={form.prod_name} onChange={(e) => setForm({ ...form, prod_name: e.target.value })} /></FormRow>
          <FormRow label="Unit type"><input style={inputStyle} value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} /></FormRow>
          <FormRow label="Price"><input style={inputStyle} value={form.prod_price} onChange={(e) => setForm({ ...form, prod_price: e.target.value })} /></FormRow>
          <SmallBtn onClick={addProduct} disabled={busy}>Add product</SmallBtn>
        </Card>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Update product</div>
          <FormRow label="Field to change">
            <select style={inputStyle} value={update.field} onChange={(e) => setUpdate({ ...update, field: e.target.value })}>
              {Object.keys(FIELD_MAP).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Change to"><input style={inputStyle} value={update.to} onChange={(e) => setUpdate({ ...update, to: e.target.value })} /></FormRow>
          <FormRow label="Product ID"><input style={inputStyle} value={update.prod_id} onChange={(e) => setUpdate({ ...update, prod_id: e.target.value })} /></FormRow>
          <SmallBtn onClick={updateProduct} disabled={busy}>Update product</SmallBtn>
        </Card>
      </div>
    </div>
  );
}
