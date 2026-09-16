import React, { useState } from "react";
import { TEAL_DARK, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { Card, DataTable, FormRow, SmallBtn } from "../common/UI.jsx";

export default function BranchesTab({ notify }) {
  const { branches, createBranch, updateBranch, chooseBranch } = useSupabaseData();
  const [form, setForm] = useState({ branchId: "", name: "", address: "", phone: "" });
  const [edit, setEdit] = useState({ branchId: "", name: "", address: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const addBranch = async () => {
    if (!form.branchId || !form.name || !form.address || !form.phone) return notify("Fill all fields to add a branch");
    setBusy(true);
    try {
      await createBranch(form);
      notify(`Branch "${form.name}" created with its own admin/cashier side and its own tables`);
      setForm({ branchId: "", name: "", address: "", phone: "" });
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (b) => setEdit({ branchId: b.branchId, name: b.name, address: b.address, phone: b.phone });

  const saveEdit = async () => {
    setBusy(true);
    try {
      await updateBranch(edit.branchId, { name: edit.name, address: edit.address, phone: edit.phone });
      notify("Branch updated");
      setEdit({ branchId: "", name: "", address: "", phone: "" });
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Branches</h2>
      <Card style={{ marginBottom: 16 }}>
        <DataTable
          columns={[
            { key: "branchId", label: "ID", width: "0.7fr" },
            { key: "name", label: "Name", width: "1.2fr" },
            { key: "address", label: "Address", width: "1.6fr" },
            { key: "phone", label: "Phone", width: "1fr" },
            { key: "actions", label: "", width: "1fr" },
          ]}
          rows={branches.map((b) => ({
            ...b,
            actions: (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => chooseBranch(b.branchId)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #DDE3E1", background: "#fff", cursor: "pointer" }}>Manage</button>
                <button onClick={() => startEdit(b)} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #DDE3E1", background: "#fff", cursor: "pointer" }}>Edit</button>
              </div>
            ),
          }))}
        />
      </Card>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add branch</div>
          <FormRow label="Branch ID"><input style={inputStyle} placeholder="e.g. VI-01" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} /></FormRow>
          <FormRow label="Branch name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormRow>
          <FormRow label="Address (printed on receipts)"><input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></FormRow>
          <FormRow label="Phone (printed on receipts)"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormRow>
          <SmallBtn onClick={addBranch} disabled={busy}>Add branch</SmallBtn>
          <div style={{ fontSize: 12, color: "#8a938f", marginTop: 10 }}>
            Creating a branch also sets up its own admin/cashier side and its own products, sales history and receipt numbering — separate from every other branch.
          </div>
        </Card>

        {edit.branchId && (
          <Card style={{ flex: "1 1 320px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Edit {edit.branchId}</div>
            <FormRow label="Branch name"><input style={inputStyle} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></FormRow>
            <FormRow label="Address"><input style={inputStyle} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></FormRow>
            <FormRow label="Phone"><input style={inputStyle} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></FormRow>
            <div style={{ display: "flex", gap: 8 }}>
              <SmallBtn onClick={saveEdit} disabled={busy}>Save</SmallBtn>
              <button onClick={() => setEdit({ branchId: "", name: "", address: "", phone: "" })} style={{ marginTop: 4, background: "transparent", border: "1px solid #DDE3E1", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
