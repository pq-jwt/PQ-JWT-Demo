/**
 * Frontend app for @pq-jwt/express middleware demo.
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
  const profileStatus = document.getElementById("profile-status");
  const dashboardStatus = document.getElementById("dashboard-status");

  // Load from local storage on startup
  let token = localStorage.getItem("pq_express_demo_token");
  let role = localStorage.getItem("pq_express_demo_role");
  let username = localStorage.getItem("pq_express_demo_user");

  if (token) {
    showDashboard();
  }

  // Handle Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const uName = fd.get("username").trim();
    const uRole = fd.get("role");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uName, role: uRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      token = data.token;
      role = data.role;
      username = uName;

      localStorage.setItem("pq_express_demo_token", token);
      localStorage.setItem("pq_express_demo_role", role);
      localStorage.setItem("pq_express_demo_user", username);

      showDashboard();
      loginForm.reset();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

  // Handle Logout
  logoutBtn.addEventListener("click", () => {
    token = null;
    role = null;
    username = null;
    localStorage.clear();
    showAuth();
  });

  // Fetch standard profile
  btnFetchProfile.addEventListener("click", async () => {
    profileStatus.className = "status-box loading";
    profileStatus.textContent = "Requesting route protected by pqAuth()...";

    try {
      const res = await fetch("/api/user/profile", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        profileStatus.className = "status-box status-success";
        profileStatus.innerHTML = `<strong>Status 200 OK: Allowed</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      } else {
        profileStatus.className = "status-box status-error";
        profileStatus.innerHTML = `<strong>Status ${res.status}: Access Denied</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      }
    } catch (err) {
      profileStatus.className = "status-box status-error";
      profileStatus.textContent = "Network error: " + err.message;
    }
  });

  // Fetch admin dashboard
  btnFetchDashboard.addEventListener("click", async () => {
    dashboardStatus.className = "status-box loading";
    dashboardStatus.textContent = "Requesting route protected by pqAuth() + requireRole('admin')...";

    try {
      const res = await fetch("/api/admin/dashboard", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        dashboardStatus.className = "status-box status-success";
        dashboardStatus.innerHTML = `<strong>Status 200 OK: Allowed</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      } else {
        dashboardStatus.className = "status-box status-error";
        dashboardStatus.innerHTML = `<strong>Status ${res.status}: Access Denied</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
      }
    } catch (err) {
      dashboardStatus.className = "status-box status-error";
      dashboardStatus.textContent = "Network error: " + err.message;
    }
  });

  function showDashboard() {
    authPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");
    userBar.classList.remove("hidden");
    currentUser.textContent = username;
    
    // Format token role badge
    tokenRoleBadge.className = `badge ${role === "admin" ? "badge-admin" : "badge-member"}`;
    tokenRoleBadge.textContent = `role: ${role}`;

    // Format authorization header preview
    tokenDisplay.textContent = `Bearer ${token.slice(0, 40)}...\n...\n${token.slice(-40)}`;

    // Reset status boxes
    profileStatus.className = "status-box";
    profileStatus.textContent = "Click 'Fetch Profile' to test standard pqAuth() middleware.";
    dashboardStatus.className = "status-box";
    dashboardStatus.textContent = "Click 'Fetch Admin Dashboard' to test standard pqAuth() + requireRole('admin') middlewares.";
  }

  function showAuth() {
    authPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
    userBar.classList.add("hidden");
    tokenDisplay.textContent = "";
  }
});
