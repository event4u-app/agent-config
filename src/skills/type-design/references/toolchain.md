# Toolchain — pinned, peer-side, never bundled

The package ships no Python and no font tooling. The type-design build runs in
an isolated environment **in the consumer's tree**, from the exact versions
below. A version moves only by a pull request that repeats the intake below for
the new version — never floating, never `latest`.

| Role | Package | Pin | Licence |
|---|---|---|---|
| outline library, compiler back end | `fonttools` | `fonttools==4.66.1` | MIT |
| path booleans (overlap removal) | `skia-pathops` | `skia-pathops==0.9.2` | BSD-3-Clause |
| UFO source library | `ufoLib2` | `ufoLib2==0.18.1` | Apache-2.0 |
| font compiler | `fontmake` | `fontmake==3.12.1` | Apache-2.0 |
| shaping binding (feature checks) | `uharfbuzz` | `uharfbuzz==0.56.2` | Apache-2.0 |
| raster tracer | `vtracer` | `vtracer==0.6.15` | MIT |

```bash
python3 -m venv .type-design/venv
.type-design/venv/bin/pip install \
  'fonttools==4.66.1' 'skia-pathops==0.9.2' 'ufoLib2==0.18.1' \
  'fontmake==3.12.1' 'uharfbuzz==0.56.2' 'vtracer==0.6.15'
.type-design/venv/bin/pip freeze > .type-design/requirements.lock
```

Commit the lock file with the font sources: `fontmake` resolves further packages
(`ufo2ft`, `glyphsLib`, `fontMath`), and the lock records which ones built this
font. The raster tracer is MIT-licensed on purpose: a copyleft tracer is not the
default builder.

## Intake record — 2026-10-18

Taken through `supply-chain-intake` against the live registry on 2026-10-18.

| Pin | Exists | Published | Downloads, last month | Known vulnerabilities |
|---|---|---|---|---|
| `fonttools==4.66.1` | yes | 2026-09-29 | 189,260,520 | none |
| `skia-pathops==0.9.2` | yes | 2026-02-16 | 325,892 | none |
| `ufoLib2==0.18.1` | yes | 2025-07-10 | 79,359 | none |
| `fontmake==3.12.1` | yes | 2026-06-02 | 23,711 | none |
| `uharfbuzz==0.56.2` | yes | 2026-09-21 | 1,509,780 | none |
| `vtracer==0.6.15` | yes | 2026-03-23 | 477,912 | none |

- **Existence and publish date** — the registry's JSON API for each package
  and version; none is yanked.
- **Age** — each pin is the newest release at least two weeks old on the intake
  date. A newer release existed for `fonttools`, `ufoLib2`, `fontmake` and
  `uharfbuzz` and was passed over for being days old.
- **Compatibility** — `fontmake==3.12.1` requires `ufoLib2>=0.18.1` and
  `fonttools>=4.59.2`; `ufoLib2==0.18.1` requires `fonttools>=4.58.0`. All six
  need Python 3.11 or newer because `fonttools` does.
- **Vulnerabilities** — the OSV database returned no advisory for any of the six
  pinned versions. Run `pip-audit` over the frozen lock before the first build;
  the intake covered the six named packages, not what they resolve.
- **Typo-adjacency** — each registry entry declares its source repository
  (`fonttools/fonttools`, `fonttools/skia-pathops`, `fonttools/ufoLib2`,
  `googlei18n/fontmake`, `trufont/uharfbuzz`, and visioncortex for `vtracer`);
  `potracer` and `pypotrace` were considered for tracing and rejected as GPL.
