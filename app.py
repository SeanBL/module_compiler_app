from __future__ import annotations

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


BASE_DIR = Path(__file__).resolve().parent
COMPILER_ROOT = BASE_DIR / "healthmap_module_compiler"
UPLOAD_DIR = BASE_DIR / "work" / "uploads"
BUILD_DIR = BASE_DIR / "work" / "builds"
TEMP_DIR = BASE_DIR / "work" / "temp"

ALLOWED_EXTENSIONS = {".docx"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
BUILD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


app = Flask(__name__)
app.secret_key = "replace-this-with-a-real-secret-key"

def inject_assets(temp_path: Path):
    """
    Copies extracted assets into compiler's expected data/assets folder.
    Returns backup path so we can restore later.
    """
    assets_target = COMPILER_ROOT / "data" / "assets"

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
                build_id=result["build_id"]
            )

    except Exception as exc:
        flash(f"Build failed: {exc}", "error")
        return redirect(url_for("index"))


@app.route("/download/<build_id>", methods=["GET"])
def download_build(build_id: str):
    zip_path = BUILD_DIR / build_id / "module_output.zip"

    if not zip_path.exists():
        flash("Build ZIP not found.", "error")
        return redirect(url_for("index"))

    return send_file(
        zip_path,
        as_attachment=True,
        download_name=f"compiled_module_{build_id}.zip",
    )


@app.route("/preview/<build_id>/")
def preview_module(build_id: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    return send_from_directory(output_dir, "index.html")


@app.route("/preview/<build_id>/<path:filename>", methods=["GET"])
def preview_assets(build_id: str, filename: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    return send_from_directory(output_dir, filename)


if __name__ == "__main__":
    def open_browser():
        webbrowser.open("http://127.0.0.1:5000")

    if __name__ == "__main__":
        threading.Timer(1.0, open_browser).start()
        app.run(host="127.0.0.1", port=5000, debug=False)