# Yuqi ASR 网关部署说明

本说明只涉及 **Yuqi 云服务器**。独立的 `yuqi_asr_service` 保持不变；FunASR 推理继续运行在 ASR 电脑。Yuqi 新增的网关负责接收浏览器上传、通过已建立的 frp 回环入口调用 ASR、轮询任务，并将结果写入 PocketBase。

## 1. 配置已有 frp TCP 回环入口

本机 ASR 服务监听 `127.0.0.1:18083`。现有 frp 代理保持云端端口不变，只把本机目标改为：

```toml
[[proxies]]
name = "asr-web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 18083
remotePort = 18082
```

这样 Yuqi 云服务器上的 frps 会把 `127.0.0.1:18082` 转发到 ASR 电脑的 `127.0.0.1:18083`。云端 `18082` 不应通过 Nginx 或安全组向公网开放；如 frps 配置支持，优先将代理端口绑定到云服务器回环地址。填写 Yuqi 配置前，在云服务器上验证：

```bash
curl -fsS http://127.0.0.1:18082/health
```

## 2. 创建仅在服务器保存的运行环境文件

将 `deploy/asr-gateway.env.example` 复制到不提交 Git 的真实配置文件：

```bash
cp deploy/asr-gateway.env.example deploy/asr-gateway.env
chmod 600 deploy/asr-gateway.env
```

填写以下两个值，其他默认项可先保留：

```dotenv
ASR_BASE_URL=http://127.0.0.1:18082
ASR_SERVICE_TOKEN=<与 ASR 服务相同的随机长 Token>
```

`deploy/asr-gateway.env` 已被 `.gitignore` 忽略。Token 只能保存在该服务器的环境文件中；不得写入 Vite、Nginx、PocketBase 记录、浏览器或 Git。

## 3. 重启服务

PocketBase 启动时会自动创建/升级 `asr_jobs` 与 `transcripts` 的新字段。重启前先构建前端：

```bash
pnpm install --frozen-lockfile
pnpm build
```

以 PM2 启动或更新两个 Yuqi 进程时，需要将环境文件加载到 PM2 环境。例如：

```bash
set -a
. ./deploy/asr-gateway.env
set +a
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

网关只监听 `127.0.0.1:18084`；Nginx 的 `/__asr/` location 将浏览器请求代理到该本机进程。部署 Nginx 配置前执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 验证链路

依次执行下列检查：

```bash
# 网关已取到两项 ASR 环境变量时应返回 status=ok。
curl -fsS http://127.0.0.1:18084/health

# 可选：直接验证 frp 回环链路，health 不要求 ASR Token。
curl -fsS "$ASR_BASE_URL/health"
```

登录 Yuqi 后，在“录音转写”页面上传一个小音频。系统应立即创建 `transcripts` 与 `asr_jobs` 记录，状态从“排队中/转写中”变为“已完成”或“失败”。成功时，网关写入 `transcripts.full_text`、`segments_json`、模型信息及 `sync_logs`；失败时写入脱敏错误摘要，并在表格提供重试操作。

> 若网关健康检查返回 `degraded`，表示 `ASR_BASE_URL` 或 `ASR_SERVICE_TOKEN` 尚未设置；这符合首次代码部署时的预期，不会把空配置当作可用 ASR 服务。
