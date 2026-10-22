# VYRON Multi-Dimensional Compatibility System
**Document ID:** `docs/backend/COMPATIBILITY.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM ARCHITECTURE SPECIFICATION  
**Scope:** Multi-Dimensional Matrix for Devices, Renderers, Java Versions, and Minecraft Releases  

---

## 1. The Mobile Compatibility Challenge

Running desktop Minecraft Java Edition on Android hardware involves bridging multiple disparate technologies:
- Desktop OpenGL calls translated to Mobile Vulkan or OpenGL ES.
- ARM64 execution of Java bytecode with native JNI libraries.
- Diverse Android GPU architectures (Adreno, Mali, Immortalis, PowerVR).
- Strict Linux kernel and Android Linker namespace constraints.

To provide players with a smooth experience, the VYRON backend maintains an empirical **Multi-Dimensional Compatibility Matrix** that guides the launcher in selecting optimal defaults (e.g. renderer, RAM allocation, Java runtime).

---

## 2. Multi-Dimensional Matrix Dimensions

Compatibility is evaluated across seven distinct axes:

1. **Minecraft Version:** Target version ID (e.g. `1.7.10`, `1.16.5`, `1.20.1`, `1.21.4`).
2. **Java Runtime:** Required OpenJDK major version (`8`, `17`, `21`, `25`).
3. **Launcher Version:** VYRON client release (e.g. `3.0.0`).
4. **Hardware Architecture:** `arm64-v8a` (standard modern), `armeabi-v7a` (legacy 32-bit), `x86_64`, `x86`.
5. **Graphics Renderer:**
   - **`ANGLE`:** Google ANGLE translation (OpenGL ES to Vulkan/GLES). High stability on Adreno/Mali.
   - **`Zink`:** Mesa Gallium Zink (OpenGL implementation on Vulkan). High performance on modern Vulkan 1.3+ devices.
   - **`MobileGlues`:** OpenGL 2.1/3.3 wrapper optimized for mobile devices.
   - **`SFPEW`:** Floating-point emulation wrapper for legacy devices.
6. **Modloader:** `Vanilla`, `Fabric`, `NeoForge`, `Forge`, `Quilt`.
7. **Device Class:**
   - **High-End:** Snapdragon 8 Gen 1/2/3, Dimensity 9000+, Tensor G3+, 8GB+ RAM.
   - **Mid-Range:** Snapdragon 7/778G, Dimensity 7000/8000, 6GB-8GB RAM.
   - **Budget / Low-End:** Snapdragon 600 series, Helio G-series, <= 4GB RAM.

---

## 3. Compatibility Status Taxonomy

| Status | Meaning | Launcher Behavior |
|---|---|---|
| **`SUPPORTED`** | Verified and tested. Optimal frame stability and reliable launching guaranteed under recommended settings. | Green badge in UI. Play button directly launches without warnings. |
| **`EXPERIMENTAL`** | Launchable, but known minor graphical artifacts, lower FPS, or high memory pressure may occur. | Amber badge. Tooltip advises player on tweaks (e.g. "Lower resolution scale to 80%"). |
| **`UNKNOWN`** | Untested combination. No crowd reports or team benchmarks recorded yet. | Neutral badge. Allowed to launch with conservative safe defaults. |
| **`BLOCKED`** | Known fatal crash, missing native libraries, or hardware incompatibility (e.g. JRE 21 on x86 32-bit). | Red badge. Play button disabled with actionable explanation. |

---

## 4. Empirical Baseline Matrix (Verified Combinations)

Based on repository code and engine testing, the following baseline ratings are codified:

| Minecraft Version Range | Required Java | Architecture | Recommended Renderer | Loader | Device Class | Status | Notes |
|---|:---:|---|---|---|---|:---:|---|
| **1.7.10 - 1.12.2** | JRE 8 | arm64-v8a | ANGLE / MobileGlues | Vanilla, Forge | All Classes | **`SUPPORTED`** | Classic legacy Minecraft. Extremely stable. |
| **1.16.5** | JRE 8 | arm64-v8a | ANGLE / Zink | Vanilla, Fabric, Forge | All Classes | **`SUPPORTED`** | Nether update; peak modpack stability. |
| **1.17 - 1.19.4** | JRE 17 | arm64-v8a | ANGLE / Zink | Vanilla, Fabric | Mid/High | **`SUPPORTED`** | Introduced OpenGL 3.2 core requirement. |
| **1.20.1 - 1.20.4** | JRE 17 | arm64-v8a | Zink / ANGLE | Vanilla, Fabric, Forge | Mid/High | **`SUPPORTED`** | Zink delivers superior framerates on Adreno 7xx. |
| **1.20.5 - 1.21.4** | JRE 21 | arm64-v8a | ANGLE / Zink | Vanilla, Fabric, NeoForge | Mid/High | **`SUPPORTED`** | Requires Java 21 OpenJDK. Excellent with Fabric. |
| **1.20.5 - 1.21.4** | JRE 21 | x86 (32-bit) | Any | Any | Low-End | **`BLOCKED`** | Java 21 lacks x86 32-bit Android port (`NewJREUtil.java:186`). |
| **1.21.x + Shaders** | JRE 21 | arm64-v8a | Zink (Kopper) | Iris / Sodium | High-End | **`EXPERIMENTAL`**| Requires Vulkan 1.3 and high GPU memory headroom. |
| **All Versions** | Any | armeabi-v7a | SFPEW | Any | Budget (32-bit) | **`EXPERIMENTAL`**| 32-bit address space limits RAM allocation to < 700MB. |

---

## 5. Client Auto-Configuration Protocol

When an instance is selected or launched:
1. Client sends device context (Device Model, GPU Renderer, RAM) and instance target (Minecraft version, loader).
2. Backend returns recommended configuration:
   ```json
   {
     "status": "SUPPORTED",
     "recommendedRenderer": "ANGLE",
     "recommendedJava": 21,
     "recommendedRamMb": 2048,
     "recommendedScaleFactor": 1.0,
     "warningMessage": null
   }
   ```
3. If the user is offline, the client falls back to local heuristic tables embedded in `LauncherPreferences.java`.
