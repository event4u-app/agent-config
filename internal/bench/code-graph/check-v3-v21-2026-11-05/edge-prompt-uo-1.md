You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


Subject: `unopim` at its registered pin.



===== EDGE E762a88a2a0 =====
{"id": "E762a88a2a0", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:15", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route", "note": "ACL denial (403) before discovery; static route edge"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:13-17
   13      $this->loginWithPermissions(permissions: ['dashboard']);
   14  
   15      $this->postJson(route('admin.magic_ai.platform.fetch_models'), [
   16          'provider' => 'openai',
   17      ])->assertForbidden();
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');


===== EDGE E76498ecff4 =====
{"id": "E76498ecff4", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php:185", "to_symbol": "route admin.magic_ai.platform.update", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:117", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php:183-187
  183      ]);
  184  
  185      $this->putJson(route('admin.magic_ai.platform.update', $platform->id), [
  186          'label'    => 'Updated Label',
  187          'provider' => 'openai',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:115-119
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');
  118          Route::delete('{id}', 'destroy')->name('admin.magic_ai.platform.delete');
  119          Route::post('{id}/default', 'setDefault')->name('admin.magic_ai.platform.set_default');


===== EDGE E76b1816b3b =====
{"id": "E76b1816b3b", "from": "packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:16", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:14-18
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


===== EDGE E76b836df2b =====
{"id": "E76b836df2b", "from": "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:154", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:152-156
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


===== EDGE E78715b3bdf =====
{"id": "E78715b3bdf", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:74", "to_symbol": "WebhookService::deliverChunked", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:83", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:72-76
   72      public function sendBatchBySkus(array $skus): ?Response
   73      {
   74          return $this->deliverChunked('sku', $skus);
   75      }
   76  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:81-85
   81       * @param  array<int, int|string>  $values
   82       */
   83      protected function deliverChunked(string $field, array $values, bool $computeChanges = true, string $event = self::EVENT_PRODUCT_UPDATED, bool $skipIfNoChanges = true): ?Response
   84      {
   85          $lastResponse = null;


===== EDGE E79bcc517f3 =====
{"id": "E79bcc517f3", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:392", "to_symbol": "AiProvider::ssrfGuardedOptions", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:420", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:390-394
  390          ];
  391  
  392          $response = $client->get($url, $harden ? $this->ssrfGuardedOptions($url, $options) : $options);
  393  
  394          $data = json_decode($response->getBody()->getContents(), true);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:418-422
  418       * @return array<string, mixed>
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));


===== EDGE E7b8a8cb1dc =====
{"id": "E7b8a8cb1dc", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:291", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:289-293
  289          }
  290  
  291          Event::dispatch('catalog.product.create.after', $node);
  292  
  293          return new JsonResponse([
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


===== EDGE E7b9a70f5de =====
{"id": "E7b9a70f5de", "from": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:138", "to_symbol": "PlatformValidator::apiUrlError", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:118", "kind": "call"}
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:136-140
  136      public function validateApiUrl(?string $provider, ?string $apiUrl): void
  137      {
  138          if ($error = $this->apiUrlError($provider, $apiUrl)) {
  139              throw ValidationException::withMessages(['api_url' => $error]);
  140          }
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:116-120
  116       * unrelated host; any URL must pass the SSRF check.
  117       */
  118      public function apiUrlError(?string $provider, ?string $apiUrl): ?string
  119      {
  120          $apiUrl = trim((string) $apiUrl);


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


===== EDGE E7dc4b545f5 =====
{"id": "E7dc4b545f5", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:60", "to_symbol": "Product::dispatchBulkWebhook", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:68", "kind": "call"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:58-62
   58      public function afterBulkCreate(array $ids): void
   59      {
   60          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_CREATED);
   61      }
   62  
--- packages/Webkul/Webhook/src/Listeners/Product.php:66-70
   66      }
   67  
   68      protected function dispatchBulkWebhook(array $ids, string $event): void
   69      {
   70          if ($ids === [] || ! $this->webhookRepository->hasActiveForEvent($event)) {


===== EDGE E7de54e65f3 =====
{"id": "E7de54e65f3", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:159", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:157-161
  157              Event::dispatch('catalog.product.create.before');
  158              $product = $this->productRepository->create($data);
  159              Event::dispatch('catalog.product.create.after', $product);
  160  
  161              $product = $this->updateProduct($data, $product);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


===== EDGE E7eff03a8b4 =====
{"id": "E7eff03a8b4", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php:23", "to_symbol": "route admin.magic_ai.platform.test", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:114", "kind": "route"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php:21-25
   21      AnonymousAgent::fake(['OK']);
   22  
   23      postJson(route('admin.magic_ai.platform.test'), testConnectionPayload())
   24          ->assertOk()
   25          ->assertJson(['success' => true]);
--- packages/Webkul/Admin/src/Routes/rest-routes.php:112-116
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');


===== EDGE E7f3a8547cd =====
{"id": "E7f3a8547cd", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:175", "to_symbol": "WebhookService::deliver", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:187", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:173-177
  173  
  174          foreach ($webhooks as $webhook) {
  175              $lastResponse = $this->deliver($webhook, $payload, null, $event, $products);
  176          }
  177  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:185-189
  185       *                                          log row is written per product.
  186       */
  187      protected function deliver(Webhook $webhook, array $payload, ?string $sku, string $event, $batchProducts = null): ?Response
  188      {
  189          $safety = SafeWebhookUrl::validate($webhook->url);


===== EDGE E822d820d8f =====
{"id": "E822d820d8f", "from": "packages/Webkul/AiAgent/src/Agents/ProductCategorizerAgent.php:19", "to_symbol": "BaseAgent", "to": "packages/Webkul/AiAgent/src/Agents/BaseAgent.php:20", "kind": "use", "note": "extends BaseAgent (inherits execute)"}
--- packages/Webkul/AiAgent/src/Agents/ProductCategorizerAgent.php:17-21
   17   *   );
   18   */
   19  class ProductCategorizerAgent extends BaseAgent
   20  {
   21      /**
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:18-22
   18   *   - BulkProductEnricherAgent
   19   */
   20  abstract class BaseAgent
   21  {
   22      public function __construct(


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


===== EDGE E87129d142a =====
{"id": "E87129d142a", "from": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:32", "to_symbol": "Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "framework", "note": "Event::listen('catalog.product.bulk.edit.after')"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30-34
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);
   33  
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
--- packages/Webkul/Webhook/src/Listeners/Product.php:82-86
   82       * @param  array<int>  $ids
   83       */
   84      public function afterBulkEdit(array $ids): void
   85      {
   86          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_UPDATED)) {


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


===== EDGE E883d8b676a =====
{"id": "E883d8b676a", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementScopeTest.php:197", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementScopeTest.php:195-199
  195  
  196      request()->merge(['locale' => 'en_US']);
  197      app(ProductRepository::class)->update([
  198          'values' => [
  199              'locale_specific' => [
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE E893ae1f0fa =====
{"id": "E893ae1f0fa", "from": "packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:52", "to_symbol": "SendBulkProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:29", "kind": "call"}
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:50-54
   50  
   51      (new SendBulkProductWebhook([$first->id, $second->id], null, WebhookService::EVENT_PRODUCT_UPDATED))
   52          ->handle(app(WebhookService::class));
   53  
   54      expect(WebhookLog::whereIn('sku', ['IMPORT-UPD-2', 'IMPORT-UPD-3'])
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:27-31
   27       * Execute the job.
   28       */
   29      public function handle(WebhookService $webhookService): void
   30      {
   31          if ($this->userId && ($user = AdminProxy::find($this->userId))) {


===== EDGE E893aff5dbd =====
{"id": "E893aff5dbd", "from": "packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:19", "to_symbol": "AiProvider::discoverModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:201", "kind": "call"}
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:17-21
   17      public function discover(AiProvider $provider, ?string $apiKey, ?string $apiUrl): array
   18      {
   19          return $provider->discoverModels($apiKey, $apiUrl);
   20      }
   21  }
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:199-203
  199       * @return array{models: list<string>, released: array<string, int|null>, api_url: string}
  200       */
  201      public function discoverModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  202      {
  203          $client ??= new Client(['timeout' => 15]);


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


===== EDGE E8a434b4073 =====
{"id": "E8a434b4073", "from": "packages/Webkul/Product/src/Type/Configurable.php:16", "to_symbol": "AbstractType", "to": "packages/Webkul/Product/src/Type/AbstractType.php:23", "kind": "use", "note": "class Configurable extends AbstractType"}
--- packages/Webkul/Product/src/Type/Configurable.php:14-18
   14  use Webkul\Product\Repositories\ProductRepository;
   15  
   16  class Configurable extends AbstractType
   17  {
   18      /**
--- packages/Webkul/Product/src/Type/AbstractType.php:21-25
   21  use Webkul\Product\Validator\AssociationValidator;
   22  
   23  abstract class AbstractType
   24  {
   25      use HtmlPurifier;


===== EDGE E8ac90fc842 =====
{"id": "E8ac90fc842", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php:115", "to_symbol": "route admin.magic_ai.platform.update", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:117", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php:113-117
  113  
  114  it('returns clean 404 JSON when updating a deleted platform', function () {
  115      $response = $this->putJson(route('admin.magic_ai.platform.update', 99999), [
  116          'label'    => 'Ghost',
  117          'provider' => 'openai',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:115-119
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');
  118          Route::delete('{id}', 'destroy')->name('admin.magic_ai.platform.delete');
  119          Route::post('{id}/default', 'setDefault')->name('admin.magic_ai.platform.set_default');


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


===== EDGE E8c06ce62fb =====
{"id": "E8c06ce62fb", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:40", "to_symbol": "Product::afterUpdate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:24", "kind": "call", "note": "Queue::fake()"}
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


===== EDGE E8c0e2789e6 =====
{"id": "E8c0e2789e6", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:358", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:356-360
  356  
  357                      if ($variant) {
  358                          Event::dispatch('catalog.product.create.after', $variant);
  359                      }
  360                  } else {
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E8f870cb018 =====
{"id": "E8f870cb018", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:50", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:48-52
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


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


===== EDGE E90ce8fb441 =====
{"id": "E90ce8fb441", "from": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:96", "to_symbol": "AiApiClient::execute", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:128", "kind": "call"}
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:94-98
   94          $body = $this->buildChatBody($messages, $maxTokens, $temperature);
   95  
   96          $response = $this->execute('POST', $endpoint, $body);
   97  
   98          return $this->parseChatResponse($response);
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:126-130
  126       * @throws ApiException
  127       */
  128      protected function execute(string $method, string $url, ?array $data = null): array
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.


===== EDGE E90d8c6987f =====
{"id": "E90d8c6987f", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductZeroAttributeValueTest.php:19", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductZeroAttributeValueTest.php:17-21
   17  function updateProductCommonValues(Product $product, array $values): void
   18  {
   19      test()->put(route('admin.catalog.products.update', $product->id), [
   20          'sku'    => $product->sku,
   21          'values' => ['common' => $values],
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE E90f58a21ad =====
{"id": "E90f58a21ad", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditMediaPathTest.php:40", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditMediaPathTest.php:38-42
   38      ];
   39  
   40      $this->postJson(route('admin.catalog.products.bulk-edit.save'), ['data' => $payload])
   41          ->assertOk();
   42  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


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


===== EDGE E9231e41944 =====
{"id": "E9231e41944", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:495", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:493-497
  493              $variant = $configurable->getTypeInstance()->createVariant($configurable, $axisAttributes, $variantData);
  494  
  495              Event::dispatch('catalog.product.create.after', $variant);
  496  
  497              return $variant;
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE E9808b8a1bd =====
{"id": "E9808b8a1bd", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:205", "to_symbol": "SafeWebhookUrl::httpOptions", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:203-207
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:91-95
   91       * @return array<string, mixed>
   92       */
   93      public static function httpOptions(string $url): array
   94      {
   95          $options = ['allow_redirects' => false];


===== EDGE E98c48f1d70 =====
{"id": "E98c48f1d70", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:339", "to_symbol": "ProductBulkEditController::validateVariantLevelValues", "to": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:439", "kind": "call"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:337-341
  337  
  338          if (empty($errors)) {
  339              $errors = $this->validateVariantLevelValues($data['data'] ?? []);
  340          }
  341  
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:437-441
  437       * @return array<string, array<int, string>>
  438       */
  439      protected function validateVariantLevelValues(array $data): array
  440      {
  441          $productIds = array_filter(array_keys($data), 'is_numeric');


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


===== EDGE E98eae01845 =====
{"id": "E98eae01845", "from": "packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:52", "to_symbol": "AutoEnrichProductJob::enrich", "to": "packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:58", "kind": "call"}
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:50-54
   50  
   51          try {
   52              $this->enrich($enrichmentService, $platformRepository);
   53          } finally {
   54              $lock->release();
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:56-60
   56      }
   57  
   58      protected function enrich(
   59          EnrichmentService $enrichmentService,
   60          MagicAIPlatformRepository $platformRepository,


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


===== EDGE E9bf8d91d07 =====
{"id": "E9bf8d91d07", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:47", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:45-49
   45      $this->loginAsAdmin();
   46  
   47      $this->postJson(route('admin.magic_ai.platform.store'), [
   48          'provider' => AiProvider::Custom->value,
   49          'label'    => 'ssrf',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


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


===== EDGE Ea077016ed1 =====
{"id": "Ea077016ed1", "from": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:357", "to_symbol": "BulkProductUpdate::handle", "to": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:100", "kind": "dispatch"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:355-359
  355          $userId = auth()->guard('admin')->user()->id;
  356  
  357          BulkProductUpdate::dispatch($data['data'], $userId);
  358  
  359          session()->forget('bulk_edit_product_ids');
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:98-102
   98       * Handle the bulk product update job.
   99       */
  100      public function handle(): void
  101      {
  102          if ($this->userId && ($admin = AdminProxy::find($this->userId))) {


===== EDGE Ea0a0a258e8 =====
{"id": "Ea0a0a258e8", "from": "packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:45", "to_symbol": "WebhookService::sendDataToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:38", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:43-47
   43      $product = Product::factory()->create();
   44  
   45      app(WebhookService::class)->sendDataToWebhook($product);
   46  
   47      $log = DB::table('webhook_logs')->where('sku', $product->sku)->first();
--- packages/Webkul/Webhook/src/Services/WebhookService.php:36-40
   36       * Send a product.updated event to every subscribed webhook.
   37       */
   38      public function sendDataToWebhook(Product $product, array $productChanges = []): ?Response
   39      {
   40          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_UPDATED);


===== EDGE Ea1a9484334 =====
{"id": "Ea1a9484334", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementValidationMatrixTest.php:112", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementValidationMatrixTest.php:110-114
  110      $product = Product::factory()->withInitialValues()->create();
  111  
  112      app(ProductRepository::class)->update([
  113          'values' => [
  114              'common' => [
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE Ea2771be24f =====
{"id": "Ea2771be24f", "from": "packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:9", "to_symbol": "WebhookService", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:22", "kind": "use", "note": "ChunkedWebhookService extends WebhookService"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:7-11
    7  
    8  // Small chunk size to prove a large selection is delivered in bounded chunks, not one oversized request.
    9  class ChunkedWebhookService extends WebhookService
   10  {
   11      protected function batchChunkSize(): int
--- packages/Webkul/Webhook/src/Services/WebhookService.php:20-24
   20   * and records a per-webhook delivery log.
   21   */
   22  class WebhookService
   23  {
   24      public const EVENT_PRODUCT_CREATED = 'product.created';


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


===== EDGE Ea5c3f21636 =====
{"id": "Ea5c3f21636", "from": "packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php:25", "to_symbol": "CredentialForm::rules", "to": "packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:27", "kind": "call"}
--- packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php:23-27
   23      $validator = Validator::make(
   24          credentialPayload('http://169.254.169.254/latest/meta-data'),
   25          (new CredentialForm)->rules()
   26      );
   27  
--- packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:25-29
   25       * @return array<string, mixed>
   26       */
   27      public function rules(): array
   28      {
   29          return [


===== EDGE Ea604882a26 =====
{"id": "Ea604882a26", "from": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:36", "to_symbol": "Product::afterBulkEditFromImport", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:63", "kind": "framework", "note": "Event::listen('data_transfer.imports.batch.product.updated.after')"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:34-38
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
   35  
   36          Event::listen('data_transfer.imports.batch.product.updated.after', [Product::class, 'afterBulkEditFromImport']);
   37  
   38          Event::listen('data_transfer.imports.batch.import.before', ImportBatch::class);
--- packages/Webkul/Webhook/src/Listeners/Product.php:61-65
   61      }
   62  
   63      public function afterBulkEditFromImport(array $ids): void
   64      {
   65          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_UPDATED);


===== EDGE Eaa483745b9 =====
{"id": "Eaa483745b9", "from": "packages/Webkul/AiAgent/src/Services/AgentService.php:120", "to_symbol": "CallAiProviderStage", "to": "packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:16", "kind": "use", "note": "default pipeline stage list"}
--- packages/Webkul/AiAgent/src/Services/AgentService.php:118-122
  118              ValidateInputStage::class,
  119              BuildPromptStage::class,
  120              CallAiProviderStage::class,
  121              ParseResponseStage::class,
  122              LogExecutionStage::class,
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:14-18
   14   * the response to the payload metadata.
   15   */
   16  class CallAiProviderStage implements PipelineStageContract
   17  {
   18      public function __construct(


===== EDGE Eae7b2ea98a =====
{"id": "Eae7b2ea98a", "from": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:147", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:145-149
  145          $apiUrl = trim((string) $apiUrl);
  146  
  147          return $apiUrl === '' || SafeWebhookUrl::validate($apiUrl)['valid'];
  148      }
  149  
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


===== EDGE Eaf8acbf2f1 =====
{"id": "Eaf8acbf2f1", "from": "packages/Webkul/AiAgent/Routes/ai-agent-routes.php:53", "to_symbol": "ExecutionController::execute", "to": "packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:20", "kind": "route"}
--- packages/Webkul/AiAgent/Routes/ai-agent-routes.php:51-55
   51  
   52          // ── Execution ────────────────────────────────────────
   53          Route::post('execute', [ExecutionController::class, 'execute'])
   54              ->name('execute');
   55  
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:18-22
   18       * Execute an agent (synchronously or via queue).
   19       */
   20      public function execute(ExecuteAgentForm $request): JsonResponse
   21      {
   22          $data = $request->validated();


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


===== EDGE Eafc400111c =====
{"id": "Eafc400111c", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:28", "to_symbol": "CollectsPlatform", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:29", "kind": "use", "note": "trait"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:26-30
   26  class EditPlatform extends PlatformCommand
   27  {
   28      use ChoosesPlatform, CollectsPlatform;
   29  
   30      protected function perform(): int
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:27-31
   27   * repository with the form's validation.
   28   */
   29  trait CollectsPlatform
   30  {
   31      protected const AZURE_DEPLOYMENT = 'gpt-4o';


===== EDGE Eb1da14d1a2 =====
{"id": "Eb1da14d1a2", "from": "packages/Webkul/AiAgent/Routes/ai-agent-routes.php:49", "to_symbol": "GenerateController::process", "to": "packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:35", "kind": "route"}
--- packages/Webkul/AiAgent/Routes/ai-agent-routes.php:47-51
   47              ->name('generate.index');
   48  
   49          Route::post('generate', [GenerateController::class, 'process'])
   50              ->name('generate.process');
   51  
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:33-37
   33       * Process uploaded images and generate a product.
   34       */
   35      public function process(GenerateForm $request): JsonResponse
   36      {
   37          $validated = $request->validated();


===== EDGE Eb23fdfd5b1 =====
{"id": "Eb23fdfd5b1", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:380", "to_symbol": "AiProvider::ssrfGuardedOptions", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:420", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:378-382
  378      private function discoveryOptions(string $url, ?string $apiUrl, array $options): array
  379      {
  380          return $apiUrl ? $this->ssrfGuardedOptions($url, $options) : $options;
  381      }
  382  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:418-422
  418       * @return array<string, mixed>
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));


===== EDGE Eb242ea2485 =====
{"id": "Eb242ea2485", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:244", "to_symbol": "event 'catalog.product.create.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:242-246
  242          }
  243  
  244          Event::dispatch('catalog.product.create.after', $node);
  245  
  246          return $this->successResponse(
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);


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


===== EDGE Eb2a4a87853 =====
{"id": "Eb2a4a87853", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductValuesTest.php:57", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductValuesTest.php:55-59
   55      ];
   56  
   57      $this->put(route('admin.catalog.products.update', ['id' => $product->id, 'channel' => $newChannelCode, 'locale' => $newChannelLocale]), $data)
   58          ->assertRedirect(route('admin.catalog.products.edit', ['id' => $product->id, 'channel' => $newChannelCode, 'locale' => $newChannelLocale]))
   59          ->assertSessionHas('success', trans('admin::app.catalog.products.update-success'));
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE Eb2eb0bff57 =====
{"id": "Eb2eb0bff57", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:65", "to_symbol": "Product::dispatchBulkWebhook", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:68", "kind": "call"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:63-67
   63      public function afterBulkEditFromImport(array $ids): void
   64      {
   65          $this->dispatchBulkWebhook($ids, WebhookService::EVENT_PRODUCT_UPDATED);
   66      }
   67  
--- packages/Webkul/Webhook/src/Listeners/Product.php:66-70
   66      }
   67  
   68      protected function dispatchBulkWebhook(array $ids, string $event): void
   69      {
   70          if ($ids === [] || ! $this->webhookRepository->hasActiveForEvent($event)) {


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


===== EDGE Eb4d4dddd21 =====
{"id": "Eb4d4dddd21", "from": "packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:40", "to_symbol": "event 'data_transfer.imports.batch.product.updated.after' (listener registration)", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:36", "kind": "dispatch", "note": "Queue::fake: bulk job pushed, not run"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:38-42
   38      subscribeWebhook([WebhookService::EVENT_PRODUCT_UPDATED]);
   39  
   40      Event::dispatch('data_transfer.imports.batch.product.updated.after', ['product_id' => [3]]);
   41  
   42      Queue::assertPushed(SendBulkProductWebhook::class, 1);
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:34-38
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);
   35  
   36          Event::listen('data_transfer.imports.batch.product.updated.after', [Product::class, 'afterBulkEditFromImport']);
   37  
   38          Event::listen('data_transfer.imports.batch.import.before', ImportBatch::class);


===== EDGE Eb554b55c1c =====
{"id": "Eb554b55c1c", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:154", "to_symbol": "CollectsPlatform::fetchModels", "to": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:195", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:152-156
  152      protected function askModels(AiProvider $provider, ?string $apiKey, string $apiUrl, array $stored): array
  153      {
  154          $fetched = $this->fetchModels($provider, $apiKey, $apiUrl);
  155  
  156          if ($fetched === []) {
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:193-197
  193       * @return string[]
  194       */
  195      protected function fetchModels(AiProvider $provider, ?string $apiKey, string $apiUrl): array
  196      {
  197          try {


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


===== EDGE Eb7e4f586ea =====
{"id": "Eb7e4f586ea", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:403", "to_symbol": "ProductController::createVariantUnderGroup", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:428", "kind": "call", "note": "in createOrUpdateVariant (398)"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:401-405
  401  
  402          if ($parentProduct->type === ProductType::VariantGroup->value) {
  403              return $this->createVariantUnderGroup($parentProduct, $data);
  404          }
  405  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:426-430
  426       * @throws UnprocessableEntityHttpException
  427       */
  428      protected function createVariantUnderGroup(Product $group, array $data): Product
  429      {
  430          $configurable = $group->parent;


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


===== EDGE Eb94c1a2463 =====
{"id": "Eb94c1a2463", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:58", "to_symbol": "Product::afterBulkEdit", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:84", "kind": "call", "note": "Queue::fake()"}
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


===== EDGE Eb96dad40f9 =====
{"id": "Eb96dad40f9", "from": "packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:63", "to_symbol": "AiProvider::fetchModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:144", "kind": "call"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:61-65
   61      ], $history);
   62  
   63      $models = AiProvider::OpenAI->fetchModels('sk-test', 'https://proxy.test/v1', $client);
   64  
   65      expect($models)->toBe(['dall-e-3', 'gpt-4o'])
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:142-146
  142       * @return list<string>
  143       */
  144      public function fetchModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  145      {
  146          return array_map(strval(...), array_keys($this->fetchModelCatalog($apiKey, $apiUrl, $client)));


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


===== EDGE Eb9c3a0d5ed =====
{"id": "Eb9c3a0d5ed", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementApiCoverageTest.php:73", "to_symbol": "route admin.api.products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:130", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementApiCoverageTest.php:71-75
   71  
   72      $this->withHeaders($this->headers)
   73          ->json('POST', route('admin.api.products.store'), $payload)
   74          ->assertStatus(201)
   75          ->assertJsonFragment(['success' => true]);
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:128-132
  128          Route::get('', 'index')->name('admin.api.products.index');
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');


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


===== EDGE Ebb785b5754 =====
{"id": "Ebb785b5754", "from": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:271", "to_symbol": "event 'catalog.product.bulk.edit.after' (listener registration)", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:32", "kind": "dispatch", "note": "Event::dispatch"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:269-273
  269  
  270          if ($productIds !== []) {
  271              Event::dispatch('catalog.product.bulk.edit.after', ['ids' => $productIds]);
  272          }
  273  
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30-34
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);
   33  
   34          Event::listen('data_transfer.imports.batch.product.created.after', [Product::class, 'afterBulkCreate']);


===== EDGE Ebba4e72bde =====
{"id": "Ebba4e72bde", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php:78", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php:76-80
   76  function putCommonValuesForCombinationTest($test, Product $product, array $commonValues)
   77  {
   78      return $test->put(route('admin.catalog.products.update', $product->id), [
   79          'sku'    => $product->sku,
   80          'values' => [
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE Ebbedb05a89 =====
{"id": "Ebbedb05a89", "from": "packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:93", "to_symbol": "AiApiClient", "to": "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:16", "kind": "use", "note": "resolve(AiApiClient::class); passed to EnrichmentService::enrich"}
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:91-95
   91          try {
   92              $aiProvider = AiProvider::from($platform->provider);
   93              $apiClient = resolve(AiApiClient::class);
   94              $apiClient->configure(new CredentialConfig(
   95                  id: $platform->id,
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:14-18
   14   * Unopim connectors use native cURL — NOT Guzzle or Laravel HTTP facade.
   15   */
   16  class AiApiClient
   17  {
   18      /**


===== EDGE Ebc48e92288 =====
{"id": "Ebc48e92288", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:56", "to_symbol": "WebhookService::deliverChunked", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:83", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:54-58
   54      public function sendBatchByIds(array $ids): ?Response
   55      {
   56          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);
   57      }
   58  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:81-85
   81       * @param  array<int, int|string>  $values
   82       */
   83      protected function deliverChunked(string $field, array $values, bool $computeChanges = true, string $event = self::EVENT_PRODUCT_UPDATED, bool $skipIfNoChanges = true): ?Response
   84      {
   85          $lastResponse = null;


===== EDGE Ebc76b34024 =====
{"id": "Ebc76b34024", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductMediaReplaceTest.php:45", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductMediaReplaceTest.php:43-47
   43          Storage::fake();
   44  
   45          $uri = route('admin.catalog.products.update', $product->id);
   46  
   47          submitProductForm($uri, ['sku' => $product->sku], [
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE Ebc9233449b =====
{"id": "Ebc9233449b", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php:41", "to_symbol": "route admin.magic_ai.platform.store", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "kind": "route"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php:39-43
   39      $this->loginWithPermissions('all');
   40  
   41      postJson(route('admin.magic_ai.platform.store'), platformPayload())->assertOk();
   42  
   43      $platform = MagicAIPlatform::firstWhere('label', 'Primary OpenAI');
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');


===== EDGE Ebcb1bfd308 =====
{"id": "Ebcb1bfd308", "from": "packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:199", "to_symbol": "ModelDiscovery::discover", "to": "packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:17", "kind": "call"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:197-201
  197          try {
  198              $models = spin(
  199                  fn (): array => resolve(ModelDiscovery::class)->discover($provider, $apiKey, $apiUrl ?: null)['models'],
  200                  trans('admin::app.configuration.platform.command.fetching-models', ['provider' => $provider->label()]),
  201              );
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:15-19
   15       * @throws \RuntimeException
   16       */
   17      public function discover(AiProvider $provider, ?string $apiKey, ?string $apiUrl): array
   18      {
   19          return $provider->discoverModels($apiKey, $apiUrl);


===== EDGE Ebd27f737da =====
{"id": "Ebd27f737da", "from": "packages/Webkul/Product/src/Repositories/ProductRepository.php:301", "to_symbol": "ProductRepository::isUniqueVariantForProduct", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184", "kind": "call", "note": "inside guardVariantLevelWrite (231)"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:299-303
  299              $this->getModel()::query()->whereKey($product->parent_id)->lockForUpdate()->exists();
  300  
  301              if (! $this->isUniqueVariantForProduct($product->parent_id, $newTuple, null, $product->id, $product->type)) {
  302                  throw ValidationException::withMessages([
  303                      'axis' => [trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($newTuple)])],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:182-186
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {


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


===== EDGE Ec1ef41ea7b =====
{"id": "Ec1ef41ea7b", "from": "packages/Webkul/Admin/src/Routes/rest-routes.php:113", "to_symbol": "MagicAIPlatformController::store", "to": "packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:61", "kind": "route"}
--- packages/Webkul/Admin/src/Routes/rest-routes.php:111-115
  111      Route::controller(MagicAIPlatformController::class)->prefix('magic-ai/platforms')->group(function () {
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:59-63
   59      }
   60  
   61      public function store(PlatformRequest $request): JsonResponse
   62      {
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);


===== EDGE Ec2ca72045b =====
{"id": "Ec2ca72045b", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductZeroAttributeValueTest.php:66", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductZeroAttributeValueTest.php:64-68
   64      $product = productWithAttribute($attribute);
   65  
   66      $product = app(ProductRepository::class)->update([
   67          'sku'    => $product->sku,
   68          'values' => ['common' => [$attribute->code => ['0', $otherCode]]],
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


===== EDGE Ec3452583c9 =====
{"id": "Ec3452583c9", "from": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:30", "to_symbol": "Product::afterCreate", "to": "packages/Webkul/Webhook/src/Listeners/Product.php:43", "kind": "framework", "note": "Event::listen('catalog.product.create.after')"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-32
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);
   31  
   32          Event::listen('catalog.product.bulk.edit.after', [Product::class, 'afterBulkEdit']);
--- packages/Webkul/Webhook/src/Listeners/Product.php:41-45
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
   44      {
   45          if (! $this->webhookRepository->hasActiveForEvent(WebhookService::EVENT_PRODUCT_CREATED)) {


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


===== EDGE Ec5464bd6e7 =====
{"id": "Ec5464bd6e7", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:32", "to_symbol": "AiProvider::discoverModels", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:201", "kind": "call"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:30-34
   30      ], $reached);
   31  
   32      $discovery = AiProvider::Custom->discoverModels('sk-test-key', 'https://1.1.1.1', $client);
   33  
   34      expect($discovery['models'])->toBe(['gpt-4o-mini']);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:199-203
  199       * @return array{models: list<string>, released: array<string, int|null>, api_url: string}
  200       */
  201      public function discoverModels(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  202      {
  203          $client ??= new Client(['timeout' => 15]);


===== EDGE Ec57c193ac9 =====
{"id": "Ec57c193ac9", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiSimpleProductAxisGuardTest.php:44", "to_symbol": "route admin.api.products.update", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:131", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiSimpleProductAxisGuardTest.php:42-46
   42      $simple->save();
   43  
   44      $this->withHeaders($this->headers)->json('PUT', route('admin.api.products.update', 'rest-simple'), [
   45          'family' => $family->code,
   46          'values' => ['common' => ['sku' => 'rest-simple', $material->code => 'wood']],
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:129-133
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');


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


===== EDGE Ec626a2a652 =====
{"id": "Ec626a2a652", "from": "packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:26", "to_symbol": "WebhookService::sendBatchForBulkEdit", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:64", "kind": "call"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:24-28
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
--- packages/Webkul/Webhook/src/Services/WebhookService.php:62-66
   62      }
   63  
   64      public function sendBatchForBulkEdit(array $ids): ?Response
   65      {
   66          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);


===== EDGE Ec64ab8f39a =====
{"id": "Ec64ab8f39a", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:206", "to_symbol": "AiProvider::fetchModelCatalog", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:155", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:204-208
  204  
  205          if ($this !== self::Custom) {
  206              return $this->discovery($this->fetchModelCatalog($apiKey, $apiUrl, $client), (string) $apiUrl);
  207          }
  208  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:153-157
  153       * @return array<string, int|null>
  154       */
  155      public function fetchModelCatalog(?string $apiKey, ?string $apiUrl = null, ?Client $client = null): array
  156      {
  157          $client ??= new Client(['timeout' => 15]);


===== EDGE Ec6da11f8df =====
{"id": "Ec6da11f8df", "from": "packages/Webkul/AdminApi/tests/Feature/Acl/ConfigurableProductScopeBypassTest.php:40", "to_symbol": "route admin.api.configurable_products.store", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:151", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Acl/ConfigurableProductScopeBypassTest.php:38-42
   38  
   39  dataset('configurable write routes', [
   40      'store (correct prefix)'  => ['POST', 'admin.api.configurable_products.store', null],
   41      'update (correct prefix)' => ['PUT', 'admin.api.configurable_products.update', 'sku-x'],
   42      'patch (correct prefix)'  => ['PATCH', 'admin.api.configurable_products.patch', 'sku-x'],
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:149-153
  149              Route::get('', 'index')->name('admin.api.'.$nameSuffix.'.index');
  150              Route::get('{code}', 'get')->name('admin.api.'.$nameSuffix.'.get');
  151              Route::post('', 'store')->name('admin.api.'.$nameSuffix.'.store');
  152              Route::put('{code}', 'update')->name('admin.api.'.$nameSuffix.'.update');
  153              Route::delete('{code}', 'delete')->name('admin.api.'.$nameSuffix.'.delete');


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


===== EDGE Ec7c44c20e9 =====
{"id": "Ec7c44c20e9", "from": "packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:8", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:6-10
    6      // Public IP literal — bypasses DNS so the test is deterministic in
    7      // network-restricted CI. 1.1.1.1 is in public unicast space.
    8      $result = SafeWebhookUrl::validate('https://1.1.1.1/inbound');
    9  
   10      expect($result['valid'])->toBeTrue();
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


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


===== EDGE Ec92c5fe0e0 =====
{"id": "Ec92c5fe0e0", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:55", "to_symbol": "SendProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:31", "kind": "dispatch"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:53-57
   53          }
   54  
   55          dispatch(new SendProductWebhook($product->id, $changes, 'created', auth('admin')?->user()?->id))->onQueue('webhooks');
   56      }
   57  
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:29-33
   29      ) {}
   30  
   31      public function handle(WebhookService $webhookService): void
   32      {
   33          $product = ProductProxy::find($this->productId);


===== EDGE Eca2fede12a =====
{"id": "Eca2fede12a", "from": "packages/Webkul/Measurement/tests/Feature/ProductMeasurementValidationTest.php:94", "to_symbol": "ProductRepository::update", "to": "packages/Webkul/Product/src/Repositories/ProductRepository.php:57", "kind": "call", "note": "outside pool"}
--- packages/Webkul/Measurement/tests/Feature/ProductMeasurementValidationTest.php:92-96
   92      $product = Product::factory()->withInitialValues()->create();
   93  
   94      app(ProductRepository::class)->update([
   95          'values' => ['common' => [$attribute->code => ['value' => '0', 'unit' => 'meter']]],
   96      ], $product->id);
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:55-59
   55       * @return Product
   56       */
   57      public function update(array $data, $id, $attribute = 'id')
   58      {
   59          $product = $this->findOrFail($id);


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


===== EDGE Ecc49112a5b =====
{"id": "Ecc49112a5b", "from": "packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:170", "to_symbol": "WebhookService::sendDataToWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:38", "kind": "call"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:168-172
  168      $webhook = activeMeasurementWebhook();
  169  
  170      app(WebhookService::class)->sendDataToWebhook($product->fresh(), $changes);
  171  
  172      $log = WebhookLog::where('webhook_id', $webhook->id)->where('sku', $sku)->latest()->first();
--- packages/Webkul/Webhook/src/Services/WebhookService.php:36-40
   36       * Send a product.updated event to every subscribed webhook.
   37       */
   38      public function sendDataToWebhook(Product $product, array $productChanges = []): ?Response
   39      {
   40          return $this->fanOutSingle($product, $productChanges, self::EVENT_PRODUCT_UPDATED);


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


===== EDGE Ecc9047f939 =====
{"id": "Ecc9047f939", "from": "packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php:25", "to_symbol": "SendBulkEditProductWebhook", "to": "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:11", "kind": "use"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php:23-27
   23      app(ProductListener::class)->afterBulkEdit([1, 2, 3]);
   24  
   25      Queue::assertPushed(SendBulkEditProductWebhook::class);
   26  });
   27  
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:9-13
    9  use Webkul\Webhook\Services\WebhookService;
   10  
   11  class SendBulkEditProductWebhook implements ShouldQueue
   12  {
   13      use Queueable;


===== EDGE Ecf1f05c33b =====
{"id": "Ecf1f05c33b", "from": "packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:110", "to_symbol": "ImageToProductService", "to": "packages/Webkul/AiAgent/src/Services/ImageToProductService.php:20", "kind": "framework", "note": "container scoped binding"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:108-112
  108          $this->app->scoped(EnrichmentService::class);
  109          $this->app->scoped(ProductWriterService::class);
  110          $this->app->scoped(ImageToProductService::class);
  111  
  112          // Vector store services (stateless, safe as singletons under Octane)
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:18-22
   18   * This is the single entry-point the controller calls.
   19   */
   20  class ImageToProductService
   21  {
   22      public function __construct(


===== EDGE Ecf5163d209 =====
{"id": "Ecf5163d209", "from": "packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:36", "to_symbol": "BulkProductUpdate::handle", "to": "packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:100", "kind": "call"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:34-38
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:98-102
   98       * Handle the bulk product update job.
   99       */
  100      public function handle(): void
  101      {
  102          if ($this->userId && ($admin = AdminProxy::find($this->userId))) {


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


===== EDGE Ed048eec1fe =====
{"id": "Ed048eec1fe", "from": "packages/Webkul/Admin/tests/Feature/Catalog/FileAttributeActiveContentTest.php:43", "to_symbol": "route admin.catalog.products.update", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:214", "kind": "route", "note": "outside pool"}
--- packages/Webkul/Admin/tests/Feature/Catalog/FileAttributeActiveContentTest.php:41-45
   41      $payload = UploadedFile::fake()->createWithContent('payload.pdf', maliciousPdfBytes());
   42  
   43      $this->put(route('admin.catalog.products.update', $product->id), [
   44          'sku'    => $product->sku,
   45          'values' => ['common' => [$attributeCode => [$payload]]],
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:212-216
  212              Route::get('edit/{id}', 'edit')->name('admin.catalog.products.edit')->middleware(EnsureChannelLocaleIsValid::class);
  213  
  214              Route::put('edit/{id}', 'update')->name('admin.catalog.products.update');
  215  
  216              Route::delete('edit/{id}', 'destroy')->name('admin.catalog.products.delete');


===== EDGE Ed09cdfc2ac =====
{"id": "Ed09cdfc2ac", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:23", "to_symbol": "AdminApi ProductController", "to": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:27", "kind": "use", "note": "extends ProductController"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:21-25
   21  use Webkul\Product\Type\Configurable;
   22  
   23  class ConfigurableProductController extends ProductController
   24  {
   25      /**
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:25-29
   25  use Webkul\Product\Validator\ProductValuesValidator;
   26  
   27  class ProductController extends ApiController
   28  {
   29      /**


===== EDGE Ed0f8633a6d =====
{"id": "Ed0f8633a6d", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:34", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route", "note": "SSRF url rejected by isSafeApiUrl before discovery"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php:32-36
   32      $this->loginAsAdmin();
   33  
   34      $this->postJson(route('admin.magic_ai.platform.fetch_models'), [
   35          'provider' => 'custom',
   36          'api_url'  => 'http://169.254.169.254/',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');


===== EDGE Ed16b2634b4 =====
{"id": "Ed16b2634b4", "from": "packages/Webkul/Webhook/src/Listeners/Product.php:40", "to_symbol": "SendProductWebhook::handle", "to": "packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:31", "kind": "dispatch"}
--- packages/Webkul/Webhook/src/Listeners/Product.php:38-42
   38          }
   39  
   40          dispatch(new SendProductWebhook($product->id, $changes, 'updated', auth('admin')?->user()?->id))->onQueue('webhooks');
   41      }
   42  
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:29-33
   29      ) {}
   30  
   31      public function handle(WebhookService $webhookService): void
   32      {
   33          $product = ProductProxy::find($this->productId);


===== EDGE Ed1e6b5392a =====
{"id": "Ed1e6b5392a", "from": "packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:51", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:49-53
   49                  'regex:#^https?://#i',
   50                  function (string $attribute, mixed $value, Closure $fail): void {
   51                      if (! SafeWebhookUrl::validate($value)['valid']) {
   52                          $fail(trans('webhook::app.webhooks.validation.unsafe-url'));
   53                      }
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


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


===== EDGE Ed2655ae0bc =====
{"id": "Ed2655ae0bc", "from": "packages/Webkul/Admin/tests/Feature/Acl/Catalog/ProductBulkEditAclTest.php:28", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "outside pool; ACL test"}
--- packages/Webkul/Admin/tests/Feature/Acl/Catalog/ProductBulkEditAclTest.php:26-30
   26      $this->get(route('admin.catalog.bulkedit.attributes.fetch-all'))->assertStatus(403);
   27  
   28      $this->post(route('admin.catalog.products.bulk-edit.save'))->assertStatus(403);
   29  });
   30  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


===== EDGE Ed3bebab57c =====
{"id": "Ed3bebab57c", "from": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:54", "to_symbol": "PlatformValidator::validateApiUrl", "to": "packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:136", "kind": "call"}
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:52-56
   52          $data['models'] = $this->validateModelNames((string) $data['models']);
   53  
   54          $this->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   55  
   56          $this->ensureDefaultIsEnabled($data);
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:134-138
  134       * @throws ValidationException
  135       */
  136      public function validateApiUrl(?string $provider, ?string $apiUrl): void
  137      {
  138          if ($error = $this->apiUrlError($provider, $apiUrl)) {


===== EDGE Ed4d43cdc46 =====
{"id": "Ed4d43cdc46", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php:95", "to_symbol": "route admin.catalog.products.bulk-edit.save", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:248", "kind": "route", "note": "Event::fake on bulk.edit.after in this test; static chain only"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php:93-97
   93      }
   94  
   95      $this->postJson(route('admin.catalog.products.bulk-edit.save'), ['data' => $payload])
   96          ->assertOk();
   97  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:246-250
  246              Route::post('filters', 'filters')->name('admin.catalog.products.bulkedit.filters');
  247  
  248              Route::post('save', 'handleBulkSave')->name('admin.catalog.products.bulk-edit.save');
  249  
  250              Route::post('save-media', 'storeProductMedia')->name('admin.catalog.products.bulk-edit.save-media');


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


===== EDGE Ed4e8d71cad =====
{"id": "Ed4e8d71cad", "from": "packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php:108", "to_symbol": "route admin.magic_ai.platform.fetch_models", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:115", "kind": "route"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php:106-110
  106      $this->loginWithPermissions('all');
  107  
  108      postJson(route('admin.magic_ai.platform.fetch_models'), [
  109          'provider' => AiProvider::OpenAI->value,
  110          'api_key'  => 'sk-secret-key',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:113-117
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');
  117          Route::put('{id}', 'update')->name('admin.magic_ai.platform.update');


===== EDGE Ed5ba50545f =====
{"id": "Ed5ba50545f", "from": "packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php:44", "to_symbol": "route admin.catalog.products.check-variant", "to": "packages/Webkul/Admin/src/Routes/catalog-routes.php:226", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php:42-46
   42  function postVariantUniquenessCheck($test, array $payload)
   43  {
   44      return $test->postJson(route('admin.catalog.products.check-variant'), $payload);
   45  }
   46  
--- packages/Webkul/Admin/src/Routes/catalog-routes.php:224-228
  224              Route::get('filterable-attributes', 'filterableAttributes')->name('admin.catalog.products.filterable_attributes');
  225  
  226              Route::post('check-variant', 'checkVariantUniqueness')->name('admin.catalog.products.check-variant');
  227  
  228              Route::get('get/locale', 'getLocale')->name('admin.catalog.product.get_locale');


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


===== EDGE Ed74de12c97 =====
{"id": "Ed74de12c97", "from": "packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:51", "to_symbol": "route admin.magic_ai.platform.test", "to": "packages/Webkul/Admin/src/Routes/rest-routes.php:114", "kind": "route"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:49-53
   49      ]);
   50  
   51      $response = $this->postJson(route('admin.magic_ai.platform.test'), [
   52          'provider' => AiProvider::Custom->value,
   53          'api_key'  => 'csk-test-key-1234567890',
--- packages/Webkul/Admin/src/Routes/rest-routes.php:112-116
  112          Route::get('', 'index')->name('admin.magic_ai.platform.index');
  113          Route::post('', 'store')->name('admin.magic_ai.platform.store');
  114          Route::post('test-connection', 'testConnection')->name('admin.magic_ai.platform.test');
  115          Route::post('fetch-models', 'fetchModels')->name('admin.magic_ai.platform.fetch_models');
  116          Route::get('{id}', 'edit')->name('admin.magic_ai.platform.edit');


===== EDGE Ed757e91902 =====
{"id": "Ed757e91902", "from": "packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:13", "to_symbol": "WebhookService::getProductChangesForWebhook", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:366", "kind": "call"}
--- packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:11-15
   11      $product->update(['sku' => $product->sku.'-changed']);
   12  
   13      $changes = app(WebhookService::class)->getProductChangesForWebhook($product);
   14  
   15      expect($changes)->not->toBeEmpty()
--- packages/Webkul/Webhook/src/Services/WebhookService.php:364-368
  364       * and fall back to the newest audit by id, still bounded by product freshness.
  365       */
  366      public function getProductChangesForWebhook(Product $product): array
  367      {
  368          $latestChanges = $this->recentProductAudits->for($product->getKey())


===== EDGE Ed7ebdb07a8 =====
{"id": "Ed7ebdb07a8", "from": "packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:38", "to_symbol": "WebhookService::sendBatchByIds", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:54", "kind": "call"}
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:36-40
   36      expect($product->audits()->count())->toBe(0);
   37  
   38      app(WebhookService::class)->sendBatchByIds([$product->id]);
   39  
   40      Http::assertSent(fn ($request) => ($request->data()['event'] ?? null) === WebhookService::EVENT_PRODUCT_UPDATED
--- packages/Webkul/Webhook/src/Services/WebhookService.php:52-56
   52       * Send a batch of products to every subscribed webhook by their IDs.
   53       */
   54      public function sendBatchByIds(array $ids): ?Response
   55      {
   56          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);


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


===== EDGE Ed86ac43b12 =====
{"id": "Ed86ac43b12", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:66", "to_symbol": "WebhookService::deliverChunked", "to": "packages/Webkul/Webhook/src/Services/WebhookService.php:83", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:64-68
   64      public function sendBatchForBulkEdit(array $ids): ?Response
   65      {
   66          return $this->deliverChunked('id', $ids, skipIfNoChanges: false);
   67      }
   68  
--- packages/Webkul/Webhook/src/Services/WebhookService.php:81-85
   81       * @param  array<int, int|string>  $values
   82       */
   83      protected function deliverChunked(string $field, array $values, bool $computeChanges = true, string $event = self::EVENT_PRODUCT_UPDATED, bool $skipIfNoChanges = true): ?Response
   84      {
   85          $lastResponse = null;


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


===== EDGE Edbf1ea930e =====
{"id": "Edbf1ea930e", "from": "packages/Webkul/AdminApi/tests/Feature/Catalog/ApiRichAssociationTest.php:86", "to_symbol": "route admin.api.products.update", "to": "packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:131", "kind": "route", "note": "outside pool"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiRichAssociationTest.php:84-88
   84  
   85      $this->withHeaders($this->headers)
   86          ->json('PUT', route('admin.api.products.update', ['code' => $product->sku]), $payload)
   87          ->assertStatus(200)
   88          ->assertJsonFragment(['success' => true]);
--- packages/Webkul/AdminApi/src/Routes/V1/catalog-routes.php:129-133
  129          Route::get('{code}', 'get')->name('admin.api.products.get');
  130          Route::post('', 'store')->name('admin.api.products.store');
  131          Route::put('{code}', 'update')->name('admin.api.products.update');
  132          Route::delete('{code}', 'delete')->name('admin.api.products.delete');
  133          Route::patch('{sku}', 'partialUpdate')->name('admin.api.products.patch');


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


===== EDGE Eddbda2e635 =====
{"id": "Eddbda2e635", "from": "packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:104", "to_symbol": "AgentService", "to": "packages/Webkul/AiAgent/src/Services/AgentService.php:23", "kind": "framework", "note": "container binding AgentServiceContract -> AgentService"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php:102-106
  102      protected function registerBindings(): void
  103      {
  104          $this->app->bind(AgentServiceContract::class, AgentService::class);
  105          $this->app->bind(PromptBuilderContract::class, PromptBuilder::class);
  106  
--- packages/Webkul/AiAgent/src/Services/AgentService.php:21-25
   21   * Controllers call this service — never the pipeline or HTTP client directly.
   22   */
   23  class AgentService implements AgentServiceContract
   24  {
   25      public function __construct(


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


===== EDGE Ee15d5a4b64 =====
{"id": "Ee15d5a4b64", "from": "packages/Webkul/Webhook/src/Services/WebhookService.php:189", "to_symbol": "SafeWebhookUrl::validate", "to": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31", "kind": "call"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:187-191
  187      protected function deliver(Webhook $webhook, array $payload, ?string $sku, string $event, $batchProducts = null): ?Response
  188      {
  189          $safety = SafeWebhookUrl::validate($webhook->url);
  190  
  191          if (! $safety['valid']) {
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:29-33
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {


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


===== EDGE Ee2232bd8fd =====
{"id": "Ee2232bd8fd", "from": "packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php:251", "to_symbol": "route webhook.test", "to": "packages/Webkul/Webhook/src/Routes/web.php:16", "kind": "route", "note": "frontend axios POST to the route"}
--- packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php:249-253
  249                      this.isTesting = true;
  250  
  251                      this.$axios.post("{{ route('webhook.test') }}", { url })
  252                          .then((response) => {
  253                              this.$emitter.emit('add-flash', {
--- packages/Webkul/Webhook/src/Routes/web.php:14-18
   14              Route::delete('delete/{id}', 'destroy')->name('webhook.delete')->whereNumber('id');
   15              Route::post('mass-delete', 'massDestroy')->name('webhook.mass_delete');
   16              Route::post('test', 'test')->name('webhook.test');
   17          });
   18  


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


===== EDGE Ee42001fcfa =====
{"id": "Ee42001fcfa", "from": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:403", "to_symbol": "AiProvider::ssrfGuardedOptions", "to": "packages/Webkul/MagicAI/src/Enums/AiProvider.php:420", "kind": "call"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:401-405
  401          $url = rtrim($baseUrl, '/').'/api/tags';
  402  
  403          $response = $client->get($url, $this->ssrfGuardedOptions($url));
  404  
  405          $data = json_decode($response->getBody()->getContents(), true);
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:418-422
  418       * @return array<string, mixed>
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));


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


===== EDGE Ee6b7a2e008 =====
{"id": "Ee6b7a2e008", "from": "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:200", "to_symbol": "event 'catalog.product.update.after'", "to": "packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28", "kind": "dispatch"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:198-202
  198  
  199              if ($wasDirty) {
  200                  Event::dispatch('catalog.product.update.after', $product);
  201              }
  202  
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:26-30
   26          });
   27  
   28          Event::listen('catalog.product.update.after', [Product::class, 'afterUpdate']);
   29  
   30          Event::listen('catalog.product.create.after', [Product::class, 'afterCreate']);


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