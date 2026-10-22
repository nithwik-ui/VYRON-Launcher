# VYRON Authentication Architecture & Security Audit
**Document ID:** `docs/backend/AUTH_AUDIT.md`  
**Phase:** Phase 3A (Backend Architecture & Service Contract Audit)  
**Status:** COMPLETED — STRICTLY FACTUAL REPOSITORY AUDIT  
**Target Codebase:** `nithwik-ui/VYRON-Launcher` (branch: `v3_openjdk`)  

---

## 1. Executive Summary

This audit provides an exhaustive, code-verified technical breakdown of the account, identity, and authentication mechanisms existing inside the VYRON Minecraft Java Android Launcher. 

Prior to Phase 3, the launcher inherited the account handling from PojavLauncher/Amethyst lineage. All findings documented herein were extracted directly from the Java source files in package `net.kdt.pojavlaunch` and `com.kdt.mcgui`.

### Critical Security Finding
> [!CAUTION]
> **Zero Encryption at Rest**: Authentication tokens, including Microsoft OAuth refresh tokens and Minecraft services access tokens, are currently written in **plaintext JSON** directly to the application's internal storage (`/data/user/0/com.vyron.launcher/accounts/<username>.json`). They are neither encrypted with Android Keystore nor protected by `EncryptedSharedPreferences`. Any rooted device, adb backup exploit, or vulnerability with storage read access would expose valid credentials.

---

## 2. Account Types & Local / Offline Handling

The existing launcher recognizes three operational account states:
1. **Microsoft Online Account** (`isMicrosoft = true`, valid access & refresh tokens)
2. **Local / Offline Account** (`isMicrosoft = false`, `accessToken = "0"`, non-demo username)
3. **Demo Account** (`isMicrosoft = false` or `doesOwnGame = false`, username prefix `Demo.`)

### 2.1 Local / Offline Flow Implementation
- **UI Trigger:** `net.kdt.pojavlaunch.fragments.LocalLoginFragment`
- **Validation Rule:** Regex `^[a-zA-Z0-9_]*$`, character length between 3 and 16, and filename collision check:
  ```java
  // LocalLoginFragment.java (Lines 61-67)
  Matcher matcher = mUsernameValidationPattern.matcher(text);
  return !(text.isEmpty()
          || text.length() < 3
          || text.length() > 16
          || !matcher.find()
          || new File(Tools.DIR_ACCOUNT_NEW + "/" + text + ".json").exists()
  );
  ```
- **Creation Mechanism:** When the user enters a username and clicks login, the fragment posts to `ExtraCore`:
  ```java
  ExtraCore.setValue(ExtraConstants.MOJANG_LOGIN_TODO, new String[]{ username, "" });
  ```
- **Storage Instantiation:** `com.kdt.mcgui.mcAccountSpinner` intercepts `MOJANG_LOGIN_TODO`:
  ```java
  private final ExtraListener<String[]> mMojangLoginListener = (key, value) -> {
      if(value[1].isEmpty()){ // Local mode
          MinecraftAccount account = new MinecraftAccount();
          account.username = value[0];
          try {
              account.save();
          } catch (IOException e){
              Log.e("McAccountSpinner", "Failed to save the account : " + e);
          }
          mDoneListener.onLoginDone(account);
      }
      return false;
  };
  ```
- **Offline Representation in `MinecraftAccount`:**
  - `accessToken = "0"`
  - `clientToken = "0"`
  - `profileId = "00000000-0000-0000-0000-000000000000"` (nil UUID)
  - `isMicrosoft = false`
  - `msaRefreshToken = "0"`
  - `isLocal()` evaluation:
    ```java
    public boolean isLocal(){
        return accessToken.equals("0") && !username.startsWith("Demo.");
    }
    ```

---

## 3. Account Data Structure & Serialization (`MinecraftAccount.java`)

All account records are represented by `net.kdt.pojavlaunch.value.MinecraftAccount`.

### 3.1 Field Matrix

