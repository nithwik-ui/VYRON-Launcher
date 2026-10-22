# VYRON News & Announcements CMS Architecture
**Document ID:** `docs/backend/NEWS_CMS.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM ARCHITECTURE SPECIFICATION  
**Scope:** Content Management, Publishing Workflows, and Android Client Feed Delivery  

---

## 1. CMS Domain Overview

The VYRON News & Announcements Content Management System (CMS) enables staff to author, schedule, review, and broadcast release notes, community updates, launcher tutorials, and critical service alerts directly into the Android launcher application.

All content is authored in GitHub-flavored Markdown, rendered dynamically on the Android client using native TextViews or lightweight Markdown formatters, and cached at the network edge via Cloudflare CDN.

---

## 2. Article Entity Specification & Metadata

### 2.1 Complete Data Attributes

| Attribute | Type | Description |
|---|---|---|
| `id` | `UUID` | Global unique identifier. |
| `title` | `String (255)` | Compelling editorial headline. |
| `slug` | `String (128)` | SEO-friendly URL slug (e.g. `vyron-3-release-notes`). Unique index. |
| `summary` | `String (500)` | 1-2 sentence teaser displayed on the Home feed card. |
| `bodyMarkdown` | `Text` | Complete article text supporting headings, lists, images, code, and callouts. |
| `coverImageUrl` | `String (512)` | High-resolution hero image (16:9 aspect ratio, WebP format). |
| `authorName` | `String (64)` | Display name of author or "VYRON Team". |
| `category` | `String (32)` | Slug of parent category (`updates`, `community`, `guides`, `events`). |
| `tags` | `Array<String>` | Searchable keywords (e.g. `['1.21.4', 'shaders', 'performance']`). |
| `status` | `Enum` | `DRAFT`, `REVIEW`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`. |
| `isFeatured` | `Boolean` | If true, pinned as the large carousel hero on the Home feed. |
| `publishedAt` | `Timestamp` | Scheduled or actual publication timestamp. |
| `updatedAt` | `Timestamp` | Last modification timestamp for cache invalidation. |
| `seoMetadata` | `JSONB` | OpenGraph title, description, and canonical URL for web mirror. |

---

## 3. Publication Workflow & State Machine

```text
[ DRAFT ] ───────────► [ REVIEW ] ───────────► [ SCHEDULED ] ───────────► [ PUBLISHED ]
   │                       │                          │                          │
   │ (Discard)             │ (Request Changes)        │ (Cancel)                 │ (Deprecate)
   ▼                       ▼                          ▼                          ▼
[ ARCHIVED ]           [ DRAFT ]                  [ DRAFT ]                  [ ARCHIVED ]
```

1. **`DRAFT`:** Content author drafts article; auto-saved in PostgreSQL; previewable by staff.
2. **`REVIEW`:** Ready for editorial quality review, grammar check, and image asset validation.
3. **`SCHEDULED`:** Approved for release at a future `publishedAt` timestamp. Background worker publishes when time arrives.
4. **`PUBLISHED`:** Publicly visible to all Android launcher clients and web mirrors. Cached on CDN.
5. **`ARCHIVED`:** Deprecated or outdated article hidden from main feed, preserved for audit history.

---

## 4. Android Client Delivery Architecture

### 4.1 Home Feed News Retrieval
- **Client Trigger:** Initial launch of `VyronHomeFragment` or pull-to-refresh.
- **Request:** `GET /api/v1/news?limit=5&featured=true`
- **Delivery Strategy:**
  1. **HTTP Caching:** Response carries `Cache-Control: public, max-age=300, stale-while-revalidate=600` and `ETag: W/"..."`.
  2. **Offline Local Cache:** Android app caches the JSON payload in `Tools.DIR_CACHE/home_news_cache.json`.
  3. **Offline Rendering:** If device has no internet connection, the Home feed loads cached news items seamlessly without showing an error screen.

### 4.2 Article Details Retrieval
- **Client Trigger:** User taps a news card.
- **Request:** `GET /api/v1/news/:slug`
- **Delivery Strategy:** Returns full `bodyMarkdown`. Rendered natively using rich Spanned string formatting.

### 4.3 Announcements & Urgent Service Banners
- **Endpoint:** `GET /api/v1/announcements/active`
- **Urgent Notification Types:**
  - `INFO`: General notices (e.g. new OptiFine version available).
  - `WARNING`: Known game issues (e.g. Android 15 GPU driver bug alert).
  - `CRITICAL`: Urgent security bulletins or mandatory updates.
  - `MAINTENANCE`: Scheduled backend or server maintenance windows.
- **UI Presentation:** Persistent dismissible banner displayed at the very top of `VyronHomeFragment`. High-severity notices remain pinned until acknowledged.
