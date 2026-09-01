# 设备绑定当前记录语义

## 权威时间

`effective_date` 是绑定的业务生效时间。`created` 和 `updated` 只表示数据库技术元数据，不代表绑定业务发生时间；尤其是结束旧绑定时，`updated` 会被改写，因此不能参与当前绑定的业务排序。

对同一设备，当前记录按以下规则选择：

1. 只考虑 `effective_date` 合法且不晚于当前时间的记录。
2. 按 `effective_date` 降序选择第一条。
3. `effective_date` 相同时，依次按 `approved_at`、`created`、`id` 降序决胜。
4. 选出业务优先级最高的记录后，才解释它的状态；不能先过滤 ACTIVE，也不能在结束记录后回退旧 ACTIVE。

未来生效的记录在生效前不会覆盖当前记录。若存在至少一条合法 `effective_date`，缺失或非法日期的记录不能覆盖合法记录。只有同一设备的所有记录都没有合法 `effective_date` 时，才按 `approved_at` → `created` → `id` 做遗留兼容，并产生聚合 warning。

## 状态兼容

以下值表示当前有效：`已绑定`、`ACTIVE`、`active`，比较前去除首尾空格。

以下值表示当前未绑定：`已解绑`、`ENDED`、`ended`、`INACTIVE`、`inactive`，比较前去除首尾空格。

空值和未知值都不算有效；未知值按未绑定处理，同时生成聚合 warning。管理端和 OSS Scanner 都使用 `shared/device-binding-semantics.js`，因此不依赖 PocketBase API 返回顺序，也不使用设备上的 `current_employee/current_store` 镜像字段作为权威来源。

## 音频归属

Scanner 的绑定缓存保存 PocketBase 的 `device`、`employee`、`store` relation id。ASR metadata 中的 `device` 仍保存文件名解析得到的物理 Badge SN，二者不能混用。

新建 `audio_files` 时，若当前映射存在就写入 relation；提交成功或 stale/failed submitting 重试成功时，用同一映射补写 relation。没有合法映射时省略 relation 字段，不写伪造值。已经处于 `submitted` 或 `transcribed` 的历史记录不回填，也不能简单用当前 ACTIVE 绑定解释历史录音。

历史回填如有需要，必须以录音的 `started_at/occurred_at` 构造有效绑定时间线，处理缺失结束时间，先 dry-run 并由业务批准后再写入。

## 后续模型建议

后续可增加明确的 `ended_at` 与正式 binding event，记录申请、审批、生效和结束事件，避免仅依赖快照记录推断历史时间线。
