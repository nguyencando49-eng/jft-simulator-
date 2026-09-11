import json
import re
import zipfile
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BOOK_DIR = ROOT / "TAI LIEU SACH"
OUT_DIR = ROOT / "data" / "curriculum" / "a21"
PROD_CATALOG = ROOT / "data" / "production" / "a21-curriculum-catalog.json"
PLANNING_CATALOG = ROOT / "data" / "curriculum" / "a21" / "a21-curriculum-catalog.json"

CHUNK_TYPES = ("CAN_DO", "VOCABULARY", "EXPRESSION", "GRAMMAR", "DIALOGUE", "READING", "LISTENING", "TASK", "OTHER")
SECTIONS = ("script_vocabulary", "conversation_expression", "listening", "reading")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def compact(text: str) -> str:
    return re.sub(r"[\s\u3000、。！？!?,.・「」『』（）()［］\[\]:：;；\-—]+", "", text).lower()


def kanji_compact(text: str) -> str:
    return "".join(re.findall(r"[\u3400-\u9fff]", text))


def source_contains(term: str, body: str) -> bool:
    term_c = compact(term)
    body_c = compact(body)
    if term_c and term_c in body_c:
        return True
    # Many local Irodori docx files contain inline furigana such as
    # "にく肉" or "お終わり".  A kanji-only fallback prevents false
    # PARTIAL results while still requiring source-visible Japanese
    # characters from the lesson document.
    term_k = kanji_compact(term)
    body_k = kanji_compact(body)
    return len(term_k) >= 2 and term_k in body_k


def docx_text(path: Path) -> list[str]:
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    blocks: list[str] = []
    for para in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in para.findall(".//w:t", ns))
        text = normalize(text)
        if text and compact(text):
            blocks.append(text)
    deduped: list[str] = []
    for block in blocks:
        if not deduped or deduped[-1] != block:
            deduped.append(block)
    return deduped


def classify(text: str) -> str:
    c = compact(text)
    if re.search(r"can-do|cando|できる|目標|もくひょう", text, re.I):
        return "CAN_DO"
    if re.search(r"文法|ぶんぽう|grammar|～|Ｖ|V-|ないように|ことがあります|てもいい|そうです|んです|たらいい", text):
        return "GRAMMAR"
    if re.search(r"語彙|ことば|単語|vocabulary", text, re.I):
        return "VOCABULARY"
    if re.search(r"表現|ひょうげん|expression|フレーズ", text, re.I):
        return "EXPRESSION"
    if re.search(r"会話|かいわ|A[:：]|B[:：]|店員|客|受付|医者|患者|先生|学生", text):
        return "DIALOGUE"
    if re.search(r"聞|リスニング|listen|音声", text, re.I):
        return "LISTENING"
    if re.search(r"読|reading|案内|お知らせ|メール|メッセージ|掲示|ちらし", text, re.I):
        return "READING"
    if re.search(r"問題|選|答|練習|タスク|活動|ペア", text):
        return "TASK"
    if len(c) <= 20 and re.search(r"[\u3040-\u30ff\u3400-\u9fff]", text):
        return "VOCABULARY"
    return "OTHER"


def skill_coverage(chunk_types: set[str]) -> list[str]:
    skills = set()
    if chunk_types & {"VOCABULARY", "EXPRESSION", "GRAMMAR", "OTHER"}:
        skills.add("script_vocabulary")
    if chunk_types & {"DIALOGUE", "EXPRESSION", "CAN_DO", "TASK"}:
        skills.add("conversation_expression")
    if chunk_types & {"LISTENING", "DIALOGUE"}:
        skills.add("listening")
    if chunk_types & {"READING", "TASK", "CAN_DO"}:
        skills.add("reading")
    return [section for section in SECTIONS if section in skills]


def source_file_for_lesson(lesson: int) -> Path:
    candidates = sorted(BOOK_DIR.glob(f"初級1第{lesson}課*.docx"))
    if not candidates:
        raise FileNotFoundError(f"Missing 初級1 lesson {lesson} docx")
    return candidates[0]


def load_catalog_units() -> list[dict]:
    with PLANNING_CATALOG.open("r", encoding="utf-8") as f:
        catalog = json.load(f)
    return catalog["units"]


def terms_for_unit(unit: dict) -> list[str]:
    values = []
    for key in ("title", "canDo"):
        if unit.get(key):
            values.append(unit[key])
    for key in ("targetVocabulary", "targetExpressions", "grammarScope"):
        values.extend(v for v in unit.get(key, []) if v and "HUMAN_CONFIRMATION_REQUIRED" not in v)
    return list(dict.fromkeys(values))


