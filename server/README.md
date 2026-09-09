# Guanji Thesis Backend

这是 #222 为毕设版预留的本地 Spring Boot + PostgreSQL 骨架，不属于发行版运行时。

## 运行边界

- 仅绑定本地电脑所在局域网，默认端口 `8080`。
- 当前只提供 `/health` 健康检查与模块/数据库迁移骨架。
- 原始行为记录、精确时间、备注和完整观察组合不会上传。
- 反馈、公告、聚合统计快照、审核和审计模块在后续 #233–#252 节点逐步实现。

## 环境准备与启动

项目提供本地环境脚本：

1. JDK 21：默认使用 `C:\Users\43124\Android\jdk-21`。
2. Maven 3.9.11：首次运行时下载到 `%LOCALAPPDATA%\Guanji\tools`，不污染仓库。
3. PostgreSQL 15：通过 Docker Compose 启动，数据保存在 Docker volume `guanji-thesis-pgdata`。

首次准备环境：

```powershell
./scripts/setup-local.ps1
```

启动后端（会自动确保数据库已启动）：

```powershell
./scripts/start-local.ps1
Invoke-RestMethod http://localhost:8080/health
```

连接信息只从 `GUANJI_DB_URL`、`GUANJI_DB_USER`、`GUANJI_DB_PASSWORD` 环境变量读取；本地密码写入 `server/.env.local`，该文件不提交。

手机局域网演示时，将 `localhost` 换成运行本服务电脑的局域网 IPv4 地址，例如：

```text
http://192.168.x.x:8080/health
```

手机和电脑必须连接同一局域网；如果 Windows 防火墙拦截 8080 端口，需要只为“专用网络”放行该端口，不要暴露到公网。

停止数据库：

```powershell
docker compose --env-file .env.local -f compose.yaml down
```

发行版不使用此后端；该环境仅服务于 thesis build variant 和毕业设计演示。
