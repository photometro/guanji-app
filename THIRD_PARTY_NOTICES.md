# Third-party notices

## SQLCipher for Android Community Edition

- Package: `net.zetetic:sqlcipher-android:4.6.1` (Community Edition)
- Copyright: Copyright (c) 2008-2026, Zetetic, LLC
- License: BSD-style license; the complete license text is bundled at `android/app/src/main/assets/licenses/SQLCIPHER-COMMUNITY-LICENSE.txt` and shown in **我的 → App 介绍 → 开源软件许可**.
- SQLite attribution: SQLite is in the public domain. SQLCipher's official license page also lists notices for integrated/dependent components; keep the dependency/SBOM review in sync when the packaged dependency set changes.
- Official license source: https://www.zetetic.net/sqlcipher/license/SQLCIPHER_COMMUNITY_EDITION_LICENSE.txt

## Noto Sans SC Variable

观己 Native UI embeds the unmodified Simplified Chinese subset variable TTF from **Noto Sans SC Sans2.004**.

- Source: https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004 (`Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf`)
- SHA-256: `D68BAFCB48A2707749396AA12BBBD833CB70401F3A9A689FD2902C7E0D295964`
- OpenType variable axis: `wght` 100–900; the app registers 400/500/600/650/700/750/800.
- Copyright: © 2014-2021 Adobe (http://www.adobe.com/).
- Trademark: Noto is a trademark of Google Inc. (as recorded in the embedded font metadata).
- License: SIL Open Font License 1.1
- Embedded file: `noto_sans_sc_variable.ttf` (one resource; selected weights use their corresponding `wght` axis values).
- Minimum Android version for the variable-font rendering path: Android 8.0 / API 26. The last API 24/25-compatible app version is 4.2.11 (`versionCode 133`).

The complete license text is bundled at:

`android/app/src/main/assets/licenses/NotoSansCJKSC-OFL-1.1.txt`

It is also available offline in **我的 → App 介绍 → 开源软件许可**.

The font files are bundled, not sold separately, and have not been modified or subsetted.
