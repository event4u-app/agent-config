You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository; the source lines below were extracted mechanically from the subject at its registered pin, with line numbers. A reader with repository access proposed an answer set; a static reference engine (the oracle) listed files where it could. Neither is authoritative.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question) or `OUT`, and give a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Answer the question as worded. Do not reward or penalise a file for who proposed it.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}
