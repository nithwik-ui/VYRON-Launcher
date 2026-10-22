# VYRON Navigation Shell & Screen Foundation Architecture

**Version:** 1.0 (Phase 2)  
**Product:** VYRON — *Your Minecraft. Your World.*  
**Module:** `:app_pojavlauncher`  

---

## 1. Overview & Architectural Boundaries

Phase 2 introduces the complete product layer for VYRON while strictly isolating the underlying Pojav/Amethyst Minecraft engine.

```text
+--------------------------------------------------------------+
|                      VYRON PRODUCT LAYER                     |
|  - Bottom Navigation (Phone) / Navigation Rail (Tablet/Fold) |
|  - VyronNavigator (Backstack, Destination Sync)              |
|  - Home, Instances, Servers, Skins, More, Settings           |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|                         VYRON BRIDGE                         |
|  - VyronInstancesRepository (Binds LauncherProfiles.java)    |
|  - VyronThemeController (Binds LauncherPreferences)          |
|  - ExtraCore.setValue(LAUNCH_GAME, true)                     |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|                   MINECRAFT LAUNCHER ENGINE                  |
|  - LauncherActivity (Process/Permissions/Lifecycle)          |
|  - MinecraftDownloader (Asset Verification & Downloads)       |
|  - Native JNI (jre_launcher.c, libjvm.so)                    |
|  - In-Game HUD: activity_basemain.xml, ControlLayout.java    |
+--------------------------------------------------------------+
```

---

## 2. Adaptive Navigation Shell

### 2.1 Phone Layout (`layout/activity_pojav_launcher.xml`)
- **Structure:** Dynamic Content Container (`container_fragment`) + Download/Task tracker (`progress_layout`) + 5-tab Bottom Navigation (`vyron_bottom_navigation`).
- **Tabs:**
  1. `HOME`: Central launcher hub, greeting, active profile hero, quick-play.
  2. `INSTANCES`: Profile list, loader filter chips, search, instance launcher.
  3. `SERVERS`: Server directory, categories (Featured, Popular, Favorites, My Servers).
  4. `SKINS`: 3D voxel character preview, classic/slim toggle, skin importer.
  5. `MORE`: Wiki, Controls editor, Settings, About, calm VYRON+ card.
- **Window Insets:** Uses `ViewCompat.setOnApplyWindowInsetsListener` to dynamically pad the bottom navigation bar above the Android system gesture bar.

### 2.2 Tablet / Foldable / Landscape Layout (`layout-sw600dp/`, `layout-land/`)
- Activates automatically on devices with smallest screen width ≥ 600dp or in landscape orientation.
- Replaces the bottom navigation bar with an **80dp Vertical Navigation Rail** on the left.
- Displays VYRON logo at the top of the rail, 5 stacked destinations in the middle, and version label at the bottom.
- Provides expansive horizontal content space for lists, hero banners, and side-by-side controls.

---

## 3. Screen Foundations

### 3.1 Home Screen (`VyronHomeFragment` / `MainMenuFragment`)
- **Top App Bar:** Logo, screen title, active player username pill, notifications trigger.
- **Greeting Header:** "Welcome back, {Username}" / "Welcome to VYRON".
- **Hero Card:**
  - Original voxel landscape gradient (`@drawable/vyron_hero_voxel_bg`).
  - Active profile name and version metadata (e.g., "SURVIVAL • Minecraft 1.21.4 • Fabric • Ready").
  - State Badge & Primary CTA:
    - **Ready:** "PLAY GAME" -> triggers `ExtraCore.setValue(ExtraConstants.LAUNCH_GAME, true)`.
    - **Missing Account:** "CONNECT ACCOUNT" -> opens `SelectAuthFragment`.
    - **Installing / Downloading:** Reflects real-time download status.
    - **Offline:** Offline badge with local launch capabilities.
