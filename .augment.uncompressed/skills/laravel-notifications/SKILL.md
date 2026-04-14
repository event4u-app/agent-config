---
name: laravel-notifications
description: "Use when sending notifications via mail, Slack, database, or custom channels — with queuing, on-demand recipients, and notification preferences."
source: package
---

# laravel-notifications

## When to use

Use this skill when sending notifications to users or external systems:
- Email, Slack, SMS, or database notifications
- Custom notification channels
- On-demand notifications (to non-user recipients)
- Notification preferences and opt-out logic

For **Mailables** (complex email templates, attachments), see [laravel-mail](../laravel-mail/SKILL.md).

## Creating notifications

```bash
php artisan make:notification InvoiceCreated
```

```php
class InvoiceCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Invoice $invoice,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('New Invoice #' . $this->invoice->getNumber())
            ->greeting('Hello ' . $notifiable->getName())
            ->line('A new invoice has been created.')
            ->action('View Invoice', url('/invoices/' . $this->invoice->getId()))
            ->line('Thank you for your business.');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'invoice_id' => $this->invoice->getId(),
            'amount' => $this->invoice->getAmount(),
        ];
    }
}
```

## Sending notifications

```php
// Via the Notifiable trait on the model
$user->notify(new InvoiceCreated($invoice));

// Via the Notification facade (multiple recipients)
Notification::send($users, new InvoiceCreated($invoice));

// On-demand (no user model needed)
Notification::route('mail', 'admin@example.com')
    ->route('slack', '#billing')
    ->notify(new InvoiceCreated($invoice));
```

## Database notifications

Requires the notifications table migration:

```bash
php artisan notifications:table
php artisan migrate
```

```php
// Read notifications
$user->notifications;           // all
$user->unreadNotifications;     // unread only

// Mark as read
$notification->markAsRead();
$user->unreadNotifications->markAsRead();
```

## Slack notifications

```php
public function toSlack(object $notifiable): SlackMessage
{
    return (new SlackMessage())
        ->text('Invoice #' . $this->invoice->getNumber() . ' created')
        ->headerBlock('New Invoice')
        ->sectionBlock(function (SectionBlock $block) {
            $block->text('Amount: ' . $this->invoice->getAmount());
        });
}
```

## Notification preferences

```php
public function via(object $notifiable): array
{
    // Respect user preferences
    $channels = ['database'];

    if ($notifiable->wantsEmailNotifications()) {
        $channels[] = 'mail';
    }

    if ($notifiable->wantsSlackNotifications()) {
        $channels[] = 'slack';
    }

    return $channels;
}
```

## Core rules

- **Always queue notifications** — implement `ShouldQueue` to avoid blocking requests.
- **Keep payloads small** in `toArray()` — store IDs, not full objects.
- **Use `via()` for channel logic** — don't hardcode channels, respect user preferences.
- **On-demand for external recipients** — use `Notification::route()` for non-user targets.
- **Database notifications for in-app** — use the notifications table for in-app notification centers.

## Auto-trigger keywords

- notification
- notify
- Notifiable
- MailMessage
- SlackMessage
- database notification

## Gotcha

- Don't send notifications synchronously in request lifecycle — always queue them.
- The model forgets to implement `toArray()` for database notifications — it throws silently.
- `via()` method must return an array even for a single channel — `return ['mail']`, not `return 'mail'`.

## Do NOT

- Do NOT store large objects in database notification `data` — use IDs and fetch on read.
- Do NOT use notifications for complex emails — use [Mailables](../laravel-mail/SKILL.md) instead.
