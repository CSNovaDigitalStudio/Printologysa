import json
import re
import unicodedata
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "demo and files" / "files"
OUT_DIR = ROOT / "images" / "catalog"
OUT_JSON = ROOT / "catalog-products.json"


def slugify(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value or "item"


def render_crop(page, rect, out_path, zoom=1.35):
    page_rect = page.rect
    rect = fitz.Rect(
        max(page_rect.x0, rect.x0),
        max(page_rect.y0, rect.y0),
        min(page_rect.x1, rect.x1),
        min(page_rect.y1, rect.y1),
    )
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out_path)
    optimize_image(out_path)


def optimize_image(path):
    img = Image.open(path).convert("RGB")
    bg = Image.new("RGB", img.size, "white")
    diff = Image.eval(ImageChops.difference(img, bg), lambda px: 255 if px > 18 else 0)
    bbox = diff.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.thumbnail((900, 900), Image.Resampling.LANCZOS)
    img.save(path, quality=78, optimize=True)


try:
    from PIL import ImageChops
except ImportError:  # pragma: no cover
    ImageChops = None


def image_blocks(page):
    blocks = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] == 1:
            rect = fitz.Rect(block["bbox"])
            blocks.append((rect.get_area(), rect))
    return sorted(blocks, key=lambda item: item[0], reverse=True)


def largest_product_rect(page, skip_full_width_footer=True):
    candidates = []
    for area, rect in image_blocks(page):
        width_ratio = rect.width / page.rect.width
        height_ratio = rect.height / page.rect.height
        if area < 8000:
            continue
        if skip_full_width_footer and width_ratio > 0.9 and rect.y0 > page.rect.height * 0.7:
            continue
        if height_ratio < 0.12:
            continue
        candidates.append(rect)
    if not candidates:
        return fitz.Rect(0, 0, page.rect.width, page.rect.height * 0.62)
    rect = candidates[0]
    return fitz.Rect(rect.x0 - 8, rect.y0 - 8, rect.x1 + 8, rect.y1 + 8)


def page_lines(page):
    return [line.strip() for line in page.get_text("text").splitlines() if line.strip()]


def value_after(lines, label):
    for index, line in enumerate(lines):
        if line.upper().rstrip(":") == label.upper().rstrip(":") and index + 1 < len(lines):
            nxt = lines[index + 1].strip()
            if nxt.startswith("•"):
                return nxt.replace("•", "").strip()
            return nxt
    return ""


def find_first(lines, prefix):
    for line in lines:
        if line.startswith(prefix):
            return line
    return ""


def add_item(items, source, category, name, image, description="", material="", size="", moq="", price="", page=None):
    items.append({
        "id": len(items) + 1,
        "source": source,
        "category": category,
        "name": name,
        "description": description,
        "material": material,
        "size": size,
        "moq": moq,
        "page": page,
        "image": image.replace("\\", "/"),
    })


def build_socks(items):
    pdf = PDF_DIR / "Custom Branded Socks Catalogue.pdf"
    doc = fitz.open(pdf)
    for page_index in range(2, 13):
        page = doc[page_index]
        lines = page_lines(page)
        page_num = page_index + 1
        try:
            footer_index = lines.index("Trade Only Supplier. Images Are Illustrative.")
        except ValueError:
            footer_index = len(lines)
        name = lines[footer_index - 2]
        description = lines[footer_index - 1]
        material = ""
        for idx, line in enumerate(lines):
            if line == "• Polyester Nylon Blend":
                material = "Polyester Nylon Blend"
            if line == "• Wool Blend":
                material = "Wool Blend"
        size = value_after(lines, "SIZE")
        length = value_after(lines, "LENGTH")
        moq = value_after(lines, "MOQ")
        image_name = f"socks-{slugify(name)}.jpg"
        image_path = OUT_DIR / image_name
        rect = largest_product_rect(page, skip_full_width_footer=False)
        rect.y1 = min(rect.y1, page.rect.height - 66)
        render_crop(page, rect, image_path)
        add_item(
            items,
            "Custom Branded Socks Catalogue.pdf",
            "Socks and Sleeves",
            name.title().replace("Uv ", "UV "),
            f"images/catalog/{image_name}",
            description.title().replace("Spf", "SPF").replace("Uv", "UV"),
            material,
            f"{size}; {length}" if length else size,
            moq,
            "Quote",
            page_num,
        )


