# VYRON Launcher — Namespace & Identifier Compatibility Architecture

**Document Version:** 1.0.0  
**Phase:** Phase 4.0 — Namespace & Engine Safety Audit  
**Application ID:** `com.vyron.launcher`  
**Engine Namespace:** `net.kdt.pojavlaunch`  

---

## 1. Architectural Principles & Safety Invariant

The core philosophy of VYRON Launcher is:

> **REMOVE OLD USER-VISIBLE BRANDING WITHOUT BREAKING THE EXISTING ENGINE.**

The Android operating system cleanly distinguishes between two concepts:
1. **Application ID (`applicationId`):** The unique public package identity assigned to the app on Google Play, the system package manager, APK installer, and launcher home screen. In VYRON, this is set to **`com.vyron.launcher`** (and `com.vyron.launcher.debug` for development).
2. **Android Namespace (`namespace`):** The internal Java package structure used during compilation to generate `R.java`, resolve JNI exported function signatures, and map reflection calls. In VYRON, this remains **`net.kdt.pojavlaunch`**.

Blindly renaming `net.kdt.pojavlaunch` to `com.vyron.launcher` would immediately break native JNI dynamic link table lookups, LWJGL windowing callbacks, and in-game OpenJDK rendering.

---

## 2. Identifier Classification Matrix

### 2.1 SAFE TO RENAME (Proven Safe)

The following identifiers were analyzed and proven safe to rename without impacting engine execution:

1. **`app_name` and `app_short_name` (Gradle `resValue` & `strings.xml`):**
   - Renamed to `"VYRON Launcher"`.
   - Controls the label shown in Android Launcher app drawer, recents screen, and notification headers.
2. **`Tools.APP_NAME` (`net/kdt/pojavlaunch/Tools.java`):**
   - Renamed from `"Amethyst"` to `"VYRON Launcher"`.
   - Sets HTTP `User-Agent` in `DownloadUtils` and `-Dnet.minecraft.clientmodname` in `JREUtils`.
   - Displays `"VYRON Launcher"` in the Minecraft in-game F3 debug overlay without breaking networking.
3. **User-Visible UI Strings in `res/values*/strings.xml`:**
   - `storage_required`: Error dialog text when external storage is missing.
   - `modpack_install_notification_title`: Notification title during modpack installation.
   - `notification_permission_dialog_text`: System permission justification dialog.
   - `preference_category_experimental_settings`: Settings header.
4. **About Screen & Metadata Dialogs (`VyronMoreFragment.java` & `about_en.txt`):**
   - Product identity, version, tagline, and legal attributions.
5. **Launcher Icon Assets (`mipmap-*/ic_launcher*` & `drawable/notif_icon.png`):**
   - Replaced all legacy bitmaps with generated assets derived directly from the user-uploaded 1024x1024 VYRON icon.

---

### 2.2 MUST REMAIN (Coupled to JNI / Native Engine / Reflection)

The following internal identifiers **MUST NOT** be renamed. Any modification would result in immediate runtime failure:

#### A. Native JNI Export Symbols (`libpojavexec.so` & `libpojavexec_awt.so`)
Native C functions exported with `JNIEXPORT` require exact mangling matching the Java package and class name:
- `Java_net_kdt_pojavlaunch_AWTInputBridge_nativeSendData`
- `Java_net_kdt_pojavlaunch_AWTInputBridge_nativeClipboardReceived`
- `Java_net_kdt_pojavlaunch_AWTInputBridge_nativeMoveWindow`
- `Java_net_kdt_pojavlaunch_utils_JREUtils_renderAWTScreenFrame`
- `Java_net_kdt_pojavlaunch_utils_JREUtils_setupBridgeWindow`
- `Java_net_kdt_pojavlaunch_utils_JREUtils_releaseBridgeWindow`

#### B. Native C Reflection (`FindClass`)
In `app_pojavlauncher/src/main/jni/awt_bridge.c`:
- `(*env)->FindClass(env, "net/kdt/pojavlaunch/MainActivity")`
The native AWT subsystem directly resolves `MainActivity` by string. Changing the Java package would cause `FindClass` to return `NULL` and crash with `ClassNotFoundException` / `SIGSEGV`.

#### C. Native Windowing & Renderer Entry Points
In `app_pojavlauncher/src/main/jni/egl_bridge.c`:
- Functions `pojavInit()`, `pojavTerminate()`, `pojavSetWindowHint()` are dynamically called via `dlsym()` by the modified LWJGL GLFW library (`libglfw.so`).
- Structure `pojav_environ` holds the native Android `ANativeWindow` surface.

#### D. JVM System Properties & Environment Flags
In `app_pojavlauncher/src/main/java/net/kdt/pojavlaunch/utils/JREUtils.java`:
- `-Dpojav.path.minecraft=` and `-Dpojav.path.private.account=`: Read by custom Minecraft classloaders.
- `POJAV_EMUI_ITERATOR_MITIGATE`, `POJAVEXEC_EGL`, `POJAV_VSYNC_IN_ZINK`: Consumed by Mesa, Zink, and MobileGlues graphics translation layers.

#### E. Storage Compatibility Directory
In `net/kdt/pojavlaunch/Tools.java`:
- `DIR_GAME_HOME = ... + "/games/Amethyst"` (Android <= 9 fallback): Existing player data on legacy Android devices resides in this path. Changing it would cause users to lose access to their installed worlds and settings.

#### F. Touch Controller IPC Socket
In `net/kdt/pojavlaunch/utils/TouchControllerUtils.java`:
- `socketName = "Amethyst"`: Abstract Unix domain socket shared between the Android touch overlay view and the in-game touch controller mod.

---

### 2.3 USER-VISIBLE ONLY (Safely Changed to VYRON)

| Location | Old Value | New Value | Safe Reason |
| :--- | :--- | :--- | :--- |
| Launcher Title | `PojavLauncher` | `VYRON Launcher` | User-facing string |
| Crash Report Header | `Amethyst crash report\n` | `VYRON Launcher crash report\n` | User-facing crash report text |
| In-game Mod Warning | `...Amethyst-Android does NOT support...` | `...VYRON Launcher does NOT support...` | User-facing log message |
| SDL Bridge Log | `Amethyst-Android: SDL support enabled!` | `VYRON Launcher: SDL support enabled!` | User-facing log message |
| Legacy4J Log | `Amethyst-Android: Fixed/Broken version...` | `VYRON Launcher: Fixed/Broken version...` | User-facing log message |
| Layout Preview | `tools:text="PojavLauncher version: Foxglove"` | `tools:text="VYRON Launcher version: 3.0.0"` | Android Studio designer preview only |
| Icon Background | `#FFFFFF` | `#151815` | Theme background color |

---

## 3. Verification & Compliance Conclusion

By decoupling the **user-visible product identity** (`VYRON Launcher`, `com.vyron.launcher`, dark icon theme) from the **internal native engine namespace** (`net.kdt.pojavlaunch`), VYRON achieves complete, professional branding without introducing any engine regressions or JNI linkage failures.
