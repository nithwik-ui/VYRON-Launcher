# VYRON Launcher — Repository Branding Audit

**Document Version:** 1.0.0  
**Phase:** Phase 4.0 — Branding, App Name, Icon & User-Visible Identity Cleanup  
**Target Module:** `:app_pojavlauncher`  
**Application ID:** `com.vyron.launcher`  
**Internal Namespace:** `net.kdt.pojavlaunch` (Preserved for JNI/Native Engine Compatibility)  

---

## 1. Executive Summary

A comprehensive repository-wide audit was conducted across all files, resources, build scripts, Java/Kotlin sources, native C/C++ libraries, and documentation to identify every instance of legacy branding (`PojavLauncher`, `Pojav Launcher`, `Pojav`, `Amethyst`, and `net.kdt.pojavlaunch`).

Each occurrence was strictly classified into one of three architectural categories:
1. **Category A (User-Visible — MUST CHANGE):** UI labels, launcher names, dialogs, notifications, error prompts, accessibility strings, and app store metadata. All user-visible occurrences have been systematically updated to **VYRON Launcher**.
2. **Category B (Internal Compatibility Identifier — DO NOT CHANGE):** Native JNI symbols, shared library exports (`libpojavexec.so`), JVM reflection paths (`FindClass("net/kdt/pojavlaunch/...")`), Minecraft runtime properties, and legacy storage paths required for backward compatibility.
3. **Category C (Documentation / Legacy Attribution):** Open-source lineage notices, GPL-3.0 licensing credits, and copyright notices required under open-source compliance.

---

## 2. Category A: User-Visible Occurrences (Resolved)

All user-visible branding has been replaced with **VYRON Launcher** across all Android configuration and resource files:

| File / Component | Line(s) | Original Legacy Branding | Updated VYRON Identity | Classification Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `app_pojavlauncher/build.gradle` | 125, 126 | `resValue "string", "app_name", "VYRON (Debug)"`<br>`resValue "string", "app_short_name", "VYRON (Debug)"` | `resValue "string", "app_name", "VYRON Launcher"`<br>`resValue "string", "app_short_name", "VYRON Launcher"` | Ensures launcher home screen label is always **VYRON Launcher** in debug and release |
| `app_pojavlauncher/build.gradle` | 149, 150 | `resValue "string", "app_name", "VYRON Launcher"`<br>`resValue "string", "app_short_name", "VYRON"` | `resValue "string", "app_name", "VYRON Launcher"`<br>`resValue "string", "app_short_name", "VYRON Launcher"` | Production release label standardization |
| `res/values/strings.xml` | 4, 458 | `<string name="app_name">VYRON Launcher</string>`<br>`<string name="app_short_name">VYRON Launcher</string>` | Preserved as `VYRON Launcher` | Primary Android application label |
| `res/values/strings.xml` | 278 | `PojavLauncher requires external storage to be attached...` | `VYRON Launcher requires external storage to be attached...` | User-facing storage permission error |
| `res/values/strings.xml` | 345 | `Pojav Modpack Installer` | `VYRON Modpack Installer` | Modpack installation notification title |
| `res/values/strings.xml` | 371 | `Experimental fuckury` | `Experimental Features` | Cleaned user-facing settings category |
| `res/values/strings.xml` | 377 | `PojavLauncher requires a permission to post notifications...` | `VYRON Launcher requires permission to post notifications...` | User-facing notification permission dialog |
| `res/values-*/strings.xml` (28 languages) | Various | `PojavLauncher`, `Pojav launcher`, `Pojav Modpack Installer` | `VYRON Launcher`, `VYRON Modpack Installer` | Localized user-visible strings across Arabic, Chinese, German, Spanish, French, Japanese, Korean, Russian, Turkish, Vietnamese, etc. |
| `res/layout/item_simple_list_1.xml` | 23 | `tools:text="PojavLauncher version: Foxglove"` | `tools:text="VYRON Launcher version: 3.0.0"` | Preview layout text |
| `res/values/ic_launcher_background.xml` | 3 | `<color name="ic_launcher_background">#FFFFFF</color>` | `<color name="ic_launcher_background">#151815</color>` | Launcher icon background color matching VYRON palette |
| `app_pojavlauncher/src/main/assets/about_en.txt` | 1-24 | `%s (Minecraft Java Launcher for Android)... by Tran Khanh Duy...` | Updated to official VYRON Launcher About text with open-source lineage section | User-visible About file |
| `com/vyron/ui/more/VyronMoreFragment.java` | 60-64 | `Toast.makeText(..., "VYRON Launcher v1.1.7...")` | Replaced with full Material About dialog displaying version, features, and GPL-3.0 attribution | User-visible About action |
| `net/kdt/pojavlaunch/PojavApplication.java` | 48 | `crashStream.append("Amethyst crash report\n");` | `crashStream.append("VYRON Launcher crash report\n");` | User-visible crash log header in `latestcrash.txt` |
| `net/kdt/pojavlaunch/MainActivity.java` | 488 | `Logger.appendToLog("WARNING: Sodium is being used, Amethyst-Android does NOT support this mod...");` | `Logger.appendToLog("WARNING: Sodium is being used, VYRON Launcher does NOT support this mod...");` | Game launch log message |
| `org/lwjgl/glfw/CallbackBridge.java` | 253, 256 | `Logger.appendToLog("Amethyst-Android: SDL support enabled!");`<br>`"Amethyst-Android: Failed to initialize SDL..."` | `Logger.appendToLog("VYRON Launcher: SDL support enabled!");`<br>`"VYRON Launcher: Failed to initialize SDL..."` | Game launch log messages |
| `net/kdt/pojavlaunch/Tools.java` | 117 | `public static String APP_NAME = "Amethyst";` | `public static String APP_NAME = "VYRON Launcher";` | Sets `net.minecraft.clientmodname` in JVM F3 debug screen and HTTP User-Agent |
| `net/kdt/pojavlaunch/Tools.java` | 641, 648 | `"Amethyst-Android: Broken/Fixed version of Legacy4J..."` | `"VYRON Launcher: Broken/Fixed version of Legacy4J..."` | Game launch log messages |
| `dataremoval.md` | 1-2 | `# Remove Angel Aura Amethyst account data` | `# Remove VYRON Launcher account data` | Documentation |