def unit_supported(unit: dict, lesson_text: str) -> tuple[str, list[str], list[str]]:
    terms = terms_for_unit(unit)
    matched = [term for term in terms if source_contains(term, lesson_text)]
    required = [term for term in unit.get("targetVocabulary", []) + unit.get("targetExpressions", []) if compact(term)]
    required_matched = [term for term in required if source_contains(term, lesson_text)]
    title_matched = source_contains(unit.get("title", ""), lesson_text)
    if title_matched or len(required_matched) >= max(1, min(2, len(required))):
        if title_matched and unit.get("title") not in matched:
            matched.insert(0, unit["title"])
        return "CONFIRMED_BY_SOURCE", matched, []
    if matched:
        return "PARTIALLY_SUPPORTED", matched, [term for term in required if term not in required_matched]
    return "UNSUPPORTED", matched, required


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    catalog_units = load_catalog_units()
    source_documents = []
    source_chunks = []
    knowledge_units = []
    evidence_map = []
    coverage = []

    for unit in catalog_units:
        lesson = int(unit["lesson"])
        source_path = source_file_for_lesson(lesson)
        source_document_id = f"A21-SOURCE-L{lesson:02d}"
        blocks = docx_text(source_path)
        joined = "\n".join(blocks)
        file_hash = sha256(source_path.read_bytes()).hexdigest()
        text_hash = sha256(joined.encode("utf-8")).hexdigest()
        source_documents.append({
            "sourceDocumentId": source_document_id,
            "lessonId": f"A21-L{lesson:02d}",
            "lesson": lesson,
            "title": unit["title"],
            "topic": unit["topic"],
            "canDo": unit["canDo"],
            "sourcePath": str(source_path.relative_to(ROOT)).replace("\\", "/"),
            "fileHash": file_hash,
            "textHash": text_hash,
            "paragraphCount": len(blocks),
            "language": "ja",
            "status": "SOURCE_EXTRACTED",
            "createdAt": now,
        })
        lesson_chunk_ids = []
        type_counts: dict[str, int] = {}
        for index, block in enumerate(blocks, start=1):
            ctype = classify(block)
            type_counts[ctype] = type_counts.get(ctype, 0) + 1
            chunk_id = f"A21-L{lesson:02d}-CH{index:04d}"
            lesson_chunk_ids.append(chunk_id)
            source_chunks.append({
                "sourceDocumentId": source_document_id,
                "lessonId": f"A21-L{lesson:02d}",
                "chunkId": chunk_id,
                "chunkType": ctype,
                "sourceText": block,
                "sourceLocation": {"document": str(source_path.relative_to(ROOT)).replace("\\", "/"), "paragraph": index},
                "normalizedText": compact(block),
                "tags": [f"level:A2.1", f"lesson:{lesson:02d}", f"topic:{unit['topic']}", f"chunkType:{ctype}"],
                "extractionConfidence": 0.95 if ctype != "OTHER" else 0.75,
            })
        mapping, matched_terms, missing_terms = unit_supported(unit, joined)
        linked = [
            chunk["chunkId"] for chunk in source_chunks
            if chunk["sourceDocumentId"] == source_document_id
            and any(compact(term) and compact(term) in chunk["normalizedText"] for term in matched_terms)
        ][:40] or lesson_chunk_ids[: min(12, len(lesson_chunk_ids))]
        ku_status = "SOURCE_VERIFIED" if mapping == "CONFIRMED_BY_SOURCE" else "INFERRED_REVIEW_REQUIRED" if mapping == "PARTIALLY_SUPPORTED" else "UNSUPPORTED"
        chunk_types = {chunk["chunkType"] for chunk in source_chunks if chunk["chunkId"] in linked}
        supported_sections = skill_coverage(chunk_types)
        ku = {
            "id": unit["id"],
            "lessonId": f"A21-L{lesson:02d}",
            "lesson": lesson,
            "unitType": "CURRICULUM_UNIT",
            "normalizedConcept": compact(f"{unit['title']} {unit['canDo']}"),
            "sourceDocumentId": source_document_id,
            "sourceChunkIds": linked,
            "communicativePurpose": unit["canDo"],
            "topic": unit["topic"],
            "title": unit["title"],
            "targetVocabulary": unit.get("targetVocabulary", []),
            "targetExpressions": unit.get("targetExpressions", []),
            "grammarScope": unit.get("grammarScope", []),
            "readingScope": unit.get("readingScope", []),
            "listeningScope": unit.get("listeningScope", []),
            "prerequisiteRelation": unit.get("allowedPrerequisiteKnowledge", []),
            "confidence": 0.92 if ku_status == "SOURCE_VERIFIED" else 0.68 if ku_status == "INFERRED_REVIEW_REQUIRED" else 0.2,
            "evidenceStatus": ku_status,
            "approvedForGeneration": ku_status == "SOURCE_VERIFIED",
            "matchedTerms": matched_terms,
            "missingTerms": missing_terms,
        }
        knowledge_units.append(ku)
        evidence_map.append({
            "curriculumUnitId": unit["id"],
            "lessonId": f"A21-L{lesson:02d}",
            "sourceDocumentId": source_document_id,
            "knowledgeUnitId": ku["id"],
            "planningCatalogStatus": mapping,
            "knowledgeUnitStatus": ku_status,
            "approvedForGeneration": ku["approvedForGeneration"],
            "matchedTerms": matched_terms,
            "missingTerms": missing_terms,
            "sourceChunkIds": linked,
        })
        coverage.append({
            "lessonId": f"A21-L{lesson:02d}",
            "lesson": lesson,
            "curriculumUnitId": unit["id"],
            "sourceChunkCount": len(lesson_chunk_ids),
            "knowledgeUnitCount": 1,
            "chunkTypeCounts": {key: type_counts.get(key, 0) for key in CHUNK_TYPES},
            "supportedGenerationSections": supported_sections,
            "gaps": [section for section in SECTIONS if section not in supported_sections],
        })

    def write(name: str, value: object) -> None:
        with (OUT_DIR / name).open("w", encoding="utf-8", newline="\n") as f:
            json.dump(value, f, ensure_ascii=False, indent=2)
            f.write("\n")

    status_counts = {}
    for ku in knowledge_units:
        status_counts[ku["evidenceStatus"]] = status_counts.get(ku["evidenceStatus"], 0) + 1
    mapping_counts = {}
    for item in evidence_map:
        mapping_counts[item["planningCatalogStatus"]] = mapping_counts.get(item["planningCatalogStatus"], 0) + 1
    section_counts = {section: sum(1 for row in coverage if section in row["supportedGenerationSections"]) for section in SECTIONS}
    ready = (
        len(source_documents) == 18
        and len({doc["sourceDocumentId"] for doc in source_documents}) == 18
        and len({chunk["chunkId"] for chunk in source_chunks}) == len(source_chunks)
        and len({ku["id"] for ku in knowledge_units}) == len(knowledge_units)
        and all(ku["sourceChunkIds"] for ku in knowledge_units)
        and status_counts.get("SOURCE_VERIFIED", 0) == 18
    )
    report = {
        "reportVersion": "A21_SOURCE_EVIDENCE_REPORT_V1",
        "createdAt": now,
        "documentsProcessed": len(source_documents),
        "lessonsCovered": sorted(doc["lesson"] for doc in source_documents),
        "sourceChunkCount": len(source_chunks),
        "knowledgeUnitCount": len(knowledge_units),
        "statusCounts": status_counts,
        "planningCatalogMappingCounts": mapping_counts,
        "sectionCoverage": section_counts,
        "qualityGates": {
            "sourceLinkagePresent": all(ku["sourceDocumentId"] and ku["sourceChunkIds"] for ku in knowledge_units),
            "chunkIdsUnique": len({chunk["chunkId"] for chunk in source_chunks}) == len(source_chunks),
            "lessonIdsMatch": all(item["lessonId"] == f"A21-L{int(item['lessonId'].split('L')[1]):02d}" for item in evidence_map),
            "noUnsupportedApproved": not any(ku["approvedForGeneration"] and ku["evidenceStatus"] != "SOURCE_VERIFIED" for ku in knowledge_units),
            "planningClaimsExceedSource": [item for item in evidence_map if item["planningCatalogStatus"] in ("UNSUPPORTED", "MISMATCH")],
        },
        "finalClassification": "A21_SOURCE_EVIDENCE_READY" if ready else "A21_SOURCE_EVIDENCE_INCOMPLETE",
    }
    write("source-documents.json", {"artifactVersion": "A21_SOURCE_DOCUMENTS_V1", "documents": source_documents})
    write("source-chunks.json", {"artifactVersion": "A21_SOURCE_CHUNKS_V1", "allowedChunkTypes": list(CHUNK_TYPES), "chunks": source_chunks})
    write("knowledge-units.json", {"artifactVersion": "A21_KNOWLEDGE_UNITS_V1", "allowedStatuses": ["SOURCE_VERIFIED", "INFERRED_REVIEW_REQUIRED", "UNSUPPORTED"], "knowledgeUnits": knowledge_units})
    write("curriculum-evidence-map.json", {"artifactVersion": "A21_CURRICULUM_EVIDENCE_MAP_V1", "mappings": evidence_map, "coverage": coverage, "report": report})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
