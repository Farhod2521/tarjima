from pydantic import BaseModel
from typing import Optional


class Issue(BaseModel):
    issue_id: str
    issue_type: str       # grammar | spelling | punctuation | style | capitalization
    severity: str         # low | medium | high
    original_text: str
    corrected_text: str
    sentence: str
    suggestion: str
    explanation: str
    paragraph_index: Optional[int] = None   # qaysi paragrafda
    page_number: Optional[int] = None       # PDF qaysi sahifada
    char_start: Optional[int] = None        # paragraf ichida boshlanish pozitsiyasi
    char_end: Optional[int] = None          # paragraf ichida tugash pozitsiyasi


class ChunkResult(BaseModel):
    chunk_index: int
    paragraph_index_start: int
    paragraph_index_end: int
    original_text: str
    corrected_text: str
    issues: list[Issue]


class IssueCounts(BaseModel):
    grammar: int = 0
    spelling: int = 0
    apostrophe: int = 0
    mixed_alphabet: int = 0
    encoding: int = 0
    punctuation: int = 0
    style: int = 0
    capitalization: int = 0


class Summary(BaseModel):
    total_chunks: int
    total_issues: int
    issue_counts: IssueCounts


class FileMetadata(BaseModel):
    page_count: int
    paragraph_count: int
    word_count: int
    char_count: int


class AnalysisResponse(BaseModel):
    success: bool
    file_name: str
    file_type: str
    processing_time_ms: int
    metadata: FileMetadata
    summary: Summary
    corrected_text: str
    chunks: list[ChunkResult]
    warnings: list[str]
    file_id: Optional[str] = None
