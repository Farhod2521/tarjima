"""
Paragraflarni OpenAI uchun chunk'larga bo'lish.
Har bir chunk taxminan chunk_size_chars belgidan oshmasligi kerak.
"""
from dataclasses import dataclass, field
from services.parser import Paragraph


@dataclass
class Chunk:
    index: int
    paragraphs: list[Paragraph] = field(default_factory=list)
    paragraph_index_start: int = 0
    paragraph_index_end: int = 0

    @property
    def text(self) -> str:
        return "\n\n".join(p.text for p in self.paragraphs)

    @property
    def char_count(self) -> int:
        return len(self.text)


def build_chunks(paragraphs: list[Paragraph], chunk_size_chars: int = 1500) -> list[Chunk]:
    """
    Paragraflarni chunk_size_chars ga mos keladigan chunklarga guruhlaydi.
    Bir paragraf chunk_size dan katta bo'lsa ham alohida chunk bo'ladi.
    """
    if not paragraphs:
        return []

    chunks: list[Chunk] = []
    current_chunk = Chunk(index=0, paragraph_index_start=paragraphs[0].index)
    current_size = 0

    for para in paragraphs:
        para_len = len(para.text)

        # Agar joriy chunk to'lib qolgan bo'lsa — yangi chunk ochamiz
        if current_size > 0 and current_size + para_len > chunk_size_chars:
            current_chunk.paragraph_index_end = current_chunk.paragraphs[-1].index
            chunks.append(current_chunk)
            current_chunk = Chunk(
                index=len(chunks),
                paragraph_index_start=para.index,
            )
            current_size = 0

        current_chunk.paragraphs.append(para)
        current_size += para_len

    # Oxirgi chunk
    if current_chunk.paragraphs:
        current_chunk.paragraph_index_end = current_chunk.paragraphs[-1].index
        chunks.append(current_chunk)

    return chunks
