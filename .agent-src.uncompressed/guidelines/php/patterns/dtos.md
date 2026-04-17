# DTOs & Value Objects

> Typed data instead of untyped arrays.

## DTO (Data Transfer Object)

Structured, immutable data container for passing data between layers.

### When to Use

✅ Passing validated request data to a service/action
✅ Returning structured data from a service
✅ Replacing `array<string, mixed>` in method signatures

### Prefer a DTO base class (if available)

If the project uses a DTO package with attribute-based mapping (e.g., `SimpleDto`, `spatie/data-transfer-object`),
new DTOs **should extend the project's base class**. Check `composer.json` for DTO-related packages.

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

#### Key attribute-based DTO features

- **`#[Map('db_column')]`** — Maps a readable property name to a database column or API field name
- **`#[Length(n)]`** — Validates max string length
- **`#[Decimal(precision, scale)]`** — Validates decimal format
- **`#[Unsigned]`** — Validates non-negative values
- **`#[DateTimeFormat('Y-m-d H:i:s')]`** — Casts to/from Carbon with the given format
- **`#[Email]`** — Validates email format
- **`#[ConvertEmptyToNull]`** — Class-level: converts empty strings to `null`
- **`#[HasModel(Model::class)]`** — Links the DTO to an Eloquent model for `fromModel()` / `toModel()`

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

#### Attribute-based DTO rules

- Extend the project's DTO base class
- Use constructor property promotion with public properties
- Use `#[Map('column_name')]` to map properties to database/API field names
- Use validation attributes (`#[Length]`, `#[Decimal]`, `#[Email]`, etc.) for constraints
- Use `#[ConvertEmptyToNull]` at class level when empty strings should become `null`
- Use `#[HasModel(Model::class)]` when the DTO maps to an Eloquent model
- No business logic — just data and mapping
- Check if the base class requires mutable or immutable properties

### Plain DTO (Fallback)

When no DTO package is available or attribute-based mapping is not suitable (e.g. for very simple
value transfer between methods), a plain readonly DTO is acceptable:

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

#### Plain DTO Rules

- Always `final readonly class`
- Constructor property promotion
- Static factory method `fromRequest()`, `fromArray()`, etc.
- No business logic — just data

## Value Object

Represents a domain concept with validation and equality semantics.

### When to Use

✅ Domain concepts: `Money`, `Email`, `DateRange`, `Coordinates`
✅ Value needs validation on creation
✅ Two instances with same values should be considered equal

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

