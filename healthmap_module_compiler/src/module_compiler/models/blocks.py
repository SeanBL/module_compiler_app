from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    text: str
    image: Optional[str] = None
    modifiers: List[str] = []

class BulletsBlock(BaseModel):
    type: Literal["bullets"]
    items: List[BulletItem]

class BulletItem(BaseModel):
    text: str
    modifiers: list[str] = []


Block = ParagraphBlock | BulletsBlock