---
name: laravel-mail
description: "Use when creating Laravel Mailables — templates, Markdown emails, queued sending, attachments, or mail testing."
source: package
---

# laravel-mail

## When to use

Mailables, templates, queued sending, attachments, testing. Simple notifications → `laravel-notifications`.

## Creating Mailables

```bash
php artisan make:mail InvoiceMail --markdown=emails.invoice
```

```php
declare(strict_types=1);

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly Invoice $invoice,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invoice #' . $this->invoice->getNumber(),
            replyTo: ['billing@example.com'],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.invoice',
            with: [
                'invoice' => $this->invoice,
                'url' => route('invoices.show', $this->invoice->getId()),
            ],
        );
    }

    /** @return array<int, \Illuminate\Mail\Mailables\Attachment> */
    public function attachments(): array
    {
        return [
            Attachment::fromPath('/path/to/invoice.pdf')
                ->as('invoice-' . $this->invoice->getNumber() . '.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
```

## Markdown templates

```blade
{{-- resources/views/emails/invoice.blade.php --}}
<x-mail::message>
# Invoice {{ $invoice->getNumber() }}

Thank you for your order. Here is your invoice summary:

<x-mail::table>
| Item | Amount |
|:-----|-------:|
@foreach ($invoice->getItems() as $item)
| {{ $item->getName() }} | {{ $item->getFormattedAmount() }} |
@endforeach
| **Total** | **{{ $invoice->getFormattedTotal() }}** |
</x-mail::table>

<x-mail::button :url="$url">
View Invoice
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
```

## Sending mail

```php
// Send immediately
Mail::to($user)->send(new InvoiceMail($invoice));

// Queue for background sending (preferred)
Mail::to($user)->queue(new InvoiceMail($invoice));

// Send later
Mail::to($user)->later(now()->addMinutes(10), new InvoiceMail($invoice));

// Multiple recipients
Mail::to($users)
    ->cc($manager)
    ->bcc('archive@example.com')
    ->send(new InvoiceMail($invoice));
```

## Testing

```php
// Assert mail was sent
Mail::fake();

// ... trigger action ...

Mail::assertSent(InvoiceMail::class, function (InvoiceMail $mail) use ($user) {
    return $mail->hasTo($user->getEmail());
});

Mail::assertNotSent(InvoiceMail::class);
Mail::assertNothingSent();
Mail::assertQueued(InvoiceMail::class);
```

## Previewing in browser

```php
// routes/web.php (local only)
Route::get('/mail-preview', function () {
    $invoice = Invoice::factory()->create();
    return new InvoiceMail($invoice);
});
```

## Core rules

- **Always queue emails** — implement `ShouldQueue` to avoid blocking requests.
- **Use Markdown templates** for consistent styling across email clients.
- **Use Envelope + Content** pattern (Laravel 11+) — not the old `build()` method.
- **Test with `Mail::fake()`** — verify recipients, content, and queuing.
- **Keep Mailables focused** — one Mailable per email type.

## Auto-trigger keywords

- Mailable
- email template
- send mail
- Mail::to
- markdown email
- mail attachment

## Gotcha

- Always queue emails (`ShouldQueue`) — synchronous sending blocks the request.
- The model forgets that mail templates are Blade files — they need to be published/created.
- Don't test email content with `Mail::fake()` alone — it doesn't render the template. Use `Mail::assertSent()` with closure.

## Do NOT

- Do NOT send emails synchronously in request lifecycle — always queue.
- Do NOT use `build()` method — use `envelope()`, `content()`, `attachments()`.
- Do NOT hardcode email addresses — use config or environment variables.
- Do NOT put HTML in Mailable classes — use Blade templates.
