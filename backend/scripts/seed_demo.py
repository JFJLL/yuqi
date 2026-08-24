"""幂等演示数据 seed (开发/测试环境专用).

用法:
  python scripts/seed_demo.py            # 默认数据库 (见 .env)
  python scripts/seed_demo.py --tenant demo --admin-username admin --admin-password 'ChangeMe-2026!'

安全规则:
- 生产 (ENV=prod) 或未显式 ALLOW_DEMO_SEED=true 时拒绝执行
- 不绕过真实数据库/API/权限: 直接写库, 但账号密码走真实 Argon2id 哈希
- 可重复执行, 不产生重复数据 (按 code/username/issue_no 幂等)
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import get_session_factory, init_engine  # noqa: E402
from app.models.auth import Tenant, User  # noqa: E402
from app.models.device import Device, DeviceBinding  # noqa: E402
from app.models.issue import Issue, Rectification, RiskRule, RiskRuleVersion, RiskSegment  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.org import Employee, OrganizationNode, Store  # noqa: E402
from app.models.recording import AudioFile, Conversation, TextVersion, TranscriptSegment  # noqa: E402
from app.models.setting import AppSetting  # noqa: E402
from app.modules.rbac.bootstrap import materialize_tenant_roles  # noqa: E402

DEMO_RULES = [
    {
        "code": "R-OVERPROMISE",
        "name": "夸大疗效",
        "category": "夸大疗效表达",
        "severity": "高",
        "keywords": ["重点介绍", "包治", "根治", "绝对有效", "百分百治愈"],
        "description": "禁止夸大药品疗效、承诺治愈效果。",
        "advice": "复核员工话术, 安排药品话术规范培训。",
    },
    {
        "code": "R-RX-CHECK",
        "name": "处方药核验缺失",
        "category": "处方药合规",
        "severity": "高",
        "keywords": ["阿莫西林", "头孢", "处方药", "凭处方"],
        "description": "销售处方药时必须核验处方。",
        "advice": "确认员工是否核验处方, 补充处方药销售流程培训。",
    },
    {
        "code": "R-COMBO-RISK",
        "name": "联合用药风险",
        "category": "联合用药风险",
        "severity": "高",
        "keywords": ["一起吃", "搭配服用", "同时服用", "叠加"],
        "description": "联合用药必须核对相互作用禁忌。",
        "advice": "复核联合用药场景, 培训配伍禁忌查询流程。",
    },
    {
        "code": "R-CONTRAINDICATION",
        "name": "基础疾病询问缺失",
        "category": "基础疾病询问缺失",
        "severity": "中",
        "keywords": ["过敏史", "高血压", "糖尿病", "孕妇"],
        "description": "销售前必须询问过敏史与基础疾病。",
        "advice": "提醒员工主动询问过敏史与基础疾病。",
    },
    {
        "code": "R-PRICE-CLAIM",
        "name": "价格承诺",
        "category": "价格行为",
        "severity": "中",
        "keywords": ["最低价", "全网最低", "打折", "优惠力度"],
        "description": "禁止绝对化价格承诺。",
        "advice": "提醒员工避免绝对化用语。",
    },
    {
        "code": "R-SERVICE",
        "name": "服务态度问题",
        "category": "服务态度问题",
        "severity": "低",
        "keywords": ["爱买不买", "随便", "别烦我", "自己看"],
        "description": "禁止消极怠慢服务用语。",
        "advice": "安排服务话术与服务意识培训。",
    },
    {
        "code": "R-MEDICARE",
        "name": "医保违规话术",
        "category": "医保合规",
        "severity": "高",
        "keywords": ["医保刷", "套现", "代刷医保", "医保卡借"],
        "description": "禁止医保套现、借用等违规话术。",
        "advice": "严肃处理并复训医保政策。",
    },
    {
        "code": "R-SCOPE",
        "name": "超范围经营宣传",
        "category": "超范围经营",
        "severity": "中",
        "keywords": ["处方药网购", "远程开方", "代购药品", "海外代购"],
        "description": "禁止宣传超出经营范围的服务。",
        "advice": "核对经营范围并培训合规宣传。",
    },
]


async def seed(tenant_code: str, admin_username: str, admin_password: str) -> None:
    settings = get_settings()
    if settings.is_prod:
        raise SystemExit("X 生产环境禁止执行 seed (ENV=prod)")
    if not settings.allow_demo_seed and settings.database_url.startswith("postgresql"):
        raise SystemExit("X ALLOW_DEMO_SEED 未开启, 拒绝执行 (演示数据仅限开发/测试)")

    init_engine(settings)
    factory = get_session_factory()
    now = datetime.now(UTC)
    async with factory() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.code == tenant_code))
        if tenant is None:
            tenant = Tenant(code=tenant_code, name="演示租户(测试数据)", is_demo=True)
            session.add(tenant)
            await session.flush()
            print(f"+ tenant {tenant_code}")
        await materialize_tenant_roles(session, tenant)

        admin = await session.scalar(
            select(User).where(User.tenant_id == tenant.id, User.username == admin_username)
        )
        if admin is None:
            admin = User(
                tenant_id=tenant.id,
                username=admin_username,
                display_name="平台管理员",
                password_hash=hash_password(admin_password),
                is_super_admin=True,
            )
            session.add(admin)
            print(f"+ admin {admin_username} (演示账号)")

        # ---- 组织树: 总部 → 2 区域 → 4 门店 ----
        hq = await session.scalar(
            select(OrganizationNode).where(OrganizationNode.tenant_id == tenant.id, OrganizationNode.code == "HQ1")
        )
        if hq is None:
            hq = OrganizationNode(tenant_id=tenant.id, node_type="HQ", name="总部", code="HQ1")
            session.add(hq)
            await session.flush()
            print("+ org HQ")
        region_specs = [("R-EAST", "华东"), ("R-SOUTH", "华南")]
        regions: dict[str, OrganizationNode] = {}
        for code, name in region_specs:
            region = await session.scalar(
                select(OrganizationNode).where(
                    OrganizationNode.tenant_id == tenant.id, OrganizationNode.code == code
                )
            )
            if region is None:
                region = OrganizationNode(tenant_id=tenant.id, parent_id=hq.id, node_type="REGION", name=name, code=code)
                session.add(region)
                await session.flush()
                print(f"+ region {name}")
            regions[code] = region

        store_specs = [
            ("S-A", "A 店", "R-EAST"),
            ("S-B", "B 店", "R-EAST"),
            ("S-C", "C 店", "R-SOUTH"),
            ("S-D", "D 店", "R-SOUTH"),
        ]
        stores: dict[str, Store] = {}
        for code, name, region_code in store_specs:
            store = await session.scalar(
                select(Store).where(Store.tenant_id == tenant.id, Store.code == code)
            )
            if store is None:
                store = Store(
                    tenant_id=tenant.id,
                    node_id=regions[region_code].id,
                    name=name,
                    code=code,
                    address=f"演示地址-{name}",
                )
                session.add(store)
                await session.flush()
                print(f"+ store {name}")
            stores[code] = store

        # ---- 员工 (每人绑一个账号, EMPLOYEE 角色) ----
        emp_specs = [
            ("E001", "店员甲", "13800000001", "S-A"),
            ("E002", "店员乙", "13800000002", "S-A"),
            ("E003", "店员丙", "13800000003", "S-B"),
            ("E004", "店员丁", "13800000004", "S-C"),
        ]
        employees: dict[str, Employee] = {}
        for no, name, mobile, store_code in emp_specs:
            emp = await session.scalar(
                select(Employee).where(Employee.tenant_id == tenant.id, Employee.employee_no == no)
            )
            if emp is None:
                store = stores[store_code]
                emp = Employee(
                    tenant_id=tenant.id,
                    employee_no=no,
                    name=name,
                    mobile=mobile,
                    store_id=store.id,
                    organization_node_id=store.node_id,
                )
                session.add(emp)
                await session.flush()
                print(f"+ employee {name}")
            employees[no] = emp

        # ---- 规则库 (含版本快照) ----
        rules: dict[str, RiskRule] = {}
        for spec in DEMO_RULES:
            rule = await session.scalar(
                select(RiskRule).where(RiskRule.tenant_id == tenant.id, RiskRule.code == spec["code"])
            )
            if rule is None:
                rule = RiskRule(
                    tenant_id=tenant.id,
                    code=spec["code"],
                    name=spec["name"],
                    category=spec["category"],
                    severity=spec["severity"],
                    keywords=spec["keywords"],
                    description=spec["description"],
                    enabled=True,
                    version_no=1,
                )
                session.add(rule)
                await session.flush()
                session.add(
                    RiskRuleVersion(
                        tenant_id=tenant.id,
                        rule_id=rule.id,
                        version_no=1,
                        snapshot={"name": spec["name"], "keywords": spec["keywords"], "severity": spec["severity"]},
                        change_note="初始版本",
                    )
                )
                print(f"+ rule {spec['code']}")
            rules[spec["code"]] = rule

        # ---- 录音 / 会话 / 片段 / 文本版本 ----
        conv_specs = [
            ("E001", "S-A", "顾客您好，这个药重点介绍了阿莫西林胶囊，效果很好。", 3),
            ("E003", "S-B", "这款产品是全网最低价，错过今天就没有了。", 1),
            ("E004", "S-C", "麻烦出示一下处方，需要核验后购买。", 0),
        ]
        for emp_no, store_code, text, days_ago in conv_specs:
            emp = employees[emp_no]
            store = stores[store_code]
            audio = await session.scalar(
                select(AudioFile).where(
                    AudioFile.tenant_id == tenant.id,
                    AudioFile.employee_id == emp.id,
                    AudioFile.store_id == store.id,
                )
            )
            if audio is None:
                occurred = now - timedelta(days=days_ago, hours=2)
                audio = AudioFile(
                    tenant_id=tenant.id,
                    file_name=f"rec-{emp_no}-{days_ago}.wav",
                    object_key=f"demo/{tenant.code}/{emp_no}/{occurred.date()}/rec.wav",
                    size_bytes=1024 * 512,
                    duration_ms=180_000,
                    device_code="WF-DEMO-001",
                    employee_id=emp.id,
                    store_id=store.id,
                    occurred_at=occurred,
                    status="SUCCEEDED",
                )
                session.add(audio)
                await session.flush()
                conv = Conversation(
                    tenant_id=tenant.id,
                    audio_file_id=audio.id,
                    store_id=store.id,
                    employee_id=emp.id,
                    device_code="WF-DEMO-001",
                    started_at=occurred,
                    ended_at=occurred + timedelta(minutes=3),
                    summary=text[:40],
                    full_text=text,
                    status="READY",
                    current_version=1,
                )
                session.add(conv)
                await session.flush()
                session.add(
                    TranscriptSegment(
                        tenant_id=tenant.id,
                        conversation_id=conv.id,
                        version_no=1,
                        segment_no=1,
                        speaker="staff",
                        start_ms=0,
                        end_ms=180_000,
                        text=text,
                    )
                )
                session.add(
                    TextVersion(
                        tenant_id=tenant.id,
                        conversation_id=conv.id,
                        version_no=1,
                        full_text=text,
                        summary=text[:40],
                        segments_json=[{"text": text, "start_ms": 0, "end_ms": 180_000, "speaker": "staff"}],
                        source="ASR",
                    )
                )
                audio.conversation_id = conv.id
                print(f"+ conversation {emp_no}/{days_ago}d")

        # ---- 疑似问题 / 风险片段 / 整改 / 通知 ----
        issue_specs = [
            ("ISS-DEMO-001", "E001", "S-A", "R-OVERPROMISE", "高", "顾客您好，这个药重点介绍了阿莫西林胶囊，效果很好。", 3, "PENDING"),
            ("ISS-DEMO-002", "E003", "S-B", "R-PRICE-CLAIM", "中", "这款产品是全网最低价，错过今天就没有了。", 1, "PENDING"),
            ("ISS-DEMO-003", "E004", "S-C", "R-RX-CHECK", "低", "麻烦出示一下处方，需要核验后购买。", 0, "NONE"),
        ]
        for issue_no, emp_no, store_code, rule_code, risk, quote, days_ago, status in issue_specs:
            issue = await session.scalar(
                select(Issue).where(Issue.tenant_id == tenant.id, Issue.issue_no == issue_no)
            )
            if issue is not None:
                continue
            emp = employees[emp_no]
            store = stores[store_code]
            rule = rules[rule_code]
            audio = await session.scalar(
                select(AudioFile).where(
                    AudioFile.tenant_id == tenant.id,
                    AudioFile.employee_id == emp.id,
                    AudioFile.store_id == store.id,
                )
            )
            conv = (
                await session.scalar(
                    select(Conversation).where(Conversation.audio_file_id == audio.id)
                )
                if audio
                else None
            )
            rule_spec = next((s for s in DEMO_RULES if s["code"] == rule_code), {})
            issue = Issue(
                tenant_id=tenant.id,
                issue_no=issue_no,
                conversation_id=conv.id if conv else None,
                audio_file_id=audio.id if audio else None,
                employee_id=emp.id,
                store_id=store.id,
                issue_type=rule.category,
                risk=risk,
                quote=quote,
                advice=rule_spec.get("advice", ""),
                source="ANALYZER",
                occurred_at=now - timedelta(days=days_ago, hours=1),
                due_date=date.today() + timedelta(days=3) if status == "PENDING" else None,
            )
            session.add(issue)
            await session.flush()
            session.add(
                RiskSegment(
                    tenant_id=tenant.id,
                    conversation_id=conv.id if conv else None,
                    issue_id=issue.id,
                    rule_id=rule.id,
                    rule_code=rule.code,
                    rule_name=rule.name,
                    matched_text=quote,
                    matched_keywords=rule.keywords[:2],
                    speaker="staff",
                    start_ms=0,
                    end_ms=180_000,
                    status="PENDING",
                )
            )
            if status == "PENDING":
                rect = Rectification(
                    tenant_id=tenant.id,
                    issue_id=issue.id,
                    employee_id=emp.id,
                    store_id=store.id,
                    title=f"整改-{rule.name}",
                    due_date=date.today() + timedelta(days=3),
                    status="PENDING",
                    progress=0,
                )
                session.add(rect)
                await session.flush()
                session.add(
                    Notification(
                        tenant_id=tenant.id,
                        user_id=admin.id,
                        title="整改任务已派发",
                        body=f"{rule.name}: {quote[:40]}",
                        notif_type="ISSUE_ASSIGNED",
                        ref_type="rectifications",
                        ref_id=str(rect.id),
                    )
                )
            print(f"+ issue {issue_no}")

        # ---- 默认设置 ----
        retention = await session.scalar(
            select(AppSetting).where(AppSetting.tenant_id == tenant.id, AppSetting.key == "retention_days")
        )
        if retention is None:
            session.add(AppSetting(tenant_id=tenant.id, key="retention_days", value="365"))
            print("+ setting retention_days=365")

        await session.commit()
        print(f"OK seed 完成: tenant={tenant.code}, admin={admin_username}, env={settings.env}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", default="demo")
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument("--admin-password", default=os.environ.get("SEED_ADMIN_PASSWORD", "Admin-2026!"))
    args = parser.parse_args()
    asyncio.run(seed(args.tenant, args.admin_username, args.admin_password))


if __name__ == "__main__":
    main()
