# Yuqi OSS 自动采集部署说明

本说明只涉及 **Yuqi 云服务器**。目标：胸牌录音由厂商平台直传我方 OSS 后，`yuqi-oss-scanner` 定时扫描新文件，自动经 frp 提交 ASR 转写，结果写入 PocketBase 并在「录音转写」页展示。

```text
胸牌 → 厂商平台 → OSS(redmagic/audio/)
                      │ yuqi-oss-scanner 每 5 分钟 ListObjects
                发现新 .mp3 → audio_files 登记(幂等)
                      │ 流式下载，不落盘
                frp 127.0.0.1:18082 → ASR /v1/jobs
                      │
                transcripts(source=oss_auto) + asr_jobs
                      │ yuqi-asr-gateway 既有轮询回写结果
                「录音转写」页显示文字与「自动采集」标签
```

## 1. 前置条件

1. 厂商平台「开发设置 → 录音推送配置」已选 `oss`，请求地址 `https://oss-cn-beijing.aliyuncs.com`，Bucket `redmagic`，**推送路径填 `audio/`**。
2. frp 回环链路可用：`curl -fsS http://127.0.0.1:18082/health` 返回正常。
3. `yuqi-asr-gateway` 已按 `deploy/ASR_GATEWAY.md` 部署并运行。

## 2. 配置环境文件

在现有 `deploy/asr-gateway.env`（不进 Git）中追加：

```dotenv
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET=redmagic
OSS_PREFIX=audio/
OSS_ACCESS_KEY_ID=<你的 AccessKey ID>
OSS_ACCESS_KEY_SECRET=<你的 AccessKey Secret>
SCAN_INTERVAL_MS=300000
```

> 安全建议：优先创建仅该 Bucket 只读权限（ListObjects/GetObject）的 RAM 子账号。若使用主账号 AK，务必保证该文件 `chmod 600` 且永不提交 Git、不写入前端或文档。

可选调优项（默认值见 `deploy/asr-gateway.env.example`）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `SCAN_INTERVAL_MS` | 300000 | 扫描间隔 |
| `SCANNER_MAX_SUBMITS_PER_CYCLE` | 20 | 单轮最多提交的新文件数 |
| `SCANNER_MAX_SUBMIT_RETRIES` | 2 | 提交失败自动重试次数，超过标记 dead |
| `SCANNER_MAX_ASR_ATTEMPTS` | 3 | ASR 转写失败的最大执行次数（含首次），超过后需人工重试 |
| `SCANNER_RETRY_BACKOFF_BASE_MS` | 600000 | 提交失败重试的基础退避（按次数递增） |

## 3. 构建与启动

```bash
cd /home/red/work/moneyboost/yuqi   # 按实际项目路径
git pull                             # 或同步本次改动文件

pnpm install --frozen-lockfile
pnpm build                           # 前端新增了“来源”列

set -a
. ./deploy/asr-gateway.env           # 加载含 OSS_* 的环境
set +a
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
```

PM2 会新增第三个进程 `yuqi-oss-scanner`。PocketBase 重启时自动创建 `audio_files` 集合（object_key 唯一索引），并为 `transcripts` 补充 `source` 字段，无需手工迁移。

## 4. 验证链路

```bash
# 1) 进程状态：三个进程均 online
pm2 status

# 2) 扫描器日志：应看到“扫描完成：OSS 命中 N 个音频”
pm2 logs yuqi-oss-scanner --lines 50

# 3) 登记情况：audio_files 应出现 audio/ 下的文件
curl -s "http://127.0.0.1:7040/api/audio_files?perPage=5" | head -c 2000

# 4) 等待转写完成后，检查 transcripts 的 source 字段
curl -s "http://127.0.0.1:7040/api/transcripts?sort=-created&perPage=3" | grep -o '"source":"[a-z_]*"'
```

页面验证：登录后台 →「录音转写」，新记录应带蓝色「自动采集」标签；旧的手动上传记录显示灰色「手动上传」。转写完成后点「查看文本」确认内容正常。

## 5. 行为说明

- **存量补转**：首次运行会把 `audio/` 前缀下所有历史录音排队提交（单轮最多 20 个，约每 5 分钟一轮），FunASR 逐段消化，几十段大约 1~2 小时跑完，属预期行为。
- **归属映射**：按文件名中的设备 SN 匹配 `devices` 与 `device_bindings`（状态=已绑定）得到员工/门店；查不到时照常转写，归属留空，可后续在后台补录绑定后重新提交。
- **失败处理**：
  - 提交失败（下载/OSS/网络）：自动重试 2 次（间隔 10/20 分钟），仍失败标记 `dead`；
  - ASR 转写失败：自动重试至多 3 次执行，之后可在「录音转写」页手动重试；
  - `dead` 或超限的记录可通过删除对应 `audio_files` 记录触发下轮重新采集。
- **幂等**：以 OSS object key 为唯一键，重复扫描不会重复转写。
- **时间字段**：录音开始/结束时间取自文件名（北京时间），入库统一为 UTC，与其他记录一致。

## 6. 停用 / 回滚

```bash
pm2 stop yuqi-oss-scanner && pm2 save    # 停止自动采集，手动上传链路不受影响
pm2 delete yuqi-oss-scanner              # 彻底移除进程
```

`audio_files` 集合仅作登记，停止扫描器后不影响任何既有功能。
