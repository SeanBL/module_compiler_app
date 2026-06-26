import subprocess
from pathlib import Path


def compress_video(input_path: Path, output_path: Path) -> None:

    command = [
        "ffmpeg",
        "-y",

        "-i", str(input_path),

        # Preserve aspect ratio
        "-vf",
        "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",

        # Lower FPS
        "-r", "24",

        # Video codec
        "-c:v", "libx264",

        # Quality-based compression
        "-crf", "27",

        # Compression efficiency
        "-preset", "slow",

        # Android compatibility
        "-profile:v", "main",
        "-level", "3.1",
        "-pix_fmt", "yuv420p",

        # Audio
        "-c:a", "aac",
        "-b:a", "64k",
        "-ac", "1",
        "-ar", "22050",

        # Better streaming/loading
        "-movflags", "+faststart",

        str(output_path)
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg compression failed:\n{result.stderr}"
        )
    
def generate_video_poster(
    input_path: Path,
    poster_path: Path
) -> None:

    command = [
        "ffmpeg",
        "-y",

        "-i", str(input_path),

        # Grab frame at 1 second
        "-ss", "00:00:01",

        # Extract single frame
        "-vframes", "1",

        # Quality
        "-q:v", "2",

        str(poster_path)
    ]

    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Poster generation failed:\n{result.stderr}"
        )