| Field | Type | Default Value | Purpose | Sensitive? |
|---|---|---|---|---|
| `accessToken` | `String` | `"0"` | Minecraft Services Bearer Token | **YES (Critical)** |
| `clientToken` | `String` | `"0"` | Client identifier for token revocation | Low |
| `profileId` | `String` | `"00000000-0000-0000-0000-000000000000"` | Player UUID (standard 8-4-4-4-12) | Public |
| `username` | `String` | `"Steve"` | In-game player display name | Public |
| `selectedVersion`| `String` | `"1.7.10"` | Last version associated with account | Low |
| `isMicrosoft` | `boolean` | `false` | True if authenticated via Microsoft OAuth | Low |
| `msaRefreshToken`| `String` | `"0"` | Microsoft OAuth Refresh Token | **YES (Critical)** |
| `xuid` | `String` | `null` | Xbox User ID | Medium |
| `expiresAt` | `long` | `0` | Epoch timestamp (ms) when `accessToken` expires | Low |
| `skinFaceBase64` | `String` | `null` | Legacy base64 head texture | Low |
| `mFaceCache` | `Bitmap` | `null` | In-memory cached decoded avatar | None |

### 3.2 Storage Path & Serialization
- **Base Directory:** `Tools.DIR_ACCOUNT_NEW` initialized in `Tools.initEarlyConstants(Context ctx)`:
  ```java
  DIR_DATA = ctx.getFilesDir().getParent(); // /data/user/0/com.vyron.launcher
  DIR_ACCOUNT_NEW = DIR_DATA + "/accounts";  // /data/user/0/com.vyron.launcher/accounts
  ```
- **File Format:** Plain JSON named `<username>.json`:
  ```java
  public String save(String outPath) throws IOException {
      Tools.write(outPath, Tools.GLOBAL_GSON.toJson(this));
      return username;
  }
  public String save() throws IOException {
      return save(Tools.DIR_ACCOUNT_NEW + "/" + username + ".json");
  }
  ```
- **Parsing:** Deserialized via Google GSON (`Tools.GLOBAL_GSON.fromJson(content, MinecraftAccount.class)`).

---

## 4. Microsoft OAuth & Mojang Services Pipeline

Microsoft Authentication is handled across two classes:
- `net.kdt.pojavlaunch.fragments.MicrosoftLoginFragment`: Interception of OAuth web flow.
- `net.kdt.pojavlaunch.authenticator.microsoft.MicrosoftBackgroundLogin`: 5-step background token exchange.

### 4.1 Step 1: Authorization Code Acquisition
- **UI Mechanism:** `MicrosoftLoginFragment` loads an embedded Android `WebView`.
- **Authorization URL:**
  ```text
  https://login.live.com/oauth20_authorize.srf
    ?client_id=00000000402b5328
    &response_type=code
    &scope=service%3A%3Auser.auth.xboxlive.com%3A%3AMBI_SSL
    &redirect_url=https%3A%2F%2Flogin.live.com%2Foauth20_desktop.srf
  ```
- **Public Client ID:** `00000000402b5328` (Mojang standard public client ID for desktop/mobile launchers).
- **Callback Interception:** `WebViewTrackClient.shouldOverrideUrlLoading` intercepts custom redirect:
  ```java
  if(url.startsWith("ms-xal-00000000402b5328")) {
      ExtraCore.setValue(ExtraConstants.MICROSOFT_LOGIN_TODO, Uri.parse(url));
      Toast.makeText(view.getContext(), "Login started !", Toast.LENGTH_SHORT).show();
      Tools.backToMainMenu(requireActivity());
      return true;
  }
  ```

### 4.2 Step 2: Live OAuth Token Exchange
- **Endpoint:** `https://login.live.com/oauth20_token.srf` (`authTokenUrl`)
- **Method:** `POST` (`application/x-www-form-urlencoded`)
- **Payload:**
  - Initial Login: `client_id=00000000402b5328&code=<auth_code>&grant_type=authorization_code&redirect_url=https://login.live.com/oauth20_desktop.srf&scope=service::user.auth.xboxlive.com::MBI_SSL`
  - Token Refresh: `client_id=00000000402b5328&refresh_token=<msaRefreshToken>&grant_type=refresh_token&redirect_url=https://login.live.com/oauth20_desktop.srf&scope=service::user.auth.xboxlive.com::MBI_SSL`
- **Output Extracted:**
  - `access_token`: Live OAuth Access Token (RPS Ticket).
  - `refresh_token`: Stored into `msRefreshToken` (and later persisted to `acc.msaRefreshToken`).

