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


def generate_annotated_doc(input_path: Path, output_path: Path, error_slide_id: str | None = None) -> None:
    doc = Document(str(input_path))

    slide_index = 0

    for block in iter_block_items(doc):

        # -----------------------------
        # QUIZ MARKERS (MUST MATCH COMPILER)
        # -----------------------------
        if isinstance(block, Paragraph):
            text = normalize(block.text)

            if is_quiz_marker(text):
                slide_index += 1
                continue

        # -----------------------------
        # TABLE HEADERS (SLIDES)
        # -----------------------------
        if isinstance(block, Table):

            for row in block.rows:
                first_cell = row.cells[0]
                first_text = normalize(first_cell.text)

                if not is_slide_header(first_text):
                    continue

                slide_index += 1
                slide_id = f"slide_{slide_index:03d}"
                marker = f"[SLIDE_{slide_index:03d}]"

                for p in first_cell.paragraphs:
                    if normalize(p.text):

                        if marker not in p.text:
                            p.text = f"{marker}\n{p.text}"

                        # ✅ HIGHLIGHT ERROR SLIDE
                        if error_slide_id == slide_id:
                            for run in p.runs:
                                run.font.color.rgb = RGBColor(255, 0, 0)
                                run.bold = True

                        break

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)