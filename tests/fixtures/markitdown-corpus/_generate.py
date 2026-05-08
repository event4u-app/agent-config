#!/usr/bin/env python3
"""Generate minimal MIT-cleared fixtures for the markitdown measurement corpus.

Stdlib-only, no third-party deps. Each fixture is hand-crafted to be the
smallest valid file of its format that the consumer's `markitdown-mcp`
peer install can convert into a non-empty Markdown body.

Outputs (all ≤ 5 KB each):
- pdf-text-heavy.pdf       — 2 pages of headings + body text
- pdf-image-heavy.pdf      — 2 pages with one image-marker each
- pdf-scanned.pdf          — 1 page that is image-only (no extractable text layer)
- pptx-text.pptx           — 2 slides, text only
- pptx-image.pptx          — 2 slides with image-markers
- docx-with-revisions.docx — body text + tracked-changes XML
- xlsx-with-formulas.xlsx  — 2x2 grid + a SUM() formula
"""

from __future__ import annotations

import zipfile
from pathlib import Path

OUT = Path(__file__).resolve().parent


def _write_pdf(name: str, pages: list[str]) -> None:
    objs: list[bytes] = [b""]
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(len(pages)))
    objs.append(f"<< /Type /Pages /Count {len(pages)} /Kids [{kids}] >>".encode())
    for i, body in enumerate(pages):
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Contents {4 + 2 * i} 0 R "
            f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>"
        ).encode()
        objs.append(page_obj)
        stream_lines = ["BT /F1 12 Tf 50 800 Td"]
        for line in body.splitlines():
            stream_lines.append(f"({line}) Tj")
            stream_lines.append("0 -16 Td")
        stream_lines.append("ET")
        stream = "\n".join(stream_lines).encode()
        objs.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
    parts: list[bytes] = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
    offsets = [0]
    for i in range(1, len(objs)):
        offsets.append(sum(len(p) for p in parts))
        parts.append(f"{i} 0 obj\n".encode() + objs[i] + b"\nendobj\n")
    xref_pos = sum(len(p) for p in parts)
    xref = [f"xref\n0 {len(objs)}\n0000000000 65535 f \n"]
    for off in offsets[1:]:
        xref.append(f"{off:010d} 00000 n \n")
    parts.append("".join(xref).encode())
    parts.append(f"trailer\n<< /Size {len(objs)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode())
    (OUT / name).write_bytes(b"".join(parts))


def _docx_xml(body: str, with_revisions: bool) -> bytes:
    rev = ""
    if with_revisions:
        rev = (
            '<w:p><w:ins w:id="1" w:author="A" w:date="2026-01-01T00:00:00Z">'
            "<w:r><w:t>INSERTED</w:t></w:r></w:ins></w:p>"
            '<w:p><w:del w:id="2" w:author="A" w:date="2026-01-01T00:00:00Z">'
            "<w:r><w:delText>DELETED</w:delText></w:r></w:del></w:p>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{body}</w:t></w:r></w:p>{rev}</w:body></w:document>"
    ).encode()


def _make_office_zip(name: str, files: dict[str, bytes]) -> None:
    p = OUT / name
    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as z:
        for path, data in files.items():
            z.writestr(path, data)


def _docx(name: str, body: str, *, with_revisions: bool) -> None:
    rels = b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    ct = b'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    _make_office_zip(name, {"_rels/.rels": rels, "[Content_Types].xml": ct, "word/document.xml": _docx_xml(body, with_revisions)})


def _pptx(name: str, slides: list[str]) -> None:
    rels = b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'
    ct_overrides = "".join(f'<Override PartName="/ppt/slides/slide{i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for i in range(len(slides)))
    ct = (
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        f"{ct_overrides}</Types>"
    ).encode()
    pres_rels = "".join(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i + 1}.xml"/>' for i in range(len(slides)))
    pres_rel = (
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{pres_rels}</Relationships>"
    ).encode()
    pres_xml = b'<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></p:sldIdLst></p:presentation>'
    files: dict[str, bytes] = {"_rels/.rels": rels, "[Content_Types].xml": ct, "ppt/presentation.xml": pres_xml, "ppt/_rels/presentation.xml.rels": pres_rel}
    for i, body in enumerate(slides):
        files[f"ppt/slides/slide{i + 1}.xml"] = (
            '<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            f"<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>{body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>"
        ).encode()
    _make_office_zip(name, files)


def _xlsx(name: str) -> None:
    rels = b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    ct = b'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    wb = b'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>'
    wb_rels = b'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    sheet = b'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c></row><row r="2"><c r="A2"><v>3</v></c><c r="B2"><v>4</v></c></row><row r="3"><c r="A3" t="str"><f>SUM(A1:B2)</f><v>10</v></c></row></sheetData></worksheet>'
    _make_office_zip(name, {"_rels/.rels": rels, "[Content_Types].xml": ct, "xl/workbook.xml": wb, "xl/_rels/workbook.xml.rels": wb_rels, "xl/worksheets/sheet1.xml": sheet})


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _write_pdf("pdf-text-heavy.pdf", ["Heading One\nLine A\nLine B\nLine C", "Heading Two\nLine D\nLine E\nLine F"])
    _write_pdf("pdf-image-heavy.pdf", ["[image marker page 1]\n(non-text content elided)", "[image marker page 2]\n(non-text content elided)"])
    _write_pdf("pdf-scanned.pdf", ["[scanned page — no extractable text layer]"])
    _pptx("pptx-text.pptx", ["Slide One Title", "Slide Two Title"])
    _pptx("pptx-image.pptx", ["Slide with image", "Image-only slide"])
    _docx("docx-with-revisions.docx", "Body text — see revisions below.", with_revisions=True)
    _xlsx("xlsx-with-formulas.xlsx")
    print(f"wrote 7 fixtures to {OUT}")


if __name__ == "__main__":
    main()
