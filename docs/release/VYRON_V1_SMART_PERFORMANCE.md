# VYRON Launcher V1 — Smart Performance Engine Architecture

## 1. Executive Summary

The **VYRON Smart Performance Engine** is an intelligent, hardware-aware optimization subsystem built into the VYRON Launcher. It actively profiles device compute topology (CPU architecture, RAM capacity, SoC class, Android OS level) and Minecraft instance configurations (modloader, game version, installed optimization mods, Java runtime) to dynamically recommend and apply zero-risk performance profiles.

---

## 2. Architectural Pillars

```text
VYRON Smart Performance Engine
├── 1. Device Analyzer (VyronDeviceAnalyzer)
│   ├── RAM capacity & available headroom
│   ├── Core count & architecture (ARM64 vs ARM32 vs x86)
│   ├── SoC Model & Hardware Tier classification
│   └── Low-RAM device detection
│
├── 2. Instance Analyzer (VyronInstanceAnalyzer)
│   ├── Minecraft version categorization (1.21.x / 1.20.x / 1.16.x / legacy)
│   ├── Modloader detection (Vanilla, Fabric, Forge, NeoForge, Quilt)
│   ├── Optimization mods inspection (Sodium, Lithium, FerriteCore, ImmediatelyFast, etc.)
│   ├── Mod conflict resolution (OptiFine + Sodium conflicts)
│   └── Java runtime recommendation (Java 8 vs 17 vs 21)
│
├── 3. Performance Profiles (VyronPerformanceProfile)
│   ├── BATTERY_SAVER (Power-friendly, 70% scale, conservative memory)
│   ├── BALANCED (Optimal default, 85-100% scale, standard G1GC)
│   ├── PERFORMANCE (Demanding modpacks, high memory, aggressive G1GC)
│   ├── EXTREME (Flagship SoC, Snapdragon 8 Gen, 6GB+ RAM allocation)
│   └── CUSTOM (User-defined preferences)
│
├── 4. Safe Optimization & Rollback (VyronPerformanceOptimizer & Snapshot)
│   ├── Atomic pre-optimization preference snapshots
│   ├── One-tap rollback restoration
│   └── Zero-risk crash protection
│
└── 5. Offline-First Cache (VyronPerformanceCache)
    ├── Local JSON/SharedPrefs persistence
    └── 100% offline functionality without backend dependency
```

---

## 3. Hardware Tiers & Profile Mapping

| Hardware Tier | Memory Criterion | CPU & SoC | Recommended Profile |
| :--- | :--- | :--- | :--- |
| **FLAGSHIP** | $\ge 7.4\text{ GB RAM}$ | $\ge 8\text{ Cores, ARM64, Snapdragon 8 / Dimensity 9000}$ | **EXTREME / PERFORMANCE** |
| **HIGH** | $5.8\text{ GB} - 7.3\text{ GB RAM}$ | $\ge 8\text{ Cores, ARM64}$ | **PERFORMANCE** |
| **MID** | $3.8\text{ GB} - 5.7\text{ GB RAM}$ | $\ge 6\text{ Cores}$ | **BALANCED** |
| **ENTRY** | $2.5\text{ GB} - 3.7\text{ GB RAM}$ | $4 - 6\text{ Cores}$ | **BALANCED / BATTERY SAVER** |
| **LOW_END** | $< 2.5\text{ GB RAM}$ or 32-bit | Any | **BATTERY SAVER** |

---

## 4. Mod Optimization & Compatibility Rules

| Modloader | Minecraft Version | Key Optimization Suite | Conflict Rules |
| :--- | :--- | :--- | :--- |
| **Fabric / Quilt** | 1.20+ / 1.21+ | Sodium, Lithium, FerriteCore, ImmediatelyFast, Entity Culling | Flag conflict if **OptiFine** is present with Sodium. |
| **Forge** | 1.20+ | Embeddium, FerriteCore, ModernFix | Flag conflict if multiple contradictory shader loaders (e.g. Iris + Oculus). |
| **NeoForge** | 1.20.4+ / 1.21+ | Embeddium / Sodium, ImmediatelyFast, FerriteCore | Standard compatibility checks. |
| **Vanilla** | Any | Native JVM & Renderer tuning | Recommend installing Fabric + Sodium for up to $+150\%$ FPS. |

---

## 5. Rollback & Snapshot Safety Guarantee

Whenever an optimization profile is applied via **Auto-Tune** or the Profile Selector:
1. `LauncherPreferences.PREF_RAM_ALLOCATION`, `PREF_SCALE_FACTOR`, `PREF_CUSTOM_JAVA_ARGS`, `PREF_SUSTAINED_PERFORMANCE`, `PREF_BIG_CORE_AFFINITY`, and `PREF_FORCE_VSYNC` are saved into a timestamped `VyronPerformanceSnapshot`.
2. The snapshot is stored in private application storage.
3. If an anomaly occurs, the user can tap **ROLLBACK** in Settings to instantly restore their prior configuration without needing to remember previous values.
