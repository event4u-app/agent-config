<!-- clean: form guidance grounded in observed support tickets, each rule states its failure mode -->
# Form patterns

## Labels

Every control has a visible `<label>` bound with `for`. Placeholder text is not a
label: it disappears on focus, fails contrast on most themes, and is invisible to
autofill review.

## Validation timing

Validate on blur for format errors, on submit for everything else. Validating on
each keystroke marks a half typed email as wrong and trains people to ignore the
message.

## Error messages

State what is wrong and what to do:

```html
<p class="field__error" id="iban-error" role="alert">
  This IBAN has 20 characters. German IBANs have 22.
</p>
```

Bind it with `aria-describedby` and set `aria-invalid="true"` on the input.
Moving focus to the first invalid field on submit is required; scrolling without
moving focus leaves keyboard users on the button.

## Required and optional

Mark the smaller set. If most fields are required, mark the optional ones. An
asterisk with no legend is not a marker.

## Destructive confirmation

A confirmation dialog states the count and the consequence. "Delete 4 projects
and 18 months of run history. This cannot be undone." beats "Are you sure?".
Type to confirm is for irreversible account level actions only, not for deleting
a row.

## Saving

Disable the submit button while the request is in flight and keep the form
values on failure. The most common support ticket in the last quarter was a
timed out save that cleared a 30 field form.

## Autocomplete

Set `autocomplete` on name, email, address and payment fields. Browsers fill
these correctly when the attribute is present and guess badly when it is absent.

| Field | Value |
|---|---|
| Email for sign in | `username` |
| New password | `new-password` |
| Street | `address-line1` |
| Postal code | `postal-code` |
