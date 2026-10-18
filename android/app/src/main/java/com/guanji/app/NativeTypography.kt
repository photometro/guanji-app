package com.guanji.app

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontSynthesis
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * #280 VC2：字体准入层。
 *
 * VC3-R2 使用 Noto Sans SC Variable（OFL 1.1）作为 Native 的确定性中文字体。
 * WebView 仍保留系统字体栈；Native 所有字重通过本对象映射到变量字体 wght 轴。
 */
@OptIn(ExperimentalTextApi::class)
internal object NativeTypography {
    /** WebView `--font` 的可追溯事实来源。 */
    const val webViewFontStack =
        "-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Helvetica Neue, PingFang SC, HarmonyOS Sans SC, Microsoft YaHei, sans-serif"

    /** VC3-R2：同一份官方 Noto Sans SC Variable 字体按真实 wght 轴注册。 */
    val family: FontFamily = FontFamily(
        variableFont(400),
        variableFont(500),
        variableFont(600),
        variableFont(650),
        variableFont(700),
        variableFont(750),
        variableFont(800),
    )

    private fun variableFont(weight: Int) = Font(
        resId = R.font.noto_sans_sc_variable,
        weight = FontWeight(weight),
        variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
    )

    /** 禁止设备在缺少指定字重时进行合成，避免跨厂商字形重量漂移。 */
    val synthesis: FontSynthesis = FontSynthesis.None

    /** VC0/VC3 的固定基线与可测试放大档位。 */
    val admittedFontScales: Set<Float> = setOf(1.0f, 1.15f, 1.30f)

    /** VC3-R2 选型记录；完整许可证位于 THIRD_PARTY_NOTICES.md 和 assets/licenses。 */
    const val bundledFontPolicy = "Noto Sans SC Sans2.004 variable TTF; OFL-1.1; wght 100-900; Native registers 400/500/600/650/700/750/800"

    /**
     * VC3 的语义角色。数值来自 WebView CSS/已有迁移契约；本批只收拢
     * 字体家族、实际字重和字体合成策略，不借 Typography token 改布局。
     */
    enum class Role {
        HomeGreeting,
        HomeCardTitle,
        HomeCardSubtitle,
        HomeMetricValue,
        HomeMetricUnit,
        HomeMetricLabel,
        HomeBodyStrong,
        HomeBody,
        HomeDelta,
        HomeEmpty,
        HomeRecentPrimary,
        HomeRecentMeta,
        HomePillButton,
        CalendarTitle,
        CalendarDay,
        CalendarBadge,
        CalendarAction,
        RecordFieldLabel,
        RecordDuration,
        RecordDateDisplay,
        RecordBody,
        RecordPlaceholder,
        RecordHeader,
        RecordChip,
        RecordFooterButton,
        RecordTimerHint,
        RecordDirectLink,
        RecordTimerLabel,
        RecordTimerValue,
        RecordTimerMeta,
        RecordTimerButton,
        RecordTimerSecondary,
        SettingsEyebrow,
        SettingsPageTitle,
        SettingsCardTitle,
        SettingsSectionTitle,
        SettingsRowTitle,
        SettingsCaption,
        SettingsSecondary,
        SettingsBody,
        SettingsButton,
        SettingsInput,
        SettingsAboutTitle,
        SettingsAboutBody,
        SettingsClose,
        BackupSheetTitle,
        BackupHeaderStatus,
        BackupCardTitle,
        BackupSectionLabel,
        BackupBody,
        BackupCaption,
        BackupMeta,
        BackupSmall,
        BackupBadge,
        BackupButton,
        BackupFooterSecondaryButton,
        BackupPrimaryButton,
        BackupSelectedOption,
        BackupClose,
        InsightEyebrow,
        InsightPageTitle,
        InsightPageSubtitle,
        InsightCardTag,
        InsightCardTitle,
        InsightNarrative,
        InsightAiLabel,
        InsightMetricNumber,
        InsightMetricLabel,
        InsightClarity,
        InsightDataLabel,
        InsightDataValue,
        InsightEmpty,
        InsightPair,
        InsightPairCount,
        InsightChangeResult,
        InsightChangeNote,
        InsightChangeLabel,
        InsightChangeValue,
        InsightSuggestionNumber,
        InsightSuggestion,
        InsightActionEyebrow,
        InsightActionTitle,
        InsightActionStatus,
        InsightDisclaimer,
        InsightButton,
        InsightAskTitle,
        InsightAskChip,
        InsightAskAnswer,
        InsightAskQuestion,
        TabLabel
    }

