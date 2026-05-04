from __future__ import annotations
import sys
from pathlib import Path
from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    send_file,
    send_from_directory,
)
from werkzeug.utils import secure_filename

from compiler_bridge import run_compiler_pipeline
import zipfile
import tempfile
import shutil
import webbrowser
import threading
import mammoth
import json
import re



def get_base_path():
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

# -----------------------------
# Base paths
# -----------------------------
BASE_DIR = get_base_path()

if getattr(sys, 'frozen', False):
    RUNTIME_BASE = Path(tempfile.gettempdir()) / "module_compiler_runtime"
else:
    RUNTIME_BASE = BASE_DIR

RUNTIME_BASE.mkdir(parents=True, exist_ok=True)
(Path(tempfile.gettempdir()) / "data" / "assets").mkdir(parents=True, exist_ok=True)

COMPILER_ROOT = BASE_DIR / "healthmap_module_compiler"

UPLOAD_DIR = RUNTIME_BASE / "uploads"
BUILD_DIR = RUNTIME_BASE / "builds"
TEMP_DIR = RUNTIME_BASE / "temp"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
BUILD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".docx"}

# -----------------------------
# Flask paths (READ from MEIPASS)
# -----------------------------
if getattr(sys, 'frozen', False):
    FLASK_BASE = Path(sys._MEIPASS)
else:
    FLASK_BASE = BASE_DIR

app = Flask(
    __name__,
    template_folder=str(FLASK_BASE / "templates"),
    static_folder=str(FLASK_BASE / "static"),
)

app.secret_key = "replace-this-with-a-real-secret-key"


def inject_assets(temp_path: Path):
    """
    Copies extracted assets into compiler's expected data/assets folder.
    Returns backup path so we can restore later.
    """
    if getattr(sys, 'frozen', False):
        assets_target = Path(tempfile.gettempdir()) / "data" / "assets"
    else:
        assets_target = COMPILER_ROOT / "data" / "assets"

    assets_target.mkdir(parents=True, exist_ok=True)

    backup_dir = None

    # Backup existing assets
    if assets_target.exists():
        backup_dir = assets_target.parent / "assets_backup"
        if backup_dir.exists():
            shutil.rmtree(backup_dir)
        shutil.move(assets_target, backup_dir)

    # Find uploaded assets folder
    extracted_assets = [p for p in temp_path.rglob("*") if p.is_dir() and p.name.lower() == "assets"]
    if not extracted_assets:
        raise RuntimeError("No assets folder found in ZIP.")

    print("COPYING ASSETS FROM:", extracted_assets[0])
    print("TO:", assets_target)

    if not extracted_assets:
        raise RuntimeError("No assets folder found in ZIP.")

    shutil.copytree(extracted_assets[0], assets_target)

    return assets_target, backup_dir

