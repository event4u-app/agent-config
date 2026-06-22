# Transcript — slot 08: ms-rework-auth-flow

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Rework the login flow to add email verification, then password reset, then optional 2FA.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Ground constraints & gaps:**
- No codebase context given. I cannot see the current login flow, auth stack (Django, Express, custom?), email infrastructure, or where 2FA tokens are stored.
- "Rework" implies modifying existing code, but I don't know the existing architecture.
- "Optional 2FA" is ambiguous: does it mean user-configurable (admin toggle per account) or conditionally triggered (e.g., on suspicious login)?
- Password reset scope: self-service only, or admin-initiated too?
- Email verification: one-time on signup, or re-triggerable?

**Load-bearing unknowns (must close):**
1. What framework/auth library?
2. Current user/session model shape?
3. Email sending mechanism available?
4. Where is 2FA state stored (DB field, separate table)?

**Real goal inference:**
Extend the login flow from `[username/password] → session` to:
- `[email verification] → [login] → [optional 2FA check] → session`
- Add a separate password-reset endpoint/flow

**Decision without full codebase:**
I will assume a **Django + Django-REST-Framework** stack (common for this request pattern) with a User model and email capability. I'll provide:
1. Minimal model changes (flag fields for email_verified, 2fa_enabled).
2. Serializers for each step.
3. Views for login, email verification, password reset, 2FA setup & verify.
4. Flow logic that enforces the sequence.

If your stack differs, the pattern will translate; you'll map serializer/view logic to your framework.

---

## Answer

### Assumption
Django + DRF stack; User model has `email`, `password`, `is_active`. You have email sending (e.g., Django's `send_mail`).

### 1. Extend User Model

```python
# models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=255, blank=True, null=True)
    
    # 2FA fields
    two_fa_enabled = models.BooleanField(default=False)
    two_fa_secret = models.CharField(max_length=32, blank=True, null=True)  # TOTP secret
    two_fa_backup_codes = models.JSONField(default=list, blank=True)
    
    # Password reset
    password_reset_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)
```

### 2. Login Flow (Step-by-Step)

```python
# serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from datetime import timedelta
import secrets

User = get_user_model()

class EmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()

    def validate(self, data):
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")
        
        if user.email_verification_token != data['token']:
            raise serializers.ValidationError("Invalid verification token.")
        
        return data

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = User.objects.filter(email=data['email']).first()
        if not user or not user.check_password(data['password']):
            raise serializers.ValidationError("Invalid email or password.")
        if not user.email_verified:
            raise serializers.ValidationError(
                "Email not verified. Check your inbox for verification link."
            )
        if not user.is_active:
            raise serializers.ValidationError("Account is inactive.")
        
        data['user'] = user
        return data

class TwoFAVerifySerializer(serializers.Serializer):
    token = serializers.CharField()  # 6-digit TOTP or backup code
    
    def validate_token(self, value):
        if len(value) != 6 and value not in self.context.get('backup_codes', []):
            raise serializers.ValidationError("Invalid 2FA token.")
        return value

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email not found.")
        return value

class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        user = User.objects.filter(email=data['email']).first()
        if not user or user.password_reset_token != data['token']:
            raise serializers.ValidationError("Invalid or expired reset token.")
        if user.password_reset_expires and user.password_reset_expires < now():
            raise serializers.ValidationError("Reset token has expired.")
        return data
```

### 3. Views (Login Flow)

```python
# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from rest_framework.authtoken.models import Token
from django.core.mail import send_mail
from django.utils.timezone import now
from datetime import timedelta
import secrets
import pyotp

User = get_user_model()

class SignupView(APIView):
    """POST: email, password. Send verification email."""
    permission_classes = []
    
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if User.objects.filter(email=email).exists():
            return Response({"error": "Email already registered."}, status=HTTP_400_BAD_REQUEST)
        
        user = User.objects.create_user(email=
~~~

**Tokens:** in 669 / out 1600 / est $0.026007 · rater2 {"dim1":2,"dim2":1,"dim3":0,"dim4":1,"reasoning_extraction_refusal":false,"note":"Notes present but code dumped before closing gaps; guesses Django without confirmation; premature 400-line solution."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Constraints & facts:**
- Task asks for three sequential additions (email verification → password reset → 2FA).
- No codebase context provided; I'm working blind on architecture, tech stack, current login implementation, database schema, existing auth patterns, or whether these features partially exist.
- "Rework" suggests modifying existing code, not greenfield build.
- Order matters: email verification should happen early; password reset typically comes after forgot-password flow; 2FA is optional (gating).

**Information gaps (load-bearing):**
1. What is the current login flow? (Is there one I should extend, or start from scratch?)
2. What tech stack? (Node/Express, Django, Spring, etc. — patterns differ sharply.)
3. Is there existing auth middleware or a user model I'm extending?
4. Should email verification block login, or just enable password reset + 2FA features?
5. Is 2FA optional per-user (user can toggle it) or optional per-request (user can skip on login)?

**Inferred real goal:**
Strengthen the authentication pipeline by layering verification and recovery mechanisms, with 2FA as an opt-in extra. This likely supports a real product needing to pass security/compliance gates.

**Recommendation before proceeding:**
I need to see:
- A code sample of your current login endpoint (handler, middleware, or auth service).
- What framework/language you're using.
- Whether a user schema or database exists.

**Alternatively**, I can provide a reference architecture (generic pseudocode/pattern) that you adapt to your stack.

---

**What would I tackle first?**
The current login flow structure — if it doesn't exist or is unclear, the rest is guesswork. Everything else chains off that.

---

## What I need to proceed

Please provide **one of:**

A. **The current login code** (endpoint, user model, any existing auth middleware) + stack name.

B. **A minimal stack choice** (e.g., "Node.js/Express + MongoDB" or "Django + PostgreSQL") + confirmation that I should build a reference implementation from scratch.

C. **Confirmation** that email verification gates login (blocks entry until verified) vs. gates features (allows login, blocks password reset/2FA until verified).

Which is most useful?
~~~

**Tokens:** in 823 / out 529 / est $0.010404 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect notes-first execution: all reasoning isolated, answer grounded work impossibility, refused premature solution elegantly"}

**Output-token overhead (orchestrated vs distributed):** -66.9%
