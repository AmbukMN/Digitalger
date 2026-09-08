# -*- coding: utf-8 -*-
"""
⚠️⚠️ BESTFILM-ИЙН ХӨТЧИЙН ICON ҮҮСГЭХ.

АСУУДАЛ: `src/app/icon.png` нь BestTV-ээс хуулагдсан (яг ижил
49,678 байт). Хэрэглэгчийн табанд, bookmark-д, гар утасны дэлгэц
дээр BESTTV-ИЙН ЛОГО харагдана.

ЯАГААД ЛОГОГ ШУУД АШИГЛАЖ БОЛОХГҮЙ ВЭ: лого нь тэмдэг + «bestFilm»
текст + уриаг агуулсан 500x421 зураг. 32x32 favicon болгож
багасгавал текст нь УНШИГДАХГҮЙ бөөгнөрөл болно.

ШИЙДЭЛ: логоны ЗӨВХӨН ТЭМДГИЙГ (дээд талын «B» киноны хальс)
таслаж, дөрвөлжин болгоно.

Ажиллуулах: python scripts/make-icons.py
"""
import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image

SRC = "public/brand/bestfilm-logo-dark.png"
OUT_DIR = "src/app"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
print(f"эх зураг: {w}x{h}")

# ── 1. ТЭМДГИЙН ХЭСГИЙГ ОЛОХ ────────────────────────────────────
#
# ⚠️ Тогтмол хувиар таслах нь ЭРСДЭЛТЭЙ — лого өөрчлөгдвөл
# буруу хэсэг гарна. Оронд нь ТУНГАЛАГ БУС пикселийн хүрээг
# олж, дээд 62%-ийг (тэмдэг) авна.
alpha = img.split()[3]
bbox = alpha.getbbox()
print(f"агуулгын хүрээ: {bbox}")

x0, y0, x1, y1 = bbox
content_h = y1 - y0

# ⚠️ Тэмдэг нь дээд ~62% (текст+уриа доод 38%)
mark_bottom = y0 + int(content_h * 0.62)
mark = img.crop((x0, y0, x1, mark_bottom))
mw, mh = mark.size
print(f"тэмдэг: {mw}x{mh}")

# ── 2. ДӨРВӨЛЖИН БОЛГОХ ─────────────────────────────────────────
#
# ⚠️ Тэмдгийг СУНГАХГҮЙ — харьцааг хадгалж, төвд байрлуулна.
# Сунгавал киноны хальс гажина.
side = max(mw, mh)
# ⚠️ 12% зай — icon нь дугуй хэлбэрт (iOS) таслагдахад ирмэг таарахгүй
pad = int(side * 0.12)
canvas_side = side + pad * 2

def build(size: int, bg: tuple | None) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    if bg:
        canvas.paste(Image.new("RGBA", (canvas_side, canvas_side), bg), (0, 0))
    canvas.alpha_composite(mark, ((canvas_side - mw) // 2, (canvas_side - mh) // 2))
    return canvas.resize((size, size), Image.LANCZOS)

# ── 3. ФАЙЛУУД ──────────────────────────────────────────────────
#
# icon.png       — хөтчийн таб. ⚠️ ТУНГАЛАГ дэвсгэртэй: хөтөч нь
#                  бараан/гэрэл горимд өөрөө өнгө тавина.
# apple-icon.png — iOS дэлгэцийн товч. ⚠️ ТУНГАЛАГ БОЛОХГҮЙ —
#                  iOS нь тунгалаг хэсгийг ХАР болгодог тул
#                  логоны хар тэмдэг үл үзэгдэнэ. Хар дэвсгэр өгнө.
jobs = [
    ("icon.png", 512, None),
    ("apple-icon.png", 180, (5, 5, 5, 255)),
]

for name, size, bg in jobs:
    out = build(size, bg)
    path = os.path.join(OUT_DIR, name)
    out.save(path, "PNG", optimize=True)
    print(f"  OK {path} — {size}x{size} ({os.path.getsize(path):,} байт)")

print("\nDONE")
