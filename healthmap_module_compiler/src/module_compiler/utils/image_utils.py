from PIL import Image
from pathlib import Path

def convert_to_webp(input_path: Path, output_path: Path, quality=80):
    try:
        with Image.open(input_path) as img:
            img = img.convert("RGB")

            output_path = output_path.with_suffix(".webp")

            img.save(output_path, "WEBP", quality=quality, method=6)

        return output_path.name

    except Exception as e:
        print(f"❌ Failed to convert {input_path}: {e}")
        return input_path.name