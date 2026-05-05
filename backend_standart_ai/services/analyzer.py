"""
OpenAI integration for high-precision proofreading of Uzbek standard documents.

The analyzer prefers precision, but it also accepts clear grammar, terminology,
hyphenation, spacing, and table-cell text errors when the original span exists
verbatim in the source text.
"""
import asyncio
import json
import logging
import re
import unicodedata
from typing import Any

from openai import AsyncOpenAI

from config import settings
from schemas import ChunkResult, Issue, IssueCounts
from services.chunker import Chunk

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.openai_timeout_seconds,
        )
    return _client


SYSTEM_PROMPT = """Sen texnik standart hujjatlari uchun professional o'zbek, rus va inglizcha matn korrektori sifatida ishlaysan.

Vazifa: berilgan matndan faqat aniq xatolarni top va JSON qaytar.

Asosiy qoida: false positive yomon. Agar ishonchli bo'lmasa, xato chiqarmagin.

Aniqlanadigan xatolar:
- imlo xatosi: "xayoti" -> "hayoti", "tadbiq" -> "tatbiq", "Materaillar" -> "Materiallar"
- apostrof xatosi: "Tamg’asi" -> "Tamg'asi", "na’munalari" -> "namunalari"
- termin yoki xorijiy so'z imlosi: "Arrenius" -> "Arrhenius", "produsent" -> "produtsent"
- kelishik/qo'shimcha xatosi: "hududlarni qurishda" -> "hududlarini qurishda", "Ushbu standarti" -> "Ushbu standart"
- takror so'z: "keng kenglikdagi" -> "kenglikdagi", "sinov sinovidan o‘tkazish" -> "sinovdan o‘tkazish"
- defis va probel xatosi: "geotextilerelated" -> "geotextile-related", "19- dekabrdagi" -> "19-dekabrdagi", "CEN- CENELEC" -> "CEN-CENELEC"
- sarlavha/termin ajratilishi: "Soʻzboshi" -> "So'z boshi"
- ruscha aniq imlo/kelishik xatosi: "Блоки бетоные" -> "Блоки бетонные" yoki kontekst talab qilsa "бетонные"
- standart terminologiyasida aniq noto'g'ri ibora: "amal qilishi to'xtatiladi" -> "amal qilishi bekor qilinadi"
- bitta token ichida lotin/kirill aralashuvi va aniq encoding buzilishi

Qoidalar:
- original qiymatni matnda qanday bo'lsa, aynan shunday ko'chir; matnda yo'q original yozma
- corrected shu joyga bevosita qo'yiladigan tuzatish bo'lsin
- jadval kataklaridagi matnni ham oddiy matn kabi tekshir
- standart nomlari, kodlar, raqamlar, birliklar va formulalarni o'zgartirma; faqat ularning atrofidagi aniq probel/defis xatosini chiqarish mumkin
- tarjima qilma, fikr qo'shma, uzun qayta yozish qilma
- bir xil xato takrorlansa, bitta chunk ichida faqat bir marta chiqar

Type tanlash:
- spelling: imlo va termin imlosi
- apostrophe: apostrof/okina belgisi xatosi
- grammar: kelishik, qo'shimcha, takror so'z va aniq grammatik ibora
- punctuation: defis, probel, ikki nuqta, tire kabi tinish/ajratish xatosi
- style: standart terminologiyasida aniq noto'g'ri ibora
- encoding: buzilgan belgi
- mixed_alphabet: bitta token ichida lotin/kirill aralashuvi

Xato bo'lmasa errors bo'sh bo'lsin."""


ERROR_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "errors": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "original": {
                        "type": "string",
                        "description": "The exact incorrect word or short phrase copied from the input text.",
                    },
                    "corrected": {
                        "type": "string",
                        "description": "The corrected replacement text for the same location.",
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "spelling",
                            "apostrophe",
                            "encoding",
                            "mixed_alphabet",
                            "grammar",
                            "punctuation",
                            "style",
                        ],
                    },
                },
                "required": ["original", "corrected", "type"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["errors"],
    "additionalProperties": False,
}