### 4.3 Step 3: Xbox Live (XBL) Authentication
- **Endpoint:** `https://user.auth.xboxlive.com/user/authenticate` (`xblAuthUrl`)
- **Method:** `POST` (`application/json`)
- **Payload:**
  ```json
  {
    "Properties": {
      "AuthMethod": "RPS",
      "SiteName": "user.auth.xboxlive.com",
      "RpsTicket": "<live_access_token>"
    },
    "RelyingParty": "http://auth.xboxlive.com",
    "TokenType": "JWT"
  }
  ```
- **Output Extracted:** `Token` (XBL Token).

### 4.4 Step 4: XSTS Authorization
- **Endpoint:** `https://xsts.auth.xboxlive.com/xsts/authorize` (`xstsAuthUrl`)
- **Method:** `POST` (`application/json`)
- **Payload:**
  ```json
  {
    "Properties": {
      "SandboxId": "RETAIL",
      "UserTokens": ["<xbl_token>"]
    },
    "RelyingParty": "rp://api.minecraftservices.com/",
    "TokenType": "JWT"
  }
  ```
- **Output Extracted:**
  - `Token`: XSTS authorization token.
  - `DisplayClaims.xui[0].uhs`: User Hash (`uhs`), stored as `xuid`.
- **Known Error Code Mapping (`XSTS_ERRORS`):**
  - `2148916233L`: No Xbox account found.
  - `2148916235L`: Xbox Live not available in region.
  - `2148916236L` / `2148916237L`: Adult verification required.
  - `2148916238L`: Child account requires parental consent.

### 4.5 Step 5: Minecraft Services Authentication
- **Endpoint:** `https://api.minecraftservices.com/authentication/login_with_xbox` (`mcLoginUrl`)
- **Method:** `POST` (`application/json`)
- **Payload:**
  ```json
  {
    "identityToken": "XBL3.0 x=<uhs>;<xsts_token>"
  }
  ```
- **Output Extracted:**
  - `access_token`: Minecraft Services Bearer Token (JWT).
  - Expiry Calculation: `expiresAt = System.currentTimeMillis() + 86400000;` (hardcoded 24-hour expiration window).

### 4.6 Step 6: Profile & Game Ownership Check
- **Profile Check Endpoint:** `https://api.minecraftservices.com/minecraft/profile` (`mcProfileUrl`)
  - Header: `Authorization: Bearer <mcToken>`
  - Response: `{ "id": "4566e69f...", "name": "PlayerName" }`
  - UUID Formatting: Mojang returns unhyphenated 32-character hex; formatted via regex:
    ```java
    String uuidDashes = uuid.replaceFirst(
        "(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)", "$1-$2-$3-$4-$5"
    );
    ```
- **Ownership Verification Endpoint:** `https://api.minecraftservices.com/entitlements/mcstore` (`mcStoreUrl`)
  - Evaluated if the profile endpoint returns 404.
  - Verifies cryptographically signed entitlements payload (JWT body decoding):
    - `product_minecraft`
    - `game_minecraft`
    - `product_minecraft_bedrock`
    - `game_minecraft_bedrock`
  - **Demo Fallback:** If entitlements are missing or profile not set:
    ```java
    mcName = "Demo.Player";
    mcUuid = "00000000-0000-0000-0000-000000000000";
    ```

---

## 5. Token Refresh & Lifecycle

- **Trigger:** Checked inside UI component `com.kdt.mcgui.mcAccountSpinner.performLogin(MinecraftAccount)`:
  ```java
  if(minecraftAccount.isMicrosoft){
      if(System.currentTimeMillis() > minecraftAccount.expiresAt){
          new MicrosoftBackgroundLogin(true, minecraftAccount.msaRefreshToken)
                  .performLogin(mProgressListener, mDoneListener, mErrorListener);
      }
      return;
  }
  ```
- **Refresh Flow:**
  - Passes `isRefresh = true` with `msaRefreshToken`.
  - Sends `grant_type=refresh_token` to `https://login.live.com/oauth20_token.srf`.
  - Re-executes the complete sequence (XBL -> XSTS -> Minecraft Services -> Profile).
  - Updates `msRefreshToken`, `mcToken`, `expiresAt`, and persists via `acc.save()`.

