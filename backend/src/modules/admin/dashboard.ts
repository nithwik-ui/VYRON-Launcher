export function renderAdminDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VYRON Control Center — Unified Administrative Suite</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0b10;
      --bg-surface: #12141e;
      --bg-surface-elevated: #1a1e2d;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-focus: #7c4dff;
      --accent-violet: #7c4dff;
      --accent-cyan: #00e5ff;
      --accent-green: #00e676;
      --accent-red: #ff1744;
      --text-main: #f0f3fa;
      --text-muted: #8e9bb0;
      --font-ui: 'Plus Jakarta Sans', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-primary);
      color: var(--text-main);
      font-family: var(--font-ui);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    header {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 800;
      font-size: 1.25rem;
      letter-spacing: -0.5px;
    }
    .brand-badge {
      background: linear-gradient(135deg, var(--accent-violet), var(--accent-cyan));
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #000;
      font-weight: 800;
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-surface-elevated);
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      font-size: 0.85rem;
    }
    .role-badge {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background: rgba(124, 77, 255, 0.2);
      color: var(--accent-cyan);
    }

    /* Layout */
    .container {
      display: flex;
      flex: 1;
    }
    nav {
      width: 260px;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-subtle);
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    nav button {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      text-align: left;
      font-family: var(--font-ui);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    nav button:hover, nav button.active {
      background: var(--bg-surface-elevated);
      color: var(--text-main);
    }
    nav button.active {
      border-left: 3px solid var(--accent-cyan);
      color: var(--accent-cyan);
    }

    main {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
    }

    /* Cards */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border-subtle);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Buttons & Inputs */
    .btn {
      background: var(--accent-violet);
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
    }
    .btn-danger { background: var(--accent-red); }

    input, select, textarea {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      font-family: var(--font-ui);
      font-size: 0.9rem;
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--border-focus);
    }

    /* Modal / Auth Overlay */
    #auth-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 11, 16, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .auth-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .auth-box h2 {
      font-size: 1.4rem;
      margin-bottom: 0.5rem;
    }
    .auth-box p {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.2rem;
    }
    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <!-- Authentication Modal -->
  <div id="auth-overlay">
    <div class="auth-box">
      <h2>VYRON Control Center</h2>
      <p>Enter staff credentials and TOTP authenticator code to access administration plane.</p>
      <form id="login-form">
        <div class="form-group">
          <label for="login-email">Staff Email</label>
          <input type="email" id="login-email" required placeholder="admin@vyronlauncher.com">
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" required placeholder="••••••••••••">
        </div>
        <div class="form-group">
          <label for="login-totp">TOTP Code (6 digits)</label>
          <input type="text" id="login-totp" maxlength="6" pattern="[0-9]{6}" placeholder="123456 (if enabled)">
        </div>
        <div id="login-error" style="color: var(--accent-red); font-size: 0.8rem; margin-bottom: 1rem;" class="hidden"></div>
        <button type="submit" class="btn" style="width: 100%;">Sign In to Control Center</button>
      </form>
    </div>
  </div>

  <!-- Header -->
  <header>
    <div class="brand">
      <span>VYRON</span>
      <span class="brand-badge">CONTROL CENTER</span>
    </div>
    <div class="user-pill hidden" id="user-pill">
      <span id="user-display">Staff</span>
      <span class="role-badge" id="role-display">ROLE</span>
      <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="logout()">Logout</button>
    </div>
  </header>

  <!-- Main Container -->
  <div class="container">
    <nav>
      <button class="active" onclick="showTab('dashboard')">📊 Dashboard</button>
      <button onclick="showTab('news')">📰 News & Articles</button>
      <button onclick="showTab('announcements')">📢 Announcements</button>
      <button onclick="showTab('minecraft')">⛏️ Minecraft Engine</button>
      <button onclick="showTab('users')">👥 Users & RBAC</button>
      <button onclick="showTab('audit')">📜 System Audit Log</button>
    </nav>

    <main>
      <!-- Dashboard Overview Tab -->
      <section id="tab-dashboard">
        <div class="card">
          <div class="card-title">VYRON Launcher Foundation Overview</div>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
            Unified Control Plane for VYRON Launcher. Strictly maintaining zero-token proxying and zero client JAR mirroring invariants.
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: 8px;">
              <div style="color: var(--text-muted); font-size: 0.8rem;">Minecraft Java Engine</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-green);">100% Isolated</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: 8px;">
              <div style="color: var(--text-muted); font-size: 0.8rem;">Local Offline Play</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-cyan);">Authoritative</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: 8px;">
              <div style="color: var(--text-muted); font-size: 0.8rem;">Auth Separation</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent-violet);">Zero Microsoft Tokens</div>
            </div>
            <div style="background: var(--bg-surface-elevated); padding: 1rem; border-radius: 8px;">
              <div style="color: var(--text-muted); font-size: 0.8rem;">Cache Status</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">Redis + CDN Active</div>
            </div>
          </div>
        </div>
      </section>

      <!-- News CMS Tab -->
      <section id="tab-news" class="hidden">
        <div class="card">
          <div class="card-title">
            <span>Published News Articles</span>
            <button class="btn" onclick="toggleNewsForm()">+ Author Article</button>
          </div>
          <div id="news-form-container" class="hidden" style="margin-bottom: 1.5rem; background: var(--bg-surface-elevated); padding: 1rem; border-radius: 8px;">
            <form id="news-form" onsubmit="createArticle(event)">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <input type="text" id="news-title" placeholder="Article Headline" required>
                <input type="text" id="news-slug" placeholder="url-slug (e.g. vyron-3-release)" required>
              </div>
              <div style="margin-bottom: 1rem;">
                <input type="text" id="news-summary" placeholder="Summary teaser displayed in launcher home feed" style="width: 100%;" required>
              </div>
              <div style="margin-bottom: 1rem;">
                <textarea id="news-body" rows="6" placeholder="# Markdown Body Content..." style="width: 100%; font-family: var(--font-mono);" required></textarea>
              </div>
              <button type="submit" class="btn">Publish Article</button>
            </form>
          </div>
          <table id="news-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Author</th>
                <th>Published At</th>
                <th>Featured</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <!-- Announcements Tab -->
      <section id="tab-announcements" class="hidden">
        <div class="card">
          <div class="card-title">
            <span>Urgent Announcements & Service Banners</span>
          </div>
          <table id="announcements-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Window</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <!-- Minecraft Engine Tab -->
      <section id="tab-minecraft" class="hidden">
        <div class="card">
          <div class="card-title">
            <span>Indexed Minecraft Java Versions</span>
            <button class="btn btn-secondary" onclick="syncMinecraftVersions()">Sync Mojang Piston Manifest</button>
          </div>
          <table id="minecraft-table">
            <thead>
              <tr>
                <th>Version ID</th>
                <th>Type</th>
                <th>Min Java</th>
                <th>Recommended Renderer</th>
                <th>Release Date</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <!-- Users & RBAC Tab -->
      <section id="tab-users" class="hidden">
        <div class="card">
          <div class="card-title">
            <span>User Accounts & Staff RBAC Roles</span>
          </div>
          <table id="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>2FA Enabled</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <!-- System Audit Log Tab -->
      <section id="tab-audit" class="hidden">
        <div class="card">
          <div class="card-title">
            <span>Immutable System Audit Trail</span>
          </div>
          <table id="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target</th>
                <th>Actor User ID</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <script>
    let currentToken = localStorage.getItem('vyron_admin_token') || '';
    let currentUser = null;

    if (currentToken) {
      fetchProfile();
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const totpCode = document.getElementById('login-totp').value;
      const errBox = document.getElementById('login-error');

      try {
        const res = await fetch('/api/v1/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, totpCode: totpCode || undefined })
        });
        const json = await res.json();
        if (!res.ok) {
          errBox.textContent = json.error?.message || 'Authentication failed';
          errBox.classList.remove('hidden');
          return;
        }

        currentToken = json.data.token;
        localStorage.setItem('vyron_admin_token', currentToken);
        document.getElementById('auth-overlay').classList.add('hidden');
        fetchProfile();
      } catch (err) {
        errBox.textContent = 'Network or server error';
        errBox.classList.remove('hidden');
      }
    });

    async function fetchProfile() {
      try {
        const res = await fetch('/api/v1/admin/me', {
          headers: { Authorization: 'Bearer ' + currentToken }
        });
        if (!res.ok) {
          logout();
          return;
        }
        const json = await res.json();
        currentUser = json.data;
        document.getElementById('user-display').textContent = currentUser.username;
        document.getElementById('role-display').textContent = currentUser.role;
        document.getElementById('user-pill').classList.remove('hidden');
        document.getElementById('auth-overlay').classList.add('hidden');
        loadAllData();
      } catch {
        logout();
      }
    }

    function logout() {
      currentToken = '';
      localStorage.removeItem('vyron_admin_token');
      document.getElementById('auth-overlay').classList.remove('hidden');
      document.getElementById('user-pill').classList.add('hidden');
    }

    function showTab(tabName) {
      document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      const activeSec = document.getElementById('tab-' + tabName);
      if (activeSec) activeSec.classList.remove('hidden');
      event.target.classList.add('active');
    }

    async function loadAllData() {
      loadNews();
      loadAnnouncements();
      loadMinecraft();
      loadUsers();
      loadAudit();
    }

    async function loadNews() {
      const res = await fetch('/api/v1/news?limit=20');
      const json = await res.json();
      const tbody = document.querySelector('#news-table tbody');
      tbody.innerHTML = (json.data || []).map(a => \`
        <tr>
          <td><strong>\${a.title}</strong><br><small style="color: var(--text-muted)">\${a.slug}</small></td>
          <td><span class="role-badge">\${a.category}</span></td>
          <td>\${a.authorName}</td>
          <td>\${new Date(a.publishedAt).toLocaleDateString()}</td>
          <td>\${a.isFeatured ? '⭐ Yes' : 'No'}</td>
        </tr>
      \`).join('');
    }

    async function loadAnnouncements() {
      const res = await fetch('/api/v1/announcements/active');
      const json = await res.json();
      const tbody = document.querySelector('#announcements-table tbody');
      tbody.innerHTML = (json.data || []).map(item => \`
        <tr>
          <td><strong>\${item.title}</strong></td>
          <td><span class="role-badge">\${item.severity}</span></td>
          <td>\${item.message}</td>
          <td>\${new Date(item.startAt).toLocaleDateString()} - \${new Date(item.endAt).toLocaleDateString()}</td>
        </tr>
      \`).join('');
    }

    async function loadMinecraft() {
      const res = await fetch('/api/v1/minecraft/versions?limit=20');
      const json = await res.json();
      const tbody = document.querySelector('#minecraft-table tbody');
      tbody.innerHTML = (json.data || []).map(v => \`
        <tr>
          <td><strong>\${v.id}</strong></td>
          <td><span class="role-badge">\${v.type}</span></td>
          <td>Java \${v.minJavaVersion}</td>
          <td>\${v.recommendedRenderer}</td>
          <td>\${new Date(v.releaseTime).toLocaleDateString()}</td>
        </tr>
      \`).join('');
    }

    async function loadUsers() {
      const res = await fetch('/api/v1/admin/users?limit=20', {
        headers: { Authorization: 'Bearer ' + currentToken }
      });
      if (!res.ok) return;
      const json = await res.json();
      const tbody = document.querySelector('#users-table tbody');
      tbody.innerHTML = (json.data || []).map(u => \`
        <tr>
          <td>\${u.username}</td>
          <td>\${u.email}</td>
          <td><span class="role-badge">\${u.role}</span></td>
          <td>\${u.isTotpEnabled ? '🔒 Active' : 'Off'}</td>
          <td>\${new Date(u.createdAt).toLocaleDateString()}</td>
        </tr>
      \`).join('');
    }

    async function loadAudit() {
      const res = await fetch('/api/v1/admin/audit-logs?limit=20', {
        headers: { Authorization: 'Bearer ' + currentToken }
      });
      if (!res.ok) return;
      const json = await res.json();
      const tbody = document.querySelector('#audit-table tbody');
      tbody.innerHTML = (json.data || []).map(l => \`
        <tr>
          <td>\${new Date(l.createdAt).toLocaleTimeString()}</td>
          <td><strong>\${l.action}</strong></td>
          <td>\${l.targetResource}</td>
          <td><small style="font-family: var(--font-mono)">\${l.userId || 'System'}</small></td>
          <td>\${l.ipAddress || '-'}</td>
        </tr>
      \`).join('');
    }

    function toggleNewsForm() {
      document.getElementById('news-form-container').classList.toggle('hidden');
    }

    async function createArticle(e) {
      e.preventDefault();
      const title = document.getElementById('news-title').value;
      const slug = document.getElementById('news-slug').value;
      const summary = document.getElementById('news-summary').value;
      const bodyMarkdown = document.getElementById('news-body').value;

      const res = await fetch('/api/v1/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, slug, summary, bodyMarkdown,
          categoryId: 'updates',
          authorName: currentUser ? currentUser.username : 'VYRON Staff',
          status: 'PUBLISHED'
        })
      });
      if (res.ok) {
        toggleNewsForm();
        loadNews();
      }
    }

    async function syncMinecraftVersions() {
      const res = await fetch('/api/v1/minecraft/sync?limit=20', { method: 'POST' });
      if (res.ok) {
        loadMinecraft();
        alert('Minecraft versions synchronized successfully.');
      }
    }
  </script>
</body>
</html>`;
}
