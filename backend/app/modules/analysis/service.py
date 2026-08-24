"""风险分析服务: 规则库维护 / RiskAnalyzer / 疑似问题复核与整改.

- RuleService: 规则 CRUD + 版本快照
- RiskAnalyzer: 按启用规则扫描会话转写片段 → 风险片段 + 疑似问题
- IssueWorkflow: 人工复核 (通过/驳回) / 关闭 / 推送整改
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.logging import get_logger
from app.models.issue import Issue, Rectification, RiskRule, RiskRuleVersion, RiskSegment
from app.models.recording import Conversation, TranscriptSegment
from app.services.security_context import TenantContext

logger = get_logger("yuqi.analysis")

SEVERITY_LABEL = {"high": "高", "medium": "中", "low": "低"}


class RuleService:
    def __init__(self, session: AsyncSession, ctx: TenantContext) -> None:
        self.session = session
        self.ctx = ctx

    async def list_rules(self, *, page: int, page_size: int, keyword: str, enabled: str) -> tuple[list[RiskRule], int]:
        from sqlalchemy import func

        stmt = select(RiskRule).where(
            RiskRule.tenant_id == self.ctx.tenant_id, RiskRule.deleted_at.is_(None)
        )
        if keyword:
            like = f"%{keyword}%"
            stmt = stmt.where(or_(RiskRule.name.like(like), RiskRule.code.like(like), RiskRule.category.like(like)))
        if enabled == "true":
            stmt = stmt.where(RiskRule.enabled.is_(True))
        elif enabled == "false":
            stmt = stmt.where(RiskRule.enabled.is_(False))
        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (
            (
                await self.session.execute(
                    stmt.order_by(RiskRule.sort_order, RiskRule.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def get_rule_or_404(self, rule_id: uuid.UUID) -> RiskRule:
        rule = await self.session.get(RiskRule, rule_id)
        if rule is None or str(rule.tenant_id) != str(self.ctx.tenant_id) or rule.deleted_at is not None:
            raise AppError(404, "not_found", "规则不存在")
        return rule

    async def create(self, *, code: str, name: str, category: str, severity: str, keywords: list[str],
                     description: str = "", enabled: bool = True, change_note: str | None = None) -> RiskRule:
        dup = await self.session.scalar(
            select(RiskRule).where(RiskRule.tenant_id == self.ctx.tenant_id, RiskRule.code == code)
        )
        if dup is not None:
            raise AppError(400, "rule_code_exists", "规则编码已存在")
        rule = RiskRule(
            tenant_id=self.ctx.tenant_id,
            rule_set="DEFAULT",
            code=code,
            name=name,
            description=description,
            category=category,
            severity=severity,
            keywords=keywords or [],
            enabled=enabled,
            version_no=1,
            created_by=self.ctx.user.id,
        )
        self.session.add(rule)
        await self.session.flush()
        self.session.add(
            RiskRuleVersion(
                tenant_id=self.ctx.tenant_id,
                rule_id=rule.id,
                version_no=1,
                snapshot=_rule_snapshot(rule),
                changed_by=self.ctx.user.id,
                change_note=change_note or "创建规则",
            )
        )
        await self.session.flush()
        return rule

    async def update(self, rule_id: uuid.UUID, *, name: str | None, description: str | None,
                     category: str | None, severity: str | None, keywords: list[str] | None,
                     enabled: bool | None, change_note: str | None) -> RiskRule:
        rule = await self.get_rule_or_404(rule_id)
        if name is not None:
            rule.name = name
        if description is not None:
            rule.description = description
        if category is not None:
            rule.category = category
        if severity is not None:
            rule.severity = severity
        if keywords is not None:
            rule.keywords = keywords
        if enabled is not None:
            rule.enabled = enabled
        rule.version_no += 1
        await self.session.flush()
        self.session.add(
            RiskRuleVersion(
                tenant_id=self.ctx.tenant_id,
                rule_id=rule.id,
                version_no=rule.version_no,
                snapshot=_rule_snapshot(rule),
                changed_by=self.ctx.user.id,
                change_note=change_note or "更新规则",
            )
        )
        await self.session.flush()
        return rule

    async def soft_delete(self, rule_id: uuid.UUID) -> None:
        rule = await self.get_rule_or_404(rule_id)
        rule.deleted_at = datetime.now(UTC)
        rule.deleted_by = self.ctx.user.id
        rule.enabled = False
        await self.session.flush()

    async def list_versions(self, rule_id: uuid.UUID) -> list[RiskRuleVersion]:
        rule = await self.get_rule_or_404(rule_id)
        rows = (
            (
                await self.session.execute(
                    select(RiskRuleVersion)
                    .where(
                        RiskRuleVersion.tenant_id == self.ctx.tenant_id,
                        RiskRuleVersion.rule_id == rule.id,
                    )
                    .order_by(RiskRuleVersion.version_no.desc())
                )
            )
            .scalars()
            .all()
        )
        return list(rows)


class RiskAnalyzer:
    """关键词规则扫描器: 命中片段 → 风险片段 + 疑似问题 (一次会话/规则一条问题)."""

    def __init__(self, session: AsyncSession, ctx: TenantContext | None = None) -> None:
        self.session = session
        self.ctx = ctx

    async def analyze_conversation(self, conversation_id: uuid.UUID) -> dict:
        conv = await self.session.get(Conversation, conversation_id)
        if conv is None:
            raise AppError(404, "not_found", "会话不存在")
        if self.ctx is not None and str(conv.tenant_id) != str(self.ctx.tenant_id):
            raise AppError(404, "not_found", "会话不存在")
        if conv.status != "READY":
            raise AppError(400, "not_ready", "会话尚未转写完成, 无法分析")

        rules = (
            (
                await self.session.execute(
                    select(RiskRule).where(
                        RiskRule.tenant_id == conv.tenant_id,
                        RiskRule.enabled.is_(True),
                        RiskRule.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        if not rules:
            return {
                "conversation_id": str(conversation_id),
                "issues_created": 0,
                "segments_created": 0,
                "rules_matched": 0,
            }

        segments = list(
            (
                await self.session.execute(
                    select(TranscriptSegment)
                    .where(
                        TranscriptSegment.conversation_id == conv.id,
                        TranscriptSegment.version_no == conv.current_version,
                    )
                    .order_by(TranscriptSegment.segment_no)
                )
            )
            .scalars()
            .all()
        )
        # 已存在该会话的问题 (避免重复分析)
        existing_issue_rules = set(
            (
                await self.session.execute(
                    select(Issue.issue_type).where(
                        Issue.tenant_id == conv.tenant_id,
                        Issue.conversation_id == conv.id,
                        Issue.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )

        issues_created = 0
        segments_created = 0
        rules_matched = 0
        for rule in rules:
            if rule.category in existing_issue_rules:
                continue
            hits: list[TranscriptSegment] = []
            for seg in segments:
                text = seg.text or ""
                matched = [kw for kw in (rule.keywords or []) if kw and kw in text]
                if matched:
                    hits.append(seg)
            if not hits:
                continue
            rules_matched += 1
            primary = hits[0]
            risk_segment = RiskSegment(
                tenant_id=conv.tenant_id,
                conversation_id=conv.id,
                audio_file_id=conv.audio_file_id,
                rule_id=rule.id,
                rule_code=rule.code,
                rule_name=rule.name,
                severity=SEVERITY_LABEL.get(rule.severity, "中"),
                matched_text=primary.text,
                matched_keywords=list({kw for h in hits for kw in (rule.keywords or []) if kw in (h.text or "")}),
                speaker=primary.speaker,
                start_ms=primary.start_ms,
                end_ms=primary.end_ms,
                status="PENDING",
            )
            self.session.add(risk_segment)
            await self.session.flush()
            segments_created += 1
            issue = Issue(
                tenant_id=conv.tenant_id,
                issue_no=await _next_issue_no(self.session, conv.tenant_id),
                conversation_id=conv.id,
                audio_file_id=conv.audio_file_id,
                employee_id=conv.employee_id,
                store_id=conv.store_id,
                issue_type=rule.category,
                risk=SEVERITY_LABEL.get(rule.severity, "中"),
                quote=primary.text,
                advice=rule.description or rule.name,
                source="ANALYZER",
                review_status="PENDING",
                occurred_at=conv.started_at or datetime.now(UTC),
            )
            self.session.add(issue)
            await self.session.flush()
            risk_segment.issue_id = issue.id
            issues_created += 1
        await self.session.flush()
        return {
            "conversation_id": str(conversation_id),
            "issues_created": issues_created,
            "segments_created": segments_created,
            "rules_matched": rules_matched,
        }


class IssueWorkflow:
    def __init__(self, session: AsyncSession, ctx: TenantContext) -> None:
        self.session = session
        self.ctx = ctx

    async def get_issue_or_404(self, issue_id: uuid.UUID) -> Issue:
        issue = await self.session.get(Issue, issue_id)
        if issue is None or str(issue.tenant_id) != str(self.ctx.tenant_id) or issue.deleted_at is not None:
            raise AppError(404, "not_found", "问题不存在")
        return issue

    async def review(self, issue_id: uuid.UUID, *, approve: bool, comment: str | None) -> Issue:
        issue = await self.get_issue_or_404(issue_id)
        if issue.review_status != "PENDING":
            raise AppError(400, "already_reviewed", "该问题已复核")
        now = datetime.now(UTC)
        issue.review_status = "APPROVED" if approve else "DISMISSED"
        issue.reviewed_by = self.ctx.user.id
        issue.reviewed_at = now
        issue.review_comment = comment
        if not approve:
            issue.dismissed_reason = comment
            issue.close_status = "CLOSED"
        # 同步风险片段状态
        for seg in issue.segments:
            seg.status = "ACCEPTED" if approve else "DISMISSED"
        await self.session.flush()
        return issue

    async def close(self, issue_id: uuid.UUID, *, comment: str | None = None) -> Issue:
        issue = await self.get_issue_or_404(issue_id)
        issue.close_status = "CLOSED"
        issue.review_comment = comment or issue.review_comment
        await self.session.flush()
        return issue

    async def push_rectify(self, issue_id: uuid.UUID, *, due_date: str | None = None) -> Rectification:
        issue = await self.get_issue_or_404(issue_id)
        if issue.rectify_task_id is not None:
            rect = await self.session.get(Rectification, issue.rectify_task_id)
            if rect is not None:
                return rect

        due = date.fromisoformat(due_date) if due_date else date.today() + timedelta(days=3)
        rect = Rectification(
            tenant_id=issue.tenant_id,
            issue_id=issue.id,
            employee_id=issue.employee_id,
            store_id=issue.store_id,
            title=f"{issue.issue_type}整改",
            due_date=due,
            status="PENDING",
            progress=0,
        )
        self.session.add(rect)
        await self.session.flush()
        issue.rectify_task_id = rect.id
        issue.due_date = due
        issue.remediation_status = "PENDING"
        await self.session.flush()
        return rect


def _rule_snapshot(rule: RiskRule) -> dict:
    return {
        "code": rule.code,
        "name": rule.name,
        "description": rule.description,
        "category": rule.category,
        "severity": rule.severity,
        "keywords": rule.keywords,
        "enabled": rule.enabled,
        "rule_set": rule.rule_set,
    }


async def _next_issue_no(session: AsyncSession, tenant_id: uuid.UUID) -> str:
    from sqlalchemy import func

    from app.models.issue import Issue

    count = (
        await session.scalar(
            select(func.count()).select_from(Issue).where(Issue.tenant_id == tenant_id)
        )
        or 0
    )

    return f"ISS-{date.today().strftime('%Y%m%d')}-{count + 1:05d}"


async def run_risk_analysis(conversation_id: str, job_id: str | None = None) -> dict:
    """Worker 任务: 对指定会话执行风险分析 (转写完成后由队列触发).

    - 无请求上下文: 以会话自身的 tenant 为边界, 不做数据范围过滤 (后台任务)
    - 幂等: 一会话/规则最多一条问题
    """

    from app.core.logging import get_logger
    from app.db.session import get_session_factory

    logger = get_logger("yuqi.worker")
    async with get_session_factory()() as session:
        analyzer = RiskAnalyzer(session)
        result = await analyzer.analyze_conversation(uuid.UUID(conversation_id))
        await session.commit()
    logger.info(
        "risk_analysis_done",
        conversation_id=conversation_id,
        issues_created=result["issues_created"],
        job_id=job_id,
    )
    return result