def build_bags(items):
    pdf = PDF_DIR / "Upstyled Bags Catalogue_2026_02_20_V4_LQ (1).pdf"
    doc = fitz.open(pdf)
    for page_index in range(5, len(doc)):
        page = doc[page_index]
        lines = page_lines(page)
        page_num = page_index + 1
        product_lines = [line for line in lines if line.startswith("Pg ")]
        if not product_lines:
            continue
        pg_index = lines.index(product_lines[0])
        name = lines[pg_index - 1]
        spec_name = lines[pg_index - 2] if pg_index >= 2 else ""
        material = find_first(lines, "Material:")
        size = find_first(lines, "Size:") or find_first(lines, "Open Size:")
        moq = find_first(lines, "MOQ:")
        image_name = f"bags-{slugify(name)}.jpg"
        image_path = OUT_DIR / image_name
        render_crop(page, largest_product_rect(page), image_path)
        add_item(
            items,
            "Upstyled Bags Catalogue_2026_02_20_V4_LQ (1).pdf",
            "Bags and Travel",
            clean_title(name),
            f"images/catalog/{image_name}",
            clean_title(spec_name.replace(" SPECIFICATIONS", "")),
            material.replace("Material:", "").strip(),
            size.replace("Size:", "").replace("Open Size:", "Open size:").strip(),
            moq.replace("MOQ:", "").strip(),
            "Quote",
            page_num,
        )


def clean_title(value):
    value = value.replace("St ", "St. ")
    value = value.replace("  ", " ")
    return value.title().replace("Xl", "XL").replace("Dtf", "DTF").replace("Mini-Midi", "Mini-Midi")


def crop_manual(pdf_name, crops, prefix, items, source, category):
    pdf = next(PDF_DIR.glob(pdf_name))
    doc = fitz.open(pdf)
    page = doc[0]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for crop in crops:
        name, description, material, size, moq, price, box = crop
        image_name = f"{prefix}-{slugify(name)}.jpg"
        out_path = OUT_DIR / image_name
        rect = fitz.Rect(box[0] / 2, box[1] / 2, box[2] / 2, box[3] / 2)
        render_crop(page, rect, out_path, zoom=1.9)
        add_item(items, source, category, name, f"images/catalog/{image_name}", description, material, size, moq, price, 1)


def build_display(items):
    crops = [
        ("Balloon Banner", "Small, medium, and large balloon display banners.", "Stretch Polyester; aluminium pole; fibreglass", "Small: 850 x 1200mm; Medium: 900 x 1600mm; Large: 900 x 1900mm", "", "", (410, 1080, 626, 1608)),
        ("Flare Arch Banner", "Large branded arch for events and activations.", "Stretch Polyester; fibreglass rods; steel base", "4000 x 2700mm", "", "", (18, 1598, 328, 2128)),
        ("Event Bin", "Functional branded event bin.", "Oxford; fibreglass", "700 x 850mm", "", "", (324, 2116, 626, 2646)),
        ("Arch Feather Banner", "Arch feather banner for sport, events, and outdoor visibility.", "Ultrasheen; fibreglass rods; cross base", "3800 x 2700mm", "", "", (18, 2636, 328, 3156)),
        ("Directors Chair", "Branded steel director chair with back, seat, or full branding options.", "Gazebo Canvas; steel frame", "440 x 480 x 780mm", "", "", (324, 3150, 626, 3654)),
    ]
    crop_manual("Email Promo - New Display Products*.pdf", crops, "display", items, "Email Promo - New Display Products (6 March 2026) ..pdf", "Displays")


def build_notebooks(items):
    crops = [
        ("Jotly Full Colour Laminated Notebook", "A4 full-colour laminated notebook with branded cover and custom insert options.", "Un-padded cover", "A4", "", "Quote", (16, 800, 542, 1230)),
        ("Halo Full Colour Laminated Notebook", "A5 wire-bound laminated notebook with customisation options.", "Un-padded cover", "A5", "", "Quote", (16, 1232, 542, 1680)),
        ("Quill Full-Colour Laminated Diary", "A4 full-colour laminated diary with branded pages and optional extras.", "Un-padded cover", "A4", "", "Quote", (16, 1680, 542, 2140)),
        ("Rolla Full-Colour Padded Laminated Diary", "A4 padded laminated diary with branded cover, ribbons, and optional metal corners.", "Padded cover", "A4", "", "Quote", (16, 2140, 542, 2600)),
    ]
    crop_manual("Email Promo - Put Your Clients*Brands on Every Desk With Custom Notebooks & Diaries.pdf", crops, "notebook", items, "Email Promo - Put Your Clients' Brands on Every Desk With Custom Notebooks & Diaries.pdf", "Notebooks and Diaries")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    build_socks(items)
    build_bags(items)
    build_display(items)
    build_notebooks(items)
    OUT_JSON.write_text(json.dumps(items, indent=2), encoding="utf-8")
    print(f"Wrote {len(items)} items to {OUT_JSON}")


if __name__ == "__main__":
    main()
