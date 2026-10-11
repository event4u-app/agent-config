# Scenario 3 — scale 3000× without loss

**Task text handed to the owner, verbatim:**

> We want to print the mark on the side of a van. Prove it does not fall apart.

**Inputs:** the file scenario 1 delivered (`s1-new-logo/delivered/mark.svg`).
Nothing new is authored — the point of the scenario is that a true vector needs
nothing new.

**What decides the outcome:**

- A 512-unit tile clipped from an EDGE of the mark is rendered at 3000× device
  scale; the edge transition is at most 2 device pixels wide. An embedded raster
  would blur across hundreds, which is why this test separates a true vector
  from a file that merely contains one `<path>`.
- The file still has 0 `<image>`.
- No filter that rasterises at a fixed resolution (`feGaussianBlur`,
  `feTurbulence`, `filter=` on a painted element).
