# Noto Sans SC 可变字体替代可行性研究

日期：2026-09-28<br>
范围：#280 / VC3 字体系统；仅研究，不修改产品代码、字体资源、版本号或 APK。

## 结论

可变字体是可行的候选方案，但不能在当前 `minSdk 24` 下无条件取代全部静态字体。

- 当前 App 内嵌的 `vc2_noto_regular.otf`、`vc2_noto_medium.otf`、`vc2_noto_bold.otf` 都是静态 Noto Sans SC；三份文件均没有 OpenType `fvar` 表，因此当前并未使用可变字体。
- Noto 官方发布了 Simplified Chinese 区域子集可变字体 `NotoSansSC-VF.ttf`。它只有 `wght` 轴，范围为 100–900，能够把 400、500、600、650、700、750、800 映射为真实轴值，而不是把中间请求吸附到 500 或 700。
- Jetpack Compose 官方文档明确说明可变字体仅支持 Android O/API 26 及以上；观己当前 `minSdkVersion = 24`。因此：
  - API 26+ 可以使用可变字体；
  - API 24/25 必须保留静态字体回退，或者产品正式提高最低系统版本；
  - 若继续支持 API 24/25，采用“可变字体 + 当前三份静态回退”会增加包体，而不是减小包体。
- 推荐将可变字体列为 **VC3 的受控替代实验**，而不是立即替换。先在独立分支验证 API 26+ 的完整字重、API 24/25 的静态回退、三设备视觉、包体和首次渲染，再决定是否纳入正式版本。

## 1. 当前资源并不是可变字体

项目当前资源：

| 文件 | 实际家族/字形 | 大小 | 字形数 | `fvar` |
|---|---|---:|---:|---|
| `vc2_noto_regular.otf` | Noto Sans SC Regular 400 | 8,331,336 B | 31,036 | 无 |
| `vc2_noto_medium.otf` | Noto Sans SC Medium 500 | 8,345,436 B | 31,036 | 无 |
| `vc2_noto_bold.otf` | Noto Sans SC Bold 700 | 8,543,168 B | 31,036 | 无 |

合计为 25,219,940 B（约 24.05 MiB）。当前 `NativeTypography.kt` 虽然声明了 600、650、750、800，但它们只是映射到现有静态文件：

- 600 → Medium 500；
- 650/750/800 → Bold 700。

`FontWeight(650)` 本身不会让静态字体生成 650 字形；在 `FontSynthesis.None` 下，它只能使用注册到该请求的静态脸。

## 2. 官方可变字体候选

Noto CJK 官方仓库同时提供语言特定与区域子集的 Variable OTF/TTF。当前 App 使用的是 **Noto Sans SC 区域子集**，因此最接近的候选不是更大的 `NotoSansCJKsc-VF.ttf`，而是：

> `Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf`

官方 Sans 2.004 文件与本地核验结果：

| 候选 | 格式 | 大小 | 覆盖/用途 |
|---|---|---:|---|
| `NotoSansSC-VF.ttf` | TTF，区域子集 | 17,773,132 B | 简体中文区域子集；31,036 字形；当前资源的直接候选 |
| `NotoSansSC-VF.otf` | OTF，区域子集 | 15,054,748 B | 同为区域子集，但 Compose 官方示例明确要求放入变量版本 `.ttf`，TTF 是更保守的 Android 方案 |
| `NotoSansCJKsc-VF.ttf` | TTF，语言特定全覆盖 | 36,144,788 B | 含完整 CJK 覆盖与语言标记能力；对当前 App 过大且非必要 |
| Google Fonts `NotoSansSC[wght].ttf` | TTF，区域子集 | 17,772,300 B | Google Fonts 当前分发版本；元数据标明来源为 Noto CJK Sans2.004 |

`NotoSansSC-VF.ttf` 的 OpenType 表中包含 `fvar`、`avar`、`gvar`、`HVAR`、`STAT`，唯一可变轴为：

```text
wght: 100 .. 900
```

因此 650 和 750 都是该轴内的合法真实取值，不需要为它们单独准备静态字体文件。Google Fonts 的官方元数据同样声明 Noto Sans SC 的 `wght` 为 100–900。

官方来源：