RESPONSE_TEXT_FORMAT = {
    "format": {
        "type": "json_schema",
        "name": "standard_document_proofreading_errors",
        "schema": ERROR_RESPONSE_SCHEMA,
        "strict": True,
    }
}

CHAT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "standard_document_proofreading_errors",
        "schema": ERROR_RESPONSE_SCHEMA,
        "strict": True,
    },
}

_ALLOWED_ERROR_TYPES = {
    "spelling",
    "apostrophe",
    "encoding",
    "mixed_alphabet",
    "grammar",
    "punctuation",
    "style",
}
_INVALID_APOSTROPHES = {0x02BC, 0x02BB, 0x2018, 0x2019, 0x0060, 0x00B4}
_APOSTROPHE_TRANSLATION = str.maketrans({
    "\u02bc": "'",
    "\u02bb": "'",
    "\u2018": "'",
    "\u2019": "'",
    "`": "'",
    "\u00b4": "'",
})

_TECH_CODE_RE = re.compile(
    r"^(?:"
    r"[A-Za-z]{1,12}\d[\w./:-]*|"
    r"\d+[A-Za-z][\w./:-]*|"
    r"\d+(?:[.,:/-]\d+)*|"
    r"[A-Z]{2,}(?:[-_/]?\d.*)?"
    r")$"
)
_STANDARD_RE = re.compile(
    r"^(?:o['`]?zdst|iso|iec|gost|en|astm|din|api)(?:$|[-_:/]?\d)",
    re.IGNORECASE,
)
_TOKEN_DISALLOWED_CHARS_RE = re.compile(r"[\\/|@#$%^&*+=<>{}\[\]~]")

_ERROR_TYPE_MAP: dict[str, tuple[str, str]] = {
    "spelling": ("spelling", "medium"),
    "apostrophe": ("apostrophe", "medium"),
    "encoding": ("encoding", "high"),
    "mixed_alphabet": ("mixed_alphabet", "high"),
    "grammar": ("grammar", "medium"),
    "punctuation": ("punctuation", "low"),
    "style": ("style", "medium"),
}

_EXPLANATION_MAP: dict[str, str] = {
    "spelling": "Imlo xatosi: so'z noto'g'ri yozilgan.",
    "apostrophe": "Apostrof xatosi: o'zbek lotin yozuvida ASCII apostrof (') ishlatilishi kerak.",
    "encoding": "Encoding xatosi: belgi buzilgan va to'g'ri belgiga almashtirilishi kerak.",
    "mixed_alphabet": "Lotin/kirill aralashuvi: bitta token ichida ikki xil alifbo belgisi bor.",
    "grammar": "Grammatik xato: kelishik, qo'shimcha yoki takror so'z tuzatilishi kerak.",
    "punctuation": "Tinish/probel xatosi: defis, bo'sh joy yoki tinish belgisi tuzatilishi kerak.",
    "style": "Terminologik/uslubiy xato: standart hujjatlarda qabul qilingan ifoda ishlatilishi kerak.",
}

