"""SQLAlchemy 模型统一出口 (Alembic autogenerate 依赖此处导入)."""

from app.models.audit import AuditLog
from app.models.auth import (
    LoginLog,
    Permission,
    Role,
    RoleDataScope,
    Tenant,
    User,
    UserSession,
    role_permissions,
    user_roles,
)
from app.models.device import Device, DeviceBinding, DeviceBindingRequest
from app.models.imports import ImportBatch, ImportItem
from app.models.issue import Issue, Rectification, RiskRule, RiskRuleVersion, RiskSegment
from app.models.migration import MigrationBatch, MigrationItem
from app.models.notification import Notification
from app.models.org import (
    Employee,
    OrganizationNode,
    Position,
    RecordingConsent,
    Store,
)
from app.models.recording import (
    AudioFile,
    Conversation,
    ProcessingJob,
    TextVersion,
    TranscriptSegment,
)

__all__ = [
    "AuditLog",
    "LoginLog",
    "Permission",
    "Role",
    "RoleDataScope",
    "Tenant",
    "User",
    "UserSession",
    "role_permissions",
    "user_roles",
    "Device",
    "DeviceBinding",
    "DeviceBindingRequest",
    "ImportBatch",
    "ImportItem",
    "Issue",
    "Rectification",
    "RiskRule",
    "RiskRuleVersion",
    "RiskSegment",
    "MigrationBatch",
    "MigrationItem",
    "Notification",
    "Employee",
    "OrganizationNode",
    "Position",
    "RecordingConsent",
    "Store",
    "AudioFile",
    "Conversation",
    "ProcessingJob",
    "TextVersion",
    "TranscriptSegment",
]
