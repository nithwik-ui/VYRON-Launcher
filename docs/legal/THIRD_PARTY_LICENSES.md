# VYRON Launcher — Third-Party Software Licenses & Legal Compliance Audit

**Document Version:** 1.0.0  
**Audit Status:** COMPLETE & VERIFIED  
**Governing License:** GNU General Public License v3.0 (GPL-3.0) / GNU Lesser General Public License v3.0 (LGPL-3.0)  
**Source Code Repository:** [https://github.com/nithwik-ui/VYRON-Launcher](https://github.com/nithwik-ui/VYRON-Launcher)  

---

## 1. Legal Overview & Architecture Compliance

VYRON Launcher is an open-source Android client that hosts a standard Java Virtual Machine (OpenJDK) to launch user-owned copies of Minecraft: Java Edition on mobile hardware. 

To maintain strict compliance with upstream licenses, open-source mandates, and platform policies:
1. **Upstream PojavLauncher Engine Preservation:** VYRON retains the core Android-to-JVM execution engine derived from PojavLauncher and Boardwalk under the GNU General Public License v3.0 (GPL-3.0). The native package namespace `net.kdt.pojavlaunch` is strictly preserved for JNI export symbols and dynamic linking.
2. **Zero Proprietary Jar Mirroring:** VYRON does **not** host, bundle, redistribute, or mirror any proprietary Mojang binaries, Minecraft client/server JARs, textures, sounds, or assets. All game binaries are retrieved dynamically and directly from official Mojang Content Delivery Networks (`https://piston-meta.mojang.com/` and `https://launcher.mojang.com/`) at the user's explicit request following authentication.
3. **Microsoft Authentication & Token Keystore Isolation:** Microsoft OAuth tokens and Mojang session keys are stored exclusively in the device's hardware-backed `AndroidKeyStore` (`VyronSecureCredentialStore`). They are never transmitted, proxied, or logged to the VYRON backend or any third-party server.
4. **Offline Playability Guarantee:** The launcher does not require an active internet connection or backend connection to execute local instances.

---

## 2. Core Engine & Native Runtime Components

### 2.1 PojavLauncher Core Engine
- **Upstream Authors:** artdeell, KhanhDUOC, and PojavLauncher contributors
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Role:** JVM orchestration, Android surface rendering, input translation, window management, and native bridge.
- **Compliance Action:** Full source code of all modifications is maintained in public repositories. License headers and copyright notices are preserved.

### 2.2 Boardwalk (JVM on Android)
- **Upstream Authors:** zhuowei
- **License:** GNU General Public License v3.0 (GPL-3.0)
- **Role:** Android JNI wrapper and native dynamic loader for desktop Java runtimes.
- **Compliance Action:** Included under terms of GPL-3.0; source code published.

### 2.3 OpenJDK Mobile Runtime
- **Upstream Authors:** OpenJDK Community / Oracle Corporation / Azul Systems
- **License:** GNU General Public License v2 with the Classpath Exception (GPLv2+CE)
- **Role:** Headless Java Virtual Machine (`libjvm.so`, `JLI_Launch`) executing Minecraft bytecode.
- **Compliance Action:** Java runtimes are downloaded as separate modular runtime components. The Classpath Exception explicitly permits running independent Java bytecode without subjecting the application to viral GPL terms.

### 2.4 MobileGlues (OpenGL translation layer)
- **Upstream Authors:** MobileGlues Team
- **License:** Apache License, Version 2.0
- **Role:** Bridges desktop OpenGL calls to Android mobile graphics drivers.
- **Compliance Action:** Attribution included in NOTICE; source modifications clearly marked.

### 2.5 ANGLE (Almost Native Graphics Layer Engine)
- **Upstream Authors:** The Chromium Authors / Google LLC
- **License:** BSD 3-Clause License
- **Role:** Translates OpenGL ES API calls to Vulkan hardware commands on Android.
- **License Text Summary:** Redistribution permitted provided copyright notice and disclaimer are retained.

### 2.6 Zink (Mesa 3D Graphics Library)
- **Upstream Authors:** Mesa contributors / Collabora / Red Hat
- **License:** MIT License
- **Role:** Pure OpenGL implementation over Vulkan.
- **License Text Summary:** Permissive license permitting redistribution with copyright notice.

### 2.7 LWJGL 3 (Lightweight Java Game Library)
- **Upstream Authors:** Lightweight Java Game Library Project
- **License:** BSD 3-Clause License
- **Role:** Native bindings for GLFW, OpenAL, OpenGL, and Vulkan used by Minecraft.
- **Compliance Action:** Binary distributions retain copyright and disclaimer.

### 2.8 SDL (Simple DirectMedia Layer)
- **Upstream Authors:** Sam Lantinga and SDL contributors
- **License:** zlib License
- **Role:** Low-level audio, joystick, and window abstraction.
- **Compliance Action:** Permissive; unaltered source/binary distributions permitted.

### 2.9 GL4ES
- **Upstream Authors:** ptitSeb
- **License:** MIT License
- **Role:** OpenGL 2.1/1.5 translation layer to GLES 2.0.
- **Compliance Action:** Permissive; attribution preserved.

---

## 3. Native JNI & Network Bypass Modules

| Module / Directory | License | Purpose | Compliance Verification |
| :--- | :--- | :--- | :--- |
| `androidnsbypass/` | GPL-3.0 | Android native socket and DNS resolution bypass for Termux/JVM compatibility | Source included in tree; compiled into `libandroidnsbypass.so` |
| `arc_dns_injector/` | GPL-3.0 | ChromeOS / ARC DNS injector library | Source included in tree; GPL-3.0 retained |
| `MioLibPatcher/` | Apache-2.0 | Dynamic ELF library patcher for JNI compatibility | Permissive redistribution with license notice |

---

## 4. Android Client Libraries & UI Frameworks

| Library | License | Copyright Holder / Author | Usage |
| :--- | :--- | :--- | :--- |
| **AndroidX Core & Jetpack** | Apache-2.0 | Google LLC / Android Open Source Project | Modern Android lifecycle, fragments, views |
| **Material Components for Android** | Apache-2.0 | Google LLC | VYRON dark glassmorphic UI components |
| **Google Gson** | Apache-2.0 | Google LLC | JSON serialization for launcher profiles |
| **OkHttp / Retrofit** | Apache-2.0 | Square, Inc. | Network client and Mojang CDN retrieval |
| **Commons IO / Compress** | Apache-2.0 | Apache Software Foundation | Zip archive extraction and resource management |

---

## 5. Backend Monolith & Infrastructure Dependencies

| Library / Tool | License | Purpose |
| :--- | :--- | :--- |
| **Fastify** | MIT | High-performance asynchronous HTTP backend |
| **Prisma ORM** | Apache-2.0 | Type-safe database client and schema migration |
| **PostgreSQL (Supabase)** | PostgreSQL License | Primary relational database |
| **ioredis** | MIT | In-memory cache and ephemeral state |
| **Argon2id (`@node-rs/argon2`)** | MIT | Password hashing with constant-time verification |
| **Zod** | MIT | Strict schema and input validation |
| **OTPAuth** | MIT | RFC 6238 TOTP two-factor authentication |
| **Jose / JSON Web Token** | MIT | HMAC-SHA256 bearer token signing |
| **Vitest** | MIT | Test runner and assertion library |

---

## 6. Mojang & Microsoft Trademark & Brand Guidelines Adherence

VYRON Launcher complies with the **Minecraft Commercial Usage Guidelines** and **Brand Guidelines**:

1. **Mandatory Disclaimer:**  
   The application UI, documentation, and app store listings display the following prominent notice:
   > **"NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT."**
2. **Trademark Separation:**
   - The app is titled **"VYRON Launcher"**, **not** "Minecraft Launcher" or "PojavLauncher Pro".
   - The Minecraft trademark is referenced solely for factual descriptive compatibility ("Play Minecraft: Java Edition on Android").
3. **No Commercial Asset Redistribution:**
   - No Minecraft textures, sounds, models, or code are shipped inside the APK.
   - The client verifies valid game licenses via Microsoft OAuth before downloading official assets from Mojang's servers.
4. **No Monetization of Core Gameplay:**
   - The launcher is 100% free and open-source.
   - No paywalls, no subscriptions to unlock game versions, and no pay-to-launch mechanics.

---

## 7. Open Source Distribution Obligations (GPL-3.0)

As a derived work of PojavLauncher under GPL-3.0:
1. **Source Code Availability:** The complete corresponding source code is made publicly available at:  
   [https://github.com/nithwik-ui/VYRON-Launcher](https://github.com/nithwik-ui/VYRON-Launcher)
2. **Written Offer for Source:** Any party receiving a binary distribution (APK / AAB) is entitled to receive the corresponding source code upon request or via the public repository.
3. **Preservation of Notices:** All source files retain existing copyright and license headers. The root `LICENSE` file contains the full GNU Lesser General Public License text.

---

## 8. Summary Audit Conclusion

The VYRON Launcher codebase and runtime dependencies have been thoroughly audited for open-source licensing, intellectual property rights, and commercial guideline compliance. All third-party libraries are utilized in accordance with their respective licenses, and all obligations (attributions, disclaimers, and source disclosure) are satisfied in full.
