# VYRON Baseline Build & Verification Report

**Date:** October 2026  
**Status:** PASS (Compilation & Build Verified)  
**Target:** `:app_pojavlauncher:compileDebugJavaWithJavac` & `:app_pojavlauncher:mergeDebugResources`  

---

## 1. Toolchain & Environment Baseline

| Component | Verified Version | Path / Location |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 (AMD64) | Local Host |
| **Java JDK** | OpenJDK 17.0.20+8 (Eclipse Adoptium) | `D:\jdk-17` |
| **Android SDK** | API Level 35 (Android 15) | `D:\android-sdk` |
| **Android NDK** | `28.2.13676358` | `D:\android-sdk\ndk\28.2.13676358` |
| **Gradle** | `9.6.1` (via Gradle Wrapper) | `k:\VYRON LAUNCHER\gradle\wrapper` |
| **Android Gradle Plugin** | `9.3.1` | Root `build.gradle` |

---

## 2. Compilation Results

### 2.1 Resource Processing & Merging (`mergeDebugResources`)
- **Status:** `BUILD SUCCESSFUL` (2m 4s, 6 actionable tasks).
- **Verification:** All drawables, layouts (portrait and landscape), values, and localization XMLs compiled cleanly.
- **Noted Non-Fatal Warnings:**
  - Standard AGP localization warnings in non-English translation files (`values-fr`, `values-pl`, `values-az-rAZ`) regarding `%s` format specifiers. These are pre-existing upstream translation files and do not impede compilation or runtime.

### 2.2 Bytecode & Java Compilation (`compileDebugJavaWithJavac`)
- **Status:** `BUILD SUCCESSFUL` (4m 8s, 30 actionable tasks).
- **Verification:**
  - `app_pojavlauncher` Java sources compiled without errors.
  - `androidnsbypass` library module compiled and packaged to `.jar`.
  - Manifest merged cleanly across all dependencies and native `.aar` libraries.
  - Generated R classes and BuildConfig classes verified.

---

## 3. Pre-existing Conditions & External Dependencies

1. **CurseForge API Key:**
   - Pre-existing warning: `BUILD: You have no CurseForge key, the curseforge api will get disabled !`
   - Normal expected behavior when `CURSEFORGE_API_KEY` is not set in environment; fallback dummy is used. Modrinth operates without requiring a key.
2. **Submodules Cloned:**
   - `MioLibPatcher` (cloned from `https://github.com/AngelAuraMC/MioLibPatcher.git`).
   - `androidnsbypass` (cloned from `https://github.com/alexytomi/androidnsbypass.git`).
3. **Upstream Deprecation Flags:**
   - AGP 9.3 deprecation notices for `android.enableJetifier`, `android.nonFinalResIds`, and `android.defaults.buildfeatures.resvalues`. These flags are retained to preserve compatibility with existing custom views.
