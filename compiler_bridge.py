from pathlib import Path
import uuid
import shutil
import sys

BASE_DIR = Path(__file__).resolve().parent
COMPILER_ROOT = BASE_DIR / "healthmap_module_compiler"
SRC_PATH = COMPILER_ROOT / "src"

sys.path.insert(0, str(SRC_PATH))

from module_compiler.compile_module import compile_module
import time

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

    # Step 1: Define where compiler writes JSON (required arg)
    output_json = COMPILER_ROOT / "data" / "exports" / f"{input_docx.stem}.json"

    # Step 2: Run your compiler
    compile_module(input_docx, output_json)

    # Step 3: Locate runtime output folder (created by your compiler)
    export_dir = COMPILER_ROOT / "data" / "exports" / input_docx.stem

    if not export_dir.exists():
        raise RuntimeError("❌ Compiler did not produce expected output folder")

    # Step 4: Copy to Flask build folder
    final_output_dir = build_dir / "module_output"
    shutil.copytree(export_dir, final_output_dir)

    # Step 5: Zip it
    zip_path = build_dir / "module_output.zip"
    shutil.make_archive(str(zip_path).replace(".zip", ""), "zip", final_output_dir)

    return {
        "build_id": build_id,
        "output_dir": final_output_dir,
        "zip_path": zip_path,
        "preview_entry": final_output_dir / "index.html",
    }