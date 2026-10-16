# Worked modular scales

Six scales worked end to end, one per common use-case. Each one names the
ratio, the base, the raw sizes, the rounded sizes the tokens carry, and the
line-height it takes from the body authority in
[`../SKILL.md`](../SKILL.md) § Procedure step 3 (1.5 default inside a
1.4–1.7 band, chosen by measure and x-height).

The steps are `xs / sm / base / lg / xl / 2xl / 3xl` = `base × ratio^k` for
`k = -2 … 4`, rounded to the nearest whole pixel. Two rules apply to every
row:

- **Nothing below 12 px.** A computed `xs` under 12 is clamped to 12 and the
  clamp is stated; captions and labels below that read as an accident.
- **Body sizes respect Q2** (`docs/guidelines/design-antipatterns.md`): 14 px
  is the floor, 16 px is preferred for reading text.

## 1. Marketing landing page — Perfect Fourth

- Ratio 1.333, base 18 px.
- Raw: 10.1 / 13.5 / 18.0 / 24.0 / 32.0 / 42.6 / 56.8
- Rounded: **12** (clamped from 10) / 14 / 18 / 24 / 32 / 43 / 57
- Body line-height: 1.5 — lines stay short in a hero-led layout.
- Why this ratio: few, large steps make the hierarchy read at a glance.

## 2. Dashboard — Minor Third

- Ratio 1.2, base 14 px.
- Raw: 9.7 / 11.7 / 14.0 / 16.8 / 20.2 / 24.2 / 29.0
- Rounded: **12** (clamped from 10) / 12 / 14 / 17 / 20 / 24 / 29
- Body line-height: 1.4 — the low end of the band; dense tables and short
  cell text, where a taller leading wastes rows.
- Why this ratio: many small steps for a UI with many levels and little prose.
  Pair numbers with `tabular-nums` so columns align.

## 3. Documentation — Major Third

- Ratio 1.25, base 16 px.
- Raw: 10.2 / 12.8 / 16.0 / 20.0 / 25.0 / 31.3 / 39.1
- Rounded: **12** (clamped from 10) / 13 / 16 / 20 / 25 / 31 / 39
- Body line-height: 1.6 — long prose at a 65–75 character measure.
- Why this ratio: heading levels h1 to h4 stay distinct without a 2xl that
  shouts over the article.

## 4. E-commerce — Minor Third at 16

- Ratio 1.2, base 16 px.
- Raw: 11.1 / 13.3 / 16.0 / 19.2 / 23.0 / 27.6 / 33.2
- Rounded: **12** (clamped from 11) / 13 / 16 / 19 / 23 / 28 / 33
- Body line-height: 1.5 — product descriptions are short paragraphs.
- Why this ratio: product cards need a price, a name and a badge at three
  close sizes; a large ratio pushes the price out of the card.

## 5. SaaS product UI — Minor Third at 15

- Ratio 1.2, base 15 px.
- Raw: 10.4 / 12.5 / 15.0 / 18.0 / 21.6 / 25.9 / 31.1
- Rounded: **12** (clamped from 10) / 13 / 15 / 18 / 22 / 26 / 31
- Body line-height: 1.5 — settings pages and forms mix labels and prose.
- Why this ratio: a 15 px base sits between a dense dashboard and a reading
  page; form controls stay at 16 px on touch layouts regardless of the base.

## 6. Editorial long-form — Perfect Fourth at 19

- Ratio 1.333, base 19 px.
- Raw: 10.7 / 14.3 / 19.0 / 25.3 / 33.8 / 45.0 / 60.0
- Rounded: **12** (clamped from 11) / 14 / 19 / 25 / 34 / 45 / 60
- Body line-height: 1.7 — the top of the band; a large base, a long measure
  and a serif text face with a small x-height.
- Why this ratio: display headlines need contrast against a large body size.

## The arbitrary scale this replaces

`16, 20, 24, 28` is not a scale: its steps grow by a fixed 4 px, so the ratio
falls from 1.25 to 1.17 as sizes grow and the top levels blur together. A
modular scale keeps the ratio constant, which is what makes each step read as
one level up.
