# VYRON Operational & Performance Telemetry Model
**Document ID:** `docs/backend/TELEMETRY.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM SPECIFICATION (DESIGN ONLY — DO NOT IMPLEMENT)  
**Scope:** Privacy-Preserving Observability, Crash Diagnostics, and Device Benchmarks  

---

## 1. Privacy Safeguards & Non-PII Invariant

> [!IMPORTANT]
> **Strict Non-PII Commitment:**  
> VYRON telemetry collects ONLY operational and hardware performance metrics necessary to diagnose engine stability, crash frequency, and frame rate optimization. It NEVER collects usernames, email addresses, chat messages, world contents, IP addresses, or device serial numbers. All telemetry is 100% opt-outable via Launcher Settings.

---

## 2. Event Taxonomy & Schema Definitions

### 2.1 Launcher Lifecycle Events

#### `launcher_start`
Triggered when the Android application process starts (`LauncherActivity.onCreate`).
```json
{
  "event": "launcher_start",
  "timestamp": 1774267200000,
  "properties": {
    "appVersion": "3.0.0",
    "androidSdk": 35,
    "deviceModel": "SM-S928B",
    "cpuArch": "arm64-v8a",
    "totalRamMb": 11440
  }
}
```

#### `launcher_ready`
Triggered when the VYRON Navigation Shell and Home screen finish rendering.
```json
{
  "event": "launcher_ready",
  "timestamp": 1774267201200,
  "properties": {
    "startupDurationMs": 1200,
    "theme": "DARK_FOREST",
    "isTabletLayout": false
  }
}
```

---

### 2.2 Minecraft Launch Pipeline Events

#### `minecraft_launch_start`
Triggered when the user taps "PLAY GAME" and the launch task initializes.
```json
{
  "event": "minecraft_launch_start",
  "timestamp": 1774267210000,
  "properties": {
    "minecraftVersion": "1.21.4",
    "loader": "Fabric",
    "renderer": "ANGLE",
    "allocatedRamMb": 2048,
    "javaMajorVersion": 21
  }
}
```

#### `minecraft_launch_success`
Triggered when the Minecraft window surfaces and the GLFW event loop receives its first frame.
```json
{
  "event": "minecraft_launch_success",
  "timestamp": 1774267216500,
  "properties": {
    "timeToFirstFrameMs": 6500,
    "minecraftVersion": "1.21.4",
    "renderer": "ANGLE"
  }
}
```

#### `minecraft_launch_failure`
Triggered if JRE unpacking fails, libraries fail verification, or the native launcher exits unexpectedly.
```json
{
  "event": "minecraft_launch_failure",
  "timestamp": 1774267212000,
  "properties": {
    "failureStage": "VERIFY_LIBRARIES", // 'DOWNLOAD', 'UNPACK_JRE', 'NATIVE_LAUNCH'
    "errorCode": "ERR_LIB_HASH_MISMATCH",
    "errorMessage": "SHA-1 mismatch on netty-all-4.1.97.Final.jar",
    "minecraftVersion": "1.21.4"
  }
}
```

---

### 2.3 Download Pipeline Events

#### `download_start` / `download_complete`
Tracks network performance across asset/library downloads to detect CDN bottlenecks or regional ISP throttling.
```json
{
  "event": "download_complete",
  "timestamp": 1774267230000,
  "properties": {
    "downloadType": "ASSETS", // 'CLIENT_JAR', 'ASSETS', 'LIBRARIES', 'RUNTIME'
    "totalBytes": 142857140,
    "durationMs": 14500,
    "averageThroughputMbps": 78.8,
    "sourceMirror": "default"
  }
}
```

---

### 2.4 Gameplay Performance & Engine Diagnostics (Session Summary)

#### `game_session_summary`
Dispatched upon game exit, providing an aggregated summary of the session:
```json
{
  "event": "game_session_summary",
  "timestamp": 1774270800000,
  "properties": {
    "sessionDurationSeconds": 3600,
    "minecraftVersion": "1.21.4",
    "loader": "Fabric",
    "renderer": "Zink",
    "javaVersion": 21,
    "fpsAverage": 62.4,
    "fps1PercentLow": 38.1,
    "frameTimeAvgMs": 16.02,
    "resolutionScale": 1.0,
    "peakMemoryUsageMb": 1850,
    "deviceClass": "HIGH_END"
  }
}
```

#### `crash_report`
Dispatched when the `:game` process terminates with an exit code != 0 or writes to `.minecraft/crash-reports/`:
```json
{
  "event": "crash_report",
  "timestamp": 1774271000000,
  "properties": {
    "minecraftVersion": "1.21.4",
    "loader": "Fabric",
    "renderer": "Zink",
    "deviceSoc": "Snapdragon 8 Gen 2",
    "exitCode": 139, // SIGSEGV
    "sanitizedStackTrace": "java.lang.NullPointerException: Cannot invoke ...\n\tat net.minecraft.client.renderer.GameRenderer..."
  }
}
```

---

## 3. Client Batching & Transmission Architecture

To eliminate battery drain and reduce cellular data usage:
1. **Local SQLite / Memory Queue:** Events are buffered in memory up to 20 events or until a session ends.
2. **Wi-Fi Preference:** Telemetry batches are sent during idle network states or over unmetered Wi-Fi.
3. **Payload Compression:** Requests use gzip / zstd compression.
4. **Endpoint:** `POST /api/v1/telemetry/events` (returns HTTP `202 Accepted`).