- [Noto CJK Sans 下载格式与各可变字体入口](https://github.com/notofonts/noto-cjk/blob/main/Sans/README.md)
- [Noto Sans CJK Sans2.004 官方发行版](https://github.com/notofonts/noto-cjk/releases/tag/Sans2.004)
- [Google Fonts Noto Sans SC 元数据：OFL、wght 100–900](https://github.com/google/fonts/blob/main/ofl/notosanssc/METADATA.pb)
- [Google Fonts 对 Noto Sans SC 上游文件来源的记录](https://github.com/google/fonts/blob/main/ofl/notosanssc/upstream_info.md)

## 3. Compose 与 API 兼容边界

项目事实：

- `minSdkVersion = 24`；
- Compose UI 版本为 1.7.6；
- `FontVariation` API 自 Compose 1.3.0 起提供，因此 1.7.6 具备所需 API；
- Compose 变量字体接口仍需要 `ExperimentalTextApi` opt-in。

Android 官方的硬边界是：

> Variable fonts are only supported on Android O and above.

即 API 26+。官方示例也要求用 `Build.VERSION.SDK_INT >= Build.VERSION_CODES.O` 保护，并为更低版本提供适当静态回退。

直接后果：

| 系统 | 可变 `wght` | 观己可采用的路径 |
|---|---|---|
| API 26+ | 支持 | 使用可变 TTF，注册实际需要的 400/500/600/650/700/750/800 轴值 |
| API 24–25 | 不支持 | 继续使用当前 400/500/700 静态字体；中间字重仍按当前规则回退 |

官方来源：

- [Jetpack Compose：Use variable fonts](https://developer.android.com/develop/ui/compose/text/fonts#variable-fonts)
- [Compose `FontVariation` API](https://developer.android.com/reference/kotlin/androidx/compose/ui/text/font/FontVariation)
- [Android `Paint.setFontVariationSettings`：API 26](https://developer.android.com/reference/android/graphics/Paint#setFontVariationSettings(java.lang.String))

### Compose 中的实际映射方式

为了让 FontFamily 的字重匹配与 `wght` 轴一致，不能只注册一个“400”的 ResourceFont，然后期望所有 `TextStyle.fontWeight` 自动产生连续轴值。受控实现应当让同一可变资源以所需权重声明多次，每个声明同时指定匹配权重和相同的 `wght` 值，例如：

```kotlin
Font(
    R.font.noto_sans_sc_variable,
    weight = FontWeight(650),
    variationSettings = FontVariation.Settings(
        FontWeight(650),
        FontStyle.Normal,
    ),
)
```

同一个 `R.font` 文件可被多个 Font 描述符复用，APK 中只打包一份二进制；FontFamily resolver 根据 `TextStyle.fontWeight` 选中对应描述符，再加载指定轴值。正式实现仍需用 Compose 1.7.6 编译测试确认，不应只依赖当前版本文档推断。

`FontSynthesis.None` 应继续保留，避免未注册请求被 OEM 侧再次合成。

## 4. 包体权衡

### 仅面向 API 26+，用可变字体替换三份静态字体

```text
当前三份静态字体：25,219,940 B
变量 TTF：         17,773,132 B
原始资源减少：      7,446,808 B（约 7.10 MiB）
```

现有 debug APK 中三份 OTF 的压缩后条目合计约 21.93 MB；对官方变量 TTF 做相同 Deflate 代理测量约为 11.33 MB。这个结果表明变量字体可能明显降低 APK 字体占用，但它不是正式 APK 差值：AAPT2、对齐、签名和构建类型都会影响最终结果，必须用替代实验 APK 实测。

### 保持 minSdk 24 并保留三份静态回退

```text
三份静态回退 + 变量 TTF
= 42,993,072 B（约 41.00 MiB）
相对当前原始资源增加约 16.95 MiB
```

因此在不提高 minSdk 的前提下，可变方案换来的是 API 26+ 的连续字重能力，不是包体节省。若只保留一个 Regular 静态回退，API 24/25 会丢失当前已有的 500/700 层级，与“升级不能倒退”的目标不符，不推荐。

### 性能结论

官方文档只保证一个变量文件可替代多个常规文件，没有承诺冷启动、内存或文本布局一定更优。可变字体带有 `gvar/HVAR` 等表，且每个已用轴值可能形成独立 Typeface/字形缓存。正式准入必须实测：

- APK 与安装占用；
- 冷启动、首个原生页面首次文本渲染；
- 首页/洞悉长页面滚动；
- 多个字重同时出现时的 PSS 与字体缓存；
- 400/500/600/650/700/750/800 的字符宽度、换行、裁切和 baseline；
- 魅族 21、魅族 18S、OnePlus 的一致性。

不能把“文件数量更少”直接写成“运行时一定更快”。

## 5. 许可与 NOTICE

Noto Sans SC 变量字体和当前静态字体同属 SIL Open Font License 1.1。OFL 明确允许在软件中使用、嵌入和再分发未修改或修改后的字体；随软件分发时，需要保留版权声明和许可证，并让用户能够查看。

采用官方未修改的 `NotoSansSC-VF.ttf` 不会引入新的许可证种类，但需要更新项目归档：

- `THIRD_PARTY_NOTICES.md` 从三份静态 OTF 改为变量 TTF，并保留 API 24/25 静态回退说明；
- 更新文件名、来源 tag、SHA-256 和实际嵌入文件清单；
- 保留 `android/app/src/main/assets/licenses/NotoSansCJKSC-OFL-1.1.txt`；
- 保证“我的 → App 介绍 → 开源软件许可”仍可访问完整声明；
- 发行材料继续携带 NOTICE。

若使用的是 Noto 官方已经发布的区域子集文件，它仍是官方原始版本；不要自行抽字或转换格式后仍把它描述为“未修改”。自行 subset/转换会成为 OFL 定义下的 Modified Version，需要额外审核 Reserved Font Name 和再分发表述。

官方来源：

- [Noto Sans CJK SIL OFL 1.1](https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE)

## 6. 三种迁移选项

### 选项 A：保留现状

继续使用静态 400/500/700，保持现有映射。包体、API 24/25、三设备结果均已知，但 600/650/750/800 不是真实独立字重。

适合：优先稳定、暂不接受字体系统二次迁移。

### 选项 B：API 26+ 可变字体，API 24/25 三静态回退（推荐实验）

```text
API 26+  → NotoSansSC-VF.ttf，真实 400/500/600/650/700/750/800
API 24/25 → 当前静态 400/500/700 与既有中间映射
```

优点：不放弃现有系统兼容范围；现代设备获得完整轴值。<br>
代价：字体原始资源总量增加约 16.95 MiB；两套字体路径都要回归；API 24/25 仍不能完整映射。

这是当前约束下最安全的可变字体试验方式。

### 选项 C：提高 minSdk 到 26，完全替换为变量字体

优点：字体系统最干净；一个变量 TTF 完整覆盖所需字重；原始字体资源可减少约 7.10 MiB。<br>
代价：放弃 Android 7.0/7.1（API 24/25），属于产品兼容策略变更，不能由 VC3 字体优化单独决定。

在当前路线中不建议只为字体提高 minSdk。

## 7. 推荐的实验闸门

若产品决定继续探索，建议在不替换主线字体的独立实验中按顺序执行：

1. 固定官方候选：Sans2.004 `NotoSansSC-VF.ttf`，不使用更大的 `NotoSansCJKsc-VF.ttf`。
2. API 26+ 注册实际用到的 400/500/600/650/700/750/800；保留 `FontSynthesis.None`。
3. API 24/25 保留当前三静态字体回退；若没有 API 24/25 运行环境，至少完成静态兼容审查并明确风险接受，不能声称已真机验证。
4. 先用字体样张验证字重递进、字符宽度、baseline、换行和裁切，再替换页面 Typography。
5. 复测 #274–#280 已通过的 Tab、Sheet、Footer、IME、弹性布局，不允许字体变化破坏既有成果。
6. 用同一 APK 和 fixture 做魅族 21、魅族 18S、OnePlus 三设备验收。
7. 比较 APK、冷启动、首次文本渲染和内存；超过项目准入阈值则回退静态方案。
8. 验收通过后才更新 NOTICE、许可证清单和 VC3 台账；失败则删除实验资源，不改正式字体体系。

## 最终建议

当前字体不是可变字体。官方 Noto Sans SC 可变 TTF 能够真实覆盖全部目标字重，技术上值得实验；但 minSdk 24 意味着它不能单独成为全量替代品。

因此建议：

> 将“API 26+ 变量字体 + API 24/25 当前三静态字体回退”作为 VC3 的候选实验，不立即合入正式体系。实验重点不是再次追逐 WebView，而是判断连续 `wght` 是否能让 Native 自身形成稳定且清晰的语义层级，并且是否值得额外包体与双路径维护成本。

如果未来产品可以把最低系统版本提高到 API 26，则可重新评估完全替换；在当前 minSdk 24 下，不建议删除三份静态字体。
