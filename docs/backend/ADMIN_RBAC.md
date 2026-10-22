# VYRON Role-Based Access Control & Admin Architecture
**Document ID:** `docs/backend/ADMIN_RBAC.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM ARCHITECTURE SPECIFICATION  
**Scope:** Unified RBAC Permissions, Security Controls, and VYRON Control Center  

---

## 1. Unified Control Plane Philosophy

> **Architectural Rule:**  
> There is ONE backend, ONE database, and ONE authorization system. Do NOT create separate databases or fragmented micro-backends for different administrative tasks. Administrative access is governed strictly by cryptographic session tokens and fine-grained Role-Based Access Control (RBAC).

The administrative interface is realized as a single, unified web application called the **VYRON Control Center** (built in Next.js / React), where navigation menus and actionable UI components dynamically adapt to the permissions granted to the logged-in staff member.

---

## 2. Standard Role Hierarchy & Granular Permissions

| Administrative Role | Primary Responsibilities | Granular Permission Grants |
|---|---|---|
| **`SUPER_ADMIN`** | Complete system authority, staff management, emergency kill-switches, and infrastructure controls. | `*` (All permissions across all domains) |
| **`CONTENT_ADMIN`** | Editorial lifecycle for launcher news, announcements, community articles, and media CDN assets. | `news:*`, `announcements:*`, `media:*` |
| **`SERVER_ADMIN`** | Management of server directory, verification badge approvals, featured campaign scheduling, and EULA compliance audits. | `servers:*`, `promotions:*`, `campaigns:*` |
| **`RELEASE_ADMIN`** | Publishing APK updates, managing staged percentage rollouts, updating Minecraft version metadata, and hardware compatibility profiles. | `releases:*`, `rollouts:*`, `minecraft:*`, `compatibility:*` |
| **`MODERATOR`** | Reviewing player reports, auditing flagged server descriptions, and moderating uploaded skin textures. | `reports:read`, `reports:resolve`, `servers:flag`, `users:suspend` |
| **`SUPPORT_ADMIN`** | Triaging user tickets, inspecting crash logs, and diagnosing client launch failures. | `support:*`, `crashes:read`, `users:read` |
| **`ANALYTICS`** | Read-only access to aggregated usage metrics, DAU/MAU, FPS benchmarks, and campaign impressions. | `analytics:read`, `telemetry:read` |

---

## 3. Permission Token & Authorization Flow

```text
[ Staff Login (Email + Password + TOTP MFA) ]
                     │
                     ▼
[ Backend Validates Credentials & MFA Secret ]
                     │
                     ▼
[ Signs JWT with Role Claim & Permission Bitmask ]
                     │
                     ▼
[ Next.js Admin Panel Receives JWT in Secure Cookie ]
                     │
                     ├── Client-Side: Renders only permitted navigation links
                     │
                     └── Server-Side: Fastify API verifies permission on every route
```

### 3.1 Fastify RBAC Route Guard Example
```typescript
// Architectural contract for route protection
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user || !user.permissions.includes(permission) && !user.permissions.includes('*')) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
  };
}

// Usage in admin route registration:
fastify.post('/api/v1/admin/servers/:id/verify', {
  preHandler: [fastify.authenticateAdmin, requirePermission('servers:verify')],
  handler: serverAdminController.verifyServer
});
```

---

## 4. Single Unified Admin Application (VYRON Control Center)

Rather than maintaining disparate dashboards for content, servers, and releases, the **VYRON Control Center** provides a coherent, role-filtered interface:

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║ VYRON CONTROL CENTER                                [ Staff: Alex (Super) ]  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  NAVIGATION                                                                  ║
║  ├── Dashboard            (Overview metrics, active alerts, system status)   ║
║  ├── Content                                                                 ║
║  │   ├── News Articles    (Authoring, Markdown editor, status review)        ║
║  │   ├── Announcements    (Urgent broadcast banners, maintenance alerts)     ║
║  │   └── Media CDN        (Banner uploads, cover images, WebP assets)        ║
║  ├── Minecraft                                                               ║
║  │   ├── Version Index    (Piston manifest sync, Java mapping)               ║
║  │   ├── Compatibility    (GPU/Renderer empirical device matrix)             ║
║  │   └── Launcher Releases(APK builds, hashes, staged percentage rollouts)   ║
║  ├── Servers                                                                 ║
║  │   ├── Directory        (Public server approvals, offline status pings)    ║
║  │   ├── Verification     (EULA audit, verified partner badge toggle)        ║
║  │   └── Promotions       (Sponsored campaign scheduler & priority bids)     ║
║  ├── Users & Moderation                                                      ║
║  │   ├── Accounts         (Search, device sessions, suspension controls)     ║
║  │   └── Reports          (User flags, offensive server reports)             ║
║  ├── Support & Telemetry                                                     ║
║  │   ├── Crash Logs       (Aggregated stack traces, device breakdown)        ║
║  │   └── Performance      (FPS averages, renderer stability charts)          ║
║  └── System Administration                                                   ║
║      ├── Staff & RBAC     (Role assignment, 2FA enforcement)                 ║
║      ├── Feature Flags    (Remote runtime toggles, emergency kill-switches)  ║
║      └── Audit Logs       (Immutable, chronological staff action history)    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 5. Immutable Administrative Audit Logging

Every state-altering action in the Control Center automatically records an entry in `admin_audit_logs`:
- **Identity:** `admin_user_id`, staff email, client IP address, and browser User-Agent.
- **Action Type:** Verb and target entity (e.g. `SERVER_VERIFIED`, `CAMPAIGN_ACTIVATED`, `ROLLOUT_PERCENTAGE_CHANGED`).
- **State Diffs:** Structured JSON before/after snapshots of the modified entity.
- **Tamper Resistance:** Append-only database table; UPDATE and DELETE privileges are revoked even from standard application database connections.
