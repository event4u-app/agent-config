#!/bin/bash
mkdir -p assets
cat > assets/logo.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M10 90 L40 10 L70 90 M22 60 L58 60" stroke="#000" stroke-width="8" fill="none"/><path d="M90 10 L90 90 L130 90" stroke="#000" stroke-width="8" fill="none"/><path d="M150 10 L190 10 M170 10 L170 90" stroke="#000" stroke-width="8" fill="none"/></svg>
SVG
