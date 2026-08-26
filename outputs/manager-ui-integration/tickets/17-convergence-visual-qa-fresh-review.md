# Ticket 17：整合收口、视觉 QA 与 fresh-context 审查

## Outcome

所有模块成为一个一致、可演示、可测试的产品：经理版前端和功能入口完整，当前项目的安全闭环未回退，重复/占位入口被清理。

## Blockers

Ticket 03、Ticket 04、Ticket 05、Ticket 06、Ticket 07、Ticket 08、Ticket 09、Ticket 10、Ticket 11、Ticket 12、Ticket 13、Ticket 14、Ticket 15、Ticket 16。

## Scope

- 整合各 Ticket，处理路由、样式、schema、接口和迁移冲突。
- 删除面向用户的重复导航、旧占位页和已被替代的死路径；不得删除仍被依赖的数据或能力。
- 用经理截图相同视口逐页对比全部 12 个模块：登录、首页、区域门店、员工店长、设备、录音、巡检、申诉、员工业务记录、报表、权限、系统参数和审计。
- 验证 loading、empty、error、forbidden、键盘焦点、对比度和表格关键操作。
- 走一次录音→转写→AI 疑似→人工复核→整改/申诉，以及问题→培训→学习→考试全链路。
- 使用全新上下文执行 `$code-review`；修复所有有效问题后重新审查。

## Ownership

作为最终集成所有者，可修改全仓库，但必须保留其他 Ticket 的有效工作和迁移历史；禁止用回滚或跳过验证消除冲突。

## Acceptance

1. Spec 的 12 个后台模块和小程序目标流程均可从正式导航到达，无虚假成功和无说明占位。
2. 全部模块逐页完成同视口对比；经理版结构、信息密度和交互入口达到可辨认的一致，差异有明确产品或可访问性理由。
3. 租户、数据范围、员工本人隔离、人工复核门禁、并发和 secret 检查无回归。
4. `rtk pnpm verify` 及项目已有 smoke/构建通过；小程序通过项目可用的 `miniprogram-ci` 编译检查。
5. fresh-context 审查无未处理的有效高/中风险问题。

## Evidence

返回最终页面/接口/迁移清单、两条 E2E 证据、全量命令结果、全部模块的同视口前后对比截图、可访问性检查、fresh review 结论和剩余非阻塞限制。

## Verification

依次运行项目既有定向测试、浏览器与小程序 smoke、`rtk pnpm verify`；再执行 fresh-context `$code-review`，修复后重复相同门禁。不得跳过、削弱或伪造结果。
