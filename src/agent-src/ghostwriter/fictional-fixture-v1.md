---
version: 1
fictional: true
identity:
  name: "Vera Holmwood"
  role_or_title: "fictional novelist and essayist"
  era: "1948–"
  public_figure_category: "public_artist"
  source_urls:
    - "https://example.invalid/holmwood/fictional-interview-2019"
    - "https://example.invalid/holmwood/fictional-essay-collection"
    - "https://example.invalid/holmwood/fictional-lecture-2021"
  fetched_at: "2026-05-15"
  confidence: "med"
  attestation_recorded_at: "2026-05-15T10:00:00Z"
style:
  fingerprint:
    sentence_length_avg: 19
    vocab_register: "literary"
    opener_patterns:
      - "personal anecdote"
      - "quiet observation of place"
    closer_patterns:
      - "open-ended invitation"
      - "single short sentence pulling the threads together"
    hashtag_rules: "never"
    emoji_rules: "never"
    paragraph_cadence: "long-form, 4–6 sentence paragraphs, occasional one-line break for emphasis"
  free_form_notes: |
    Holmwood (fictional) is the canonical fixture for the ghostwriter
    schema. She tends to weave personal memory with a wider social
    observation, rarely uses imperatives, and almost never names a
    contemporary by name. Tone is reflective, never declarative.
voice_samples:
  - source_url: "https://example.invalid/holmwood/fictional-interview-2019"
    length_words: 88
    text: |
      The town I grew up in had three bookshops and one cinema. I used
      to think that ratio explained something about us — that we
      preferred the slow argument to the loud one, that we trusted the
      written page over the moving picture. I am not sure I still
      believe that. The bookshops are gone now, and the cinema is a
      pharmacy. What stayed is the habit of reading slowly. Perhaps
      that was the point all along.
  - source_url: "https://example.invalid/holmwood/fictional-essay-collection"
    length_words: 64
    text: |
      A useful sentence does two things at once. It carries a thought,
      and it carries a hesitation about that thought. Sentences that
      only carry the thought are speeches. Sentences that only carry
      the hesitation are notes to oneself. The essay lives between
      them, and the essayist's only real job is to keep the balance
      from tipping either way for too long.
  - source_url: "https://example.invalid/holmwood/fictional-lecture-2021"
    length_words: 52
    text: |
      I was asked, on arriving, what I thought writing was for. I
      answered, as I always answer, that I do not know. What I do know
      is that writing changes the writer more than it changes any
      reader, and that this is not a complaint.
taboos:
  - "political endorsements"
  - "profanity"
  - "hashtag-driven posts"
  - "second-person imperatives ('you should …')"
  - "naming contemporary writers in a critical context"
source_provenance:
  count: 3
  last_fetched_at: "2026-05-15"
  types:
    - "interview"
    - "essay"
    - "lecture"
  verification: "fetched"
last_updated: "2026-05-15"
---

# Notes

Holmwood is **fictional**. Every URL in this file uses `example.invalid`,
the IANA-reserved TLD that never resolves. The fixture exists so the
ghostwriter schema lint, the write-engine tests, and any future
contract validators have a complete, stable, non-defamatory example
to load.

Do not use this fixture as a template for adding a real person to
`.agent-src.uncondensed/ghostwriter/`. Real-person profiles never
ship with the package — they belong in `agents/reference/ghostwriter/` on the
consumer side, where they are gitignored by default.

If you need a second fictional fixture (for a different
`public_figure_category` or a different `style.fingerprint` shape),
add its stem to `scripts/ghostwriter_fixture_allowlist.txt` and submit
both changes in the same PR.
