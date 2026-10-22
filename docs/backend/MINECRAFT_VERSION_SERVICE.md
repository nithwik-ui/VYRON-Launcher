# VYRON Minecraft Version Discovery & Metadata Ingestion Service
**Document ID:** `docs/backend/MINECRAFT_VERSION_SERVICE.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — SYSTEM ARCHITECTURE SPECIFICATION  
**Scope:** Automated Version Polling, Manifest Ingestion, and Compatibility Pipeline  

---

## 1. Verified Upstream Origins (Code-Audited)

The VYRON backend relies exclusively on verified, legitimate upstream APIs and CDNs documented across the existing launcher codebase:

| Resource Type | Verified Upstream Endpoint / API | Codebase Source Verification |
|---|---|---|
| **Official Version Manifest v2** | `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json` | `LauncherPreferences.PREF_VERSION_REPOS` |
| **Official Assets Repository** | `https://resources.download.minecraft.net/` | `MinecraftDownloader.MINECRAFT_RES` |
| **Official Libraries CDN** | `https://libraries.minecraft.net/` | `MinecraftDownloader.java:386` |
| **Maven Central Dependencies** | `https://repo1.maven.org/maven2/` | `MinecraftDownloader.MAVEN_CENTRAL_REPO1` |
| **Fabric Meta API** | `https://meta.fabricmc.net/v2` | `FabriclikeUtils.FABRIC_UTILS` |
| **Quilt Meta API** | `https://meta.quiltmc.org/v3` | `FabriclikeUtils.QUILT_UTILS` |
| **Forge Maven Metadata** | `https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml` | `ForgeUtils.FORGE_METADATA_URL` |
| **NeoForge Maven Releases** | `https://maven.neoforged.net/releases/net/neoforged/neoforge/` | `NeoForgeDownloadTask.NEOFORGE_INSTALLER_URL` |
| **Custom OpenJDK Builds** | `https://github.com/AngelAuraMC/angelauramc-openjdk-build/releases/` | `NewJREUtil.getJreSource()` |

---

## 2. Ingestion & Indexing Pipeline Architecture

The backend operates an automated polling and normalization daemon:

```text
       [ Mojang Piston Manifest v2 ]
                     │ (Poll every 15 mins with ETag)
                     ▼
        [ 1. Version Discovered ]
                     │ (Detect new release / snapshot ID)
                     ▼
        [ 2. Metadata Validated ]
                     │ (Fetch version JSON, verify SHA-1, parse Java & libs)
                     ▼
        [ 3. Compatibility Evaluated ]
                     │ (Map Java requirements: JRE 8 / 17 / 21 / 25)
                     ▼
        [ 4. Version Indexed ]
                     │ (Upsert into minecraft_versions & metadata)
                     ▼
        [ 5. Release Review (Optional) ]
                     │ (Auto-publish releases; flag experimental snapshots)
                     ▼
        [ 6. Published to VYRON Client ]
                     │ (Served via GET /api/v1/minecraft/versions)
```

### 2.1 Step 1: Manifest Polling & Discovery
- A background worker queries `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json` every 15 minutes.
- Uses HTTP `If-None-Match` header to avoid redundant processing when Mojang has not updated the manifest.
- Compares version IDs against existing entries in table `minecraft_versions`.

### 2.2 Step 2: Metadata Extraction & Normalization
Upon discovering a new version ID (e.g. `1.21.4`):
1. Downloads the version-specific JSON manifest from `version.url`.
2. Validates SHA-1 hash matching `version.sha1`.
3. Normalizes runtime prerequisites:
   - **Java Major Version:** Extracted from `javaVersion.majorVersion` (e.g. `21`).
   - **Main Class:** Extracted from `mainClass` (e.g. `net.minecraft.client.main.Main`).
   - **Asset Index:** Extracted from `assetIndex.id` (e.g. `17`).
   - **Native Library Rules:** Scans `libraries` for OS and architecture requirements (specifically Android/Linux ARM64 rules).

### 2.3 Step 3: Compatibility Auto-Evaluation
The ingestion service checks whether the required Java version is currently supported by VYRON's runtime pool:
- JRE 8: Legacy versions (<= 1.16.5)
- JRE 17: Versions 1.17 to 1.20.4
- JRE 21: Versions 1.20.5 to current (1.21.x)
- JRE 25: Future Java early-access builds

If the version requires a Java runtime not yet certified in `java_runtimes`, its compatibility status is automatically tagged as `EXPERIMENTAL` or `BLOCKED`.

### 2.4 Step 4: Storage & Caching
- Stored into PostgreSQL tables `minecraft_versions` and `minecraft_version_metadata`.
- Version list cached in Redis (`cache:minecraft:versions`) with a 1-hour TTL.
- Invalidates client ETag to notify Android clients that a new release or snapshot is available.

---

## 3. What the Backend Stores vs. What Remains on Mojang

| Artifact | Stored on VYRON Backend? | Upstream Authoritative Source |
|---|:---:|---|
| Version IDs, types, release timestamps | **YES (PostgreSQL)** | Mojang Piston Manifest |
| Minimum Java version requirements | **YES (PostgreSQL)** | Mojang Version Manifest |
| Normalized library dependency list | **YES (PostgreSQL JSONB)**| Mojang Version Manifest |
| Compatibility recommendations & notes | **YES (PostgreSQL)** | VYRON Engineering / Community |
| Client Game JAR (`client.jar`) | **NO** | `piston-data.mojang.com` |
| Asset Index Files & Audio/Texture Blobs | **NO** | `resources.download.minecraft.net` |
| Native OpenJDK Binary Tarballs | **NO** | AngelAuraMC GitHub Releases |
