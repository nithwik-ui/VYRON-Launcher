# VYRON Identity API Specification

All endpoints are namespaced under `/api/v1/auth` and `/api/v1`.

---

## 1. Authentication Endpoints

### 1.1 User Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Rate Limit:** 10 requests / minute per IP
- **Request Body:**
```json
{
  "username": "Nithwik",
  "email": "nithwik@example.com",
  "password": "SecurePassword2026!"
}
```
- **Validation Rules:**
  - `username`: 3-32 characters, regex `^[a-zA-Z0-9_-]+$`, reserved words (`admin`, `vyron`, `system`, etc.) rejected, case-insensitive uniqueness enforced.
  - `email`: RFC 5322 compliant, unique.
  - `password`: minimum 8 characters, maximum 128 characters.
- **Success Response (201 Created):**
```json
{
  "userId": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "username": "Nithwik",
  "email": "nithwik@example.com"
}
```

---

### 1.2 Verify Email (OTP or Token)
- **Endpoint:** `POST /api/v1/auth/verify-email`
- **Request Body:**
```json
{
  "email": "nithwik@example.com",
  "otp": "492817"
}
```
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### 1.3 Resend Verification OTP
- **Endpoint:** `POST /api/v1/auth/resend-otp`
- **Rate Limit:** 60-second cooldown per account
- **Request Body:**
```json
{
  "email": "nithwik@example.com"
}
```
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification code resent successfully"
}
```

---

### 1.4 User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
```json
{
  "identifier": "Nithwik",
  "password": "SecurePassword2026!",
  "deviceId": "android_98a7df01b4",
  "deviceModel": "vivo V2502",
  "manufacturer": "vivo",
  "androidVersion": 36,
  "appVersion": "1.1.7"
}
```
- **Success Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "7c9f8a6b2c...",
  "expiresIn": 900,
  "user": {
    "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
    "username": "Nithwik",
    "email": "nithwik@example.com",
    "avatarUrl": null,
    "isVerified": true
  }
}
```

---

### 1.5 Refresh Access Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Request Body:**
```json
{
  "refreshToken": "7c9f8a6b2c..."
}
```
- **Behavior:** Rotates refresh token, invalidates old token, checks replay attacks.
- **Success Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "9a1e4b3c8f...",
  "expiresIn": 900
}
```

---

### 1.6 User Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Request Body:**
```json
{
  "refreshToken": "9a1e4b3c8f..."
}
```
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.7 Logout All Sessions
- **Endpoint:** `POST /api/v1/auth/logout-all`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "message": "All sessions successfully revoked"
}
```

---

### 1.8 Password Reset Request
- **Endpoint:** `POST /api/v1/auth/forgot-password`
- **Request Body:**
```json
{
  "email": "nithwik@example.com"
}
```
- **Response (200 OK):** Account enumeration resistant message.

---

### 1.9 Complete Password Reset
- **Endpoint:** `POST /api/v1/auth/reset-password`
- **Request Body:**
```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePassword2026!"
}
```
- **Response (200 OK):** Password updated and all active sessions revoked.

---

## 2. Multiplayer Server Credential Endpoints

### 2.1 Issue Server Credential (Client -> Backend)
- **Endpoint:** `POST /api/v1/auth/server-credential`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "serverAddress": "play.vyroncraft.net:25565"
}
```
- **Success Response (200 OK):**
```json
{
  "serverCredential": "vsc_84f93a10bc39...",
  "expiresIn": 300,
  "serverAddress": "play.vyroncraft.net:25565"
}
```

---

### 2.2 Verify Server Credential (Server Plugin -> Backend)
- **Endpoint:** `POST /api/v1/auth/verify-server-credential`
- **Request Body:**
```json
{
  "serverAddress": "play.vyroncraft.net:25565",
  "serverCredential": "vsc_84f93a10bc39...",
  "username": "Nithwik"
}
```
- **Success Response (200 OK):**
```json
{
  "valid": true,
  "user": {
    "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
    "username": "Nithwik"
  }
}
```
- **Enforcement:** Single-use (immediate Redis deletion), 300-second strict TTL, scoped to server address.
