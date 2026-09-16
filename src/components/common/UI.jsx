import React, { useState } from "react";
import { TEAL, TEAL_DARK, inputStyle } from "../../theme.js";

export function Spinner({ size = 22 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.35)",
        borderTopColor: "#fff",
        animation: "posspin 0.8s linear infinite",
      }}
    />
  );
}

export function Card({ children, style }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", ...style }}>
      {children}
    </div>
  );
}

export function FieldLabel({ children }) {
  return <div style={{ fontSize: 11.5, color: "#8a938f", marginBottom: 4 }}>{children}</div>;
}

export function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function SmallBtn({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        marginTop: 4,
        background: TEAL,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "9px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ActionBtn({ color, onClick, children, icon, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: color,
        color: "#fff",
        border: "none",
        borderRadius: 9,
        padding: "10px 16px",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function Dot({ color }) {
  return <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

export function EmptyState({ text }) {
  return <div style={{ color: "#94A19E", fontSize: 13, padding: "30px 0", textAlign: "center" }}>{text}</div>;
}

export function ConfirmDialog({ message, onYes, onNo }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: "22px 26px", width: 300, textAlign: "center" }}>
        <div style={{ color: "#C0392B", fontWeight: 700, fontSize: 14, marginBottom: 12, letterSpacing: 0.3 }}>WARNING</div>
        <div style={{ fontSize: 14, marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onYes} style={{ flex: 1, background: TEAL, color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", cursor: "pointer", fontWeight: 600 }}>
            Yes
          </button>
          <button onClick={onNo} style={{ flex: 1, background: "#C0392B", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", cursor: "pointer", fontWeight: 600 }}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dropdown that can fall back to a free-text field ("Other…") when allowCustom is set. */
export function Select({ label, value, onChange, options, allowCustom }) {
  const [custom, setCustom] = useState(false);
  return (
    <div style={{ flex: 1 }}>
      <FieldLabel>{label}</FieldLabel>
      {custom ? (
        <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => setCustom(false)} style={inputStyle} />
      ) : (
        <select
          value={options.includes(value) ? value : "__custom__"}
          onChange={(e) => (e.target.value === "__custom__" ? setCustom(true) : onChange(e.target.value))}
          style={inputStyle}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {allowCustom && <option value="__custom__">{value && !options.includes(value) ? value : "Other…"}</option>}
        </select>
      )}
    </div>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #EEECE6" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
          background: TEAL_DARK,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          padding: "9px 12px",
        }}
      >
        {columns.map((c) => (
          <div key={c.key}>{c.label}</div>
        ))}
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <EmptyState text="Nothing here yet." />
        ) : (
          rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" "),
                padding: "8px 12px",
                fontSize: 13,
                borderTop: "1px solid #F2F1EC",
                background: i % 2 ? "#FAFAF7" : "#fff",
              }}
            >
              {columns.map((c) => (
                <div key={c.key}>{row[c.key]}</div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Injected once at the app root; components above just reference the posspin animation by name. */
export function GlobalKeyframes() {
  return <style>{`@keyframes posspin { to { transform: rotate(360deg); } }`}</style>;
}

const STATUS_COLORS = { order: "#E68A1F", paid: "#2E9E4F", not_paid: "#C0392B", cancelled: "#8a938f" };
const STATUS_LABELS = { order: "Order", paid: "Paid", not_paid: "Not paid", cancelled: "Cancelled" };

export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#8a938f";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color, background: `${color}1A`, borderRadius: 6, padding: "3px 9px" }}>
      <Dot color={color} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/** Generic centered overlay dialog — used for the branch switcher, the
 * admin "update payment status" mini screen, etc. */
export function Modal({ title, onClose, children, width = 380 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", width, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEAL_DARK }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#8a938f", lineHeight: 1 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
