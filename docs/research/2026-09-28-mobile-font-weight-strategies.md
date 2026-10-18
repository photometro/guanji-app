# Mobile app font-weight consistency: common approaches and relevance to Guanji

Date: 2026-09-28

## What established platform practices do

1. **System-font-first for native platform fit.** Android's guidance treats Roboto as the baseline system font while allowing a product to customize typography; manufacturer theme and font settings can influence what users see. Apple's guidance similarly recommends requesting the platform system font rather than bundling Apple's system fonts. This gives native controls platform adaptation and accessibility behavior, but it does not promise that two Android OEMs or WebView and Compose will render identical glyph outlines.
2. **A bundled family for brand and cross-device consistency.** When a product needs the same appearance across devices, it owns the font family and maps semantic roles to real font faces. Compose supports registering each face with its weight, and supports variable-font axes on Android O/API 26 and above. The corresponding WebView CSS must use the same family and declare its actual weight range; otherwise the two rendering stacks still resolve different fonts.
3. **Use a small semantic type system, not arbitrary unbacked weights.** Material typography uses shared type tokens. The CSS Fonts specification says that when a requested weight is missing, a nearby face is selected; variable fonts use the `wght` axis and can represent a continuous range. Thus a CSS request for 600 does not prove that the renderer uses a real 600 face.

## Current Guanji situation

The same-state evidence at `debug/visual-migration/#280-vc3-weight-same-state-4.2.11-133/same-state-analysis.md` records that WebView uses a system font stack while Compose uses embedded Noto Sans CJK SC static 400/500/700. Native's requested 600 maps to 500, while 650/750/800 map to 700. The screenshots suggest a visible difference at 600, but do not isolate whether the cause is the weight face or the font family itself. Therefore adding more Noto weights to Compose alone could improve Compose's internal mapping without making it match the font WebView actually resolved.

## Candidate worth a controlled test

The official Noto CJK repository distributes a Simplified Chinese variable font. Google Fonts metadata identifies Noto Sans SC as OFL and its `wght` axis as 100–900. This can cover 600/650/750/800 without separately registering a static file for each value. Compose documents variable-font support from Android O/API 26, so if the app supports lower API levels, a static-font fallback remains necessary. Test glyph coverage, APK size, rendering, and the project's already-recorded compatibility policy before adoption.

## Recommendation for Guanji

- Do **not** add extra static font files just because the screenshots show a difference.
- First collect the actual WebView rendered-font evidence for the same Chinese labels and requested weights; computed CSS `font-family` alone only shows the requested stack, not necessarily the final fallback face.
- If the product keeps WebView as the strict historical visual baseline, make Native match the resolved WebView font/weight behavior; this may retain OEM-dependent rendering.
- If the product prioritizes one stable appearance across OEM devices, the durable architecture is one app-owned font family shared by both WebView CSS and Compose. Noto Sans SC variable is a plausible candidate, but changing WebView to it changes the baseline and therefore needs an explicit typography-baseline decision plus VC3 regression evidence.

## Primary sources

- Android mobile theme guidance: https://developer.android.com/design/ui/mobile/guides/styles/themes
- Jetpack Compose font setup and variable-font/API caveat: https://developer.android.com/develop/ui/compose/text/fonts
- Material 3 Compose typography tokens: https://developer.android.com/develop/ui/compose/designsystems/material3
- Apple font guidance: https://developer.apple.com/documentation/technologyoverviews/fonts
- CSS Fonts Level 4 missing-weight matching and `wght` behavior: https://www.w3.org/TR/css-fonts-4/
- Noto CJK variable font formats: https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md
- Noto Sans SC weight-axis and OFL metadata: https://github.com/google/fonts/blob/main/ofl/notosanssc/METADATA.pb
- SIL OFL license text: https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE
