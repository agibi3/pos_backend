import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL);
const DataContext = createContext(null);

async function request(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Server request failed");
  return body;
}

export function SupabaseDataProvider({ children }) {
  const [data, setData] = useState({ users: [], products: [], history: [], payments: [] });
  const [token, setToken] = useState(() => localStorage.getItem("pos_token") || "");
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pos_user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !currentUser) return;
    setLoading(true);
    try {
      const products = await request("/products", {}, token);
      const next = { products, users: [], history: [], payments: [] };
      if (currentUser.role === "admin") {
        const [users, sales, payments] = await Promise.all([
          request("/users", {}, token),
          request("/sales?page=1&page_size=100", {}, token),
          request("/payments/summary", {}, token),
        ]);
        next.users = users;
        next.history = sales.items;
        next.payments = payments;
      }
      setData(next);
      setError("");
    } catch (e) {
      if (/401|expired|Authentication/i.test(e.message)) logout();
      setError(e.message || "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [token, currentUser]);

  useEffect(() => { loadData(); }, [loadData]);

  const login = useCallback(async (userName, password) => {
    const result = await request("/auth/login", { method: "POST", body: JSON.stringify({ userName, password }) });
    localStorage.setItem("pos_token", result.access_token);
    localStorage.setItem("pos_user", JSON.stringify(result.user));
    setToken(result.access_token);
    setCurrentUser(result.user);
    return result.user;
  }, []);

  function logout() {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    setToken("");
    setCurrentUser(null);
    setData({ users: [], products: [], history: [], payments: [] });
  }

  const refresh = useCallback(async () => { await loadData(); }, [loadData]);

  const insertRow = useCallback(async (tableKey, row) => {
    const routes = { products: "/products", users: "/users" };
    if (!routes[tableKey]) throw new Error(`Unsupported table: ${tableKey}`);
    return [await request(routes[tableKey], { method: "POST", body: JSON.stringify(row) }, token)];
  }, [token]);

  const insertRows = useCallback(async (tableKey, rows) => {
    if (tableKey !== "history") throw new Error(`Unsupported table: ${tableKey}`);
    if (!rows.length) return [];
    const grouped = rows.reduce((acc, row) => {
      const key = row.receipt_no;
      if (!acc[key]) acc[key] = { receipt_no: key, pmt_type: row.pmt_type, customer: row.customer, cashier: row.cashier, status: row.status || "paid", items: [] };
      acc[key].items.push({ product: row.prod, price: row.price, qty: row.qty, total: row.total });
      return acc;
    }, {});
    const out = [];
    for (const sale of Object.values(grouped)) out.push(await request("/sales", { method: "POST", body: JSON.stringify(sale) }, token));
    return out;
  }, [token]);

  const updateRow = useCallback(async (tableKey, patch, eqCol, eqVal) => {
    let path;
    if (tableKey === "products") path = `/products/${encodeURIComponent(eqVal)}`;
    else if (tableKey === "users") path = `/users/${encodeURIComponent(eqVal)}`;
    else if (tableKey === "history" && eqCol === "receipt_no") path = `/sales/${encodeURIComponent(eqVal)}/status`;
    else throw new Error(`Unsupported update: ${tableKey}`);
    return [await request(path, { method: "PATCH", body: JSON.stringify(patch) }, token)];
  }, [token]);

  const getSales = useCallback(async (params = "") => request(`/sales${params ? `?${params}` : ""}`, {}, token), [token]);

  const value = { ...data, loading, error, token, currentUser, login, logout, refresh, insertRow, insertRows, updateRow, getSales, apiUrl: API_URL };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useSupabaseData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useSupabaseData must be used inside <SupabaseDataProvider>");
  return ctx;
}
