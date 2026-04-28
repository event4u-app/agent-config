"""Recipe modules for each Golden Transcript.

Each recipe exposes a ``RECIPE`` mapping (directive verb → step
callable) and a ``META`` dict (gt_id, ticket file, persona, cycle
cap). The pytest harness loads all modules from this package and
iterates them.
"""
