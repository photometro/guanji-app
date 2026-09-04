# App 开屏动画设计调研与观己适配建议

日期：2026-08-29
范围：Android 原生 SplashScreen、Material motion、Apple launch screen、Flutter/跨端启动衔接，以及 Google、Netflix、Spotify 等主流产品的一手品牌/无障碍资料。
目的：为观己当前“动画过于简单、退出时与首页衔接不顺”的问题提供可验证的设计与工程依据。

## 先给结论

开屏动画的核心不是把等待时间做得更长，而是让“系统开屏 → 品牌图形 → 首页第一帧”成为一条连续、可提前结束的链路。对观己最有价值的改进是：

1. 继续使用 Android 原生 `SplashScreen`，不要在 WebView 内再叠一套长期存在的 HTML 开屏。
2. 品牌动画只做一件可识别的事：让两片玻璃切片轻微归位/合成，再自然进入首页；不加入文字、加载百分比、AI 或每日话语。
3. 开屏退出必须绑定“首页第一帧已经稳定可见”，不能只依赖固定延迟。系统允许应用在更早准备好时跳过剩余动画；如果首页未准备好，过早淡出会产生白闪、布局跳变或空窗。
4. 总品牌动画控制在 1 秒以内；进入和退出分别采用短时、方向一致的缓动。建议观己的退出段约 195–225ms，图形主动画约 450–650ms，具体值必须以真机首帧与帧率回归为准。
5. 图形使用专用矢量安全区资源，不直接把自适应启动器图标当作无约束的全屏素材。开屏背景使用与首页首帧相同的单一不透明颜色。
6. 对“减少动态效果”用户，保留信息连续性，但将图形运动降级为静态图标 + 短淡出，不做缩放、旋转、闪烁、持续呼吸或模糊变化。

上述第 1、3、5 点直接来自平台规范；第 2、4、6 点是结合平台规范、当前观己视觉和 WebView 首帧结构做出的产品建议，实施前仍需在目标机型上测量。

## 一、平台规范中的硬约束

### Android SplashScreen

