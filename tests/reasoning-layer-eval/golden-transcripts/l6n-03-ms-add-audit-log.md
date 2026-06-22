# Transcript — slot 03: ms-add-audit-log

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Add an audit log that records every write to the billing tables and exposes it on an admin page.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints and gaps:**
1. "Billing tables" — are these specific tables (e.g., `invoices`, `payments`, `subscriptions`) or all tables matching a pattern? I need this to scope the audit scope correctly.
2. "Every write" — INSERT, UPDATE, DELETE? What about bulk operations or migrations?
3. "Admin page" — is there an existing admin interface (Django admin, custom dashboard)? Should this be UI or just an endpoint?
4. "Records" — what metadata? (user, timestamp, old/new values, table, operation type)
5. Current tech stack — is this a Django app, Rails, Node? This determines implementation approach.

**Assumption needed:** I'll assume:
- This is a Django app (most common for billing + admin)
- "Billing tables" = explicit list we define (e.g., Invoice, Payment, Subscription models)
- "Records" = full change tracking (before/after values, user, timestamp, operation)
- "Admin page" = Django admin + read-only list view
- Stack: Django ORM with PostgreSQL

**Real goal:** Create a tamper-evident, queryable record of all billing mutations so admins can audit changes and detect accidental/malicious data modification.

**Load-bearing complexity:** The trigger mechanism. Django signals are convenient but fragile under bulk operations. A database-level trigger is authoritative but harder to integrate with Django ORM state.

**Recommendation:** Use Django signals + explicit middleware to catch both ORM and raw SQL writes, with a fallback PostgreSQL trigger for defense-in-depth.

---

## Answer

I need one clarifying question before I proceed:

**What is your current tech stack and which specific tables need audit coverage?**  
(e.g., Django + Invoice/Payment/Subscription models? Or Rails? Or a different framework?)

For now, I'll provide a **Django-based solution** that covers the common case. If you're using a different stack, let me know and I'll adjust.

### Solution: Django audit log for billing tables

**1. Create the audit log model:**

```python
# models.py (in your app)

from django.db import models
from django.contrib.auth.models import User
import json

class BillingAuditLog(models.Model):
    OPERATION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    operation = models.CharField(max_length=10, choices=OPERATION_CHOICES)
    table_name = models.CharField(max_length=100, db_index=True)
    record_id = models.IntegerField(db_index=True)
    
    # Full change: {field: {old: val, new: val}, ...}
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['table_name', '-timestamp']),
            models.Index(fields=['record_id', 'table_name']),
        ]
    
    def __str__(self):
        return f"{self.operation} {self.table_name}#{self.record_id} at {self.timestamp}"
```

**2. Create signal handlers to capture writes:**

```python
# signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.apps import apps
from .models import BillingAuditLog
from functools import wraps

# Define which models to audit
AUDITED_MODELS = ['Invoice', 'Payment', 'Subscription']

def audit_log_for_model(model_class):
    """Decorator to enable audit logging for a model."""
    
    @receiver(post_save, sender=model_class, weak=False)
    def log_save(sender, instance, created, **kwargs):
        user = getattr(instance, '_audit_user', None)
        ip = getattr(instance, '_audit_ip', None)
        
        # Capture new values
        new_vals = {f.name: getattr(instance, f.name) 
                    for f in instance._meta.fields 
                    if f.name not in ['id', 'created_at']}
        new_vals = {k: str(v) if not isinstance(v, (int, float, bool, type(None))) 
                    else v for k, v in new_vals.items()}
        
        old_vals = getattr(instance, '_audit_old_values', {})
        
        BillingAuditLog.objects.create(
            operation='CREATE' if created else 'UPDATE',
            table_name=sender._meta.db_table,
            record_id=instance.id,
            old_values=old_vals,
            new_values=new_vals,
            user=user,
            ip_address=ip,
        )
    
    @receiver(post_delete, sender=model_class, weak=False)
    def log_delete(sender, instance, **kwargs):
        user = getattr(instance, '_audit_user', None)
        ip = getattr(instance, '_audit_ip', None)
        
        old_vals = {f.name: getattr(instance, f.name) 
                    for f in instance._meta.fields}
        old_vals = {k: str(v) if not isinstance(v, (int, float, bool, type(None))) 
                    else v for k, v in old_vals.items()}
        
        BillingAuditLog.objects.create(
            operation='DELETE',
            table_name=sender._meta.db_table,
            record_id=instance.id,
            old_values=old_vals,
            new_values={},
            user=user,
            ip_address=ip,
        )

# Register signals in apps.py
```

**3. Hook user/IP context via middleware:**

```python
# middleware.py

class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Attach user and IP to thread-local context
        from .models import Bil
~~~

**Tokens:** in 669 / out 1600 / est $0.026007 · rater2 {"dim1":2,"dim2":2,"dim3":1,"dim4":0,"reasoning_extraction_refusal":false,"note":"Notes good; gaps identified. Answer incomplete (cut-off mid-code). No final summary/outcome. Solution starts before key Q answered."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- "billing tables" — plural, but unspecified which ones. Need to know: do I infer them from the codebase, or should I ask?
- "records every write" — INSERT, UPDATE, DELETE; what about transactions? Soft-deletes? Timestamp granularity?
- "exposes it on an admin page" — implies a web UI exists. Need: does an admin panel already exist? What framework? What auth model?
- Scope of "write": does this include bulk operations, API calls, batch jobs, or just application-level code?

**Information gaps (load-bearing):**
1. Which are the "billing tables"? (e.g., invoices, subscriptions, payments, line_items…)
2. Is there an existing admin dashboard/framework I should integrate with?
3. What auth/roles control access to the audit log?
4. Retention policy: how long to keep audit logs?
5. Performance constraint: will audit logging run synchronously or async?

**Inferred real goal:**
Create a compliance/forensic record of all billing data mutations (with user/timestamp/change details) and make it queryable/viewable to admins for accountability and debugging.

---

I need three clarifying answers to scope this properly:

1. **Which tables constitute "billing tables"?** (e.g., list them, or do I infer from a schema file?)
2. **Does an admin panel already exist?** If yes, what framework/tech? If no, should I create a minimal one?
3. **Should audit logging be synchronous (transactional) or asynchronous?**

Once I have these, I can build:
- Audit log table schema + triggers/middleware to capture writes
- Admin view to query/filter the audit log
- Minimal test to verify capture works
~~~

**Tokens:** in 823 / out 424 / est $0.008829 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: all reasoning in notes; clear gaps; load-bearing unknowns block premature work; coherent 3-Q ask."}

**Output-token overhead (orchestrated vs distributed):** -73.5%
