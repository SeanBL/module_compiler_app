from pathlib import Path
from docx import Document
from docx.shared import RGBColor
from docx.text.paragraph import Paragraph
from docx.table import Table

from module_compiler.stage1.structural_extractor import (
    iter_block_items,
    normalize,
    is_slide_header,
    is_quiz_marker
)


def _extract_quiz_question_count(text: str) -> int | None:
    """
    Extract quiz question count from slide header text:
    [[QUIZ:1:QUESTIONS=3,3,1]]

    We only take the FIRST number (3), which matches runtime slide count.
    """
    t = text.upper()

    if "QUESTIONS=" not in t:
        return None

    try:
        part = t.split("QUESTIONS=")[1]
        part = part.replace("]", "").strip()

        first_value = part.split(",")[0].strip()

        if first_value.isdigit():
            return int(first_value)

    except Exception:
        pass

    return None

def generate_annotated_doc(input_path: Path, output_path: Path, error_slide_id: str | None = None) -> None:
    doc = Document(str(input_path))

    slide_index = 0
    pending_quiz_count = 1

    for block in iter_block_items(doc):

        # -----------------------------
        # QUIZ MARKERS (FIXED COUNTING)
        # -----------------------------
        if isinstance(block, Paragraph):
            text = normalize(block.text)

            if is_quiz_marker(text):
                slide_index += pending_quiz_count
                pending_quiz_count = 1
                continue

        # -----------------------------
        # TABLE HEADERS (SLIDES)
        # -----------------------------
        if isinstance(block, Table):

            for row in block.rows:
                first_cell = row.cells[0]
                first_text = normalize(first_cell.text)

                # Look across the WHOLE table, not just the first cell.
                # Quiz metadata is usually in the Notes and Instructions column.
                table_text = normalize(" ".join(cell.text for r in block.rows for cell in r.cells))

                quiz_count = _extract_quiz_question_count(table_text)
                if quiz_count:
                    pending_quiz_count = quiz_count

                if not is_slide_header(first_text):
                    continue

                slide_index += 1
                slide_id = f"slide_{slide_index:03d}"
                marker = f"[SLIDE_{slide_index:03d}]"

                for p in first_cell.paragraphs:
                    if normalize(p.text):

                        if marker not in p.text:
                            # Optional improvement: include header text
                            p.text = f"{marker} | {first_text}\n{p.text}"

                        # ✅ HIGHLIGHT ERROR SLIDE
                        if error_slide_id == slide_id:
                            for run in p.runs:
                                run.font.color.rgb = RGBColor(255, 0, 0)
                                run.bold = True

                        break

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)