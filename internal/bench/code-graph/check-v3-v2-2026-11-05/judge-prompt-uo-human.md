You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository. For each item you get a registered question and a list of candidate files assembled from several sources; for each candidate, source lines were extracted mechanically from the subject at its registered pin, with line numbers. Candidates are listed in an arbitrary order. Some candidates belong in the answer and some do not.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question as worded) or `OUT`, with a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `unopim` at its registered pin.



========== ITEM uo-c-route-02 ==========
Question (registered, verbatim):
{
 "question": "Through which files does the route named admin.catalog.products.copy reach the Product model?",
 "probe": "admin.catalog.products.copy",
 "probe_to": "Product"
}

Candidate files (13):

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:35-41
   35  use Webkul\Completeness\Jobs\ProductCompletenessJob;
   36  use Webkul\Core\Repositories\ChannelRepository;
   37  use Webkul\Core\Rules\Sku;
   38  use Webkul\Product\Contracts\Product as ProductContract;
   39  use Webkul\Product\Contracts\ProductAssociation as ProductAssociationContract;
   40  use Webkul\Product\Contracts\VariantStructurePlanner;
   41  use Webkul\Product\Enums\ProductType;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:36-42
   36  use Webkul\Core\Repositories\ChannelRepository;
   37  use Webkul\Core\Rules\Sku;
   38  use Webkul\Product\Contracts\Product as ProductContract;
   39  use Webkul\Product\Contracts\ProductAssociation as ProductAssociationContract;
   40  use Webkul\Product\Contracts\VariantStructurePlanner;
   41  use Webkul\Product\Enums\ProductType;
   42  use Webkul\Product\Enums\VariantLevel;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:37-43
   37  use Webkul\Core\Rules\Sku;
   38  use Webkul\Product\Contracts\Product as ProductContract;
   39  use Webkul\Product\Contracts\ProductAssociation as ProductAssociationContract;
   40  use Webkul\Product\Contracts\VariantStructurePlanner;
   41  use Webkul\Product\Enums\ProductType;
   42  use Webkul\Product\Enums\VariantLevel;
   43  use Webkul\Product\Facades\ProductValueMapper as ProductValueMapperFacade;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1359-1365
 1359      /**
 1360       * Copy a given Product.
 1361       */
 1362      public function copy(int $id): JsonResponse
 1363      {
 1364          try {
 1365              $product = $this->productRepository->copy($id);
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1362-1368
 1362      public function copy(int $id): JsonResponse
 1363      {
 1364          try {
 1365              $product = $this->productRepository->copy($id);
 1366          } catch (\Exception $e) {
 1367              return new JsonResponse([
 1368                  'message' => $e->getMessage(),

* packages/Webkul/Admin/src/Routes/catalog-routes.php
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:184-190
  184          /**
  185           * Products routes.
  186           */
  187          Route::controller(ProductController::class)->prefix('products')->group(function () {
  188              Route::get('', 'index')->name('admin.catalog.products.index');
  189  
  190              Route::match(['get', 'post'], 'quick-export', 'quickExport')->name('admin.catalog.products.quick-export');
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:197-203
  197  
  198              Route::post('create', 'store')->name('admin.catalog.products.store');
  199  
  200              Route::post('copy/{id}', 'copy')->name('admin.catalog.products.copy');
  201  
  202              Route::post('{configurableId}/variant-node', 'createVariantNode')->name('admin.catalog.products.variant_node.create');
  203  

* packages/Webkul/Product/src/Contracts/Product.php
--- packages/Webkul/Product/src/Contracts/Product.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Contracts;
    4  
    5  interface Product {}
    6  
--- packages/Webkul/Product/src/Contracts/Product.php:2-6
    2  
    3  namespace Webkul\Product\Contracts;
    4  
    5  interface Product {}
    6  

* packages/Webkul/Product/src/Repositories/ProductRepository.php
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Repositories;
    4  
    5  use Illuminate\Container\Container;
    6  use Illuminate\Database\Eloquent\ModelNotFoundException;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:10-16
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:11-17
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:158-164
  158       * @param  int  $id
  159       * @return Product
  160       */
  161      public function copy($id)
  162      {
  163          $product = $this->with([
  164              'attribute_family',

* packages/Webkul/Product/src/Type/AbstractType.php
--- packages/Webkul/Product/src/Type/AbstractType.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  use Illuminate\Database\Eloquent\Collection as EloquentCollection;
    6  use Illuminate\Http\UploadedFile;
--- packages/Webkul/Product/src/Type/AbstractType.php:14-20
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Core\Filesystem\FileStorer;
   16  use Webkul\Core\Traits\HtmlPurifier;
   17  use Webkul\Product\Contracts\Product;
   18  use Webkul\Product\Repositories\AssociationTypeRepository;
   19  use Webkul\Product\Repositories\ProductAssociationRepository;
   20  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/src/Type/AbstractType.php:15-21
   15  use Webkul\Core\Filesystem\FileStorer;
   16  use Webkul\Core\Traits\HtmlPurifier;
   17  use Webkul\Product\Contracts\Product;
   18  use Webkul\Product\Repositories\AssociationTypeRepository;
   19  use Webkul\Product\Repositories\ProductAssociationRepository;
   20  use Webkul\Product\Repositories\ProductRepository;
   21  use Webkul\Product\Validator\AssociationValidator;
--- packages/Webkul/Product/src/Type/AbstractType.php:575-581
  575       *
  576       * @throws \Exception
  577       */
  578      public function copy()
  579      {
  580          if (! $this->canBeCopied()) {
  581              throw new \Exception(trans('product::app.response.product-can-not-be-copied', ['type' => $this->product->type]));

* bootstrap/providers.php
--- bootstrap/providers.php:19-25
   19  use Webkul\MagicAI\Providers\MagicAIServiceProvider;
   20  use Webkul\Measurement\Providers\MeasurementServiceProvider;
   21  use Webkul\Notification\Providers\NotificationServiceProvider;
   22  use Webkul\Product\Providers\ProductServiceProvider;
   23  use Webkul\ProductPassport\Providers\ProductPassportServiceProvider;
   24  use Webkul\Publication\Providers\PublicationServiceProvider;
   25  use Webkul\Resource\Providers\ResourceServiceProvider;

* packages/Webkul/Admin/src/Routes/web.php
--- packages/Webkul/Admin/src/Routes/web.php:8-14
    8  /**
    9   * Catalog routes.
   10   */
   11  require 'catalog-routes.php';
   12  
   13  /**
   14   * Settings routes.

* packages/Webkul/Product/src/Config/product_types.php
--- packages/Webkul/Product/src/Config/product_types.php:1-6
    1  <?php
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
--- packages/Webkul/Product/src/Config/product_types.php:1-7
    1  <?php
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
    7  
--- packages/Webkul/Product/src/Config/product_types.php:2-8
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
    7  
    8  return [

* packages/Webkul/Product/src/Type/Configurable.php
--- packages/Webkul/Product/src/Type/Configurable.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
--- packages/Webkul/Product/src/Type/Configurable.php:6-12
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Type/Configurable.php:7-13
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;

* packages/Webkul/Product/src/Providers/ModuleServiceProvider.php
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Providers;
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:3-9
    3  namespace Webkul\Product\Providers;
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
    7  use Webkul\Product\Models\AssociationTypeField;
    8  use Webkul\Product\Models\AssociationTypeFieldOption;
    9  use Webkul\Product\Models\AssociationTypeFieldOptionTranslation;
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:4-10
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
    7  use Webkul\Product\Models\AssociationTypeField;
    8  use Webkul\Product\Models\AssociationTypeFieldOption;
    9  use Webkul\Product\Models\AssociationTypeFieldOptionTranslation;
   10  use Webkul\Product\Models\AssociationTypeFieldTranslation;

* packages/Webkul/Product/src/Models/Product.php
--- packages/Webkul/Product/src/Models/Product.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Models;
    4  
    5  use Exception;
    6  use Illuminate\Database\Eloquent\Attributes\Fillable;
--- packages/Webkul/Product/src/Models/Product.php:23-29
   23  use Webkul\HistoryControl\Interfaces\PresentableHistoryInterface;
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
--- packages/Webkul/Product/src/Models/Product.php:24-30
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
   30  use Webkul\Product\Database\Factories\ProductFactory;
--- packages/Webkul/Product/src/Models/Product.php:120-126
  120       *
  121       * @throws Exception
  122       */
  123      public function getTypeInstance(): AbstractType
  124      {
  125          if ($this->typeInstance) {
  126              return $this->typeInstance;

* packages/Webkul/Admin/src/Providers/AdminServiceProvider.php
--- packages/Webkul/Admin/src/Providers/AdminServiceProvider.php:26-32
   26  use Webkul\Core\Models\CurrencyProxy;
   27  use Webkul\Core\Models\LocaleProxy;
   28  use Webkul\Core\Tree;
   29  use Webkul\Product\Models\ProductProxy;
   30  
   31  class AdminServiceProvider extends ServiceProvider
   32  {
--- packages/Webkul/Admin/src/Providers/AdminServiceProvider.php:42-48
   42          // from the model lookup. Non-numeric identifiers use `code`/`slug` params.
   43          Route::middleware('web')
   44              ->where(['id' => '[0-9]+'])
   45              ->group(__DIR__.'/../Routes/web.php');
   46  
   47          $this->loadTranslationsFrom(__DIR__.'/../Resources/lang', 'admin');
   48  

* packages/Webkul/Product/src/Type/Simple.php
--- packages/Webkul/Product/src/Type/Simple.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  class Simple extends AbstractType {}
    6  


========== ITEM uo-c-model-02 ==========
Question (registered, verbatim):
{
 "question": "Which table does the VariantStructureAxis model persist to, and which migration files define or alter it?",
 "probe": "VariantStructureAxis"
}

Candidate files (7):

* packages/Webkul/Product/src/Database/Migrations/2026_07_20_000001_add_variant_structure_id_to_products_table.php
--- packages/Webkul/Product/src/Database/Migrations/2026_07_20_000001_add_variant_structure_id_to_products_table.php: no probe token in the file

* packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php: no probe token in the file

* packages/Webkul/Product/src/Models/VariantStructureAxis.php
--- packages/Webkul/Product/src/Models/VariantStructureAxis.php:15-21
   15      'position',
   16  ])]
   17  #[WithoutTimestamps]
   18  class VariantStructureAxis extends Model
   19  {
   20      public function attribute(): BelongsTo
   21      {

* packages/Webkul/Product/src/Database/Migrations/2026_07_14_210000_add_level_to_variant_structure_axes_table.php
--- packages/Webkul/Product/src/Database/Migrations/2026_07_14_210000_add_level_to_variant_structure_axes_table.php:12-18
   12              return;
   13          }
   14  
   15          Schema::table('variant_structure_axes', function (Blueprint $table): void {
   16              if (! Schema::hasColumn('variant_structure_axes', 'level')) {
   17                  $table->enum('level', ['level_1', 'level_2'])->default('level_1')->after('attribute_id');
   18              }

* packages/Webkul/Product/src/Database/Migrations/2026_07_15_124500_drop_legacy_variant_structure_axis_position_unique.php
--- packages/Webkul/Product/src/Database/Migrations/2026_07_15_124500_drop_legacy_variant_structure_axis_position_unique.php:23-29
   23          }
   24  
   25          if ($this->indexExists('variant_structure_axes', self::LEGACY_INDEX)) {
   26              Schema::table('variant_structure_axes', function (Blueprint $table): void {
   27                  $table->dropUnique(self::LEGACY_INDEX);
   28              });
   29          }

* packages/Webkul/Product/src/Database/Migrations/2026_07_11_000001_create_variant_structures_tables.php
--- packages/Webkul/Product/src/Database/Migrations/2026_07_11_000001_create_variant_structures_tables.php:20-26
   20              $table->foreign('attribute_family_id')->references('id')->on('attribute_families')->onDelete('cascade');
   21          });
   22  
   23          Schema::create('variant_structure_axes', function (Blueprint $table): void {
   24              $table->increments('id');
   25              $table->unsignedInteger('variant_structure_id');
   26              $table->unsignedInteger('attribute_id');

* packages/Webkul/Admin/src/DataGrids/Catalog/VariantStructureDataGrid.php
--- packages/Webkul/Admin/src/DataGrids/Catalog/VariantStructureDataGrid.php: no probe token in the file


========== ITEM uo-c-model-01 ==========
Question (registered, verbatim):
{
 "question": "Which table does the Apikey model persist to, and which migration files define or alter it?",
 "probe": "Apikey"
}

Candidate files (5):

* packages/Webkul/AdminApi/src/Database/Migrations/2026_07_20_100200_migrate_existing_api_keys_to_robots.php
--- packages/Webkul/AdminApi/src/Database/Migrations/2026_07_20_100200_migrate_existing_api_keys_to_robots.php:3-9
    3  use Illuminate\Database\Migrations\Migration;
    4  use Illuminate\Support\Facades\DB;
    5  use Laravel\Passport\Token;
    6  use Webkul\AdminApi\Models\Apikey;
    7  use Webkul\AdminApi\Services\ApiUserProvisioner;
    8  use Webkul\User\Models\Admin;
    9  
--- packages/Webkul/AdminApi/src/Database/Migrations/2026_07_20_100200_migrate_existing_api_keys_to_robots.php:13-19
   13      {
   14          $provisioner = app(ApiUserProvisioner::class);
   15  
   16          Apikey::where('revoked', 0)->chunkById(100, function ($keys) use ($provisioner) {
   17              foreach ($keys as $key) {
   18                  $owner = Admin::find($key->admin_id);
   19  

* packages/Webkul/AdminApi/src/Database/Migrations/2024_07_10_112208_api_keys.php
--- packages/Webkul/AdminApi/src/Database/Migrations/2024_07_10_112208_api_keys.php:11-17
   11       */
   12      public function up(): void
   13      {
   14          Schema::create('api_keys', function (Blueprint $table) {
   15              $table->increments('id');
   16              $table->string('name');
   17              $table->integer('admin_id')->unsigned();

* packages/Webkul/AdminApi/src/Models/Apikey.php
--- packages/Webkul/AdminApi/src/Models/Apikey.php:6-12
    6  use Illuminate\Database\Eloquent\Factories\HasFactory;
    7  use Illuminate\Database\Eloquent\Model;
    8  use Illuminate\Database\Eloquent\Relations\BelongsTo;
    9  use Webkul\AdminApi\Contracts\Apikey as ApikeyContract;
   10  use Webkul\AdminApi\Database\Factories\ApiKeyFactory;
   11  use Webkul\HistoryControl\Contracts\HistoryAuditable as HistoryContract;
   12  use Webkul\HistoryControl\Traits\HistoryTrait;
--- packages/Webkul/AdminApi/src/Models/Apikey.php:12-18
   12  use Webkul\HistoryControl\Traits\HistoryTrait;
   13  use Webkul\User\Models\AdminProxy;
   14  
   15  class Apikey extends Model implements ApikeyContract, HistoryContract
   16  {
   17      use HasFactory;
   18      use HistoryTrait;
--- packages/Webkul/AdminApi/src/Models/Apikey.php:22-28
   22       *
   23       * @var string
   24       */
   25      protected $table = 'api_keys';
   26  
   27      /** Tags for History */
   28      protected $historyTags = ['Apikey'];
--- packages/Webkul/AdminApi/src/Models/Apikey.php:25-31
   25      protected $table = 'api_keys';
   26  
   27      /** Tags for History */
   28      protected $historyTags = ['Apikey'];
   29  
   30      /** Fields for History */
   31      protected $historyFields = [

* packages/Webkul/AdminApi/src/Database/Migrations/2026_07_27_100100_drop_system_api_role.php
--- packages/Webkul/AdminApi/src/Database/Migrations/2026_07_27_100100_drop_system_api_role.php: no probe token in the file

* packages/Webkul/Measurement/src/Database/Migrations/2026_07_29_120000_add_api_measurement_unit_permissions.php
--- packages/Webkul/Measurement/src/Database/Migrations/2026_07_29_120000_add_api_measurement_unit_permissions.php: no probe token in the file


========== ITEM uo-c-route-03 ==========
Question (registered, verbatim):
{
 "question": "Through which files does the route named webhook.test reach SafeWebhookUrl::httpOptions?",
 "probe": "webhook.test",
 "probe_to": "httpOptions"
}

Candidate files (6):

* bootstrap/providers.php
--- bootstrap/providers.php: no probe token in the file

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:137-143
  137      /**
  138       * Probe a webhook URL with a test payload before the admin saves it.
  139       */
  140      public function test(Request $request): JsonResponse
  141      {
  142          abort_unless(bouncer()->hasPermission('configuration.webhook.create') || bouncer()->hasPermission('configuration.webhook.edit'), 403);
  143  
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:151-157
  151          }
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:154-160
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',
  158                      'timestamp' => now()->toDateTimeString(),
  159                      'message'   => trans('webhook::app.webhooks.test.payload-message'),
  160                  ]);

* packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php
--- packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php:16-22
   16       */
   17      public function boot(): void
   18      {
   19          Route::middleware('web')->group(__DIR__.'/../Routes/web.php');
   20  
   21          $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
   22  

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);

* packages/Webkul/Webhook/src/Routes/web.php
--- packages/Webkul/Webhook/src/Routes/web.php:13-19
   13              Route::put('edit/{id}', 'update')->name('webhook.update')->whereNumber('id');
   14              Route::delete('delete/{id}', 'destroy')->name('webhook.delete')->whereNumber('id');
   15              Route::post('mass-delete', 'massDestroy')->name('webhook.mass_delete');
   16              Route::post('test', 'test')->name('webhook.test');
   17          });
   18  
   19          Route::controller(WebhookLogsController::class)->prefix('logs')->group(function (): void {

* packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:14-20
   14   *  - WebhookService::sendDataToWebhook / sendCreatedToWebhook / sendBatch
   15   *
   16   * DNS-rebinding (TOCTOU) defense: callers pair validate() with
   17   * httpOptions($url), which returns a CURLOPT_RESOLVE entry pinning the
   18   * hostname to the validated IP so the connection cannot re-resolve to an
   19   * internal address between check and use. HTTP redirects are also disabled.
   20   *
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:90-96
   90       *
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];
   96  


========== ITEM uo-c-model-03 ==========
Question (registered, verbatim):
{
 "question": "Which table does the Webhook package's WebhookLog model persist to, and which migration files define or alter it?",
 "probe": "WebhookLog"
}

Candidate files (5):

* packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120200_seed_default_webhook.php
--- packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120200_seed_default_webhook.php: no probe token in the file

* packages/Webkul/Webhook/src/Models/WebhookLog.php
--- packages/Webkul/Webhook/src/Models/WebhookLog.php:15-21
   15      'http_code',
   16      'extra',
   17  ])]
   18  #[Table(name: 'webhook_logs')]
   19  class WebhookLog extends Model
   20  {
   21      protected function casts(): array
--- packages/Webkul/Webhook/src/Models/WebhookLog.php:16-22
   16      'extra',
   17  ])]
   18  #[Table(name: 'webhook_logs')]
   19  class WebhookLog extends Model
   20  {
   21      protected function casts(): array
   22      {

* packages/Webkul/Webhook/src/Database/Migrations/2026_05_12_120000_make_user_nullable_on_webhook_logs.php
--- packages/Webkul/Webhook/src/Database/Migrations/2026_05_12_120000_make_user_nullable_on_webhook_logs.php:8-14
    8  {
    9      public function up(): void
   10      {
   11          Schema::table('webhook_logs', function (Blueprint $table): void {
   12              $table->string('user')->nullable()->change();
   13          });
   14      }

* packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120100_add_webhook_columns_to_webhook_logs.php
--- packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120100_add_webhook_columns_to_webhook_logs.php:9-15
    9  {
   10      public function up(): void
   11      {
   12          Schema::table('webhook_logs', function (Blueprint $table): void {
   13              $table->unsignedBigInteger('webhook_id')->nullable()->after('id');
   14              $table->string('event')->nullable()->after('sku');
   15              $table->unsignedSmallInteger('http_code')->nullable()->after('status');

* packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_101519_webhook_logs.php
--- packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_101519_webhook_logs.php:8-14
    8  {
    9      public function up(): void
   10      {
   11          Schema::create('webhook_logs', function (Blueprint $table): void {
   12              $table->id();
   13              $table->string('sku');
   14              $table->string('user');


========== ITEM uo-e-x-02 ==========
Question (registered, verbatim):
{
 "question": "If generateCode changes, which Blade templates must be re-read (via the v-code-generator directive or the $generateCode global)?",
 "probe": "generateCode"
}

Candidate files (13):

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php:51-57
   51                                      type="text"
   52                                      name="{{ $currentLocaleCode }}[name]"
   53                                      rules="required"
   54                                      v-code-generator="'code'"
   55                                      :label="trans('passport::app.templates.create.name')"
   56                                      :placeholder="trans('passport::app.templates.create.name-placeholder')"
   57                                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php: no probe token in the file

* packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php
--- packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php:361-367
  361                                      type="text"
  362                                      name="{{ $currentLocaleCode }}"
  363                                      rules="required"
  364                                      v-code-generator="'code'"
  365                                      :label="trans('admin::app.catalog.category_fields.index.datagrid.name')"
  366                                      :placeholder="trans('admin::app.catalog.category_fields.index.datagrid.name')"
  367                                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php:353-359
  353                              <x-admin::form.control-group.control
  354                                  type="text"
  355                                  name="draft_section_name"
  356                                  v-code-generator="'draft_section_code'"
  357                                  ::key="'section-new-' + draftSection.uid"
  358                                  :label="trans('passport::app.templates.builder.section-name')"
  359                                  :placeholder="trans('passport::app.templates.builder.section-name')"
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php:437-443
  437                                  <x-admin::form.control-group.control
  438                                      type="text"
  439                                      name="draft_field_name"
  440                                      v-code-generator="'draft_field_code_new'"
  441                                      ::key="'field-new-' + draftField.uid"
  442                                      :label="trans('passport::app.templates.builder.field-label')"
  443                                      :placeholder="trans('passport::app.templates.builder.field-label')"

* packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php:66-72
   66                                          type="text"
   67                                          name="{{ $currentLocaleCode }}[name]"
   68                                          rules="required"
   69                                          v-code-generator="'code'"
   70                                          :label="trans('admin::app.catalog.families.index.create.name')"
   71                                          :placeholder="trans('admin::app.catalog.families.index.create.enter-name')"
   72                                      />

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php:681-687
  681                                                  type="text"
  682                                                  name="locales.{{ $locale->code }}"
  683                                                  :label="$locale->name"
  684                                                  :v-code-generator="$locale->code === core()->getRequestedLocaleCode() ? '\'code\'' : null"
  685                                              />
  686  
  687                                              <x-admin::form.control-group.error control-name="locales.{{ $locale->code }}" />

* packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php
--- packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php:72-78
   72                          type="text"
   73                          name="{{ $currentLocaleCode }}[name]"
   74                          rules="{{ $nameRequired ? 'required' : '' }}"
   75                          v-code-generator="'code'"
   76                          :label="$nameLabel"
   77                          :placeholder="$namePlaceholder ?: $nameLabel"
   78                      />

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php (line 5)
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php (line 5): no probe token in the file

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php: no probe token in the file

* packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php: no probe token in the file

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php:657-663
  657                                                  type="text"
  658                                                  name="locales.{{ $locale->code }}"
  659                                                  :label="$locale->name"
  660                                                  :v-code-generator="$locale->code === core()->getRequestedLocaleCode() ? '\'code\'' : null"
  661                                              />
  662  
  663                                              <x-admin::form.control-group.error control-name="locales.{{ $locale->code }}" />

* packages/Webkul/Admin/src/Resources/views/components/form/control-group/control.blade.php
--- packages/Webkul/Admin/src/Resources/views/components/form/control-group/control.blade.php: no probe token in the file

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php:64-70
   64                                  <x-admin::form.control-group.control
   65                                      type="text"
   66                                      name="{{ $currentLocaleCode }}[name]"
   67                                      v-code-generator="'code'"
   68                                      :label="trans('admin::app.catalog.association_types.create.name')"
   69                                      :placeholder="trans('admin::app.catalog.association_types.create.enter-name')"
   70                                  />


========== ITEM uo-e-x-01 ==========
Question (registered, verbatim):
{
 "question": "If sanitizeCode changes, which Blade templates must be re-read (via the v-code directive or the $sanitizeCode global)?",
 "probe": "sanitizeCode"
}

Candidate files (17):

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php:369-375
  369                              <x-admin::form.control-group.control
  370                                  type="text"
  371                                  name="draft_section_code"
  372                                  v-code
  373                                  ::key="'section-new-code-' + draftSection.uid"
  374                                  :label="trans('passport::app.templates.builder.code')"
  375                                  :placeholder="trans('passport::app.templates.builder.code')"
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php:453-459
  453                                  <x-admin::form.control-group.control
  454                                      type="text"
  455                                      name="draft_field_code_new"
  456                                      v-code
  457                                      ::key="'field-new-code-' + draftField.uid"
  458                                      :label="trans('passport::app.templates.builder.code')"
  459                                      :placeholder="trans('passport::app.templates.builder.code')"

* packages/Webkul/Admin/src/Resources/assets/js/utils/code.js
--- packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:1-4
    1  export function sanitizeCode(value) {
    2      value = value
    3          .toString()
    4          .replace(/[^\w_ ]+/g, '')
--- packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:9-15
    9  }
   10  
   11  export function generateCode(value) {
   12      return sanitizeCode(
   13          value
   14              .toString()
   15              .trim()

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/create.blade.php:73-79
   73                                              name="slug"
   74                                              v-bind="field"
   75                                              placeholder="{{ trans('admin::app.catalog.category_fields.create.code') }}"
   76                                              v-code
   77                                          >
   78                                      </v-field>
   79  
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/create.blade.php:565-571
  565                                          :label="trans('admin::app.catalog.category_fields.create.code')"
  566                                          :placeholder="trans('admin::app.catalog.category_fields.create.code')"
  567                                          ::disabled="true !== optionIsNew"
  568                                          v-code
  569                                      />
  570  
  571                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php:638-644
  638                                          :placeholder="trans('admin::app.catalog.category_fields.edit.code')"
  639                                          ::disabled="true !== optionIsNew"
  640                                          ref="inputAdmin"
  641                                          v-code
  642                                      />
  643  
  644                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php:57-63
   57                              name="code"
   58                              rules="required"
   59                              :value="old('code')"
   60                              v-code
   61                          />
   62  
   63                          <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php:83-89
   83                                          type="text"
   84                                          name="code"
   85                                          rules="required"
   86                                          v-code
   87                                          :label="trans('admin::app.catalog.families.index.create.code')"
   88                                          :placeholder="trans('admin::app.catalog.families.index.create.enter-code')"
   89                                      />

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php:702-708
  702                                          :placeholder="trans('admin::app.catalog.attributes.edit.code')"
  703                                          ref="inputAdmin"
  704                                          ::disabled="true !== optionIsNew"
  705                                          v-code
  706                                      />
  707  
  708                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php
--- packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php:382-388
  382                                          rules="required"
  383                                          :label="trans('admin::app.catalog.category_fields.create.code')"
  384                                          :placeholder="trans('admin::app.catalog.category_fields.create.code')"
  385                                          v-code
  386                                      />
  387  
  388                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/assets/js/directives/code.js
--- packages/Webkul/Admin/src/Resources/assets/js/directives/code.js:1-4
    1  import { sanitizeCode } from '../utils/code';
    2  
    3  export default {
    4      mounted(el, binding, vnode) {
--- packages/Webkul/Admin/src/Resources/assets/js/directives/code.js:4-10
    4      mounted(el, binding, vnode) {
    5          let handler = function (e) {
    6              setTimeout(function () {
    7                  e.target.value = sanitizeCode(e.target.value);
    8              }, 100);
    9          }
   10  

* packages/Webkul/Admin/src/Resources/views/catalog/categories/partials/form.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/partials/form.blade.php:29-35
   29                      :class="$isEdit ? 'cursor-not-allowed' : ''"
   30                      :disabled="$isEdit && (bool) $category->code"
   31                      :value="$isEdit ? $category->code : old('code')"
   32                      v-code
   33                  />
   34  
   35                  <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php:68-74
   68                                      type="text"
   69                                      name="code"
   70                                      rules="required"
   71                                      v-code
   72                                      :label="trans('passport::app.templates.create.code')"
   73                                      :placeholder="trans('passport::app.templates.create.code-placeholder')"
   74                                  />

* packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php
--- packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php:97-103
   97                      type="text"
   98                      name="code"
   99                      rules="required"
  100                      v-code
  101                      :label="$codeLabel"
  102                      :placeholder="$codePlaceholder ?: $codeLabel"
  103                  />

* packages/Webkul/Admin/src/Resources/views/catalog/attributegroups/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/attributegroups/create.blade.php:70-76
   70                                          name="slug"
   71                                          v-bind="field"
   72                                          placeholder="{{ trans('admin::app.catalog.attribute-groups.create.code') }}"
   73                                          v-code
   74                                      >
   75                                  </v-field>
   76  

* packages/Webkul/Admin/src/Resources/assets/js/app.js
--- packages/Webkul/Admin/src/Resources/assets/js/app.js:242-248
  242  import CodeGenerator from "./directives/code-generator";
  243  import Focus from "./directives/focus";
  244  import NoValueAttr from "./directives/no-value-attr";
  245  import { generateCode, sanitizeCode } from "./utils/code";
  246  
  247  /**
  248   * Ajax navigation (progressive enhancement).
--- packages/Webkul/Admin/src/Resources/assets/js/app.js:297-303
  297      app.directive("no-value-attr", NoValueAttr);
  298  
  299      app.config.globalProperties.$generateCode = generateCode;
  300      app.config.globalProperties.$sanitizeCode = sanitizeCode;
  301  
  302      /**
  303       * Canonical post-action navigation helper, available on every component as

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php:70-76
   70                                          name="slug"
   71                                          v-bind="field"
   72                                          placeholder="{{ trans('admin::app.catalog.attributes.create.code') }}"
   73                                          v-code
   74                                      >
   75                                  </v-field>
   76  

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php:81-87
   81                                      type="text"
   82                                      name="code"
   83                                      rules="required"
   84                                      v-code
   85                                      :label="trans('admin::app.catalog.association_types.create.code')"
   86                                      :placeholder="trans('admin::app.catalog.association_types.create.enter-code')"
   87                                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php: no probe token in the file


========== ITEM uo-c-route-01 ==========
Question (registered, verbatim):
{
 "question": "Through which files does POST /api/v1/rest/products reach the Product model?",
 "probe": "POST /api/v1/rest/products",
 "probe_to": "Product"
}

Candidate files (20):

* packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php
--- packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:118-124
  118      public function register()
  119      {
  120          $this->registerCommands();
  121          $this->registerApiRoutes();
  122          $this->registerConfig();
  123      }
  124  
--- packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:147-153
  147       */
  148      protected function registerRateLimiter(): void
  149      {
  150          RateLimiter::for('rest-api', function (Request $request) {
  151              return Limit::perMinute((int) config('api.rate_limit', 120))
  152                  ->by($request->user()?->getAuthIdentifier() ?: $request->ip());
  153          });
--- packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:181-187
  181       */
  182      protected function registerApiRoutes()
  183      {
  184          Route::prefix('api')
  185              ->middleware('api')
  186              ->group(__DIR__.'/../Routes/admin-api.php');
  187  

* bootstrap/providers.php
--- bootstrap/providers.php:19-25
   19  use Webkul\MagicAI\Providers\MagicAIServiceProvider;
   20  use Webkul\Measurement\Providers\MeasurementServiceProvider;
   21  use Webkul\Notification\Providers\NotificationServiceProvider;
   22  use Webkul\Product\Providers\ProductServiceProvider;
   23  use Webkul\ProductPassport\Providers\ProductPassportServiceProvider;
   24  use Webkul\Publication\Providers\PublicationServiceProvider;
   25  use Webkul\Resource\Providers\ResourceServiceProvider;
--- bootstrap/providers.php:30-36
   30  return [
   31      EnvValidatorServiceProvider::class,
   32      AppServiceProvider::class,
   33      AdminApiServiceProvider::class,
   34      AdminServiceProvider::class,
   35      AttributeServiceProvider::class,
   36      CategoryServiceProvider::class,

* packages/Webkul/Product/src/Type/AbstractType.php
--- packages/Webkul/Product/src/Type/AbstractType.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  use Illuminate\Database\Eloquent\Collection as EloquentCollection;
    6  use Illuminate\Http\UploadedFile;
--- packages/Webkul/Product/src/Type/AbstractType.php:14-20
   14  use Webkul\Attribute\Rules\AttributeTypes;
   15  use Webkul\Core\Filesystem\FileStorer;
   16  use Webkul\Core\Traits\HtmlPurifier;
   17  use Webkul\Product\Contracts\Product;
   18  use Webkul\Product\Repositories\AssociationTypeRepository;
   19  use Webkul\Product\Repositories\ProductAssociationRepository;
   20  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Product/src/Type/AbstractType.php:15-21
   15  use Webkul\Core\Filesystem\FileStorer;
   16  use Webkul\Core\Traits\HtmlPurifier;
   17  use Webkul\Product\Contracts\Product;
   18  use Webkul\Product\Repositories\AssociationTypeRepository;
   19  use Webkul\Product\Repositories\ProductAssociationRepository;
   20  use Webkul\Product\Repositories\ProductRepository;
   21  use Webkul\Product\Validator\AssociationValidator;
--- packages/Webkul/Product/src/Type/AbstractType.php:106-112
  106       *
  107       * @return Product
  108       */
  109      public function create(array $data)
  110      {
  111          $product = $this->productRepository->getModel()->fill($data);
  112  

* packages/Webkul/Product/src/Type/Simple.php
--- packages/Webkul/Product/src/Type/Simple.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  class Simple extends AbstractType {}
    6  
--- packages/Webkul/Product/src/Type/Simple.php:2-6
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  class Simple extends AbstractType {}
    6  

* packages/Webkul/Core/src/Eloquent/Repository.php
--- packages/Webkul/Core/src/Eloquent/Repository.php: no probe token in the file

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:14-20
   14  use Webkul\Attribute\Models\AttributeFamily;
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:15-21
   15  use Webkul\Attribute\Repositories\AttributeFamilyRepository;
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:16-22
   16  use Webkul\Attribute\Repositories\AttributeRepository;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Facades\ValueSetter;
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:32-38
   32       * @return void
   33       */
   34      public function __construct(
   35          protected ProductRepository $productRepository,
   36          protected ProductValuesValidator $valuesValidator,
   37          protected AttributeFamilyRepository $attributeFamilyRepository,
   38          protected AttributeRepository $attributeRepository,
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:123-129
  123       * @param  Product  $product  The product to be updated.
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
  129  

* packages/Webkul/Product/src/Type/VariantGroup.php
--- packages/Webkul/Product/src/Type/VariantGroup.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  /**
    6   * Internal middle node in a 2-level variant tree

* packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:124-130
  124      });
  125  
  126      /** Products API Routes */
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:125-131
  125  
  126      /** Products API Routes */
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:126-132
  126      /** Products API Routes */
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:127-133
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');

* packages/Webkul/AdminApi/src/Http/Requests/Catalog/StoreSimpleProductRequest.php
--- packages/Webkul/AdminApi/src/Http/Requests/Catalog/StoreSimpleProductRequest.php:21-27
   21              'family'            => ['required', 'string'],
   22              'additional'        => ['nullable', 'array'],
   23              'values'            => ['required', 'array'],
   24              'values.common.sku' => ['required', 'unique:products,sku'],
   25              'variant'           => ['nullable', 'array'],
   26              'associations'      => ['nullable', 'array'],
   27          ];

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:10-16
   10  use Webkul\AdminApi\Http\Requests\Catalog\PartialUpdateSimpleProductRequest;
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;
   15  
   16  class SimpleProductController extends ProductController
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:11-17
   11  use Webkul\AdminApi\Http\Requests\Catalog\StoreSimpleProductRequest;
   12  use Webkul\AdminApi\Http\Requests\Catalog\UpdateSimpleProductRequest;
   13  use Webkul\Product\Enums\ProductType;
   14  use Webkul\Product\Type\AbstractType;
   15  
   16  class SimpleProductController extends ProductController
   17  {
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:55-61
   55  
   56              return response()->json([
   57                  'success' => true,
   58                  'message' => trans('admin::app.catalog.products.delete-success'),
   59                  'sku'     => $product['sku'],
   60              ], JsonResponse::HTTP_OK);
   61  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:67-73
   67      /**
   68       * Store a newly created resource in storage.
   69       */
   70      public function store(StoreSimpleProductRequest $request): JsonResponse
   71      {
   72          $data = $request->only([
   73              'status',
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:108-114
  108  
  109              if (! $product) {
  110                  Event::dispatch('catalog.product.create.before');
  111                  $product = $this->productRepository->create($data);
  112                  Event::dispatch('catalog.product.create.after', $product);
  113              }
  114  

* packages/Webkul/Product/src/Type/Configurable.php
--- packages/Webkul/Product/src/Type/Configurable.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  use Illuminate\Support\Collection;
    6  use Illuminate\Support\Facades\Event;
--- packages/Webkul/Product/src/Type/Configurable.php:6-12
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Type/Configurable.php:7-13
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
   13  use Webkul\Product\Models\VariantStructure;

* config/concord.php
--- config/concord.php:21-27
   21          Webkul\DataTransfer\Providers\ModuleServiceProvider::class,
   22          Webkul\HistoryControl\Providers\ModuleServiceProvider::class,
   23          Webkul\Notification\Providers\ModuleServiceProvider::class,
   24          Webkul\Product\Providers\ModuleServiceProvider::class,
   25          Webkul\User\Providers\ModuleServiceProvider::class,
   26          Webkul\MagicAI\Providers\ModuleServiceProvider::class,
   27          Webkul\AiAgent\Providers\ModuleServiceProvider::class,

* packages/Webkul/Product/src/Config/product_types.php
--- packages/Webkul/Product/src/Config/product_types.php:1-6
    1  <?php
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
--- packages/Webkul/Product/src/Config/product_types.php:1-7
    1  <?php
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
    7  
--- packages/Webkul/Product/src/Config/product_types.php:2-8
    2  
    3  use Webkul\Product\Enums\ProductType;
    4  use Webkul\Product\Type\Configurable;
    5  use Webkul\Product\Type\Simple;
    6  use Webkul\Product\Type\VariantGroup;
    7  
    8  return [
--- packages/Webkul/Product/src/Config/product_types.php:6-12
    6  use Webkul\Product\Type\VariantGroup;
    7  
    8  return [
    9      ProductType::Simple->value       => [
   10          'key'   => ProductType::Simple->value,
   11          'name'  => 'product::app.type.simple',
   12          'class' => Simple::class,

* packages/Webkul/Product/src/Models/ProductProxy.php
--- packages/Webkul/Product/src/Models/ProductProxy.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Models;
    4  
    5  use Konekt\Concord\Proxies\ModelProxy;
    6  

* packages/Webkul/Product/src/Repositories/ProductRepository.php
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Repositories;
    4  
    5  use Illuminate\Container\Container;
    6  use Illuminate\Database\Eloquent\ModelNotFoundException;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:10-16
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:11-17
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:30-36
   30      /**
   31       * Specify model class name.
   32       */
   33      public function model(): string
   34      {
   35          return Product::class;
   36      }
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:40-46
   40       *
   41       * @return Product
   42       */
   43      public function create(array $data)
   44      {
   45          $typeInstance = resolve(config('product_types.'.$data['type'].'.class'));
   46  

* packages/Webkul/AdminApi/src/Routes/admin-api.php
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:3-9
    3  use Illuminate\Support\Facades\Route;
    4  
    5  Route::group([
    6      'prefix'     => 'v1/rest',
    7      'middleware' => [
    8          'accept.json',
    9          'auth:api',
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:7-13
    7      'middleware' => [
    8          'accept.json',
    9          'auth:api',
   10          'throttle:rest-api',
   11          'api.scope',
   12          'request.locale',
   13          'cache.headers:private;etag',
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:21-27
   21      /**
   22       * Catalog API
   23       */
   24      require 'V1/catalog-routes.php';
   25  
   26      /**
   27       * Product Passport API
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:24-30
   24      require 'V1/catalog-routes.php';
   25  
   26      /**
   27       * Product Passport API
   28       */
   29      require 'V1/passport-routes.php';
   30  

* packages/Webkul/Product/src/Providers/ModuleServiceProvider.php
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Providers;
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:3-9
    3  namespace Webkul\Product\Providers;
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
    7  use Webkul\Product\Models\AssociationTypeField;
    8  use Webkul\Product\Models\AssociationTypeFieldOption;
    9  use Webkul\Product\Models\AssociationTypeFieldOptionTranslation;
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:4-10
    4  
    5  use Webkul\Core\Providers\CoreModuleServiceProvider;
    6  use Webkul\Product\Models\AssociationType;
    7  use Webkul\Product\Models\AssociationTypeField;
    8  use Webkul\Product\Models\AssociationTypeFieldOption;
    9  use Webkul\Product\Models\AssociationTypeFieldOptionTranslation;
   10  use Webkul\Product\Models\AssociationTypeFieldTranslation;
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:18-24
   18  {
   19      protected $models = [
   20          Product::class,
   21          AssociationType::class,
   22          AssociationTypeTranslation::class,
   23          AssociationTypeField::class,
   24          AssociationTypeFieldTranslation::class,

* packages/Webkul/Product/src/Contracts/Product.php
--- packages/Webkul/Product/src/Contracts/Product.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Contracts;
    4  
    5  interface Product {}
    6  
--- packages/Webkul/Product/src/Contracts/Product.php:2-6
    2  
    3  namespace Webkul\Product\Contracts;
    4  
    5  interface Product {}
    6  

* packages/Webkul/Product/src/Providers/ProductServiceProvider.php
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Providers;
    4  
    5  use Illuminate\Foundation\AliasLoader;
    6  use Illuminate\Support\ServiceProvider;
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:4-10
    4  
    5  use Illuminate\Foundation\AliasLoader;
    6  use Illuminate\Support\ServiceProvider;
    7  use Webkul\Product\Console\ResyncVariantsCommand;
    8  use Webkul\Product\Console\StripRedundantVariantValuesCommand;
    9  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   10  use Webkul\Product\Contracts\VariantValueResolver as VariantValueResolverContract;
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:5-11
    5  use Illuminate\Foundation\AliasLoader;
    6  use Illuminate\Support\ServiceProvider;
    7  use Webkul\Product\Console\ResyncVariantsCommand;
    8  use Webkul\Product\Console\StripRedundantVariantValuesCommand;
    9  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   10  use Webkul\Product\Contracts\VariantValueResolver as VariantValueResolverContract;
   11  use Webkul\Product\Facades\ProductImage as ProductImageFacade;

* packages/Webkul/Product/src/Models/Product.php
--- packages/Webkul/Product/src/Models/Product.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Models;
    4  
    5  use Exception;
    6  use Illuminate\Database\Eloquent\Attributes\Fillable;
--- packages/Webkul/Product/src/Models/Product.php:23-29
   23  use Webkul\HistoryControl\Interfaces\PresentableHistoryInterface;
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
--- packages/Webkul/Product/src/Models/Product.php:24-30
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
   30  use Webkul\Product\Database\Factories\ProductFactory;
--- packages/Webkul/Product/src/Models/Product.php:39-45
   39      'status',
   40      'variant_structure_id',
   41  ])]
   42  class Product extends Model implements HistoryAuditable, PresentableHistoryInterface, ProductContract
   43  {
   44      use HasFactory, Visitable;
   45      use HistoryTrait;