---

## 6. Multi-Account Handling & Active Selection

- **Account Listing:** `net.kdt.pojavlaunch.PojavProfile.getAllProfilesList()` iterates all files ending in `.json` inside `Tools.DIR_ACCOUNT_NEW`:
  ```java
  public static List<String> getAllProfilesList(){
      List<String> accountList = new ArrayList<>();
      File accountFolder = new File(Tools.DIR_ACCOUNT_NEW);
      if(accountFolder.exists() && accountFolder.list() != null){
          for (String fileName : Objects.requireNonNull(accountFolder.list())) {
              accountList.add(fileName.substring(0, fileName.length() - 5));
          }
      }
      return accountList;
  }
  ```
- **Active Account Pointer:** Stored in Android `SharedPreferences`:
  - Pref File: `"pojav_profile"` (`/data/user/0/com.vyron.launcher/shared_prefs/pojav_profile.xml`)
  - Key: `"file"`
  - Value: Active username string (e.g. `"Steve"`).
- **Account Switching:**
  - `PojavProfile.setCurrentProfile(Context ctx, Object obj)` commits the selected username to `pojav_profile.xml`.
- **Account Removal / Logout:**
  - `mcAccountSpinner.removeAccount(int position)`:
    ```java
    File accountFile = new File(Tools.DIR_ACCOUNT_NEW, mAccountList.get(position)+".json");
    if(accountFile.exists()) accountFile.delete();
    mAccountList.remove(position);
    reloadAccounts(false, 0);
    ```
  - **Security Gap:** Deleting an account only deletes the local JSON file. It **never** makes an HTTP request to revoke the OAuth refresh token or invalidate the Minecraft session on Microsoft's identity servers.

---

## 7. Architecture Violations & Architectural Risks

1. **Direct Network Requests from UI Views:**
   - `mcAccountSpinner.java` (an Android UI widget extending `Spinner`) directly constructs and executes `MicrosoftBackgroundLogin` network tasks.
   - `MinecraftAccount.java` directly initiates HTTP downloads inside `updateSkinFace` via `Tools.downloadFile("https://mc-heads.net/head/...")`.
2. **Missing Token Cryptography:**
   - Refresh tokens and access tokens are saved in cleartext. If an attacker gains access to the app's private files (e.g. through backup or root privileges), they can impersonate the Minecraft account indefinitely.
3. **Hardcoded Public Client ID:**
   - Microsoft client ID `00000000402b5328` is hardcoded across `MicrosoftLoginFragment.java` and `MicrosoftBackgroundLogin.java`.
4. **No Centralized Authentication Repository:**
   - Account state logic is scattered between `PojavProfile.java`, `mcAccountSpinner.java`, `MinecraftAccount.java`, and `LauncherActivity.java`.

---

## 8. Summary Audit Checklist

| Audit Question | Verified Result | Code Evidence |
|---|---|---|
| **Local accounts supported?** | YES | `LocalLoginFragment.java`, `MinecraftAccount.isLocal()` |
| **Where are accounts stored?** | `/data/user/0/com.vyron.launcher/accounts/<username>.json` | `Tools.DIR_ACCOUNT_NEW`, `MinecraftAccount.save()` |
| **Active account persisted in SharedPreferences?** | YES | `PojavProfile.java` (`pojav_profile.xml`, key `"file"`) |
| **Tokens encrypted at rest?** | **NO (Plaintext JSON)** | `MinecraftAccount.save()`, `Tools.GLOBAL_GSON.toJson()` |
| **Microsoft token refresh supported?** | YES | `mcAccountSpinner.performLogin()`, `MicrosoftBackgroundLogin(true)` |
| **OAuth token lifetime tracked?** | YES (Hardcoded +24 hours) | `MicrosoftBackgroundLogin.java:255` |
| **Server-side token revocation on logout?** | **NO (Local file deletion only)** | `mcAccountSpinner.removeAccount()` |
| **Network calls directly in UI?** | **YES (Architectural violation)** | `mcAccountSpinner.java:129`, `MinecraftAccount.java:38` |
| **Multi-account supported?** | YES | `PojavProfile.getAllProfilesList()` |
