# VYRON Phase 3B Entry Criteria & Readiness Checklist

**Document ID:** `docs/backend/PHASE_3B_ENTRY_CRITERIA.md`  
**Phase Transition:** Phase 3A.1 -> Phase 3B (Android Authentication Architecture & Local Security)  
**Status:** APPROVED & SATISFIED  

---

## 1. Readiness Invariant Verification

Before proceeding into Phase 3B implementation and verification, all prerequisites have been cross-checked:

- [x] **Subsystem Boundaries Sealed:** Phase 1 defined `docs/architecture/ENGINE_BOUNDARY.md` preserving `net.kdt.pojavlaunch` package namespace, JNI bindings, and OpenJDK `:game` architecture.
- [x] **UI & Navigation System Active:** Phase 2 delivered the responsive 5-tab navigation shell and VYRON design system, compiling cleanly to debug APK.
- [x] **Backend Architecture Defined:** Phase 3A established domain models, API specifications, and database schema in `docs/backend/`.
- [x] **Cross-Document Audit Complete:** Phase 3A.1 resolved all discrepancies in `PHASE_3A1_CROSS_DOCUMENT_AUDIT.md`, `CONTRACT_GAP_MATRIX.md`, `AUTH_DECISIONS.md`, and `OFFLINE_FIRST_CONTRACT.md`.
- [x] **Dual Identity Explicitly Decoupled:** Microsoft credentials remain strictly isolated from VYRON backend scope.
- [x] **Storage Sovereignty Confirmed:** `launcher_profiles.json` and `.minecraft` filesystem state remain locally authoritative.

---

## 2. Phase 3B Target Objectives

1. Replace legacy plaintext credential storage (`accounts/*.json`) with hardware-backed `AndroidKeyStore` AES-256-GCM authenticated encryption.
2. Ensure fail-closed security policy on modern Android (API 23+).
3. Implement non-destructive, idempotent migration for existing user accounts.
4. Eliminate secret leakage across Logcat, exceptions, and analytics.
5. Move all network and authentication calls off the Android UI thread.

---

## 3. Sign-off Determination
All Phase 3A and 3A.1 requirements are satisfied. The project is cleared for Phase 3B.
