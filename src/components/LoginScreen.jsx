import React, { useMemo, useState } from "react";
import { BG, TEAL, TEAL_DARK, inputStyle } from "../theme.js";
import { useData } from "../context/DataProvider.jsx";
import { Spinner, GlobalKeyframes } from "./common/UI.jsx";

/**
 * Handles sign-in only. Whether a user lands on the POS or the Admin
 * dashboard is decided by their username prefix ("adm…" -> admin),
 * matching the original app's convention.
 */
export default function LoginScreen({ onLogin }) {
  const { login, error: loadError } = useData();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 16) return "Good evening";
    if (h >= 12) return "Good afternoon";
    return "Good morning";
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const cleanUser = username.replace(/\s+/g, "");
    const cleanPwd = password.replace(/\s+/g, "");
    if (!cleanUser || !cleanPwd) {
      setError("Enter a username and password");
      return;
    }
    setBusy(true);
    login(cleanUser, cleanPwd)
      .then((user) => onLogin(user))
      .catch((e) => {
        setError(e.message || "Login failed");
        setPassword("");
      })
      .finally(() => setBusy(false));
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ background: TEAL, borderRadius: "14px 14px 0 0", padding: "18px 22px" }}>
          <div style={{ color: "#fff", fontWeight: 700, letterSpacing: 0.3, fontSize: 15 }}>MAI_GANIMA ENERGIEZ</div>
        </div>
        <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", padding: "28px 26px 30px", boxShadow: "0 10px 30px rgba(15,115,115,0.12)" }}>
          <div style={{ color: TEAL_DARK, fontWeight: 600, fontSize: 22, marginBottom: 4 }}>{greeting}</div>
          <div style={{ color: "#6b7674", fontSize: 13.5, marginBottom: 22 }}>Sign in to open the till.</div>

          {loadError && (
            <div style={{ background: "#FDEDED", color: "#B3261E", fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 16 }}>
              {loadError}
            </div>
          )}

          <form onSubmit={submit}>
            <label style={{ display: "block", fontSize: 12.5, color: "#6b7674", marginBottom: 5 }}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus style={inputStyle} placeholder="e.g. admin or cashier1" />

            <label style={{ display: "block", fontSize: 12.5, color: "#6b7674", margin: "14px 0 5px" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />

            {error && <div style={{ color: "#B3261E", fontSize: 12.5, marginTop: 10 }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 20,
                width: "100%",
                background: TEAL,
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "11px 0",
                fontWeight: 600,
                fontSize: 14.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {busy ? <Spinner size={16} /> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
      <GlobalKeyframes />
    </div>
  );
}
