# VYRON Offline-First Operational Contract

**Document ID:** `docs/backend/OFFLINE_FIRST_CONTRACT.md`  
**Phase:** Phase 3A.1  
**Scope:** Guaranteed client behaviors during network degradation, offline states, and complete backend outages.

---

## 1. Core Principle & Non-Negotiable Contract

> **The Offline-First Principle:**  
> A mobile gaming launcher must prioritize the player's ability to play local, installed games above all secondary services.  
> The complete unavailability of the VYRON backend, Mojang servers, or local Internet access must NEVER prevent, degrade, or stall the execution of legitimately installed local Minecraft Java Edition versions.

---

## 2. Component Offline Behavior Matrix

| Launcher Subsystem | Online Behavior | Offline / Outage Behavior | Fallback Mechanism |
| :--- | :--- | :--- | :--- |
| **Game Launching** | Verifies version assets & updates if needed | Launches instantly from local disk | Reads local version `.json` & `.jar`; bypasses network completely |
| **Instance Management** | Reads local `launcher_profiles.json` | Reads local `launcher_profiles.json` | Local file is 100% authoritative; zero backend dependency |
| **News & Announcements** | Fetches latest articles via `/api/v1/news` | Displays cached articles | Loads `home_news_cache.json` from disk; subtle offline indicator |
| **Server Directory** | Queries `/api/v1/servers` for ping & status | Displays last known server list | Reads `server_directory_cache.json`; displays "Offline Status" badge |
| **Skins & Cosmetics** | Previews local and synced cloud skins | Loads local skin PNG files | Retains local `.minecraft/skins/` cache |
| **Touch Controls** | Customizes & loads JSON layouts | Customizes & loads JSON layouts | Local internal storage JSON files are locally authoritative |
| **Settings** | Syncs optional preferences to cloud | Loads from `SharedPreferences` | Local preferences always apply immediately |

---

## 3. Launch Path Network Isolation Guarantee

As verified in [`MinecraftDownloader.java`](file:///k:/VYRON%20LAUNCHER/app_pojavlauncher/src/main/java/net/kdt/pojavlaunch/tasks/MinecraftDownloader.java#L87-L115):
```java
if (isLocalProfile || !isOnline) {
    // Validates local files directly without attempting any HTTP/HTTPS handshake
    File providedJsonFile = new File(Tools.DIR_HOME_VERSION + "/" + realVersion + "/" + realVersion + ".json");
    if (providedJsonFile.exists() && providedJsonFile.length() > 0) {
        listener.onDownloadDone();
        return;
    }
}
```

This guarantees:
1. Zero connection timeout delays (no 30s HTTP timeouts blocking the user).
2. Clean offline startup on airplane flights, subways, or remote locations.
3. Resilience against server maintenance, DDOS attacks, or DNS failures.

---

## 4. Cache Expiration & Invalidation Policies

- **News Cache (`home_news_cache.json`):** TTL: 24 hours. Stale-while-revalidate pattern. Never blocks UI rendering.
- **Announcements Cache:** Dismissed critical announcements remain dismissed locally.
- **Server Cache:** Cached server IPs and metadata remain accessible for copy/direct connection.
- **Version Manifests:** Cached Mojang and Modloader manifests allow offline modpack inspection.
