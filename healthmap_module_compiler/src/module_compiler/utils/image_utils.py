from PIL import Image, ImageSequence
from pathlib import Path

def convert_to_webp(input_path: Path, output_path: Path, quality=80):
    try:
        with Image.open(input_path) as img:

            output_path = output_path.with_suffix(".webp")

            # 🔥 Handle animated GIFs
            if getattr(img, "is_animated", False):
                MAX_FRAMES = 20   # 👈 PLACE IT RIGHT HERE

                frames = []

                durations = []

                for i, frame in enumerate(ImageSequence.Iterator(img)):
                    if i >= MAX_FRAMES:
                        print(f"⚠️ Truncated GIF to {MAX_FRAMES} frames: {input_path.name}")
                        break

                    dur = frame.info.get("duration", 100)
                    dur = max(20, int(dur))  # clamp to at least 20ms
                    durations.append(dur)
                    frame = frame.convert("RGB")
                    frames.append(frame)

                
                if not frames:
                    raise RuntimeError(f"No frames extracted from GIF: {input_path.name}")
                
                # Optional: normalize frame sizes
                base_size = frames[0].size
                frames = [f.resize(base_size) for f in frames]

                frames[0].save(
                    output_path,
                    format="WEBP",
                    save_all=True,
                    append_images=frames[1:],
                    duration=durations,
                    quality=quality,
                    method=6,
                    loop=2
                )

            else:
                img = img.convert("RGB")
                img.save(output_path, "WEBP", quality=quality, method=6)

        return output_path.name

    except Exception as e:
        print(f"❌ Failed to convert {input_path}: {e}")
        return input_path.name