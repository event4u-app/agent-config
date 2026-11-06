You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


Subject: `unopim` at its registered pin.



===== EDGE Ee7aeef3ba9 =====
{"id": "Ee7aeef3ba9", "from": "packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:13", "to_symbol": "BaseAgent", "to": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:20", "kind": "use", "note": "extends BaseAgent"}
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:11-15
   11   *   php artisan ai-agent:analyze-image https://example.com/product.jpg --agent-id=1 --credential-id=1
   12   */
   13  class BulkProductEnricherAgent extends BaseAgent
   14  {
   15      /**
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:18-22
   18   *   - BulkProductEnricherAgent
   19   */
   20  abstract class BaseAgent
   21  {
   22      public function __construct(


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


===== EDGE Eeb201827b4 =====
{"id": "Eeb201827b4", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:161", "to_symbol": "AiProvider::fetchOpenAiModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:335", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:159-163
  159          try {
  160              return match ($this) {
  161                  self::OpenAI                                                                              => $this->fetchOpenAiModels($client, $apiKey, $apiUrl),
  162                  self::Anthropic                                                                           => $this->fetchAnthropicModels($client, $apiKey, $apiUrl),
  163                  self::Gemini                                                                              => $this->fetchGeminiModels($client, $apiKey, $apiUrl),
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:333-337
  333      }
  334  
  335      private function fetchOpenAiModels(Client $client, ?string $apiKey, ?string $apiUrl = null): array
  336      {
  337          $url = $this->modelsUrl($apiUrl);


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


===== EDGE Eed18e17865 =====
{"id": "Eed18e17865", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:146", "to_symbol": "AiProvider::fetchModelCatalog", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:155", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:144-148
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));
  147      }
  148  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:153-157
  153       * @return array<string, int|null>
  154       */
  155      public function fetchModelCatalog(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  156      {
  157          $client ??= new Client(['timeout' => 15]);


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


===== EDGE Eedb8083b70 =====
{"id": "Eedb8083b70", "from": "packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php:37", "to_symbol": "route webhook.store", "to": "packages/Webkul/Webhook/src/Routes/web.php:11", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php:35-39
   35  
   36  it('creates a webhook from the required fields and returns the edit redirect', function () {
   37      $response = $this->postJson(route('webhook.store'), [
   38          'name'   => 'Quick Created',
   39          'url'    => 'https://example.com/quick-create',
--- packages/Webkul/Webhook/src/Routes/web.php:9-13
    9          Route::controller(WebhookController::class)->group(function (): void {
   10              Route::get('', 'index')->name('webhook.index');
   11              Route::post('create', 'store')->name('webhook.store');
   12              Route::get('edit/{id}', 'edit')->name('webhook.edit')->whereNumber('id');
   13              Route::put('edit/{id}', 'update')->name('webhook.update')->whereNumber('id');


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


===== EDGE Ef17604f528 =====
{"id": "Ef17604f528", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:254", "to_symbol": "unopim:magic-ai:platform:edit", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:11", "kind": "framework", "note": "artisan command signature; ModelDiscovery is mocked in this test (line 22)"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:252-256
  252      fakeDiscovery(['gpt-4o', 'gpt-4o-mini']);
  253  
  254      $command = answerConnection(artisan('unopim:magic-ai:platform:edit', ['id' => $platform->id]), 'Hosted AI renamed', '')
  255          ->expectsQuestion(wizardLabel('fields.models'), ['gpt-4o-mini'])
  256          ->expectsQuestion(wizardLabel('command.models-additional'), '');
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:9-13
    9  use Webkul\MagicAI\Models\MagicAIPlatform;
   10  
   11  #[Signature('unopim:magic-ai:platform:edit
   12      {id? : ID of the platform to edit}
   13      {--provider= : Provider code, e.g. concentrate}


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


===== EDGE Ef31167a860 =====
{"id": "Ef31167a860", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:32", "to_symbol": "AiProvider::fetchModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:144", "kind": "call", "note": "Custom with null/empty api_url returns before any HTTP call; static chain only"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:30-34
   30  
   31  it('returns an empty model list for Custom when no api_url is supplied', function () {
   32      expect(AiProvider::Custom->fetchModels('sk-test-key', null))->toBe([]);
   33      expect(AiProvider::Custom->fetchModels('sk-test-key', ''))->toBe([]);
   34  });
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:142-146
  142       * @return list<string>
  143       */
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));


===== EDGE Ef3abe279ee =====
{"id": "Ef3abe279ee", "from": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:351", "to_symbol": "ModelDiscovery::discover", "to": "packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:17", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:349-353
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:15-19
   15       * @throws \RuntimeException
   16       */
   17      public function discover(AiProvider $provider, ?string $apiKey, ?string $apiUrl): array
   18      {
   19          return $provider->discoverModels($apiKey, $apiUrl);


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


===== EDGE Ef9b8a5561e =====
{"id": "Ef9b8a5561e", "from": "packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:107", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route"}
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:105-109
  105      $product->attribute_family->attributeFamilyGroupMappings->first()?->customAttributes()?->attach($attribute);
  106  
  107      $uri = route('admin.catalog.products.update', $product->id);
  108  
  109      submitMultipartForm($uri, 'PUT', ['sku' => $product->sku], [
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE Efa0e9bd92b =====
{"id": "Efa0e9bd92b", "from": "packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:58", "to_symbol": "ProductEventListener::afterCreate", "to": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:17", "kind": "framework", "note": "Event::listen('catalog.product.create.after')"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:56-60
   56  
   57          // Auto-enrichment: listen for product creation events
   58          Event::listen('catalog.product.create.after', [ProductEventListener::class, 'afterCreate']);
   59  
   60          // Vector store: keep product embeddings in sync (gated inside the observer)
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:15-19
   15       * Handle product creation — dispatch auto-enrichment if enabled.
   16       */
   17      public function afterCreate(Product $product): void
   18      {
   19          if (! $this->isAutoEnrichmentEnabled()) {


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


===== EDGE Efba25ee11e =====
{"id": "Efba25ee11e", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:88", "to_symbol": "WebhookService::sendBatch", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:140", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:86-90
   86  
   87          foreach (array_chunk($values, $this->batchChunkSize()) as $chunk) {
   88              $lastResponse = $this->sendBatch(
   89                  $this->productRepository->findWhereIn($field, $chunk),
   90                  $computeChanges,
--- packages/Webkul/Webhook/src/Services/WebhookService.php:138-142
  138       * payload to each subscribed webhook.
  139       */
  140      protected function sendBatch($products, bool $computeChanges = true, string $event = self::EVENT_PRODUCT_UPDATED, bool $skipIfNoChanges = true): ?Response
  141      {
  142          $webhooks = $this->webhookRepository->getActiveForEvent($event);


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


===== EDGE Efe52431084 =====
{"id": "Efe52431084", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:31", "to_symbol": "AiProvider::fetchModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:144", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:29-33
   29      ], $reached);
   30  
   31      $models = AiProvider::Azure->fetchModels('azure-key', 'https://1.1.1.1', $client);
   32  
   33      expect($models)->toBe(['gpt-4o']);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:142-146
  142       * @return list<string>
  143       */
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));


===== EDGE Efec5b2a7e2 =====
{"id": "Efec5b2a7e2", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformModelsSubmitTest.php:8", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformModelsSubmitTest.php:6-10
    6      $this->loginAsAdmin();
    7  
    8      $response = $this->postJson(route('admin.magic_ai.platform.store'), [
    9          'label'    => 'Models String '.uniqid(),
   10          'provider' => 'openai',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


===== EDGE Eff606d9798 =====
{"id": "Eff606d9798", "from": "packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:108", "to_symbol": "EnrichmentService", "to": "packages/Webkul/AiAgent/src/Services/EnrichmentService.php:15", "kind": "framework", "note": "container scoped binding"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:106-110
  106  
  107          $this->app->scoped(VisionService::class);
  108          $this->app->scoped(EnrichmentService::class);
  109          $this->app->scoped(ProductWriterService::class);
  110          $this->app->scoped(ImageToProductService::class);
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:13-17
   13   * (name, description, SEO fields, etc.) via a second AI call.
   14   */
   15  class EnrichmentService
   16  {
   17      /**


===== EDGE Effaedb6985 =====
{"id": "Effaedb6985", "from": "packages/Webkul/AiAgent/src/Services/ImageToProductService.php:47", "to_symbol": "AiApiClient", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:16", "kind": "use", "note": "type of the forwarded apiClient parameter"}
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:45-49
   45      public function execute(
   46          UploadedFile $image,
   47          ?AiApiClient $apiClient = null,
   48          int $credentialId = 0,
   49          array $options = [],
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:14-18
   14   * Unopim connectors use native cURL — NOT Guzzle or Laravel HTTP facade.
   15   */
   16  class AiApiClient
   17  {
   18      /**