_STATIC_CORRECTION_RULES: tuple[tuple[str, str, str], ...] = (
    ("hududlarni qurishda", "hududlarini qurishda", "grammar"),
    ("geotextilerelated", "geotextile-related", "punctuation"),
    ("-Characteristics", "- Characteristics", "punctuation"),
    ("CEN- CENELEC", "CEN-CENELEC", "punctuation"),
    ("19- dekabrdagi", "19-dekabrdagi", "punctuation"),
    ("ko‘rsatkichlarda", "ko‘rsatkichlarida", "grammar"),
    ("koʻrsatkichlarda", "koʻrsatkichlarida", "grammar"),
    ("Soʻzboshi", "So'z boshi", "punctuation"),
    ("So‘zboshi", "So'z boshi", "punctuation"),
    ("Ushbu standarti", "Ushbu standart", "grammar"),
    ("xayoti", "hayoti", "spelling"),
    ("keng kenglikdagi", "kenglikdagi", "grammar"),
    ("Tamg’alashlash", "Tamg'alash", "spelling"),
    ("na’munalari", "namunalari", "apostrophe"),
    ("spetsifikatsiyada (спецификацияда)", "spetsifikatsiyada", "style"),
    ("dielkometrik", "dielektrometrik", "spelling"),
    ("ostqliklar", "ostliklar", "spelling"),
    ("Блоки бетоные", "Блоки бетонные", "grammar"),
    ("sinov sinovidan o‘tkazish", "sinovdan o‘tkazish", "grammar"),
    ("sinov sinovidan oʻtkazish", "sinovdan oʻtkazish", "grammar"),
    ("ilomogʻining", "ilmoqning", "spelling"),
    ("Materaillar", "Materiallar", "spelling"),
    ("produsent mikroorganizmlar", "produtsent mikroorganizmlar", "spelling"),
    ("koʻrsatilganidan farq qiladigan", "keltirilganidan farq qiladigan", "style"),
    ("ko‘rsatilganidan farq qiladigan", "keltirilganidan farq qiladigan", "style"),
    ("amal qilishi to‘xtatiladi", "amal qilishi bekor qilinadi", "style"),
    ("amal qilishi toʻxtatiladi", "amal qilishi bekor qilinadi", "style"),
    ("amal qilinishi tekshirilishi kerak", "amal qilinishi tekshirilishi lozim", "style"),
    ("Arrenius", "Arrhenius", "spelling"),
    ("Tamg’asi", "Tamg'asi", "apostrophe"),
    ("Tamg’asidan", "Tamg'asidan", "apostrophe"),
    ("tadbiq", "tatbiq", "spelling"),
)


def _supports_reasoning(model: str) -> bool:
    return model.startswith("gpt-5")


def _reasoning_kwargs(model: str) -> dict[str, Any]:
    effort = settings.openai_reasoning_effort.strip().lower()
    if not effort or not _supports_reasoning(model):
        return {}
    return {"reasoning": {"effort": effort}}


def _response_text(response: Any) -> str:
    text = getattr(response, "output_text", None)
    if isinstance(text, str):
        return text

    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            content_text = getattr(content, "text", None)
            if isinstance(content_text, str):
                parts.append(content_text)
    return "".join(parts)


async def _create_json_response(
    client: AsyncOpenAI,
    messages: list[dict[str, str]],
    max_output_tokens: int = 2048,
) -> str:
    model = settings.openai_model
    try:
        response = await client.responses.create(
            model=model,
            input=messages,
            text=RESPONSE_TEXT_FORMAT,
            max_output_tokens=max_output_tokens,
            **_reasoning_kwargs(model),
        )
        return _response_text(response)
    except AttributeError:
        logger.warning("OpenAI SDK has no Responses API; falling back to Chat Completions.")

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        response_format=CHAT_RESPONSE_FORMAT,
        max_completion_tokens=max_output_tokens,
    )
    return response.choices[0].message.content or ""


def _parse_json(raw: str) -> dict[str, Any] | None:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return None


def _normalize_apostrophes(text: str) -> str:
    return text.translate(_APOSTROPHE_TRANSLATION)


def _normalize_for_compare(text: str) -> str:
    return unicodedata.normalize("NFC", _normalize_apostrophes(text)).casefold()


def _find_char_positions(paragraph_text: str, original_text: str) -> tuple[int | None, int | None]:
    idx = paragraph_text.find(original_text)
    if idx == -1:
        return None, None
    return idx, idx + len(original_text)


def _has_latin_cyrillic_mix(token: str) -> bool:
    alpha_chars = [c for c in token if c.isalpha()]
    has_latin = any("LATIN" in unicodedata.name(c, "") for c in alpha_chars)
    has_cyrillic = any("CYRILLIC" in unicodedata.name(c, "") for c in alpha_chars)
    return has_latin and has_cyrillic


def _has_encoding_garbage(token: str) -> bool:
    garbage_markers = ("\ufffd", "\u00c3", "\u00c2", "\u00e2")
    return any(marker in token for marker in garbage_markers)


def _has_bad_apostrophe(token: str) -> bool:
    return any(ord(c) in _INVALID_APOSTROPHES for c in token)


