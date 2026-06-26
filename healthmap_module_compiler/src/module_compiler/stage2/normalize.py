from __future__ import annotations

from typing import List

from ..models.raw_models import (
    RawSlide,
    RawQuizQuestion,
    RawQuizOption,
)
from ..models.blocks import ParagraphBlock, BulletsBlock

import re


# ==========================================================
# Public Entry Point
# ==========================================================

def normalize_slides(raw_slides: List[RawSlide]) -> List[RawSlide]:
    """
    Stage 2 normalization contract.

    Input:  List[RawSlide] from Stage 1
    Output: List[RawSlide] normalized and validated

    This function:
      - Enforces slide type invariants
      - Normalizes panel bodies
      - Validates quiz structures
      - Removes empty slides
      - Reindexes slide IDs
    """

    normalized: List[RawSlide] = []

    for slide in raw_slides:
        slide = _normalize_header(slide)
        slide = _normalize_slide_type(slide)

        if slide.slide_type == "panel":
            slide = _normalize_panel(slide)

        elif slide.slide_type == "quiz":
            slide = _normalize_quiz(slide)

        elif slide.slide_type == "engage1":
            slide = _normalize_engage1(slide)

        elif slide.slide_type == "engage2":
            slide = _normalize_engage2(slide)
        
        elif slide.slide_type == "decision":
            slide = _normalize_decision(slide)

        else:
            raise ValueError(
                f"Unknown slide_type: {slide.slide_type}"
            )

        normalized.append(slide)

    normalized = _remove_empty_slides(normalized)
    normalized = _reindex_slides(normalized)

    return normalized


# ==========================================================
# Header Normalization
# ==========================================================

def _normalize_header(slide: RawSlide) -> RawSlide:
    if not slide.header:
        raise ValueError("Slide missing header")

    header = slide.header.strip()

    # Optional: remove "Header:" prefix
    if header.lower().startswith("header:"):
        header = header.split(":", 1)[1].strip()

    return slide.model_copy(update={"header": header})


# ==========================================================
# Slide Type Enforcement
# ==========================================================

def _normalize_slide_type(slide: RawSlide) -> RawSlide:
    if not slide.slide_type:
        raise ValueError(f"Slide {slide.slide_id} missing slide_type")

    allowed = {"panel", "quiz", "engage1", "engage2", "decision"}

    if slide.slide_type not in allowed:
        raise ValueError(
            f"Slide {slide.slide_id} invalid slide_type: {slide.slide_type}"
        )

    return slide

# ==========================================================
# Style Modifier Parser
# ==========================================================

STYLE_PATTERN = re.compile(
    r"^\[STYLE=(.*?)\](.*?)\[/STYLE\]$",
    re.IGNORECASE | re.DOTALL
)


def parse_style_modifiers(text: str):

    modifiers = []

    text = text.strip()

    # -------------------------
    # NEW STYLE FORMAT
    # -------------------------

    match = STYLE_PATTERN.match(text)

    if match:

        raw_modifiers = match.group(1)
        content = match.group(2).strip()

        modifiers = [
            m.strip().lower()
            for m in raw_modifiers.split(",")
            if m.strip()
        ]

        return content, modifiers

    # -------------------------
    # LEGACY ITALIC SUPPORT
    # -------------------------

    if text.startswith("[ITALIC]") and text.endswith("[/ITALIC]"):

        text = text.replace("[ITALIC]", "")
        text = text.replace("[/ITALIC]", "")
        text = text.strip()

        return text, ["italic"]

    # -------------------------
    # NO MODIFIERS
    # -------------------------

    return text, []

# ==========================================================
# Panel Normalization
# ==========================================================

def _normalize_panel(slide: RawSlide) -> RawSlide:
    body = slide.body or []

    normalized_blocks = []

    panel_pdf = None

    for block in body:

        # Handle ParagraphBlock
        if isinstance(block, ParagraphBlock):
            text = block.text.strip()

            if text.startswith("[PDF:") and text.endswith("]"):
                panel_pdf = text.replace("[PDF:", "").replace("]", "").strip()
                continue

            text, modifiers = parse_style_modifiers(text)

            if text:
                normalized_blocks.append(
                    ParagraphBlock(
                        type="paragraph",
                        text=text,
                        image=block.image,
                        modifiers=modifiers
                    )
                )

        # Handle BulletsBlock ✅ NEW
        elif isinstance(block, BulletsBlock):
            items = [
                item.strip()
                for item in block.items
                if item and item.strip()
            ]

            if items:
                normalized_blocks.append(
                    BulletsBlock(
                        type="bullets",
                        items=items
                    )
                )

        else:
            raise ValueError(
                f"Panel slide {slide.slide_id} contains invalid block type"
            )

    return slide.model_copy(
        update={
            "body": normalized_blocks,
            "panel_pdf": panel_pdf
        }
    )

# ==========================================================
# Quiz Normalization
# ==========================================================

