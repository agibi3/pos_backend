import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const DataContext = createContext(null);

async function request(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Server request failed");
  return body;
}

/** Appends ?branch_id=/&branch_id= to a path when a branch is known. Every
 * products/sales endpoint is branch-scoped server-side; passing it
 * explicitly is required for overall_admin (who must say which branch)
 * and harmless-but-verified for branch-locked admins/cashiers. */
function withBranch(path, branchId) {
  if (!branchId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}branch_id=${encodeURIComponent(branchId)}`;
}

export function SupabaseDataProvider({ children }) {
  const [data, setData] = useState({ users: [], products: [], history: [] });
  const [branches, setBranches] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem("pos_token") || "");
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pos_user") || "null"); } catch { return null; }
  });
  const [activeBranchId, setActiveBranchId] = useState(() => localStorage.getItem("pos_active_branch") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // For a branch-locked admin/cashier the active branch is always their own.
  // Only overall_admin actually picks one (via the branch switcher).
  const effectiveBranchId = currentUser && currentUser.role !== "overall_admin" ? currentUser.branchId : activeBranchId;

  const chooseBranch = useCallback((branchId) => {
    setActiveBranchId(branchId);
    if (branchId) localStorage.setItem("pos_active_branch", branchId);
    else localStorage.removeItem("pos_active_branch");
  }, []);

  const loadBranches = useCallback(async () => {
    if (!token || !currentUser || currentUser.role !== "overall_admin") return [];
    const rows = await request("/branches", {}, token);
    setBranches(rows);
    return rows;
  }, [token, currentUser]);

  const loadData = useCallback(async () => {
    if (!token || !currentUser) return;
    if (currentUser.role === "overall_admin" && !effectiveBranchId) {
      // Overall admin hasn't picked a branch to work in yet — nothing
      // branch-scoped to fetch until they do.
      setData({ users: [], products: [], history: [] });
      return;
    }
    setLoading(true);
    try {
      const products = await request(withBranch("/products", effectiveBranchId), {}, token);
      const next = { products, users: [], history: [] };
      if (currentUser.role !== "cashier") {
        const [users, sales] = await Promise.all([
          request(withBranch("/users", effectiveBranchId), {}, token),
          request(withBranch("/sales?page=1&page_size=100", effectiveBranchId), {}, token),
        ]);
        next.users = users;
        next.history = sales.items;
      }
      setData(next);
      setError("");
    } catch (e) {
      if (/401|expired|Authentication/i.test(e.message)) logout();
      setError(e.message || "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [token, currentUser, effectiveBranchId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => { loadData(); }, [loadData]);

  const login = useCallback(async (userName, password) => {
    const result = await request("/auth/login", { method: "POST", body: JSON.stringify({ userName, password }) });
    localStorage.setItem("pos_token", result.access_token);
    localStorage.setItem("pos_user", JSON.stringify(result.user));
    setToken(result.access_token);
    setCurrentUser(result.user);
    if (result.user.role !== "overall_admin") {
      chooseBranch(result.user.branchId || "");
    }
    return result.user;
  }, [chooseBranch]);

  function logout() {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    localStorage.removeItem("pos_active_branch");
    setToken("");
    setCurrentUser(null);
    setBranches([]);
    setActiveBranchId("");
    setData({ users: [], products: [], history: [] });
  }

  const refresh = useCallback(async () => { await loadData(); }, [loadData]);

  const insertRow = useCallback(async (tableKey, row) => {
    if (tableKey === "products") return [await request(withBranch("/products", effectiveBranchId), { method: "POST", body: JSON.stringify(row) }, token)];
    if (tableKey === "users") return [await request("/users", { method: "POST", body: JSON.stringify(row) }, token)];
    throw new Error(`Unsupported table: ${tableKey}`);
  }, [token, effectiveBranchId]);

  const insertRows = useCallback(async (tableKey, rows) => {
    if (tableKey !== "history") throw new Error(`Unsupported table: ${tableKey}`);
    if (!rows.length) return [];
    const grouped = rows.reduce((acc, row) => {
      const key = row.receipt_no;
      if (!acc[key]) acc[key] = { receipt_no: key, pmt_type: row.pmt_type, customer: row.customer, cashier: row.cashier, status: row.status || "order", items: [] };
      acc[key].items.push({ product: row.prod, prod_id: row.prod_id || null, price: row.price, qty: row.qty, total: row.total });
      return acc;
    }, {});
    const out = [];
    for (const sale of Object.values(grouped)) out.push(await request(withBranch("/sales", effectiveBranchId), { method: "POST", body: JSON.stringify(sale) }, token));
    return out;
  }, [token, effectiveBranchId]);

  const updateRow = useCallback(async (tableKey, patch, eqCol, eqVal) => {
    let path;
    if (tableKey === "products") path = withBranch(`/products/${encodeURIComponent(eqVal)}`, effectiveBranchId);
    else if (tableKey === "users") path = `/users/${encodeURIComponent(eqVal)}`;
    else if (tableKey === "history" && eqCol === "receipt_no") path = withBranch(`/sales/${encodeURIComponent(eqVal)}/status`, effectiveBranchId);
    else throw new Error(`Unsupported update: ${tableKey}`);
    return [await request(path, { method: "PATCH", body: JSON.stringify(patch) }, token)];
  }, [token, effectiveBranchId]);

  const getSales = useCallback(async (params = "") => request(withBranch(`/sales${params ? `?${params}` : ""}`, effectiveBranchId), {}, token), [token, effectiveBranchId]);

  const getSaleByReceipt = useCallback(async (receiptNo) => request(withBranch(`/sales/${encodeURIComponent(receiptNo)}`, effectiveBranchId), {}, token), [token, effectiveBranchId]);

  const getNextReceiptNo = useCallback(async () => request(withBranch("/sales/next-receipt-no", effectiveBranchId), {}, token), [token, effectiveBranchId]);

  // Narrow, cashier-usable transition: an "order" can be flipped to paid or
  // not_paid from the reprint screen — nothing else, and only from "order".
  const setPaymentStatus = useCallback(async (receiptNo, status) =>
    request(withBranch(`/sales/${encodeURIComponent(receiptNo)}/payment-status`, effectiveBranchId), { method: "PATCH", body: JSON.stringify({ status }) }, token),
  [token, effectiveBranchId]);

  const restockProduct = useCallback(async (prodId, quantity, unitCost) =>
    request(withBranch(`/products/${encodeURIComponent(prodId)}/restock`, effectiveBranchId), { method: "POST", body: JSON.stringify({ quantity, unit_cost: unitCost }) }, token),
  [token, effectiveBranchId]);

  const resetStock = useCallback(async (prodId) =>
    request(withBranch(`/products/${encodeURIComponent(prodId)}/reset-stock`, effectiveBranchId), { method: "POST" }, token),
  [token, effectiveBranchId]);

  const createBranch = useCallback(async (body) => {
    const b = await request("/branches", { method: "POST", body: JSON.stringify(body) }, token);
    await loadBranches();
    return b;
  }, [token, loadBranches]);

  const updateBranch = useCallback(async (branchId, patch) => {
    const b = await request(`/branches/${encodeURIComponent(branchId)}`, { method: "PATCH", body: JSON.stringify(patch) }, token);
    await loadBranches();
    return b;
  }, [token, loadBranches]);

  // ------------------------------------------------------------ Expenses
  const getExpenseTypes = useCallback(async () =>
    request(withBranch("/expense-types", effectiveBranchId), {}, token),
  [token, effectiveBranchId]);

  const addExpenseType = useCallback(async (name) =>
    request(withBranch("/expense-types", effectiveBranchId), { method: "POST", body: JSON.stringify({ name }) }, token),
  [token, effectiveBranchId]);

  const getExpenses = useCallback(async (period = "") =>
    request(withBranch(`/expenses${period ? `?period=${period}` : ""}`, effectiveBranchId), {}, token),
  [token, effectiveBranchId]);

  const getExpensesSummary = useCallback(async (period) =>
    request(withBranch(`/expenses/summary?period=${period}`, effectiveBranchId), {}, token),
  [token, effectiveBranchId]);

  const addExpense = useCallback(async (body) =>
    request(withBranch("/expenses", effectiveBranchId), { method: "POST", body: JSON.stringify(body) }, token),
  [token, effectiveBranchId]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.branchId === effectiveBranchId) || null,
    [branches, effectiveBranchId]
  );

  const value = useMemo(() => ({
    apiUrl: API_URL,
    token,
    currentUser,
    branches,
    activeBranchId: effectiveBranchId,
    activeBranch,
    chooseBranch,
    loading,
    error,
    data,
    users: data.users,
    products: data.products,
    history: data.history,
    login,
    logout,
    refresh,
    insertRow,
    insertRows,
    updateRow,
    getSales,
    getSaleByReceipt,
    getNextReceiptNo,
    setPaymentStatus,
    restockProduct,
    resetStock,
    createBranch,
    updateBranch,
    getExpenseTypes,
    addExpenseType,
    getExpenses,
    getExpensesSummary,
    addExpense,
  }), [
    token, currentUser, branches, effectiveBranchId, activeBranch, chooseBranch, loading, error, data,
    login, refresh, insertRow, insertRows, updateRow, getSales, getSaleByReceipt, getNextReceiptNo, setPaymentStatus,
    restockProduct, resetStock, createBranch, updateBranch, getExpenseTypes, addExpenseType, getExpenses, getExpensesSummary, addExpense,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useSupabaseData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useSupabaseData must be used within a SupabaseDataProvider");
  return ctx;
}