from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel

from .blocks import Block


RawSlideType = Literal["panel", "engage1", "engage2", "quiz", "decision"]


class RawEngage1Item(BaseModel):
    label: str
    body: List[Block]
    image: Optional[str] = None
    notes: Optional[str] = None


class RawQuizOption(BaseModel):
    id: str
    text: str


class RawQuizQuestion(BaseModel):
    prompt: str
    options: List[RawQuizOption]
    correct_option_id: str
    explanation: Optional[str] = None


class RawSlide(BaseModel):
    slide_id: str
    header: str
    slide_type: RawSlideType

    optional: bool = False
    decision_buttons: Optional[List[str]] = None

    # shared
    notes: Optional[str] = None
    image: Optional[str] = None

    # panel
    body: Optional[List[Block]] = None

    # engage1
    engage1_intro: Optional[List[Block]] = None
    engage1_intro_image: Optional[str] = None
    engage1_items: Optional[List[RawEngage1Item]] = None

    # engage2
    engage2_intro: Optional[List[Block]] = None
    engage2_intro_image: Optional[str] = None
    engage2_layers: Optional[List[Block]] = None
    engage2_button_label: Optional[str] = None

    # quiz
    quiz_questions: Optional[List[RawQuizQuestion]] = None
    quiz_type: Optional[Literal["mcq", "true_false"]] = None
    quiz_scope: Optional[str] = None