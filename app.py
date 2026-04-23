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


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "work" / "uploads"
BUILD_DIR = BASE_DIR / "work" / "builds"
TEMP_DIR = BASE_DIR / "work" / "temp"

ALLOWED_EXTENSIONS = {".docx"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
BUILD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


app = Flask(__name__)
app.secret_key = "replace-this-with-a-real-secret-key"


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/build", methods=["POST"])
def build_module():
    uploaded_file = request.files.get("docx_file")

    if not uploaded_file or uploaded_file.filename == "":
        flash("Please choose a Word document (.docx).", "error")
        return redirect(url_for("index"))

    if not allowed_file(uploaded_file.filename):
        flash("Only .docx files are allowed.", "error")
        return redirect(url_for("index"))

    safe_name = secure_filename(uploaded_file.filename)
    upload_path = UPLOAD_DIR / safe_name
    uploaded_file.save(upload_path)

    try:
        result = run_compiler_pipeline(upload_path, BUILD_DIR)

        flash("Module built successfully.", "success")
        return render_template(
            "index.html",
            build_success=True,
            build_id=result["build_id"],
            zip_name=result["zip_path"].name,
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


@app.route("/preview/<build_id>", methods=["GET"])
def preview_module(build_id: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    index_file = output_dir / "index.html"

    if not index_file.exists():
        flash("Preview files not found.", "error")
        return redirect(url_for("index"))

    return send_from_directory(output_dir, "index.html")


@app.route("/preview/<build_id>/<path:filename>", methods=["GET"])
def preview_assets(build_id: str, filename: str):
    output_dir = BUILD_DIR / build_id / "module_output"
    return send_from_directory(output_dir, filename)


if __name__ == "__main__":
    app.run(debug=True)