def _normalize_quiz(slide: RawSlide) -> RawSlide:
    questions = slide.quiz_questions or []

    if not questions:
        raise ValueError(
            f"Quiz slide {slide.slide_id} has no questions"
        )

    normalized_questions: List[RawQuizQuestion] = []

    for q in questions:
        normalized_questions.append(_normalize_question(q, slide.slide_id))

    slide = slide.model_copy(
        update={
            "quiz_type": "mcq",
            "quiz_questions": normalized_questions,
        }
    )

    return slide


def _normalize_question(
    question: RawQuizQuestion,
    slide_id: str,
) -> RawQuizQuestion:

    if not question.prompt or not question.prompt.strip():
        raise ValueError(
            f"Slide {slide_id} contains question with empty prompt"
        )

    options = question.options or []

    if len(options) < 2:
        raise ValueError(
            f"Slide {slide_id} question must have at least 2 options"
        )

    normalized_options: List[RawQuizOption] = []

    seen_ids = set()

    for opt in options:
        if not opt.id or not opt.text:
            raise ValueError(
                f"Slide {slide_id} has invalid option"
            )

        opt_id = opt.id.strip().upper()

        if opt_id in seen_ids:
            raise ValueError(
                f"Slide {slide_id} duplicate option id: {opt_id}"
            )

        seen_ids.add(opt_id)

        normalized_options.append(
            RawQuizOption(
                id=opt_id,
                text=opt.text.strip(),
            )
        )

    correct_id = question.correct_option_id

    if not correct_id:
        raise ValueError(
            f"Slide {slide_id} question missing correct_option_id"
        )

    correct_id = correct_id.strip().upper()

    if correct_id not in seen_ids:
        raise ValueError(
            f"Slide {slide_id} correct_option_id not found in options"
        )

    explanation = (
        question.explanation.strip()
        if question.explanation
        else None
    )

    return RawQuizQuestion(
        prompt=question.prompt.strip(),
        options=normalized_options,
        correct_option_id=correct_id,
        explanation=explanation,
    )


# ==========================================================
# Engage1 Normalization
# ==========================================================

def _normalize_engage1(slide: RawSlide) -> RawSlide:
    print("DEBUG ENGAGE1 SLIDE:")
    print("ID:", slide.slide_id)
    print("Header:", slide.header)
    print("Items:", slide.engage1_items)
    items = slide.engage1_items or []

    if not items:
        raise ValueError(
            f"Engage1 slide {slide.slide_id} missing items"
        )

    for item in items:
        if not item.label:
            raise ValueError(
                f"Engage1 slide {slide.slide_id} has unlabeled item"
            )

    return slide

# ==========================================================
# Engage2 Normalization
# ==========================================================

def _normalize_engage2(slide: RawSlide) -> RawSlide:

    intro = slide.engage2_intro or []
    layers = slide.engage2_layers or []

    if not intro:
        raise ValueError(
            f"Engage2 slide {slide.slide_id} missing intro"
        )

    if not layers:
        raise ValueError(
            f"Engage2 slide {slide.slide_id} missing reveal layers"
        )

    normalized_intro: List[ParagraphBlock] = []

    for block in intro:
        if not isinstance(block, ParagraphBlock):
            raise ValueError(
                f"Engage2 slide {slide.slide_id} contains invalid intro block"
            )

        text = block.text.strip()

        if text:
            normalized_intro.append(
                ParagraphBlock(
                    type="paragraph",
                    text=text,
                    image=block.image
                )
            )

    normalized_layers: List[ParagraphBlock] = []

    for layer in layers:
        if not isinstance(layer, ParagraphBlock):
            raise ValueError(
                f"Engage2 slide {slide.slide_id} contains invalid layer block"
            )

        text = layer.text.strip()

        if text:
            normalized_layers.append(
                ParagraphBlock(
                    type="paragraph",
                    text=text,
                    image=layer.image
                )
            )

    if not normalized_layers:
        raise ValueError(
            f"Engage2 slide {slide.slide_id} all reveal layers empty"
        )

    return slide.model_copy(
        update={
            "engage2_intro": normalized_intro,
            "engage2_layers": normalized_layers,
        }
    )

# ==========================================================
# Decision Normalization
# ==========================================================

def _normalize_decision(slide: RawSlide) -> RawSlide:

    buttons = slide.decision_buttons or []

    if len(buttons) != 2:
        raise ValueError(
            f"Decision slide {slide.slide_id} "
            f"requires exactly 2 buttons"
        )

    body = slide.body or []

    if not body:
        raise ValueError(
            f"Decision slide {slide.slide_id} "
            f"missing body content"
        )

    return slide

# ==========================================================
# Cleanup
# ==========================================================

def _remove_empty_slides(slides: List[RawSlide]) -> List[RawSlide]:
    cleaned: List[RawSlide] = []

    for slide in slides:
        if slide.slide_type == "panel" and not slide.body:
            continue

        if slide.slide_type == "quiz" and not slide.quiz_questions:
            continue

        cleaned.append(slide)

    return cleaned


def _reindex_slides(slides: List[RawSlide]) -> List[RawSlide]:
    reindexed: List[RawSlide] = []

    for idx, slide in enumerate(slides, start=1):
        slide = slide.model_copy(
            update={"slide_id": f"slide_{idx:03d}"}
        )
        reindexed.append(slide)

    return reindexed
