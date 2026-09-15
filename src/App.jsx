import React from "react";
import { BG, TEAL } from "./theme.js";
import { DataProvider, useData } from "./context/DataProvider.jsx";
import { GlobalKeyframes, Spinner } from "./components/common/UI.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import POSScreen from "./components/pos/POSScreen.jsx";
import AdminScreen from "./components/admin/AdminScreen.jsx";

function Router() {
  const { loading, currentUser, login, logout } = useData();

  if (!currentUser) {
    return <LoginScreen onLogin={login} />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: TEAL, display: "flex", gap: 10, alignItems: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
          <Spinner size={22} />
          Loading…
        </div>
        <GlobalKeyframes />
      </div>
    );
  }

  return currentUser.role === "admin" ? (
    <AdminScreen onLogout={logout} />
  ) : (
    <POSScreen cashier={currentUser.fullName || currentUser.userName} onLogout={logout} />
  );
}

export default function App() {
  return (
    <DataProvider>
      <Router />
    </DataProvider>
  );
}
