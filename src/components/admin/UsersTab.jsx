import React, { useState } from "react";
import { TEAL_DARK, inputStyle } from "../../theme.js";
import { useData } from "../../context/DataProvider.jsx";
import { Card, DataTable, FormRow, SmallBtn } from "../common/UI.jsx";

const FIELD_MAP = { "User ID": "userId", "Full Name": "fullName", "User Name": "userName", Password: "password", Role: "role" };

export default function UsersTab({ notify }) {
  const { users, insertRow, updateRow, refresh } = useData();
  const [form, setForm] = useState({ userId: "", fullName: "", userName: "", password: "", role: "cashier" });
  const [update, setUpdate] = useState({ field: "Full Name", to: "", userId: "" });
  const [busy, setBusy] = useState(false);

  const addUser = async () => {
    if (!form.userId || !form.fullName || !form.userName || !form.password) return notify("Fill all fields to add a user");
    setBusy(true);
    try {
      await insertRow("users", form);
      await refresh();
      setForm({ userId: "", fullName: "", userName: "", password: "", role: "cashier" });
      notify("User added successfully");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async () => {
    if (!update.to || !update.userId) return notify("Fill all fields to update a user");
    setBusy(true);
    try {
      await updateRow("users", { [FIELD_MAP[update.field]]: update.to }, "userId", update.userId);
      await refresh();
      setUpdate({ field: "Full Name", to: "", userId: "" });
      notify("User updated successfully");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 20, color: TEAL_DARK }}>Users</h2>
      <Card style={{ marginBottom: 16 }}>
        <DataTable
          columns={[
            { key: "userId", label: "ID", width: "0.7fr" },
            { key: "created_at", label: "Created", width: "1.3fr" },
            { key: "userName", label: "User", width: "1fr" },
            { key: "password", label: "Password", width: "1fr" },
            { key: "role", label: "Role", width: "0.8fr" },
            { key: "fullName", label: "Full name", width: "1.3fr" },
          ]}
          rows={users.map((u) => ({ ...u, created_at: (u.created_at || "").slice(0, 10), password: "••••••••" }))}
        />
      </Card>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add user</div>
          <FormRow label="User ID"><input style={inputStyle} value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} /></FormRow>
          <FormRow label="Full name"><input style={inputStyle} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></FormRow>
          <FormRow label="User name"><input style={inputStyle} value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></FormRow>
          <FormRow label="Password"><input style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></FormRow>
          <FormRow label="Role">
            <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </FormRow>
          <SmallBtn onClick={addUser} disabled={busy}>Add user</SmallBtn>
        </Card>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Update user</div>
          <FormRow label="Field to change">
            <select style={inputStyle} value={update.field} onChange={(e) => setUpdate({ ...update, field: e.target.value, to: "" })}>
              {Object.keys(FIELD_MAP).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Change to">
            {update.field === "Role" ? (
              <select style={inputStyle} value={update.to} onChange={(e) => setUpdate({ ...update, to: e.target.value })}>
                <option value="">Select a role…</option>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <input style={inputStyle} value={update.to} onChange={(e) => setUpdate({ ...update, to: e.target.value })} />
            )}
          </FormRow>
          <FormRow label="User"><select style={inputStyle} value={update.userId} onChange={(e) => setUpdate({ ...update, userId: e.target.value })}>
            <option value="">Select a user…</option>
            {users.map((u) => <option key={u.userId} value={u.userId}>{u.userId} — {u.fullName}</option>)}
          </select></FormRow>
          <SmallBtn onClick={updateUser} disabled={busy}>Update user</SmallBtn>
        </Card>
      </div>
    </div>
  );
}
