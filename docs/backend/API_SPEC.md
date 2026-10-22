# VYRON REST API Specification (v1)
**Document ID:** `docs/backend/API_SPEC.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — API CONTRACT SPECIFICATION  
**Base URL:** `https://api.vyronlauncher.com/api/v1`  

---

## 1. Global API Standards & Conventions

### 1.1 Standard Request Headers

| Header | Type | Required | Description |
|---|---|:---:|---|
| `Authorization` | `string` | Conditional | `Bearer <access_token>` (for protected endpoints) |
| `Content-Type` | `string` | Yes | `application/json` (for POST/PATCH/PUT) |
| `X-Vyron-Client-Version`| `string` | Yes | Android client version name, e.g. `3.0.0` |
| `X-Vyron-Device-Id` | `string` | Yes | Unique persistent device hash / fingerprint |
| `X-Request-Id` | `string` | Optional | Client-generated trace UUID; echoed in response |
| `If-None-Match` | `string` | Optional | ETag cache validator for immutable/content endpoints |

### 1.2 Standard Success Envelope
All successful responses return HTTP `200 OK` (or `201 Created` / `204 No Content`) with a structured JSON envelope:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_01HPX7Z9ABCDEF012345",
    "timestamp": "2026-10-22T10:00:00.000Z"
  }
}
```

### 1.3 Standard Error Envelope
All error responses adhere to the standard format across all HTTP 4xx/5xx codes:
```json
{
  "success": false,
  "error": {
    "code": "AUTH_SESSION_EXPIRED",
    "message": "Your session has expired. Please log in again.",
    "details": {},
    "requestId": "req_01HPX7Z9ABCDEF012345"
  }
}
```

### 1.4 Standard Pagination Envelope
Endpoints returning collections use cursor-based or limit-offset pagination:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 142,
    "hasMore": true,
    "nextCursor": "cursor_eyJsYXN0SWQiOiAi..."
  },
  "meta": { "requestId": "..." }
}
```

---

## 2. Authentication & Identity (`/api/v1/auth`)

### 2.1 Register New Account
- **Endpoint:** `POST /api/v1/auth/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "username": "EnderCrafter",
    "email": "player@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "a57d0f62-2e3b-48cf-9457-3a1317a78d0a",
        "username": "EnderCrafter",
        "email": "player@example.com",
        "avatarUrl": null,
        "createdAt": "2026-10-22T10:00:00Z"
      },
      "tokens": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "rf_7b89e2...",
        "expiresIn": 900
      }
    }
  }
  ```

### 2.2 Login with Password
- **Endpoint:** `POST /api/v1/auth/login`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "login": "player@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "a57d0f62-2e3b-48cf-9457-3a1317a78d0a",
        "username": "EnderCrafter",
        "email": "player@example.com",
        "avatarUrl": null
      },
      "tokens": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "rf_9a41c3...",
        "expiresIn": 900
      }
    }
  }
  ```

### 2.3 Refresh Access Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "refreshToken": "rf_9a41c3..."
  }
  ```
- **Response (200 OK):** Returns new `accessToken` and rotated `refreshToken`.

### 2.4 Logout (Revoke Session)
- **Endpoint:** `POST /api/v1/auth/logout`
- **Auth:** Bearer Token
- **Request Body:** `{ "refreshToken": "rf_9a41c3..." }`
- **Response (200 OK):** `{ "success": true, "data": { "message": "Logged out successfully" } }`

### 2.5 Get Current User (`/me`)
- **Endpoint:** `GET /api/v1/auth/me`
- **Auth:** Bearer Token
- **Response (200 OK):** Current user object, linked Minecraft accounts, active subscription tier.

---

## 3. User Profile (`/api/v1/profile`)

### 3.1 Get Profile
- **Endpoint:** `GET /api/v1/profile`
- **Auth:** Bearer Token
- **Response (200 OK):** User settings, bio, linked Minecraft accounts, bookmarked server IDs.

### 3.2 Update Profile
- **Endpoint:** `PATCH /api/v1/profile`
- **Auth:** Bearer Token
- **Request Body:**
  ```json
  {
    "bio": "Minecraft Java enthusiast on Android.",
    "avatarUrl": "https://assets.vyronlauncher.com/avatars/user1.png"
  }
  ```
- **Response (200 OK):** Updated user profile object.

---

## 4. News & Announcements (`/api/v1/news`, `/api/v1/announcements`)

