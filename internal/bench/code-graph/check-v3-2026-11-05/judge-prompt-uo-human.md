You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository; the source lines below were extracted mechanically from the subject at its registered pin, with line numbers. A reader with repository access proposed an answer set; a static reference engine (the oracle) listed files where it could. Neither is authoritative.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question) or `OUT`, and give a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Answer the question as worded. Do not reward or penalise a file for who proposed it.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `unopim` at its registered pin.



========== ITEM uo-c-route-01 ==========
Question (registered, verbatim):
{
 "id": "uo-c-route-01",
 "suite": "C",
 "class": "route-trace",
 "subject": "unopim",
 "language": "php",
 "question": "Through which files does POST /api/v1/rest/products reach the Product model?",
 "probe": "POST /api/v1/rest/products",
 "probe_to": "Product",
 "hop_stratum": ">=3",
 "basis": [
  "packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:184-186 -- 'api' prefix, loads Routes/admin-api.php",
  "packages/Webkul/AdminApi/src/Routes/admin-api.php:5-6,24 -- 'v1/rest' prefix, require 'V1/catalog-routes.php'",
  "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:127,130 -- SimpleProductController::store",
  "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:70,111 -- productRepository->create",
  "packages/Webkul/Product/src/Repositories/ProductRepository.php:43-47 -- resolves the type class, calls its create()",
  "packages/Webkul/Product/src/Type/AbstractType.php:109 -- create()"
 ],
 "note": "Route declared outside routes/, three prefix layers deep, behind a `require`; the repository's model() returns a contract, not the class."
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Core chain (basis): provider, admin-api.php, V1/catalog-routes.php, SimpleProductController, ProductRepository, AbstractType, Models/Product = 7 files. The 13-file set adds the indirection hops a strict file-level trace needs (parent controller, product_types config, Simple, contract, concord ModuleServiceProvider, bootstrap/providers.php). Graders can treat the last group as tolerated extras.
Reader on the oracle's open list: Oracle produced nothing (human-required). Followed route prefixes api -> v1/rest -> products through the provider, admin-api.php require, and catalog-routes.php; followed config('product_types.simple.class') to Type\Simple and the Contracts\Product binding via concord ModuleServiceProvider to Models\Product.

Candidate files (20):

* bootstrap/providers.php  {"proposed_by_reader": true, "reader_reason": "registers AdminApiServiceProvider (entry point that makes the route exist)"}
--- bootstrap/providers.php:30-36
   30  return [
   31      EnvValidatorServiceProvider::class,
   32      AppServiceProvider::class,
   33      AdminApiServiceProvider::class,
   34      AdminServiceProvider::class,
   35      AttributeServiceProvider::class,
   36      CategoryServiceProvider::class,

* packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php  {"proposed_by_reader": true, "reader_reason": "registerApiRoutes(): 'api' prefix + group(Routes/admin-api.php)"}
--- packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:118-124
  118      public function register()
  119      {
  120          $this->registerCommands();
  121          $this->registerApiRoutes();
  122          $this->registerConfig();
  123      }
  124  
--- packages/Webkul/AdminApi/src/Providers/AdminApiServiceProvider.php:181-187
  181       */
  182      protected function registerApiRoutes()
  183      {
  184          Route::prefix('api')
  185              ->middleware('api')
  186              ->group(__DIR__.'/../Routes/admin-api.php');
  187  

* packages/Webkul/AdminApi/src/Routes/admin-api.php  {"proposed_by_reader": true, "reader_reason": "'v1/rest' prefix group, require 'V1/catalog-routes.php'"}
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:3-9
    3  use Illuminate\Support\Facades\Route;
    4  
    5  Route::group([
    6      'prefix'     => 'v1/rest',
    7      'middleware' => [
    8          'accept.json',
    9          'auth:api',
--- packages/Webkul/AdminApi/src/Routes/admin-api.php:21-27
   21      /**
   22       * Catalog API
   23       */
   24      require 'V1/catalog-routes.php';
   25  
   26      /**
   27       * Product Passport API

* packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php  {"proposed_by_reader": true, "reader_reason": "prefix('products') + Route::post('', 'store') on SimpleProductController"}
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:124-130
  124      });
  125  
  126      /** Products API Routes */
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:127-133
  127      Route::controller(SimpleProductController::class)->prefix('products')->group(function () {
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php  {"proposed_by_reader": true, "reader_reason": "store() calls $this->productRepository->create($data) with type=simple"}
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

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php  {"proposed_by_reader": true, "reader_reason": "parent class: injects the ProductRepository used by store(); createOrUpdateVariant()/updateProduct() also called from store() on the same request"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:32-38
   32       * @return void
   33       */
   34      public function __construct(
   35          protected ProductRepository $productRepository,
   36          protected ProductValuesValidator $valuesValidator,
   37          protected AttributeFamilyRepository $attributeFamilyRepository,
   38          protected AttributeRepository $attributeRepository,
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:395-401
  395       * @param  array  $data  The input data containing variant and super attribute information.
  396       * @return Product The updated or created variant product.
  397       */
  398      protected function createOrUpdateVariant(array $data): mixed
  399      {
  400          $parentProduct = $this->findParentProductOr404($data['parent']);
  401  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:123-129
  123       * @param  Product  $product  The product to be updated.
  124       * @return Product The updated product model.
  125       */
  126      protected function updateProduct(array $data, Product $product): Product
  127      {
  128          $submittedCommon = $data[ProductAbstractType::PRODUCT_VALUES_KEY][ProductAbstractType::COMMON_VALUES_KEY] ?? [];
  129  

* packages/Webkul/Product/src/Repositories/ProductRepository.php  {"proposed_by_reader": true, "reader_reason": "create() resolves config('product_types.<type>.class') and calls its create(); model() returns Contracts\\Product"}
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

* packages/Webkul/Product/src/Config/product_types.php  {"proposed_by_reader": true, "reader_reason": "maps 'simple' to Type\\Simple (the config indirection the repository resolves)"}
--- packages/Webkul/Product/src/Config/product_types.php:6-12
    6  use Webkul\Product\Type\VariantGroup;
    7  
    8  return [
    9      ProductType::Simple->value       => [
   10          'key'   => ProductType::Simple->value,
   11          'name'  => 'product::app.type.simple',
   12          'class' => Simple::class,

* packages/Webkul/Product/src/Type/Simple.php  {"proposed_by_reader": true, "reader_reason": "resolved type class; empty subclass of AbstractType"}
--- packages/Webkul/Product/src/Type/Simple.php:2-6
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  class Simple extends AbstractType {}
    6  

* packages/Webkul/Product/src/Type/AbstractType.php  {"proposed_by_reader": true, "reader_reason": "create(): productRepository->getModel()->fill($data) ... $product->save()"}
--- packages/Webkul/Product/src/Type/AbstractType.php:106-112
  106       *
  107       * @return Product
  108       */
  109      public function create(array $data)
  110      {
  111          $product = $this->productRepository->getModel()->fill($data);
  112  

* packages/Webkul/Product/src/Contracts/Product.php  {"proposed_by_reader": true, "reader_reason": "contract returned by model(); bound to the concrete model by concord"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:10-16
   10  use Illuminate\Validation\ValidationException;
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;

* packages/Webkul/Product/src/Providers/ModuleServiceProvider.php  {"proposed_by_reader": true, "reader_reason": "concord model registration binding Contracts\\Product -> Models\\Product"}
--- packages/Webkul/Product/src/Providers/ModuleServiceProvider.php:18-24
   18  {
   19      protected $models = [
   20          Product::class,
   21          AssociationType::class,
   22          AssociationTypeTranslation::class,
   23          AssociationTypeField::class,
   24          AssociationTypeFieldTranslation::class,
--- config/concord.php:21-27
   21          Webkul\DataTransfer\Providers\ModuleServiceProvider::class,
   22          Webkul\HistoryControl\Providers\ModuleServiceProvider::class,
   23          Webkul\Notification\Providers\ModuleServiceProvider::class,
   24          Webkul\Product\Providers\ModuleServiceProvider::class,
   25          Webkul\User\Providers\ModuleServiceProvider::class,
   26          Webkul\MagicAI\Providers\ModuleServiceProvider::class,
   27          Webkul\AiAgent\Providers\ModuleServiceProvider::class,

* packages/Webkul/Product/src/Models/Product.php  {"proposed_by_reader": true, "reader_reason": "target: Product model implements ProductContract"}
--- packages/Webkul/Product/src/Models/Product.php:39-45
   39      'status',
   40      'variant_structure_id',
   41  ])]
   42  class Product extends Model implements HistoryAuditable, PresentableHistoryInterface, ProductContract
   43  {
   44      use HasFactory, Visitable;
   45      use HistoryTrait;

* packages/Webkul/Product/src/Providers/ProductServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "mergeConfigFrom product_types (line 106) is config plumbing, not on the request path; include only under a very broad reading"}
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

* config/concord.php  {"proposed_by_reader": false, "reader_excluded_because": "lists ModuleServiceProvider; boot-time registration, borderline like bootstrap/providers.php"}
--- config/concord.php:21-27
   21          Webkul\DataTransfer\Providers\ModuleServiceProvider::class,
   22          Webkul\HistoryControl\Providers\ModuleServiceProvider::class,
   23          Webkul\Notification\Providers\ModuleServiceProvider::class,
   24          Webkul\Product\Providers\ModuleServiceProvider::class,
   25          Webkul\User\Providers\ModuleServiceProvider::class,
   26          Webkul\MagicAI\Providers\ModuleServiceProvider::class,
   27          Webkul\AiAgent\Providers\ModuleServiceProvider::class,
--- config/concord.php:27-33
   27          Webkul\AiAgent\Providers\ModuleServiceProvider::class,
   28          Webkul\Resource\Providers\ModuleServiceProvider::class,
   29          Webkul\Publication\Providers\ModuleServiceProvider::class,
   30          Webkul\ProductPassport\Providers\ModuleServiceProvider::class,
   31          Webkul\Measurement\Providers\ModuleServiceProvider::class,
   32      ],
   33  ];

* packages/Webkul/Product/src/Models/ProductProxy.php  {"proposed_by_reader": false, "reader_excluded_because": "proxy class, not used on this path"}
--- packages/Webkul/Product/src/Models/ProductProxy.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Models;
    4  
    5  use Konekt\Concord\Proxies\ModelProxy;
    6  
--- packages/Webkul/Product/src/Models/ProductProxy.php:4-8
    4  
    5  use Konekt\Concord\Proxies\ModelProxy;
    6  
    7  class ProductProxy extends ModelProxy {}
    8  

* packages/Webkul/Product/src/Type/Configurable.php  {"proposed_by_reader": false, "reader_excluded_because": "store() sets type=simple; Configurable only reached via configurable-products routes"}
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

* packages/Webkul/Product/src/Type/VariantGroup.php  {"proposed_by_reader": false, "reader_excluded_because": "internal type; not resolved for type=simple"}
--- packages/Webkul/Product/src/Type/VariantGroup.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  /**
    6   * Internal middle node in a 2-level variant tree

* packages/Webkul/Core/src/Eloquent/Repository.php  {"proposed_by_reader": false, "reader_excluded_because": "base repository providing getModel()/makeModel(); generic framework plumbing, borderline"}
--- packages/Webkul/Core/src/Eloquent/Repository.php: none of ['rest', 'products', 'Product'] appears in the file

* packages/Webkul/AdminApi/src/Http/Requests/Catalog/StoreSimpleProductRequest.php  {"proposed_by_reader": false, "reader_excluded_because": "validation FormRequest, does not reach the model"}
--- packages/Webkul/AdminApi/src/Http/Requests/Catalog/StoreSimpleProductRequest.php:4-10
    4  
    5  use Webkul\AdminApi\Http\Requests\ApiFormRequest;
    6  
    7  class StoreSimpleProductRequest extends ApiFormRequest
    8  {
    9      /**
   10       * Get the validation rules that apply to the request.
--- packages/Webkul/AdminApi/src/Http/Requests/Catalog/StoreSimpleProductRequest.php:21-27
   21              'family'            => ['required', 'string'],
   22              'additional'        => ['nullable', 'array'],
   23              'values'            => ['required', 'array'],
   24              'values.common.sku' => ['required', 'unique:products,sku'],
   25              'variant'           => ['nullable', 'array'],
   26              'associations'      => ['nullable', 'array'],
   27          ];


========== ITEM uo-c-route-02 ==========
Question (registered, verbatim):
{
 "id": "uo-c-route-02",
 "suite": "C",
 "class": "route-trace",
 "subject": "unopim",
 "language": "php",
 "question": "Through which files does the route named admin.catalog.products.copy reach the Product model?",
 "probe": "admin.catalog.products.copy",
 "probe_to": "Product",
 "hop_stratum": ">=3",
 "basis": [
  "packages/Webkul/Admin/src/Routes/catalog-routes.php:187,200 -- ProductController::copy",
  "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1362,1365 -- productRepository->copy($id)",
  "packages/Webkul/Product/src/Repositories/ProductRepository.php:161,171 -- getTypeInstance()->copy()",
  "packages/Webkul/Product/src/Models/Product.php:123 and packages/Webkul/Product/src/Type/AbstractType.php:578"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; The model is reached at ProductRepository:163-165 already; Product.php and AbstractType.php are both on the path per the basis. Answer set 7 files (provider+web.php are the route-registration hops the basis omits).
Reader on the oracle's open list: Followed AdminServiceProvider -> web.php require -> catalog-routes.php -> ProductController::copy -> ProductRepository::copy (findOrFail yields Product) -> Product::getTypeInstance -> AbstractType::copy.

Candidate files (13):

* packages/Webkul/Admin/src/Providers/AdminServiceProvider.php  {"proposed_by_reader": true, "reader_reason": "loads Routes/web.php"}
--- packages/Webkul/Admin/src/Providers/AdminServiceProvider.php:42-48
   42          // from the model lookup. Non-numeric identifiers use `code`/`slug` params.
   43          Route::middleware('web')
   44              ->where(['id' => '[0-9]+'])
   45              ->group(__DIR__.'/../Routes/web.php');
   46  
   47          $this->loadTranslationsFrom(__DIR__.'/../Resources/lang', 'admin');
   48  

* packages/Webkul/Admin/src/Routes/web.php  {"proposed_by_reader": true, "reader_reason": "require 'catalog-routes.php'"}
--- packages/Webkul/Admin/src/Routes/web.php:8-14
    8  /**
    9   * Catalog routes.
   10   */
   11  require 'catalog-routes.php';
   12  
   13  /**
   14   * Settings routes.

* packages/Webkul/Admin/src/Routes/catalog-routes.php  {"proposed_by_reader": true, "reader_reason": "Route::post('copy/{id}', 'copy')->name('admin.catalog.products.copy') on ProductController"}
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

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php  {"proposed_by_reader": true, "reader_reason": "copy(): $this->productRepository->copy($id)"}
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

* packages/Webkul/Product/src/Repositories/ProductRepository.php  {"proposed_by_reader": true, "reader_reason": "copy(): findOrFail($id) returns the Product model; then $product->getTypeInstance()->copy()"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:158-164
  158       * @param  int  $id
  159       * @return Product
  160       */
  161      public function copy($id)
  162      {
  163          $product = $this->with([
  164              'attribute_family',

* packages/Webkul/Product/src/Models/Product.php  {"proposed_by_reader": true, "reader_reason": "target; getTypeInstance() resolves product_types class"}
--- packages/Webkul/Product/src/Models/Product.php:120-126
  120       *
  121       * @throws Exception
  122       */
  123      public function getTypeInstance(): AbstractType
  124      {
  125          if ($this->typeInstance) {
  126              return $this->typeInstance;

* packages/Webkul/Product/src/Type/AbstractType.php  {"proposed_by_reader": true, "reader_reason": "copy(): $this->product->replicate() ... save()"}
--- packages/Webkul/Product/src/Type/AbstractType.php:575-581
  575       *
  576       * @throws \Exception
  577       */
  578      public function copy()
  579      {
  580          if (! $this->canBeCopied()) {
  581              throw new \Exception(trans('product::app.response.product-can-not-be-copied', ['type' => $this->product->type]));

* packages/Webkul/Product/src/Type/Configurable.php  {"proposed_by_reader": false, "reader_excluded_because": "overrides copyRelationships (line 494); reached only when the copied product is configurable \u2014 runtime-dependent, extra hop beyond the model"}
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

* packages/Webkul/Product/src/Type/Simple.php  {"proposed_by_reader": false, "reader_excluded_because": "possible runtime type class; empty subclass, not needed to reach Product"}
--- packages/Webkul/Product/src/Type/Simple.php:1-6
    1  <?php
    2  
    3  namespace Webkul\Product\Type;
    4  
    5  class Simple extends AbstractType {}
    6  

* packages/Webkul/Product/src/Config/product_types.php  {"proposed_by_reader": false, "reader_excluded_because": "config indirection after the model is already reached"}
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

* packages/Webkul/Product/src/Contracts/Product.php  {"proposed_by_reader": false, "reader_excluded_because": "findOrFail returns the model; contract binding is an alternative hop, borderline"}
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

* packages/Webkul/Product/src/Providers/ModuleServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "concord binding; borderline as in uo-c-route-01"}
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

* bootstrap/providers.php  {"proposed_by_reader": false, "reader_excluded_because": "registers AdminServiceProvider; boot plumbing"}
--- bootstrap/providers.php:19-25
   19  use Webkul\MagicAI\Providers\MagicAIServiceProvider;
   20  use Webkul\Measurement\Providers\MeasurementServiceProvider;
   21  use Webkul\Notification\Providers\NotificationServiceProvider;
   22  use Webkul\Product\Providers\ProductServiceProvider;
   23  use Webkul\ProductPassport\Providers\ProductPassportServiceProvider;
   24  use Webkul\Publication\Providers\PublicationServiceProvider;
   25  use Webkul\Resource\Providers\ResourceServiceProvider;
--- bootstrap/providers.php:20-26
   20  use Webkul\Measurement\Providers\MeasurementServiceProvider;
   21  use Webkul\Notification\Providers\NotificationServiceProvider;
   22  use Webkul\Product\Providers\ProductServiceProvider;
   23  use Webkul\ProductPassport\Providers\ProductPassportServiceProvider;
   24  use Webkul\Publication\Providers\PublicationServiceProvider;
   25  use Webkul\Resource\Providers\ResourceServiceProvider;
   26  use Webkul\Theme\Providers\ThemeServiceProvider;
--- bootstrap/providers.php:42-48
   42      InstallerServiceProvider::class,
   43      MagicAIServiceProvider::class,
   44      NotificationServiceProvider::class,
   45      ProductServiceProvider::class,
   46      ResourceServiceProvider::class,
   47      ThemeServiceProvider::class,
   48      UserServiceProvider::class,


========== ITEM uo-c-route-03 ==========
Question (registered, verbatim):
{
 "id": "uo-c-route-03",
 "suite": "C",
 "class": "route-trace",
 "subject": "unopim",
 "language": "php",
 "question": "Through which files does the route named webhook.test reach SafeWebhookUrl::httpOptions?",
 "probe": "webhook.test",
 "probe_to": "httpOptions",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php:19 -- loads Routes/web.php",
  "packages/Webkul/Webhook/src/Routes/web.php:16 -- WebhookController::test",
  "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:140,154 -- SafeWebhookUrl::httpOptions"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Answer set 4 files; whether the target file SafeWebhookUrl.php counts as a 'through' file depends on the grading convention (basis omits it).
Reader on the oracle's open list: Route registered by WebhookServiceProvider boot(); controller test() calls the static directly.

Candidate files (6):

* packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php  {"proposed_by_reader": true, "reader_reason": "Route::middleware('web')->group(Routes/web.php)"}
--- packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php:16-22
   16       */
   17      public function boot(): void
   18      {
   19          Route::middleware('web')->group(__DIR__.'/../Routes/web.php');
   20  
   21          $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
   22  

* packages/Webkul/Webhook/src/Routes/web.php  {"proposed_by_reader": true, "reader_reason": "Route::post('test', 'test')->name('webhook.test') on WebhookController"}
--- packages/Webkul/Webhook/src/Routes/web.php:13-19
   13              Route::put('edit/{id}', 'update')->name('webhook.update')->whereNumber('id');
   14              Route::delete('delete/{id}', 'destroy')->name('webhook.delete')->whereNumber('id');
   15              Route::post('mass-delete', 'massDestroy')->name('webhook.mass_delete');
   16              Route::post('test', 'test')->name('webhook.test');
   17          });
   18  
   19          Route::controller(WebhookLogsController::class)->prefix('logs')->group(function (): void {

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php  {"proposed_by_reader": true, "reader_reason": "test() calls SafeWebhookUrl::httpOptions($url)"}
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

* packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php  {"proposed_by_reader": true, "reader_reason": "target: public static function httpOptions"}
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:90-96
   90       *
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];
   96  

* packages/Webkul/Webhook/src/Services/WebhookService.php  {"proposed_by_reader": false, "reader_excluded_because": "also calls httpOptions (line 205) but is not reached from WebhookController::test"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);

* bootstrap/providers.php  {"proposed_by_reader": false, "reader_excluded_because": "registers WebhookServiceProvider (line 50); boot plumbing"}
--- bootstrap/providers.php: none of ['webhook.test', 'httpOptions'] appears in the file


========== ITEM uo-c-model-01 ==========
Question (registered, verbatim):
{
 "id": "uo-c-model-01",
 "suite": "C",
 "class": "model-table",
 "subject": "unopim",
 "language": "php",
 "question": "Which table does the Apikey model persist to, and which migration files define or alter it?",
 "probe": "Apikey",
 "hop_stratum": 1,
 "basis": [
  "packages/Webkul/AdminApi/src/Models/Apikey.php:25 -- explicit protected $table = 'api_keys' (convention would give a different name)",
  "packages/Webkul/AdminApi/src/Database/Migrations/2024_07_10_112208_api_keys.php:14 -- Schema::create('api_keys')"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Table: api_keys. If 'alter' is read to include data-modifying migrations, add the Measurement migration.
Reader on the oracle's open list: Table is api_keys (explicit $table; convention would give 'apikeys'). Grepped all packages and database/ for 'api_keys'.

Candidate files (5):

* packages/Webkul/AdminApi/src/Models/Apikey.php  {"proposed_by_reader": true, "reader_reason": "protected $table = 'api_keys'"}
--- packages/Webkul/AdminApi/src/Models/Apikey.php:22-28
   22       *
   23       * @var string
   24       */
   25      protected $table = 'api_keys';
   26  
   27      /** Tags for History */
   28      protected $historyTags = ['Apikey'];

* packages/Webkul/AdminApi/src/Database/Migrations/2024_07_10_112208_api_keys.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('api_keys') \u2014 the only schema-defining/altering migration"}
--- packages/Webkul/AdminApi/src/Database/Migrations/2024_07_10_112208_api_keys.php:11-17
   11       */
   12      public function up(): void
   13      {
   14          Schema::create('api_keys', function (Blueprint $table) {
   15              $table->increments('id');
   16              $table->string('name');
   17              $table->integer('admin_id')->unsigned();

* packages/Webkul/Measurement/src/Database/Migrations/2026_07_29_120000_add_api_measurement_unit_permissions.php  {"proposed_by_reader": false, "reader_excluded_because": "DB::table('api_keys') row updates (lines 53,69): data migration, not a schema alteration"}
--- packages/Webkul/Measurement/src/Database/Migrations/2026_07_29_120000_add_api_measurement_unit_permissions.php: none of ['Apikey'] appears in the file

* packages/Webkul/AdminApi/src/Database/Migrations/2026_07_20_100200_migrate_existing_api_keys_to_robots.php  {"proposed_by_reader": false, "reader_excluded_because": "name mentions api keys but does not reference the api_keys table literal"}
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

* packages/Webkul/AdminApi/src/Database/Migrations/2026_07_27_100100_drop_system_api_role.php  {"proposed_by_reader": false, "reader_excluded_because": "no api_keys reference"}
--- packages/Webkul/AdminApi/src/Database/Migrations/2026_07_27_100100_drop_system_api_role.php: none of ['Apikey'] appears in the file


========== ITEM uo-c-model-02 ==========
Question (registered, verbatim):
{
 "id": "uo-c-model-02",
 "suite": "C",
 "class": "model-table",
 "subject": "unopim",
 "language": "php",
 "question": "Which table does the VariantStructureAxis model persist to, and which migration files define or alter it?",
 "probe": "VariantStructureAxis",
 "hop_stratum": 1,
 "basis": [
  "packages/Webkul/Product/src/Models/VariantStructureAxis.php:18 -- no $table override; irregular plural (axis -> axes)",
  "packages/Webkul/Product/src/Database/Migrations/2026_07_11_000001_create_variant_structures_tables.php:23 -- Schema::create('variant_structure_axes') inside a multi-table migration"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Basis lists only the create migration; two later migrations alter the table. Table: variant_structure_axes.
Reader on the oracle's open list: Resolved the implicit table name via Laravel's inflector (axis -> axes); grepped all migrations for the table name.

Candidate files (7):

* packages/Webkul/Product/src/Models/VariantStructureAxis.php  {"proposed_by_reader": true, "reader_reason": "no $table / #[Table]; Laravel convention pluralizes axis->axes giving variant_structure_axes"}
--- packages/Webkul/Product/src/Models/VariantStructureAxis.php:15-21
   15      'position',
   16  ])]
   17  #[WithoutTimestamps]
   18  class VariantStructureAxis extends Model
   19  {
   20      public function attribute(): BelongsTo
   21      {

* packages/Webkul/Product/src/Database/Migrations/2026_07_11_000001_create_variant_structures_tables.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('variant_structure_axes')"}
--- packages/Webkul/Product/src/Database/Migrations/2026_07_11_000001_create_variant_structures_tables.php:20-26
   20              $table->foreign('attribute_family_id')->references('id')->on('attribute_families')->onDelete('cascade');
   21          });
   22  
   23          Schema::create('variant_structure_axes', function (Blueprint $table): void {
   24              $table->increments('id');
   25              $table->unsignedInteger('variant_structure_id');
   26              $table->unsignedInteger('attribute_id');

* packages/Webkul/Product/src/Database/Migrations/2026_07_14_210000_add_level_to_variant_structure_axes_table.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('variant_structure_axes') adds level column"}
--- packages/Webkul/Product/src/Database/Migrations/2026_07_14_210000_add_level_to_variant_structure_axes_table.php:12-18
   12              return;
   13          }
   14  
   15          Schema::table('variant_structure_axes', function (Blueprint $table): void {
   16              if (! Schema::hasColumn('variant_structure_axes', 'level')) {
   17                  $table->enum('level', ['level_1', 'level_2'])->default('level_1')->after('attribute_id');
   18              }

* packages/Webkul/Product/src/Database/Migrations/2026_07_15_124500_drop_legacy_variant_structure_axis_position_unique.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('variant_structure_axes') drops legacy unique index"}
--- packages/Webkul/Product/src/Database/Migrations/2026_07_15_124500_drop_legacy_variant_structure_axis_position_unique.php:23-29
   23          }
   24  
   25          if ($this->indexExists('variant_structure_axes', self::LEGACY_INDEX)) {
   26              Schema::table('variant_structure_axes', function (Blueprint $table): void {
   27                  $table->dropUnique(self::LEGACY_INDEX);
   28              });
   29          }

* packages/Webkul/Product/src/Database/Migrations/2026_07_20_000001_add_variant_structure_id_to_products_table.php  {"proposed_by_reader": false, "reader_excluded_because": "alters products, not variant_structure_axes"}
--- packages/Webkul/Product/src/Database/Migrations/2026_07_20_000001_add_variant_structure_id_to_products_table.php: none of ['VariantStructureAxis'] appears in the file

* packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php  {"proposed_by_reader": false, "reader_excluded_because": "seeder writing rows, not a migration"}
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php: none of ['VariantStructureAxis'] appears in the file

* packages/Webkul/Admin/src/DataGrids/Catalog/VariantStructureDataGrid.php  {"proposed_by_reader": false, "reader_excluded_because": "queries the table, not a migration"}
--- packages/Webkul/Admin/src/DataGrids/Catalog/VariantStructureDataGrid.php: none of ['VariantStructureAxis'] appears in the file


========== ITEM uo-c-model-03 ==========
Question (registered, verbatim):
{
 "id": "uo-c-model-03",
 "suite": "C",
 "class": "model-table",
 "subject": "unopim",
 "language": "php",
 "question": "Which table does the Webhook package's WebhookLog model persist to, and which migration files define or alter it?",
 "probe": "WebhookLog",
 "hop_stratum": 1,
 "basis": [
  "packages/Webkul/Webhook/src/Models/WebhookLog.php:19",
  "packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_101519_webhook_logs.php:11 -- Schema::create('webhook_logs')",
  "packages/Webkul/Webhook/src/Database/Migrations/2026_05_12_120000_make_user_nullable_on_webhook_logs.php and 2026_07_20_120100_add_webhook_columns_to_webhook_logs.php -- alter it"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Table: webhook_logs. If data migrations count as 'alter', add seed_default_webhook.php.
Reader on the oracle's open list: Only one WebhookLog model exists outside vendor; grepped all migrations for 'webhook_logs'.

Candidate files (5):

* packages/Webkul/Webhook/src/Models/WebhookLog.php  {"proposed_by_reader": true, "reader_reason": "#[Table(name: 'webhook_logs')] attribute (class at line 19)"}
--- packages/Webkul/Webhook/src/Models/WebhookLog.php:15-21
   15      'http_code',
   16      'extra',
   17  ])]
   18  #[Table(name: 'webhook_logs')]
   19  class WebhookLog extends Model
   20  {
   21      protected function casts(): array

* packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_101519_webhook_logs.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('webhook_logs')"}
--- packages/Webkul/Webhook/src/Database/Migrations/2025_09_20_101519_webhook_logs.php:8-14
    8  {
    9      public function up(): void
   10      {
   11          Schema::create('webhook_logs', function (Blueprint $table): void {
   12              $table->id();
   13              $table->string('sku');
   14              $table->string('user');

* packages/Webkul/Webhook/src/Database/Migrations/2026_05_12_120000_make_user_nullable_on_webhook_logs.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('webhook_logs') makes user nullable"}
--- packages/Webkul/Webhook/src/Database/Migrations/2026_05_12_120000_make_user_nullable_on_webhook_logs.php:8-14
    8  {
    9      public function up(): void
   10      {
   11          Schema::table('webhook_logs', function (Blueprint $table): void {
   12              $table->string('user')->nullable()->change();
   13          });
   14      }

* packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120100_add_webhook_columns_to_webhook_logs.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('webhook_logs') adds columns"}
--- packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120100_add_webhook_columns_to_webhook_logs.php:9-15
    9  {
   10      public function up(): void
   11      {
   12          Schema::table('webhook_logs', function (Blueprint $table): void {
   13              $table->unsignedBigInteger('webhook_id')->nullable()->after('id');
   14              $table->string('event')->nullable()->after('sku');
   15              $table->unsignedSmallInteger('http_code')->nullable()->after('status');

* packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120200_seed_default_webhook.php  {"proposed_by_reader": false, "reader_excluded_because": "DB::table('webhook_logs')->update(webhook_id) (lines 49,74): data backfill, not schema"}
--- packages/Webkul/Webhook/src/Database/Migrations/2026_07_20_120200_seed_default_webhook.php: none of ['WebhookLog'] appears in the file


========== ITEM uo-e-x-01 ==========
Question (registered, verbatim):
{
 "id": "uo-e-x-01",
 "suite": "E",
 "class": "change-impact-xplane",
 "subject": "unopim",
 "language": "js",
 "target_language": "blade",
 "question": "If sanitizeCode changes, which Blade templates must be re-read (via the v-code directive or the $sanitizeCode global)?",
 "probe": "sanitizeCode",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Admin/src/Resources/assets/js/directives/code.js:1 -- the v-code directive uses it; registered at app.js:294",
  "packages/Webkul/Admin/src/Resources/assets/js/app.js:300 -- exposed as the $sanitizeCode global",
  "Blade users of v-code, e.g. packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php and catalog/categories/create.blade.php"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; 13 files. $sanitizeCode global: no Blade users. Includes ProductPassport views (same admin Vue app).
Reader on the oracle's open list: Directive registered at app.js:294 as 'code'; grepped every *.blade.php under packages/ and resources/ for v-code not followed by '-' (excludes v-code-generator). $sanitizeCode has zero Blade/PHP users. Note utils/code.js:12 generateCode calls sanitizeCode, so v-code-generator / $generateCode users are transitively affected too; every v-code-generator Blade user is already in this set, so the transitive reading yields the same 13 files.

Candidate files (17):

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php:81-87
   81                                      type="text"
   82                                      name="code"
   83                                      rules="required"
   84                                      v-code
   85                                      :label="trans('admin::app.catalog.association_types.create.code')"
   86                                      :placeholder="trans('admin::app.catalog.association_types.create.enter-code')"
   87                                  />

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php:70-76
   70                                          name="slug"
   71                                          v-bind="field"
   72                                          placeholder="{{ trans('admin::app.catalog.attributes.create.code') }}"
   73                                          v-code
   74                                      >
   75                                  </v-field>
   76  

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php:702-708
  702                                          :placeholder="trans('admin::app.catalog.attributes.edit.code')"
  703                                          ref="inputAdmin"
  704                                          ::disabled="true !== optionIsNew"
  705                                          v-code
  706                                      />
  707  
  708                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php:57-63
   57                              name="code"
   58                              rules="required"
   59                              :value="old('code')"
   60                              v-code
   61                          />
   62  
   63                          <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/partials/form.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/partials/form.blade.php:29-35
   29                      :class="$isEdit ? 'cursor-not-allowed' : ''"
   30                      :disabled="$isEdit && (bool) $category->code"
   31                      :value="$isEdit ? $category->code : old('code')"
   32                      v-code
   33                  />
   34  
   35                  <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
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

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php:638-644
  638                                          :placeholder="trans('admin::app.catalog.category_fields.edit.code')"
  639                                          ::disabled="true !== optionIsNew"
  640                                          ref="inputAdmin"
  641                                          v-code
  642                                      />
  643  
  644                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/catalog/attributegroups/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/attributegroups/create.blade.php:70-76
   70                                          name="slug"
   71                                          v-bind="field"
   72                                          placeholder="{{ trans('admin::app.catalog.attribute-groups.create.code') }}"
   73                                          v-code
   74                                      >
   75                                  </v-field>
   76  

* packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php:83-89
   83                                          type="text"
   84                                          name="code"
   85                                          rules="required"
   86                                          v-code
   87                                          :label="trans('admin::app.catalog.families.index.create.code')"
   88                                          :placeholder="trans('admin::app.catalog.families.index.create.enter-code')"
   89                                      />

* packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php:382-388
  382                                          rules="required"
  383                                          :label="trans('admin::app.catalog.category_fields.create.code')"
  384                                          :placeholder="trans('admin::app.catalog.category_fields.create.code')"
  385                                          v-code
  386                                      />
  387  
  388                                      <x-admin::form.control-group.error control-name="code" />

* packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
--- packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php:97-103
   97                      type="text"
   98                      name="code"
   99                      rules="required"
  100                      v-code
  101                      :label="$codeLabel"
  102                      :placeholder="$codePlaceholder ?: $codeLabel"
  103                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code (other package, same admin Vue app)"}
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php:68-74
   68                                      type="text"
   69                                      name="code"
   70                                      rules="required"
   71                                      v-code
   72                                      :label="trans('passport::app.templates.create.code')"
   73                                      :placeholder="trans('passport::app.templates.create.code-placeholder')"
   74                                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code"}
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

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "only @include's partials/builder.blade.php (line 31); no direct v-code"}
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php: none of ['sanitizeCode'] appears in the file

* packages/Webkul/Admin/src/Resources/assets/js/utils/code.js  {"proposed_by_reader": false, "reader_excluded_because": "defines sanitizeCode; JS, not a Blade template"}
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

* packages/Webkul/Admin/src/Resources/assets/js/directives/code.js  {"proposed_by_reader": false, "reader_excluded_because": "JS directive, not Blade"}
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

* packages/Webkul/Admin/src/Resources/assets/js/app.js  {"proposed_by_reader": false, "reader_excluded_because": "JS registration (lines 294, 300), not Blade"}
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


========== ITEM uo-e-x-02 ==========
Question (registered, verbatim):
{
 "id": "uo-e-x-02",
 "suite": "E",
 "class": "change-impact-xplane",
 "subject": "unopim",
 "language": "js",
 "target_language": "blade",
 "question": "If generateCode changes, which Blade templates must be re-read (via the v-code-generator directive or the $generateCode global)?",
 "probe": "generateCode",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Admin/src/Resources/assets/js/directives/code-generator.js:1 -- registered at app.js:295",
  "packages/Webkul/Admin/src/Resources/assets/js/app.js:299 -- exposed as the $generateCode global",
  "Blade users of v-code-generator, e.g. packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php and components/catalog/quick-create-modal.blade.php"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; 8 files. The two ':v-code-generator' sites are Blade component props whose value is a PHP expression; they emit the directive at render time, so they count.
Reader on the oracle's open list: Directive registered at app.js:295 as 'code-generator'; grepped all Blade files for v-code-generator (plain and ':'-bound). $generateCode has zero Blade/PHP users.

Candidate files (13):

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php:64-70
   64                                  <x-admin::form.control-group.control
   65                                      type="text"
   66                                      name="{{ $currentLocaleCode }}[name]"
   67                                      v-code-generator="'code'"
   68                                      :label="trans('admin::app.catalog.association_types.create.name')"
   69                                      :placeholder="trans('admin::app.catalog.association_types.create.enter-name')"
   70                                  />

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php  {"proposed_by_reader": true, "reader_reason": ":v-code-generator on x-admin::form.control-group.control (Blade component attribute that renders the directive for the requested locale)"}
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/edit.blade.php:681-687
  681                                                  type="text"
  682                                                  name="locales.{{ $locale->code }}"
  683                                                  :label="$locale->name"
  684                                                  :v-code-generator="$locale->code === core()->getRequestedLocaleCode() ? '\'code\'' : null"
  685                                              />
  686  
  687                                              <x-admin::form.control-group.error control-name="locales.{{ $locale->code }}" />

* packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php  {"proposed_by_reader": true, "reader_reason": ":v-code-generator on Blade component, same pattern"}
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/field/edit.blade.php:657-663
  657                                                  type="text"
  658                                                  name="locales.{{ $locale->code }}"
  659                                                  :label="$locale->name"
  660                                                  :v-code-generator="$locale->code === core()->getRequestedLocaleCode() ? '\'code\'' : null"
  661                                              />
  662  
  663                                              <x-admin::form.control-group.error control-name="locales.{{ $locale->code }}" />

* packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
--- packages/Webkul/Admin/src/Resources/views/catalog/families/index.blade.php:66-72
   66                                          type="text"
   67                                          name="{{ $currentLocaleCode }}[name]"
   68                                          rules="required"
   69                                          v-code-generator="'code'"
   70                                          :label="trans('admin::app.catalog.families.index.create.name')"
   71                                          :placeholder="trans('admin::app.catalog.families.index.create.enter-name')"
   72                                      />

* packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
--- packages/Webkul/Admin/src/Resources/views/components/associations/field-builder.blade.php:361-367
  361                                      type="text"
  362                                      name="{{ $currentLocaleCode }}"
  363                                      rules="required"
  364                                      v-code-generator="'code'"
  365                                      :label="trans('admin::app.catalog.category_fields.index.datagrid.name')"
  366                                      :placeholder="trans('admin::app.catalog.category_fields.index.datagrid.name')"
  367                                  />

* packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
--- packages/Webkul/Admin/src/Resources/views/components/catalog/quick-create-modal.blade.php:72-78
   72                          type="text"
   73                          name="{{ $currentLocaleCode }}[name]"
   74                          rules="{{ $nameRequired ? 'required' : '' }}"
   75                          v-code-generator="'code'"
   76                          :label="$nameLabel"
   77                          :placeholder="$namePlaceholder ?: $nameLabel"
   78                      />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/create.blade.php:51-57
   51                                      type="text"
   52                                      name="{{ $currentLocaleCode }}[name]"
   53                                      rules="required"
   54                                      v-code-generator="'code'"
   55                                      :label="trans('passport::app.templates.create.name')"
   56                                      :placeholder="trans('passport::app.templates.create.name-placeholder')"
   57                                  />

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/partials/builder.blade.php  {"proposed_by_reader": true, "reader_reason": "v-code-generator"}
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

* packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "uses v-code only, not v-code-generator"}
--- packages/Webkul/Admin/src/Resources/views/catalog/attributes/create.blade.php: none of ['generateCode'] appears in the file

* packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "uses v-code only"}
--- packages/Webkul/Admin/src/Resources/views/catalog/categories/create.blade.php: none of ['generateCode'] appears in the file

* packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "only @include's builder partial"}
--- packages/Webkul/ProductPassport/src/Resources/views/admin/templates/edit.blade.php: none of ['generateCode'] appears in the file

* packages/Webkul/Admin/src/Resources/views/components/form/control-group/control.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "forwards the attribute bag for the two :v-code-generator call sites but does not name the directive; borderline under a render-time reading"}
--- packages/Webkul/Admin/src/Resources/views/components/form/control-group/control.blade.php: none of ['generateCode'] appears in the file

* packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php (line 5)  {"proposed_by_reader": false, "reader_excluded_because": "line 5 is a comment mentioning v-code-generator; the file is included because of line 67"}
--- packages/Webkul/Admin/src/Resources/views/catalog/associations/types/create.blade.php (line 5): FILE NOT FOUND at the pin