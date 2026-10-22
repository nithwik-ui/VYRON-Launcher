# VYRON Design System Specification

**Version:** 1.0 (Phase 2)  
**Product:** VYRON — *Your Minecraft. Your World.*  
**Implementation:** Android View System / XML Themes / Styles / Custom Drawables  

---

## 1. Visual Philosophy & Design Identity

The VYRON design language blends the **tactile, blocky nature of Minecraft** with a **clean, modern Android product aesthetic**. It avoids cyberpunk aesthetics, neon glow, excessive gradients, glassmorphism, or generic SaaS dashboard styling.

- **Earthy & Adventurous:** Rich forest greens, warm clouds, stone grays, and oak wood tones.
- **Solid & Tactile:** Subtle squared geometry (10dp–14dp corner radii), firm borders, and micro-elevation.
- **Readable & Native:** Strictly adheres to Android accessibility standards, 48dp minimum touch targets, and high contrast.

---

## 2. Color Tokens

### 2.1 Core Palette Tokens

| Token Name | Hex Code | Role |
| :--- | :--- | :--- |
| `vyron_forest_green` | `#3E7D32` | Primary brand accent, primary CTA (Play Game, Create) |
| `vyron_grass_green` | `#5FAE45` | Hover/Pressed accent, active badges, status indicators |
| `vyron_deep_forest` | `#1F3D24` | Hero gradients, deep container fills |
| `vyron_dirt_brown` | `#795548` | Earthy secondary accents |
| `vyron_oak` | `#A97945` | Calm VYRON+ branding, warning badges, favorite stars |
| `vyron_stone` | `#6E7070` | Neutral icons, borders, disabled text |
| `vyron_deep_stone` | `#292B29` | Elevated surfaces, card backgrounds, disabled buttons |
| `vyron_night` | `#151815` | Default dark background canvas |
| `vyron_sky_blue` | `#5FA9D8` | Server icons, network links, technical highlights |
| `vyron_warm_cloud` | `#F2F0E8` | Light theme canvas, dark theme primary text |
| `vyron_charcoal` | `#1C1F1C` | Light theme primary text |
| `vyron_destructive` | `#C62828` | Critical actions (delete, unbind, reset) |

---

## 3. Themes

### 3.1 Dark Forest Theme (Default)
The primary experience for VYRON. Deep, natural, and low-eye-strain.

- **Background:** `#151815` (`@color/vyron_dark_bg`)
- **Surface:** `#202320` (`@color/vyron_dark_surface`)
- **Elevated Surface:** `#292B29` (`@color/vyron_dark_elevated`)
- **Border / Stroke:** `#393C37` (`@color/vyron_dark_border`, 1dp)
- **Primary Text:** `#F2F0E8` (`@color/vyron_dark_text_primary`)
- **Secondary Text:** `#A8ACA2` (`@color/vyron_dark_text_secondary`)
- **Primary Action:** `#3E7D32` (`@color/vyron_forest_green`)

### 3.2 Light Morning Theme
A clean daylight theme reminiscent of a crisp Minecraft morning. Not a direct inversion of the dark theme.

- **Background:** `#F2F0E8` (`@color/vyron_light_bg`)
- **Surface:** `#FFFFFF` (`@color/vyron_light_surface`)
- **Elevated Surface:** `#F7F6F0` (`@color/vyron_light_elevated`)
- **Border / Stroke:** `#D5D8CF` (`@color/vyron_light_border`, 1dp)
- **Primary Text:** `#1C1F1C` (`@color/vyron_light_text_primary`)
- **Secondary Text:** `#5C6057` (`@color/vyron_light_text_secondary`)
- **Primary Action:** `#3E7D32` (`@color/vyron_forest_green`)
- **Accent:** `#A97945` (`@color/vyron_oak`)

### 3.3 Theme Controller (`VyronThemeController`)
- Theme preference persisted in `SharedPreferences` under key `vyron_theme`.
- Supports `DARK_FOREST`, `LIGHT_MORNING`, and `SYSTEM` (matches system day/night mode).
- Applied dynamically to activities prior to `setContentView`.

