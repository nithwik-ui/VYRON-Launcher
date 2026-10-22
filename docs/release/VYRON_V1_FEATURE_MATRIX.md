# VYRON Launcher V1 — Feature Matrix

## Status: COMPLETE

| Component | Sub-Feature | Implementation Status | Verification Details |
| :--- | :--- | :--- | :--- |
| **VYRON Identity** | Unique Username Registration | **COMPLETE** | Argon2id password hash, reserved names blocked, case-insensitive uniqueness. |
| **VYRON Identity** | Email OTP Verification | **COMPLETE** | 6-digit numeric OTP, Redis 15-min TTL, rate-limiting, 60s cooldown, brute-force lockout. |
| **VYRON Identity** | Login & Persistence | **COMPLETE** | JWT access token, rolling refresh token, hardware `AndroidKeyStore` AES-256 GCM storage. |
| **VYRON Identity** | Account Center UI | **COMPLETE** | Profile card, verification badge, avatar initials, sign out, switch accounts. |
| **VYRON Identity** | Multiplayer Server Auth | **COMPLETE** | Short-lived single-use server ticket generation & backend verification API. |
| **Account Decoupling** | Microsoft Identity Isolation | **COMPLETE** | Microsoft credentials remain strictly device-local. Never transmitted to VYRON backend. |
| **Account Decoupling** | Local/Offline Profiles | **COMPLETE** | Unrestricted offline gameplay. Removed legacy demo lockouts and online profile dependencies. |
| **Account Decoupling** | Demo Mode Resolution | **COMPLETE** | Root-caused `--demo` argument from unowned MS profiles and decoupled local profiles. |
| **Performance Engine** | Device Analysis | **COMPLETE** | Analyzes RAM, CPU cores, ARM64 architecture, SoC model, and assigns hardware tiers. |
| **Performance Engine** | Instance Analysis | **COMPLETE** | Scans mods directory, checks modloader, detects missing optimizations & conflicts. |
| **Performance Engine** | Performance Profiles | **COMPLETE** | BATTERY SAVER, BALANCED, PERFORMANCE, EXTREME, and CUSTOM. |
| **Performance Engine** | Safe Optimization & Rollback | **COMPLETE** | Automatic pre-tuning snapshots and one-tap zero-risk configuration rollback. |
| **Performance Engine** | Offline Caching | **COMPLETE** | SharedPreferences & local cache ensure full offline performance tuning. |
| **UI & UX** | Compact Spacing System | **COMPLETE** | Refactored padding, chip heights, card radii, responsive across all mobile viewports. |
| **Network & Security** | Cleartext & Cloud Config | **COMPLETE** | `network_security_config.xml`, `android:usesCleartextTraffic`, configurable backend URL dialog. |
