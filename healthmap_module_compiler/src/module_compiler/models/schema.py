from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from typing import Union, List, Dict

# -------------------------
# Quiz Models
# -------------------------

QuizType = Literal["mcq", "true_false"]


class QuizOption(BaseModel):
    id: str
    text: str


class QuizQuestion(BaseModel):
    prompt: str
    options: Optional[List[QuizOption]] = None
    correct_option_id: str
    explanation: Optional[str] = None


class QuizSlide(BaseModel):
    type: Literal["quiz"]
    quiz_scope: Literal["inline", "application", "final"] = "inline"
    quiz_type: QuizType
    questions: List[QuizQuestion]


# -------------------------
# Panel
# -------------------------

class PanelSlide(BaseModel):
    type: Literal["panel"]
    header: str
    body: List[Union[str, Dict]]
    image: Optional[str] = None


# -------------------------
# Engage 1 (Button Replace)
# -------------------------

class Engage1Item(BaseModel):
    label: str
    text: List[Union[str, Dict]]
    image: Optional[str]


class Engage1Slide(BaseModel):
    type: Literal["engage_1"]
    header: str
    intro: List[Union[str, Dict]]
    intro_image: Optional[str] = None
    items: List[Engage1Item]


# -------------------------
# Engage 2 (Progressive Build)
# -------------------------

class Engage2Layer(BaseModel):
    text: str
    image: Optional[str] = None


class Engage2Slide(BaseModel):
    type: Literal["engage_2"]
    header: str
    intro: str
    intro_image: Optional[str] = None
    layers: List[Engage2Layer]
    button_label: Optional[str] = Field(default="Continue")

# -------------------------
# Unified Slide Union
# -------------------------

Slide = PanelSlide | Engage1Slide | Engage2Slide | QuizSlide


# -------------------------
# Module Root
# -------------------------

class Module(BaseModel):
    module_id: str
    version: str = Field(default="1.0")
    slides: List[Slide]