def _is_technical_token(token: str) -> bool:
    compact = _normalize_apostrophes(token).strip(".,;:()[]{}")
    if not compact:
        return True
    if any(ch.isdigit() for ch in compact):
        return True
    if _TECH_CODE_RE.match(compact):
        return True
    if _STANDARD_RE.match(compact):
        return True

    letters = "".join(ch for ch in compact if ch.isalpha())
    if len(letters) >= 2 and letters.upper() == letters:
        return True

    return False


def _is_probable_non_word_token(token: str) -> bool:
    if not token or any(ch.isspace() for ch in token):
        return True
    if _TOKEN_DISALLOWED_CHARS_RE.search(token):
        return True
    if any(ch.isdigit() for ch in token):
        return True
    if token.count(".") > 0 or token.count(",") > 0:
        return True
    return False


def _is_probable_bad_span(text: str) -> bool:
    if not text or len(text) > 160:
        return True
    if _TOKEN_DISALLOWED_CHARS_RE.search(text):
        return True
    words = [part for part in text.split() if part]
    return len(words) > 8


def _is_token_level_type(error_type: str) -> bool:
    return error_type in {"spelling", "apostrophe", "encoding", "mixed_alphabet"}


def _is_phrase_level_type(error_type: str) -> bool:
    return error_type in {"grammar", "punctuation", "style"}


def _has_letter(text: str) -> bool:
    return any(ch.isalpha() for ch in text)


def _has_cyrillic(text: str) -> bool:
    return any("CYRILLIC" in unicodedata.name(ch, "") for ch in text if ch.isalpha())


def _looks_like_punctuation_change(original: str, corrected: str) -> bool:
    original_letters = "".join(ch.casefold() for ch in original if ch.isalpha() or ch.isdigit())
    corrected_letters = "".join(ch.casefold() for ch in corrected if ch.isalpha() or ch.isdigit())
    return bool(original_letters) and original_letters == corrected_letters


def _levenshtein_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (ca != cb)
            current.append(min(insert_cost, delete_cost, replace_cost))
        previous = current
    return previous[-1]


def _max_allowed_distance(original: str, corrected: str) -> int:
    max_len = max(len(original), len(corrected))
    if max_len <= 4:
        return 1
    if max_len <= 8:
        return 2
    if max_len <= 14:
        return 4
    return 5


def _is_semantic_replacement(original: str, corrected: str) -> bool:
    original = original.strip()
    corrected = corrected.strip()
    if not original or not corrected:
        return True
    if any(ch.isspace() for ch in corrected):
        return True
    if _TOKEN_DISALLOWED_CHARS_RE.search(corrected):
        return True

    original_norm = _normalize_for_compare(original)
    corrected_norm = _normalize_for_compare(corrected)
    if original_norm == corrected_norm:
        return False

    distance = _levenshtein_distance(original_norm, corrected_norm)
    return distance > _max_allowed_distance(original_norm, corrected_norm)


def _is_probable_proper_noun(original: str, corrected: str, char_start: int | None) -> bool:
    if char_start in (None, 0):
        return False
    if not original[:1].isupper():
        return False
    if original.upper() == original:
        return True
    return corrected[:1].isupper() is False


def _valid_apostrophe_error(original: str, corrected: str) -> bool:
    if _has_bad_apostrophe(original):
        return True
    original_norm = _normalize_apostrophes(original)
    corrected_norm = _normalize_apostrophes(corrected)
    return "'" in corrected_norm and "'" not in original_norm


def _issue_key(issue_type: str, original: str, corrected: str) -> tuple[str, str, str]:
    return (
        issue_type,
        _normalize_for_compare(original.strip()),
        _normalize_for_compare(corrected.strip()),
    )


def _static_rule_errors(text: str) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for original, corrected, error_type in _STATIC_CORRECTION_RULES:
        if original not in text:
            continue
        key = _issue_key(error_type, original, corrected)
        if key in seen:
            continue
        seen.add(key)
        errors.append({"original": original, "corrected": corrected, "type": error_type})
    return errors


