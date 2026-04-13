# Controller Guidelines

> Project-specific controller conventions. Thin controllers, single-action pattern, OpenAPI annotations.

**Related Skills:** `api-endpoint`, `laravel`, `openapi`
**Related Guidelines:** [validations.md](validations.md), [resources.md](resources.md)

## Core Rules

- **Single Action Controllers** only (`__invoke()`) — no Resource Controllers
- Each controller must have: FormRequest, OpenAPI schema attributes
- Use Resource responses where applicable (not all controllers return JSON — e.g. Delete returns an empty response, file downloads return a file stream)
- Thin controllers — business logic in Services/Actions

## Naming Schema

| Action  | Controller                  | FormRequest                | Resource             |
|---------|-----------------------------|----------------------------|----------------------|
| Create  | `Create{Entity}Controller`  | `Create{Entity}Request`    | `{Entity}Resource`   |
| List    | `List{Entities}Controller`  | `List{Entities}Request`    | `{Entity}Resource`   |
| Show    | `Show{Entity}Controller`    | `Show{Entity}Request`      | `{Entity}Resource`   |
| Update  | `Update{Entity}Controller`  | `Update{Entity}Request`    | `{Entity}Resource`   |
| Delete  | `Delete{Entity}Controller`  | `Delete{Entity}Request`    | empty `Response`     |
| Restore | `Restore{Entity}Controller` | `Restore{Entity}Request`   | `{Entity}Resource`   |

> List uses **plural** entity name. All others use **singular**.

## HTTP Actions

| Action  | Method | Path                 | Notes                                     |
|---------|--------|----------------------|-------------------------------------------|
| Create  | POST   | `/api/{entities}`    | JSON body                                 |
| List    | GET    | `/api/{entities}`    | Filters, Pagination                       |
| Show    | GET    | `/api/{entities}/{id}` |                                         |
| Update  | PATCH  | `/api/{entities}/{id}` | JSON body                               |
| Delete  | DELETE | `/api/{entities}/{id}` | `?force=true` for hard delete            |
| Restore | GET    | `/api/{entities}/{id}/restore` |                                |

## Controller Pattern

```php
class CreateLinkController extends Controller
{
    #[CreateLinkRequestSchema(path: '/links', version: '1', resource: LinkResource::class)]
    #[CreateResourceResponseSchema(LinkResource::class)]
    #[ValidationErrorResponse]
    public function __invoke(CreateLinkRequest $request): LinkResource
    {
        $link = Link::create($request->validated());
        return LinkResource::make($link);
    }
}
```

**Key points:**
- Use `$request->validated()` — never `$request->all()`
- Use `Resource::make()` instead of `new Resource()` (easier to test)
- Simple CRUD can live directly in the controller
- Complex logic → Service class / Repository

## Filters & Ordering

Use the `pipeline` / `paginatedPipeline` macros with filter classes:

```php
$links = Link::query()
    ->paginatedPipeline([
        StringFilter::on('text')->isLike()->some(),
        DateFilter::on('created_at')->all(),
        OrderFilter::on(['id', 'name'])->default(['id' => 'asc']),
    ]);
```

## OpenAPI Documentation

- Always extend `{Action}ResourceRequestSchema` for Create/Update/List (keeps controllers clean)
- Show/Delete/Restore use the base schema classes directly
- No per-endpoint auth/permission error schemas (documented globally)
- **`ValidationErrorResponse`** must be added to **every** controller that accepts input (Create, Update, etc.)
- **`ResourceNotFoundResponse`** must be added to every controller that queries a single entity (Show, Update, Delete, Restore)

| Action  | Request Schema           | Response Schema            | Error Responses                                    |
|---------|--------------------------|----------------------------|----------------------------------------------------|
| Create  | Extended (custom class)  | `CreateResourceResponseSchema` | `ValidationErrorResponse`                      |
| List    | Extended (custom class)  | `ListResourceResponseSchema`  |                                                 |
| Show    | `ShowResourceRequestSchema` | `ShowResourceResponseSchema` | `ResourceNotFoundResponse`                     |
| Update  | Extended (custom class)  | `UpdateResourceResponseSchema` | `ValidationErrorResponse`, `ResourceNotFoundResponse` |
| Delete  | `DeleteResourceRequestSchema` | `DeleteResourceResponseSchema` | `ResourceNotFoundResponse`                  |
| Restore | `RestoreResourceRequestSchema` | `RestoreResourceResponseSchema` | `ResourceNotFoundResponse`               |

