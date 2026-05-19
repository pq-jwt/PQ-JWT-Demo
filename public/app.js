const TOKEN_KEY = "pq_jwt_token";
const USER_KEY = "pq_jwt_user";
const AUTH_MODE_KEY = "pq_auth_mode";
const ALGORITHM_KEY = "pq_algorithm";

const $ = (sel) => document.querySelector(sel);

const authPanel = $("#auth-panel");
const appPanel = $("#app-panel");
const userBar = $("#user-bar");
const currentUser = $("#current-user");
const tokenPreview = $("#token-preview");
const authModeBadge = $("#auth-mode-badge");
const tokenTypeBadge = $("#token-type-badge");
const tokenAlgBadge = $("#token-alg-badge");
const authModeSelect = $("#auth-mode");
const tokenAlgSelect = $("#token-alg");
const authError = $("#auth-error");
const appError = $("#app-error");
const itemsList = $("#items-list");
const loginForm = $("#login-form");
const registerForm = $("#register-form");
const itemForm = $("#item-form");
const editId = $("#edit-id");
const itemTitle = $("#item-title");
const itemBody = $("#item-body");
const saveBtn = $("#save-btn");
const cancelEdit = $("#cancel-edit");

function getAuthMode() {
  return localStorage.getItem(AUTH_MODE_KEY) || authModeSelect?.value || "both";
}

function setAuthMode(mode) {
  localStorage.setItem(AUTH_MODE_KEY, mode);
  if (authModeSelect) authModeSelect.value = mode;
}

function getToken() {
  const mode = getAuthMode();
  if (mode === "cookie") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user, authMode) {
  setAuthMode(authMode);
  if (authMode === "cookie") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token ?? "");
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function showError(el, message) {
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const mode = getAuthMode();
  const token = getToken();
  if (token && (mode === "bearer" || mode === "both")) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed");
  }
  if (res.status === 204) return null;
  return data;
}

function parseJwtHeader(token) {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const headerStr = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(headerStr);
    }
  } catch {
    // ignore
  }
  return null;
}

function updateTokenPreview(authMode, token) {
  authModeBadge.textContent = `auth: ${authMode}`;
  
  let alg = localStorage.getItem(ALGORITHM_KEY) || "ML-DSA-65";
  let isHybrid = alg.includes("-ES") || alg.includes("-Ed");
  
  if (token) {
    const header = parseJwtHeader(token);
    if (header && header.alg) {
      alg = header.alg;
      isHybrid = alg.includes("-ES") || alg.includes("-Ed");
    }
  }
  
  tokenAlgBadge.textContent = alg;
  tokenTypeBadge.textContent = isHybrid ? "Hybrid-JWT" : "PQ-JWT";
  
  if (isHybrid) {
    tokenTypeBadge.style.background = "rgba(147, 51, 234, 0.15)";
    tokenTypeBadge.style.color = "#c084fc";
  } else {
    tokenTypeBadge.style.background = "";
    tokenTypeBadge.style.color = "";
  }

  if (authMode === "cookie") {
    tokenPreview.textContent = "(pq_session cookie — UUID only, httpOnly)";
  } else if (token) {
    tokenPreview.textContent = token;
  } else {
    tokenPreview.textContent = "(no token in response)";
  }
}

function showAuth() {
  authPanel.classList.remove("hidden");
  appPanel.classList.add("hidden");
  userBar.classList.add("hidden");
  showError(appError, "");
  
  const savedMode = localStorage.getItem(AUTH_MODE_KEY);
  if (savedMode && authModeSelect) authModeSelect.value = savedMode;

  const savedAlg = localStorage.getItem(ALGORITHM_KEY);
  if (savedAlg && tokenAlgSelect) tokenAlgSelect.value = savedAlg;
}

