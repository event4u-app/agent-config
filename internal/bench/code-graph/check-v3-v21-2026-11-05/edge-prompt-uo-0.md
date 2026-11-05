You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


Subject: `unopim` at its registered pin.



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


===== EDGE E0112acd4d6 =====
{"id": "E0112acd4d6", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:58", "to_symbol": "CollectsPlatform::save", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:325", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:56-60
   56          }
   57  
   58          return $this->save($data, $platform);
   59      }
   60  
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:323-327
  323       * @param  array<string, mixed>  $data
  324       */
  325      protected function save(array $data, ?MagicAIPlatform $platform): int
  326      {
  327          $payload = [


===== EDGE E02e9696157 =====
{"id": "E02e9696157", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:217", "to_symbol": "AiProvider::fetchOpenAiCompatModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:383", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:215-219
  215          foreach ($this->customBaseUrls($apiUrl) as $base) {
  216              try {
  217                  return $this->discovery($this->fetchOpenAiCompatModels($client, $apiKey, $base.'/models', harden: true), $base);
  218              } catch (RequestException $e) {
  219                  report($e);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:381-385
  381      }
  382  
  383      private function fetchOpenAiCompatModels(Client $client, ?string $apiKey, string $url, bool $harden = false): array
  384      {
  385          $options = [


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


===== EDGE E0503606c1b =====
{"id": "E0503606c1b", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:165", "to_symbol": "AiProvider::fetchAzureModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:442", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:163-167
  163                  self::Gemini                                                                              => $this->fetchGeminiModels($client, $apiKey, $apiUrl),
  164                  self::Ollama                                                                              => $this->fetchOllamaModels($client, $apiUrl ?: $this->defaultUrl()),
  165                  self::Azure                                                                               => $this->fetchAzureModels($client, $apiKey, $apiUrl),
  166                  self::Custom                                                                              => $this->discoverModels($apiKey, $apiUrl, $client)['released'],
  167                  self::Groq, self::XAI, self::Mistral, self::DeepSeek, self::OpenRouter, self::Concentrate => $this->fetchOpenAiCompatModels(
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:440-444
  440      }
  441  
  442      private function fetchAzureModels(Client $client, ?string $apiKey, ?string $apiUrl): array
  443      {
  444          if (! $apiUrl) {


===== EDGE E05d754c6a6 =====
{"id": "E05d754c6a6", "from": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "framework", "note": "Event::listen('catalog.product.update.after')"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
--- packages/Webkul/Webhook/src/Listeners/Product.php:22-26
   22       * Update or create product indices
   23       */
   24      public function afterUpdate(\Webkul\Product\Contracts\Product $product, bool $isBulkEdit = false): void
   25      {
   26          if ($isBulkEdit) {


===== EDGE E06da0d408f =====
{"id": "E06da0d408f", "from": "packages/Webkul/AiAgent/src/Services/VisionService.php:161", "to_symbol": "VisionService::analyze", "to": "packages/Webkul/AiAgent/src/Services/VisionService.php:101", "kind": "call"}
--- packages/Webkul/AiAgent/src/Services/VisionService.php:159-163
  159          throw_if(in_array($imagePath, [null, '', '0'], true), \InvalidArgumentException::class, 'VisionService::analyzeContext requires a non-empty ImageProductContext::$imagePath.');
  160  
  161          $result = $this->analyze($imagePath, $credentialId, $options);
  162  
  163          // Merge: preserve existing attributes / enrichment, overlay vision data
--- packages/Webkul/AiAgent/src/Services/VisionService.php:99-103
   99       * @throws ApiException When all retry attempts are exhausted
  100       */
  101      public function analyze(string $imageContent, int $credentialId = 0, ?AiApiClient $apiClient = null, array $options = []): ImageProductContext
  102      {
  103          // Use pre-configured client if provided, otherwise build from credential/config


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


===== EDGE E094f63e97f =====
{"id": "E094f63e97f", "from": "packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php:139", "to_symbol": "BulkProductUpdate::handle", "to": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:100", "kind": "call"}
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php:137-141
  137  function runBulkVariantLevelUpdate(array $payload): JobTrack
  138  {
  139      (new BulkProductUpdate($payload, auth()->guard('admin')->id()))->handle();
  140  
  141      return JobTrack::latest('id')->first();
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:98-102
   98       * Handle the bulk product update job.
   99       */
  100      public function handle(): void
  101      {
  102          if ($this->userId && ($admin = AdminProxy::find($this->userId))) {


===== EDGE E09b44d4e47 =====
{"id": "E09b44d4e47", "from": "packages/Webkul/AiAgent/src/Agents/TextDescriptionAgent.php:20", "to_symbol": "BaseAgent", "to": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:20", "kind": "use", "note": "extends BaseAgent (inherits execute)"}
--- packages/Webkul/AiAgent/src/Agents/TextDescriptionAgent.php:18-22
   18   *   );
   19   */
   20  class TextDescriptionAgent extends BaseAgent
   21  {
   22      /**
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:18-22
   18   *   - BulkProductEnricherAgent
   19   */
   20  abstract class BaseAgent
   21  {
   22      public function __construct(


===== EDGE E09fc4327ef =====
{"id": "E09fc4327ef", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:61", "to_symbol": "SendBulkEditProductWebhook", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:11", "kind": "use"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:59-63
   59  
   60      Queue::assertNotPushed(SendProductWebhook::class);
   61      Queue::assertPushed(SendBulkEditProductWebhook::class, 1);
   62  });
   63  
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:9-13
    9  use Webkul\Webhook\Services\WebhookService;
   10  
   11  class SendBulkEditProductWebhook implements ShouldQueue
   12  {
   13      use Queueable;


===== EDGE E0a2e3b7ed0 =====
{"id": "E0a2e3b7ed0", "from": "packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:198", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route"}
--- packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:196-200
  196      $this->loginWithPermissions('all');
  197  
  198      postJson(route('admin.magic_ai.platform.fetch_models'), [
  199          'id'       => managedPlatformRecord()->id,
  200          'provider' => AiProvider::Concentrate->value,
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');


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


===== EDGE E0b7c8d5e5d =====
{"id": "E0b7c8d5e5d", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1973", "to_symbol": "event 'data_transfer.imports.batch.product.created.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:34", "kind": "dispatch"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1971-1975
 1971  
 1972          if ($createdIds !== []) {
 1973              Event::dispatch('data_transfer.imports.batch.product.created.after', [
 1974                  'product_id' => $createdIds,
 1975              ]);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:32-36
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);
   33  
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
   35  
   36          Event::listen('data_transfer.imports.batch.product.updated.after', [Product::class, 'afterBulkEditFromImport']);


===== EDGE E0d123c96ed =====
{"id": "E0d123c96ed", "from": "packages/Webkul/Measurement/tests/Feature/MeasurementDecimalStrategyTest.php:85", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/MeasurementDecimalStrategyTest.php:83-87
   83      $product = Product::factory()->withInitialValues()->create();
   84  
   85      app(ProductRepository::class)->update([
   86          'values' => [
   87              'common' => [
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE E0f594769ec =====
{"id": "E0f594769ec", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:48", "to_symbol": "WebhookService::fanOutSingle", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:110", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:46-50
   46      public function sendCreatedToWebhook(Product $product, array $productChanges = []): ?Response
   47      {
   48          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_CREATED);
   49      }
   50  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:108-112
  108       * Build a single-product payload and deliver it to each subscribed webhook.
  109       */
  110      protected function fanOutSingle(Product $product, array $productChanges, string $event): ?Response
  111      {
  112          $webhooks = $this->webhookRepository->getActiveForEvent($event);


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


===== EDGE E1004953cb3 =====
{"id": "E1004953cb3", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:108", "to_symbol": "CollectsPlatform::askModels", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:152", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:106-110
  106          ] : [];
  107  
  108          $models = $this->askModels(
  109              $provider,
  110              $apiKey ?? $platform?->safeApiKey(),
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:150-154
  150       * @return string[]
  151       */
  152      protected function askModels(AiProvider $provider, ?string $apiKey, string $apiUrl, array $stored): array
  153      {
  154          $fetched = $this->fetchModels($provider, $apiKey, $apiUrl);


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


===== EDGE E109d3a7f5e =====
{"id": "E109d3a7f5e", "from": "packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:114", "to_symbol": "SendBulkProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:29", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:112-116
  112      $job = new SendBulkProductWebhook([], null, WebhookService::EVENT_PRODUCT_CREATED);
  113  
  114      $job->handle(app(WebhookService::class));
  115  })->throwsNoExceptions();
  116  
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:27-31
   27       * Execute the job.
   28       */
   29      public function handle(WebhookService $webhookService): void
   30      {
   31          if ($this->userId && ($user = AdminProxy::find($this->userId))) {


===== EDGE E12fd963c4b =====
{"id": "E12fd963c4b", "from": "packages/Webkul/Product/src/Type/Configurable.php:229", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/Product/src/Type/Configurable.php:227-231
  227                  $planner->primeStructure($group->id, $loadedStructure);
  228  
  229                  Event::dispatch('catalog.product.create.after', $group);
  230              } else {
  231                  if (! $group = $existingGroups->pull($groupKey)) {
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E13e6398579 =====
{"id": "E13e6398579", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:41", "to_symbol": "CollectsPlatform::collectInteractively", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:64", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:39-43
   39      {
   40          $data = $this->input->isInteractive()
   41              ? $this->collectInteractively($platform)
   42              : $this->collectFromOptions($platform);
   43  
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:62-66
   62       * @return array<string, mixed>
   63       */
   64      protected function collectInteractively(?MagicAIPlatform $platform): array
   65      {
   66          $provider = AiProvider::from(select(


===== EDGE E13f7d9dc08 =====
{"id": "E13f7d9dc08", "from": "packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:86", "to_symbol": "AiApiClient", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:16", "kind": "use", "note": "resolve(AiApiClient::class); passed to EnrichmentService::enrich"}
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:84-88
   84                  try {
   85                      // Configure API client with the platform from this chat session
   86                      $apiClient = resolve(AiApiClient::class);
   87                      $apiClient->configure(new CredentialConfig(
   88                          id: $this->context->platform->id,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:14-18
   14   * Unopim connectors use native cURL — NOT Guzzle or Laravel HTTP facade.
   15   */
   16  class AiApiClient
   17  {
   18      /**


===== EDGE E15649b3cdc =====
{"id": "E15649b3cdc", "from": "packages/Webkul/Admin/tests/Feature/Acl/WriteRouteBypassRegressionTest.php:196", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "outside pool; ACL regression test"}
--- packages/Webkul/Admin/tests/Feature/Acl/WriteRouteBypassRegressionTest.php:194-198
  194      $this->loginWithPermissions(permissions: ['dashboard']);
  195  
  196      $this->post(route('admin.catalog.products.bulk-edit.save'), [])
  197          ->assertStatus(403);
  198  });
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


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


===== EDGE E16cfd5eab3 =====
{"id": "E16cfd5eab3", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:23", "to_symbol": "CollectsPlatform", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:29", "kind": "use", "note": "trait"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:21-25
   21  class AddPlatform extends PlatformCommand
   22  {
   23      use CollectsPlatform;
   24  
   25      protected function perform(): int
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:27-31
   27   * repository with the form's validation.
   28   */
   29  trait CollectsPlatform
   30  {
   31      protected const AZURE_DEPLOYMENT = 'gpt-4o';


===== EDGE E17ee90a487 =====
{"id": "E17ee90a487", "from": "packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:31", "to_symbol": "WebhookService::sendBatchForBulkEdit", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:64", "kind": "call"}
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


===== EDGE E196a2b48a8 =====
{"id": "E196a2b48a8", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:101", "to_symbol": "ConfigurableProductController::storeVariantGroup", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:179", "kind": "call", "note": "in store (97)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:99-103
   99          if ($request->input('type') === ProductType::VariantGroup->value) {
  100              try {
  101                  return $this->storeVariantGroup($request);
  102              } catch (\Exception $e) {
  103                  return $this->storeExceptionLog($e);
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:177-181
  177       * must be supplied and uniqueness is checked on the whole tuple.
  178       */
  179      protected function storeVariantGroup(StoreConfigurableProductRequest $request): JsonResponse
  180      {
  181          $parent = $this->findParentProductOr404($request->input('parent'));


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


===== EDGE E1a18ebc6a3 =====
{"id": "E1a18ebc6a3", "from": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:131", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:129-133
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.
  131          $safeOptions = SafeWebhookUrl::httpOptions($url);
  132  
  133          throw_unless(
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


===== EDGE E1b392b766c =====
{"id": "E1b392b766c", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php:370", "to_symbol": "route admin.catalog.products.variant_node.create", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:202", "kind": "route", "note": "Queue::fake() (line 367): SendProductWebhook pushed, not run"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php:368-372
  368  
  369      $response = $this->actingAs(Admin::factory()->create(), 'admin')
  370          ->postJson(route('admin.catalog.products.variant_node.create', $configurable->id), [
  371              'parent_id' => $group->id,
  372              'role'      => ProductType::Simple->value,
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:200-204
  200              Route::post('copy/{id}', 'copy')->name('admin.catalog.products.copy');
  201  
  202              Route::post('{configurableId}/variant-node', 'createVariantNode')->name('admin.catalog.products.variant_node.create');
  203  
  204              Route::get('{configurableId}/variant-children', 'variantChildren')->name('admin.catalog.products.variant_children');


===== EDGE E1c290afa42 =====
{"id": "E1c290afa42", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformDefaultValidationTest.php:8", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformDefaultValidationTest.php:6-10
    6      $this->loginAsAdmin();
    7  
    8      $response = $this->postJson(route('admin.magic_ai.platform.store'), [
    9          'label'      => 'Disabled Default',
   10          'provider'   => 'openai',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


===== EDGE E1c5e3f225e =====
{"id": "E1c5e3f225e", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTildeModelTest.php:8", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTildeModelTest.php:6-10
    6      $this->loginAsAdmin();
    7  
    8      $response = $this->postJson(route('admin.magic_ai.platform.store'), [
    9          'label'    => 'OpenRouter Tilde '.uniqid(),
   10          'provider' => 'openrouter',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


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


===== EDGE E1e5b42d13f =====
{"id": "E1e5b42d13f", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:112", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:110-114
  110                  Event::dispatch('catalog.product.create.before');
  111                  $product = $this->productRepository->create($data);
  112                  Event::dispatch('catalog.product.create.after', $product);
  113              }
  114  
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E215360a76f =====
{"id": "E215360a76f", "from": "packages/Webkul/Product/src/Type/Configurable.php:176", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/Product/src/Type/Configurable.php:174-178
  174                  $variant = $this->createVariant($product, $productSuperAttributes, $variantData, $uniqueAttributes);
  175  
  176                  Event::dispatch('catalog.product.create.after', $variant);
  177              } else {
  178                  if (is_numeric($index = $previousVariantIds->search($variantId))) {
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E245d991356 =====
{"id": "E245d991356", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:6", "to_symbol": "route admin.magic_ai.platform.test", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:114", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:4-8
    4      $this->loginWithPermissions(permissions: ['dashboard']);
    5  
    6      $this->postJson(route('admin.magic_ai.platform.test'), [
    7          'provider' => 'openai',
    8          'models'   => 'gpt-4o',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:112-116
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');


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


===== EDGE E2812dbb94c =====
{"id": "E2812dbb94c", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:74", "to_symbol": "SendBulkProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:29", "kind": "dispatch"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:72-76
   72          }
   73  
   74          dispatch(new SendBulkProductWebhook($ids, auth('admin')?->user()?->id, $event))
   75              ->onQueue('webhooks');
   76      }
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:27-31
   27       * Execute the job.
   28       */
   29      public function handle(WebhookService $webhookService): void
   30      {
   31          if ($this->userId && ($user = AdminProxy::find($this->userId))) {


===== EDGE E29ca65e090 =====
{"id": "E29ca65e090", "from": "packages/Webkul/Webhook/src/Routes/web.php:11", "to_symbol": "WebhookController::store", "to": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:47", "kind": "route"}
--- packages/Webkul/Webhook/src/Routes/web.php:9-13
    9          Route::controller(WebhookController::class)->group(function (): void {
   10              Route::get('', 'index')->name('webhook.index');
   11              Route::post('create', 'store')->name('webhook.store');
   12              Route::get('edit/{id}', 'edit')->name('webhook.edit')->whereNumber('id');
   13              Route::put('edit/{id}', 'update')->name('webhook.update')->whereNumber('id');
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:45-49
   45       * fields are captured here; the optional ones are filled in on the edit page.
   46       */
   47      public function store(WebhookForm $request): JsonResponse
   48      {
   49          abort_unless(bouncer()->hasPermission('configuration.webhook.create'), 403);


===== EDGE E2acc1a01eb =====
{"id": "E2acc1a01eb", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:61", "to_symbol": "WebhookService::deliverChunked", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:83", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:59-63
   59      public function sendBatchCreatedByIds(array $ids): ?Response
   60      {
   61          return $this->deliverChunked('id', $ids, computeChanges: false, event: self::EVENT_PRODUCT_CREATED, skipIfNoChanges: false);
   62      }
   63  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:81-85
   81       * @param  array<int, int|string>  $values
   82       */
   83      protected function deliverChunked(string $field, array $values, bool $computeChanges = true, string $event = self::EVENT_PRODUCT_UPDATED, bool $skipIfNoChanges = true): ?Response
   84      {
   85          $lastResponse = null;


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


===== EDGE E2e851aadc1 =====
{"id": "E2e851aadc1", "from": "packages/Webkul/Product/tests/Unit/Services/VariantValueResolverTest.php:205", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Unit/Services/VariantValueResolverTest.php:203-207
  203      ]);
  204  
  205      app(ProductRepository::class)->update([
  206          'values' => ['common' => ['stock_level' => '0']],
  207      ], $variant->id);
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE E2f39d3bcab =====
{"id": "E2f39d3bcab", "from": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "to_symbol": "ProductBulkEditController::handleBulkSave", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:328", "kind": "route"}
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


===== EDGE E2f5f9ccd07 =====
{"id": "E2f5f9ccd07", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php:31", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "webhook jobs faked (line 14)"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php:29-33
   29      $family->attributeFamilyGroupMappings->first()?->customAttributes()?->attach($attribute);
   30  
   31      $this->postJson(route('admin.catalog.products.bulk-edit.save'), [
   32          'data' => [$product->id => [$attribute->code => 'bulk-changed-value']],
   33      ])->assertOk();
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


===== EDGE E2f81e6f3b4 =====
{"id": "E2f81e6f3b4", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php:38", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php:36-40
   36  
   37  it('should return validation errors when creating platform with missing fields', function () {
   38      $this->postJson(route('admin.magic_ai.platform.store'), [])
   39          ->assertUnprocessable()
   40          ->assertJsonValidationErrors(['label', 'provider', 'models']);
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


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


===== EDGE E317d003e97 =====
{"id": "E317d003e97", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:300", "to_symbol": "event 'catalog.product.update.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:298-302
  298  
  299              if ($wasDirty) {
  300                  Event::dispatch('catalog.product.update.after', $product);
  301              }
  302  
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);


===== EDGE E3269ad92a1 =====
{"id": "E3269ad92a1", "from": "packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:42", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:40-44
   40      $this->loginWithPermissions('all');
   41  
   42      postJson(route('admin.magic_ai.platform.store'), managedPayload([
   43          'label'      => 'Client platform',
   44          'api_key'    => 'sk-client-own-key',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


===== EDGE E346be51416 =====
{"id": "E346be51416", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiProductAssociationSyncTest.php:62", "to_symbol": "route admin.api.products.update", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:131", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiProductAssociationSyncTest.php:60-64
   60  
   61      $this->withHeaders($this->headers)
   62          ->json('PUT', route('admin.api.products.update', ['code' => $updatedProduct['sku']]), $updatedProduct)
   63          ->assertStatus(200)
   64          ->assertJsonFragment(['success' => true]);
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:129-133
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');


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


===== EDGE E347b78f358 =====
{"id": "E347b78f358", "from": "packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:23", "to_symbol": "AutoEnrichProductJob::handle", "to": "packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:40", "kind": "dispatch"}
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:21-25
   21          }
   22  
   23          dispatch(new AutoEnrichProductJob(productId: $product->id, locale: core()->getRequestedLocaleCode(), channel: core()->getRequestedChannelCode()))->delay(now()->addSeconds(5)); // Small delay to ensure product is 
   24      }
   25  
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:38-42
   38      }
   39  
   40      public function handle(
   41          EnrichmentService $enrichmentService,
   42          MagicAIPlatformRepository $platformRepository,


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


===== EDGE E3485d0a771 =====
{"id": "E3485d0a771", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1344", "to_symbol": "event 'catalog.product.update.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "kind": "dispatch"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1342-1346
 1342  
 1343          if ($product->wasDirtyOnUpdate) {
 1344              Event::dispatch('catalog.product.update.after', $product);
 1345  
 1346              ProductCompletenessJob::dispatch([$id]);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);


===== EDGE E34dc870f35 =====
{"id": "E34dc870f35", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php:23", "to_symbol": "Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "call", "note": "Queue::fake(): SendBulkEditProductWebhook pushed, never handled"}
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


===== EDGE E352770b5fa =====
{"id": "E352770b5fa", "from": "packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:123", "to_symbol": "AiProvider::discoverModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:201", "kind": "call"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:121-125
  121      ], $history);
  122  
  123      $discovery = AiProvider::Custom->discoverModels('key', 'https://api.cerebras.ai', $client);
  124  
  125      expect($discovery)->toBe(['models' => ['llama3.1-8b'], 'released' => ['llama3.1-8b' => null], 'api_url' => 'https://api.cerebras.ai/v1'])
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:199-203
  199       * @return array{models: list<string>, released: array<string, int|null>, api_url: string}
  200       */
  201      public function discoverModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  202      {
  203          $client ??= new Client(['timeout' => 15]);


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


===== EDGE E35909cc82f =====
{"id": "E35909cc82f", "from": "packages/Webkul/Product/src/Repositories/ProductRepository.php:150", "to_symbol": "event 'catalog.product.update.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "kind": "dispatch", "note": "in massUpdateStatus"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:148-152
  148                  $product = $this->updateStatus($status, $productId);
  149  
  150                  Event::dispatch('catalog.product.update.after', $product);
  151              }
  152          }), ['catalog.product.update.after']);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);


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


===== EDGE E36db9b55ff =====
{"id": "E36db9b55ff", "from": "packages/Webkul/AiAgent/Config/ai-agent.php:38", "to_symbol": "GenerateContent", "to": "packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:19", "kind": "framework", "note": "chat tool registry config (ai-agent tools list)"}
--- packages/Webkul/AiAgent/Config/ai-agent.php:36-40
   36          Tools\ManageAssociations::class  => ['name' => 'manage_associations', 'group' => 'catalog', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
   37  
   38          Tools\GenerateContent::class => ['name' => 'generate_content', 'group' => 'content', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
   39          Tools\GenerateImage::class   => ['name' => 'generate_image', 'group' => 'content', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
   40          Tools\EditImage::class       => ['name' => 'edit_image', 'group' => 'content', 'write' => true, 'permission' => 'catalog.products.edit', 'enabled' => true],
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:17-21
   17  use Webkul\Product\Repositories\ProductRepository;
   18  
   19  class GenerateContent implements PimTool
   20  {
   21      public function __construct(


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


===== EDGE E38503b5713 =====
{"id": "E38503b5713", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductEditLazyGroupsTest.php:379", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductEditLazyGroupsTest.php:377-381
  377      $product = Product::factory()->create(['type' => ProductType::Simple->value, 'attribute_family_id' => $family->id]);
  378  
  379      $this->put(route('admin.catalog.products.update', $product->id), [
  380          'sku'    => $product->sku,
  381          'status' => 1,
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE E3857d72dcf =====
{"id": "E3857d72dcf", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:422", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:420-424
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));
  423      }
  424  
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


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


===== EDGE E3b36d2c75e =====
{"id": "E3b36d2c75e", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php:32", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route", "note": "dataset row of an ACL test; request refused before discovery"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php:30-34
   30      ['post', 'admin.magic_ai.platform.store'],
   31      ['post', 'admin.magic_ai.platform.test'],
   32      ['post', 'admin.magic_ai.platform.fetch_models'],
   33      ['put', 'admin.magic_ai.platform.update'],
   34      ['delete', 'admin.magic_ai.platform.delete'],
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');


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


===== EDGE E3b803a7fd7 =====
{"id": "E3b803a7fd7", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementLifecycleTest.php:44", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementLifecycleTest.php:42-46
   42  function lifecycleSubmitMeasurement(int $productId, string $code, string|int|float $value, string $unit): Product
   43  {
   44      return app(ProductRepository::class)->update([
   45          'values' => [
   46              'common' => [
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


===== EDGE E3bbadc8aa5 =====
{"id": "E3bbadc8aa5", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditPriceValidationTest.php:17", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditPriceValidationTest.php:15-19
   15      $product = Product::factory()->create();
   16  
   17      $response = $this->postJson(route('admin.catalog.products.bulk-edit.save'), [
   18          'data' => [
   19              (string) $product->id => [
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


===== EDGE E3bf9e7cb8c =====
{"id": "E3bf9e7cb8c", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:130", "to_symbol": "WebhookService::deliver", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:187", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:128-132
  128  
  129          foreach ($webhooks as $webhook) {
  130              $lastResponse = $this->deliver($webhook, $payload, $product->sku, $event);
  131          }
  132  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:185-189
  185       *                                          log row is written per product.
  186       */
  187      protected function deliver(Webhook $webhook, array $payload, ?string $sku, string $event, $batchProducts = null): ?Response
  188      {
  189          $safety = SafeWebhookUrl::validate($webhook->url);


===== EDGE E3cbf227e61 =====
{"id": "E3cbf227e61", "from": "packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:74", "to_symbol": "AiApiClient", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:16", "kind": "use", "note": "resolve(AiApiClient::class); configured client passed to VisionService::analyze"}
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:72-76
   72  
   73                      // Configure the AiApiClient with the platform from this chat session
   74                      $apiClient = resolve(AiApiClient::class);
   75                      $apiClient->configure(new CredentialConfig(
   76                          id: $this->context->platform->id,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:14-18
   14   * Unopim connectors use native cURL — NOT Guzzle or Laravel HTTP facade.
   15   */
   16  class AiApiClient
   17  {
   18      /**


===== EDGE E3e35501cfd =====
{"id": "E3e35501cfd", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php:346", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php:344-348
  344      ]);
  345  
  346      $this->put(route('admin.catalog.products.update', $newProduct->id), $data)
  347          ->assertSessionHas('warning', $expected);
  348  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


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


===== EDGE E3fb114bcd3 =====
{"id": "E3fb114bcd3", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:339", "to_symbol": "AiProvider::discoveryOptions", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:378", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:337-341
  337          $url = $this->modelsUrl($apiUrl);
  338  
  339          $response = $client->get($url, $this->discoveryOptions($url, $apiUrl, [
  340              'headers' => [
  341                  'Authorization' => 'Bearer '.$apiKey,
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:376-380
  376       * @return array<string, mixed>
  377       */
  378      private function discoveryOptions(string $url, ?string $apiUrl, array $options): array
  379      {
  380          return $apiUrl ? $this->ssrfGuardedOptions($url, $options) : $options;


===== EDGE E402253dd29 =====
{"id": "E402253dd29", "from": "packages/Webkul/AdminApi/tests/Feature/Acl/ApiAclTest.php:455", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Acl/ApiAclTest.php:453-457
  453      $headers = $this->getAuthenticationHeaders('custom');
  454  
  455      $this->withHeaders($headers)->json('POST', route('admin.api.products.store'), [])
  456          ->assertForbidden();
  457  });
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


===== EDGE E407b39caf2 =====
{"id": "E407b39caf2", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:164", "to_symbol": "AiProvider::fetchOllamaModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:399", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:162-166
  162                  self::Anthropic                                                                           => $this->fetchAnthropicModels($client, $apiKey, $apiUrl),
  163                  self::Gemini                                                                              => $this->fetchGeminiModels($client, $apiKey, $apiUrl),
  164                  self::Ollama                                                                              => $this->fetchOllamaModels($client, $apiUrl ?: $this->defaultUrl()),
  165                  self::Azure                                                                               => $this->fetchAzureModels($client, $apiKey, $apiUrl),
  166                  self::Custom                                                                              => $this->discoverModels($apiKey, $apiUrl, $client)['released'],
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:397-401
  397      }
  398  
  399      private function fetchOllamaModels(Client $client, string $baseUrl): array
  400      {
  401          $url = rtrim($baseUrl, '/').'/api/tags';


===== EDGE E41893589b6 =====
{"id": "E41893589b6", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:257", "to_symbol": "BulkProductUpdate::persistProduct", "to": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:287", "kind": "call"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:255-259
  255              }
  256  
  257              if (! $this->persistProduct($product, $values, $submittedCommon)) {
  258                  continue;
  259              }
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:285-289
  285       * @return bool Whether the product passed the guard.
  286       */
  287      protected function persistProduct(Product $product, ?array $values, array $submittedCommon): bool
  288      {
  289          $persist = function () use ($product, $values): void {


===== EDGE E42428526a9 =====
{"id": "E42428526a9", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:298", "to_symbol": "event 'catalog.product.update.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "kind": "dispatch"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:296-300
  296              $product->save();
  297  
  298              Event::dispatch('catalog.product.update.after', [$product, true]);
  299          };
  300  
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);


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


===== EDGE E42ea9509f1 =====
{"id": "E42ea9509f1", "from": "packages/Webkul/Product/tests/Unit/Type/ConfigurableVariantLevelAttributeTest.php:132", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Unit/Type/ConfigurableVariantLevelAttributeTest.php:130-134
  130      $repository = app(ProductRepository::class);
  131  
  132      $repository->update([
  133          'sku'            => $configurable->sku,
  134          'channel'        => 'default',
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE E462bd433fb =====
{"id": "E462bd433fb", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:407", "to_symbol": "ProductController::validateVariantConfiguration", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:578", "kind": "call"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:405-409
  405  
  406          $superAttributes = $parentProduct->super_attributes->pluck('code')?->toArray();
  407          $this->validateVariantConfiguration($parentProduct, $superAttributes, $data);
  408          $data['super_attributes'] = $superAttributes;
  409          $parentData['variants'] = $this->setVaraints($parentProduct, $data, $data['sku']);
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:576-580
  576       * @throws UnprocessableEntityHttpException If the variant is not unique for the parent product.
  577       */
  578      protected function validateVariantConfiguration(Product $parentProduct, array $superAttributes, array $data): void
  579      {
  580          foreach ($superAttributes as $attrCode) {


===== EDGE E46c2bf9a97 =====
{"id": "E46c2bf9a97", "from": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:126", "to_symbol": "PlatformValidator::isSafeApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:143", "kind": "call"}
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:124-128
  124          }
  125  
  126          if (! $this->isSafeApiUrl($apiUrl)) {
  127              return trans('admin::app.configuration.platform.message.unsafe-api-url');
  128          }
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:141-145
  141      }
  142  
  143      public function isSafeApiUrl(?string $apiUrl): bool
  144      {
  145          $apiUrl = trim((string) $apiUrl);


===== EDGE E498829e716 =====
{"id": "E498829e716", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:19", "to_symbol": "route admin.magic_ai.platform.test", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:114", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:17-21
   17      Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'OK']]]], 200)]);
   18  
   19      $this->postJson(route('admin.magic_ai.platform.test'), [
   20          'provider' => AiProvider::Custom->value,
   21          'api_key'  => 'sk-test-key-1234567890',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:112-116
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');


===== EDGE E49c680f013 =====
{"id": "E49c680f013", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiProductTest.php:114", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiProductTest.php:112-116
  112      ];
  113  
  114      $this->withHeaders($this->headers)->json('POST', route('admin.api.products.store'), $product)
  115          ->assertStatus(201)
  116          ->assertJsonStructure([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


===== EDGE E4aaadeeff5 =====
{"id": "E4aaadeeff5", "from": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:109", "to_symbol": "AiApiClient::chat", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:88", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:107-111
  107      {
  108          try {
  109              $this->chat(
  110                  messages: [['role' => 'user', 'content' => 'Hello']],
  111                  maxTokens: 10,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:86-90
   86       * @throws \RuntimeException When the request exceeds the model context window and cannot be trimmed
   87       */
   88      public function chat(array $messages, int $maxTokens = 4096, float $temperature = 0.7): array
   89      {
   90          $messages = $this->enforceContextWindow($messages, $maxTokens);


===== EDGE E4b9dd6fe89 =====
{"id": "E4b9dd6fe89", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:90", "to_symbol": "SendBulkEditProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:25", "kind": "dispatch"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:88-92
   88          }
   89  
   90          dispatch(new SendBulkEditProductWebhook($ids, auth('admin')?->user()?->id))->onQueue('webhooks');
   91      }
   92  }
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:23-27
   23       * Execute the job.
   24       */
   25      public function handle(WebhookService $webhookService): void
   26      {
   27          if ($this->userId && ($user = AdminProxy::find($this->userId))) {


===== EDGE E4be9b49c80 =====
{"id": "E4be9b49c80", "from": "packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php:10", "to_symbol": "AiApiClient", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:16", "kind": "use", "note": "AiApiClientCaptureDouble extends AiApiClient but overrides execute() (line 18): httpOptions is never invoked at runtime; static chain only"}
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php:8-12
    8   * Test double: captures the request body instead of performing a cURL call.
    9   */
   10  class AiApiClientCaptureDouble extends AiApiClient
   11  {
   12      /** @var array<string, mixed> */
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:14-18
   14   * Unopim connectors use native cURL — NOT Guzzle or Laravel HTTP facade.
   15   */
   16  class AiApiClient
   17  {
   18      /**


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


===== EDGE E4e2105633e =====
{"id": "E4e2105633e", "from": "packages/Webkul/Product/src/Type/Configurable.php:250", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/Product/src/Type/Configurable.php:248-252
  248                      $planner->primeStructure($variant->id, $loadedStructure);
  249  
  250                      Event::dispatch('catalog.product.create.after', $variant);
  251                  } else {
  252                      if (is_numeric($index = $previousGroupVariantIds->search($variantId))) {
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


===== EDGE E4e662c0758 =====
{"id": "E4e662c0758", "from": "packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:33", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:31-35
   31              'provider' => ['required', 'string', 'in:openai,anthropic,azure,custom'],
   32              'apiUrl'   => ['required', 'url', 'max:500', function (string $attribute, mixed $value, Closure $fail): void {
   33                  if (! SafeWebhookUrl::validate($value)['valid']) {
   34                      $fail(trans('admin::app.configuration.platform.message.unsafe-api-url'));
   35                  }
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


===== EDGE E518ce272b0 =====
{"id": "E518ce272b0", "from": "packages/Webkul/Admin/tests/Feature/Catalog/WebhookVariantEventTest.php:55", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/WebhookVariantEventTest.php:53-57
   53      ];
   54  
   55      $this->put(route('admin.catalog.products.update', $configurableProduct->id), $data)
   56          ->assertSessionHas('success', trans('admin::app.catalog.products.update-success'));
   57  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


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


===== EDGE E53a03f8a33 =====
{"id": "E53a03f8a33", "from": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:146", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:144-148
  144          $url = (string) $request->input('url');
  145  
  146          if (! SafeWebhookUrl::validate($url)['valid']) {
  147              return new JsonResponse([
  148                  'success' => false,
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


===== EDGE E53e2c3fed2 =====
{"id": "E53e2c3fed2", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:19", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:17-21
   17      // A public host passes the pre-fetch safety check; a literal public IP is
   18      // used so the check is deterministic offline (no DNS in the test env).
   19      expect(SafeWebhookUrl::validate('https://1.1.1.1/models')['valid'])->toBeTrue();
   20  
   21      $reached = [];
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


===== EDGE E548d7f1c93 =====
{"id": "E548d7f1c93", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3159", "to_symbol": "Importer::validateVariantUniqueness", "to": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3100", "kind": "call", "note": "in isUniqueVariation (3153)"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3157-3161
 3157          }
 3158  
 3159          $this->validateVariantUniqueness($productData, $rowNumber);
 3160      }
 3161  
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3098-3102
 3098       * validate variant configurable attributes uniquness
 3099       */
 3100      protected function validateVariantUniqueness(array $productData, int $rowNumber): bool
 3101      {
 3102          $parentProduct = $this->getExistingProduct($productData['parent']);


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


===== EDGE E557daefadc =====
{"id": "E557daefadc", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductAjaxValidationMessageTest.php:18", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductAjaxValidationMessageTest.php:16-20
   16  
   17      $response = $this->putJson(
   18          route('admin.catalog.products.update', $product->id),
   19          ['sku'         => $product->sku, 'values' => $values],
   20          ['X-Ajax-Form' => 'true']
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE E55eedff814 =====
{"id": "E55eedff814", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:351", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:349-353
  349      $sizeOption = $size->options->first()->code;
  350  
  351      $this->withHeaders($this->headers)->json('POST', route('admin.api.products.store'), [
  352          'parent'  => 'vgleaf-group',
  353          'family'  => $family->code,
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


===== EDGE E57f4057e73 =====
{"id": "E57f4057e73", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1303", "to_symbol": "Importer::isUniqueVariation", "to": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3153", "kind": "call", "note": "in validateRow (1143)"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1301-1305
 1301          }
 1302  
 1303          $this->isUniqueVariation($rowData, $rowNumber);
 1304  
 1305          return ! $this->errorHelper->isRowInvalid($rowNumber);
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3151-3155
 3151       * Check is unique values for the variation product and add error if not unique for the product
 3152       */
 3153      protected function isUniqueVariation(array $productData, int $rowNumber): void
 3154      {
 3155          if (empty($productData['parent']) || $productData['type'] !== ProductType::Simple->value) {


===== EDGE E5994b573a1 =====
{"id": "E5994b573a1", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:125", "to_symbol": "WebhookService::sendCreatedToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:46", "kind": "call"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:123-127
  123      activeMeasurementWebhook();
  124  
  125      app(WebhookService::class)->sendCreatedToWebhook($product->fresh(), $changes);
  126  
  127      Http::assertSent(function ($request) use ($attribute, $family, $sku): bool {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:44-48
   44       * Send a product.created event to every subscribed webhook.
   45       */
   46      public function sendCreatedToWebhook(Product $product, array $productChanges = []): ?Response
   47      {
   48          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_CREATED);


===== EDGE E5a3b36776c =====
{"id": "E5a3b36776c", "from": "packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:107", "to_symbol": "VisionService", "to": "packages/Webkul/AiAgent/src/Services/VisionService.php:33", "kind": "framework", "note": "container scoped binding"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:105-109
  105          $this->app->bind(PromptBuilderContract::class, PromptBuilder::class);
  106  
  107          $this->app->scoped(VisionService::class);
  108          $this->app->scoped(EnrichmentService::class);
  109          $this->app->scoped(ProductWriterService::class);
--- packages/Webkul/AiAgent/src/Services/VisionService.php:31-35
   31   *   • generic   — URL-in-text fallback for any other provider
   32   */
   33  class VisionService
   34  {
   35      /**


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


===== EDGE E62271c8b2a =====
{"id": "E62271c8b2a", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiConfigurableProductTest.php:248", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiConfigurableProductTest.php:246-250
  246      ];
  247  
  248      $this->withHeaders($this->headers)->json('POST', route('admin.api.configrable_products.store'), $product)
  249          ->assertCreated()
  250          ->assertJsonStructure([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');


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


===== EDGE E63881cf4c2 =====
{"id": "E63881cf4c2", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:454", "to_symbol": "AiProvider::ssrfGuardedOptions", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:420", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:452-456
  452          foreach (["{$base}/openai/v1/models?api-version=preview", "{$base}/openai/models?api-version=2024-10-21"] as $url) {
  453              try {
  454                  $response = $client->get($url, $this->ssrfGuardedOptions($url, [
  455                      'headers' => [
  456                          'api-key'      => $apiKey,
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:418-422
  418       * @return array<string, mixed>
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));


===== EDGE E63b1ade8b4 =====
{"id": "E63b1ade8b4", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:224", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php:222-226
  222      ])->assertStatus(201);
  223  
  224      $this->withHeaders($this->headers)->json('POST', route('admin.api.products.store'), [
  225          'parent'  => 'vsr11-group',
  226          'family'  => $family->code,
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


===== EDGE E63d47a9949 =====
{"id": "E63d47a9949", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:16", "to_symbol": "AdminApi ProductController", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:27", "kind": "use", "note": "extends ProductController"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:14-18
   14  use Webkul\Product\Type\AbstractType;
   15  
   16  class SimpleProductController extends ProductController
   17  {
   18      /**
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:25-29
   25  use Webkul\Product\Validator\ProductValuesValidator;
   26  
   27  class ProductController extends ApiController
   28  {
   29      /**


===== EDGE E650b5d8508 =====
{"id": "E650b5d8508", "from": "packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:63", "to_symbol": "ProductRepository::guardVariantLevelWrite", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:231", "kind": "call"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:61-65
   61      $repository = app(ProductRepository::class);
   62  
   63      expect(fn () => $repository->guardVariantLevelWrite($simple->fresh(), [$colorCode => 'green']))
   64          ->toThrow(ValidationException::class);
   65  });
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:229-233
  229       * @return array<string, mixed>
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);


===== EDGE E659796e8c5 =====
{"id": "E659796e8c5", "from": "packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:38", "to_symbol": "WebhookService::sendCreatedToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:46", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:36-40
   36      $product = Product::factory()->create();
   37  
   38      app(WebhookService::class)->sendCreatedToWebhook($product);
   39  
   40      Http::assertSent(fn ($request) => str_contains($request->url(), '1.1.1.1'));
--- packages/Webkul/Webhook/src/Services/WebhookService.php:44-48
   44       * Send a product.created event to every subscribed webhook.
   45       */
   46      public function sendCreatedToWebhook(Product $product, array $productChanges = []): ?Response
   47      {
   48          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_CREATED);


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


===== EDGE E664aedc883 =====
{"id": "E664aedc883", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductLinksViewTest.php:288", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductLinksViewTest.php:286-290
  286      ];
  287  
  288      $this->put(route('admin.catalog.products.update', $product->id), $data)
  289          ->assertRedirect()
  290          ->assertSessionHas('success', trans('admin::app.catalog.products.update-success'));
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


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


===== EDGE E67c056dd84 =====
{"id": "E67c056dd84", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:40", "to_symbol": "WebhookService::fanOutSingle", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:110", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:38-42
   38      public function sendDataToWebhook(Product $product, array $productChanges = []): ?Response
   39      {
   40          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_UPDATED);
   41      }
   42  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:108-112
  108       * Build a single-product payload and deliver it to each subscribed webhook.
  109       */
  110      protected function fanOutSingle(Product $product, array $productChanges, string $event): ?Response
  111      {
  112          $webhooks = $this->webhookRepository->getActiveForEvent($event);


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


===== EDGE E69c8003833 =====
{"id": "E69c8003833", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php:36", "to_symbol": "SendBulkEditProductWebhook", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:11", "kind": "use"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php:34-38
   34  
   35      Queue::assertNotPushed(SendProductWebhook::class);
   36      Queue::assertPushed(SendBulkEditProductWebhook::class, 1);
   37  });
   38  
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:9-13
    9  use Webkul\Webhook\Services\WebhookService;
   10  
   11  class SendBulkEditProductWebhook implements ShouldQueue
   12  {
   13      use Queueable;


===== EDGE E6a18f8dc18 =====
{"id": "E6a18f8dc18", "from": "packages/Webkul/AiAgent/src/Services/AgentService.php:91", "to_symbol": "ExecuteAgentJob::handle", "to": "packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:49", "kind": "dispatch"}
--- packages/Webkul/AiAgent/src/Services/AgentService.php:89-93
   89          $enriched = $payload->withMetadata(['executionId' => $execution->id]);
   90  
   91          dispatch(new ExecuteAgentJob($enriched->toArray()));
   92      }
   93  
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:47-51
   47       * Execute the job.
   48       */
   49      public function handle(AgentService $agentService): void
   50      {
   51          $payload = AgentPayload::fromArray($this->payloadData);


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


===== EDGE E6acad05212 =====
{"id": "E6acad05212", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php:32", "to_symbol": "route admin.magic_ai.platform.update", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:117", "kind": "route", "note": "ACL test; request may be refused before validateApiUrl"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php:30-34
   30          $this->loginWithPermissions('custom', ['dashboard']);
   31  
   32          $this->putJson(route('admin.magic_ai.platform.update', $platform->id), [
   33              'label'    => 'x',
   34              'provider' => 'openai',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:115-119
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');
  118          Route::delete('{id}', 'destroy')->name('admin.magic_ai.platform.delete');
  119          Route::post('{id}/default', 'setDefault')->name('admin.magic_ai.platform.set_default');


===== EDGE E6c191af2fb =====
{"id": "E6c191af2fb", "from": "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1979", "to_symbol": "event 'data_transfer.imports.batch.product.updated.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:36", "kind": "dispatch"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1977-1981
 1977  
 1978          if ($updatedIds !== []) {
 1979              Event::dispatch('data_transfer.imports.batch.product.updated.after', [
 1980                  'product_id' => $updatedIds,
 1981              ]);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:34-38
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
   35  
   36          Event::listen('data_transfer.imports.batch.product.updated.after', [Product::class, 'afterBulkEditFromImport']);
   37  
   38          Event::listen('data_transfer.imports.batch.import.before', ImportBatch::class);


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


===== EDGE E6d82ed7500 =====
{"id": "E6d82ed7500", "from": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:34", "to_symbol": "Product::afterBulkCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:58", "kind": "framework", "note": "Event::listen('data_transfer.imports.batch.product.created.after')"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:32-36
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);
   33  
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
   35  
   36          Event::listen('data_transfer.imports.batch.product.updated.after', [Product::class, 'afterBulkEditFromImport']);
--- packages/Webkul/Webhook/src/Listeners/Product.php:56-60
   56      }
   57  
   58      public function afterBulkCreate(array $ids): void
   59      {
   60          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_CREATED);


===== EDGE E6dd3db1510 =====
{"id": "E6dd3db1510", "from": "packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:31", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:29-33
   29      $repository = app(ProductRepository::class);
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {


===== EDGE E6e6d90c78d =====
{"id": "E6e6d90c78d", "from": "packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateTreeTest.php:56", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Product/tests/Unit/Type/ConfigurableUpdateTreeTest.php:54-58
   54      [$configurable, $colorCode, $sizeCode] = makeTwoLevelConfigurable();
   55  
   56      app(ProductRepository::class)->update([
   57          'sku'            => $configurable->sku,
   58          'channel'        => 'default',
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


===== EDGE E7026fb28c5 =====
{"id": "E7026fb28c5", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:149", "to_symbol": "BulkProductUpdate::saveProducts", "to": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:172", "kind": "call"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:147-151
  147              $this->markValidated(count($this->updateProducts));
  148  
  149              $this->saveProducts($this->updateProducts, $products);
  150  
  151              $this->markCompleted();
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:170-174
  170       * @return void
  171       */
  172      protected function saveProducts(array $updateProducts, $products)
  173      {
  174          $processed = 0;


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


===== EDGE E70ce9c99f0 =====
{"id": "E70ce9c99f0", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiConfigurableProductTest.php:142", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiConfigurableProductTest.php:140-144
  140      ];
  141  
  142      $this->withHeaders($this->headers)->json('POST', route('admin.api.products.store'), $productData)
  143          ->assertNotFound()
  144          ->assertJsonStructure([
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


===== EDGE E714cc67c2d =====
{"id": "E714cc67c2d", "from": "packages/Webkul/Admin/tests/Feature/Acl/WriteRouteBypassRegressionTest.php:13", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Acl/WriteRouteBypassRegressionTest.php:11-15
   11      $this->loginWithPermissions(permissions: ['dashboard']);
   12  
   13      $this->put(route('admin.catalog.products.update', ['id' => 1]), [])
   14          ->assertStatus(403);
   15  });
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE E715ef96ba4 =====
{"id": "E715ef96ba4", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:225", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:223-227
  223          $product = $this->productRepository->create($data);
  224  
  225          Event::dispatch('catalog.product.create.after', $product);
  226  
  227          session()->flash('success', trans('admin::app.catalog.products.create-success'));
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E7299d51927 =====
{"id": "E7299d51927", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:152", "to_symbol": "WebhookService::getProductChangesForWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:366", "kind": "call", "note": "in sendBatch (140)"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:150-154
  150          foreach ($products as $product) {
  151              $productChanges = $computeChanges
  152                  ? $this->getProductChangesForWebhook($product)
  153                  : [];
  154  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:364-368
  364       * and fall back to the newest audit by id, still bounded by product freshness.
  365       */
  366      public function getProductChangesForWebhook(Product $product): array
  367      {
  368          $latestChanges = $this->recentProductAudits->for($product->getKey())


===== EDGE E7449c6c8a4 =====
{"id": "E7449c6c8a4", "from": "packages/Webkul/Admin/src/Resources/views/configuration/magic-ai/platform/index.blade.php:506", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route", "note": "frontend axios POST to the route"}
--- packages/Webkul/Admin/src/Resources/views/configuration/magic-ai/platform/index.blade.php:504-508
  504                          let requestedUrl = this.form.api_url || '';
  505  
  506                          this.$axios.post("{{ route('admin.magic_ai.platform.fetch_models') }}", {
  507                              provider: this.form.provider,
  508                              api_key: this.form.api_key,
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');