def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/build", methods=["POST"])
def build_module():
    uploaded_file = request.files.get("zip_file")

    if not uploaded_file or uploaded_file.filename == "":
        flash("Please upload a ZIP file.", "error")
        return redirect(url_for("index"))

    if not uploaded_file.filename.lower().endswith(".zip"):
        flash("Only .zip files are allowed.", "error")
        return redirect(url_for("index"))

    try:
        # Step 1: Create temp directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            zip_path = temp_path / "upload.zip"
            uploaded_file.save(zip_path)

            # Step 2: Extract ZIP
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_path)

            print("\n=== DEBUG: DOCX FILE ===")
            docx_files = list(temp_path.rglob("*.docx"))
            for f in docx_files:
                print("DOCX:", f)

            print("\n=== DEBUG: ASSETS FOLDER DETECTION ===")
            asset_dirs = [p for p in temp_path.rglob("*") if p.is_dir() and p.name.lower() == "assets"]

            if not asset_dirs:
                print("❌ NO assets folder found")
            else:
                for d in asset_dirs:
                    print("FOUND assets folder:", d)

            print("\n=== DEBUG: SAMPLE IMAGES IN ASSETS ===")
            if asset_dirs:
                sample_images = list(asset_dirs[0].rglob("*"))
                for img in sample_images[:10]:  # only first 10
                    print("IMG:", img)

            print("=== END DEBUG ===\n")

            # Step 3: Find .docx
            docx_files = list(temp_path.rglob("*.docx"))

            if len(docx_files) == 0:
                flash("No .docx file found in ZIP.", "error")
                return redirect(url_for("index"))

            if len(docx_files) > 1:
                flash("Multiple .docx files found. Please include only one.", "error")
                return redirect(url_for("index"))

            docx_path = docx_files[0]

            # -----------------------------
            # Copy /resources → compiler raw resources
            # -----------------------------
            resource_dirs = list(temp_path.rglob("resources"))

            if resource_dirs:
                root_resources = resource_dirs[0]
                module_name = docx_path.stem

                raw_resources_target = (
                    COMPILER_ROOT
                    / "data"
                    / "raw"
                    / "resources"
                    / module_name
                )

                print("\n=== VERIFY RAW RESOURCE COPY ===")
                print("FOUND RESOURCES AT:", root_resources)
                print("TARGET:", raw_resources_target)

                if raw_resources_target.exists():
                    shutil.rmtree(raw_resources_target)

                raw_resources_target.mkdir(parents=True, exist_ok=True)

                shutil.copytree(root_resources, raw_resources_target, dirs_exist_ok=True)

                print("FILES COPIED:", list(raw_resources_target.iterdir()))
                print("================================\n")

            else:
                print("⚠️ No /resources folder found anywhere in ZIP")

            # Step 4: Inject assets into compiler environment
            assets_target = None
            backup_dir = None

            try:
                assets_target, backup_dir = inject_assets(temp_path)

                # Run compiler
                result = run_compiler_pipeline(docx_path, BUILD_DIR)

            finally:
                # Restore original assets
                if assets_target and assets_target.exists():
                    shutil.rmtree(assets_target)

                if backup_dir and backup_dir.exists():
                    shutil.move(backup_dir, assets_target)

            flash("Module built successfully.", "success")

            return render_template(
                "index.html",
                build_success=True,
                build_id=result["build_id"],
                annotated_available=True
            )

    except Exception as exc:
        # try to locate latest build folder
        latest_build = max(BUILD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, default=None)

        build_id = latest_build.name if latest_build else None

        flash(f"Build failed: {exc}", "error")

        return render_template(
            "index.html",
            build_failed=True,
            build_id=build_id,
            annotated_available=True
        )

@app.route("/download/<build_id>", methods=["GET"])
def download_build(build_id: str):
    zip_path = BUILD_DIR / build_id / "module_output.zip"

    if not zip_path.exists():
        flash("Build ZIP not found.", "error")
        return redirect(url_for("index"))

    output_dir = BUILD_DIR / build_id / "module_output"
    module_json_path = output_dir / "module.json"

    if module_json_path.exists():
        with open(module_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        title = data.get("module_title", "module")
        module_id = data.get("module_id", "0")

        safe_title = re.sub(r"\s+", "-", title.lower())
        safe_title = re.sub(r"[^a-z0-9\-_.]", "", safe_title)

        filename = f"{safe_title}_{module_id}.zip"
    else:
        filename = f"compiled_module_{build_id}.zip"

    return send_file(
        zip_path,
        as_attachment=True,
        download_name=filename,
    )


@app.route("/preview/<build_id>/")
def preview_module(build_id: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    return send_from_directory(output_dir, "index.html")


@app.route("/preview/<build_id>/<path:filename>", methods=["GET"])
def preview_assets(build_id: str, filename: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    return send_from_directory(output_dir, filename)

@app.route("/download-annotated/<build_id>")
def download_annotated(build_id):
    build_dir = BUILD_DIR / build_id
    doc_path = next(build_dir.glob("*_ANNOTATED.docx"), None)

    if not doc_path:
        flash("Annotated document not found.", "error")
        return redirect(url_for("index"))

    return send_file(doc_path, as_attachment=True)

@app.route("/preview-annotated/<build_id>")
def preview_annotated(build_id):
    build_dir = BUILD_DIR / build_id
    doc_path = next(build_dir.glob("*_ANNOTATED.docx"), None)

    if not doc_path:
        flash("Annotated document not found.", "error")
        return redirect(url_for("index"))

    with open(doc_path, "rb") as docx_file:
        result = mammoth.convert_to_html(docx_file)
        html = result.value

    return f"""
    <html>
    <head>
        <title>Annotated Preview</title>
        <style>
            body {{ font-family: Arial; padding: 20px; }}
        </style>
    </head>
    <body>
        {html}
    </body>
    </html>
    """

if __name__ == "__main__":
    def open_browser():
        webbrowser.open("http://127.0.0.1:5000")

    if __name__ == "__main__":
        threading.Timer(1.0, open_browser).start()
        app.run(host="127.0.0.1", port=5000, debug=False)