# DTOs & Value Objects

> Typed data instead of untyped arrays.

## DTO (Data Transfer Object)

Structured, immutable data container for passing data between layers.

### When to Use

✅ Passing validated request data to a service/action
✅ Returning structured data from a service
✅ Replacing `array<string, mixed>` in method signatures

### Prefer project's DTO base class — check `composer.json` for DTO packages

#### Attribute-based DTO Example

```php
use App\Models\Equipment;
use Vendor\DataHelpers\SimpleDto;
use Vendor\DataHelpers\SimpleDto\Attributes\ConvertEmptyToNull;
use Vendor\DataHelpers\SimpleDto\Attributes\DateTimeFormat;
use Vendor\DataHelpers\SimpleDto\Attributes\Decimal;
use Vendor\DataHelpers\SimpleDto\Attributes\HasModel;
use Vendor\DataHelpers\SimpleDto\Attributes\Length;
use Vendor\DataHelpers\SimpleDto\Attributes\Map;
use Vendor\DataHelpers\SimpleDto\Attributes\Unsigned;
use Carbon\Carbon;

#[ConvertEmptyToNull]
#[HasModel(Equipment::class)]
class EquipmentDto extends SimpleDto
{
    public function __construct(
        // Primary Key
        #[Map('id_equipment')]
        public ?int $id = null,

        // Equipment identification
        #[Map('equipment_nr'),
            Length(50)]
        public string $equipmentNumber = '',

        #[Map('bezeichnung'),
            Length(250)]
        public string $title = '',

        // External IDs (from client software)
        #[Map('ext_uid'),
            Length(250)]
        public ?string $externalUid = null,

        // Status
        #[Map('is_active'),
            Unsigned,
            Length(1)]
        public bool $isActive = true,

        // Financial
        #[Map('hourly_rate'),
            Unsigned,
            Decimal(10, 2)]
        public float $hourlyRate = 0.0,

        // Timestamps
        #[Map('created_at'),
            DateTimeFormat('Y-m-d H:i:s')]
        public ?Carbon $createdAt = null,

        #[Map('updated_at'),
            DateTimeFormat('Y-m-d H:i:s')]
        public ?Carbon $updatedAt = null,
    ) {}
}
```

#### Attributes: `#[Map]` (column mapping), `#[Length]`, `#[Decimal]`, `#[Unsigned]`, `#[DateTimeFormat]`, `#[Email]`, `#[ConvertEmptyToNull]`, `#[HasModel]` (Eloquent link)

#### Creating and using DTOs

```php
// From array (e.g. API response, request data)
$dto = EquipmentDto::fromArray($data);

// From Eloquent model (requires #[HasModel] + DtoMappingTrait on the model)
$dto = EquipmentDto::fromModel($equipment);

// To array (uses #[Map] names as keys)
$array = $dto->toArray();

// To Eloquent model
$model = $dto->toModel(Equipment::class);

// Collections
$dtos = EquipmentDto::collection($arrayOfData);
```

Extend base class, constructor promotion, `#[Map]` for field names, validation attributes. No business logic.

### Plain DTO (fallback — no package or simple value transfer)

```php
final readonly class CreateOrderDTO
{
    public function __construct(
        public int $customerId,
        public string $description,
        public int $totalInCents,
    ) {}

    public static function fromRequest(CreateOrderRequest $request): self
    {
        /** @var array{customer_id: int, description: string, total: int} $data */
        $data = $request->validated();

        return new self(
            customerId: $data['customer_id'],
            description: $data['description'],
            totalInCents: $data['total'],
        );
    }
}
```

`final readonly class`, constructor promotion, static factory. No logic.

## Value Object — domain concept with validation + equality (`Money`, `Email`, `DateRange`)

### Example

```php
final readonly class Money
{
    public function __construct(
        public int $amountInCents,
        public string $currency = 'EUR',
    ) {
        if ($this->amountInCents < 0) {
            throw new InvalidArgumentException('Amount must not be negative');
        }
    }

    public function add(self $other): self
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException('Cannot add different currencies');
        }

        return new self(
            amountInCents: Math::add($this->amountInCents, $other->amountInCents),
            currency: $this->currency,
        );
    }
}
```

## When NOT to Use

❌ Data only used in one place and structure is obvious — a simple array is fine
❌ Wrapping a single primitive with no validation or behavior

