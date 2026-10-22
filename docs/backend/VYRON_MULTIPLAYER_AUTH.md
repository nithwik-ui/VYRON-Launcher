# VYRON Multiplayer Authentication Protocol

## 1. Executive Overview

Minecraft Java Edition multiplayer traditionally relies on Mojang/Microsoft session servers (`sessionserver.mojang.com`) via `hasJoined` and `join` protocols when `online-mode=true`.

For VYRON-compatible servers, standard Minecraft access tokens cannot and should not be forged. A VYRON JWT is not a Microsoft/Mojang token. Passing a VYRON JWT in `--accessToken` or pretending to be Microsoft violates architectural separation and would fail on standard Mojang session verification.

Therefore, VYRON introduces a dedicated, short-lived, scoped **Server Credential Ticket System** for VYRON-compatible servers.

---

## 2. Server Authentication Architecture

```text
┌─────────────────┐                                  ┌────────────────────────┐
│  VYRON Launcher │                                  │  VYRON Backend API     │
└────────┬────────┘                                  └───────────┬────────────┘
         │                                                       │
         │  1. POST /api/v1/auth/server-credential               │
         │     (Bearer <VYRON JWT>, serverAddress)               │
         │ ────────────────────────────────────────────────────> │
         │                                                       │  Generate random 256-bit ticket
         │  2. Returns short-lived ticket                        │  Store in Redis (TTL: 300s)
         │     { serverCredential, expiresIn: 300 }              │  Keys: [serverAddress, username]
         │ <──────────────────────────────────────────────────── │
         │                                                       │
┌────────┴────────┐                                              │
│ Minecraft Client│                                              │
└────────┬────────┘                                              │
         │                                                       │
         │  3. Connects to server & sends ticket                 │
         │     (via custom payload packet or handshake plugin)   │
         │                                                       │
         ▼                                                       │
┌────────────────────────┐                                       │
│ VYRON Server Plugin    │                                       │
│ (Paper / Fabric server)│                                       │
└────────┬───────────────┘                                       │
         │                                                       │
         │  4. POST /api/v1/auth/verify-server-credential        │
         │     (serverAddress, serverCredential, username)       │
         │ ────────────────────────────────────────────────────> │
         │                                                       │  Verify ticket & server scope
         │                                                       │  Check user account active
         │  5. Response: { valid: true, user }                   │  Consume ticket (DELETE key)
         │ <──────────────────────────────────────────────────── │
         │
         │  6. Player admitted to game world
         ▼
```

---

## 3. Security Properties of VYRON Server Credentials

| Property | Implementation | Rationale |
| :--- | :--- | :--- |
| **Short-Lived** | 300-second (5 min) TTL in Redis | Prevents long-term interception risk |
| **Server Scoped** | Bound strictly to `serverAddress:port` | Credential for Server A cannot be used on Server B |
| **Single Use** | Atomic Redis deletion upon verification | Replay attacks fail immediately |
| **Revocable** | Tied to active VYRON user state | Deactivated/banned accounts cannot verify |
| **No Passwords** | Random high-entropy token (`vsc_...`) | Passwords or long-lived refresh tokens never leak |

---

## 4. Server Types Supported by Launcher

1. **Official Minecraft Servers (`online-mode=true`):**
   - Requires an authenticated Microsoft account owning Java Edition.
   - Handled via official Mojang/Microsoft session server.
2. **VYRON-Compatible Servers:**
   - Supports VYRON Account authentication via the VYRON Server Plugin.
   - Validates identity against VYRON Backend API.
3. **Offline / Local Servers (`online-mode=false`):**
   - Permits Local Minecraft Profiles for LAN gameplay and private offline testing.
