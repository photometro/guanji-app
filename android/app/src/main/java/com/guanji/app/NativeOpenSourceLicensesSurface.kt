package com.guanji.app

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/**
 * User-accessible, offline license view for the third-party components called
 * out by the project's release notices. The complete license texts are APK
 * assets, so this screen does not depend on a network connection or WebView.
 */
@Composable
internal fun NativeOpenSourceLicensesSurface(
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val colors = nativeBackupColors(darkTheme)
    val sqlCipherLicense = remember(context) {
        readBundledLicense(context, "licenses/SQLCIPHER-COMMUNITY-LICENSE.txt")
    }
    val notoLicense = remember(context) {
        readBundledLicense(context, "licenses/NotoSansCJKSC-OFL-1.1.txt")
    }
    val overlayInteractionSource = remember { MutableInteractionSource() }
    val motion = rememberNativeSettingsSheetMotion(Unit, onClose)

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = NativeSettingsSheetMotion.scrimAlpha * motion.progress.coerceIn(0f, 1f)))
            .clickable(interactionSource = overlayInteractionSource, indication = null, onClick = {}),
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .wrapContentHeight()
                .heightIn(min = 260.dp, max = windowMetrics.sheetMax(720.dp, floor = 260.dp))
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp + windowMetrics.navigationBarDp)
                .graphicsLayer {
                    translationY = size.height * (1f - motion.progress)
                    alpha = motion.progress.coerceIn(0f, 1f)
                }
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card),
        ) {
            NativeSettingsSheetHeader("开源软件许可", null, colors) { motion.requestClose() }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = windowMetrics.innerListMax(590.dp, 160.dp))
                    .verticalScroll(rememberScrollState())
                    .padding(start = 20.dp, end = 20.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                BasicText(
                    "以下列出观己当前发行包中单独收录的第三方组件声明及完整许可文本。内容随应用打包，可离线查看。",
                    style = NativeTypography.style(NativeTypography.Role.BackupBody, colors.secondary),
                )
                LicenseModule(
                    title = "SQLCipher for Android Community Edition 4.6.1",
                    metadata = "BSD-style license · Zetetic, LLC · SQLite 为 public domain",
                    source = "https://www.zetetic.net/sqlcipher/license/",
                    licenseText = sqlCipherLicense,
                    colors = colors,
                )
                LicenseModule(
                    title = "Noto Sans SC Variable Sans2.004",
                    metadata = "© 2014-2021 Adobe (http://www.adobe.com/).\nNoto is a trademark of Google Inc.\nSIL Open Font License 1.1 · 简体中文子集可变 TTF · wght 100–900",
                    source = "https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004",
                    licenseText = notoLicense,
                    colors = colors,
                )
            }
        }
    }
}

@Composable
private fun LicenseModule(
    title: String,
    metadata: String,
    source: String,
    licenseText: String,
    colors: NativeBackupColors,
) {
    NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            BasicText(title, style = NativeTypography.style(NativeTypography.Role.BackupCardTitle, colors.ink))
            BasicText(metadata, style = NativeTypography.style(NativeTypography.Role.BackupSmall, colors.secondary))
            BasicText(source, style = NativeTypography.style(NativeTypography.Role.BackupSmall, colors.accent))
            SelectionContainer {
                BasicText(
                    licenseText.ifBlank { "许可文本暂时无法读取，请查看随发行版提供的 NOTICE 文件。" },
                    style = NativeTypography.style(NativeTypography.Role.BackupSmall, colors.secondary),
                )
            }
        }
    }
}

private fun readBundledLicense(context: Context, assetPath: String): String =
    runCatching {
        context.assets.open(assetPath).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }.getOrDefault("")
