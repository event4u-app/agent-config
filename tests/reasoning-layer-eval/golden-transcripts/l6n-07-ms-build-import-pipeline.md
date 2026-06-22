# Transcript — slot 07: ms-build-import-pipeline

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Build an import pipeline that ingests a vendor CSV, validates it, and upserts into our schema with a dry-run mode.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- No spec provided for: vendor CSV schema/columns, target database schema, validation rules, error handling strategy, dry-run semantics (report-only vs rollback-able transaction).
- "Upsert" implies update-or-insert logic; need to know the match key (vendor ID? name?).
- "Dry-run mode" could mean (a) validation only, (b) transaction-scoped rollback, or (c) report without persistence.
- No mention of: framework/ORM, database type, where the CSV comes from, how errors should be surfaced.

**Information gaps to close:**
1. What is the vendor schema (CSV columns and DB target table)?
2. What are the validation rules (required fields, formats, constraints)?
3. What is the upsert key (how do we identify "same vendor")?
4. What is the dry-run behavior (rollback transaction or just skip writes)?

**Inferred goal:**
Build a reusable, testable pipeline that safely ingests vendor data with user control over mutation; validation gates writes; errors are logged, not silent.

**Load-bearing decision:**
I'll assume PostgreSQL + SQLAlchemy (common in Python codebases) and make the schema explicit so you can adapt it. Dry-run will use transaction-scoped rollback (safest, clearest semantics). I'll ask the one critical question below.

---

## One clarifying question

**What is the unique identifier for a vendor in the target schema?** (e.g., vendor ID, email, company name?)

For now, I'll assume `vendor_id` as the natural key and show a solution. You can override.

---

## Answer

I'll build a production-ready pipeline with validation, logging, and dry-run semantics:

### 1. Schema & Models

```python
# models.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Vendor(Base):
    __tablename__ = 'vendors'
    
    vendor_id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    country = Column(String(2))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### 2. Validator

```python
# validators.py
from dataclasses import dataclass
from typing import List, Dict, Any
import re

@dataclass
class ValidationError:
    row: int
    field: str
    message: str

class VendorValidator:
    """Validates vendor CSV rows against schema rules."""
    
    REQUIRED_FIELDS = {'vendor_id', 'name', 'email'}
    EMAIL_REGEX = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    COUNTRY_CODES = set(['US', 'CA', 'GB', 'DE', 'FR', 'AU'])  # example
    
    def __init__(self):
        self.errors: List[ValidationError] = []
    
    def validate(self, rows: List[Dict[str, str]]) -> bool:
        """Returns True if all rows valid; errors stored in self.errors."""
        self.errors.clear()
        
        for row_num, row in enumerate(rows, start=2):  # 2 = skip header
            self._validate_row(row, row_num)
        
        return len(self.errors) == 0
    
    def _validate_row(self, row: Dict[str, str], row_num: int):
        # Check required fields
        for field in self.REQUIRED_FIELDS:
            if not row.get(field, '').strip():
                self.errors.append(
                    ValidationError(row_num, field, f"Required field missing")
                )
        
        # Validate email format
        if row.get('email'):
            if not re.match(self.EMAIL_REGEX, row['email']):
                self.errors.append(
                    ValidationError(row_num, 'email', 'Invalid email format')
                )
        
        # Validate country code (if present)
        if row.get('country') and row['country'] not in self.COUNTRY_CODES:
            self.errors.append(
                ValidationError(row_num, 'country', 
                    f"Unknown country code. Allowed: {', '.join(sorted(self.COUNTRY_CODES))}")
            )
        
        # Validate vendor_id is alphanumeric
        if row.get('vendor_id'):
            if not re.match(r'^[A-Z0-9_-]{3,50}$', row['vendor_id']):
                self.errors.append(
                    ValidationError(row_num, 'vendor_id', 
                        'Must be 3-50 chars, alphanumeric, underscore, or hyphen')
                )
```

### 3. Import Pipeline

```python
# import_pipeline.py
import csv
import logging
from typing import List, Dict, Any, Tuple
from contextlib import contextmanager
from sqlalchemy.orm import Session
from sqlalchemy import update
from datetime import datetime

from models import Vendor
from validators import VendorValidator

logger = logging.getLogger(__name__)

class VendorImporter:
    """Ingests CSV and upserts vendors with optional dry-run."""
    
    def __init__(self, session: Session):
        self.session = session
        self.validator = VendorValidator()
    
    def import_csv(self, filepath: str, dry_run: bool = False) -> Dict[str, Any]:
        """
        Imports vendor CSV into database.
        
        Args:
            filepath: Path to CSV file
            dry_run: If True, validates and reports without persisting
        
        Returns:
            Dict with keys: success (bool), upserted (int), updated (int), 
                           errors (List[ValidationError]), summary (str)
        """
        result = {
            'success': False,
            'upserted': 0,
            'updated': 0,
            'errors': [],
            'summary': ''
        }
        
        # Step 1: Load & parse CSV
        try:
            rows = self._load_
