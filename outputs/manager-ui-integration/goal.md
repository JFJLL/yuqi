# 启动 Goal

在 `D:\download\pic-vec\yuqi` 中完成“经理版管理后台 + 原生微信小程序 + 培训中心”整合。

先完整阅读：

1. `outputs/manager-ui-integration/spec.md`
2. `outputs/manager-ui-integration/handoff.md`
3. `outputs/manager-ui-integration/tickets/` 下全部 Ticket
4. 当前会话生效的 AGENTS 指令；若仓库根目录存在 `AGENTS.md`，再完整读取该文件

不要把经理项目的 Python/SQLite/静态后台直接复制进来。当前项目是技术底座；经理项目是前端展示、信息架构和功能入口的产品基准。保留当前人工复核、整改、申诉、租户和数据范围等更完整能力。

先检查仓库最新状态和其他会话已完成的 Ticket，再只派发当前无阻塞且文件责任区不冲突的任务。初始 frontier 是：

- Ticket 01：管理后台壳、导航与工作总览
- Ticket 02：微信手机号登录与原生小程序基础

两者可并行。每完成一个 Ticket，按依赖图重新计算 frontier。执行者必须返回改动文件、接口/数据契约、测试结果、浏览器或小程序截图和遗留风险；失败时继续修复根因。最终 Ticket 17 负责整合、全量验证、同视口视觉对比和 fresh-context `$code-review`，审查问题修完并复审后才算完成。
