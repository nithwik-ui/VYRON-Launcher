# VYRON Persistence & Storage System Audit
**Document ID:** `docs/backend/PERSISTENCE_AUDIT.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — STRICTLY FACTUAL REPOSITORY AUDIT  
**Target Codebase:** `nithwik-ui/VYRON-Launcher` (branch: `v3_openjdk`)  

---

## 1. Executive Summary

This audit catalogs every mechanism, file path, key-value store, and directory utilized for persistence across the launcher codebase.

VYRON's architectural rule dictates that **local gameplay must remain autonomous and offline-first**. Therefore, any persistent state directly required to launch Minecraft, render frames, unpack assets, or configure local controls must remain local.

---

## 2. Exhaustive Persistence Inventory

The table below maps all persistent data sources identified across `app_pojavlauncher`.

| Data Entity | Current Owner / Source Class | Concrete Storage Path / Mechanism | Must Remain Local? | Backend Candidate? | Rationale & Architectural Rule |
|---|---|---|:---:|:---:|---|
| **Launcher Preferences** | `LauncherPreferences.java` | `SharedPreferences` (`com.vyron.launcher_preferences.xml`) | **YES** | **PARTIAL** (Cloud Settings Sync) | Device-specific hardware settings (RAM, DPI scaling, notch handling) must remain local. General user preferences (theme, UI options) can optionally sync to cloud profile. |
| **Active Minecraft Account** | `PojavProfile.java` | `SharedPreferences` (`pojav_profile.xml`, key `"file"`) | **YES** | **NO** | Local launcher state tracking currently selected player profile on this device. |
| **Notification Permission State** | `LauncherPreferences.java` | `SharedPreferences` (key `"skipNotificationPermissionCheck"`) | **YES** | **NO** | Android OS-specific permission flow cache. |
| **Minecraft Profiles / Instances** | `LauncherProfiles.java` | `Tools.GAME_PROFILES_FILE` (`.minecraft/launcher_profiles.json`) | **YES** | **PARTIAL** (Instance Sync / Backup) | Official Mojang standard format. Must remain authoritative locally for engine launch. Cloud can store metadata backup and modpack definitions. |
| **Saved Accounts** | `MinecraftAccount.java` | `Tools.DIR_ACCOUNT_NEW` (`/data/user/0/com.vyron.launcher/accounts/*.json`) | **YES** | **PARTIAL** (VYRON Cloud Profile) | Offline credentials and Microsoft access/refresh tokens must be stored on-device (to be migrated to Android Keystore). VYRON account links player identities on backend. |
| **Installed Java Runtimes** | `MultiRTUtils.java`, `NewJREUtil.java` | `Tools.MULTIRT_HOME` (`/data/user/0/com.vyron.launcher/runtimes/`) | **YES** | **NO** | Native ELF binaries (`libjvm.so`, OpenJDK 8/17/21/25). Cannot run from cloud; must reside in app internal storage for execution permission. |
| **Version Metadata** | `MinecraftDownloader.java`, `AsyncVersionList.java` | `Tools.DIR_HOME_VERSION` (`.minecraft/versions/<id>/<id>.json`) | **YES** | **YES** (Version Index Cache) | Required locally by the engine classpath builder. Backend will index and serve normalized metadata. |
| **Minecraft Client JARs** | `MinecraftDownloader.java` | `Tools.DIR_HOME_VERSION` (`.minecraft/versions/<id>/<id>.jar`) | **YES** | **NO** | Game binary downloaded from Mojang/piston CDN. Must remain local. Backend does not distribute game JARs. |
| **Minecraft Libraries** | `MinecraftDownloader.java` | `Tools.DIR_HOME_LIBRARY` (`.minecraft/libraries/`) | **YES** | **NO** | Java dependencies (LWJGL, Guava, Netty, etc.). Downloaded directly from Mojang and Maven repositories. |
| **Minecraft Assets & Index** | `MinecraftDownloader.java` | `Tools.ASSETS_PATH` (`.minecraft/assets/indexes/`, `.minecraft/assets/objects/`) | **YES** | **NO** | Sounds, textures, fonts. Hundreds of megabytes indexed by SHA-1. Must remain local on device. |
| **Game Saves / Worlds** | Minecraft Engine | `.minecraft/saves/` | **YES** | **FUTURE** (Cloud World Backup) | Local gameplay world files. Local storage is authoritative. Future cloud feature can provide encrypted backup archives. |
| **Local Mods** | Minecraft Loaders (Fabric, Forge, NeoForge, Quilt) | `.minecraft/mods/` | **YES** | **FUTURE** (Modpack Sync) | Local mod JARs. Must remain local for game execution. |
| **Resource Packs & Shaders** | Minecraft Engine / Iris / OptiFine | `.minecraft/resourcepacks/`, `.minecraft/shaderpacks/` | **YES** | **NO** | Graphics assets and shader pipelines. Must remain local for rendering. |
| **Game Options** | Minecraft Engine | `.minecraft/options.txt` | **YES** | **PARTIAL** (Cloud Controls Sync) | Vanilla Minecraft configuration (FOV, audio, controls, sensitivity). |
| **Custom Control Layouts** | `ControlLayout.java`, `CustomControlsActivity.java` | `Tools.CTRLMAP_PATH` (`.minecraft/controlmap/*.json`, `default.json`) | **YES** | **FUTURE** (Community Layouts) | Custom on-screen buttons and touch configurations. Can be exported/shared via backend community repository. |
| **Avatar / Head Texture Cache** | `MinecraftAccount.java` | `Tools.DIR_CACHE` (`/data/user/0/com.vyron.launcher/cache/<username>.png`) | **YES** | **NO** | Transient bitmap cache downloaded from avatar service. |
| **Engine Crash Reports** | PojavLauncher / JRE | `Tools.DIR_HOME_CRASH` (`.minecraft/crash-reports/`) | **YES** | **YES** (Telemetry / Crash Reporting) | Local crash dumps. Critical candidate for opt-in sanitized crash telemetry ingestion by backend. |
| **Server Directory** | Phase 2 `VyronServersRepository.java` | In-memory static list in Phase 2 | **NO** | **YES (Primary Backend Responsibility)** | Server directory, server status, categories, promotions, and player counts must come from VYRON Backend API. |
| **Server Favorites** | Phase 2 `VyronServerModel.isFavorite()` | Hardcoded field in Phase 2 | **YES** (Local cache) | **YES** (Cloud Account Sync) | User's favorite servers should sync across devices when logged into VYRON account. |
| **News & Announcements** | Phase 2 `VyronMoreFragment` (links to external wiki) | None (External URL) | **NO** | **YES (Primary Backend Responsibility)** | Official news feed, changelogs, banners, and critical announcements. |
| **Launcher Release Metadata** | Pojav/Amethyst updater (legacy) | None currently active in v3 | **NO** | **YES (Primary Backend Responsibility)** | Release notes, version check, update links, rollout channels. |

---

## 3. Storage Boundary Analysis

### 3.1 App-Internal Storage (`/data/user/0/com.vyron.launcher/`)
1. **`accounts/` (`DIR_ACCOUNT_NEW`):** Contains `<username>.json` files storing Minecraft accounts and tokens.
2. **`runtimes/` (`MULTIRT_HOME`):** Contains extracted JRE directories (`Internal-17`, `Internal-21`, `External-8`, etc.). Requires Android executable permission, which is only granted in app-internal data directories.
3. **`shared_prefs/`:** 
   - `com.vyron.launcher_preferences.xml`: Hardware preferences, RAM, renderer, download sources, theme overrides.
   - `pojav_profile.xml`: Selected profile pointer.
4. **`cache/` (`DIR_CACHE`):** Temporary downloaded archives (`.tar.xz`), head avatar bitmaps, version manifest cache.

### 3.2 App-External / Scoped Storage (`/sdcard/Android/data/com.vyron.launcher/files/`)
1. **`.minecraft/` (`DIR_GAME_NEW`):**
   - `launcher_profiles.json` (`GAME_PROFILES_FILE`): Profiles/instances.
   - `versions/` (`DIR_HOME_VERSION`): Installed Minecraft version definitions and client JARs.
   - `libraries/` (`DIR_HOME_LIBRARY`): Mojang and third-party Maven libraries.
   - `assets/` (`ASSETS_PATH`): Minecraft asset indexes and hashed objects.
   - `saves/`: Singleplayer worlds.
   - `mods/`: User mods.
   - `resourcepacks/` & `shaderpacks/`: Textures and shaders.
   - `controlmap/` (`CTRLMAP_PATH`): On-screen button layouts.
   - `crash-reports/` (`DIR_HOME_CRASH`): Local engine crash dumps.

---

## 4. Key Takeaways for Backend Architecture

1. **No Duplication of `launcher_profiles.json`:**
   - The backend must **not** attempt to become the authoritative instance storage for local launches.
   - `LauncherProfiles.java` is tightly coupled with the Minecraft launch process. Creating a second local instance database or forcing all instance reads through an API would introduce latency, break offline play, and violate core rules.
2. **Backend is for Community, Identity, Metadata, and Telemetry:**
   - The backend stores: VYRON user identities, news, server directory, version discovery metadata, release rollouts, and crash/performance events.
   - The backend does **not** store or serve multi-gigabyte Minecraft asset trees or game JARs.
