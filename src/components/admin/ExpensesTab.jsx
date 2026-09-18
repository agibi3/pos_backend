import React, { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TEAL_DARK, PIE_COLORS, inputStyle } from "../../theme.js";
import { useSupabaseData } from "../../context/DataProvider.jsx";
import { naira } from "../../utils/format.js";
import { Card, FieldLabel, SmallBtn, EmptyState, Select, Modal } from "../common/UI.jsx";

const DEFAULT_TYPES = ["Salaries", "Fueling", "Rent", "Utilities", "Logistics/Transport"];

function RegisterTypeModal({ onClose, onRegistered, notify }) {
  const { addExpenseType } = useSupabaseData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return notify("Enter a name for the expense type");
    setBusy(true);
    try {
      await addExpenseType(name.trim());
      notify(`"${name.trim()}" registered`);
      onRegistered();
      onClose();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Register expense type" onClose={onClose}>
      <FormField label="Type name">
        <input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" onKeyDown={(e) => e.key === "Enter" && submit()} />
      </FormField>
      <SmallBtn onClick={submit} disabled={busy}>{busy ? "Saving…" : "Register"}</SmallBtn>
    </Modal>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

export default function ExpensesTab({ notify: notifyUp }) {
  const { getExpenseTypes, getExpenses, getExpensesSummary, addExpense } = useSupabaseData();
  const [types, setTypes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pie, setPie] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [expenseType, setExpenseType] = useState(DEFAULT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [localFeed, setLocalFeed] = useState("");

  const notify = (text) => {
    if (notifyUp) return notifyUp(text);
    setLocalFeed(text);
    setTimeout(() => setLocalFeed(""), 5000);
  };

  const load = useCallback(async () => {
    try {
      const [t, e, p] = await Promise.all([getExpenseTypes(), getExpenses(period), getExpensesSummary(period)]);
      setTypes(t);
      setExpenses(e);
      setPie(p);
      setError("");
    } catch (err) {
      setError(err.message || "Couldn't load expenses");
    }
  }, [getExpenseTypes, getExpenses, getExpensesSummary, period]);

  useEffect(() => { load(); }, [load]);

  const typeOptions = Array.from(new Set([...DEFAULT_TYPES, ...types.map((t) => t.name)]));

  const submitExpense = async () => {
    const amt = parseFloat(amount);
    if (!expenseType.trim()) return notify("Pick or enter an expense type");
    if (!amount || isNaN(amt) || amt <= 0) return notify("Enter a valid amount");
    setBusy(true);
    try {
      await addExpense({ expense_type: expenseType.trim(), description: description.trim(), amount: amt });
      setDescription("");
      setAmount("");
      await load();
      notify("Expense recorded");
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const total = pie.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: TEAL_DARK }}>Expenses</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
          </select>
          <SmallBtn onClick={() => setShowRegister(true)}>Register expense type</SmallBtn>
        </div>
      </div>

      {(localFeed || error) && <div style={{ color: error ? "#B3261E" : TEAL_DARK, fontSize: 13, marginBottom: 12 }}>{error || localFeed}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <Card style={{ flex: "1 1 320px" }}>
          <div style={{ fontSize: 13, color: "#8a938f", marginBottom: 8 }}>Expenses by category ({period}) — total {naira(total)}</div>
          {pie.length === 0 ? (
            <EmptyState text="No expenses recorded in this period yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(d) => `${d.name}`}>
                  {pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => naira(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card style={{ flex: "1 1 280px", maxWidth: 340 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add expense</div>
          <div style={{ marginBottom: 12 }}>
            <Select label="Expense type" value={expenseType} onChange={setExpenseType} options={typeOptions} allowCustom />
          </div>
          <FormField label="Description (optional)">
            <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. September fuel top-up" />
          </FormField>
          <FormField label="Amount">
            <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </FormField>
          <SmallBtn onClick={submitExpense} disabled={busy}>{busy ? "Saving…" : "Add expense"}</SmallBtn>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, color: "#8a938f", marginBottom: 8 }}>Recorded expenses ({period})</div>
        {expenses.length === 0 ? (
          <EmptyState text="No expenses recorded in this period yet." />
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #EEECE6" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.6fr 1fr 1fr", background: TEAL_DARK, color: "#fff", fontSize: 12, fontWeight: 600, padding: "9px 12px" }}>
              <div>Date</div><div>Type</div><div>Description</div><div style={{ textAlign: "right" }}>Amount</div><div>Recorded by</div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {expenses.map((e, i) => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.6fr 1fr 1fr", padding: "8px 12px", fontSize: 13, borderTop: "1px solid #F2F1EC", background: i % 2 ? "#FAFAF7" : "#fff" }}>
                  <div>{(e.date || "").slice(0, 19).replace("T", " ")}</div>
                  <div>{e.expense_type}</div>
                  <div>{e.description || "—"}</div>
                  <div style={{ textAlign: "right", fontWeight: 600 }}>{naira(e.amount)}</div>
                  <div>{e.recorded_by || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {showRegister && <RegisterTypeModal onClose={() => setShowRegister(false)} onRegistered={load} notify={notify} />}
    </div>
  );
}