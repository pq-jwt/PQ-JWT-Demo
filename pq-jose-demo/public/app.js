/**
 * Frontend for @pq-jose/jose demo.
 */
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const authPanel = document.getElementById("auth-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  const userBar = document.getElementById("user-bar");
  const currentUser = document.getElementById("current-user");
  const logoutBtn = document.getElementById("logout-btn");
  const tokenDisplay = document.getElementById("token-display");
  const tokenRoleBadge = document.getElementById("token-role-badge");

  const btnFetchProfile = document.getElementById("btn-fetch-profile");
  const btnFetchDashboard = document.getElementById("btn-fetch-dashboard");
  const btnJweEncrypt = document.getElementById("btn-jwe-encrypt");
  const btnJweDecrypt = document.getElementById("btn-jwe-decrypt");
  const jwePlaintext = document.getElementById("jwe-plaintext");
  const profileStatus = document.getElementById("profile-status");
  const dashboardStatus = document.getElementById("dashboard-status");
  const jweStatus = document.getElementById("jwe-status");
  const signKeyDisplay = document.getElementById("sign-key-display");
  const kemKeyDisplay = document.getElementById("kem-key-display");
  const signKeyMeta = document.getElementById("sign-key-meta");
  const kemKeyMeta = document.getElementById("kem-key-meta");

  let token = localStorage.getItem("pq_jose_demo_token");
  let serverKeys = null;
  let role = localStorage.getItem("pq_jose_demo_role");
  let username = localStorage.getItem("pq_jose_demo_user");
  let lastJweToken = localStorage.getItem("pq_jose_demo_jwe") || "";

  if (token) showDashboard();
  else loadServerKeys();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const uName = fd.get("username").trim();
    const uRole = fd.get("role");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uName, role: uRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      token = data.token;
      role = data.role;
      username = uName;
      localStorage.setItem("pq_jose_demo_token", token);
      localStorage.setItem("pq_jose_demo_role", role);
      localStorage.setItem("pq_jose_demo_user", username);
      showDashboard();
      loginForm.reset();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  logoutBtn.addEventListener("click", () => {
    token = null;
    role = null;
    username = null;
    lastJweToken = "";
    localStorage.removeItem("pq_jose_demo_token");
    localStorage.removeItem("pq_jose_demo_role");
    localStorage.removeItem("pq_jose_demo_user");
    localStorage.removeItem("pq_jose_demo_jwe");
    showAuth();
  });

  btnFetchProfile.addEventListener("click", async () => {
    profileStatus.className = "status-box loading";
    profileStatus.textContent = "Calling route protected by jwtVerify()...";
    await fetchJson("/api/user/profile", profileStatus, "GET");
  });

  btnFetchDashboard.addEventListener("click", async () => {
    dashboardStatus.className = "status-box loading";
    dashboardStatus.textContent = "Calling admin route (jwtVerify + role check)...";
    await fetchJson("/api/admin/dashboard", dashboardStatus, "GET");
  });

  btnJweEncrypt.addEventListener("click", async () => {
    jweStatus.className = "status-box loading";
    jweStatus.textContent = "EncryptJWT (ML-KEM-768)...";
    try {
      const res = await fetch("/api/jwe/encrypt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plaintext: jwePlaintext.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Encrypt failed");
      lastJweToken = data.token;
      localStorage.setItem("pq_jose_demo_jwe", lastJweToken);
      jweStatus.className = "status-box status-success";
      const encKey = serverKeys?.encryption;
      jweStatus.innerHTML = `<strong>Status ${res.status}: JWE created (${data.algorithm})</strong><pre>${JSON.stringify(
        {
          encryptKey: encKey
            ? `${encKey.algorithm} · ${encKey.publicKeyBytes} bytes · ${encKey.publicKeyPreview}`
            : data.encryptKeyPreview,
          parts: data.token.split(".").length,
          preview: data.token.slice(0, 60) + "...",
        },
        null,
        2,
      )}</pre>`;
    } catch (err) {
      jweStatus.className = "status-box status-error";
      jweStatus.textContent = err.message;
    }
  });

  btnJweDecrypt.addEventListener("click", async () => {
    if (!lastJweToken) {
      jweStatus.className = "status-box status-error";
      jweStatus.textContent = "Encrypt first to get a JWE token.";
      return;
    }
    jweStatus.className = "status-box loading";
    jweStatus.textContent = "jwtDecrypt()...";
    try {
      const res = await fetch("/api/jwe/decrypt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: lastJweToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decrypt failed");
      jweStatus.className = "status-box status-success";
      jweStatus.innerHTML = `<strong>Status ${res.status}: Decrypted</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
    } catch (err) {
      jweStatus.className = "status-box status-error";
      jweStatus.textContent = err.message;
    }
  });

  async function fetchJson(path, box, method = "GET") {
    try {
      const res = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        box.className = "status-box status-success";
        box.innerHTML = `<strong>Status ${res.status} OK: Allowed</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      } else {
        box.className = "status-box status-error";
        box.innerHTML = `<strong>Status ${res.status}: Denied</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      }
    } catch (err) {
      box.className = "status-box status-error";
      box.textContent = "Network error: " + err.message;
    }
  }

  async function loadServerKeys() {
    try {
      const res = await fetch("/api/info");
      const info = await res.json();
      if (!res.ok || !info.keys) return;
      serverKeys = info.keys;
      renderKeyPanel(info.keys.signing, signKeyDisplay, signKeyMeta);
      renderKeyPanel(info.keys.encryption, kemKeyDisplay, kemKeyMeta);
    } catch {
      signKeyDisplay.textContent = "Could not load keys";
      kemKeyDisplay.textContent = "Could not load keys";
    }
  }

  function renderKeyPanel(keyInfo, preEl, metaEl) {
    if (!keyInfo) return;
    preEl.textContent = keyInfo.publicKeyPreview || keyInfo.publicKeyHex?.slice(0, 80) + "...";
    metaEl.textContent = `${keyInfo.algorithm} · ${keyInfo.publicKeyBytes} byte public key · JWK alg=${keyInfo.jwk?.alg || keyInfo.algorithm}`;
  }

  function showDashboard() {
    authPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");
    userBar.classList.remove("hidden");
    loadServerKeys();
    currentUser.textContent = username;
    tokenRoleBadge.className = `badge ${role === "admin" ? "badge-admin" : "badge-member"}`;
    tokenRoleBadge.textContent = `role: ${role}`;
    tokenDisplay.textContent = `Bearer ${token.slice(0, 40)}...\n...\n${token.slice(-40)}`;
    profileStatus.className = "status-box";
    profileStatus.textContent = "Click 'Fetch Profile' to test jwtVerify().";
    dashboardStatus.className = "status-box";
    dashboardStatus.textContent = "Click 'Fetch Admin Dashboard' to test admin role guard.";
    jweStatus.className = "status-box";
    jweStatus.textContent = lastJweToken
      ? "JWE token cached — click Decrypt JWE or Encrypt again."
      : "Enter plaintext and click Encrypt (JWE).";
  }

  function showAuth() {
    authPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    userBar.classList.add("hidden");
    tokenDisplay.textContent = "";
  }
});