    /**
     * T0 role mapping: 首页问候/常规卡片 + 记录详情。
     * `fontFamily` 与 `fontSynthesis` 在一个入口收口，避免 OEM 对缺字重
     * 自动合成；字号、行高和字距保持本轮迁移前的 WebView 等价值。
     */
    fun style(
        role: Role,
        color: Color,
        active: Boolean = false,
        textAlign: TextAlign = TextAlign.Unspecified
    ): TextStyle {
        val (size, lineHeight, weight, spacing) = when (role) {
            Role.HomeGreeting -> Quad(26.sp, 30.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.HomeCardTitle -> Quad(16.sp, TextUnit.Unspecified, FontWeight.Bold, 0.16.sp)
            Role.HomeCardSubtitle -> Quad(12.sp, TextUnit.Unspecified, FontWeight.Normal, 0.24.sp)
            Role.HomeMetricValue -> Quad(44.sp, 44.sp, FontWeight.ExtraBold, TextUnit.Unspecified)
            Role.HomeMetricUnit -> Quad(16.sp, TextUnit.Unspecified, FontWeight.Bold, TextUnit.Unspecified)
            Role.HomeMetricLabel -> Quad(11.sp, 16.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.HomeBodyStrong -> Quad(13.sp, 18.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.HomeBody -> Quad(12.sp, 18.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.HomeDelta -> Quad(12.sp, TextUnit.Unspecified, FontWeight.Bold, TextUnit.Unspecified)
            Role.HomeEmpty -> Quad(13.sp, 25.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.HomeRecentPrimary -> Quad(14.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.HomeRecentMeta -> Quad(12.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.HomePillButton -> Quad(15.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.CalendarTitle -> Quad(16.sp, TextUnit.Unspecified, FontWeight.Bold, TextUnit.Unspecified)
            Role.CalendarDay -> Quad(14.sp, TextUnit.Unspecified, if (active) FontWeight.Bold else FontWeight.Normal, TextUnit.Unspecified)
            Role.CalendarBadge -> Quad(9.sp, 15.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.CalendarAction -> Quad(15.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.RecordFieldLabel -> Quad(13.65.sp, 19.11.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.RecordDuration -> Quad(35.7.sp, 35.7.sp, FontWeight.ExtraBold, 0.7.sp)
            Role.RecordDateDisplay -> Quad(22.sp, TextUnit.Unspecified, FontWeight.ExtraBold, (-.2).sp)
            Role.RecordBody -> Quad(15.sp, 22.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordPlaceholder -> Quad(14.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordHeader -> Quad(17.85.sp, 25.82.sp, FontWeight.ExtraBold, TextUnit.Unspecified)
            Role.RecordChip -> Quad(13.sp, TextUnit.Unspecified, if (active) FontWeight(650) else FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordFooterButton -> Quad(16.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.RecordTimerHint -> Quad(11.55.sp, 15.015.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordDirectLink -> Quad(12.6.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordTimerLabel -> Quad(13.sp, TextUnit.Unspecified, FontWeight.SemiBold, 1.5.sp)
            Role.RecordTimerValue -> Quad(42.sp, TextUnit.Unspecified, FontWeight.ExtraBold, (-.5).sp)
            Role.RecordTimerMeta -> Quad(13.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.RecordTimerButton -> Quad(17.85.sp, TextUnit.Unspecified, FontWeight.Bold, .3.sp)
            Role.RecordTimerSecondary -> Quad(13.65.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.SettingsEyebrow -> Quad(11.sp, 16.sp, FontWeight.SemiBold, 0.66.sp)
            Role.SettingsPageTitle -> Quad(26.sp, 30.sp, FontWeight.Bold, (-0.52).sp)
            Role.SettingsCardTitle -> Quad(16.sp, 21.sp, FontWeight.Bold, 0.16.sp)
            Role.SettingsSectionTitle -> Quad(13.sp, 18.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.SettingsRowTitle -> Quad(14.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.SettingsCaption -> Quad(11.sp, 16.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.SettingsSecondary -> Quad(12.sp, 19.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.SettingsBody -> Quad(13.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.SettingsButton -> Quad(15.sp, 18.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.SettingsInput -> Quad(14.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.SettingsAboutTitle -> Quad(16.sp, 20.sp, FontWeight.Bold, 0.96.sp)
            Role.SettingsAboutBody -> Quad(13.sp, 23.sp, FontWeight.Normal, 0.26.sp)
            Role.SettingsClose -> Quad(18.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupSheetTitle -> Quad(18.sp, 23.sp, FontWeight.ExtraBold, TextUnit.Unspecified)
            Role.BackupHeaderStatus -> Quad(11.sp, 16.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupCardTitle -> Quad(13.sp, 18.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.BackupSectionLabel -> Quad(11.sp, 16.sp, FontWeight(650), TextUnit.Unspecified)
            Role.BackupBody -> Quad(11.sp, 16.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupCaption -> Quad(12.sp, 18.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupMeta -> Quad(10.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupSmall -> Quad(9.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupBadge -> Quad(9.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupButton -> Quad(12.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.BackupFooterSecondaryButton -> Quad(12.sp, TextUnit.Unspecified, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.BackupPrimaryButton -> Quad(12.sp, TextUnit.Unspecified, FontWeight(650), TextUnit.Unspecified)
            Role.BackupSelectedOption -> Quad(10.sp, TextUnit.Unspecified, FontWeight(650), TextUnit.Unspecified)
            Role.BackupClose -> Quad(18.sp, TextUnit.Unspecified, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightEyebrow -> Quad(11.sp, 16.sp, FontWeight.SemiBold, 0.66.sp)
            Role.InsightPageTitle -> Quad(26.sp, 30.sp, FontWeight.Bold, (-0.52).sp)
            Role.InsightPageSubtitle -> Quad(13.sp, 21.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightCardTag -> Quad(11.sp, 16.sp, FontWeight.SemiBold, 1.54.sp)
            Role.InsightCardTitle -> Quad(16.sp, 21.sp, FontWeight.Bold, 0.16.sp)
            Role.InsightNarrative -> Quad(14.5.sp, 26.8.sp, FontWeight.Normal, 0.29.sp)
            Role.InsightAiLabel -> Quad(11.sp, 16.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.InsightMetricNumber -> Quad(42.sp, 40.sp, FontWeight.ExtraBold, (-1.68).sp)
            Role.InsightMetricLabel -> Quad(12.sp, 18.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightClarity -> Quad(11.sp, 17.sp, FontWeight.Medium, TextUnit.Unspecified)
            Role.InsightDataLabel -> Quad(11.sp, 16.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightDataValue -> Quad(13.sp, 20.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.InsightEmpty -> Quad(14.5.sp, 26.sp, FontWeight.Normal, 0.29.sp)
            Role.InsightPair -> Quad(14.sp, 24.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightPairCount -> Quad(12.sp, 18.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.InsightChangeResult -> Quad(14.sp, 21.sp, FontWeight.Bold, TextUnit.Unspecified)
            Role.InsightChangeNote -> Quad(12.sp, 19.8.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightChangeLabel -> Quad(12.sp, 19.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightChangeValue -> Quad(13.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightSuggestionNumber -> Quad(12.sp, 20.sp, FontWeight.ExtraBold, 0.6.sp)
            Role.InsightSuggestion -> Quad(14.5.sp, 25.4.sp, FontWeight.Normal, 0.29.sp)
            Role.InsightActionEyebrow -> Quad(11.sp, 16.sp, FontWeight.Bold, 0.44.sp)
            Role.InsightActionTitle -> Quad(12.sp, 19.8.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightActionStatus -> Quad(12.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightDisclaimer -> Quad(11.sp, 19.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightButton -> Quad(15.sp, 15.sp, FontWeight.SemiBold, TextUnit.Unspecified)
            Role.InsightAskTitle -> Quad(14.sp, 21.sp, FontWeight.Bold, 0.28.sp)
            Role.InsightAskChip -> Quad(13.sp, 20.sp, FontWeight.Normal, TextUnit.Unspecified)
            Role.InsightAskAnswer -> Quad(14.sp, 25.9.sp, FontWeight.Normal, 0.28.sp)
            Role.InsightAskQuestion -> Quad(13.sp, 20.sp, FontWeight.Bold, 0.26.sp)
            Role.TabLabel -> Quad(11.sp, 13.sp, FontWeight.Normal, TextUnit.Unspecified)
        }
        return TextStyle(
            color = color,
            fontSize = size,
            lineHeight = lineHeight,
            fontWeight = weight,
            letterSpacing = spacing,
            fontFamily = family,
            fontSynthesis = synthesis,
            textAlign = textAlign
        )
    }

    /** Keeps one-off legacy typography on the admitted font and synthesis policy. */
    fun explicit(
        color: Color,
        fontSize: TextUnit,
        fontWeight: FontWeight = FontWeight.Normal,
        lineHeight: TextUnit = TextUnit.Unspecified,
        letterSpacing: TextUnit = TextUnit.Unspecified,
        textAlign: TextAlign = TextAlign.Unspecified,
    ): TextStyle = TextStyle(
        color = color,
        fontSize = fontSize,
        lineHeight = lineHeight,
        fontWeight = fontWeight,
        letterSpacing = letterSpacing,
        fontFamily = family,
        fontSynthesis = synthesis,
        textAlign = textAlign,
    )

    private data class Quad(
        val size: TextUnit,
        val lineHeight: TextUnit,
        val weight: FontWeight,
        val spacing: TextUnit
    )
}
