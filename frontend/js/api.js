// api.js — shared fetch helper for the storefront

// When served via Express (localhost:4000), use relative path. Fallback to absolute for file:// dev.
const API_BASE = window.location.protocol === "file:" 
  ? "http://localhost:4000/api" 
  : `${window.location.protocol}//${window.location.host}/api`;

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const message = (data && (data.error || (data.errors && data.errors[0]?.msg))) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function getCurrentUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() { return !!localStorage.getItem("token"); }

function isAdmin() {
  const user = getCurrentUser();
  return !!user && user.role === "admin";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function showToast(message, ms = 2600) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), ms);
}

function money(n) { return `$${Number(n).toFixed(2)}`; }

// --- Theme Management ---
function getPreferredTheme() {
  const theme = localStorage.getItem("theme");
  if (theme) return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  const icon = document.querySelector(".theme-toggle-btn");
  if (icon) {
    icon.innerHTML = theme === "dark" ? "☀️" : "🌙";
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const target = current === "dark" ? "light" : "dark";
  setTheme(target);
}

// Initialise Theme on script load
document.addEventListener("DOMContentLoaded", () => {
  const preferred = getPreferredTheme();
  setTheme(preferred);
});

// --- New Features API Helpers ---
async function fetchWishlist() {
  const data = await apiFetch("/wishlist");
  return data.wishlist;
}

async function addProductToWishlist(productId) {
  return await apiFetch("/wishlist", {
    method: "POST",
    body: JSON.stringify({ product_id: productId }),
  });
}

async function removeProductFromWishlist(productId) {
  return await apiFetch(`/wishlist/${productId}`, {
    method: "DELETE",
  });
}

async function validateDiscountCoupon(code, total) {
  return await apiFetch("/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, total }),
  });
}

async function updateCustomerProfile(profileData) {
  const data = await apiFetch("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(profileData),
  });
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  if (data.token) {
    localStorage.setItem("token", data.token);
  }
  return data;
}
