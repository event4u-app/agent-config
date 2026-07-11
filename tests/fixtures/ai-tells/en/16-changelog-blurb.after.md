This release is mostly about the editor.

Typing latency on documents over 100 pages dropped from noticeable to none; we moved syntax highlighting off the main thread. The find-and-replace dialog now shows match counts as you type. And pasting from Excel keeps table formatting instead of producing a wall of tabs.

One fix worth calling out: session tokens now rotate on password change. If you changed your password before today, do it once more so the new rotation applies.
