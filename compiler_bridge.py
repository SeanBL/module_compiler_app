from pathlib import Path
import uuid
import shutil
import sys
import tempfile



BASE_DIR = Path(__file__).resolve().parent
COMPILER_ROOT = BASE_DIR / "healthmap_module_compiler"


if getattr(sys, 'frozen', False):
    RUNTIME_BASE = Path(tempfile.gettempdir()) / "module_compiler_runtime"
else:
    RUNTIME_BASE = COMPILER_ROOT / "data"

RUNTIME_BASE.mkdir(parents=True, exist_ok=True)

from module_compiler.compile_module import compile_module
import time

if not getattr(sys, 'frozen', False):
    SRC_PATH = COMPILER_ROOT / "src"
    sys.path.insert(0, str(SRC_PATH))


def cleanup_old_builds(builds_root: Path, max_age_hours: int = 24):
    now = time.time()

    for build in builds_root.iterdir():
        if not build.is_dir():
            continue

        age = now - build.stat().st_mtime

        if age > max_age_hours * 3600:
            shutil.rmtree(build, ignore_errors=True)

def run_compiler_pipeline(input_docx: Path, builds_root: Path) -> dict:
    cleanup_old_builds(builds_root)
    build_id = uuid.uuid4().hex[:8]

    build_dir = builds_root / build_id
    build_dir.mkdir(parents=True, exist_ok=True)

    # Clean previous exports (prevents stale builds)
    export_root = RUNTIME_BASE / "exports"

    if export_root.exists():
        shutil.rmtree(export_root)

    export_root.mkdir(parents=True, exist_ok=True)

    # Step 1: Define where compiler writes JSON (required arg)
    output_json = RUNTIME_BASE / "exports" / f"{input_docx.stem}.json"
    output_json.parent.mkdir(parents=True, exist_ok=True)

    # Step 2: Run your compiler
    try:
        compile_module(input_docx, output_json, build_dir=build_dir)
    except Exception as e:
        print("🔥 COMPILER ERROR:", str(e))
        raise RuntimeError(str(e))

    # Step 3: Locate runtime output folder (created by your compiler)
    export_dir = Path(tempfile.gettempdir()) / "data" / "exports" / input_docx.stem
    print("EXPORT DIR:", export_dir)
    print("EXISTS:", export_dir.exists())

    if not export_dir.exists():
        raise RuntimeError(
            f"Export directory missing: {export_dir}\n\n"
            "👉 See annotated document below."
        )

    # Step 4: Copy to Flask build folder
    final_output_dir = build_dir / "module_output"
    if final_output_dir.exists():
        shutil.rmtree(final_output_dir)

    shutil.copytree(export_dir, final_output_dir)

    # Step 5: Zip it
    zip_path = build_dir / "module_output.zip"
    shutil.make_archive(str(zip_path).replace(".zip", ""), "zip", final_output_dir)

    annotated_doc = next(build_dir.glob("*_ANNOTATED.docx"), None)
    return {
        "build_id": build_id,
        "output_dir": final_output_dir,
        "zip_path": zip_path,
        "preview_entry": final_output_dir / "index.html",
        "annotated_doc": annotated_doc,
    }