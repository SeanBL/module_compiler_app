from __future__ import annotations
import re
import json
from pathlib import Path
import argparse
import shutil
import re

from .stage1.structural_extractor import extract_raw_slides
from .stage2.normalize import normalize_slides
from .stage2_5.final_quiz_builder import build_final_quiz
from .runtime_builder import build_module
from .utils.image_utils import convert_to_webp
from .utils.video_utils import (
    compress_video,
    generate_video_poster
)
from .utils.annotate_doc import generate_annotated_doc

STRICT_ASSET_MODE = True  # Fail-fast if asset missing
ENABLE_VIDEO_COMPRESSION = True
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BUILD_ROOT = PROJECT_ROOT / "work" / "builds"

def extract_slide_id_from_error(msg: str) -> str | None:
    match = re.search(r"(slide_\d{3})", msg)
    return match.group(1) if match else None

def compile_module(input_path: Path, output_path: Path, build_dir: Path | None = None) -> None:
    if build_dir:
        annotated_doc_path = build_dir / f"{input_path.stem}_ANNOTATED.docx"
    else:
        annotated_doc_path = output_path.parent / f"{input_path.stem}_ANNOTATED.docx"

    error_slide_id = None

    try:
        stage1_output = extract_raw_slides(input_path)
    except Exception as e:
        error_slide_id = extract_slide_id_from_error(str(e))

        generate_annotated_doc(
            input_path,
            annotated_doc_path,
            error_slide_id=error_slide_id
        )

        raise RuntimeError(
            f"{str(e)}\n\n👉 See annotated document below."
        )

    # ✅ ALWAYS generate annotated doc on success (no highlight)
    generate_annotated_doc(
        input_path,
        annotated_doc_path,
        error_slide_id=None
    )

    raw_slides = stage1_output["slides"]

    # Step 2: Normalize (Stage 2)
    try:
        normalized_slides = normalize_slides(raw_slides)
    except Exception as e:
        raise RuntimeError(
            f"{str(e)}\n\n"
            f"👉 See annotated document:\n{annotated_doc_path}"
        )

    # Debug counts
    print(f"Stage 1 slides: {len(raw_slides)}")
    print(f"Stage 2 slides: {len(normalized_slides)}")

    # Step 2.5: Build Final Quiz (merge inline → final)
    normalized_slides = build_final_quiz(
        normalized_slides,
        include_inline=True
    )

    # --------------------------------------------------
    # 🔍 DEBUG: Count inline + final quiz questions
    # --------------------------------------------------

    inline_count = 0
    final_count = 0

    for slide in normalized_slides:
        if getattr(slide, "slide_type", None) == "quiz":
            scope = getattr(slide, "quiz_scope", None)

            if scope == "inline":
                inline_count += len(slide.quiz_questions or [])

            if scope == "final":
                final_count += len(slide.quiz_questions or [])

    print("🧠 INLINE QUESTION COUNT:", inline_count)
    print("🎯 FINAL QUESTION COUNT:", final_count)

    # Step 3: Build runtime module
    module = build_module(
        module_id=stage1_output["module_id"],
        raw_slides=normalized_slides,
    )

    # Step 4: Write JSON (development output copy)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    final_json = {
        "module_title": stage1_output["module_title"],
        "module_id": stage1_output["module_id"],
        "version": "1.0",
        "slides": [s.model_dump() for s in module.slides]
    }
    print("FINAL JSON:", final_json)

    output_path.write_text(
        json.dumps(final_json, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Step 5: Package runtime
    package_runtime(module, input_path, stage1_output)

    print(f"✅ Compiled module: {input_path.name}")
    print(f"📄 Slides: {len(module.slides)}")
    print(f"📦 Output: {output_path}")


# --------------------------------------------------
# 🔹 Asset Utilities
# --------------------------------------------------

def normalize_filename(name: str) -> str:
    name = name.strip().lower()
    name = name.replace("&", "and")
    name = re.sub(r"\s+", "-", name)
    name = re.sub(r"[^a-z0-9\-_.]", "", name)
    return name

def build_package_name(module_title: str, module_id: int | str) -> str:
    safe_title = normalize_filename(module_title)
    return f"{safe_title}_{module_id}"

def collect_image_references(module):
    images = set()

    for slide in module.slides:

        if hasattr(slide, "image") and slide.image:
            images.add(slide.image)

        if hasattr(slide, "intro_image") and slide.intro_image:
            images.add(slide.intro_image)

        if slide.type == "engage_1":
            for item in slide.items:
                if item.image:
                    images.add(item.image)

        if slide.type == "engage_2":
            for layer in slide.layers:
                if layer.image:
                    images.add(layer.image)

    return images


def stage3_audit(module, export_assets_dir: Path):
    print("\n🔍 Stage 3 Validation Audit")
    print("--------------------------------------------------")

    referenced = collect_image_references(module)
    exported = {p.name for p in export_assets_dir.iterdir() if p.is_file()}

    errors = 0

    # Check missing references
    for img in referenced:
        if img not in exported:
            print(f"❌ JSON references missing asset: {img}")
            errors += 1

    # Check normalization + unused
    for asset in exported:
        if asset != normalize_filename(asset):
            print(f"❌ Asset not normalized: {asset}")
            errors += 1

        if asset not in referenced:
            print(f"⚠️ Unused exported asset: {asset}")

    if errors == 0:
        print("✅ Stage 3 audit passed")
    else:
        raise RuntimeError("❌ Stage 3 audit failed")

    print("--------------------------------------------------\n")


# --------------------------------------------------
# 🔹 Runtime Packaging
# --------------------------------------------------

def package_runtime(module, input_path: Path, stage1_output) -> None:
    BASE_DIR = Path(__file__).resolve().parent
    PROJECT_ROOT = BASE_DIR.parents[1]

    templates_dir = BASE_DIR / "stage3" / "templates"
    assets_source_dir = PROJECT_ROOT / "data" / "assets"
    package_name = build_package_name(
        stage1_output["module_title"],
        stage1_output["module_id"]
    )

    export_dir = PROJECT_ROOT / "data" / "exports" / package_name
    export_assets_dir = export_dir / "assets"

    # Clean export folder
    if export_dir.exists():
        shutil.rmtree(export_dir)

    export_dir.mkdir(parents=True, exist_ok=True)
    export_assets_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------
    # 🔹 Resource Processing (PDFs)
    # --------------------------------------------------

    resources_source_dir = input_path.parent / "resources" / input_path.stem
    export_resources_dir = export_assets_dir / "resources"

    export_resources_dir.mkdir(parents=True, exist_ok=True)

    if resources_source_dir.exists():
        for file in resources_source_dir.iterdir():
            if file.is_file():
                shutil.copy(file, export_resources_dir / file.name)
                print(f"[Resource] Copied: {file.name}")
    else:
        print("[Resource] No resources folder found for this module.")

    # Copy runtime templates
    for filename in [
        "index.html",
        "runtime_core.js",
        "runtime_drawer.js",
        "runtime_engage.js",
        "runtime_resume.js",
        "runtime.js",
        "runtime_state.js",
        "runtime_quiz.js",
        "runtime_bridge.js",
        "styles.css"
    ]:
        shutil.copy(templates_dir / filename, export_dir / filename)

    # --------------------------------------------------
    # 🔹 Asset Processing
    # --------------------------------------------------

    used_images = collect_image_references(module)
    missing_assets = []

    # Build case-insensitive lookup
    source_files = list(assets_source_dir.iterdir())
    asset_lookup = {}

    for p in source_files:
        if p.is_file():
            key = normalize_filename(p.stem)
            if key in asset_lookup:
                print(f"⚠️ WARNING: Duplicate asset stem detected: {p.stem}")
            asset_lookup[key] = p

    filename_map = {}

    for img_name in used_images:

        key = normalize_filename(img_name)

        if key not in asset_lookup:
            missing_assets.append(img_name)
            continue

        source_path = asset_lookup[key]

        ext = source_path.suffix.lower()

        SUPPORTED_IMAGE_EXTENSIONS = (
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
            ".gif",
            ".svg"
        )

        SUPPORTED_VIDEO_EXTENSIONS = (
            ".mp4",
            ".webm"
        )

        SUPPORTED_MEDIA_EXTENSIONS = (
            *SUPPORTED_IMAGE_EXTENSIONS,
            *SUPPORTED_VIDEO_EXTENSIONS
        )

        if ext not in SUPPORTED_MEDIA_EXTENSIONS:
            continue
        
        print(f"[Asset] Processing: {source_path.name} (ext={ext})")

        # --------------------------------------------------
        # Raster Images → Convert to WebP
        # --------------------------------------------------

        RASTER_IMAGE_EXTENSIONS = (
            ".png",
            ".jpg",
            ".jpeg",
            ".gif"
        )

        if ext in RASTER_IMAGE_EXTENSIONS:

            new_filename = normalize_filename(source_path.stem) + ".webp"
            target_path = export_assets_dir / new_filename

            convert_to_webp(source_path, target_path)

            filename_map[img_name] = new_filename

        # --------------------------------------------------
        # SVG → Copy directly
        # --------------------------------------------------

        elif ext == ".svg":

            normalized_name = normalize_filename(source_path.name)
            target_path = export_assets_dir / normalized_name

            shutil.copy(source_path, target_path)

            filename_map[img_name] = normalized_name

        # --------------------------------------------------
        # Video → Copy directly (for now)
        # --------------------------------------------------

        elif ext in SUPPORTED_VIDEO_EXTENSIONS:

            normalized_name = normalize_filename(source_path.name)
            target_path = export_assets_dir / normalized_name

            if ENABLE_VIDEO_COMPRESSION:

                try:

                    print(f"[Video] Compressing: {source_path.name}")

                    compress_video(source_path, target_path)

                    print(f"[Video] Compression complete: {normalized_name}")

                except Exception as e:

                    print(f"⚠️ Video compression failed: {source_path.name}")
                    print(f"⚠️ Reason: {e}")
                    print("⚠️ Falling back to original video...")

                    shutil.copy(source_path, target_path)

            else:

                print(f"[Video] Copying without compression: {source_path.name}")

                shutil.copy(source_path, target_path)

            # --------------------------------------------------
            # Generate Poster Frame
            # --------------------------------------------------

            try:

                poster_filename = (
                    Path(normalized_name).stem + "_poster.jpg"
                )

                poster_path = export_assets_dir / poster_filename

                generate_video_poster(
                    target_path,
                    poster_path
                )

                print(f"[Video] Poster created: {poster_filename}")

            except Exception as e:

                print(f"⚠️ Poster generation failed: {normalized_name}")
                print(f"⚠️ Reason: {e}")
            filename_map[img_name] = normalized_name

        # --------------------------------------------------
        # Already WebP
        # --------------------------------------------------

        elif ext == ".webp":

            normalized_name = normalize_filename(source_path.name)
            target_path = export_assets_dir / normalized_name

            shutil.copy(source_path, target_path)

            filename_map[img_name] = normalized_name

    if missing_assets:
        missing_assets_sorted = sorted(set(missing_assets))
        raise RuntimeError(
            "❌ Missing assets:\n" + "\n".join(f"- {a}" for a in missing_assets_sorted)
        )

    # --------------------------------------------------
    # 🔹 Update module object with normalized filenames
    # --------------------------------------------------

    for slide in module.slides:

        if hasattr(slide, "image") and slide.image in filename_map:
            slide.image = filename_map[slide.image]

        if hasattr(slide, "intro_image") and slide.intro_image in filename_map:
            slide.intro_image = filename_map[slide.intro_image]

        if slide.type == "engage_1":
            for item in slide.items:
                if item.image in filename_map:
                    item.image = filename_map[item.image]

        if slide.type == "engage_2":
            for layer in slide.layers:
                if layer.image in filename_map:
                    layer.image = filename_map[layer.image]

    # --------------------------------------------------
    # 🔹 Collect Resources Automatically
    # --------------------------------------------------

    resources = []

    resources_source_dir = input_path.parent / "resources" / input_path.stem

    if resources_source_dir.exists():
        for file in resources_source_dir.iterdir():
            if file.is_file() and file.suffix.lower() == ".pdf":
                resources.append({
                    "title": file.stem.replace("-", " "),
                    "file": file.name
                })
                
    # ✅ Sort alphabetically (case-insensitive)
    resources.sort(key=lambda r: r["title"].lower())

    # --------------------------------------------------
    # 🔹 Write final module.json
    # --------------------------------------------------

    (export_dir / "module.json").write_text(
        json.dumps({
            "module_title": stage1_output["module_title"],
            "module_id": stage1_output["module_id"],
            "version": "1.0",
            "resources": resources,
            "slides": [s.model_dump() for s in module.slides]
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    # --------------------------------------------------
    # 🔹 Stage 3 Audit
    # --------------------------------------------------

    stage3_audit(module, export_assets_dir)

    print(f"📦 Runtime package created at: {export_dir}")


# --------------------------------------------------
# CLI
# --------------------------------------------------

def _auto_detect_input() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    raw_dir = project_root / "data" / "raw"

    if not raw_dir.exists():
        raise SystemExit(f"❌ data/raw directory not found at {raw_dir}")

    docx_files = list(raw_dir.glob("*.docx"))

    if len(docx_files) == 0:
        raise SystemExit("❌ No .docx files found in data/raw")

    if len(docx_files) > 1:
        names = "\n".join(str(p.name) for p in docx_files)
        raise SystemExit(
            f"❌ Multiple .docx files found in data/raw:\n{names}\n"
            "Please specify --in explicitly."
        )

    return docx_files[0]


def main():
    parser = argparse.ArgumentParser(
        description="Compile Word blueprint into runtime JSON"
    )
    parser.add_argument("--in", dest="input_path", required=False)
    parser.add_argument("--out", dest="output_path", required=False)
    parser.add_argument("--debug", action="store_true")

    args = parser.parse_args()

    if args.input_path:
        input_path = Path(args.input_path)
    else:
        input_path = _auto_detect_input()
        print(f"📄 Auto-detected input: {input_path.name}")

    if not input_path.exists():
        raise SystemExit(f"❌ Input file not found: {input_path}")

    if args.output_path:
        output_path = Path(args.output_path)
    else:
        output_path = Path("data") / "exports" / f"{input_path.stem}.json"

    compile_module(input_path, output_path)


if __name__ == "__main__":
    main()