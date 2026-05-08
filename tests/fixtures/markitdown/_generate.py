"""Stdlib-only generator for the markitdown smoke-test fixtures.

Produces three tiny but valid documents:

* `sample.pdf`  — minimal PDF 1.4 with one text-bearing page.
* `sample.docx` — minimal Office Open XML WordprocessingML document.
* `sample.pptx` — minimal Office Open XML PresentationML deck (one slide).

No third-party dependencies. Re-run:

    python3 tests/fixtures/markitdown/_generate.py
"""

from __future__ import annotations

import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
HEADLINE = "Hello markitdown"
BODY = "Smoke-test fixture for the markitdown skill."


def _build_pdf() -> bytes:
    # Minimal PDF 1.4 — one page, Helvetica, two text lines. xref hand-aligned.
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Count 1 /Kids [3 0 R] >>")
    objects.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
    )
    stream = (
        b"BT /F1 18 Tf 72 720 Td (" + HEADLINE.encode("ascii") + b") Tj ET\n"
        b"BT /F1 12 Tf 72 690 Td (" + BODY.encode("ascii") + b") Tj ET\n"
    )
    objects.append(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"endstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for idx, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{idx} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii")
        + f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return bytes(out)


def _docx_payload() -> dict[str, bytes]:
    content_types = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        b'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        b'<Default Extension="xml" ContentType="application/xml"/>'
        b'<Override PartName="/word/document.xml" '
        b'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        b"</Types>"
    )
    rels = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" '
        b'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        b'Target="word/document.xml"/></Relationships>'
    )
    document = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
        b'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">'
        + HEADLINE.encode("utf-8")
        + b'</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">'
        + BODY.encode("utf-8")
        + b"</w:t></w:r></w:p></w:body></w:document>"
    )
    return {
        "[Content_Types].xml": content_types,
        "_rels/.rels": rels,
        "word/document.xml": document,
    }


def _pptx_payload() -> dict[str, bytes]:
    content_types = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        b'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        b'<Default Extension="xml" ContentType="application/xml"/>'
        b'<Override PartName="/ppt/presentation.xml" '
        b'ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        b'<Override PartName="/ppt/slides/slide1.xml" '
        b'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        b"</Types>"
    )
    rels_root = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" '
        b'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        b'Target="ppt/presentation.xml"/></Relationships>'
    )
    rels_pres = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" '
        b'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
        b'Target="slides/slide1.xml"/></Relationships>'
    )
    presentation = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<p:presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        b'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        b'<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>'
    )
    slide1 = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        b'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        b"<p:cSld><p:spTree>"
        b'<p:sp><p:txBody><a:p><a:r><a:t>' + HEADLINE.encode("utf-8") + b"</a:t></a:r></a:p>"
        b"<a:p><a:r><a:t>" + BODY.encode("utf-8") + b"</a:t></a:r></a:p></p:txBody></p:sp>"
        b"</p:spTree></p:cSld></p:sld>"
    )
    return {
        "[Content_Types].xml": content_types,
        "_rels/.rels": rels_root,
        "ppt/_rels/presentation.xml.rels": rels_pres,
        "ppt/presentation.xml": presentation,
        "ppt/slides/slide1.xml": slide1,
    }


def _write_zip(target: Path, payload: dict[str, bytes]) -> None:
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, body in payload.items():
            zf.writestr(name, body)


def main() -> None:
    HERE.mkdir(parents=True, exist_ok=True)
    (HERE / "sample.pdf").write_bytes(_build_pdf())
    _write_zip(HERE / "sample.docx", _docx_payload())
    _write_zip(HERE / "sample.pptx", _pptx_payload())


if __name__ == "__main__":
    main()
