# SQLCipher Community Edition 准入清单

这是 #221 P0-L 的准入契约，不表示 Room 已经切换为发行版权威存储。

## 候选依赖与许可证

- 依赖身份锁定为 `net.zetetic:sqlcipher-android` 的 Community Edition；禁止误用弃用的 `android-database-sqlcipher`、Trial 或 Commercial 包。
- Community Edition 可用于闭源/商业应用，但必须在“我的 → 关于观己 → 开源软件许可”和 GitHub Release 材料中提供完整许可证、版权和实际依赖声明。
- 依赖版本、校验和、许可证文本和传递依赖必须进入 SBOM；在供应链检查完成前不合并为发行版运行时依赖。

## 密钥边界

```text
现有随机 DEK（Keystore 信任根）
        ↓ HKDF-SHA256
guanji-room-sqlcipher-v1
        ↓
Room/SQLCipher 专用数据库密钥
```

原始 DEK 不直接作为 SQLCipher 口令；记录加密、备份加密和数据库加密保持独立边界。密钥派生参数必须版本化并可迁移。

## 技术准入矩阵

在 #223 Room 影子库写入前，以下项目必须逐项留证并全部通过：

| 类别 | 最低要求 |
| --- | --- |
| 平台 | API 23+，ARM64 及项目实际支持 ABI |
| 真机 | 魅族 Flyme 冷启动、读写、返回、异常退出恢复 |
| 数据 | v3.53/v3.87 迁入后数量、字段、日期、加密状态一致 |
| 数据库 | WAL、事务、回滚、重复启动幂等、损坏/错误密钥不生成空库 |
| 性能 | 冷启动、首次打开、批量迁移、增量写入和 APK 体积基线 |
| 安全 | DEK 派生、错误密钥、密钥失效、备份恢复和敏感日志检查 |

未通过时保留字段级 AES-GCM 备用路线，但不得在未明确明文索引字段、nonce、轮换、增量统计策略前直接切换。

