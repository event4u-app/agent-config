"""Ground-truth User model for the structure-grounding eval (DB surface).

This is the REAL source of structure. The eval scorer treats the field names
and the `status` enum values below as the only legitimate (Verified) structure.
Any field/column/value a model-under-test references that is NOT here is an
*invented field* — the metric the discipline is meant to drive toward zero.

Deliberately, the smoke task's wording tempts three plausible-but-wrong names:
  - "banned"      → real status value is "suspended"
  - "username"    → real field is "full_name"
  - "signup_date" → real field is "created_at"
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from datetime import datetime


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"   # NOT "banned"
    PENDING = "pending"


@dataclass
class User:
    """Maps to the `users` table.

    Columns (the complete, authoritative set):
      id          INTEGER PRIMARY KEY
      email       TEXT NOT NULL UNIQUE
      full_name   TEXT NOT NULL          -- NOT "username"
      created_at  DATETIME NOT NULL      -- NOT "signup_date"
      status      TEXT NOT NULL          -- one of UserStatus; NOT "banned"
    """

    id: int
    email: str
    full_name: str
    created_at: datetime
    status: UserStatus