Android 12 起，启动流程由系统进入动画、SplashScreen 等待段和退出动画组成。系统进入动画不可自定义；应用可以提供图标动画，也可以通过 `SplashScreenView` 定制退出时的变换、透明度和颜色。[Android 官方 SplashScreen 文档](https://developer.android.com/develop/ui/views/launch/splash-screen?hl=en)

官方建议：

- 开屏图标应是矢量 drawable，可静态或动画化；手机上的动画建议不超过 1,000ms。
- 动画图标使用 `AnimatedVectorDrawable` XML 时，图标区域为 432dp，内部可见安全区域为 288dp；启动器/系统会对图标进行遮罩，超出可见圆形区域的内容会被裁切。
- 背景应是单一不透明颜色，并提供日间/夜间对应资源。
- 首页准备更早时，系统可能跳过动画剩余部分，因此动画必须能在任意中间状态舒适地结束。
- 只有首页从视觉上稳定后才应退出；过早显示不完整界面会造成突兀和不确定感。

这解释了观己此前出现的“不同手机图标比例不一致”风险：同一张 bitmap 或自适应 launcher 图标会再经历系统安全区和遮罩处理，专用矢量资源与内部留白比单纯放大图形更可靠。

### Android 启动性能

Android 官方将启动区分为冷启动、温启动、热启动，并建议以冷启动为基准优化。重要指标是 TTID（首次显示）和 TTFD（完全可交互）；首帧显示和后续内容准备都不能被混为一个固定的“开屏时长”。Android Vitals 将冷启动 5 秒及以上、温启动 2 秒及以上、热启动 1.5 秒及以上视为过长。[Android 官方 App startup time 文档](https://developer.android.com/topic/performance/vitals/launch-time)

对观己的含义：开屏动画应等待必要的本地首屏数据，但不应等待 AI、WebDAV、网络请求或非首屏任务；构建可观测的 TTID/TTFD，再决定是否优化资源和初始化，而不是用延长动画掩盖启动慢。

### Apple launch screen

Apple 将 launch screen 定义为“让应用看起来快速、立即可用”的系统启动画面，而不是展示品牌或广告的独立宣传页。官方建议 launch screen 与第一屏几乎一致，以避免两屏切换时闪烁；如果只需要纯色，就只显示纯色；避免放置文字、广告和非第一屏固定内容。还应匹配当前方向和外观模式，并在重启时恢复上次状态。[Apple HIG — Launching](https://developer.apple.com/design/human-interface-guidelines/launching/)

这并不意味着观己不能有品牌图形，而是说明图形应短、克制，并且不能让用户等待一个与真实首页完全无关的宣传片。若未来迁移 iOS，需优先保证 launch screen 与首页的背景、方向、主要图形位置一致，再考虑品牌动画是否应在首帧之后作为 onboarding 或短暂过渡出现。

### Flutter/跨端启动衔接

Flutter 官方建议正常主题使用与 Flutter UI 主背景相近的纯色，因为 launch screen 消失后、方向变化或 Activity 恢复时，正常主题可能短暂显示。对于需要继续初始化的应用，官方还给出“保留 Android launch screen 最后一帧，并让 Flutter 首帧复现相同位置”的做法，以避免闪烁；示例也展示了可直接移除系统退出动画，防止相似首帧之间重复淡出。[Flutter 官方 Android splash screen 文档](https://docs.flutter.dev/platform-integration/android/splash-screen)

虽然观己当前不是 Flutter，但“启动最后一帧和 WebView 第一帧建立视觉接缝”的原则同样适用：颜色、图形位置、透明度和退出时机要统一，避免原生淡出一次、WebView 再淡入一次。

## 二、动效时长与节奏依据

Material motion 强调运动要快速、清晰、连贯。其移动端常用时长为：大而复杂的全屏转场约 300–400ms，小动效约 150–200ms；元素进入屏幕约 225ms，离开屏幕约 195ms，超过 400ms 的常规转场容易让人感觉迟缓。[Material — Duration & easing](https://m1.material.io/motion/duration-easing.html)

Material 对曲线的定义也适合开屏：

- 进入/落位：减速曲线（ease-out），元素以较高初速度进入，再平滑停住；CSS 参考 `cubic-bezier(0, 0, 0.2, 1)`。
- 离开/淡出：加速曲线（ease-in），元素逐渐离开，不需要在不可见终点慢慢刹车；CSS 参考 `cubic-bezier(0.4, 0, 1, 1)`。
- 同一表面发生位置和尺寸联动时使用标准曲线；不要让多个元素朝不同方向同时穿越，避免焦点分裂。

[Material — Motion](https://m1.material.io/motion/material-motion.html) 还指出，好的动效应表达空间层级和关系，同时不让用户等待；同一产品应保持速度、响应和意图的一致性。对观己来说，开屏应该延续项目已有卡片/页面转场的节奏，而不是另造一套“品牌片头”的动效语言。

## 三、主流产品的一手资料与可借鉴点

以下资料是产品或其品牌/开发者官方资料。它们大多没有公开“App 冷启动开屏动画精确时长”，因此这里不把未公开的内容推断成事实，而只提取可验证的行为与规则。

### Google：把标志拆成可表达状态的过渡形态

Google Design 官方介绍其品牌系统时，将四个动态圆点定义为标志在互动、辅助和过渡时刻的动态形态；圆点虽然看似自发运动，但路径和 timing 有统一规则，并采用简洁的缓动。官方还强调品牌标志要能在不同尺寸和设备上工作，并通过产品、工程和研究团队测试可行性。[Google Design — Evolving the Google Identity](https://design.google/library/evolving-google-identity?submit=Search)

Google 的 Material 品牌文章进一步建议，标志适合用于 launcher sequence、splash screen 和短暂的 app bar 场景，但不应妨碍交互；标志形态可以在进入产品后缩小或转为更紧凑的 mark，同时应把交互和动效系统化。[Google Design — Staying true to your identity](https://design.google/library/staying-true-to-your-identity-material-branding)

可借鉴到观己：不要堆叠多个装饰阶段；把“两片玻璃切片”作为一个可识别的过渡状态，使用固定路径和统一 timing，结束后收敛为首页可见的品牌图形。

### Netflix：标志保护优先于装饰效果

Netflix 官方品牌资源明确要求 N Symbol 保持标准色、清晰留白和足够对比度，并列出不要拉伸、旋转、改变颜色、添加效果、置于繁杂背景等禁用做法；其文档也说明高认知场景可以只使用 N Symbol，但需保证品牌识别和清晰度。[Netflix Brand Assets — Logos](https://brand.netflix.com/en/assets/logos/?RewriteStatus=1&library=true)

该资料没有公开 Netflix App 冷启动的具体动画参数，所以不能据此声称 Netflix 使用了某个固定时长。可验证的启发是：开屏品牌图形应首先保证比例、清晰区和对比度；玻璃材质可以有层次，但不能靠强阴影、过度高光或动态模糊掩盖轮廓。

### Spotify：运动必须可访问、可关闭，品牌必须有安全区

Spotify 官方开发者无障碍指南指出，动画可能诱发癫痫、恶心或头痛；应遵守每秒不超过三次闪烁的 WCAG 建议，并让用户能够暂停、停止或隐藏动画，对滚动触发的动画提供减少或关闭机制。[Spotify for Developers — Accessibility Guidelines](https://developer.spotify.com/documentation/accessibility)

Spotify 官方品牌/开发者指南还要求 logo 与 icon 保持清晰的 exclusion zone，避免低对比度、繁杂背景、拉伸和旋转，并定义最小尺寸与颜色使用规则。[Spotify for Developers — Design & Branding Guidelines](https://developer.spotify.com/documentation/design?nab=1)

Spotify 的官方广告技术规范虽然不是 App 启动规范，但明确建议动画优先使用 `transform`、`scale`、`rotation` 和 `opacity` 等硬件加速属性，避免动画化 `box-shadow` 等容易造成高 CPU/低 FPS 的属性。[Spotify Ads — Homepage Takeover Specs](https://ads.spotify.com/en-NL/ad-experiences/homepage-takeover-specs/)

可借鉴到观己：开屏玻璃质感不应依赖连续 blur、box-shadow 或闪光动画；用静态渐变/高光绘制材质，动画只改变位置、缩放和透明度。设置系统减少动态效果时，停掉品牌图形移动，仅做短淡出。

## 四、针对观己当前问题的设计诊断

### 1. “太简陋”通常不是元素少，而是缺少动效叙事

一个只有“图标轻微缩放 + 整体淡出”的开屏，会让用户感到图标在等待，而不是完成了一个有意义的转场。观己更适合使用单一叙事：两片玻璃切片从轻微错位进入稳定关系，随后保留静态材质 1 个短瞬间，再与首页第一帧衔接。

### 2. “结束不顺”主要是首帧不一致，而不只是时长问题

若原生 SplashScreen 在固定 500ms 或固定延迟后直接消失，而 WebView 此时仍在加载、背景色不同、内容布局尚未稳定，就会出现白闪、瞬移或空窗。应让 WebView 在完成必要的本地数据加载并绘制首页第一帧后发出 ready 信号；如果 ready 更早，允许动画被舒适地截断；如果更晚，保持静态品牌帧，不重复显示加载器。

### 3. 冷启动、温启动、热启动不应都播放同一段片头

Android 原生规范明确 SplashScreen 主要出现在冷启动和温启动，热启动不显示。返回后台时不应人为重放完整品牌片头，否则会放大“每次打开都被拦住”的感觉。首页和记录页的状态也要直接恢复，不能因为开屏动画而重置用户上下文。

## 五、推荐给观己的可执行设计方案

### 动画序列（建议区间，不是硬编码结论）

| 阶段 | 建议时长 | 画面 | 设计意图 |
| --- | ---: | --- | --- |
| 系统进入 | 系统控制 | 纯色背景 + 安全区图形 | 不重复模拟系统启动 |
| 切片归位 | 300–450ms | 两片切片沿同一主轴轻微错位后归位，使用 ease-out | 建立品牌图形与材质关系 |
| 材质停留 | 80–150ms | 静态玻璃层次，高光不闪烁 | 给用户识别时间，不延长等待 |
| 首帧衔接 | 195–225ms | 与首页同色背景交叉淡出，可伴随极小幅度透明度/缩放变化 | 消除白闪和双重淡出 |

整个可见品牌动画尽量不超过 1,000ms，并允许在首页 ready 后提前结束。超过 1 秒仍未 ready 时，不要继续增加复杂运动；保持静态安全帧，同时把非首屏初始化移到后台。

### 图形与安全区

- 保留 01-C 两片玻璃切片的几何比例，使用 Android 专用矢量 drawable/AnimatedVectorDrawable。
- 内部图形为安全区内的主体，不把 launcher adaptive icon 的 mask、背景或整张成品 bitmap 原样嵌套到 SplashScreen。
- 保持浅色/深色背景与首页首帧一致，背景为不透明纯色；玻璃高光和阴影只作为静态绘制层。
- 对所有目标密度、Android 12+ 系统遮罩以及魅族等定制系统做截图对比，检查中心位置、视觉占比和清晰度。

### 首帧衔接与启动性能

- 原生 SplashScreen 只等待必要的本地首屏状态：记录数据、主题、首页基础统计等。
- WebView 首页第一次 `renderHome()` 且背景/首屏结构稳定后，向原生发送 ready 信号。
- 不等待 AI 洞察、WebDAV、网络请求、小组件同步或非首屏资源。
- 记录 TTID、TTFD 和开屏退出时间；冷启动、温启动、热启动分开测试。Android 官方提供 `Displayed`/`reportFullyDrawn` 等测量方式，可结合 `adb shell am start -S -W` 做回归。
- 不用固定 `sleep` 作为正常退出条件。可保留较长兜底，仅用于防止异常初始化永久遮挡；兜底触发时仍应退出到可用的基础首页。

### Reduced Motion / 动效降级

Apple 官方建议在 Reduce Motion 开启时减少或替换缩放、旋转、多轴移动、深度和模糊等效果；对表达层级关系的转场，可以改用淡入淡出，而不是完全删除信息。[Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

观己建议：

- 系统减少动态效果/动画时长为 0 时：静态显示专用图形，不播放切片移动、缩放、模糊或闪光，仅保留约 120–160ms 的短淡出。
- 默认动效不使用连续闪烁、旋转、视差或重复循环。
- 可在设置中提供“减少开屏动效”而非另造独立强制开关；优先响应系统偏好。
- 无障碍状态下仍然保持 logo、背景与首页首帧的视觉连续性。

## 六、验收清单

### 视觉

- [ ] 首帧背景与首页背景无可见色差。
- [ ] 两片玻璃切片比例、中心位置、留白在 Android 12+ 和定制系统上稳定。
- [ ] 高光不闪烁，阴影不产生连续重绘；图形在动画中不出现拉伸或二次变形。
- [ ] 退出时没有“原生淡出一次 + WebView 再淡入一次”的双重接缝。

### 行为

- [ ] 冷启动、温启动播放短序列；热启动不强制重播片头。
- [ ] 首页首帧 ready 后立即进入，不因 AI、WebDAV、小组件或网络阻塞。
- [ ] ready 早于动画结束时可以自然跳过；ready 较晚时保持静态安全帧，不显示第二个 spinner。
- [ ] 从后台返回时保留用户上一页/滚动位置等状态。
- [ ] Reduce Motion 开启时只保留静态图形和短淡出。

### 性能

- [ ] 使用矢量/AVD 和 `transform`、`opacity` 等低成本属性，避免动画化 blur、box-shadow 和大 bitmap。
- [ ] 记录 TTID、TTFD、冷/温/热启动中位数，以及退出动画实际耗时。
- [ ] 低端 Android 真机连续冷启动至少 5 次，检查掉帧、卡顿、ANR 和系统杀进程后的恢复。
- [ ] 在构建验收中确认资源、版本、真机安装包与浏览器首帧回归一致。

## 研究限制

本调研只使用 Android/Apple/Flutter/Material 以及 Google、Netflix、Spotify 的官方资料。Netflix、Spotify 和 Google 的公开资料没有提供可直接复核的“当前 App 冷启动动画精确时长”，因此文档没有把市场产品的未公开实现写成事实。上面的 195–225ms、300–450ms 等是把官方 Material/Android 区间映射到观己的设计建议，需要通过当前项目真机测试和启动指标进一步校准。
