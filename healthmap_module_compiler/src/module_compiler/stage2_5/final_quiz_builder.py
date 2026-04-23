from __future__ import annotations

from typing import List, Dict, Set

from ..models.raw_models import RawSlide, RawQuizQuestion


# ==========================================================
# Public Entry Point
# ==========================================================

def build_final_quiz(
    slides: List[RawSlide],
    include_inline: bool = False,
) -> List[RawSlide]:
    """
    Stage 2.5 — Final Quiz Builder

    Behavior:
    - Optionally collects ALL inline quiz questions
    - Merges them into the FINAL quiz
    - Removes duplicates (based on prompt text)
    - Keeps inline quiz slides intact (Option 1)

    Args:
        slides: normalized slides from Stage 2
        include_inline: whether to include inline quiz questions

    Returns:
        Updated slides list
    """

    if not include_inline:
        return slides

    # --------------------------------------------------
    # Step 1 — Collect inline questions
    # --------------------------------------------------
    inline_questions: List[RawQuizQuestion] = []

    for slide in slides:
        if (
            slide.slide_type == "quiz"
            and getattr(slide, "quiz_scope", None) == "inline"
        ):
            inline_questions.extend(slide.quiz_questions or [])

    if not inline_questions:
        return slides  # nothing to do

    # --------------------------------------------------
    # Step 2 — Find final quiz slide(s)
    # --------------------------------------------------
    final_indices = [
        i for i, s in enumerate(slides)
        if s.slide_type == "quiz"
        and getattr(s, "quiz_scope", None) == "final"
    ]

    # --------------------------------------------------
    # Step 3 — If no final quiz exists → create one
    # --------------------------------------------------
    if not final_indices:
        new_slide = RawSlide(
            slide_id="slide_temp_final",
            header="Final Quiz",
            slide_type="quiz",
            quiz_scope="final",
            quiz_type="mcq",
            quiz_questions=_deduplicate_questions(inline_questions),
        )

        slides.append(new_slide)
        return slides

    # --------------------------------------------------
    # Step 4 — Merge into LAST final quiz (recommended)
    # --------------------------------------------------
    final_index = final_indices[-1]
    final_slide = slides[final_index]

    existing_questions = final_slide.quiz_questions or []

    merged_questions = existing_questions + inline_questions

    deduped_questions = _deduplicate_questions(merged_questions)

    updated_slide = final_slide.model_copy(
        update={
            "quiz_questions": deduped_questions
        }
    )

    slides[final_index] = updated_slide

    return slides


# ==========================================================
# Deduplication Logic
# ==========================================================

def _deduplicate_questions(
    questions: List[RawQuizQuestion]
) -> List[RawQuizQuestion]:
    """
    Removes duplicate questions based on normalized prompt text.
    """

    seen: Set[str] = set()
    deduped: List[RawQuizQuestion] = []

    for q in questions:
        key = _normalize_prompt(q.prompt)

        if key in seen:
            continue

        seen.add(key)
        deduped.append(q)

    return deduped


def _normalize_prompt(text: str) -> str:
    """
    Normalize prompt for deduplication.
    """

    return " ".join(text.lower().split())