- **Recently Played:** Horizontal cards of existing profiles for rapid launching.
- **What's New:** Patch notes and engine updates.
- **Featured Servers:** Spotlight card for verified community multiplayer servers.

### 3.2 Instances Screen (`VyronInstancesFragment`)
- **Bridge Integration:** Connects directly to `LauncherProfiles.mainProfileJson` via `VyronInstancesRepository`.
- **Search Bar:** Real-time query filtering across profile names and version strings.
- **Loader Filter Chips:**
  - `All`, `Vanilla`, `Fabric`, `Forge`, `NeoForge`, `Quilt`.
- **Instance Cards:** Displays artwork, version, detected loader, mod count (calculated from `.minecraft/mods`), last played timestamp, and individual **PLAY** button.
- **Create Instance:** Directly launches profile creation.

### 3.3 Servers Screen (`VyronServersFragment`)
- **Tabs:** `Featured`, `Popular`, `Favorites`, `My Servers`.
- **Verified Server Cards:** Name, address, description, supported versions, partner status, favorite star toggle.
- **Telemetry Integrity:** Does not present fake live player counts. Clearly displays verified server statuses.
- **Connect Action:** Copies server IP to system clipboard with notification toast.

### 3.4 Skins Screen (`VyronSkinsFragment`)
- **Tactile Voxel Character Canvas (`VyronVoxelCharacterView`):**
  - Original 3D-shaded geometric voxel character model.
  - Interactive touch drag-to-rotate support (-180° to +180°).
  - Classic (4px arm) vs Slim (3px arm) model format toggle.
- **Import PNG:** Integrates with Android `ActivityResultContracts.GetContent` ("image/png").
- **Apply Skin:** Applies active skin to Minecraft profile.

### 3.5 More Screen (`VyronMoreFragment`)
- **Calm VYRON+ Card:** Oak accent card highlighting upcoming cloud features (no flashy gradients).
- **Navigation Shortcuts:** News & Documentation, Custom Controls Editor, Settings, Install JAR / Modpacks, About VYRON.
- **Version Footer:** Displays build number and engine version.

### 3.6 Settings Screen (`VyronSettingsFragment`)
- **General & Appearance:**
  - Theme switching: `Dark Forest`, `Light Morning`, `System`.
  - `Reduce Motion` toggle: Disables decorative transitions and character sway.
- **Minecraft Engine Configuration:**
  - Dynamic Memory (RAM) allocation slider (synchronized with `LauncherPreferences.PREF_RAM_ALLOCATION`).
  - Resolution scaling slider (synchronized with `LauncherPreferences.PREF_SCALE_FACTOR`).
  - Java runtime display.
  - Game directory display.
- **Controls & Storage:**
  - Direct entry to `CustomControlsActivity`.
  - Storage path inspection.
- **About:** Licenses, version, and Privacy Policy link.

---

## 4. Android Back Navigation Rules

Managed deterministically by `VyronNavigator`:

1. **Child Screen / Sub-Fragment:** If user is inside a sub-screen (e.g. `Settings`), Back pops to the previous destination.
2. **Search Mode:** If search input has active query text, Back clears search and restores full item list first.
3. **Non-Home Root Tabs:** If user is on `Instances`, `Servers`, `Skins`, or `More`, Back transitions smoothly back to `HOME`.
4. **Root Home Tab:** When on `HOME`, Back triggers standard Android application exit (`finish()`).
5. **No Broken Stacks:** Fully compatible with `LauncherActivity.onBackPressed()` and `Tools.backToMainMenu()`.

---

## 5. Protected Engine Components

The following native and in-game components were completely protected and untouched during Phase 2:
- `activity_basemain.xml` (In-game OpenGL HUD)
- `ControlLayout.java` (In-game touch buttons and virtual joystick)
- `src/main/jni/` (All native JNI C libraries and launcher bindings)
- `MinecraftDownloader.java` (Asset validation, hashing, runtime unpacking)
- `LauncherProfiles.java` (Profile JSON schema)
