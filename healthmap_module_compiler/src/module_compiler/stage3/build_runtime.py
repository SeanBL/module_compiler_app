from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import List

from ..models.raw_models import RawSlide


TEMPLATES_DIR = Path(__file__).parent / "templates"


def build_runtime(slides: List[RawSlide], output_dir: Path) -> None:
    """
    Stage 3 Runtime Builder.

    Takes normalized slides and produces:
        index.html
        runtime.js
        styles.css
        module.json

    inside output_dir.
    """
    print("🚨 BUILD_RUNTIME FILE LOADED:", __file__)
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # ---------------------------------
    # 1. Write module.json
    # ---------------------------------
    module_data = {
        "version": 1,
        "slides": [slide.model_dump() for slide in slides],
    }

    module_json_path = output_dir / "module.json"

    with module_json_path.open("w", encoding="utf-8") as f:
        json.dump(module_data, f, indent=2, ensure_ascii=False)

    # ---------------------------------
    # 2. Copy runtime templates
    # ---------------------------------
    for file in TEMPLATES_DIR.iterdir():
        print("🔥 USING TEMPLATES DIR:", TEMPLATES_DIR)
        if file.is_file():
            shutil.copyfile(file, output_dir / file.name)