### 4.1 List Published News Articles
- **Endpoint:** `GET /api/v1/news`
- **Auth:** Public
- **Query Params:** `category`, `limit` (default 10), `offset`
- **Caching:** Cache-Control: `public, max-age=300, stale-while-revalidate=600`, supports ETag.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "e2f1d93b-1234-5678-abcd-0123456789ab",
        "slug": "welcome-to-vyron-3-release",
        "title": "Welcome to VYRON 3.0",
        "summary": "Discover the next evolution of Minecraft Java on mobile.",
        "coverImageUrl": "https://assets.vyronlauncher.com/news/v3_cover.webp",
        "category": "updates",
        "author": "VYRON Team",
        "isFeatured": true,
        "publishedAt": "2026-10-22T08:00:00Z"
      }
    ]
  }
  ```

### 4.2 Get Article Details by Slug
- **Endpoint:** `GET /api/v1/news/:slug`
- **Auth:** Public
- **Response (200 OK):** Full article payload including `bodyMarkdown`.

### 4.3 Get Active Announcements
- **Endpoint:** `GET /api/v1/announcements/active`
- **Auth:** Public
- **Response (200 OK):** Active urgent banners (maintenance notices, critical updates).

---

## 5. Minecraft Versions & Compatibility (`/api/v1/minecraft`)

### 5.1 List Indexed Minecraft Versions
- **Endpoint:** `GET /api/v1/minecraft/versions`
- **Auth:** Public
- **Query Params:** `type` (`release`, `snapshot`), `limit`, `offset`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "1.21.4",
        "type": "release",
        "releaseTime": "2024-12-03T12:00:00Z",
        "minJavaVersion": 21,
        "recommendedRenderer": "ANGLE",
        "isSupported": true
      }
    ]
  }
  ```

### 5.2 Get Version Details
- **Endpoint:** `GET /api/v1/minecraft/versions/:id`
- **Auth:** Public
- **Response (200 OK):** Returns normalized library dependencies, Java requirements, asset index pointer, and Mojang Piston manifest URL.

### 5.3 Query Hardware Compatibility
- **Endpoint:** `GET /api/v1/minecraft/compatibility`
- **Auth:** Public
- **Query Params:** `version`, `soc`, `renderer`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "status": "SUPPORTED",
      "minecraftVersion": "1.21.4",
      "recommendedJava": 21,
      "recommendedRenderer": "ANGLE",
      "recommendedRamMb": 2048,
      "notes": "Optimal performance with Vulkan backend enabled."
    }
  }
  ```

---

## 6. Server Directory & Promotions (`/api/v1/servers`)

### 6.1 List Public Servers
- **Endpoint:** `GET /api/v1/servers`
- **Auth:** Public
- **Query Params:** `category`, `search`, `limit`, `offset`
- **Response (200 OK):** Paginated server models with online status, MOTD, and player count.

### 6.2 Get Featured / Sponsored Servers
- **Endpoint:** `GET /api/v1/servers/featured`
- **Auth:** Public
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "srv_1",
        "name": "VYRON Official SMP",
        "host": "smp.vyronlauncher.com",
        "port": 25565,
        "summary": "Official VYRON survival multiplayer world.",
        "supportedVersions": "1.21.x",
        "badge": "FEATURED",
        "isSponsored": false,
        "playersOnline": 142,
        "playersMax": 500,
        "pingMs": 35
      },
      {
        "id": "srv_partner_1",
        "name": "MythicCraft Network",
        "host": "play.mythiccraft.com",
        "port": 25565,
        "summary": "Custom MMORPG classes, dungeons, and cosmetics.",
        "supportedVersions": "1.20 - 1.21.x",
        "badge": "SPONSORED",
        "isSponsored": true,
        "playersOnline": 380,
        "playersMax": 1000,
        "pingMs": 48
      }
    ]
  }
  ```

### 6.3 Real-Time Server Ping Status
- **Endpoint:** `GET /api/v1/servers/:id/status`
- **Auth:** Public
- **Response (200 OK):** Current online state, MOTD, player counts, latency.

### 6.4 Favorite / Unfavorite Server
- **Endpoint:** `POST /api/v1/servers/:id/favorite` & `DELETE /api/v1/servers/:id/favorite`
- **Auth:** Bearer Token
- **Response (200 OK):** `{ "success": true, "isFavorite": true }`

---

## 7. Launcher Releases & Rollouts (`/api/v1/releases`)

### 7.1 Check Latest Update
- **Endpoint:** `GET /api/v1/releases/latest`
- **Auth:** Public
- **Query Params:** `channel` (`STABLE`, `BETA`), `currentCode`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "hasUpdate": true,
      "versionName": "3.1.0",
      "versionCode": 30100,
      "releaseChannel": "STABLE",
      "apkUrl": "https://assets.vyronlauncher.com/releases/vyron-v3.1.0.apk",
      "sha256": "8f3b2...",
      "changelogMarkdown": "### New in 3.1.0\n- High FPS optimization...",
      "isMandatory": false
    }
  }
  ```

---

## 8. Telemetry Ingestion (`/api/v1/telemetry`)

### 8.1 Ingest Anonymized Launch Event
- **Endpoint:** `POST /api/v1/telemetry/events`
- **Auth:** Public (Rate-limited by device fingerprint)
- **Request Body:**
  ```json
  {
    "events": [
      {
        "name": "minecraft_launch_success",
        "timestamp": 1774267200000,
        "properties": {
          "minecraftVersion": "1.21.4",
          "javaVersion": 21,
          "renderer": "ANGLE",
          "ramMb": 2048,
          "deviceModel": "Pixel 8 Pro",
          "durationMs": 4200
        }
      }
    ]
  }
  ```
- **Response (202 Accepted):** `{ "success": true, "ingested": 1 }`