---

## 3. Category B: Internal Compatibility Identifiers (Strictly Preserved)

The following identifiers must **NOT** be changed. Renaming them would break the native compilation bridge, JNI dynamic symbol resolution, or JVM launch capability:

| Component / File | Identifier | Purpose | Reason Why It Must Remain |
| :--- | :--- | :--- | :--- |
| `Android.mk` | `LOCAL_MODULE := pojavexec` | Native C execution library | Compiled into `libpojavexec.so`; loaded by `System.loadLibrary("pojavexec")` in `CallbackBridge` and `VMLauncher` |
| `Android.mk` | `LOCAL_MODULE := pojavexec_awt` | AWT GUI native bridge | Compiled into `libpojavexec_awt.so`; loaded during Java installer execution |
| `awt_bridge.c` | `Java_net_kdt_pojavlaunch_AWTInputBridge_*` | JNI exported functions | Exact symbol matching for `AWTInputBridge.java` native methods |
| `awt_bridge.c` | `FindClass("net/kdt/pojavlaunch/MainActivity")` | JNI reflection call | Resolves `MainActivity` from native C code |
| `egl_bridge.c` | `Java_net_kdt_pojavlaunch_utils_JREUtils_setupBridgeWindow` | Native surface bridge | Links Android `ANativeWindow` to EGL/Vulkan renderers |
| `egl_bridge.c` | `pojavInit`, `pojavTerminate`, `pojavSetWindowHint` | C functions in `libpojavexec.so` | Called by LWJGL3 glfw patch (`libglfw.so`) during window creation |
| `Tools.java` | `DIR_GAME_HOME = ... + "/games/Amethyst"` | Legacy Android 9 storage path | Prevents data loss for users on Android 9 or below who have existing worlds in that folder |
| `Tools.java` | `LAUNCHERPROFILES_RTPREFIX = "amethyst://"` | Runtime prefix in `launcher_profiles.json` | Internal engine identifier for profile JVM runtime selection |
| `JREUtils.java` | `POJAV_EMUI_ITERATOR_MITIGATE`, `POJAVEXEC_EGL`, `POJAV_VSYNC_IN_ZINK` | JVM / Mesa environment variables | Read by native graphics driver translation layer (Mesa, Zink, ANGLE) |
| `JREUtils.java` | `-Dpojav.path.minecraft=`, `-Dpojav.path.private.account=` | JVM system properties | Injected into Minecraft command-line arguments to establish virtual file systems |
| `TouchControllerUtils.java` | `socketName = "Amethyst"` | Unix domain socket name | IPC communication channel between Android touch controller view and in-game touch mod |
| `AndroidManifest.xml` | `package="net.kdt.pojavlaunch"` | Android namespace | Required for JNI class resolution; decoupled from `applicationId="com.vyron.launcher"` |

---

## 4. Category C: Documentation & Legal Attribution (Preserved)

As documented in `docs/legal/THIRD_PARTY_LICENSES.md`, open-source compliance under GNU GPL-3.0 requires attribution of upstream authors and lineages:
- **PojavLauncher & Boardwalk:** Credited in `About` screen, `about_en.txt`, and `README.md` as the underlying mobile JVM engine lineage.
- **Copyright Notices:** Unchanged in header comments of upstream source files.

---

## 5. Audit Conclusion

All Category A user-visible branding has been completely transitioned to **VYRON Launcher**.  
All Category B engine and JNI compatibility identifiers have been safeguarded to guarantee zero engine regressions.  
All Category C legal requirements have been satisfied.
