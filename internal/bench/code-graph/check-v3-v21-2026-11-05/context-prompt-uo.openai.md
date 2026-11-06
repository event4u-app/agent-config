You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


These edges come back with more context: the source file's imports, the declarations of the receiver the call goes through, and route registration / group prefixes where routes are involved.


Subject: `unopim` at its registered pin.



===== EDGE E8ad631b8f2 =====
{"id": "E8ad631b8f2", "from": "packages/Webkul/Webhook/src/Routes/web.php:13", "to_symbol": "WebhookController::update", "to": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:80", "kind": "route"}
--- packages/Webkul/Webhook/src/Routes/web.php:11-15
   11              Route::post('create', 'store')->name('webhook.store');
   12              Route::get('edit/{id}', 'edit')->name('webhook.edit')->whereNumber('id');
   13              Route::put('edit/{id}', 'update')->name('webhook.update')->whereNumber('id');
   14              Route::delete('delete/{id}', 'destroy')->name('webhook.delete')->whereNumber('id');
   15              Route::post('mass-delete', 'massDestroy')->name('webhook.mass_delete');
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:78-82
   78       * Update the specified webhook.
   79       */
   80      public function update(WebhookForm $request, int $id): RedirectResponse
   81      {
   82          abort_unless(bouncer()->hasPermission('configuration.webhook.edit'), 403);
--- packages/Webkul/Webhook/src/Routes/web.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Webhook\Http\Controllers\WebhookController;
    5  use Webkul\Webhook\Http\Controllers\WebhookLogsController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Webhook/src/Routes/web.php (route groups / registration)
    7  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function (): void {
    8      Route::prefix('configuration/webhook')->group(function (): void {
    9          Route::controller(WebhookController::class)->group(function (): void {
   19          Route::controller(WebhookLogsController::class)->prefix('logs')->group(function (): void {


===== EDGE Ea21faba1fb =====
{"id": "Ea21faba1fb", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:487", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in createVariantUnderGroup (428)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:485-489
  485              $this->productRepository->getModel()::query()->whereKey($group->id)->lockForUpdate()->first();
  486  
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {
  488                  throw new UnprocessableEntityHttpException(
  489                      trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($axisTuple)])
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (declarations of productRepository)
   35          protected ProductRepository $productRepository,
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  309              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {


===== EDGE E5ba45ea588 =====
{"id": "E5ba45ea588", "from": "packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:43", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call"}
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:41-45
   41      $simple->save();
   42  
   43      expect(fn () => $repository->update([
   44          'sku'    => 'ag-simple',
   45          'values' => ['common' => [$material->code => 'wood']],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Validation\ValidationException;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAxis;
   11  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php (declarations of repository)
   30      $repository = app(ProductRepository::class);
   32      $configurable = $repository->create([
   43      expect(fn () => $repository->update([
   63      $repository = app(ProductRepository::class);


===== EDGE E2cf63db865 =====
{"id": "E2cf63db865", "from": "packages/Webkul/Product/src/Type/Configurable.php:229", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:227-231
  227                  $planner->primeStructure($group->id, $loadedStructure);
  228  
  229                  Event::dispatch('catalog.product.create.after', $group);
  230              } else {
  231                  if (! $group = $existingGroups->pull($groupKey)) {
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE E9077483041 =====
{"id": "E9077483041", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:85", "to_symbol": "PlatformValidator::apiUrlError", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:118", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:83-87
   83              default: $sameProvider ? (string) $platform?->api_url : $provider->defaultUrl(),
   84              validate: fn (string $value): ?string => $this->fieldError('api_url', trim($value) ?: null)
   85                  ?? $this->platformValidator->apiUrlError($provider->value, $value),
   86              hint: trans('admin::app.configuration.platform.fields.api-url-hint'),
   87          ));
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:116-120
  116       * unrelated host; any URL must pass the SSRF check.
  117       */
  118      public function apiUrlError(?string $provider, ?string $apiUrl): ?string
  119      {
  120          $apiUrl = trim((string) $apiUrl);
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php (imports)
    3  namespace Webkul\MagicAI\Console\Commands\Platform\Concerns;
    5  use Illuminate\Support\Facades\DB;
    6  use Illuminate\Support\Facades\Validator;
    7  use Illuminate\Validation\ValidationException;
    8  use Webkul\MagicAI\Console\Support\StdinReader;
    9  use Webkul\MagicAI\Enums\AiProvider;
   10  use Webkul\MagicAI\Models\MagicAIPlatform;
   11  use Webkul\MagicAI\Services\ModelDiscovery;
   12  use Webkul\MagicAI\Support\ModelRecommender;
   14  use function Laravel\Prompts\confirm;
   15  use function Laravel\Prompts\error;
   16  use function Laravel\Prompts\info;
   17  use function Laravel\Prompts\multiselect;
   18  use function Laravel\Prompts\password;
   19  use function Laravel\Prompts\select;
   20  use function Laravel\Prompts\spin;
   21  use function Laravel\Prompts\table;
   22  use function Laravel\Prompts\text;
   23  use function Laravel\Prompts\warning;
   77              required: true,
   91              required: ! $platform?->safeApiKey(),
   99                  required: true,
  104                  required: true,
  160                  required: true,
  170              required: trans('admin::app.configuration.platform.command.models-required'),
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php (declarations of platformValidator)
  123              validate: fn (bool $enabled): ?string => $this->platformValidator->defaultStatusError($isDefault, $enabled),
  161                  validate: fn (string $value): ?string => $this->platformValidator->modelNamesError($value),
  175              validate: fn (string $value): ?string => trim($value) === '' ? null : $this->platformValidator->modelNamesError($value),
  180              ...($additional === '' ? [] : $this->platformValidator->splitModels($additional)),


===== EDGE E6036928b3a =====
{"id": "E6036928b3a", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:271", "to_symbol": "Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "dispatch", "note": "Event::dispatch('catalog.product.bulk.edit.after')"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:269-273
  269  
  270          if ($productIds !== []) {
  271              Event::dispatch('catalog.product.bulk.edit.after', ['ids' => $productIds]);
  272          }
  273  
--- packages/Webkul/Webhook/src/Listeners/Product.php:82-86
   82       * @param  array<int>  $ids
   83       */
   84      public function afterBulkEdit(array $ids): void
   85      {
   86          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_UPDATED)) {
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php (imports)
    3  namespace Webkul\DataTransfer\Jobs\System;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Collection;
    9  use Illuminate\Support\Facades\Auth;
   10  use Illuminate\Support\Facades\Event;
   11  use Illuminate\Support\Facades\Storage;
   12  use Illuminate\Validation\ValidationException;
   13  use Webkul\Attribute\Contracts\Attribute;
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Attribute\Services\AttributeService;
   16  use Webkul\DataTransfer\Helpers\AbstractJob;
   17  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   18  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   19  use Webkul\DataTransfer\Services\JobLogger;
   20  use Webkul\Product\Contracts\VariantStructurePlanner;
   21  use Webkul\Product\Models\Product;
   22  use Webkul\Product\Repositories\ProductRepository;
   23  use Webkul\Product\Validator\ProductValuesValidator;
   24  use Webkul\User\Models\AdminProxy;
   28      use Queueable;


===== EDGE Ecc5e411282 =====
{"id": "Ecc5e411282", "from": "packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:41", "to_symbol": "CallAiProviderStage::handle", "to": "packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:27", "kind": "framework", "note": "Illuminate Pipeline ->through($this->stages) invokes each stage handle()"}
--- packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:39-43
   39          return resolve(Pipeline::class)
   40              ->send($payload)
   41              ->through($this->stages)
   42              ->via('handle')
   43              ->thenReturn();
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:25-29
   25       * {@inheritdoc}
   26       */
   27      public function handle(AgentPayload $payload, \Closure $next): AgentPayload
   28      {
   29          $credential = $this->credentialRepository->findOrFail($payload->credentialId);
--- packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php (imports)
    3  namespace Webkul\AiAgent\Pipelines;
    5  use Illuminate\Pipeline\Pipeline;
    6  use Webkul\AiAgent\Contracts\PipelineStageContract;
    7  use Webkul\AiAgent\DTOs\AgentPayload;


===== EDGE Ec065e88c78 =====
{"id": "Ec065e88c78", "from": "packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:144", "to_symbol": "AiApiClient::testConnection", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:106", "kind": "call", "note": "CredentialController has no route in ai-agent-routes.php"}
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:142-146
  142  
  143          $this->apiClient->configure($config);
  144          $result = $this->apiClient->testConnection();
  145  
  146          return new JsonResponse([
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:104-108
  104       * @return array{success: bool, message: string}
  105       */
  106      public function testConnection(): array
  107      {
  108          try {
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php (imports)
    3  namespace Webkul\AiAgent\Http\Controllers;
    5  use Illuminate\Contracts\View\Factory;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Routing\Controller;
    8  use Illuminate\View\View;
    9  use Webkul\AiAgent\DataGrids\Credential\CredentialDataGrid;
   10  use Webkul\AiAgent\DTOs\CredentialConfig;
   11  use Webkul\AiAgent\Http\Client\AiApiClient;
   12  use Webkul\AiAgent\Http\Requests\CredentialForm;
   13  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php (declarations of apiClient)
   19          protected AiApiClient $apiClient,
  144          $result = $this->apiClient->testConnection();


===== EDGE E2733c89b55 =====
{"id": "E2733c89b55", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:27", "to_symbol": "CollectsPlatform::collectAndSave", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:38", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:25-29
   25      protected function perform(): int
   26      {
   27          return $this->collectAndSave(null);
   28      }
   29  }
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:36-40
   36       * Collect the platform, confirm it interactively and save it.
   37       */
   38      protected function collectAndSave(?MagicAIPlatform $platform): int
   39      {
   40          $data = $this->input->isInteractive()
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php (imports)
    3  namespace Webkul\MagicAI\Console\Commands\Platform;
    5  use Illuminate\Console\Attributes\Description;
    6  use Illuminate\Console\Attributes\Signature;
    7  use Webkul\MagicAI\Console\Commands\Platform\Concerns\CollectsPlatform;
   23      use CollectsPlatform;


===== EDGE E953c579b63 =====
{"id": "E953c579b63", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:200", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "dispatch", "note": "Event::dispatch('catalog.product.update.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:198-202
  198  
  199              if ($wasDirty) {
  200                  Event::dispatch('catalog.product.update.after', $product);
  201              }
  202  
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE E83ba8e5085 =====
{"id": "E83ba8e5085", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:131", "to_symbol": "SimpleProductController::update", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:129", "kind": "route", "note": "admin.api.products.update"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:129-133
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:127-131
  127       * Update the specified resource in storage.
  128       */
  129      public function update(UpdateSimpleProductRequest $request, string $sku): JsonResponse
  130      {
  131          $data = $request->only([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E2ee8bc4b14 =====
{"id": "E2ee8bc4b14", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:225", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:223-227
  223          $product = $this->productRepository->create($data);
  224  
  225          Event::dispatch('catalog.product.create.after', $product);
  226  
  227          session()->flash('success', trans('admin::app.catalog.products.create-success'));
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;


===== EDGE E2cd0bdea38 =====
{"id": "E2cd0bdea38", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantDetachmentTest.php:53", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantDetachmentTest.php:51-55
   51  
   52      $this->withHeaders($this->headers)
   53          ->json('POST', route('admin.api.configurable_products.store'), $payload)
   54          ->assertStatus(201);
   55  
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantDetachmentTest.php (imports)
    3  use Webkul\Attribute\Models\AttributeFamily;
    4  use Webkul\Product\Enums\ProductType;
    5  use Webkul\Product\Models\Product;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E688bb70155 =====
{"id": "E688bb70155", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:115", "to_symbol": "ProductController::updateProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:126", "kind": "call", "note": "in store (70)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:113-117
  113              }
  114  
  115              $product = $this->updateProduct($data, $product);
  116  
  117              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:124-128
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE Eda8ae34bf8 =====
{"id": "Eda8ae34bf8", "from": "packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:72", "to_symbol": "ImageProductAgent::analyze", "to": "packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:54", "kind": "call"}
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:70-74
   70  
   71              $this->withProgressBar(1, function () use ($imageAgent, $imageUrl, $agentId, $credentialId): void {
   72                  $imageAgent->analyze(
   73                      imageSource: $imageUrl,
   74                      agentId: $agentId,
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:52-56
   52       * @param  array<string, mixed>  $additionalContext  Extra context to pass to the agent
   53       */
   54      public function analyze(
   55          string $imageSource,
   56          int $agentId,
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php (imports)
    3  namespace Webkul\AiAgent\Examples;
    5  use Illuminate\Console\Attributes\Description;
    6  use Illuminate\Console\Attributes\Signature;
    7  use Illuminate\Console\Command;
    8  use Webkul\AiAgent\Agents\ImageProductAgent;
    9  use Webkul\AiAgent\Repositories\AgentRepository;
   10  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php (declarations of imageAgent)
   71              $this->withProgressBar(1, function () use ($imageAgent, $imageUrl, $agentId, $credentialId): void {


===== EDGE Ef27922c32c =====
{"id": "Ef27922c32c", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:312", "to_symbol": "route admin.api.configurable_products.update", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:152", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:310-314
  310      ]);
  311  
  312      $this->withHeaders($this->headers)->json('PUT', route('admin.api.configurable_products.update', 'vgu-group'), [
  313          'family' => $family->code,
  314          'values' => ['common' => ['sku' => 'vgu-group', $color->code => $greenOption]],
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:150-154
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
  154              Route::patch('{code}', 'partialUpdate')->name('admin.api.'.$nameSuffix.'.patch');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\Event;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAxis;
   11  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E1eb608e61b =====
{"id": "E1eb608e61b", "from": "packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:164", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:162-166
  162          $parent = Product::factory()->configurable()->create();
  163  
  164          $result = $this->productRepository->isUniqueVariantForProduct(
  165              $parent->id,
  166              ['color' => 'red']
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php (imports)
    3  use Illuminate\Database\Eloquent\ModelNotFoundException;
    4  use Illuminate\Foundation\Testing\DatabaseTransactions;
    5  use Illuminate\Support\Facades\DB;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php (declarations of productRepository)
   14      $this->productRepository = app(ProductRepository::class);
   28          $product = $this->productRepository->create($data);
   51          $product = $this->productRepository->create($data);
   67          $updated = $this->productRepository->updateStatus(false, $product->id);


===== EDGE Eca3f77b035 =====
{"id": "Eca3f77b035", "from": "packages/Webkul/Webhook/src/Routes/web.php:16", "to_symbol": "WebhookController::test", "to": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:140", "kind": "route"}
--- packages/Webkul/Webhook/src/Routes/web.php:14-18
   14              Route::delete('delete/{id}', 'destroy')->name('webhook.delete')->whereNumber('id');
   15              Route::post('mass-delete', 'massDestroy')->name('webhook.mass_delete');
   16              Route::post('test', 'test')->name('webhook.test');
   17          });
   18  
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:138-142
  138       * Probe a webhook URL with a test payload before the admin saves it.
  139       */
  140      public function test(Request $request): JsonResponse
  141      {
  142          abort_unless(bouncer()->hasPermission('configuration.webhook.create') || bouncer()->hasPermission('configuration.webhook.edit'), 403);
--- packages/Webkul/Webhook/src/Routes/web.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Webhook\Http\Controllers\WebhookController;
    5  use Webkul\Webhook\Http\Controllers\WebhookLogsController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Webhook/src/Routes/web.php (route groups / registration)
    7  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function (): void {
    8      Route::prefix('configuration/webhook')->group(function (): void {
    9          Route::controller(WebhookController::class)->group(function (): void {
   19          Route::controller(WebhookLogsController::class)->prefix('logs')->group(function (): void {


===== EDGE E35f44d2599 =====
{"id": "E35f44d2599", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:216", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in storeVariantGroup (179)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:214-218
  214              $this->productRepository->getModel()::query()->whereKey($parent->id)->lockForUpdate()->first();
  215  
  216              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($parent->id, $axisTuple, null, '', ProductType::VariantGroup->value)) {
  217                  return null;
  218              }
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (declarations of productRepository)
  158              $product = $this->productRepository->create($data);
  216              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($parent->id, $axisTuple, null, '', ProductType::VariantGroup->value)) {


===== EDGE E0dc355984a =====
{"id": "E0dc355984a", "from": "packages/Webkul/Product/src/Type/Configurable.php:304", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in updateVariantGroupValues"}
--- packages/Webkul/Product/src/Type/Configurable.php:302-306
  302  
  303          if ($group->parent_id && $submitted !== []) {
  304              $this->productRepository->guardVariantLevelWrite($group, $submitted, $persist, $planner);
  305  
  306              return;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/src/Type/Configurable.php (declarations of productRepository)
  112          $product = $this->productRepository->getModel()->create($data);
  270              $orphan->variants->each(fn ($child) => $this->productRepository->delete($child->id));
  318          $group = $this->productRepository->getModel()->create([
  355          $variant = $this->productRepository->getModel()->create([


===== EDGE Ed223bb0a53 =====
{"id": "Ed223bb0a53", "from": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:16", "to_symbol": "AgentService::execute", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:34", "kind": "framework", "note": "interface method implemented by AgentService (bound at AiAgentServiceProvider:104)"}
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:14-18
   14       * Execute an agent with the given payload.
   15       */
   16      public function execute(AgentPayload $payload): AgentResult;
   17  
   18      /**
--- packages/Webkul/AiAgent/src/Services/AgentService.php:32-36
   32       * Execute an agent synchronously through the pipeline.
   33       */
   34      public function execute(AgentPayload $payload): AgentResult
   35      {
   36          $startTime = hrtime(true);
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php (imports)
    3  namespace Webkul\AiAgent\Contracts;
    5  use Webkul\AiAgent\DTOs\AgentPayload;
    6  use Webkul\AiAgent\DTOs\AgentResult;


===== EDGE Eb612b37491 =====
{"id": "Eb612b37491", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:225", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:223-227
  223          $product = $this->productRepository->create($data);
  224  
  225          Event::dispatch('catalog.product.create.after', $product);
  226  
  227          session()->flash('success', trans('admin::app.catalog.products.create-success'));
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;


===== EDGE Ef29cdfaf8f =====
{"id": "Ef29cdfaf8f", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:58", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:56-60
   56      $secondBrand = $brand->options->last()->code;
   57  
   58      $this->withHeaders($this->headers)->json('POST', route('admin.api.configurable_products.store'), [
   59          'type'   => ProductType::VariantGroup->value,
   60          'parent' => $configurable->sku,
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Models\Product;
    8  use Webkul\Product\Models\VariantStructure;
    9  use Webkul\Product\Models\VariantStructureAxis;
   10  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E6cd8258253 =====
{"id": "E6cd8258253", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:61", "to_symbol": "AiProvider::fetchModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:144", "kind": "call", "note": "api_url supplied -> discoveryOptions -> ssrfGuardedOptions"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:59-63
   59      });
   60  
   61      $provider->fetchModels('sk-test-key', $apiUrl, new Client(['handler' => $stack]));
   62  
   63      expect($reached[0])->toStartWith($expected);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:142-146
  142       * @return list<string>
  143       */
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php (imports)
    3  use GuzzleHttp\Client;
    4  use GuzzleHttp\Handler\MockHandler;
    5  use GuzzleHttp\HandlerStack;
    6  use GuzzleHttp\Psr7\Response;
    7  use Laravel\Ai\Enums\Lab;
    8  use Webkul\MagicAI\Enums\AiProvider;
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php (declarations of provider)
   10  it('exposes Concentrate as a first-class provider on the openai-compatible driver', function () {
   18  it('lists Concentrate in the provider dropdown options', function () {
   46  it('discovers models against the platform base url for every hosted provider', function (AiProvider $provider, string $apiUrl, string $expected) {
   61      $provider->fetchModels('sk-test-key', $apiUrl, new Client(['handler' => $stack]));


===== EDGE E101b329d3d =====
{"id": "E101b329d3d", "from": "packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php:11", "to_symbol": "WebhookForm::rules", "to": "packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:41", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php:9-13
    9      $request->setContainer(app());
   10  
   11      return $request->rules();
   12  }
   13  
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:39-43
   39       * @return array<string, mixed>
   40       */
   41      public function rules(): array
   42      {
   43          return [
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php (imports)
    3  use Illuminate\Support\Facades\Validator;
    4  use Webkul\Webhook\Http\Requests\WebhookForm;
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php (declarations of request)
    8      $request = WebhookForm::create('/admin/configuration/webhook/create', 'POST');


===== EDGE E9a132ee6ac =====
{"id": "E9a132ee6ac", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:159", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:157-161
  157              Event::dispatch('catalog.product.create.before');
  158              $product = $this->productRepository->create($data);
  159              Event::dispatch('catalog.product.create.after', $product);
  160  
  161              $product = $this->updateProduct($data, $product);
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE Ed6b1ae8664 =====
{"id": "Ed6b1ae8664", "from": "packages/Webkul/Product/src/Type/Configurable.php:250", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:248-252
  248                      $planner->primeStructure($variant->id, $loadedStructure);
  249  
  250                      Event::dispatch('catalog.product.create.after', $variant);
  251                  } else {
  252                      if (is_numeric($index = $previousGroupVariantIds->search($variantId))) {
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE Eead35e696b =====
{"id": "Eead35e696b", "from": "packages/Webkul/AiAgent/Config/ai-agent.php:41", "to_symbol": "AnalyzeImage", "to": "packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:16", "kind": "framework", "note": "chat tool registry config (ai-agent tools list)"}
--- packages/Webkul/AiAgent/Config/ai-agent.php:39-43
   39          Tools\GenerateImage::class   => ['name' => 'generate_image', 'group' => 'content', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
   40          Tools\EditImage::class       => ['name' => 'edit_image', 'group' => 'content', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
   41          Tools\AnalyzeImage::class    => ['name' => 'analyze_image', 'group' => 'content', 'write' => false, 'permission' => 'catalog.products', 'enabled' => true],
   42  
   43          Tools\ListCategories::class   => ['name' => 'list_categories', 'group' => 'taxonomy', 'write' => false, 'permission' => 'catalog.categories', 'enabled' => true],
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:14-18
   14  use Webkul\MagicAI\Enums\AiProvider;
   15  
   16  class AnalyzeImage implements PimTool
   17  {
   18      public function __construct(
--- packages/Webkul/AiAgent/Config/ai-agent.php (imports)
    3  use Webkul\AiAgent\Chat\Tools;


===== EDGE E2615576e60 =====
{"id": "E2615576e60", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:209", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in updateProduct (126)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:207-211
  207              $result = $product;
  208  
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  210                  $result = $persist();
  211              });
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (declarations of productRepository)
   35          protected ProductRepository $productRepository,
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  309              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {


===== EDGE E7d0878f63f =====
{"id": "E7d0878f63f", "from": "packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:34", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:32-36
   32          $this->apiClient->configure($config);
   33  
   34          $response = $this->apiClient->chat(
   35              messages: $payload->messages,
   36              maxTokens: $payload->metadata['maxTokens'] ?? 4096,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php (imports)
    3  namespace Webkul\AiAgent\Pipelines\Stages;
    5  use Webkul\AiAgent\Contracts\PipelineStageContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\CredentialConfig;
    8  use Webkul\AiAgent\Http\Client\AiApiClient;
    9  use Webkul\AiAgent\Repositories\CredentialRepository;
   10  use Webkul\AiAgent\Services\TokenUsageRecorder;
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php (declarations of apiClient)
   19          protected AiApiClient $apiClient,
   34          $response = $this->apiClient->chat(


===== EDGE E70c1b332e1 =====
{"id": "E70c1b332e1", "from": "packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php:61", "to_symbol": "BulkProductEnricherAgent::enrichBatch", "to": "packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:52", "kind": "call"}
--- packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php:59-63
   59          // Run enrichment
   60          $bar = $this->output->createProgressBar(1);
   61          $result = $enricher->enrichBatch(
   62              products: $productData,
   63              agentId: $agentId,
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:50-54
   50       * @param  array<string, mixed>  $context
   51       */
   52      public function enrichBatch(
   53          array $products,
   54          int $agentId,
--- packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php (imports)
    3  namespace Webkul\AiAgent\Examples;
    5  use Illuminate\Console\Attributes\Description;
    6  use Illuminate\Console\Attributes\Signature;
    7  use Illuminate\Console\Command;
    8  use Webkul\AiAgent\Agents\BulkProductEnricherAgent;
    9  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php (declarations of enricher)
   61          $result = $enricher->enrichBatch(


===== EDGE Eb99fa30e6d =====
{"id": "Eb99fa30e6d", "from": "packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:44", "to_symbol": "WebhookService::sendCreatedToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:46", "kind": "call"}
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:42-46
   42  
   43          match ($this->eventType) {
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),
   46              default   => null,
--- packages/Webkul/Webhook/src/Services/WebhookService.php:44-48
   44       * Send a product.created event to every subscribed webhook.
   45       */
   46      public function sendCreatedToWebhook(Product $product, array $productChanges = []): ?Response
   47      {
   48          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_CREATED);
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php (imports)
    3  namespace Webkul\Webhook\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Auth;
    8  use Webkul\Product\Models\ProductProxy;
    9  use Webkul\User\Models\AdminProxy;
   10  use Webkul\Webhook\Services\WebhookService;
   14      use Queueable;
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php (declarations of webhookService)
   31      public function handle(WebhookService $webhookService): void
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),


===== EDGE Eb45456c84b =====
{"id": "Eb45456c84b", "from": "packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:96", "to_symbol": "EnrichmentService::enrich", "to": "packages/Webkul/AiAgent/src/Services/EnrichmentService.php:44", "kind": "call"}
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:94-98
   94                      ));
   95  
   96                      $enriched = $this->enrichmentService->enrich(
   97                          ctx: $ctx,
   98                          credentialId: 0,
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:42-46
   42       * @throws ApiException
   43       */
   44      public function enrich(ImageProductContext $ctx, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
   45      {
   46          // Check completeness against locale-specific data only.  Merging with
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php (imports)
    3  namespace Webkul\AiAgent\Chat\Tools;
    5  use Illuminate\Contracts\JsonSchema\JsonSchema;
    6  use Illuminate\Support\Facades\DB;
    7  use Laravel\Ai\Contracts\Tool;
    8  use Laravel\Ai\Tools\Request;
    9  use Webkul\AiAgent\Chat\ChatContext;
   10  use Webkul\AiAgent\Chat\Concerns\ChecksPermission;
   11  use Webkul\AiAgent\Chat\Contracts\PimTool;
   12  use Webkul\AiAgent\DTOs\CredentialConfig;
   13  use Webkul\AiAgent\DTOs\ImageProductContext;
   14  use Webkul\AiAgent\Http\Client\AiApiClient;
   15  use Webkul\AiAgent\Services\EnrichmentService;
   16  use Webkul\MagicAI\Enums\AiProvider;
   17  use Webkul\Product\Repositories\ProductRepository;
   31              use ChecksPermission;
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php (declarations of enrichmentService)
   22          protected EnrichmentService $enrichmentService,
   27          $enrichmentService = $this->enrichmentService;
   33              public function __construct(ChatContext $context, protected EnrichmentService $enrichmentService)
   96                      $enriched = $this->enrichmentService->enrich(


===== EDGE E8be2c17633 =====
{"id": "E8be2c17633", "from": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "to_symbol": "MagicAIPlatformController::fetchModels", "to": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:321", "kind": "route"}
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:319-323
  319      }
  320  
  321      public function fetchModels(FetchModelsRequest $request): JsonResponse
  322      {
  323          if (! bouncer()->hasPermission('ai-agent.platform')) {
--- packages/Webkul/Admin/src/Routes/rest-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\DashboardController;
    5  use Webkul\Admin\Http\Controllers\DataGridController;
    6  use Webkul\Admin\Http\Controllers\HelpController;
    7  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIController;
    8  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIPlatformController;
    9  use Webkul\Admin\Http\Controllers\MagicAI\MagicAISystemPromptController;
   10  use Webkul\Admin\Http\Controllers\ManageColumnController;
   11  use Webkul\Admin\Http\Controllers\MediaController;
   12  use Webkul\Admin\Http\Controllers\TinyMCEController;
   13  use Webkul\Admin\Http\Controllers\User\AccountController;
   14  use Webkul\Admin\Http\Controllers\User\AclVersionController;
   15  use Webkul\Admin\Http\Controllers\User\SessionController;
   16  use Webkul\Admin\Http\Controllers\VueJsSelect\SelectOptionsController;
   17  use Webkul\HistoryControl\Http\Controllers\HistoryController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/rest-routes.php (route groups / registration)
   22  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   33      Route::controller(DashboardController::class)->prefix('dashboard')->group(function () {
   42      Route::controller(HelpController::class)->prefix('help')->group(function () {
   68      Route::controller(MagicAIController::class)->prefix('magic-ai')->group(function () {
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  125      Route::controller(MagicAISystemPromptController::class)->prefix('magic-ai/system-prompts')->group(function () {
  141      Route::controller(AccountController::class)->prefix('account')->group(function () {
  150      Route::controller(HistoryController::class)->prefix('history')->group(function () {


===== EDGE Eafa2ba0d83 =====
{"id": "Eafa2ba0d83", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:133", "to_symbol": "SimpleProductController::partialUpdate", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:168", "kind": "route", "note": "admin.api.products.patch"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:131-135
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');
  134  
  135      });
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:166-170
  166       * Partial Update the specified resource in storage.
  167       */
  168      public function partialUpdate(PartialUpdateSimpleProductRequest $request, string $sku): JsonResponse
  169      {
  170          $data = $request->only([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE Ebfe254abf5 =====
{"id": "Ebfe254abf5", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1280", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in ProductController::update (1269)"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1278-1282
 1278  
 1279          if (! empty($configurableValues) && $product->parent_id) {
 1280              $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1281                  productId: $product->parent_id,
 1282                  configAttributes: $configurableValues,
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (declarations of productRepository)
   88          protected ProductRepository $productRepository,
  223          $product = $this->productRepository->create($data);
  244          $configurable = $this->productRepository->findOrFail($configurableId);
  323          $parent = $this->productRepository->find($parentId);


===== EDGE E91e2fb72a6 =====
{"id": "E91e2fb72a6", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:316", "to_symbol": "ProductController::patchProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:261", "kind": "call", "note": "in partialUpdate (298)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:314-318
  314              Event::dispatch('catalog.product.update.before', $product->id);
  315  
  316              $this->patchProduct($product, $data);
  317  
  318              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:259-263
  259       * Partial Updates the simple product.
  260       */
  261      public function patchProduct(Product $product, array $data): Product
  262      {
  263          $submittedCommon = $data['values']['common'] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE E9527e93465 =====
{"id": "E9527e93465", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:244", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:242-246
  242          }
  243  
  244          Event::dispatch('catalog.product.create.after', $node);
  245  
  246          return $this->successResponse(
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE E92a9899fac =====
{"id": "E92a9899fac", "from": "packages/Webkul/Product/src/Type/Configurable.php:450", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in updateVariant"}
--- packages/Webkul/Product/src/Type/Configurable.php:448-452
  448              $result = $variant;
  449  
  450              $this->productRepository->guardVariantLevelWrite($variant, $suppliedCommonValues, function () use (&$result, $persist): void {
  451                  $result = $persist();
  452              }, $planner);
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/src/Type/Configurable.php (declarations of productRepository)
  112          $product = $this->productRepository->getModel()->create($data);
  270              $orphan->variants->each(fn ($child) => $this->productRepository->delete($child->id));
  318          $group = $this->productRepository->getModel()->create([
  355          $variant = $this->productRepository->getModel()->create([


===== EDGE E6728511bf4 =====
{"id": "E6728511bf4", "from": "packages/Webkul/Admin/src/Routes/catalog-routes.php:226", "to_symbol": "ProductController::checkVariantUniqueness", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1581", "kind": "route", "note": "admin.catalog.products.check-variant"}
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:224-228
  224              Route::get('filterable-attributes', 'filterableAttributes')->name('admin.catalog.products.filterable_attributes');
  225  
  226              Route::post('check-variant', 'checkVariantUniqueness')->name('admin.catalog.products.check-variant');
  227  
  228              Route::get('get/locale', 'getLocale')->name('admin.catalog.product.get_locale');
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1579-1583
 1579       * Check variant configurable attributes uniqueness
 1580       */
 1581      public function checkVariantUniqueness(CheckVariantUniquenessForm $request): JsonResponse
 1582      {
 1583          $data = $request->validated();
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\Catalog\AssociationTypeController;
    5  use Webkul\Admin\Http\Controllers\Catalog\AttributeController;
    6  use Webkul\Admin\Http\Controllers\Catalog\AttributeFamilyController;
    7  use Webkul\Admin\Http\Controllers\Catalog\AttributeGroupController;
    8  use Webkul\Admin\Http\Controllers\Catalog\AttributeOptionController;
    9  use Webkul\Admin\Http\Controllers\Catalog\CategoryController;
   10  use Webkul\Admin\Http\Controllers\Catalog\CategoryFieldController;
   11  use Webkul\Admin\Http\Controllers\Catalog\Options\AjaxOptionsController;
   12  use Webkul\Admin\Http\Controllers\Catalog\ProductBulkEditController;
   13  use Webkul\Admin\Http\Controllers\Catalog\ProductController;
   14  use Webkul\Admin\Http\Controllers\Catalog\ProductGridViewController;
   15  use Webkul\Admin\Http\Middleware\EnsureChannelLocaleIsValid;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (route groups / registration)
   20  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   21      Route::prefix('catalog')->group(function () {
   25          Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   44          Route::controller(AttributeOptionController::class)->prefix('attributes/{attribute_id}/options')->group(function () {
   61          Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   80          Route::controller(AttributeFamilyController::class)->prefix('attribute-families')->group(function () {
  107          Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  134          Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
  157          Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
  175          Route::controller(AjaxOptionsController::class)->prefix('ajax-options')->group(function () {
  187          Route::controller(ProductController::class)->prefix('products')->group(function () {
  233          Route::controller(ProductGridViewController::class)->prefix('products/grid-views')->group(function () {


===== EDGE E9395360565 =====
{"id": "E9395360565", "from": "packages/Webkul/Product/src/Repositories/ProductRepository.php:61", "to_symbol": "AbstractType::update", "to": "packages/Webkul/Product/src/Type/AbstractType.php:131", "kind": "call", "note": "polymorphic getTypeInstance()->update; inside ProductRepository::update (57)"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:59-63
   59          $product = $this->findOrFail($id);
   60  
   61          $product = $product->getTypeInstance()->update($data, $id, $attribute);
   62  
   63          $product->refresh();
--- packages/Webkul/Product/src/Type/AbstractType.php:129-133
  129       * @return Product
  130       */
  131      public function update(array $data, $id, $attribute = 'id')
  132      {
  133          $product = $this->productRepository->find($id);
--- packages/Webkul/Product/src/Repositories/ProductRepository.php (imports)
    3  namespace Webkul\Product\Repositories;
    5  use Illuminate\Container\Container;
    6  use Illuminate\Database\Eloquent\ModelNotFoundException;
    7  use Illuminate\Support\Collection;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php (declarations of product)
   59          $product = $this->findOrFail($id);
   61          $product = $product->getTypeInstance()->update($data, $id, $attribute);
   66              $product['channels'] = $data['channels'];
   77          $product = $this->findOrFail($id);


===== EDGE E6a68b71bd2 =====
{"id": "E6a68b71bd2", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:189", "to_symbol": "route admin.api.configurable_products.update", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:152", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:187-191
  187      [$family, $structure, $color, $brand, $size, $configurable] = vsrTwoAxisTree('vsr9');
  188  
  189      $this->withHeaders($this->headers)->json('PUT', route('admin.api.configurable_products.update', $configurable->sku), [
  190          'family'            => $family->code,
  191          'variant_structure' => $structure->code,
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:150-154
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
  154              Route::patch('{code}', 'partialUpdate')->name('admin.api.'.$nameSuffix.'.patch');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Models\Product;
    8  use Webkul\Product\Models\VariantStructure;
    9  use Webkul\Product\Models\VariantStructureAxis;
   10  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E7179000877 =====
{"id": "E7179000877", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:112", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:110-114
  110                  Event::dispatch('catalog.product.create.before');
  111                  $product = $this->productRepository->create($data);
  112                  Event::dispatch('catalog.product.create.after', $product);
  113              }
  114  
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE E199985e056 =====
{"id": "E199985e056", "from": "packages/Webkul/AiAgent/src/Services/AgentService.php:53", "to_symbol": "AgentPipeline::process", "to": "packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:37", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/AgentService.php:51-55
   51              $result = $this->pipeline
   52                  ->through($stages)
   53                  ->process($payload);
   54  
   55              $elapsedMs = (int) ((hrtime(true) - $startTime) / 1_000_000);
--- packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:35-39
   35       * Process the payload through all pipeline stages.
   36       */
   37      public function process(AgentPayload $payload): AgentPayload
   38      {
   39          return resolve(Pipeline::class)
--- packages/Webkul/AiAgent/src/Services/AgentService.php (imports)
    3  namespace Webkul\AiAgent\Services;
    5  use Webkul\AiAgent\Contracts\AgentServiceContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\AgentResult;
    8  use Webkul\AiAgent\Jobs\ExecuteAgentJob;
    9  use Webkul\AiAgent\Pipelines\AgentPipeline;
   10  use Webkul\AiAgent\Pipelines\Stages\BuildPromptStage;
   11  use Webkul\AiAgent\Pipelines\Stages\CallAiProviderStage;
   12  use Webkul\AiAgent\Pipelines\Stages\LogExecutionStage;
   13  use Webkul\AiAgent\Pipelines\Stages\ParseResponseStage;
   14  use Webkul\AiAgent\Pipelines\Stages\ValidateInputStage;
   15  use Webkul\AiAgent\Repositories\AgentExecutionRepository;
   16  use Webkul\AiAgent\Repositories\AgentRepository;


===== EDGE Ee6a549293e =====
{"id": "Ee6a549293e", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:154", "to_symbol": "ConfigurableProductController::partialUpdate", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:298", "kind": "route", "note": "admin.api.configurable_products.patch"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:152-156
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
  154              Route::patch('{code}', 'partialUpdate')->name('admin.api.'.$nameSuffix.'.patch');
  155          });
  156      }
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:296-300
  296       * Patch the specified resource in storage.
  297       */
  298      public function partialUpdate(PartialUpdateConfigurableProductRequest $request, string $sku): JsonResponse
  299      {
  300          $data = $request->only([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E07f682349c =====
{"id": "E07f682349c", "from": "packages/Webkul/AiAgent/src/Services/VisionService.php:132", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/VisionService.php:130-134
  130  
  131          $rawResponse = $this->callWithRetry(
  132              fn (): array => $this->apiClient->chat($messages, $maxTokens, $temperature),
  133              $maxAttempts,
  134              $baseDelayMs,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);
--- packages/Webkul/AiAgent/src/Services/VisionService.php (imports)
    3  namespace Webkul\AiAgent\Services;
    5  use Illuminate\Support\Sleep;
    6  use Webkul\AiAgent\DTOs\CredentialConfig;
    7  use Webkul\AiAgent\DTOs\ImageProductContext;
    8  use Webkul\AiAgent\Exceptions\ApiException;
    9  use Webkul\AiAgent\Http\Client\AiApiClient;
   10  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Services/VisionService.php (declarations of apiClient)
   76          protected AiApiClient $apiClient,
  101      public function analyze(string $imageContent, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
  105              $this->apiClient = $apiClient;
  106              $provider = $apiClient->getProvider();


===== EDGE E62d37ae16b =====
{"id": "E62d37ae16b", "from": "packages/Webkul/AiAgent/src/Services/ImageToProductService.php:58", "to_symbol": "VisionService::analyze", "to": "packages/Webkul/AiAgent/src/Services/VisionService.php:101", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:56-60
   56  
   57          // 3 — Vision: analyze the image, get attributes + category
   58          $ctx = $this->visionService->analyze(
   59              imageContent: $this->toBase64DataUri($storedPath, $mimeType),
   60              credentialId: $credentialId,
--- packages/Webkul/AiAgent/src/Services/VisionService.php:99-103
   99       * @throws ApiException When all retry attempts are exhausted
  100       */
  101      public function analyze(string $imageContent, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
  102      {
  103          // Use pre-configured client if provided, otherwise build from credential/config
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php (imports)
    3  namespace Webkul\AiAgent\Services;
    5  use Illuminate\Http\UploadedFile;
    6  use Webkul\AiAgent\DTOs\ImageProductContext;
    7  use Webkul\AiAgent\Exceptions\ApiException;
    8  use Webkul\AiAgent\Http\Client\AiApiClient;
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php (declarations of visionService)
   23          protected VisionService $visionService,
   58          $ctx = $this->visionService->analyze(


===== EDGE E4535ec61ed =====
{"id": "E4535ec61ed", "from": "packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:84", "to_symbol": "VisionService::analyze", "to": "packages/Webkul/AiAgent/src/Services/VisionService.php:101", "kind": "call"}
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:82-86
   82                      ));
   83  
   84                      $ctx = $this->visionService->analyze(
   85                          imageContent: $dataUri,
   86                          credentialId: 0,
--- packages/Webkul/AiAgent/src/Services/VisionService.php:99-103
   99       * @throws ApiException When all retry attempts are exhausted
  100       */
  101      public function analyze(string $imageContent, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
  102      {
  103          // Use pre-configured client if provided, otherwise build from credential/config
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php (imports)
    3  namespace Webkul\AiAgent\Chat\Tools;
    5  use Illuminate\Contracts\JsonSchema\JsonSchema;
    6  use Laravel\Ai\Contracts\Tool;
    7  use Laravel\Ai\Tools\Request;
    8  use Webkul\AiAgent\Chat\ChatContext;
    9  use Webkul\AiAgent\Chat\Concerns\ChecksPermission;
   10  use Webkul\AiAgent\Chat\Contracts\PimTool;
   11  use Webkul\AiAgent\DTOs\CredentialConfig;
   12  use Webkul\AiAgent\Http\Client\AiApiClient;
   13  use Webkul\AiAgent\Services\VisionService;
   14  use Webkul\MagicAI\Enums\AiProvider;
   28              use ChecksPermission;
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php (declarations of visionService)
   19          protected VisionService $visionService,
   24          $visionService = $this->visionService;
   30              public function __construct(ChatContext $context, protected VisionService $visionService)
   84                      $ctx = $this->visionService->analyze(


===== EDGE E3476428be2 =====
{"id": "E3476428be2", "from": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:47", "to_symbol": "WebhookForm::rules", "to": "packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:41", "kind": "framework", "note": "FormRequest type-hint: the container runs rules() before the action"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:45-49
   45       * fields are captured here; the optional ones are filled in on the edit page.
   46       */
   47      public function store(WebhookForm $request): JsonResponse
   48      {
   49          abort_unless(bouncer()->hasPermission('configuration.webhook.create'), 403);
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:39-43
   39       * @return array<string, mixed>
   40       */
   41      public function rules(): array
   42      {
   43          return [
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php (imports)
    3  namespace Webkul\Webhook\Http\Controllers;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Http\Request;
    8  use Illuminate\Support\Facades\Http;
    9  use Illuminate\View\View;
   10  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   11  use Webkul\Webhook\DataGrids\WebhookDataGrid;
   12  use Webkul\Webhook\Http\Requests\WebhookForm;
   13  use Webkul\Webhook\Registry\EventRegistry;
   14  use Webkul\Webhook\Repositories\WebhookRepository;
   15  use Webkul\Webhook\Validators\SafeWebhookUrl;


===== EDGE Eb94c1a2463 =====
{"id": "Eb94c1a2463", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:58", "to_symbol": "Listeners\\Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "call", "note": "Queue::fake: job is pushed, not executed"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:56-60
   56  
   57      app(ProductListener::class)->afterUpdate($product, true);
   58      app(ProductListener::class)->afterBulkEdit([$product->id]);
   59  
   60      Queue::assertNotPushed(SendProductWebhook::class);
--- packages/Webkul/Webhook/src/Listeners/Product.php:82-86
   82       * @param  array<int>  $ids
   83       */
   84      public function afterBulkEdit(array $ids): void
   85      {
   86          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_UPDATED)) {
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php (imports)
    3  use Illuminate\Support\Facades\Queue;
    4  use Webkul\Product\Models\Product;
    5  use Webkul\Webhook\Jobs\SendBulkEditProductWebhook;
    6  use Webkul\Webhook\Jobs\SendProductWebhook;
    7  use Webkul\Webhook\Listeners\Product as ProductListener;
    8  use Webkul\Webhook\Models\Webhook;


===== EDGE E0ab7576a20 =====
{"id": "E0ab7576a20", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1973", "to_symbol": "Product::afterBulkCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:58", "kind": "dispatch", "note": "Event::dispatch('data_transfer.imports.batch.product.created.after')"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1971-1975
 1971  
 1972          if ($createdIds !== []) {
 1973              Event::dispatch('data_transfer.imports.batch.product.created.after', [
 1974                  'product_id' => $createdIds,
 1975              ]);
--- packages/Webkul/Webhook/src/Listeners/Product.php:56-60
   56      }
   57  
   58      public function afterBulkCreate(array $ids): void
   59      {
   60          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_CREATED);
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php (imports)
    3  namespace Webkul\DataTransfer\Helpers\Importers\Product;
    5  use Illuminate\Http\File;
    6  use Illuminate\Http\UploadedFile;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Carbon;
    9  use Illuminate\Support\Facades\Date;
   10  use Illuminate\Support\Facades\DB;
   11  use Illuminate\Support\Facades\Event;
   12  use Illuminate\Support\Facades\Log;
   13  use Illuminate\Support\Facades\Storage;
   14  use Illuminate\Support\Facades\Validator;
   15  use Illuminate\Support\Str;
   16  use Intervention\Image\Encoders\WebpEncoder;
   17  use Intervention\Image\ImageManager;
   18  use Webkul\Attribute\Contracts\Attribute;
   19  use Webkul\Attribute\Models\AttributeFamily;
   20  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   21  use Webkul\Attribute\Repositories\AttributeOptionRepository;
   22  use Webkul\Attribute\Repositories\AttributeRepository;
   23  use Webkul\Category\Repositories\CategoryRepository;
   24  use Webkul\Completeness\Observers\Product as CompletenessProductObserver;
   25  use Webkul\Core\Facades\ElasticSearch;
   26  use Webkul\Core\Filesystem\FileStorer;
   27  use Webkul\Core\Helpers\Database\GrammarQueryManager;
   28  use Webkul\Core\Repositories\ChannelRepository;


===== EDGE Efb81c16738 =====
{"id": "Efb81c16738", "from": "packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php:38", "to_symbol": "AgentService::execute", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:34", "kind": "call", "note": "BatchAgentJob is never dispatched in the tree"}
--- packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php:36-40
   36              try {
   37                  $payload = AgentPayload::fromArray($payloadData);
   38                  $agentService->execute($payload);
   39              } catch (\Throwable $e) {
   40                  Log::error('BatchAgentJob item failed', [
--- packages/Webkul/AiAgent/src/Services/AgentService.php:32-36
   32       * Execute an agent synchronously through the pipeline.
   33       */
   34      public function execute(AgentPayload $payload): AgentResult
   35      {
   36          $startTime = hrtime(true);
--- packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php (imports)
    3  namespace Webkul\AiAgent\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Log;
    8  use Webkul\AiAgent\DTOs\AgentPayload;
    9  use Webkul\AiAgent\Services\AgentService;
   17      use Queueable;
--- packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php (declarations of agentService)
   33      public function handle(AgentService $agentService): void


===== EDGE E65a533b781 =====
{"id": "E65a533b781", "from": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:327", "to_symbol": "PlatformValidator::isSafeApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:143", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:325-329
  325          }
  326  
  327          if (! $this->platformValidator()->isSafeApiUrl(request()->input('api_url'))) {
  328              return new JsonResponse([
  329                  'message' => trans('admin::app.configuration.platform.message.fetch-models-fail'),
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:141-145
  141      }
  142  
  143      public function isSafeApiUrl(?string $apiUrl): bool
  144      {
  145          $apiUrl = trim((string) $apiUrl);
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\MagicAI;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Log;
    7  use Illuminate\Validation\ValidationException;
    8  use Illuminate\View\View;
    9  use Laravel\Ai\AnonymousAgent;
   10  use Webkul\Admin\DataGrids\MagicAI\MagicAIPlatformDataGrid;
   11  use Webkul\Admin\Http\Controllers\Controller;
   12  use Webkul\Admin\Http\Requests\MagicAI\FetchModelsRequest;
   13  use Webkul\Admin\Http\Requests\MagicAI\PlatformRequest;
   14  use Webkul\Admin\Http\Requests\MagicAI\PlatformTestRequest;
   15  use Webkul\AiAgent\Chat\AiErrorResolver;
   16  use Webkul\MagicAI\Enums\AiProvider;
   17  use Webkul\MagicAI\Repository\MagicAIPlatformRepository;
   18  use Webkul\MagicAI\Services\ManagedPlatform;
   19  use Webkul\MagicAI\Services\ModelDiscovery;
   20  use Webkul\MagicAI\Services\ProviderOverrides;
   21  use Webkul\MagicAI\Services\ScopedProviderConfig;
   22  use Webkul\MagicAI\Support\ModelRecommender;
   23  use Webkul\MagicAI\Validator\PlatformValidator;


===== EDGE Edd20c9e233 =====
{"id": "Edd20c9e233", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1344", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "dispatch", "note": "Event::dispatch('catalog.product.update.after')"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1342-1346
 1342  
 1343          if ($product->wasDirtyOnUpdate) {
 1344              Event::dispatch('catalog.product.update.after', $product);
 1345  
 1346              ProductCompletenessJob::dispatch([$id]);
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;


===== EDGE E98c675c045 =====
{"id": "E98c675c045", "from": "packages/Webkul/Product/src/Type/Configurable.php:176", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:174-178
  174                  $variant = $this->createVariant($product, $productSuperAttributes, $variantData, $uniqueAttributes);
  175  
  176                  Event::dispatch('catalog.product.create.after', $variant);
  177              } else {
  178                  if (is_numeric($index = $previousVariantIds->search($variantId))) {
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE Ef3ad29a599 =====
{"id": "Ef3ad29a599", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3139", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in validateVariantUniqueness (3100)"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3137-3141
 3137          $this->cachedVariantValues[$parentProduct->sku][$productData['sku']] = $variantConfigValues;
 3138  
 3139          $isUnique = $this->productRepository->isUniqueVariantForProduct($parentProduct->id, $variantConfigValues, $productData['sku'], $variationId);
 3140  
 3141          if (! $isUnique) {
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php (imports)
    3  namespace Webkul\DataTransfer\Helpers\Importers\Product;
    5  use Illuminate\Http\File;
    6  use Illuminate\Http\UploadedFile;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Carbon;
    9  use Illuminate\Support\Facades\Date;
   10  use Illuminate\Support\Facades\DB;
   11  use Illuminate\Support\Facades\Event;
   12  use Illuminate\Support\Facades\Log;
   13  use Illuminate\Support\Facades\Storage;
   14  use Illuminate\Support\Facades\Validator;
   15  use Illuminate\Support\Str;
   16  use Intervention\Image\Encoders\WebpEncoder;
   17  use Intervention\Image\ImageManager;
   18  use Webkul\Attribute\Contracts\Attribute;
   19  use Webkul\Attribute\Models\AttributeFamily;
   20  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   21  use Webkul\Attribute\Repositories\AttributeOptionRepository;
   22  use Webkul\Attribute\Repositories\AttributeRepository;
   23  use Webkul\Category\Repositories\CategoryRepository;
   24  use Webkul\Completeness\Observers\Product as CompletenessProductObserver;
   25  use Webkul\Core\Facades\ElasticSearch;
   26  use Webkul\Core\Filesystem\FileStorer;
   27  use Webkul\Core\Helpers\Database\GrammarQueryManager;
   28  use Webkul\Core\Repositories\ChannelRepository;
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php (declarations of productRepository)
  344          protected ProductRepository $productRepository,
 2999          $product = $this->productRepository->findOneByField('sku', $sku);
 3139          $isUnique = $this->productRepository->isUniqueVariantForProduct($parentProduct->id, $variantConfigValues, $productData['sku'], $variationId);


===== EDGE E136f018d94 =====
{"id": "E136f018d94", "from": "packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php:62", "to_symbol": "VisionService::analyze", "to": "packages/Webkul/AiAgent/src/Services/VisionService.php:101", "kind": "call", "note": "VisionDetectionStep is not registered in any pipeline in the tree (named only in comments)"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php:60-64
   60          }
   61  
   62          $visionCtx = $this->visionService->analyze(
   63              imageContent: $imageContent,
   64              credentialId: $payload->credentialId,
--- packages/Webkul/AiAgent/src/Services/VisionService.php:99-103
   99       * @throws ApiException When all retry attempts are exhausted
  100       */
  101      public function analyze(string $imageContent, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
  102      {
  103          // Use pre-configured client if provided, otherwise build from credential/config
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php (imports)
    3  namespace Webkul\AiAgent\Pipelines\Stages\Image;
    5  use Webkul\AiAgent\Contracts\PipelineStageContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\ImageProductContext;
    8  use Webkul\AiAgent\Exceptions\ApiException;
    9  use Webkul\AiAgent\Exceptions\PipelineException;
   10  use Webkul\AiAgent\Services\VisionService;
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php (declarations of visionService)
   34          protected VisionService $visionService,
   62          $visionCtx = $this->visionService->analyze(


===== EDGE Eed4c467692 =====
{"id": "Eed4c467692", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:358", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:356-360
  356  
  357                      if ($variant) {
  358                          Event::dispatch('catalog.product.create.after', $variant);
  359                      }
  360                  } else {
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE Ee0f89d8d02 =====
{"id": "Ee0f89d8d02", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:483", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in validateVariantLevelValues (439)"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:481-485
  481  
  482              try {
  483                  $this->productRepository->guardVariantLevelWrite(
  484                      $product,
  485                      $submittedCommon,
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Http\RedirectResponse;
    8  use Illuminate\Http\Request;
    9  use Illuminate\Http\UploadedFile;
   10  use Illuminate\Support\Collection;
   11  use Illuminate\Support\Facades\DB;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\Validation\Validator;
   14  use Illuminate\View\View;
   15  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   16  use Webkul\Admin\Http\Controllers\Controller;
   17  use Webkul\Admin\Http\Requests\BulkEditRequest;
   18  use Webkul\Attribute\Contracts\Attribute;
   19  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   20  use Webkul\Attribute\Repositories\AttributeRepository;
   21  use Webkul\Core\Filesystem\FileStorer;
   22  use Webkul\DataTransfer\Jobs\System\BulkProductUpdate;
   23  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   24  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   25  use Webkul\Product\Contracts\VariantStructurePlanner;
   26  use Webkul\Product\Models\Product;
   27  use Webkul\Product\Repositories\ProductRepository;
   28  use Webkul\Product\Validator\API\UploadMediaValidator;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php (declarations of productRepository)
   52          protected ProductRepository $productRepository,
  123          $products = $this->productRepository
  267              $product = $this->productRepository->findOrFail($requestData['sku']);
  466          $products = $this->productRepository


===== EDGE E23d4a9e55e =====
{"id": "E23d4a9e55e", "from": "packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:92", "to_symbol": "BaseAgent::execute", "to": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:48", "kind": "call", "note": "on TextDescriptionAgent, inherited from BaseAgent"}
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:90-94
   90          $credentialId = (int) request('credentialId');
   91  
   92          $result = $agent->execute(
   93              input: $input,
   94              agentId: $agentId,
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:46-50
   46       * @param  array<string, mixed>  $context  Extra context
   47       */
   48      public function execute(
   49          mixed $input,
   50          int $agentId,
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php (imports)
    3  namespace Webkul\AiAgent\Examples;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Routing\Controller;
    7  use Webkul\AiAgent\Agents\ImageProductAgent;
    8  use Webkul\AiAgent\Agents\ProductCategorizerAgent;
    9  use Webkul\AiAgent\Agents\TextDescriptionAgent;
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php (declarations of agent)
   55              $result = $agent->analyze(
   92          $result = $agent->execute(
  119          $result = $agent->execute(


===== EDGE E5e1c76e908 =====
{"id": "E5e1c76e908", "from": "packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php:51", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call", "note": "called on the double whose execute() override skips httpOptions"}
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php:49-53
   49          ];
   50  
   51          $client->chat([
   52              ['role' => 'system', 'content' => 'You are a PIM assistant.'],
   53              ['role' => 'user', 'content' => 'Hello'],
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php (imports)
    3  use Illuminate\Support\Facades\Log;
    4  use Webkul\AiAgent\DTOs\CredentialConfig;
    5  use Webkul\AiAgent\Http\Client\AiApiClient;
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php (declarations of client)
   28      $client = new AiApiClientCaptureDouble;
   45          $client = makeCachingTestClient('anthropic', 'claude-3-5-sonnet');
   46          $client->fakeResponse = [
   66          $client = makeCachingTestClient('anthropic', 'claude-3-5-sonnet');


===== EDGE E9e3bba2ab7 =====
{"id": "E9e3bba2ab7", "from": "packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:59", "to_symbol": "ImageProductAgent::analyzeAsync", "to": "packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:82", "kind": "call"}
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:57-61
   57  
   58              if ($async) {
   59                  $imageAgent->analyzeAsync(
   60                      imageSource: $imageUrl,
   61                      agentId: $agentId,
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:80-84
   80       * @param  array<string, mixed>  $additionalContext
   81       */
   82      public function analyzeAsync(
   83          string $imageSource,
   84          int $agentId,
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php (imports)
    3  namespace Webkul\AiAgent\Examples;
    5  use Illuminate\Console\Attributes\Description;
    6  use Illuminate\Console\Attributes\Signature;
    7  use Illuminate\Console\Command;
    8  use Webkul\AiAgent\Agents\ImageProductAgent;
    9  use Webkul\AiAgent\Repositories\AgentRepository;
   10  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php (declarations of imageAgent)
   71              $this->withProgressBar(1, function () use ($imageAgent, $imageUrl, $agentId, $credentialId): void {


===== EDGE Ec90411624e =====
{"id": "Ec90411624e", "from": "packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:45", "to_symbol": "WebhookService::sendDataToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:38", "kind": "call"}
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:43-47
   43          match ($this->eventType) {
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),
   46              default   => null,
   47          };
--- packages/Webkul/Webhook/src/Services/WebhookService.php:36-40
   36       * Send a product.updated event to every subscribed webhook.
   37       */
   38      public function sendDataToWebhook(Product $product, array $productChanges = []): ?Response
   39      {
   40          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_UPDATED);
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php (imports)
    3  namespace Webkul\Webhook\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Auth;
    8  use Webkul\Product\Models\ProductProxy;
    9  use Webkul\User\Models\AdminProxy;
   10  use Webkul\Webhook\Services\WebhookService;
   14      use Queueable;
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php (declarations of webhookService)
   31      public function handle(WebhookService $webhookService): void
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),


===== EDGE E2f39d3bcab =====
{"id": "E2f39d3bcab", "from": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "to_symbol": "ProductBulkEditController::handleBulkSave", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:328", "kind": "route", "note": "admin.catalog.products.bulk-edit.save"}
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:326-330
  326       * Handle bulk save of product updates via queued job.
  327       */
  328      public function handleBulkSave(): JsonResponse
  329      {
  330          $data = request()->all();
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\Catalog\AssociationTypeController;
    5  use Webkul\Admin\Http\Controllers\Catalog\AttributeController;
    6  use Webkul\Admin\Http\Controllers\Catalog\AttributeFamilyController;
    7  use Webkul\Admin\Http\Controllers\Catalog\AttributeGroupController;
    8  use Webkul\Admin\Http\Controllers\Catalog\AttributeOptionController;
    9  use Webkul\Admin\Http\Controllers\Catalog\CategoryController;
   10  use Webkul\Admin\Http\Controllers\Catalog\CategoryFieldController;
   11  use Webkul\Admin\Http\Controllers\Catalog\Options\AjaxOptionsController;
   12  use Webkul\Admin\Http\Controllers\Catalog\ProductBulkEditController;
   13  use Webkul\Admin\Http\Controllers\Catalog\ProductController;
   14  use Webkul\Admin\Http\Controllers\Catalog\ProductGridViewController;
   15  use Webkul\Admin\Http\Middleware\EnsureChannelLocaleIsValid;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (route groups / registration)
   20  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   21      Route::prefix('catalog')->group(function () {
   25          Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   44          Route::controller(AttributeOptionController::class)->prefix('attributes/{attribute_id}/options')->group(function () {
   61          Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   80          Route::controller(AttributeFamilyController::class)->prefix('attribute-families')->group(function () {
  107          Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  134          Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
  157          Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
  175          Route::controller(AjaxOptionsController::class)->prefix('ajax-options')->group(function () {
  187          Route::controller(ProductController::class)->prefix('products')->group(function () {
  233          Route::controller(ProductGridViewController::class)->prefix('products/grid-views')->group(function () {


===== EDGE E84f76d3ce8 =====
{"id": "E84f76d3ce8", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1979", "to_symbol": "Product::afterBulkEditFromImport", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:63", "kind": "dispatch", "note": "Event::dispatch('data_transfer.imports.batch.product.updated.after')"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1977-1981
 1977  
 1978          if ($updatedIds !== []) {
 1979              Event::dispatch('data_transfer.imports.batch.product.updated.after', [
 1980                  'product_id' => $updatedIds,
 1981              ]);
--- packages/Webkul/Webhook/src/Listeners/Product.php:61-65
   61      }
   62  
   63      public function afterBulkEditFromImport(array $ids): void
   64      {
   65          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_UPDATED);
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php (imports)
    3  namespace Webkul\DataTransfer\Helpers\Importers\Product;
    5  use Illuminate\Http\File;
    6  use Illuminate\Http\UploadedFile;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Carbon;
    9  use Illuminate\Support\Facades\Date;
   10  use Illuminate\Support\Facades\DB;
   11  use Illuminate\Support\Facades\Event;
   12  use Illuminate\Support\Facades\Log;
   13  use Illuminate\Support\Facades\Storage;
   14  use Illuminate\Support\Facades\Validator;
   15  use Illuminate\Support\Str;
   16  use Intervention\Image\Encoders\WebpEncoder;
   17  use Intervention\Image\ImageManager;
   18  use Webkul\Attribute\Contracts\Attribute;
   19  use Webkul\Attribute\Models\AttributeFamily;
   20  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   21  use Webkul\Attribute\Repositories\AttributeOptionRepository;
   22  use Webkul\Attribute\Repositories\AttributeRepository;
   23  use Webkul\Category\Repositories\CategoryRepository;
   24  use Webkul\Completeness\Observers\Product as CompletenessProductObserver;
   25  use Webkul\Core\Facades\ElasticSearch;
   26  use Webkul\Core\Filesystem\FileStorer;
   27  use Webkul\Core\Helpers\Database\GrammarQueryManager;
   28  use Webkul\Core\Repositories\ChannelRepository;


===== EDGE Ec73b49c028 =====
{"id": "Ec73b49c028", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:589", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in validateVariantConfiguration (578)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:587-591
  587  
  588          if (! empty($configurableValues) && $parentProduct) {
  589              $isUnique = $this->productRepository->isUniqueVariantForProduct(
  590                  productId: $parentProduct->id,
  591                  configAttributes: $configurableValues,
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (declarations of productRepository)
   35          protected ProductRepository $productRepository,
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  309              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {


===== EDGE Ec5dee504a3 =====
{"id": "Ec5dee504a3", "from": "packages/Webkul/Product/tests/Feature/ProductAssociationDualWriteTest.php:21", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Feature/ProductAssociationDualWriteTest.php:19-23
   19      $related = Product::factory()->create();
   20  
   21      $updated = $this->productRepository->update([
   22          'sku'              => $source->sku,
   23          'up_sells'         => [$upSellA->sku, $upSellB->sku],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Feature/ProductAssociationDualWriteTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\DB;
    5  use Webkul\Product\Models\Product;
    6  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Feature/ProductAssociationDualWriteTest.php (declarations of productRepository)
   11      $this->productRepository = app(ProductRepository::class);
   21      $updated = $this->productRepository->update([
   50      $reUpdated = $this->productRepository->update([


===== EDGE E20706a5196 =====
{"id": "E20706a5196", "from": "packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:124", "to_symbol": "Product::afterBulkCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:58", "kind": "call", "note": "Queue::fake()"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:122-126
  122      subscribeWebhook([WebhookService::EVENT_PRODUCT_CREATED, WebhookService::EVENT_PRODUCT_UPDATED]);
  123  
  124      app(ProductListener::class)->afterBulkCreate([1, 2]);
  125  
  126      Queue::assertPushed(SendBulkProductWebhook::class, 1);
--- packages/Webkul/Webhook/src/Listeners/Product.php:56-60
   56      }
   57  
   58      public function afterBulkCreate(array $ids): void
   59      {
   60          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_CREATED);
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php (imports)
    3  use Illuminate\Support\Facades\Event;
    4  use Illuminate\Support\Facades\Queue;
    5  use Webkul\Webhook\Jobs\SendBulkProductWebhook;
    6  use Webkul\Webhook\Listeners\Product as ProductListener;
    7  use Webkul\Webhook\Models\Webhook;
    8  use Webkul\Webhook\Services\WebhookService;


===== EDGE Ec3e4237e22 =====
{"id": "Ec3e4237e22", "from": "packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:74", "to_symbol": "AgentServiceContract::execute", "to": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:16", "kind": "call"}
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:72-76
   72          );
   73  
   74          return $this->agentService->execute($payload);
   75      }
   76  
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:14-18
   14       * Execute an agent with the given payload.
   15       */
   16      public function execute(AgentPayload $payload): AgentResult;
   17  
   18      /**
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php (imports)
    3  namespace Webkul\AiAgent\Agents;
    5  use Webkul\AiAgent\Contracts\AgentServiceContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\AgentResult;
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php (declarations of agentService)
   43          protected AgentServiceContract $agentService,


===== EDGE Eb88d1d2510 =====
{"id": "Eb88d1d2510", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:186", "to_symbol": "ProductController::patchProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:261", "kind": "call", "note": "in partialUpdate (168)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:184-188
  184              Event::dispatch('catalog.product.update.before', $product->id);
  185  
  186              $this->patchProduct($product, $data);
  187  
  188              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:259-263
  259       * Partial Updates the simple product.
  260       */
  261      public function patchProduct(Product $product, array $data): Product
  262      {
  263          $submittedCommon = $data['values']['common'] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE E2bf54dbb09 =====
{"id": "E2bf54dbb09", "from": "packages/Webkul/Product/src/Type/Configurable.php:176", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:174-178
  174                  $variant = $this->createVariant($product, $productSuperAttributes, $variantData, $uniqueAttributes);
  175  
  176                  Event::dispatch('catalog.product.create.after', $variant);
  177              } else {
  178                  if (is_numeric($index = $previousVariantIds->search($variantId))) {
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE E13b3f9cfb6 =====
{"id": "E13b3f9cfb6", "from": "packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:111", "to_symbol": "EnrichmentService::enrich", "to": "packages/Webkul/AiAgent/src/Services/EnrichmentService.php:44", "kind": "call"}
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:109-113
  109              );
  110  
  111              $enriched = $enrichmentService->enrich(
  112                  ctx: $ctx,
  113                  credentialId: 0,
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:42-46
   42       * @throws ApiException
   43       */
   44      public function enrich(ImageProductContext $ctx, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
   45      {
   46          // Check completeness against locale-specific data only.  Merging with
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php (imports)
    3  namespace Webkul\AiAgent\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Cache;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Log;
   10  use Webkul\AiAgent\DTOs\CredentialConfig;
   11  use Webkul\AiAgent\DTOs\ImageProductContext;
   12  use Webkul\AiAgent\Http\Client\AiApiClient;
   13  use Webkul\AiAgent\Services\EnrichmentService;
   14  use Webkul\MagicAI\Enums\AiProvider;
   15  use Webkul\MagicAI\Repository\MagicAIPlatformRepository;
   16  use Webkul\Product\Repositories\ProductRepository;
   26      use Queueable;
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php (declarations of enrichmentService)
  111              $enriched = $enrichmentService->enrich(


===== EDGE E42a20f4872 =====
{"id": "E42a20f4872", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:284", "to_symbol": "ProductController::updateProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:126", "kind": "call", "note": "in update (255)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:282-286
  282              Event::dispatch('catalog.product.update.before', $id);
  283  
  284              $this->updateProduct($data, $product);
  285  
  286              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:124-128
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE Ea442dc4a4f =====
{"id": "Ea442dc4a4f", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:309", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in patchProduct (261)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:307-311
  307              $result = $product;
  308  
  309              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  310                  $result = $persist();
  311              });
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (declarations of productRepository)
   35          protected ProductRepository $productRepository,
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  309              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {


===== EDGE Ea283187d2f =====
{"id": "Ea283187d2f", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:199", "to_symbol": "route admin.api.configurable_products.patch", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:154", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:197-201
  197      [$family, $structure, $color, $brand, $size, $configurable] = vsrTwoAxisTree('vsr10');
  198  
  199      $this->withHeaders($this->headers)->json('PATCH', route('admin.api.configurable_products.patch', $configurable->sku), [
  200          'variant_structure' => $structure->code,
  201          'values'            => ['common' => ['sku' => $configurable->sku]],
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:152-156
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
  154              Route::patch('{code}', 'partialUpdate')->name('admin.api.'.$nameSuffix.'.patch');
  155          });
  156      }
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Models\Product;
    8  use Webkul\Product\Models\VariantStructure;
    9  use Webkul\Product\Models\VariantStructureAxis;
   10  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE Eb56d3b5433 =====
{"id": "Eb56d3b5433", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:34", "to_symbol": "CollectsPlatform::collectAndSave", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:38", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:32-36
   32          $platform = $this->choosePlatform();
   33  
   34          return $platform instanceof MagicAIPlatform ? $this->collectAndSave($platform) : self::FAILURE;
   35      }
   36  }
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:36-40
   36       * Collect the platform, confirm it interactively and save it.
   37       */
   38      protected function collectAndSave(?MagicAIPlatform $platform): int
   39      {
   40          $data = $this->input->isInteractive()
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php (imports)
    3  namespace Webkul\MagicAI\Console\Commands\Platform;
    5  use Illuminate\Console\Attributes\Description;
    6  use Illuminate\Console\Attributes\Signature;
    7  use Webkul\MagicAI\Console\Commands\Platform\Concerns\ChoosesPlatform;
    8  use Webkul\MagicAI\Console\Commands\Platform\Concerns\CollectsPlatform;
    9  use Webkul\MagicAI\Models\MagicAIPlatform;
   28      use ChoosesPlatform, CollectsPlatform;


===== EDGE E0acb17b471 =====
{"id": "E0acb17b471", "from": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "to_symbol": "ProductController::update", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1269", "kind": "route", "note": "admin.catalog.products.update"}
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1267-1271
 1267      }
 1268  
 1269      public function update(ProductForm $request, int $id): RedirectResponse|JsonResponse
 1270      {
 1271          Event::dispatch('catalog.product.update.before', $id);
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\Catalog\AssociationTypeController;
    5  use Webkul\Admin\Http\Controllers\Catalog\AttributeController;
    6  use Webkul\Admin\Http\Controllers\Catalog\AttributeFamilyController;
    7  use Webkul\Admin\Http\Controllers\Catalog\AttributeGroupController;
    8  use Webkul\Admin\Http\Controllers\Catalog\AttributeOptionController;
    9  use Webkul\Admin\Http\Controllers\Catalog\CategoryController;
   10  use Webkul\Admin\Http\Controllers\Catalog\CategoryFieldController;
   11  use Webkul\Admin\Http\Controllers\Catalog\Options\AjaxOptionsController;
   12  use Webkul\Admin\Http\Controllers\Catalog\ProductBulkEditController;
   13  use Webkul\Admin\Http\Controllers\Catalog\ProductController;
   14  use Webkul\Admin\Http\Controllers\Catalog\ProductGridViewController;
   15  use Webkul\Admin\Http\Middleware\EnsureChannelLocaleIsValid;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (route groups / registration)
   20  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   21      Route::prefix('catalog')->group(function () {
   25          Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   44          Route::controller(AttributeOptionController::class)->prefix('attributes/{attribute_id}/options')->group(function () {
   61          Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   80          Route::controller(AttributeFamilyController::class)->prefix('attribute-families')->group(function () {
  107          Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  134          Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
  157          Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
  175          Route::controller(AjaxOptionsController::class)->prefix('ajax-options')->group(function () {
  187          Route::controller(ProductController::class)->prefix('products')->group(function () {
  233          Route::controller(ProductGridViewController::class)->prefix('products/grid-views')->group(function () {


===== EDGE E19721b1d2f =====
{"id": "E19721b1d2f", "from": "packages/Webkul/AiAgent/src/Services/EnrichmentService.php:82", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:80-84
   80          $messages = $this->buildMessages($existing, array_values($missing), $locale, $instruction, $ctx, $common);
   81  
   82          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
   83          $generated = $this->parseResponse($response['content'] ?? '');
   84  
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php (imports)
    3  namespace Webkul\AiAgent\Services;
    5  use Webkul\AiAgent\DTOs\CredentialConfig;
    6  use Webkul\AiAgent\DTOs\ImageProductContext;
    7  use Webkul\AiAgent\Exceptions\ApiException;
    8  use Webkul\AiAgent\Http\Client\AiApiClient;
    9  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php (declarations of apiClient)
   33          protected AiApiClient $apiClient,
   44      public function enrich(ImageProductContext $ctx, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
   63              $this->apiClient = $apiClient;
   82          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);


===== EDGE E52f14f3f09 =====
{"id": "E52f14f3f09", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:298", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "dispatch", "note": "Event::dispatch('catalog.product.update.after'); passes isBulkEdit=true so the listener returns early"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:296-300
  296              $product->save();
  297  
  298              Event::dispatch('catalog.product.update.after', [$product, true]);
  299          };
  300  
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php (imports)
    3  namespace Webkul\DataTransfer\Jobs\System;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Collection;
    9  use Illuminate\Support\Facades\Auth;
   10  use Illuminate\Support\Facades\Event;
   11  use Illuminate\Support\Facades\Storage;
   12  use Illuminate\Validation\ValidationException;
   13  use Webkul\Attribute\Contracts\Attribute;
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Attribute\Services\AttributeService;
   16  use Webkul\DataTransfer\Helpers\AbstractJob;
   17  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   18  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   19  use Webkul\DataTransfer\Services\JobLogger;
   20  use Webkul\Product\Contracts\VariantStructurePlanner;
   21  use Webkul\Product\Models\Product;
   22  use Webkul\Product\Repositories\ProductRepository;
   23  use Webkul\Product\Validator\ProductValuesValidator;
   24  use Webkul\User\Models\AdminProxy;
   28      use Queueable;


===== EDGE E348523bda0 =====
{"id": "E348523bda0", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:49", "to_symbol": "WebhookService::getProductChangesForWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:366", "kind": "call", "note": "in afterCreate (43)"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:47-51
   47          }
   48  
   49          $changes = $this->webhookService->getProductChangesForWebhook($product);
   50  
   51          if ($changes === []) {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:364-368
  364       * and fall back to the newest audit by id, still bounded by product freshness.
  365       */
  366      public function getProductChangesForWebhook(Product $product): array
  367      {
  368          $latestChanges = $this->recentProductAudits->for($product->getKey())
--- packages/Webkul/Webhook/src/Listeners/Product.php (imports)
    3  namespace Webkul\Webhook\Listeners;
    5  use Webkul\Webhook\Jobs\SendBulkEditProductWebhook;
    6  use Webkul\Webhook\Jobs\SendBulkProductWebhook;
    7  use Webkul\Webhook\Jobs\SendProductWebhook;
    8  use Webkul\Webhook\Repositories\WebhookRepository;
    9  use Webkul\Webhook\Services\WebhookService;
--- packages/Webkul/Webhook/src/Listeners/Product.php (declarations of webhookService)
   18          protected WebhookService $webhookService
   34          $changes = $this->webhookService->getProductChangesForWebhook($product);
   49          $changes = $this->webhookService->getProductChangesForWebhook($product);


===== EDGE E9b5e1b2036 =====
{"id": "E9b5e1b2036", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:159", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:157-161
  157              Event::dispatch('catalog.product.create.before');
  158              $product = $this->productRepository->create($data);
  159              Event::dispatch('catalog.product.create.after', $product);
  160  
  161              $product = $this->updateProduct($data, $product);
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE E071ac195e8 =====
{"id": "E071ac195e8", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:154", "to_symbol": "ProductController::updateProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:126", "kind": "call", "note": "in update (129)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:152-156
  152              Event::dispatch('catalog.product.update.before', $id);
  153  
  154              $this->updateProduct($data, $product);
  155  
  156              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:124-128
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE E34dc870f35 =====
{"id": "E34dc870f35", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php:23", "to_symbol": "Listeners\\Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "call", "note": "Queue::fake: job is pushed, not executed"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php:21-25
   21      ]);
   22  
   23      app(ProductListener::class)->afterBulkEdit([1, 2, 3]);
   24  
   25      Queue::assertPushed(SendBulkEditProductWebhook::class);
--- packages/Webkul/Webhook/src/Listeners/Product.php:82-86
   82       * @param  array<int>  $ids
   83       */
   84      public function afterBulkEdit(array $ids): void
   85      {
   86          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_UPDATED)) {
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php (imports)
    3  use Illuminate\Support\Facades\Queue;
    4  use Webkul\Webhook\Jobs\SendBulkEditProductWebhook;
    5  use Webkul\Webhook\Listeners\Product as ProductListener;
    6  use Webkul\Webhook\Models\Webhook;


===== EDGE E2cdf690be7 =====
{"id": "E2cdf690be7", "from": "packages/Webkul/Admin/src/Routes/catalog-routes.php:202", "to_symbol": "ProductController::createVariantNode", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:242", "kind": "route"}
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:200-204
  200              Route::post('copy/{id}', 'copy')->name('admin.catalog.products.copy');
  201  
  202              Route::post('{configurableId}/variant-node', 'createVariantNode')->name('admin.catalog.products.variant_node.create');
  203  
  204              Route::get('{configurableId}/variant-children', 'variantChildren')->name('admin.catalog.products.variant_children');
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:240-244
  240       * generation read the parent's children, so both run under its row lock.
  241       */
  242      public function createVariantNode(VariantNodeForm $request, int $configurableId): JsonResponse
  243      {
  244          $configurable = $this->productRepository->findOrFail($configurableId);
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\Catalog\AssociationTypeController;
    5  use Webkul\Admin\Http\Controllers\Catalog\AttributeController;
    6  use Webkul\Admin\Http\Controllers\Catalog\AttributeFamilyController;
    7  use Webkul\Admin\Http\Controllers\Catalog\AttributeGroupController;
    8  use Webkul\Admin\Http\Controllers\Catalog\AttributeOptionController;
    9  use Webkul\Admin\Http\Controllers\Catalog\CategoryController;
   10  use Webkul\Admin\Http\Controllers\Catalog\CategoryFieldController;
   11  use Webkul\Admin\Http\Controllers\Catalog\Options\AjaxOptionsController;
   12  use Webkul\Admin\Http\Controllers\Catalog\ProductBulkEditController;
   13  use Webkul\Admin\Http\Controllers\Catalog\ProductController;
   14  use Webkul\Admin\Http\Controllers\Catalog\ProductGridViewController;
   15  use Webkul\Admin\Http\Middleware\EnsureChannelLocaleIsValid;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/catalog-routes.php (route groups / registration)
   20  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   21      Route::prefix('catalog')->group(function () {
   25          Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   44          Route::controller(AttributeOptionController::class)->prefix('attributes/{attribute_id}/options')->group(function () {
   61          Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   80          Route::controller(AttributeFamilyController::class)->prefix('attribute-families')->group(function () {
  107          Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  134          Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
  157          Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
  175          Route::controller(AjaxOptionsController::class)->prefix('ajax-options')->group(function () {
  187          Route::controller(ProductController::class)->prefix('products')->group(function () {
  233          Route::controller(ProductGridViewController::class)->prefix('products/grid-views')->group(function () {


===== EDGE Ef2b4d55a80 =====
{"id": "Ef2b4d55a80", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:358", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:356-360
  356  
  357                      if ($variant) {
  358                          Event::dispatch('catalog.product.create.after', $variant);
  359                      }
  360                  } else {
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE Ede65ca3f38 =====
{"id": "Ede65ca3f38", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:495", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:493-497
  493              $variant = $configurable->getTypeInstance()->createVariant($configurable, $axisAttributes, $variantData);
  494  
  495              Event::dispatch('catalog.product.create.after', $variant);
  496  
  497              return $variant;
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE Ed865f185b6 =====
{"id": "Ed865f185b6", "from": "packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:53", "to_symbol": "AgentService::execute", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:34", "kind": "call"}
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:51-55
   51          $payload = AgentPayload::fromArray($this->payloadData);
   52  
   53          $agentService->execute($payload);
   54      }
   55  
--- packages/Webkul/AiAgent/src/Services/AgentService.php:32-36
   32       * Execute an agent synchronously through the pipeline.
   33       */
   34      public function execute(AgentPayload $payload): AgentResult
   35      {
   36          $startTime = hrtime(true);
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php (imports)
    3  namespace Webkul\AiAgent\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Webkul\AiAgent\DTOs\AgentPayload;
    8  use Webkul\AiAgent\Repositories\AgentExecutionRepository;
    9  use Webkul\AiAgent\Services\AgentService;
   16      use Queueable;
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php (declarations of agentService)
   49      public function handle(AgentService $agentService): void


===== EDGE E686ceffbd8 =====
{"id": "E686ceffbd8", "from": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:66", "to_symbol": "PlatformValidator::validateApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:136", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:64-68
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:134-138
  134       * @throws ValidationException
  135       */
  136      public function validateApiUrl(?string $provider, ?string $apiUrl): void
  137      {
  138          if ($error = $this->apiUrlError($provider, $apiUrl)) {
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\MagicAI;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Log;
    7  use Illuminate\Validation\ValidationException;
    8  use Illuminate\View\View;
    9  use Laravel\Ai\AnonymousAgent;
   10  use Webkul\Admin\DataGrids\MagicAI\MagicAIPlatformDataGrid;
   11  use Webkul\Admin\Http\Controllers\Controller;
   12  use Webkul\Admin\Http\Requests\MagicAI\FetchModelsRequest;
   13  use Webkul\Admin\Http\Requests\MagicAI\PlatformRequest;
   14  use Webkul\Admin\Http\Requests\MagicAI\PlatformTestRequest;
   15  use Webkul\AiAgent\Chat\AiErrorResolver;
   16  use Webkul\MagicAI\Enums\AiProvider;
   17  use Webkul\MagicAI\Repository\MagicAIPlatformRepository;
   18  use Webkul\MagicAI\Services\ManagedPlatform;
   19  use Webkul\MagicAI\Services\ModelDiscovery;
   20  use Webkul\MagicAI\Services\ProviderOverrides;
   21  use Webkul\MagicAI\Services\ScopedProviderConfig;
   22  use Webkul\MagicAI\Support\ModelRecommender;
   23  use Webkul\MagicAI\Validator\PlatformValidator;


===== EDGE Eda38985288 =====
{"id": "Eda38985288", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:34", "to_symbol": "WebhookService::getProductChangesForWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:366", "kind": "call", "note": "in afterUpdate (24)"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:32-36
   32          }
   33  
   34          $changes = $this->webhookService->getProductChangesForWebhook($product);
   35  
   36          if ($changes === []) {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:364-368
  364       * and fall back to the newest audit by id, still bounded by product freshness.
  365       */
  366      public function getProductChangesForWebhook(Product $product): array
  367      {
  368          $latestChanges = $this->recentProductAudits->for($product->getKey())
--- packages/Webkul/Webhook/src/Listeners/Product.php (imports)
    3  namespace Webkul\Webhook\Listeners;
    5  use Webkul\Webhook\Jobs\SendBulkEditProductWebhook;
    6  use Webkul\Webhook\Jobs\SendBulkProductWebhook;
    7  use Webkul\Webhook\Jobs\SendProductWebhook;
    8  use Webkul\Webhook\Repositories\WebhookRepository;
    9  use Webkul\Webhook\Services\WebhookService;
--- packages/Webkul/Webhook/src/Listeners/Product.php (declarations of webhookService)
   18          protected WebhookService $webhookService
   34          $changes = $this->webhookService->getProductChangesForWebhook($product);
   49          $changes = $this->webhookService->getProductChangesForWebhook($product);


===== EDGE E3ec7ab8be4 =====
{"id": "E3ec7ab8be4", "from": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:80", "to_symbol": "WebhookForm::rules", "to": "packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:41", "kind": "framework", "note": "FormRequest type-hint"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:78-82
   78       * Update the specified webhook.
   79       */
   80      public function update(WebhookForm $request, int $id): RedirectResponse
   81      {
   82          abort_unless(bouncer()->hasPermission('configuration.webhook.edit'), 403);
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:39-43
   39       * @return array<string, mixed>
   40       */
   41      public function rules(): array
   42      {
   43          return [
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php (imports)
    3  namespace Webkul\Webhook\Http\Controllers;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Http\Request;
    8  use Illuminate\Support\Facades\Http;
    9  use Illuminate\View\View;
   10  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   11  use Webkul\Webhook\DataGrids\WebhookDataGrid;
   12  use Webkul\Webhook\Http\Requests\WebhookForm;
   13  use Webkul\Webhook\Registry\EventRegistry;
   14  use Webkul\Webhook\Repositories\WebhookRepository;
   15  use Webkul\Webhook\Validators\SafeWebhookUrl;


===== EDGE E357d4c148e =====
{"id": "E357d4c148e", "from": "packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:58", "to_symbol": "BaseAgent::execute", "to": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:48", "kind": "call"}
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:56-60
   56          array $context = [],
   57      ): AgentResult {
   58          return $this->execute(
   59              input: [
   60                  'productCount' => count($products),
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:46-50
   46       * @param  array<string, mixed>  $context  Extra context
   47       */
   48      public function execute(
   49          mixed $input,
   50          int $agentId,
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php (imports)
    3  namespace Webkul\AiAgent\Agents;
    5  use Webkul\AiAgent\DTOs\AgentResult;


===== EDGE Ee169798be1 =====
{"id": "Ee169798be1", "from": "packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:39", "to_symbol": "AgentService::execute", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:34", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:37-41
   37          }
   38  
   39          $result = $this->agentService->execute($payload);
   40  
   41          return new JsonResponse($result->toArray());
--- packages/Webkul/AiAgent/src/Services/AgentService.php:32-36
   32       * Execute an agent synchronously through the pipeline.
   33       */
   34      public function execute(AgentPayload $payload): AgentResult
   35      {
   36          $startTime = hrtime(true);
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php (imports)
    3  namespace Webkul\AiAgent\Http\Controllers;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Routing\Controller;
    7  use Webkul\AiAgent\DTOs\AgentPayload;
    8  use Webkul\AiAgent\Http\Requests\ExecuteAgentForm;
    9  use Webkul\AiAgent\Services\AgentService;
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php (declarations of agentService)
   14          protected AgentService $agentService,
   39          $result = $this->agentService->execute($payload);


===== EDGE E4cefb08553 =====
{"id": "E4cefb08553", "from": "packages/Webkul/Product/src/Type/Configurable.php:229", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:227-231
  227                  $planner->primeStructure($group->id, $loadedStructure);
  228  
  229                  Event::dispatch('catalog.product.create.after', $group);
  230              } else {
  231                  if (! $group = $existingGroups->pull($groupKey)) {
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE Eeb14d54795 =====
{"id": "Eeb14d54795", "from": "packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:105", "to_symbol": "WebhookService::sendCreatedToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:46", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:103-107
  103      Http::fake();
  104  
  105      $service->sendCreatedToWebhook($product);
  106  
  107      Http::assertSent(function ($request) use ($product) {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:44-48
   44       * Send a product.created event to every subscribed webhook.
   45       */
   46      public function sendCreatedToWebhook(Product $product, array $productChanges = []): ?Response
   47      {
   48          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_CREATED);
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php (imports)
    3  use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
    4  use Illuminate\Support\Facades\Bus;
    5  use Illuminate\Support\Facades\DB;
    6  use Illuminate\Support\Facades\Http;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Webhook\Jobs\SendProductWebhook;
   10  use Webkul\Webhook\Services\WebhookService;
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php (declarations of service)
   96  it('produces a product.created payload via the webhook service for a created product', function () {
  101      $service = app(WebhookService::class);


===== EDGE Eb24b1d8414 =====
{"id": "Eb24b1d8414", "from": "packages/Webkul/Product/src/Type/Configurable.php:250", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Product/src/Type/Configurable.php:248-252
  248                      $planner->primeStructure($variant->id, $loadedStructure);
  249  
  250                      Event::dispatch('catalog.product.create.after', $variant);
  251                  } else {
  252                      if (is_numeric($index = $previousGroupVariantIds->search($variantId))) {
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE Ebb5a2f4438 =====
{"id": "Ebb5a2f4438", "from": "packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:109", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call"}
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:107-111
  107      ]);
  108  
  109      expect(fn () => $repository->guardVariantLevelWrite($configurable->fresh(), [$color->code => 'red']))
  110          ->toThrow(ValidationException::class);
  111  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Validation\ValidationException;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAxis;
   11  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php (declarations of configurable)
   32      $configurable = $repository->create([
   39      $simple = Product::factory()->create(['parent_id' => $configurable->id, 'type' => ProductType::Simple->value, 'sku' => 'ag-simple']);
   65      $configurable = $repository->create([
   72      $simple = Product::factory()->create(['parent_id' => $configurable->id, 'type' => ProductType::Simple->value, 'sku' => 'ag2-simple']);
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php (declarations of repository)
   30      $repository = app(ProductRepository::class);
   32      $configurable = $repository->create([
   43      expect(fn () => $repository->update([
   63      $repository = app(ProductRepository::class);


===== EDGE E304ce6ab06 =====
{"id": "E304ce6ab06", "from": "packages/Webkul/Admin/src/Routes/rest-routes.php:114", "to_symbol": "MagicAIPlatformController::testConnection", "to": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:214", "kind": "route"}
--- packages/Webkul/Admin/src/Routes/rest-routes.php:112-116
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:212-216
  212      }
  213  
  214      public function testConnection(PlatformTestRequest $request): JsonResponse
  215      {
  216          if (! bouncer()->hasPermission('ai-agent.platform')) {
--- packages/Webkul/Admin/src/Routes/rest-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\DashboardController;
    5  use Webkul\Admin\Http\Controllers\DataGridController;
    6  use Webkul\Admin\Http\Controllers\HelpController;
    7  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIController;
    8  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIPlatformController;
    9  use Webkul\Admin\Http\Controllers\MagicAI\MagicAISystemPromptController;
   10  use Webkul\Admin\Http\Controllers\ManageColumnController;
   11  use Webkul\Admin\Http\Controllers\MediaController;
   12  use Webkul\Admin\Http\Controllers\TinyMCEController;
   13  use Webkul\Admin\Http\Controllers\User\AccountController;
   14  use Webkul\Admin\Http\Controllers\User\AclVersionController;
   15  use Webkul\Admin\Http\Controllers\User\SessionController;
   16  use Webkul\Admin\Http\Controllers\VueJsSelect\SelectOptionsController;
   17  use Webkul\HistoryControl\Http\Controllers\HistoryController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/rest-routes.php (route groups / registration)
   22  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   33      Route::controller(DashboardController::class)->prefix('dashboard')->group(function () {
   42      Route::controller(HelpController::class)->prefix('help')->group(function () {
   68      Route::controller(MagicAIController::class)->prefix('magic-ai')->group(function () {
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  125      Route::controller(MagicAISystemPromptController::class)->prefix('magic-ai/system-prompts')->group(function () {
  141      Route::controller(AccountController::class)->prefix('account')->group(function () {
  150      Route::controller(HistoryController::class)->prefix('history')->group(function () {


===== EDGE Ee48c3a954c =====
{"id": "Ee48c3a954c", "from": "packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:138", "to_symbol": "CredentialForm::rules", "to": "packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:27", "kind": "framework", "note": "FormRequest type-hint; controller is unrouted"}
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:136-140
  136       * Test connectivity with the AI provider.
  137       */
  138      public function testConnection(CredentialForm $request): JsonResponse
  139      {
  140          $data = $this->resolveApiKey($request->validated(), $request->integer('id') ?: null);
--- packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:25-29
   25       * @return array<string, mixed>
   26       */
   27      public function rules(): array
   28      {
   29          return [
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php (imports)
    3  namespace Webkul\AiAgent\Http\Controllers;
    5  use Illuminate\Contracts\View\Factory;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Routing\Controller;
    8  use Illuminate\View\View;
    9  use Webkul\AiAgent\DataGrids\Credential\CredentialDataGrid;
   10  use Webkul\AiAgent\DTOs\CredentialConfig;
   11  use Webkul\AiAgent\Http\Client\AiApiClient;
   12  use Webkul\AiAgent\Http\Requests\CredentialForm;
   13  use Webkul\AiAgent\Repositories\CredentialRepository;


===== EDGE E883ea94d8b =====
{"id": "E883ea94d8b", "from": "packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:30", "to_symbol": "Product::afterBulkCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:58", "kind": "dispatch", "note": "Queue::fake(): job pushed, not run"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:28-32
   28      subscribeWebhook([WebhookService::EVENT_PRODUCT_CREATED]);
   29  
   30      Event::dispatch('data_transfer.imports.batch.product.created.after', ['product_id' => [1, 2]]);
   31  
   32      Queue::assertPushed(SendBulkProductWebhook::class, 1);
--- packages/Webkul/Webhook/src/Listeners/Product.php:56-60
   56      }
   57  
   58      public function afterBulkCreate(array $ids): void
   59      {
   60          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_CREATED);
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php (imports)
    3  use Illuminate\Support\Facades\Event;
    4  use Illuminate\Support\Facades\Queue;
    5  use Webkul\Webhook\Jobs\SendBulkProductWebhook;
    6  use Webkul\Webhook\Listeners\Product as ProductListener;
    7  use Webkul\Webhook\Models\Webhook;
    8  use Webkul\Webhook\Services\WebhookService;


===== EDGE E39096fffa7 =====
{"id": "E39096fffa7", "from": "packages/Webkul/Product/src/Repositories/ProductRepository.php:150", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "dispatch", "note": "Event::dispatch('catalog.product.update.after')"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:148-152
  148                  $product = $this->updateStatus($status, $productId);
  149  
  150                  Event::dispatch('catalog.product.update.after', $product);
  151              }
  152          }), ['catalog.product.update.after']);
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/Product/src/Repositories/ProductRepository.php (imports)
    3  namespace Webkul\Product\Repositories;
    5  use Illuminate\Container\Container;
    6  use Illuminate\Database\Eloquent\ModelNotFoundException;
    7  use Illuminate\Support\Collection;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;


===== EDGE E8c06ce62fb =====
{"id": "E8c06ce62fb", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:40", "to_symbol": "Listeners\\Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:38-42
   38      $product->update(['sku' => $product->sku.'-changed']);
   39  
   40      app(ProductListener::class)->afterUpdate($product);
   41  
   42      Queue::assertPushed(SendProductWebhook::class);
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php (imports)
    3  use Illuminate\Support\Facades\Queue;
    4  use Webkul\Product\Models\Product;
    5  use Webkul\Webhook\Jobs\SendBulkEditProductWebhook;
    6  use Webkul\Webhook\Jobs\SendProductWebhook;
    7  use Webkul\Webhook\Listeners\Product as ProductListener;
    8  use Webkul\Webhook\Models\Webhook;


===== EDGE E0b06fed131 =====
{"id": "E0b06fed131", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:244", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:242-246
  242          }
  243  
  244          Event::dispatch('catalog.product.create.after', $node);
  245  
  246          return $this->successResponse(
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE E25fe8f3693 =====
{"id": "E25fe8f3693", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:342", "to_symbol": "PlatformValidator::validate", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:48", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:340-344
  340  
  341          try {
  342              $payload = $this->platformValidator->validate($payload);
  343          } catch (ValidationException $e) {
  344              foreach ($e->validator->errors()->all() as $message) {
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:46-50
   46       * @throws ValidationException
   47       */
   48      public function validate(array $data): array
   49      {
   50          Validator::make($data, $this->rules())->validate();
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php (imports)
    3  namespace Webkul\MagicAI\Console\Commands\Platform\Concerns;
    5  use Illuminate\Support\Facades\DB;
    6  use Illuminate\Support\Facades\Validator;
    7  use Illuminate\Validation\ValidationException;
    8  use Webkul\MagicAI\Console\Support\StdinReader;
    9  use Webkul\MagicAI\Enums\AiProvider;
   10  use Webkul\MagicAI\Models\MagicAIPlatform;
   11  use Webkul\MagicAI\Services\ModelDiscovery;
   12  use Webkul\MagicAI\Support\ModelRecommender;
   14  use function Laravel\Prompts\confirm;
   15  use function Laravel\Prompts\error;
   16  use function Laravel\Prompts\info;
   17  use function Laravel\Prompts\multiselect;
   18  use function Laravel\Prompts\password;
   19  use function Laravel\Prompts\select;
   20  use function Laravel\Prompts\spin;
   21  use function Laravel\Prompts\table;
   22  use function Laravel\Prompts\text;
   23  use function Laravel\Prompts\warning;
   77              required: true,
   91              required: ! $platform?->safeApiKey(),
   99                  required: true,
  104                  required: true,
  160                  required: true,
  170              required: trans('admin::app.configuration.platform.command.models-required'),
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php (declarations of platformValidator)
  123              validate: fn (bool $enabled): ?string => $this->platformValidator->defaultStatusError($isDefault, $enabled),
  161                  validate: fn (string $value): ?string => $this->platformValidator->modelNamesError($value),
  175              validate: fn (string $value): ?string => trim($value) === '' ? null : $this->platformValidator->modelNamesError($value),
  180              ...($additional === '' ? [] : $this->platformValidator->splitModels($additional)),


===== EDGE E8498f718f0 =====
{"id": "E8498f718f0", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1585", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "in checkVariantUniqueness (1581)"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1583-1587
 1583          $data = $request->validated();
 1584  
 1585          $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1586              $data['parentId'],
 1587              $data['variantAttributes'],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (declarations of productRepository)
   88          protected ProductRepository $productRepository,
  223          $product = $this->productRepository->create($data);
  244          $configurable = $this->productRepository->findOrFail($configurableId);
  323          $parent = $this->productRepository->find($parentId);


===== EDGE E556e2ee1eb =====
{"id": "E556e2ee1eb", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:210", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:208-212
  208      ]);
  209  
  210      $this->withHeaders($this->headers)->json('POST', route('admin.api.configurable_products.store'), [
  211          'type'   => ProductType::VariantGroup->value,
  212          'parent' => $configurable->sku,
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\Event;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Enums\ProductType;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAxis;
   11  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE Ed4db30f060 =====
{"id": "Ed4db30f060", "from": "packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:136", "to_symbol": "Listeners\\Product::afterBulkEditFromImport", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:63", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:134-138
  134      subscribeWebhook([WebhookService::EVENT_PRODUCT_CREATED, WebhookService::EVENT_PRODUCT_UPDATED]);
  135  
  136      app(ProductListener::class)->afterBulkEditFromImport([3, 4]);
  137  
  138      Queue::assertPushed(SendBulkProductWebhook::class, 1);
--- packages/Webkul/Webhook/src/Listeners/Product.php:61-65
   61      }
   62  
   63      public function afterBulkEditFromImport(array $ids): void
   64      {
   65          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_UPDATED);
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php (imports)
    3  use Illuminate\Support\Facades\Event;
    4  use Illuminate\Support\Facades\Queue;
    5  use Webkul\Webhook\Jobs\SendBulkProductWebhook;
    6  use Webkul\Webhook\Listeners\Product as ProductListener;
    7  use Webkul\Webhook\Models\Webhook;
    8  use Webkul\Webhook\Services\WebhookService;


===== EDGE Ec457ff537c =====
{"id": "Ec457ff537c", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:161", "to_symbol": "ProductController::updateProduct", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:126", "kind": "call", "note": "in store (97)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:159-163
  159              Event::dispatch('catalog.product.create.after', $product);
  160  
  161              $product = $this->updateProduct($data, $product);
  162  
  163              return $this->successResponse(
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:124-128
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\ModelNotFoundException;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Validator;
   10  use Illuminate\Validation\ValidationException;
   11  use Symfony\Component\HttpFoundation\Response;
   12  use Webkul\AdminApi\ApiDataSource\Catalog\ConfigurableProductDataSource;
   13  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateConfigurableProductRequest;
   14  use Webkul\AdminApi\Http\Requests\Catalog\StoreConfigurableProductRequest;
   15  use Webkul\AdminApi\Http\Requests\Catalog\UpdateConfigurableProductRequest;
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;


===== EDGE E5fff017d43 =====
{"id": "E5fff017d43", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:105", "to_symbol": "ProductController::createOrUpdateVariant", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:398", "kind": "call", "note": "in store (70)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:103-107
  103                  );
  104  
  105                  $product = $this->createOrUpdateVariant($data);
  106                  unset($data['variant']);
  107              }
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:396-400
  396       * @return Product The updated or created variant product.
  397       */
  398      protected function createOrUpdateVariant(array $data): mixed
  399      {
  400          $parentProduct = $this->findParentProductOr404($data['parent']);
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE E17ee90a487 =====
{"id": "E17ee90a487", "from": "packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:31", "to_symbol": "WebhookService::sendBatchForBulkEdit", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:64", "kind": "call", "note": "called on subclass ChunkedWebhookService; method inherited"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:29-33
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
--- packages/Webkul/Webhook/src/Services/WebhookService.php:62-66
   62      }
   63  
   64      public function sendBatchForBulkEdit(array $ids): ?Response
   65      {
   66          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php (imports)
    3  use Illuminate\Support\Facades\Http;
    4  use Webkul\Product\Models\Product;
    5  use Webkul\Webhook\Models\Webhook;
    6  use Webkul\Webhook\Services\WebhookService;


===== EDGE E9089a1de03 =====
{"id": "E9089a1de03", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "to_symbol": "ConfigurableProductController::store", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:97", "kind": "route", "note": "admin.api.configurable_products.store"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:95-99
   95       * so an invalid link's `additional_data` aborts with nothing persisted.
   96       */
   97      public function store(StoreConfigurableProductRequest $request): JsonResponse
   98      {
   99          if ($request->input('type') === ProductType::VariantGroup->value) {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E3706212e7b =====
{"id": "E3706212e7b", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:291", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:289-293
  289          }
  290  
  291          Event::dispatch('catalog.product.create.after', $node);
  292  
  293          return new JsonResponse([
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;


===== EDGE Eebdb325968 =====
{"id": "Eebdb325968", "from": "packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:32", "to_symbol": "AgentService::executeAsync", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:80", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:30-34
   30  
   31          if ($data['async'] ?? false) {
   32              $this->agentService->executeAsync($payload);
   33  
   34              return new JsonResponse([
--- packages/Webkul/AiAgent/src/Services/AgentService.php:78-82
   78       * Dispatch agent execution to the queue.
   79       */
   80      public function executeAsync(AgentPayload $payload): void
   81      {
   82          $execution = $this->executionRepository->logExecution([
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php (imports)
    3  namespace Webkul\AiAgent\Http\Controllers;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Routing\Controller;
    7  use Webkul\AiAgent\DTOs\AgentPayload;
    8  use Webkul\AiAgent\Http\Requests\ExecuteAgentForm;
    9  use Webkul\AiAgent\Services\AgentService;
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php (declarations of agentService)
   14          protected AgentService $agentService,
   39          $result = $this->agentService->execute($payload);


===== EDGE Ebf2938656d =====
{"id": "Ebf2938656d", "from": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:61", "to_symbol": "AgentServiceContract::execute", "to": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:16", "kind": "call"}
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:59-63
   59          );
   60  
   61          return $this->agentService->execute($payload);
   62      }
   63  
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:14-18
   14       * Execute an agent with the given payload.
   15       */
   16      public function execute(AgentPayload $payload): AgentResult;
   17  
   18      /**
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php (imports)
    3  namespace Webkul\AiAgent\Agents;
    5  use Webkul\AiAgent\Contracts\AgentServiceContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\AgentResult;
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php (declarations of agentService)
   23          protected AgentServiceContract $agentService,


===== EDGE E1e72320f30 =====
{"id": "E1e72320f30", "from": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:82", "to_symbol": "AgentServiceContract::executeAsync", "to": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:21", "kind": "call"}
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:80-84
   80          );
   81  
   82          $this->agentService->executeAsync($payload);
   83      }
   84  
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:19-23
   19       * Execute an agent asynchronously via a queued job.
   20       */
   21      public function executeAsync(AgentPayload $payload): void;
   22  }
   23  
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php (imports)
    3  namespace Webkul\AiAgent\Agents;
    5  use Webkul\AiAgent\Contracts\AgentServiceContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\AgentResult;
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php (declarations of agentService)
   23          protected AgentServiceContract $agentService,


===== EDGE E26425fdcde =====
{"id": "E26425fdcde", "from": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:21", "to_symbol": "AgentService::executeAsync", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:80", "kind": "framework", "note": "interface method implemented by AgentService"}
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:19-23
   19       * Execute an agent asynchronously via a queued job.
   20       */
   21      public function executeAsync(AgentPayload $payload): void;
   22  }
   23  
--- packages/Webkul/AiAgent/src/Services/AgentService.php:78-82
   78       * Dispatch agent execution to the queue.
   79       */
   80      public function executeAsync(AgentPayload $payload): void
   81      {
   82          $execution = $this->executionRepository->logExecution([
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php (imports)
    3  namespace Webkul\AiAgent\Contracts;
    5  use Webkul\AiAgent\DTOs\AgentPayload;
    6  use Webkul\AiAgent\DTOs\AgentResult;


===== EDGE E8739626a0e =====
{"id": "E8739626a0e", "from": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:129", "to_symbol": "PlatformValidator::validateApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:136", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:127-131
  127  
  128          $this->validateModelNames($data['models']);
  129          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
  130  
  131          if (! isset($data['status'])) {
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:134-138
  134       * @throws ValidationException
  135       */
  136      public function validateApiUrl(?string $provider, ?string $apiUrl): void
  137      {
  138          if ($error = $this->apiUrlError($provider, $apiUrl)) {
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\MagicAI;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Log;
    7  use Illuminate\Validation\ValidationException;
    8  use Illuminate\View\View;
    9  use Laravel\Ai\AnonymousAgent;
   10  use Webkul\Admin\DataGrids\MagicAI\MagicAIPlatformDataGrid;
   11  use Webkul\Admin\Http\Controllers\Controller;
   12  use Webkul\Admin\Http\Requests\MagicAI\FetchModelsRequest;
   13  use Webkul\Admin\Http\Requests\MagicAI\PlatformRequest;
   14  use Webkul\Admin\Http\Requests\MagicAI\PlatformTestRequest;
   15  use Webkul\AiAgent\Chat\AiErrorResolver;
   16  use Webkul\MagicAI\Enums\AiProvider;
   17  use Webkul\MagicAI\Repository\MagicAIPlatformRepository;
   18  use Webkul\MagicAI\Services\ManagedPlatform;
   19  use Webkul\MagicAI\Services\ModelDiscovery;
   20  use Webkul\MagicAI\Services\ProviderOverrides;
   21  use Webkul\MagicAI\Services\ScopedProviderConfig;
   22  use Webkul\MagicAI\Support\ModelRecommender;
   23  use Webkul\MagicAI\Validator\PlatformValidator;


===== EDGE Ee6f75e918a =====
{"id": "Ee6f75e918a", "from": "packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php:325", "to_symbol": "Product\\Importer::validateRow", "to": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1143", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php:323-327
  323      $importer->setErrorHelper($errorHelper = app(Error::class));
  324  
  325      expect($importer->validateRow($row, 1))->toBeTrue(json_encode($errorHelper->getAllErrors()));
  326  
  327      $importer->importBatch(JobTrackBatch::factory()->create(['data' => [$row], 'job_track_id' => $jobTrack->id]));
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1141-1145
 1141       * Validates row
 1142       */
 1143      public function validateRow(array $rowData, int $rowNumber): bool
 1144      {
 1145          /**
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php (imports)
    3  use Illuminate\Http\UploadedFile;
    4  use Illuminate\Support\Facades\Storage;
    5  use Illuminate\Support\Str;
    6  use Webkul\Attribute\Models\Attribute;
    7  use Webkul\Core\Rules\FileOrImageValidValue;
    8  use Webkul\DataTransfer\Helpers\Error;
    9  use Webkul\DataTransfer\Helpers\Import;
   10  use Webkul\DataTransfer\Helpers\Importers\FieldProcessor;
   11  use Webkul\DataTransfer\Helpers\Importers\Product\Importer;
   12  use Webkul\DataTransfer\Models\JobTrack;
   13  use Webkul\DataTransfer\Models\JobTrackBatch;
   14  use Webkul\Product\Models\Product;
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php (declarations of errorHelper)
  323      $importer->setErrorHelper($errorHelper = app(Error::class));
  325      expect($importer->validateRow($row, 1))->toBeTrue(json_encode($errorHelper->getAllErrors()));
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php (declarations of importer)
  321      $importer = resolve(Importer::class);
  322      $importer->setImport($jobTrack);
  323      $importer->setErrorHelper($errorHelper = app(Error::class));
  325      expect($importer->validateRow($row, 1))->toBeTrue(json_encode($errorHelper->getAllErrors()));


===== EDGE Ee3d9e5a7e8 =====
{"id": "Ee3d9e5a7e8", "from": "packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php:108", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call", "note": "EnrichmentStep is not registered in any pipeline in the tree (named only in comments)"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php:106-110
  106          $messages = $this->buildMessages($mapped, array_values($missingTargets), $locale);
  107  
  108          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
  109          $generated = $this->parseGenerated($response['content'] ?? '');
  110  
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php (imports)
    3  namespace Webkul\AiAgent\Pipelines\Stages\Image;
    5  use Webkul\AiAgent\Contracts\PipelineStageContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\CredentialConfig;
    8  use Webkul\AiAgent\DTOs\ImageProductContext;
    9  use Webkul\AiAgent\Exceptions\PipelineException;
   10  use Webkul\AiAgent\Http\Client\AiApiClient;
   11  use Webkul\AiAgent\Repositories\CredentialRepository;
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php (declarations of apiClient)
   55          protected AiApiClient $apiClient,
  108          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);


===== EDGE E25b70b7c48 =====
{"id": "E25b70b7c48", "from": "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:31", "to_symbol": "WebhookService::sendBatchForBulkEdit", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:64", "kind": "call"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:29-33
   29          }
   30  
   31          $webhookService->sendBatchForBulkEdit($this->ids);
   32      }
   33  }
--- packages/Webkul/Webhook/src/Services/WebhookService.php:62-66
   62      }
   63  
   64      public function sendBatchForBulkEdit(array $ids): ?Response
   65      {
   66          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php (imports)
    3  namespace Webkul\Webhook\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Auth;
    8  use Webkul\User\Models\AdminProxy;
    9  use Webkul\Webhook\Services\WebhookService;
   13      use Queueable;
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php (declarations of webhookService)
   25      public function handle(WebhookService $webhookService): void


===== EDGE E3f820067d9 =====
{"id": "E3f820067d9", "from": "packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:41", "to_symbol": "WebhookService::sendBatchByIds", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:54", "kind": "call"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:39-43
   39          }
   40  
   41          $webhookService->sendBatchByIds($this->ids);
   42      }
   43  }
--- packages/Webkul/Webhook/src/Services/WebhookService.php:52-56
   52       * Send a batch of products to every subscribed webhook by their IDs.
   53       */
   54      public function sendBatchByIds(array $ids): ?Response
   55      {
   56          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php (imports)
    3  namespace Webkul\Webhook\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Auth;
    8  use Webkul\User\Models\AdminProxy;
    9  use Webkul\Webhook\Services\WebhookService;
   13      use Queueable;
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php (declarations of webhookService)
   29      public function handle(WebhookService $webhookService): void


===== EDGE E8bef0b70dc =====
{"id": "E8bef0b70dc", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:54", "to_symbol": "unopim:magic-ai:platform:add", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:9", "kind": "framework", "note": "artisan command signature (WIZARD const, line 13); ModelDiscovery is mocked in this test (line 22)"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:52-56
   52      $previousDefault = MagicAIPlatform::factory()->default()->create();
   53  
   54      $command = answerConnection(artisan(WIZARD), 'Hosted AI', 'sk-hosted-key')
   55          ->expectsQuestion(wizardLabel('fields.models'), ['gpt-4o', 'gpt-4o-mini'])
   56          ->expectsQuestion(wizardLabel('command.models-additional'), '');
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:7-11
    7  use Webkul\MagicAI\Console\Commands\Platform\Concerns\CollectsPlatform;
    8  
    9  #[Signature('unopim:magic-ai:platform:add
   10      {--provider= : Provider code, e.g. concentrate}
   11      {--label= : Platform label}
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php (imports)
    3  use Illuminate\Support\Facades\Crypt;
    4  use Illuminate\Support\Facades\DB;
    5  use Illuminate\Testing\PendingCommand;
    6  use Webkul\MagicAI\Console\Support\StdinReader;
    7  use Webkul\MagicAI\Enums\AiProvider;
    8  use Webkul\MagicAI\Models\MagicAIPlatform;
    9  use Webkul\MagicAI\Services\ModelDiscovery;
   11  use function Pest\Laravel\artisan;


===== EDGE E3b49994da8 =====
{"id": "E3b49994da8", "from": "packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:210", "to_symbol": "AiProvider::fetchModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:144", "kind": "call"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:208-212
  208      $client = matrixClient([new Response(200, [], json_encode($expected['body']))], $history);
  209  
  210      $models = $provider->fetchModels('platform-key', $expected['apiUrl'] ?? null, $client);
  211      $request = $history[0]['request'];
  212  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:142-146
  142       * @return list<string>
  143       */
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php (imports)
    3  use GuzzleHttp\Client;
    4  use GuzzleHttp\Handler\MockHandler;
    5  use GuzzleHttp\HandlerStack;
    6  use GuzzleHttp\Middleware;
    7  use GuzzleHttp\Psr7\Response;
    8  use Laravel\Ai\Enums\Lab;
    9  use Webkul\MagicAI\Enums\AiProvider;
   10  use Webkul\MagicAI\Models\MagicAIPlatform;
   11  use Webkul\MagicAI\Services\LaravelAiAdapter;
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php (declarations of provider)
  174  function platformFor(AiProvider $provider, array $expected, array $overrides = []): MagicAIPlatform
  177          'label'    => $provider->label(),
  178          'provider' => $provider->value,
  193  it('covers every provider the enum offers', function () {


===== EDGE E157a8526d9 =====
{"id": "E157a8526d9", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiFamilyVariantStructureTest.php:1300", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiFamilyVariantStructureTest.php:1298-1302
 1298  
 1299      $this->withHeaders($this->headers)
 1300          ->json('POST', route('admin.api.configurable_products.store'), [
 1301              'family'            => $fixture['family']->code,
 1302              'variant_structure' => 'vscu1_created',
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiFamilyVariantStructureTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Enums\VariantLevel;
    8  use Webkul\Product\Models\Product;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAttribute;
   11  use Webkul\Product\Models\VariantStructureAxis;
   12  use Webkul\Product\Repositories\ProductRepository;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE Ecff1f98375 =====
{"id": "Ecff1f98375", "from": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:220", "to_symbol": "PlatformValidator::isSafeApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:143", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:218-222
  218          }
  219  
  220          if (! $this->platformValidator()->isSafeApiUrl(request()->input('api_url'))) {
  221              return new JsonResponse([
  222                  'success' => false,
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:141-145
  141      }
  142  
  143      public function isSafeApiUrl(?string $apiUrl): bool
  144      {
  145          $apiUrl = trim((string) $apiUrl);
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\MagicAI;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Log;
    7  use Illuminate\Validation\ValidationException;
    8  use Illuminate\View\View;
    9  use Laravel\Ai\AnonymousAgent;
   10  use Webkul\Admin\DataGrids\MagicAI\MagicAIPlatformDataGrid;
   11  use Webkul\Admin\Http\Controllers\Controller;
   12  use Webkul\Admin\Http\Requests\MagicAI\FetchModelsRequest;
   13  use Webkul\Admin\Http\Requests\MagicAI\PlatformRequest;
   14  use Webkul\Admin\Http\Requests\MagicAI\PlatformTestRequest;
   15  use Webkul\AiAgent\Chat\AiErrorResolver;
   16  use Webkul\MagicAI\Enums\AiProvider;
   17  use Webkul\MagicAI\Repository\MagicAIPlatformRepository;
   18  use Webkul\MagicAI\Services\ManagedPlatform;
   19  use Webkul\MagicAI\Services\ModelDiscovery;
   20  use Webkul\MagicAI\Services\ProviderOverrides;
   21  use Webkul\MagicAI\Services\ScopedProviderConfig;
   22  use Webkul\MagicAI\Support\ModelRecommender;
   23  use Webkul\MagicAI\Validator\PlatformValidator;


===== EDGE E8b12cefe0e =====
{"id": "E8b12cefe0e", "from": "packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:102", "to_symbol": "AgentServiceContract::executeAsync", "to": "packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:21", "kind": "call"}
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:100-104
  100          );
  101  
  102          $this->agentService->executeAsync($payload);
  103      }
  104  
--- packages/Webkul/AiAgent/src/Contracts/AgentServiceContract.php:19-23
   19       * Execute an agent asynchronously via a queued job.
   20       */
   21      public function executeAsync(AgentPayload $payload): void;
   22  }
   23  
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php (imports)
    3  namespace Webkul\AiAgent\Agents;
    5  use Webkul\AiAgent\Contracts\AgentServiceContract;
    6  use Webkul\AiAgent\DTOs\AgentPayload;
    7  use Webkul\AiAgent\DTOs\AgentResult;
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php (declarations of agentService)
   43          protected AgentServiceContract $agentService,


===== EDGE E04b9d52188 =====
{"id": "E04b9d52188", "from": "packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateVariantQueryBudgetTest.php:70", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateVariantQueryBudgetTest.php:68-72
   68      }
   69  
   70      $repository->update([
   71          'sku'            => $configurable->sku,
   72          'channel'        => 'default',
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateVariantQueryBudgetTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\DB;
    5  use Illuminate\Support\Str;
    6  use Webkul\Attribute\Models\Attribute;
    7  use Webkul\Attribute\Models\AttributeFamily;
    8  use Webkul\Product\Enums\ProductType;
    9  use Webkul\Product\Enums\VariantLevel;
   10  use Webkul\Product\Models\VariantStructure;
   11  use Webkul\Product\Models\VariantStructureAttribute;
   12  use Webkul\Product\Models\VariantStructureAxis;
   13  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateVariantQueryBudgetTest.php (declarations of repository)
   51      $repository = app(ProductRepository::class);
   53      $configurable = $repository->create([


===== EDGE E00c458f64b =====
{"id": "E00c458f64b", "from": "packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:55", "to_symbol": "ImageProductAgent::analyze", "to": "packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:54", "kind": "call"}
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:53-57
   53              }
   54  
   55              $result = $agent->analyze(
   56                  imageSource: $imageUrl,
   57                  agentId: $agentId,
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:52-56
   52       * @param  array<string, mixed>  $additionalContext  Extra context to pass to the agent
   53       */
   54      public function analyze(
   55          string $imageSource,
   56          int $agentId,
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php (imports)
    3  namespace Webkul\AiAgent\Examples;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Routing\Controller;
    7  use Webkul\AiAgent\Agents\ImageProductAgent;
    8  use Webkul\AiAgent\Agents\ProductCategorizerAgent;
    9  use Webkul\AiAgent\Agents\TextDescriptionAgent;
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php (declarations of agent)
   55              $result = $agent->analyze(
   92          $result = $agent->execute(
  119          $result = $agent->execute(


===== EDGE E0f96930f05 =====
{"id": "E0f96930f05", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:291", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:289-293
  289          }
  290  
  291          Event::dispatch('catalog.product.create.after', $node);
  292  
  293          return new JsonResponse([
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;


===== EDGE E1cb8c8dc32 =====
{"id": "E1cb8c8dc32", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:300", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "dispatch", "note": "Event::dispatch('catalog.product.update.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:298-302
  298  
  299              if ($wasDirty) {
  300                  Event::dispatch('catalog.product.update.after', $product);
  301              }
  302  
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE E5e9a2103a3 =====
{"id": "E5e9a2103a3", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "to_symbol": "SimpleProductController::store", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:70", "kind": "route", "note": "admin.api.products.store"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:68-72
   68       * Store a newly created resource in storage.
   69       */
   70      public function store(StoreSimpleProductRequest $request): JsonResponse
   71      {
   72          $data = $request->only([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E991ce2e98d =====
{"id": "E991ce2e98d", "from": "packages/Webkul/Product/src/Type/AbstractType.php:199", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "inside AbstractType::update (131)"}
--- packages/Webkul/Product/src/Type/AbstractType.php:197-201
  197  
  198          if ($product->parent_id && ! empty($productValues[self::COMMON_VALUES_KEY])) {
  199              $this->productRepository->guardVariantLevelWrite($product, $productValues[self::COMMON_VALUES_KEY], $persist);
  200          } else {
  201              $persist();
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/Product/src/Type/AbstractType.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Database\Eloquent\Collection as EloquentCollection;
    6  use Illuminate\Http\UploadedFile;
    7  use Illuminate\Support\Collection;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Storage;
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Contracts\AttributeGroup;
   12  use Webkul\Attribute\Models\Attribute;
   13  use Webkul\Attribute\Repositories\AttributeRepository;
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Core\Filesystem\FileStorer;
   16  use Webkul\Core\Traits\HtmlPurifier;
   17  use Webkul\Product\Contracts\Product;
   18  use Webkul\Product\Repositories\AssociationTypeRepository;
   19  use Webkul\Product\Repositories\ProductAssociationRepository;
   20  use Webkul\Product\Repositories\ProductRepository;
   21  use Webkul\Product\Validator\AssociationValidator;
   25      use HtmlPurifier;
--- packages/Webkul/Product/src/Type/AbstractType.php (declarations of productRepository)
  100          protected ProductRepository $productRepository,
  111          $product = $this->productRepository->getModel()->fill($data);
  133          $product = $this->productRepository->find($id);
  901          $product = $this->productRepository->find($id);


===== EDGE Ee0fdd1549e =====
{"id": "Ee0fdd1549e", "from": "packages/Webkul/Product/tests/Feature/ProductAssociationRichSaveTest.php:75", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Feature/ProductAssociationRichSaveTest.php:73-77
   73      $b = Product::factory()->create();
   74  
   75      $updated = $this->productRepository->update([
   76          'sku'          => $source->sku,
   77          'associations' => [
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Feature/ProductAssociationRichSaveTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\DB;
    5  use Illuminate\Validation\ValidationException;
    6  use Webkul\Product\Models\Product;
    7  use Webkul\Product\Repositories\AssociationTypeFieldRepository;
    8  use Webkul\Product\Repositories\AssociationTypeRepository;
    9  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Feature/ProductAssociationRichSaveTest.php (declarations of productRepository)
   14      $this->productRepository = app(ProductRepository::class);
   75      $updated = $this->productRepository->update([
  133      expect(fn () => $this->productRepository->update([
  244      $updated = $this->productRepository->update([


===== EDGE E676f5499e4 =====
{"id": "E676f5499e4", "from": "packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:186", "to_symbol": "Product\\Importer::validateRow", "to": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1143", "kind": "call"}
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:184-188
  184          $importer->setErrorHelper(app(Error::class));
  185  
  186          expect($importer->validateRow($row, 1))->toBeTrue();
  187  
  188          $batch = JobTrackBatch::factory()->create([
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1141-1145
 1141       * Validates row
 1142       */
 1143      public function validateRow(array $rowData, int $rowNumber): bool
 1144      {
 1145          /**
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php (imports)
    3  use Illuminate\Http\UploadedFile;
    4  use Illuminate\Support\Facades\Storage;
    5  use Illuminate\Support\Str;
    6  use Webkul\Attribute\Models\Attribute;
    7  use Webkul\DataTransfer\Helpers\Error;
    8  use Webkul\DataTransfer\Helpers\Export;
    9  use Webkul\DataTransfer\Helpers\Exporters\Product\Exporter;
   10  use Webkul\DataTransfer\Helpers\Import;
   11  use Webkul\DataTransfer\Helpers\Importers\FieldProcessor;
   12  use Webkul\DataTransfer\Helpers\Importers\Product\Importer;
   13  use Webkul\DataTransfer\Jobs\Export\File\JSONFileBuffer;
   14  use Webkul\DataTransfer\Models\JobInstances;
   15  use Webkul\DataTransfer\Models\JobTrack;
   16  use Webkul\DataTransfer\Models\JobTrackBatch;
   17  use Webkul\Product\Models\Product;
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php (declarations of importer)
  181          $importer = freshMediaImporter();
  183          $importer->setImport($jobTrack);
  184          $importer->setErrorHelper(app(Error::class));
  186          expect($importer->validateRow($row, 1))->toBeTrue();


===== EDGE Edcdea098a4 =====
{"id": "Edcdea098a4", "from": "packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:36", "to_symbol": "WebhookService::sendBatchCreatedByIds", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:59", "kind": "call"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:34-38
   34  
   35          if ($this->event === WebhookService::EVENT_PRODUCT_CREATED) {
   36              $webhookService->sendBatchCreatedByIds($this->ids);
   37  
   38              return;
--- packages/Webkul/Webhook/src/Services/WebhookService.php:57-61
   57      }
   58  
   59      public function sendBatchCreatedByIds(array $ids): ?Response
   60      {
   61          return $this->deliverChunked('id', $ids, computeChanges: false, event: self::EVENT_PRODUCT_CREATED, skipIfNoChanges: false);
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php (imports)
    3  namespace Webkul\Webhook\Jobs;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Facades\Auth;
    8  use Webkul\User\Models\AdminProxy;
    9  use Webkul\Webhook\Services\WebhookService;
   13      use Queueable;
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php (declarations of webhookService)
   29      public function handle(WebhookService $webhookService): void


===== EDGE E5e08b937d8 =====
{"id": "E5e08b937d8", "from": "packages/Webkul/Product/tests/Feature/ProductAssociationCopyTest.php:28", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Feature/ProductAssociationCopyTest.php:26-30
   26      $upSell = Product::factory()->create();
   27  
   28      $this->productRepository->update([
   29          'sku'              => $source->sku,
   30          'related_products' => [$related->sku],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Feature/ProductAssociationCopyTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Illuminate\Support\Facades\DB;
    5  use Webkul\Product\Enums\ProductType;
    6  use Webkul\Product\Models\Product;
    7  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Feature/ProductAssociationCopyTest.php (declarations of productRepository)
   19      $this->productRepository = app(ProductRepository::class);
   36      $copiedProduct = $this->productRepository->copy($source->id);
   68      $copiedProduct = $this->productRepository->copy($source->id);


===== EDGE E89f7e9135b =====
{"id": "E89f7e9135b", "from": "packages/Webkul/Admin/src/Routes/rest-routes.php:117", "to_symbol": "MagicAIPlatformController::update", "to": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:116", "kind": "route"}
--- packages/Webkul/Admin/src/Routes/rest-routes.php:115-119
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');
  118          Route::delete('{id}', 'destroy')->name('admin.magic_ai.platform.delete');
  119          Route::post('{id}/default', 'setDefault')->name('admin.magic_ai.platform.set_default');
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:114-118
  114      }
  115  
  116      public function update(PlatformRequest $request, int $id): JsonResponse
  117      {
  118          $platform = $this->platformRepository->find($id);
--- packages/Webkul/Admin/src/Routes/rest-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\Admin\Http\Controllers\DashboardController;
    5  use Webkul\Admin\Http\Controllers\DataGridController;
    6  use Webkul\Admin\Http\Controllers\HelpController;
    7  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIController;
    8  use Webkul\Admin\Http\Controllers\MagicAI\MagicAIPlatformController;
    9  use Webkul\Admin\Http\Controllers\MagicAI\MagicAISystemPromptController;
   10  use Webkul\Admin\Http\Controllers\ManageColumnController;
   11  use Webkul\Admin\Http\Controllers\MediaController;
   12  use Webkul\Admin\Http\Controllers\TinyMCEController;
   13  use Webkul\Admin\Http\Controllers\User\AccountController;
   14  use Webkul\Admin\Http\Controllers\User\AclVersionController;
   15  use Webkul\Admin\Http\Controllers\User\SessionController;
   16  use Webkul\Admin\Http\Controllers\VueJsSelect\SelectOptionsController;
   17  use Webkul\HistoryControl\Http\Controllers\HistoryController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/Admin/src/Routes/rest-routes.php (route groups / registration)
   22  Route::group(['middleware' => ['admin'], 'prefix' => config('app.admin_url')], function () {
   33      Route::controller(DashboardController::class)->prefix('dashboard')->group(function () {
   42      Route::controller(HelpController::class)->prefix('help')->group(function () {
   68      Route::controller(MagicAIController::class)->prefix('magic-ai')->group(function () {
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  125      Route::controller(MagicAISystemPromptController::class)->prefix('magic-ai/system-prompts')->group(function () {
  141      Route::controller(AccountController::class)->prefix('account')->group(function () {
  150      Route::controller(HistoryController::class)->prefix('history')->group(function () {


===== EDGE E44ad51ea3f =====
{"id": "E44ad51ea3f", "from": "packages/Webkul/Product/tests/Feature/ProductAssociationSyncResilienceTest.php:41", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Feature/ProductAssociationSyncResilienceTest.php:39-43
   39      $upSell = Product::factory()->create();
   40  
   41      $updated = $this->productRepository->update([
   42          'sku'              => $source->sku,
   43          'related_products' => [$related->sku],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Product/tests/Feature/ProductAssociationSyncResilienceTest.php (imports)
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Product\Models\Product;
    5  use Webkul\Product\Repositories\ProductAssociationRepository;
    6  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/tests/Feature/ProductAssociationSyncResilienceTest.php (declarations of productRepository)
   22      $this->productRepository = app(ProductRepository::class);
   41      $updated = $this->productRepository->update([


===== EDGE Efd0a155f17 =====
{"id": "Efd0a155f17", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:112", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:110-114
  110                  Event::dispatch('catalog.product.create.before');
  111                  $product = $this->productRepository->create($data);
  112                  Event::dispatch('catalog.product.create.after', $product);
  113              }
  114  
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Validation\ValidationException;
    8  use Symfony\Component\HttpFoundation\Response;
    9  use Webkul\AdminApi\ApiDataSource\Catalog\SimpleProductDataSource;
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;


===== EDGE Eef22a0798c =====
{"id": "Eef22a0798c", "from": "packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:42", "to_symbol": "ImageToProductService::execute", "to": "packages/Webkul/AiAgent/src/Services/ImageToProductService.php:45", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:40-44
   40  
   41          try {
   42              $ctx = $this->imageToProductService->execute(
   43                  image: $firstImage,
   44                  credentialId: (int) $validated['credential_id'],
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:43-47
   43       * @throws \InvalidArgumentException
   44       */
   45      public function execute(
   46          UploadedFile $image,
   47          ?AiApiClient $apiClient = null,
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php (imports)
    3  namespace Webkul\AiAgent\Http\Controllers;
    5  use Illuminate\Contracts\View\Factory;
    6  use Illuminate\Http\JsonResponse;
    7  use Illuminate\Routing\Controller;
    8  use Illuminate\View\View;
    9  use Webkul\AiAgent\Http\Requests\GenerateForm;
   10  use Webkul\AiAgent\Repositories\CredentialRepository;
   11  use Webkul\AiAgent\Services\ImageToProductService;
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php (declarations of imageToProductService)
   17          protected ImageToProductService $imageToProductService,
   42              $ctx = $this->imageToProductService->execute(


===== EDGE Edd88dd376f =====
{"id": "Edd88dd376f", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:495", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "dispatch", "note": "Event::dispatch('catalog.product.create.after')"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:493-497
  493              $variant = $configurable->getTypeInstance()->createVariant($configurable, $axisAttributes, $variantData);
  494  
  495              Event::dispatch('catalog.product.create.after', $variant);
  496  
  497              return $variant;
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php (imports)
    3  namespace Webkul\AdminApi\Http\Controllers\API\Catalog;
    5  use Illuminate\Database\Eloquent\Collection;
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\ModelNotFoundException;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Event;
   10  use Illuminate\Support\Str;
   11  use Illuminate\Validation\ValidationException;
   12  use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
   13  use Webkul\AdminApi\Http\Controllers\API\ApiController;
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;


===== EDGE E9e9185604b =====
{"id": "E9e9185604b", "from": "packages/Webkul/Product/src/Type/Configurable.php:148", "to_symbol": "AbstractType::update", "to": "packages/Webkul/Product/src/Type/AbstractType.php:131", "kind": "call", "note": "parent::update in Configurable::update"}
--- packages/Webkul/Product/src/Type/Configurable.php:146-150
  146      public function update(array $data, $id, $attribute = 'id')
  147      {
  148          $product = parent::update($data, $id, $attribute);
  149  
  150          $this->updateDefaultVariantId();
--- packages/Webkul/Product/src/Type/AbstractType.php:129-133
  129       * @return Product
  130       */
  131      public function update(array $data, $id, $attribute = 'id')
  132      {
  133          $product = $this->productRepository->find($id);
--- packages/Webkul/Product/src/Type/Configurable.php (imports)
    3  namespace Webkul\Product\Type;
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;
   14  use Webkul\Product\Repositories\ProductRepository;


===== EDGE E3076013242 =====
{"id": "E3076013242", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:308", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call", "note": "in persistProduct (287)"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:306-310
  306  
  307          try {
  308              $this->productRepository->guardVariantLevelWrite(
  309                  $product,
  310                  $submittedCommon,
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php (imports)
    3  namespace Webkul\DataTransfer\Jobs\System;
    5  use Illuminate\Contracts\Queue\ShouldQueue;
    6  use Illuminate\Foundation\Queue\Queueable;
    7  use Illuminate\Support\Arr;
    8  use Illuminate\Support\Collection;
    9  use Illuminate\Support\Facades\Auth;
   10  use Illuminate\Support\Facades\Event;
   11  use Illuminate\Support\Facades\Storage;
   12  use Illuminate\Validation\ValidationException;
   13  use Webkul\Attribute\Contracts\Attribute;
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Attribute\Services\AttributeService;
   16  use Webkul\DataTransfer\Helpers\AbstractJob;
   17  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   18  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   19  use Webkul\DataTransfer\Services\JobLogger;
   20  use Webkul\Product\Contracts\VariantStructurePlanner;
   21  use Webkul\Product\Models\Product;
   22  use Webkul\Product\Repositories\ProductRepository;
   23  use Webkul\Product\Validator\ProductValuesValidator;
   24  use Webkul\User\Models\AdminProxy;
   28      use Queueable;
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php (declarations of productRepository)
   43      protected ProductRepository $productRepository;
  108          $this->productRepository = resolve(ProductRepository::class);
  131          $products = $this->productRepository


===== EDGE Eda0a486b58 =====
{"id": "Eda0a486b58", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1333", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1331-1335
 1331  
 1332          try {
 1333              $product = $this->productRepository->update($data, $id);
 1334          } catch (ValidationException $e) {
 1335              $errors = $e->errors();
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (imports)
    3  namespace Webkul\Admin\Http\Controllers\Catalog;
    5  use Illuminate\Http\JsonResponse;
    6  use Illuminate\Http\RedirectResponse;
    7  use Illuminate\Support\Facades\DB;
    8  use Illuminate\Support\Facades\Event;
    9  use Illuminate\Support\Facades\Log;
   10  use Illuminate\Support\Facades\Storage;
   11  use Illuminate\Support\Str;
   12  use Illuminate\Validation\ValidationException;
   13  use Illuminate\View\View;
   14  use Symfony\Component\HttpFoundation\BinaryFileResponse;
   15  use Symfony\Component\HttpFoundation\StreamedResponse;
   16  use Webkul\Admin\DataGrids\Catalog\ProductDataGrid;
   17  use Webkul\Admin\Filters\ProductPropertyFilters;
   18  use Webkul\Admin\Http\Controllers\Controller;
   19  use Webkul\Admin\Http\Requests\CheckVariantUniquenessForm;
   20  use Webkul\Admin\Http\Requests\ProductAttributeForm;
   21  use Webkul\Admin\Http\Requests\ProductAttributeGroupsForm;
   22  use Webkul\Admin\Http\Requests\ProductForm;
   23  use Webkul\Admin\Http\Requests\QueueQuickExportRequest;
   24  use Webkul\Admin\Http\Requests\SelectableMassDestroyRequest;
   25  use Webkul\Admin\Http\Requests\SelectableMassUpdateRequest;
   26  use Webkul\Admin\Http\Requests\VariantChildrenForm;
   27  use Webkul\Admin\Http\Requests\VariantNodeForm;
   28  use Webkul\Admin\Http\Resources\Catalog\AssociationTypeLinkResource;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php (declarations of productRepository)
   88          protected ProductRepository $productRepository,
  223          $product = $this->productRepository->create($data);
  244          $configurable = $this->productRepository->findOrFail($configurableId);
  323          $parent = $this->productRepository->find($parentId);


===== EDGE Ed9c094317e =====
{"id": "Ed9c094317e", "from": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:152", "to_symbol": "ConfigurableProductController::update", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:255", "kind": "route", "note": "admin.api.configurable_products.update"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:150-154
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');
  154              Route::patch('{code}', 'partialUpdate')->name('admin.api.'.$nameSuffix.'.patch');
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:253-257
  253       * Update the specified resource in storage.
  254       */
  255      public function update(UpdateConfigurableProductRequest $request, string $sku): JsonResponse
  256      {
  257          $data = $request->only([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (imports)
    3  use Illuminate\Support\Facades\Route;
    4  use Webkul\AdminApi\Http\Controllers\API\Catalog\AssociationTypeController;
    5  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeController;
    6  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeFamilyController;
    7  use Webkul\AdminApi\Http\Controllers\API\Catalog\AttributeGroupController;
    8  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryController;
    9  use Webkul\AdminApi\Http\Controllers\API\Catalog\CategoryFieldController;
   10  use Webkul\AdminApi\Http\Controllers\API\Catalog\ConfigurableProductController;
   11  use Webkul\AdminApi\Http\Controllers\API\Catalog\MediaFileController;
   12  use Webkul\AdminApi\Http\Controllers\API\Catalog\SimpleProductController;
   13  use Webkul\AdminApi\Http\Controllers\API\Catalog\VariantStructureController;
--- bootstrap/app.php (route groups / registration)
   17      ->withRouting(
   18          web: __DIR__.'/../routes/web.php',
   19          api: __DIR__.'/../routes/api.php',
   48              ->group(function () use ($schedule): void {
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php (route groups / registration)
   15  Route::group([
   21      Route::controller(AttributeGroupController::class)->prefix('attribute-groups')->group(function () {
   31      Route::controller(AttributeController::class)->prefix('attributes')->group(function () {
   46      Route::controller(AttributeFamilyController::class)->prefix('families')->group(function () {
   56      Route::controller(VariantStructureController::class)->prefix('families')->group(function () {
   66      Route::controller(CategoryFieldController::class)->prefix('category-fields')->group(function () {
   81      Route::controller(AssociationTypeController::class)->prefix('association-types')->group(function () {
   96      Route::controller(CategoryController::class)->prefix('categories')->group(function () {
  106      Route::controller(MediaFileController::class)->prefix('media-files')->group(function () {
  107          Route::prefix('category')->group(function () {
  113          Route::prefix('product')->group(function () {
  119          Route::prefix('swatch')->group(function () {


===== EDGE E8cebdb93f5 =====
{"id": "E8cebdb93f5", "from": "packages/Webkul/AiAgent/src/Services/ImageToProductService.php:73", "to_symbol": "EnrichmentService::enrich", "to": "packages/Webkul/AiAgent/src/Services/EnrichmentService.php:44", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:71-75
   71  
   72          // 4 — Enrich: fill missing attributes (name, description, SEO, etc.)
   73          $ctx = $this->enrichmentService->enrich(
   74              ctx: $ctx,
   75              credentialId: $credentialId,
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:42-46
   42       * @throws ApiException
   43       */
   44      public function enrich(ImageProductContext $ctx, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
   45      {
   46          // Check completeness against locale-specific data only.  Merging with
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php (imports)
    3  namespace Webkul\AiAgent\Services;
    5  use Illuminate\Http\UploadedFile;
    6  use Webkul\AiAgent\DTOs\ImageProductContext;
    7  use Webkul\AiAgent\Exceptions\ApiException;
    8  use Webkul\AiAgent\Http\Client\AiApiClient;
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php (declarations of enrichmentService)
   24          protected EnrichmentService $enrichmentService,
   73          $ctx = $this->enrichmentService->enrich(