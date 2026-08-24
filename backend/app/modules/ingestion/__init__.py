"""接入/转写模块."""

from app.modules.ingestion.service import IngestionService, UploadMeta, run_asr_job

__all__ = ["IngestionService", "UploadMeta", "run_asr_job"]