~~~

**Tokens:** in 676 / out 1600 / est $0.026028 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":0,"reasoning_extraction_refusal":false,"note":"Excellent notes+grounding; solution deferred until key unknown (match key) clarified. Answer cut mid-code = no summary."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- Need to ingest vendor CSV → validate → upsert with optional dry-run
- No schema, vendor CSV structure, or codebase shown; I must infer or ask
- Upsert logic requires a key to match on (vendor ID? name?)
- Dry-run means: read, validate, show what *would* happen, but don't commit
- Validation scope unclear: schema shape, business rules, data types?

**Load-bearing unknowns to close:**
1. **Where does the CSV come from / what's the target schema?** (file path, DB table, Pydantic model?)
2. **What fields must exist in the CSV, and what are the validation rules?** (required, types, ranges, uniqueness?)
3. **What key identifies an existing vendor record for upsert?**
4. **Language/framework?** (Python + SQLAlchemy, Django ORM, raw SQL, etc.?)

**Assumption-driven clarification question:**

> Can you provide: (a) the vendor schema/table structure, (b) a sample CSV row, and (c) whether this is Python + a specific ORM/DB? Or shall I build a framework-agnostic example with Pydantic + SQLAlchemy?

For now, I'll **build a self-contained, reusable pipeline template in Python** (Pydantic + SQLAlchemy) that you can adapt to your schema. This unblocks you while awaiting details.

---

## Answer

Here's a production-ready vendor CSV import pipeline with validation and dry-run mode:

### `models.py` (Schema)
```python
from sqlalchemy import Column, String, Float, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Vendor(Base):
    __tablename__ = "vendors"
    
    vendor_id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    country = Column(String(100), nullable=False)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### `schemas.py` (Validation)
```python
from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional

class VendorRow(BaseModel):
    """Validate a single CSV row."""
    vendor_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    contact_email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    country: str = Field(..., min_length=1, max_length=100)
    rating: Optional[float] = None
    
    @validator("rating")
    def rating_in_range(cls, v):
        if v is not None and not (0 <= v <= 5):
            raise ValueError("rating must be between 0 and 5")
        return v
    
    @validator("vendor_id")
    def vendor_id_alphanumeric(cls, v):
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("vendor_id must be alphanumeric (hyphens/underscores allowed)")
        return v
    
    class Config:
        extra = "forbid"  # Reject unknown fields
```

### `pipeline.py` (Import Logic)
```python
import csv
from pathlib import Path
from typing import List, Dict, Tuple
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

from models import Vendor, Base
from schemas import VendorRow

@dataclass
class ImportResult:
    total_rows: int
    valid_rows: int
    invalid_rows: int
    errors: List[Dict]  # [{"row": 5, "vendor_id": "V123", "error": "..."}]
    upserted: int
    skipped: int  # dry-run

class VendorImportPipeline:
    def __init__(self, db_session: Session):
        self.session = db_session
        self.errors = []
    
    def validate_csv(self, csv_path: str) -> Tuple[List[VendorRow], List[Dict]]:
        """
        Read and validate CSV rows.
        Returns (valid_rows, error_dicts).
        """
        valid_rows = []
        errors = []
        
        try:
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    raise ValueError("CSV is empty or malformed")
                
                for row_num, row in enumerate(reader, start=2):  # start=2 to skip header
                    try:
                        # Strip whitespace from all fields
                        row = {k: v.strip() if isinstance(v, str) else v for k, v in row.items()}
                        validated = VendorRow(**row)
                        valid_rows.append(validated)
                    except Exception as e:
                        errors.append({
                            "row_number": row_num,
                            "vendor_id": row.get("vendor_id", "UNKNOWN"),
                            "error": str(e)
                        })
        
        except FileNotFoundError:
            raise FileNotFoundError(f"CSV file not found: {csv_path}")
        except Exception as e:
            raise ValueError(f"CSV read failed: {e}")
        
        return valid_rows, errors
    
    def upsert_vendors(self, vendors: List[VendorRow], dry_run: bool = False) -> ImportResult:
        """
        Upsert vendors into DB. If dry_run=True, validate but don't commit.
        """
        upserted = 0
        result = ImportResult(
            total_rows=len(vendors),
            valid_rows=len(vendors),
            invalid_rows=0,
            errors=[],
            upserted=0,
            skipped=0
        )
        
        try:
            for vendor_row in vendors:
                # Build vendor record
~~~

**Tokens:** in 830 / out 1600 / est $0.02649 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: closes unknowns explicitly, assumes then builds, notes→code separation clear, coherent standalone answer"}

**Output-token overhead (orchestrated vs distributed):** 0%
