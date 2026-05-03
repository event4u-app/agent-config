# Factory Pattern

> Encapsulate complex object creation.

## Idea

When creating an object requires configuration, conditional logic, or multiple steps,
extract that logic into a Factory class.

## Laravel Context

- **Model Factories** — Laravel ships with factories for test/seed data (`database/factories/`)
- **Custom Factories** — for domain objects, API clients, or composed objects

## When to Use

✅ Object creation involves multiple steps or configuration
✅ Different implementations based on a type/config value
✅ API client setup with auth, base URL, middleware

## When NOT to Use

❌ Simple `new MyClass()` or `MyClass::create()` — no factory needed
❌ Laravel Model Factories already cover the use case (test data)

## Example

```php
final class ApiClientFactory
{
    public function __construct(private ConfigRepository $config) {}

    public function create(ClientSoftwareType $type): ApiClient
    {
        return match ($type) {
            ClientSoftwareType::KS21 => new Ks21ApiClient(
                baseUrl: $this->config->get('services.ks21.url'),
                apiKey: $this->config->get('services.ks21.key'),
            ),
            ClientSoftwareType::PROBAUS => new ProBauSApiClient(
                baseUrl: $this->config->get('services.probaus.url'),
            ),
        };
    }
}
```

## Rules

- Factory methods should return typed interfaces, not concrete classes (when possible)
- Keep factory logic focused — don't add business logic here
- Name: `{Thing}Factory` or static `{Thing}::create()` for simple cases