function showApp(user, authMode, token) {
  authPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  userBar.classList.remove("hidden");
  currentUser.textContent = user.username;
  updateTokenPreview(authMode, token);
  showError(authError, "");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.classList.toggle("hidden", !isLogin);
    registerForm.classList.toggle("hidden", isLogin);
    showError(authError, "");
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(authError, "");
  const fd = new FormData(loginForm);
  const authMode = fd.get("authMode") || "both";
  const algorithm = fd.get("algorithm") || "ML-DSA-65";
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
        clientOrigin: window.location.origin,
        authMode,
        algorithm,
      }),
    });
    localStorage.setItem(ALGORITHM_KEY, algorithm);
    setSession(data.token, data.user, data.authMode || authMode);
    showApp(data.user, data.authMode || authMode, data.token);
    await loadItems();
  } catch (err) {
    showError(authError, err.message);
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(authError, "");
  const fd = new FormData(registerForm);
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username: fd.get("username"),
        password: fd.get("password"),
      }),
    });
    document.querySelector('[data-tab="login"]').click();
    loginForm.username.value = fd.get("username");
    showError(authError, "Account created — log in to continue.");
    authError.classList.remove("hidden");
    authError.style.color = "var(--accent)";
  } catch (err) {
    authError.style.color = "";
    showError(authError, err.message);
  }
});

$("#logout-btn").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    /* clear local state even if API fails */
  }
  clearSession();
  resetItemForm();
  itemsList.innerHTML = "";
  showAuth();
});

function resetItemForm() {
  editId.value = "";
  itemTitle.value = "";
  itemBody.value = "";
  saveBtn.textContent = "Add note";
  cancelEdit.classList.add("hidden");
}

cancelEdit.addEventListener("click", resetItemForm);

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(appError, "");
  const id = editId.value;
  const payload = { title: itemTitle.value.trim(), body: itemBody.value };

  try {
    if (id) {
      await api(`/api/items/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/items", { method: "POST", body: JSON.stringify(payload) });
    }
    resetItemForm();
    await loadItems();
  } catch (err) {
    showError(appError, err.message);
  }
});

function renderItems(items) {
  if (!items.length) {
    itemsList.innerHTML = '<li class="empty-state">No notes yet — add one above.</li>';
    return;
  }

  itemsList.innerHTML = items
    .map(
      (item) => `
    <li class="item-card" data-id="${item.id}">
      <h3>${escapeHtml(item.title)}</h3>
      ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
      <div class="item-meta">Updated ${item.updated_at}</div>
      <div class="item-actions">
        <button type="button" class="btn btn-ghost btn-sm edit-btn">Edit</button>
        <button type="button" class="btn btn-danger btn-sm delete-btn">Delete</button>
      </div>
    </li>`,
    )
    .join("");

  itemsList.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".item-card");
      const item = items.find((i) => String(i.id) === card.dataset.id);
      if (!item) return;
      editId.value = item.id;
      itemTitle.value = item.title;
      itemBody.value = item.body || "";
      saveBtn.textContent = "Save changes";
      cancelEdit.classList.remove("hidden");
      itemTitle.focus();
    });
  });

  itemsList.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.closest(".item-card").dataset.id;
      if (!confirm("Delete this note?")) return;
      showError(appError, "");
      try {
        await api(`/api/items/${id}`, { method: "DELETE" });
        await loadItems();
      } catch (err) {
        showError(appError, err.message);
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadItems() {
  const { items } = await api("/api/items");
  renderItems(items);
}

async function init() {
  const authMode = getAuthMode();
  if (authModeSelect) authModeSelect.value = authMode;

  const savedAlg = localStorage.getItem(ALGORITHM_KEY);
  if (savedAlg && tokenAlgSelect) tokenAlgSelect.value = savedAlg;

  const userJson = localStorage.getItem(USER_KEY);
  const token = localStorage.getItem(TOKEN_KEY);

  if (!userJson && authMode !== "cookie") {
    showAuth();
    return;
  }

  try {
    const { user: me } = await api("/api/auth/me");
    setSession(token, me, authMode);
    showApp(me, authMode, token);
    await loadItems();
  } catch {
    clearSession();
    showAuth();
  }
}

init();
