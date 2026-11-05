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