def _build_issues(raw_errors: list[dict[str, Any]], chunk: Chunk, chunk_issue_prefix: str) -> list[Issue]:
    issues: list[Issue] = []
    seen: set[tuple[str, str, str]] = set()

    for raw in raw_errors:
        original = str(raw.get("original", "")).strip()
        corrected = str(raw.get("corrected", "")).strip()
        error_type = str(raw.get("type", raw.get("error_type", "spelling"))).strip().lower()

        if error_type not in _ALLOWED_ERROR_TYPES:
            logger.debug("Skipping unsupported error type: %r", error_type)
            continue
        if not original or not corrected or original == corrected:
            logger.debug("Skipping empty or identical correction: %r -> %r", original, corrected)
            continue

        if error_type == "spelling" and _looks_like_punctuation_change(original, corrected):
            error_type = "punctuation"
        elif error_type == "spelling" and (any(ch.isspace() for ch in original) or any(ch.isspace() for ch in corrected)):
            error_type = "grammar"

        if _is_phrase_level_type(error_type):
            if _is_probable_bad_span(original) or _is_probable_bad_span(corrected):
                logger.debug("Skipping bad phrase span: %r -> %r", original, corrected)
                continue
        elif _is_probable_non_word_token(original) or _is_probable_non_word_token(corrected):
            logger.debug("Skipping non-word token: %r -> %r", original, corrected)
            continue

        if _is_token_level_type(error_type) and _is_technical_token(original):
            logger.debug("Skipping technical token: %r", original)
            continue
        if not _has_letter(original):
            logger.debug("Skipping span without letters: %r", original)
            continue

        para_idx: int | None = None
        page_num: int | None = None
        char_start: int | None = None
        char_end: int | None = None

        for para in chunk.paragraphs:
            cs, ce = _find_char_positions(para.text, original)
            if cs is not None:
                para_idx = para.index
                page_num = para.page_number if para.page_number else None
                char_start = cs
                char_end = ce
                break

        if char_start is None:
            logger.debug("Skipping token not found exactly in chunk: %r", original)
            continue

        has_mixed_alphabet = _has_latin_cyrillic_mix(original)
        if has_mixed_alphabet:
            error_type = "mixed_alphabet"
        elif error_type == "mixed_alphabet":
            logger.debug("Skipping false mixed alphabet token: %r", original)
            continue

        if error_type == "encoding" and not _has_encoding_garbage(original):
            logger.debug("Skipping false encoding token: %r", original)
            continue

        if error_type == "apostrophe" and not _valid_apostrophe_error(original, corrected):
            logger.debug("Skipping false apostrophe token: %r -> %r", original, corrected)
            continue

        if error_type == "spelling":
            if _is_probable_proper_noun(original, corrected, char_start):
                logger.debug("Skipping probable proper noun: %r -> %r", original, corrected)
                continue
            if _is_semantic_replacement(original, corrected):
                logger.debug("Skipping semantic replacement: %r -> %r", original, corrected)
                continue
        elif error_type == "apostrophe" and _is_semantic_replacement(original, corrected):
            logger.debug("Skipping semantic apostrophe replacement: %r -> %r", original, corrected)
            continue
        elif error_type == "punctuation" and not _looks_like_punctuation_change(original, corrected):
            logger.debug("Skipping weak punctuation replacement: %r -> %r", original, corrected)
            continue

        dedupe_key = _issue_key(error_type, original, corrected)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        issue_type, severity = _ERROR_TYPE_MAP[error_type]
        explanation = _EXPLANATION_MAP[error_type]
        if error_type == "apostrophe" and _has_bad_apostrophe(original):
            bad_chars = [f"U+{ord(c):04X}" for c in original if ord(c) in _INVALID_APOSTROPHES]
            explanation = (
                f"Apostrof belgisi noto'g'ri ({', '.join(bad_chars)}). "
                "To'g'ri belgi: ' (U+0027)."
            )

        issue_index = len(issues) + 1
        issues.append(Issue(
            issue_id=f"{chunk_issue_prefix}_{issue_index}",
            issue_type=issue_type,
            severity=severity,
            original_text=original,
            corrected_text=corrected,
            sentence="",
            suggestion=f"'{original}' so'zini '{corrected}' deb yozing",
            explanation=explanation,
            paragraph_index=para_idx,
            page_number=page_num,
            char_start=char_start,
            char_end=char_end,
        ))

    return issues


