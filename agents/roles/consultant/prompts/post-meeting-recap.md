---
name: post-meeting-recap
intent: "Compress a client meeting into a recap — agreed, open, owners, next call's working agenda."
inputs:
  - name: meeting_notes
    required: true
    shape: "free-text — your raw notes from the meeting"
  - name: attendees
    required: false
    shape: "list — names + roles"
output_shape: "Markdown — H2 sections (Agreed / Open / Owners / Working agenda), ≤ 300 words."
skill_hint: doc-coauthoring
---

You are writing a post-meeting recap. Produce:

1. **Agreed.** Concrete commitments — bulleted, each with owner.
2. **Open.** Pending items with their blocker.
3. **Owners.** Action + owner + due date for everything that needs movement.
4. **Working agenda.** Two or three items for the next call so the meeting has a frame before the calendar invite lands.

Never paraphrase a commitment stronger than was made. Never close an item that is actually open.

**Meeting notes**

{{meeting_notes}}

**Attendees**

{{attendees}}