---

## 4. Typography Scale

Configured in `styles.xml` under `VyronTypography.*`:

| Style Name | Size | Style | Purpose |
| :--- | :--- | :--- | :--- |
| `VyronTypography.Display` | `28sp` | Bold | Large promotional titles |
| `VyronTypography.Headline` | `22sp` | Bold | Screen greetings and primary sections |
| `VyronTypography.Title` | `17sp` | Bold | Card headers, dialog titles, top bar titles |
| `VyronTypography.Body` | `14sp` | Normal | Paragraph text, descriptions |
| `VyronTypography.BodySmall` | `12sp` | Normal | Secondary hints, list subtitles |
| `VyronTypography.Label` | `12sp` | Bold | Button labels, chip titles, tab titles |
| `VyronTypography.Caption` | `11sp` | Normal | Timestamps, metadata, badges |
| `VyronTypography.TechnicalMono` | `12sp` | Monospace | Minecraft versions, RAM, FPS, ping, download speeds |

*Note: Official Minecraft fonts are intentionally avoided for UI text to maintain professional legibility.*

---

## 5. Spacing & Geometry Tokens

Centralized in `dimens.xml`:

- **Spacing:** `4dp`, `8dp`, `12dp`, `16dp`, `20dp`, `24dp`, `32dp`, `40dp`, `48dp`
- **Card Corner Radius:** `12dp` (`@dimen/vyron_radius_card`)
- **Button Corner Radius:** `10dp` (`@dimen/vyron_radius_button`)
- **Chip Corner Radius:** `8dp` (`@dimen/vyron_radius_chip`)
- **Badge Corner Radius:** `6dp` (`@dimen/vyron_radius_badge`)
- **Minimum Touch Target:** `48dp` (`@dimen/vyron_min_touch_target`)

---

## 6. Reusable Components

1. **Buttons:**
   - **Primary (`@drawable/vyron_btn_primary`):** Forest Green `#3E7D32`, pressed state `#5FAE45`, disabled `#292B29`.
   - **Outlined (`@drawable/vyron_btn_outlined`):** 1dp border, transparent background, pressed tint.
   - **Text Button (`@drawable/vyron_btn_text`):** Clean borderless with subtle ripple.
   - **Destructive (`@drawable/vyron_btn_destructive`):** Crimson red `#C62828`.
2. **Cards:**
   - **Default (`@drawable/vyron_card_default`):** Surface `#202320` with 1dp border `#393C37`.
   - **Elevated (`@drawable/vyron_card_elevated`):** Elevated fill `#292B29` with 1dp border.
   - **Selected (`@drawable/vyron_card_selected`):** 2dp active border in Forest Green `#3E7D32`.
   - **Oak Accent (`@drawable/vyron_card_oak`):** 1.5dp Oak `#A97945` border (used for calm VYRON+ card).
3. **Filter Chips (`@drawable/vyron_chip_selected`, `@drawable/vyron_chip_unselected`):**
   - Active Forest Green fill; inactive surface fill with stone border.
4. **Search Bar (`@layout/view_vyron_search_bar`):**
   - Search icon, clear 'X' button, real-time filtering hook.
5. **Top App Bar (`@layout/view_vyron_top_bar`):**
   - Compact 56dp height, VYRON logo, screen title, account status pill, notifications button, back button.
6. **State Components:**
   - **Skeletons (`@layout/view_vyron_skeleton`):** Non-intrusive loading placeholders.
   - **Empty States (`@layout/view_vyron_empty_state`):** Voxel icon, descriptive text, CTA button.
   - **Error States (`@layout/view_vyron_error_state`):** Actionable retry cards.
   - **Offline Banner (`@layout/view_vyron_offline_banner`):** Subtle status notification without blocking local offline play.
7. **Accessibility & Reduce Motion:**
   - `VyronThemeController.isReduceMotion()` disables decorative animations, transitions, and character sway.