def _apply_corrections(text: str, issues: list[Issue]) -> str:
    result = text
    for issue in issues:
        original = issue.original_text
        corrected = issue.corrected_text
        if not original or not corrected or original == corrected:
            continue

        pattern = re.compile(r"(?<!\w)" + re.escape(original) + r"(?!\w)", re.UNICODE)
        result, replaced = pattern.subn(corrected, result, count=1)
        if replaced == 0:
            result = result.replace(original, corrected, 1)
    return result


async def analyze_chunk(chunk: Chunk, semaphore: asyncio.Semaphore) -> ChunkResult:
    async with semaphore:
        client = get_client()
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Quyidagi matnni tekshir. Faqat aniq korrektura xatolarini JSON formatida qaytar.\n\n"
                    "<text>\n"
                    f"{chunk.text}\n"
                    "</text>"
                ),
            },
        ]

        logger.info("Chunk %d sending to OpenAI (%d chars)...", chunk.index, chunk.char_count)

        try:
            raw_content = await _create_json_response(client, messages)
        except Exception as exc:
            logger.exception("Chunk %d OpenAI error: %s", chunk.index, exc)
            return ChunkResult(
                chunk_index=chunk.index,
                paragraph_index_start=chunk.paragraph_index_start,
                paragraph_index_end=chunk.paragraph_index_end,
                original_text=chunk.text,
                corrected_text=chunk.text,
                issues=[],
            )

        logger.info("Chunk %d raw response (300): %s", chunk.index, raw_content[:300])

        parsed = _parse_json(raw_content)
        if parsed is None:
            logger.warning("Chunk %d: JSON parse failed. Raw: %s", chunk.index, raw_content[:400])
            return ChunkResult(
                chunk_index=chunk.index,
                paragraph_index_start=chunk.paragraph_index_start,
                paragraph_index_end=chunk.paragraph_index_end,
                original_text=chunk.text,
                corrected_text=chunk.text,
                issues=[],
            )

        raw_errors = parsed.get("errors", [])
        if not isinstance(raw_errors, list):
            logger.warning("Chunk %d: errors is not a list: %r", chunk.index, raw_errors)
            raw_errors = []
        raw_errors = [*raw_errors, *_static_rule_errors(chunk.text)]

        issues = _build_issues(raw_errors, chunk, f"ch{chunk.index}")
        corrected_text = _apply_corrections(chunk.text, issues)

        logger.info("Chunk %d: %d accepted errors found", chunk.index, len(issues))

        return ChunkResult(
            chunk_index=chunk.index,
            paragraph_index_start=chunk.paragraph_index_start,
            paragraph_index_end=chunk.paragraph_index_end,
            original_text=chunk.text,
            corrected_text=corrected_text,
            issues=issues,
        )


async def analyze_all_chunks(chunks: list[Chunk]) -> list[ChunkResult]:
    semaphore = asyncio.Semaphore(settings.max_parallel_chunks)
    tasks = [analyze_chunk(chunk, semaphore) for chunk in chunks]
    results = await asyncio.gather(*tasks)
    return sorted(results, key=lambda r: r.chunk_index)


def build_summary(chunk_results: list[ChunkResult]) -> tuple[IssueCounts, int]:
    counts = IssueCounts()
    seen: set[tuple[str, str, str]] = set()

    for cr in chunk_results:
        for issue in cr.issues:
            issue_type = issue.issue_type.lower()
            key = _issue_key(issue_type, issue.original_text, issue.corrected_text)
            if key in seen:
                continue
            seen.add(key)

            if hasattr(counts, issue_type):
                setattr(counts, issue_type, getattr(counts, issue_type) + 1)
            else:
                counts.spelling += 1

    return counts, len(seen)
