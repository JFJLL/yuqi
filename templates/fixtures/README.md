# Test Fixtures

冒烟测试 AIGC 链路 (尤其是 RH AI 应用 / 换脸) 时用的"已知好"输入。**不要用 1×1 像素占位图** — RH 检测不到脸会返回 805, 制造假阴性, 浪费一轮排查。

## 文件

- `test-face.jpg` — 真人脸照片, RH 能识别脸部。换脸 / 风格迁移 / 任何"需要人脸输入"的 AI 应用都用这张。
- `test-scene.jpg` — 全身或半身场景图, 适合做换脸目标 (model image)。
- `test-prompt.txt` — 一条已知能过审核的恐怖向 prompt, 用来跑文生图 / 文生视频冒烟。

## 第一次怎么生成

这些 fixture 不入库 (二进制 + 版权风险)。运行时第一次需要时执行:

```bash
bash .claude/scripts/init-fixtures.sh
```

脚本会:

1. 检查 `templates/fixtures/test-face.jpg` 等是否已存在, 已有就跳过
2. 不存在时调本地 PocketBase 的 `/api/aigc/image/generate` 用安全 prompt 生成
   - face: 中性人像
   - scene: 全身夜景
3. 下载产物 URL 落盘到 `templates/fixtures/`
4. 写一个 `test-prompt.txt` 包含已知过审的 prompt

**前置**: PocketBase 在 :7000 已经跑, `pb_hooks` 已有 `/api/aigc/image/generate` 路由 (rh-aigc-integration skill 的标准路由), `RH_API_KEY` 已注入。

如果初始化失败也不要紧 — Claude 直接调用 `/api/aigc/image/generate` 现场生成临时 fixture 即可。
