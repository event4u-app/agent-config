# Controller Guidelines

**Skills:** `laravel`, `openapi` | **Guidelines:** [validations.md](validations.md), [resources.md](resources.md)

## Core Rules

- **Single Action Controllers** only (`__invoke()`) — no Resource Controllers
- Each controller must have: FormRequest, OpenAPI schema attributes
- Resources where applicable (Delete = empty, downloads = stream)
- Thin — business logic in Services/Actions

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

`$request->validated()` only. `Resource::make()`. Simple CRUD inline, complex → Service.

## Filters — `paginatedPipeline` with filter classes

```php
$links = Link::query()
    ->paginatedPipeline([
        StringFilter::on('text')->isLike()->some(),
        DateFilter::on('created_at')->all(),
        OrderFilter::on(['id', 'name'])->default(['id' => 'asc']),
    ]);
```

## OpenAPI — extend `{Action}ResourceRequestSchema`. `ValidationErrorResponse` for input, `ResourceNotFoundResponse` for single entity.

| Action  | Request Schema           | Response Schema            | Error Responses                                    |
|---------|--------------------------|----------------------------|----------------------------------------------------|
| Create  | Extended (custom class)  | `CreateResourceResponseSchema` | `ValidationErrorResponse`                      |
| List    | Extended (custom class)  | `ListResourceResponseSchema`  |                                                 |
| Show    | `ShowResourceRequestSchema` | `ShowResourceResponseSchema` | `ResourceNotFoundResponse`                     |
| Update  | Extended (custom class)  | `UpdateResourceResponseSchema` | `ValidationErrorResponse`, `ResourceNotFoundResponse` |
| Delete  | `DeleteResourceRequestSchema` | `DeleteResourceResponseSchema` | `ResourceNotFoundResponse`                  |
| Restore | `RestoreResourceRequestSchema` | `RestoreResourceResponseSchema` | `ResourceNotFoundResponse`               |

