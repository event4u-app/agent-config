You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository. For each item you get a registered question and a list of candidate files assembled from several sources; for each candidate, source lines were extracted mechanically from the subject at its registered pin, with line numbers. Candidates are listed in an arbitrary order. Some candidates belong in the answer and some do not.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question as worded) or `OUT`, with a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `unopim` at its registered pin.



========== ITEM uo-d-03 ==========
Question (registered, verbatim):
{
 "question": "Which files call sendBatchBySku?",
 "probe": "sendBatchBySku",
 "expected": "empty"
}

Candidate files (1):

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php: no probe token in the file


========== ITEM uo-e-01 ==========
Question (registered, verbatim):
{
 "question": "If SafeWebhookUrl::httpOptions changes its contract, which files must be re-read (full closure, across packages)?",
 "probe": "httpOptions",
 "declared_in": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93"
}

Candidate files (65):

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:122-128
  122  
  123      activeMeasurementWebhook();
  124  
  125      app(WebhookService::class)->sendCreatedToWebhook($product->fresh(), $changes);
  126  
  127      Http::assertSent(function ($request) use ($attribute, $family, $sku): bool {
  128          $body = json_decode($request->body(), true);

* packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Services/VisionService.php
--- packages/Webkul/AiAgent/src/Services/VisionService.php:129-135
  129          $messages = $this->buildVisionMessages($provider, $imageContent, $systemPrompt, $locale);
  130  
  131          $rawResponse = $this->callWithRetry(
  132              fn (): array => $this->apiClient->chat($messages, $maxTokens, $temperature),
  133              $maxAttempts,
  134              $baseDelayMs,
  135              $capDelayMs,

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/AiAgent/src/Agents/BaseAgent.php
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:58-64
   58              context: $context,
   59          );
   60  
   61          return $this->agentService->execute($payload);
   62      }
   63  
   64      /**

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:33-39
   33          }
   34  
   35          if ($this->event === WebhookService::EVENT_PRODUCT_CREATED) {
   36              $webhookService->sendBatchCreatedByIds($this->ids);
   37  
   38              return;
   39          }

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:29-35
   29  });
   30  
   31  it('returns an empty model list for Custom when no api_url is supplied', function () {
   32      expect(AiProvider::Custom->fetchModels('sk-test-key', null))->toBe([]);
   33      expect(AiProvider::Custom->fetchModels('sk-test-key', ''))->toBe([]);
   34  });
   35  

* packages/Webkul/AiAgent/src/Services/EnrichmentService.php
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:79-85
   79  
   80          $messages = $this->buildMessages($existing, array_values($missing), $locale, $instruction, $ctx, $common);
   81  
   82          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
   83          $generated = $this->parseResponse($response['content'] ?? '');
   84  
   85          // Score: AI-generated fields get medium confidence

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:28-34
   28          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o']]])),
   29      ], $reached);
   30  
   31      $models = AiProvider::Azure->fetchModels('azure-key', 'https://1.1.1.1', $client);
   32  
   33      expect($models)->toBe(['gpt-4o']);
   34      expect($reached)->toBe(['https://1.1.1.1/openai/v1/models?api-version=preview']);

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:60-66
   60          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o'], ['id' => 'dall-e-3']]])),
   61      ], $history);
   62  
   63      $models = AiProvider::OpenAI->fetchModels('sk-test', 'https://proxy.test/v1', $client);
   64  
   65      expect($models)->toBe(['dall-e-3', 'gpt-4o'])
   66          ->and((string) $history[0]['request']->getUri())->toBe('https://proxy.test/v1/models')

* packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php
--- packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php:25-31
   25       * Execute the console command.
   26       */
   27      public function handle(
   28          BulkProductEnricherAgent $enricher,
   29          ProductRepository $productRepository,
   30      ): int {
   31          $limit = (int) $this->option('limit');

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/Webhook/src/Listeners/Product.php
--- packages/Webkul/Webhook/src/Listeners/Product.php:37-43
   37              return;
   38          }
   39  
   40          dispatch(new SendProductWebhook($product->id, $changes, 'updated', auth('admin')?->user()?->id))->onQueue('webhooks');
   41      }
   42  
   43      public function afterCreate(\Webkul\Product\Contracts\Product $product): void
--- packages/Webkul/Webhook/src/Listeners/Product.php:87-93
   87              return;
   88          }
   89  
   90          dispatch(new SendBulkEditProductWebhook($ids, auth('admin')?->user()?->id))->onQueue('webhooks');
   91      }
   92  }
   93  

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:12-18
   12      expect($result['ip'])->toBe('1.1.1.1');
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:13-19
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
   19      expect($options['curl'][CURLOPT_RESOLVE])->toBe(['1.1.1.1:443:1.1.1.1']);
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:20-26
   20  });
   21  
   22  it('omits the pin and falls back to redirect-disable when validation fails', function () {
   23      $options = SafeWebhookUrl::httpOptions('http://127.0.0.1/hook');
   24  
   25      expect($options['allow_redirects'])->toBeFalse();
   26      expect($options)->not->toHaveKey('curl');

* packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:81-87
   81                          model: $this->context->model,
   82                      ));
   83  
   84                      $ctx = $this->visionService->analyze(
   85                          imageContent: $dataUri,
   86                          credentialId: 0,
   87                          apiClient: $apiClient,

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

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:37-43
   37          };
   38      });
   39  
   40      $models = AiProvider::Concentrate->fetchModels('sk-test-key', null, new Client(['handler' => $stack]));
   41  
   42      expect($models)->toBe(['gpt-5.6-terra']);
   43      expect($reached)->toBe(['https://api.concentrate.ai/v1/models']);

* packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:141-147
  141          $config = CredentialConfig::fromModel($data);
  142  
  143          $this->apiClient->configure($config);
  144          $result = $this->apiClient->testConnection();
  145  
  146          return new JsonResponse([
  147              'success' => $result['success'],

* packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:36-42
   36              ]);
   37          }
   38  
   39          $result = $this->agentService->execute($payload);
   40  
   41          return new JsonResponse($result->toArray());
   42      }

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:29-35
   29          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o-mini']]])),
   30      ], $reached);
   31  
   32      $discovery = AiProvider::Custom->discoverModels('sk-test-key', 'https://1.1.1.1', $client);
   33  
   34      expect($discovery['models'])->toBe(['gpt-4o-mini']);
   35      expect($discovery['api_url'])->toBe('https://1.1.1.1/v1');

* packages/Webkul/AiAgent/src/Services/AgentService.php
--- packages/Webkul/AiAgent/src/Services/AgentService.php:117-123
  117          return [
  118              ValidateInputStage::class,
  119              BuildPromptStage::class,
  120              CallAiProviderStage::class,
  121              ParseResponseStage::class,
  122              LogExecutionStage::class,
  123          ];

* packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:102-108
  102  
  103      Http::fake();
  104  
  105      $service->sendCreatedToWebhook($product);
  106  
  107      Http::assertSent(function ($request) use ($product) {
  108          $body = $request->data();

* packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:39-45
   39          $firstImage = $images[0];
   40  
   41          try {
   42              $ctx = $this->imageToProductService->execute(
   43                  image: $firstImage,
   44                  credentialId: (int) $validated['credential_id'],
   45                  options: [

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: no probe token in the file

* packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:93-99
   93                          model: $this->context->model,
   94                      ));
   95  
   96                      $enriched = $this->enrichmentService->enrich(
   97                          ctx: $ctx,
   98                          credentialId: 0,
   99                          apiClient: $apiClient,

* packages/Webkul/AiAgent/src/Services/ImageToProductService.php
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:55-61
   55          $storedPath = $this->storeImage($image);
   56  
   57          // 3 — Vision: analyze the image, get attributes + category
   58          $ctx = $this->visionService->analyze(
   59              imageContent: $this->toBase64DataUri($storedPath, $mimeType),
   60              credentialId: $credentialId,
   61              apiClient: $apiClient,
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php:70-76
   70          $ctx = $ctx->withImagePath($storedPath);
   71  
   72          // 4 — Enrich: fill missing attributes (name, description, SEO, etc.)
   73          $ctx = $this->enrichmentService->enrich(
   74              ctx: $ctx,
   75              credentialId: $credentialId,
   76              apiClient: $apiClient,

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:151-157
  151          }
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:39-45
   39      expect($reached)->toContain('http://169.254.169.254/latest/meta-data/');
   40  });
   41  
   42  it('confirms the fix primitive: SafeWebhookUrl::httpOptions disables redirect following', function () {
   43      $mock = new MockHandler([
   44          new Response(302, ['Location' => 'http://169.254.169.254/latest/meta-data/']),
   45      ]);
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:47-53
   47  
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
   53      expect($response->getStatusCode())->toBe(302);

* packages/Webkul/MagicAI/src/Services/ModelDiscovery.php
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:16-22
   16       */
   17      public function discover(AiProvider $provider, ?string $apiKey, ?string $apiUrl): array
   18      {
   19          return $provider->discoverModels($apiKey, $apiUrl);
   20      }
   21  }
   22  

* packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:20-26
   20  #[Description('Add a Magic AI platform, optionally managed, storing its API key encrypted in the database')]
   21  class AddPlatform extends PlatformCommand
   22  {
   23      use CollectsPlatform;
   24  
   25      protected function perform(): int
   26      {

* packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:26-32
   26       * Execute the console command.
   27       */
   28      public function handle(
   29          ImageProductAgent $imageAgent,
   30          AgentRepository $agentRepository,
   31          CredentialRepository $credentialRepository,
   32      ): int {

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:35-41
   35  
   36      $product = Product::factory()->create();
   37  
   38      app(WebhookService::class)->sendCreatedToWebhook($product);
   39  
   40      Http::assertSent(fn ($request) => str_contains($request->url(), '1.1.1.1'));
   41      Http::assertSent(fn ($request) => str_contains($request->url(), '8.8.8.8'));

* packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:55-61
   55          int $credentialId,
   56          array $context = [],
   57      ): AgentResult {
   58          return $this->execute(
   59              input: [
   60                  'productCount' => count($products),
   61                  'products'     => $products,

* packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:25-31
   25  #[Description('Edit a Magic AI platform; an empty key keeps the stored one')]
   26  class EditPlatform extends PlatformCommand
   27  {
   28      use ChoosesPlatform, CollectsPlatform;
   29  
   30      protected function perform(): int
   31      {

* packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:196-202
  196      {
  197          try {
  198              $models = spin(
  199                  fn (): array => resolve(ModelDiscovery::class)->discover($provider, $apiKey, $apiUrl ?: null)['models'],
  200                  trans('admin::app.configuration.platform.command.fetching-models', ['provider' => $provider->label()]),
  201              );
  202          } catch (\Throwable $e) {

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:35-41
   35  
   36      expect($product->audits()->count())->toBe(0);
   37  
   38      app(WebhookService::class)->sendBatchByIds([$product->id]);
   39  
   40      Http::assertSent(fn ($request) => ($request->data()['event'] ?? null) === WebhookService::EVENT_PRODUCT_UPDATED
   41          && collect($request->data()['data'] ?? [])->pluck('sku')->contains('IMPORT-UPD-1'));

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:41-47
   41          }
   42  
   43          match ($this->eventType) {
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),
   46              default   => null,
   47          };

* (product-saving code that fires catalog.product.*.after / data_transfer.imports.batch.* events: ProductRepository, Admin/AdminApi product controllers, DataTransfer importer, BulkProductUpdate, ...)
--- (product-saving code that fires catalog.product.*.after / data_transfer.imports.batch.* events: ProductRepository, Admin/AdminApi product controllers, DataTransfer importer, BulkProductUpdate, ...): no probe token in the file

* packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php
--- packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php:35-41
   35          foreach ($this->payloads as $payloadData) {
   36              try {
   37                  $payload = AgentPayload::fromArray($payloadData);
   38                  $agentService->execute($payload);
   39              } catch (\Throwable $e) {
   40                  Log::error('BatchAgentJob item failed', [
   41                      'agentId' => $payloadData['agentId'] ?? null,

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php: no probe token in the file

* packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php
--- packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php: no probe token in the file

* packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php
--- packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:108-114
  108                  category: $values['categories'][0] ?? null,
  109              );
  110  
  111              $enriched = $enrichmentService->enrich(
  112                  ctx: $ctx,
  113                  credentialId: 0,
  114                  apiClient: $apiClient,

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:111-117
  111  
  112      $job = new SendBulkProductWebhook([], null, WebhookService::EVENT_PRODUCT_CREATED);
  113  
  114      $job->handle(app(WebhookService::class));
  115  })->throwsNoExceptions();
  116  
  117  it('queues only a created webhook when afterBulkCreate is called directly', function () {

* packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:128-134
  128      protected function execute(string $method, string $url, ?array $data = null): array
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.
  131          $safeOptions = SafeWebhookUrl::httpOptions($url);
  132  
  133          throw_unless(
  134              isset($safeOptions['curl'][CURLOPT_RESOLVE]),

* packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:31-37
   31  
   32          $this->apiClient->configure($config);
   33  
   34          $response = $this->apiClient->chat(
   35              messages: $payload->messages,
   36              maxTokens: $payload->metadata['maxTokens'] ?? 4096,
   37              temperature: $payload->metadata['temperature'] ?? 0.7,

* packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:89-95
   89          $agentId = (int) request('agentId');
   90          $credentialId = (int) request('credentialId');
   91  
   92          $result = $agent->execute(
   93              input: $input,
   94              agentId: $agentId,
   95              credentialId: $credentialId,

* packages/Webkul/MagicAI/src/Enums/AiProvider.php
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:419-425
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));
  423      }
  424  
  425      private function fetchAnthropicModels(Client $client, ?string $apiKey, ?string $apiUrl = null): array

* packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:207-213
  207      $history = [];
  208      $client = matrixClient([new Response(200, [], json_encode($expected['body']))], $history);
  209  
  210      $models = $provider->fetchModels('platform-key', $expected['apiUrl'] ?? null, $client);
  211      $request = $history[0]['request'];
  212  
  213      expect($models)->toBe($expected['models'])

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:28-34
   28              Auth::login($user);
   29          }
   30  
   31          $webhookService->sendBatchForBulkEdit($this->ids);
   32      }
   33  }
   34  

* packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php
--- packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:39-45
   39          return resolve(Pipeline::class)
   40              ->send($payload)
   41              ->through($this->stages)
   42              ->via('handle')
   43              ->thenReturn();
   44      }
   45  }

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php:105-111
  105          $locale = $payload->context['enrichLocale'] ?? 'en_US';
  106          $messages = $this->buildMessages($mapped, array_values($missingTargets), $locale);
  107  
  108          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
  109          $generated = $this->parseGenerated($response['content'] ?? '');
  110  
  111          // Merge: existing mapped values take priority; generated fills gaps

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php:59-65
   59              unset($options['systemPrompt']);
   60          }
   61  
   62          $visionCtx = $this->visionService->analyze(
   63              imageContent: $imageContent,
   64              credentialId: $payload->credentialId,
   65              options: $options,

* packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:20-26
   20              return;
   21          }
   22  
   23          dispatch(new AutoEnrichProductJob(productId: $product->id, locale: core()->getRequestedLocaleCode(), channel: core()->getRequestedChannelCode()))->delay(now()->addSeconds(5)); // Small delay to ensure product is 
   24      }
   25  
   26      /**

* packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:71-77
   71              context: $context,
   72          );
   73  
   74          return $this->agentService->execute($payload);
   75      }
   76  
   77      /**

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:42-48
   42  
   43      $product = Product::factory()->create();
   44  
   45      app(WebhookService::class)->sendDataToWebhook($product);
   46  
   47      $log = DB::table('webhook_logs')->where('sku', $product->sku)->first();
   48  

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:50-56
   50      {
   51          $payload = AgentPayload::fromArray($this->payloadData);
   52  
   53          $agentService->execute($payload);
   54      }
   55  
   56      /**

* (tests faking the queue: BulkEditWebhookQueuedTest, BulkEditWebhookNotDuplicatedTest, ProductBulkEditWebhookDedupeTest, ProductVariantNodeCreateTest)
--- (tests faking the queue: BulkEditWebhookQueuedTest, BulkEditWebhookNotDuplicatedTest, ProductBulkEditWebhookDedupeTest, ProductVariantNodeCreateTest): no probe token in the file


========== ITEM uo-c-tests-01 ==========
Question (registered, verbatim):
{
 "question": "Which test files exercise SafeWebhookUrl, directly or through a caller?",
 "probe": "SafeWebhookUrl"
}

Candidate files (42):

* packages/Webkul/Core/tests/Unit/HttpExceptionRenderingTest.php
--- packages/Webkul/Core/tests/Unit/HttpExceptionRenderingTest.php: no probe token in the file

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:207-213
  207      $history = [];
  208      $client = matrixClient([new Response(200, [], json_encode($expected['body']))], $history);
  209  
  210      $models = $provider->fetchModels('platform-key', $expected['apiUrl'] ?? null, $client);
  211      $request = $history[0]['request'];
  212  
  213      expect($models)->toBe($expected['models'])

* packages/Webkul/AiAgent/tests/Unit/MagicAIPermissionTest.php
--- packages/Webkul/AiAgent/tests/Unit/MagicAIPermissionTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php
--- packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:39-45
   39  it('never lets a request set the managed flag', function () {
   40      $this->loginWithPermissions('all');
   41  
   42      postJson(route('admin.magic_ai.platform.store'), managedPayload([
   43          'label'      => 'Client platform',
   44          'api_key'    => 'sk-client-own-key',
   45          'is_managed' => 1,

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php:53-59
   53  
   54          $this->loginWithPermissions('custom', ['ai-agent', 'ai-agent.platform', 'ai-agent.platform.edit']);
   55  
   56          $this->putJson(route('admin.magic_ai.platform.update', $platform->id), [
   57              'label'      => 'Updated',
   58              'provider'   => 'openai',
   59              'models'     => 'gpt-4o',

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformModelsSubmitTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformModelsSubmitTest.php: no probe token in the file

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:60-66
   60          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o'], ['id' => 'dall-e-3']]])),
   61      ], $history);
   62  
   63      $models = AiProvider::OpenAI->fetchModels('sk-test', 'https://proxy.test/v1', $client);
   64  
   65      expect($models)->toBe(['dall-e-3', 'gpt-4o'])
   66          ->and((string) $history[0]['request']->getUri())->toBe('https://proxy.test/v1/models')
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:100-106
  100          new Response(200, [], json_encode(['models' => [['name' => 'llama3.2'], ['name' => 'gemma3']]])),
  101      ], $history);
  102  
  103      expect(AiProvider::Ollama->fetchModels(null, 'http://localhost:11434', $client))
  104          ->toBe(['gemma3', 'llama3.2'])
  105          ->and((string) $history[0]['request']->getUri())->toBe('http://localhost:11434/api/tags');
  106  });

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTildeModelTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTildeModelTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSaveValidatesCredentialsTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSaveValidatesCredentialsTest.php: no probe token in the file

* packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:102-108
  102  
  103      Http::fake();
  104  
  105      $service->sendCreatedToWebhook($product);
  106  
  107      Http::assertSent(function ($request) use ($product) {
  108          $body = $request->data();

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:42-48
   42  
   43      $product = Product::factory()->create();
   44  
   45      app(WebhookService::class)->sendDataToWebhook($product);
   46  
   47      $log = DB::table('webhook_logs')->where('sku', $product->sku)->first();
   48  

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:29-35
   29  });
   30  
   31  it('returns an empty model list for Custom when no api_url is supplied', function () {
   32      expect(AiProvider::Custom->fetchModels('sk-test-key', null))->toBe([]);
   33      expect(AiProvider::Custom->fetchModels('sk-test-key', ''))->toBe([]);
   34  });
   35  

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:28-34
   28          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o']]])),
   29      ], $reached);
   30  
   31      $models = AiProvider::Azure->fetchModels('azure-key', 'https://1.1.1.1', $client);
   32  
   33      expect($models)->toBe(['gpt-4o']);
   34      expect($reached)->toBe(['https://1.1.1.1/openai/v1/models?api-version=preview']);

* packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:51-57
   51  
   52      $previousDefault = MagicAIPlatform::factory()->default()->create();
   53  
   54      $command = answerConnection(artisan(WIZARD), 'Hosted AI', 'sk-hosted-key')
   55          ->expectsQuestion(wizardLabel('fields.models'), ['gpt-4o', 'gpt-4o-mini'])
   56          ->expectsQuestion(wizardLabel('command.models-additional'), '');
   57  

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php: no probe token in the file

* packages/Webkul/AiAgent/tests/Unit/EnrichmentLocaleAwarenessTest.php
--- packages/Webkul/AiAgent/tests/Unit/EnrichmentLocaleAwarenessTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:4-10
    4  use GuzzleHttp\Handler\MockHandler;
    5  use GuzzleHttp\HandlerStack;
    6  use GuzzleHttp\Psr7\Response;
    7  use Webkul\Webhook\Validators\SafeWebhookUrl;
    8  
    9  /*
   10   * MagicAIPlatformController::fetchModels validates the submitted api_url with
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:8-14
    8  
    9  /*
   10   * MagicAIPlatformController::fetchModels validates the submitted api_url with
   11   * SafeWebhookUrl, then AiProvider::fetchModels fetches it. A bare Guzzle client
   12   * follows redirects and re-resolves DNS, so a public URL that passes validation
   13   * can 30x-redirect the server-side fetch to an internal host. These tests drive
   14   * the exact client shape through a mocked redirect chain, without network I/O.
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:16-22
   16  it('reproduces: the submitted url passes validation yet the client follows a redirect to an internal host', function () {
   17      // A public host passes the pre-fetch safety check; a literal public IP is
   18      // used so the check is deterministic offline (no DNS in the test env).
   19      expect(SafeWebhookUrl::validate('https://1.1.1.1/models')['valid'])->toBeTrue();
   20  
   21      $reached = [];
   22  
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:47-53
   47  
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
   53      expect($response->getStatusCode())->toBe(302);

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php:34-40
   34  });
   35  
   36  it('creates a webhook from the required fields and returns the edit redirect', function () {
   37      $response = $this->postJson(route('webhook.store'), [
   38          'name'   => 'Quick Created',
   39          'url'    => 'https://example.com/quick-create',
   40          'events' => ['product.created'],

* packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php
--- packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php:22-28
   22  it('rejects an api url pointing at the cloud metadata address', function () {
   23      $validator = Validator::make(
   24          credentialPayload('http://169.254.169.254/latest/meta-data'),
   25          (new CredentialForm)->rules()
   26      );
   27  
   28      expect($validator->fails())->toBeTrue()

* packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:8-14
    8  
    9  /*
   10   * Regression cover for the SSRF reported against test-connection: the `extras`
   11   * JSON was merged over the provider overrides after SafeWebhookUrl had checked
   12   * `api_url`, so `extras.url` replaced the validated endpoint.
   13   */
   14  it('does not let extras.url override the validated api_url', function () {
--- packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:16-22
   16  
   17      Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'OK']]]], 200)]);
   18  
   19      $this->postJson(route('admin.magic_ai.platform.test'), [
   20          'provider' => AiProvider::Custom->value,
   21          'api_key'  => 'sk-test-key-1234567890',
   22          'api_url'  => 'https://api.openai.com/v1',

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php: no probe token in the file

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:35-41
   35  
   36      $product = Product::factory()->create();
   37  
   38      app(WebhookService::class)->sendCreatedToWebhook($product);
   39  
   40      Http::assertSent(fn ($request) => str_contains($request->url(), '1.1.1.1'));
   41      Http::assertSent(fn ($request) => str_contains($request->url(), '8.8.8.8'));

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php: no probe token in the file

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:122-128
  122  
  123      activeMeasurementWebhook();
  124  
  125      app(WebhookService::class)->sendCreatedToWebhook($product->fresh(), $changes);
  126  
  127      Http::assertSent(function ($request) use ($attribute, $family, $sku): bool {
  128          $body = json_decode($request->body(), true);

* packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php
--- packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php:8-14
    8      $request = WebhookForm::create('/admin/configuration/webhook/create', 'POST');
    9      $request->setContainer(app());
   10  
   11      return $request->rules();
   12  }
   13  
   14  function validateWebhook(array $payload): Illuminate\Contracts\Validation\Validator

* packages/Webkul/Admin/tests/Feature/Acl/MagicAi/MagicAiPlatformAclTest.php
--- packages/Webkul/Admin/tests/Feature/Acl/MagicAi/MagicAiPlatformAclTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:29-35
   29          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o-mini']]])),
   30      ], $reached);
   31  
   32      $discovery = AiProvider::Custom->discoverModels('sk-test-key', 'https://1.1.1.1', $client);
   33  
   34      expect($discovery['models'])->toBe(['gpt-4o-mini']);
   35      expect($discovery['api_url'])->toBe('https://1.1.1.1/v1');

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:58-64
   58          };
   59      });
   60  
   61      $provider->fetchModels('sk-test-key', $apiUrl, new Client(['handler' => $stack]));
   62  
   63      expect($reached[0])->toStartWith($expected);
   64  })->with([

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php:112-118
  112  });
  113  
  114  it('returns clean 404 JSON when updating a deleted platform', function () {
  115      $response = $this->putJson(route('admin.magic_ai.platform.update', 99999), [
  116          'label'    => 'Ghost',
  117          'provider' => 'openai',
  118          'models'   => 'gpt-4o-mini',

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:1-6
    1  <?php
    2  
    3  use Webkul\Webhook\Validators\SafeWebhookUrl;
    4  
    5  it('accepts a normal public https URL', function () {
    6      // Public IP literal — bypasses DNS so the test is deterministic in
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:5-11
    5  it('accepts a normal public https URL', function () {
    6      // Public IP literal — bypasses DNS so the test is deterministic in
    7      // network-restricted CI. 1.1.1.1 is in public unicast space.
    8      $result = SafeWebhookUrl::validate('https://1.1.1.1/inbound');
    9  
   10      expect($result['valid'])->toBeTrue();
   11      expect($result['reason'])->toBe('');
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:13-19
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
   19      expect($options['curl'][CURLOPT_RESOLVE])->toBe(['1.1.1.1:443:1.1.1.1']);

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformDefaultValidationTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformDefaultValidationTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:35-41
   35  
   36      expect($product->audits()->count())->toBe(0);
   37  
   38      app(WebhookService::class)->sendBatchByIds([$product->id]);
   39  
   40      Http::assertSent(fn ($request) => ($request->data()['event'] ?? null) === WebhookService::EVENT_PRODUCT_UPDATED
   41          && collect($request->data()['data'] ?? [])->pluck('sku')->contains('IMPORT-UPD-1'));
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:48-54
   48      $first = unauditedProduct('IMPORT-UPD-2');
   49      $second = unauditedProduct('IMPORT-UPD-3');
   50  
   51      (new SendBulkProductWebhook([$first->id, $second->id], null, WebhookService::EVENT_PRODUCT_UPDATED))
   52          ->handle(app(WebhookService::class));
   53  
   54      expect(WebhookLog::whereIn('sku', ['IMPORT-UPD-2', 'IMPORT-UPD-3'])


========== ITEM uo-b-03 ==========
Question (registered, verbatim):
{
 "question": "Which files reference the INTERFACE Webkul\\Product\\Contracts\\VariantStructurePlanner (not the concrete class of the same short name)?",
 "probe": "VariantStructurePlanner",
 "declared_in": "packages/Webkul/Product/src/Contracts/VariantStructurePlanner.php:8"
}

Candidate files (19):

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:16-22
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;
   22  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:43-49
   43  
   44          $structure->load('axes.attribute');
   45  
   46          $axisCodes = app(VariantStructurePlanner::class)->allAxisCodes($structure);
   47  
   48          if (empty($data['super_attributes'])) {
   49              $data['super_attributes'] = $axisCodes;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:194-200
  194  
  195          $common = $request->input('values.common', []);
  196          $sku = $common['sku'];
  197          $axisCodes = app(VariantStructurePlanner::class)->axisCodesByLevel($parent->variantStructure)['level_1'] ?? [];
  198  
  199          $missingAxisCodes = array_values(array_diff($axisCodes, array_keys($common)));
  200  

* packages/Webkul/Product/tests/Unit/Services/VariantStructurePlannerTest.php
--- packages/Webkul/Product/tests/Unit/Services/VariantStructurePlannerTest.php:4-10
    4  use Illuminate\Support\Str;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Contracts\VariantStructurePlanner as PlannerContract;
    8  use Webkul\Product\Enums\VariantLevel;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAttribute;

* packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php:15-21
   15  use Webkul\Measurement\Helpers\MeasurementHelper;
   16  use Webkul\Product\Enums\ProductType;
   17  use Webkul\Product\Enums\VariantLevel;
   18  use Webkul\Product\Services\VariantStructurePlanner;
   19  
   20  /**
   21   * Seeds the demo catalog: configurable parents, their variant structures and
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php:23-29
   23   *
   24   * A product declaring two axes gets a two-level structure — configurable →
   25   * variant_group (level 1) → simple (level 2) — which is the shape
   26   * {@see VariantStructurePlanner} expects. One axis
   27   * produces a single-level structure with simple variants directly under the
   28   * configurable.
   29   */

* packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:37-43
   37  use Webkul\ElasticSearch\Indexing\Normalizer\ProductNormalizer;
   38  use Webkul\ElasticSearch\Observers\Product as ElasticProductObserver;
   39  use Webkul\Measurement\Helpers\MeasurementHelper;
   40  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   41  use Webkul\Product\Enums\ProductType;
   42  use Webkul\Product\Enums\VariantLevel;
   43  use Webkul\Product\Models\Product;

* packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:17-23
   17  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   18  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   19  use Webkul\DataTransfer\Services\JobLogger;
   20  use Webkul\Product\Contracts\VariantStructurePlanner;
   21  use Webkul\Product\Models\Product;
   22  use Webkul\Product\Repositories\ProductRepository;
   23  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:62-68
   62      /**
   63       * Resolves a product's variant structure level and attribute ownership.
   64       */
   65      protected VariantStructurePlanner $variantStructurePlanner;
   66  
   67      /**
   68       * Collected validation or process errors.
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:108-114
  108          $this->productRepository = resolve(ProductRepository::class);
  109          $this->attributeService = resolve(AttributeService::class);
  110          $this->valuesValidator = resolve(ProductValuesValidator::class);
  111          $this->variantStructurePlanner = resolve(VariantStructurePlanner::class);
  112  
  113          $jobInstance = $this->jobInstancesRepository->findOneByField('code', 'bulk_product_update')
  114              ?? $this->createDemoJobInstance();

* packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php
--- packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php:5-11
    5  use Webkul\Installer\Database\Seeders\Demo\DemoCoreSeeder;
    6  use Webkul\Installer\Database\Seeders\Demo\DemoFamilySeeder;
    7  use Webkul\Installer\Database\Seeders\Demo\DemoProductSeeder;
    8  use Webkul\Product\Contracts\VariantStructurePlanner;
    9  use Webkul\Product\Enums\ProductType;
   10  use Webkul\Product\Models\Product;
   11  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php:53-59
   53  it('never writes a value onto a row the variant structure does not let own it', function () {
   54      seedDemoCatalog();
   55  
   56      $planner = resolve(VariantStructurePlanner::class);
   57  
   58      $offenders = [];
   59  

* packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:3-9
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Contracts\VariantStructurePlanner;
    7  use Webkul\Product\Models\VariantStructure;
    8  use Webkul\Product\Repositories\VariantStructureRepository;
    9  
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:46-52
   46  });
   47  
   48  it('binds the structure planner contract', function () {
   49      expect(app(VariantStructurePlanner::class))
   50          ->toBeInstanceOf(Webkul\Product\Services\VariantStructurePlanner::class);
   51  });
   52  
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:47-52
   47  
   48  it('binds the structure planner contract', function () {
   49      expect(app(VariantStructurePlanner::class))
   50          ->toBeInstanceOf(Webkul\Product\Services\VariantStructurePlanner::class);
   51  });
   52  

* packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php
--- packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php:3-9
    3  namespace Webkul\Admin\Http\Requests;
    4  
    5  use Illuminate\Foundation\Http\FormRequest;
    6  use Webkul\Product\Contracts\VariantStructurePlanner;
    7  use Webkul\Product\Models\Product;
    8  use Webkul\Product\Repositories\ProductRepository;
    9  
--- packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php:14-20
   14       */
   15      public function __construct(
   16          protected ProductRepository $productRepository,
   17          protected VariantStructurePlanner $variantStructurePlanner,
   18      ) {}
   19  
   20      /**

* packages/Webkul/Product/src/Services/VariantStructurePlanner.php
--- packages/Webkul/Product/src/Services/VariantStructurePlanner.php:2-8
    2  
    3  namespace Webkul\Product\Services;
    4  
    5  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Enums\VariantLevel;
    8  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Services/VariantStructurePlanner.php:9-15
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureProxy;
   11  
   12  class VariantStructurePlanner implements VariantStructurePlannerContract
   13  {
   14      const LEVEL_ORDER = VariantLevel::ORDER;
   15  

* packages/Webkul/Admin/src/Http/Requests/VariantNodeForm.php
--- packages/Webkul/Admin/src/Http/Requests/VariantNodeForm.php:5-11
    5  use Illuminate\Foundation\Http\FormRequest;
    6  use Illuminate\Validation\Rule;
    7  use Webkul\Core\Rules\Sku;
    8  use Webkul\Product\Contracts\VariantStructurePlanner;
    9  use Webkul\Product\Enums\ProductType;
   10  use Webkul\Product\Models\VariantStructure;
   11  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Admin/src/Http/Requests/VariantNodeForm.php:19-25
   19       */
   20      public function __construct(
   21          protected ProductRepository $productRepository,
   22          protected VariantStructurePlanner $variantStructurePlanner,
   23      ) {}
   24  
   25      /**

* packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:1-7
    1  <?php
    2  
    3  use Webkul\Product\Enums\VariantLevel;
    4  use Webkul\Product\Services\VariantStructurePlanner;
    5  use Webkul\Product\Services\VariantStructureWriter;
    6  
    7  describe('VariantLevel', function () {
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:26-32
   26          expect(VariantStructureWriter::PLACEMENT_LEVELS)->toBe(VariantLevel::VALUES);
   27  
   28          foreach (VariantLevel::cases() as $level) {
   29              expect(VariantStructurePlanner::LEVEL_ORDER[$level->value])->toBe($level->order());
   30          }
   31  
   32          expect(VariantStructurePlanner::LEVEL_ORDER)->toHaveCount(count(VariantLevel::cases()));
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:29-35
   29              expect(VariantStructurePlanner::LEVEL_ORDER[$level->value])->toBe($level->order());
   30          }
   31  
   32          expect(VariantStructurePlanner::LEVEL_ORDER)->toHaveCount(count(VariantLevel::cases()));
   33      });
   34  });
   35  

* packages/Webkul/Product/src/Providers/ProductServiceProvider.php
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:6-12
    6  use Illuminate\Support\ServiceProvider;
    7  use Webkul\Product\Console\ResyncVariantsCommand;
    8  use Webkul\Product\Console\StripRedundantVariantValuesCommand;
    9  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   10  use Webkul\Product\Contracts\VariantValueResolver as VariantValueResolverContract;
   11  use Webkul\Product\Facades\ProductImage as ProductImageFacade;
   12  use Webkul\Product\Facades\ProductVideo as ProductVideoFacade;
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:45-51
   45  use Webkul\Product\ProductImage;
   46  use Webkul\Product\ProductVideo;
   47  use Webkul\Product\Services\ProductValueMapper;
   48  use Webkul\Product\Services\VariantStructurePlanner;
   49  use Webkul\Product\Services\VariantValueResolver;
   50  use Webkul\Product\ValueSetter;
   51  
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:95-101
   95      {
   96          // Bound (fresh per resolve), not scoped: the per-product memo must not survive a same-request mutation.
   97          $this->app->bind(VariantValueResolverContract::class, VariantValueResolver::class);
   98          $this->app->bind(VariantStructurePlannerContract::class, VariantStructurePlanner::class);
   99      }
  100  
  101      /**

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:22-28
   22  use Webkul\DataTransfer\Jobs\System\BulkProductUpdate;
   23  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   24  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   25  use Webkul\Product\Contracts\VariantStructurePlanner;
   26  use Webkul\Product\Models\Product;
   27  use Webkul\Product\Repositories\ProductRepository;
   28  use Webkul\Product\Validator\API\UploadMediaValidator;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:54-60
   54          protected AttributeFamilyRepository $attributeFamilyRepository,
   55          protected UploadMediaValidator $mediaValidator,
   56          protected FileStorer $fileStorer,
   57          protected VariantStructurePlanner $variantStructurePlanner
   58      ) {}
   59  
   60      /**
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:138-144
  138      /**
  139       * Own values, values inherited from real ancestors, and each code's state here:
  140       * "own" (editable), "inherited" (locked, shows the owner's value) or "na"
  141       * (owned below this level). Owners come from {@see VariantStructurePlanner::ownsAtOwnLevel()},
  142       * not a placement lookup, because axes carry no placement row.
  143       */
  144      protected function buildBulkEditRow(Product $product, array $attributeCodes): array

* packages/Webkul/Product/src/Type/Configurable.php
--- packages/Webkul/Product/src/Type/Configurable.php:6-12
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Type/Configurable.php:204-210
  204       */
  205      protected function updateVariantGroups($product, array $data, $productSuperAttributes, Collection|array $uniqueAttributes = [])
  206      {
  207          $planner = resolve(VariantStructurePlanner::class);
  208  
  209          $groupAxis = $planner->axisCodesByLevel($product->variantStructure)['level_1'][0] ?? null;
  210  
--- packages/Webkul/Product/src/Type/Configurable.php:281-287
  281       * `ProductRepository::guardVariantLevelWrite()` for a sibling-scoped
  282       * duplicate-combination check.
  283       */
  284      public function updateVariantGroupValues(Product $group, ?string $groupAxis, array $groupData, ?VariantStructurePlanner $planner = null): void
  285      {
  286          $submitted = $groupData['group_values'] ?? [];
  287  

* packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php
--- packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php:4-10
    4  
    5  use Illuminate\Foundation\Http\FormRequest;
    6  use Illuminate\Validation\Rule;
    7  use Webkul\Product\Contracts\VariantStructurePlanner;
    8  use Webkul\Product\Enums\ProductType;
    9  use Webkul\Product\Repositories\ProductRepository;
   10  
--- packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php:17-23
   17       */
   18      public function __construct(
   19          protected ProductRepository $productRepository,
   20          protected VariantStructurePlanner $variantStructurePlanner,
   21      ) {}
   22  
   23      /**

* packages/Webkul/Product/src/Repositories/ProductRepository.php
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:11-17
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:12-18
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
   18  class ProductRepository extends Repository
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:230-236
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
  234  
  235          $structure = $planner->structureFor($product);
  236  

* packages/Webkul/Product/src/Models/Product.php
--- packages/Webkul/Product/src/Models/Product.php:24-30
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
   30  use Webkul\Product\Database\Factories\ProductFactory;
--- packages/Webkul/Product/src/Models/Product.php:202-208
  202              return [];
  203          }
  204  
  205          $planner = resolve(VariantStructurePlanner::class);
  206  
  207          return CompletenessSetting::where('family_id', $this->attribute_family_id)
  208              ->where('channel_id', $channelId)

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:37-43
   37  use Webkul\Core\Rules\Sku;
   38  use Webkul\Product\Contracts\Product as ProductContract;
   39  use Webkul\Product\Contracts\ProductAssociation as ProductAssociationContract;
   40  use Webkul\Product\Contracts\VariantStructurePlanner;
   41  use Webkul\Product\Enums\ProductType;
   42  use Webkul\Product\Enums\VariantLevel;
   43  use Webkul\Product\Facades\ProductValueMapper as ProductValueMapperFacade;
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:92-98
   92          protected AssociationTypeRepository $associationTypeRepository,
   93          protected ProductAssociationRepository $productAssociationRepository,
   94          protected VariantStructureRepository $variantStructureRepository,
   95          protected VariantStructurePlanner $variantStructurePlanner,
   96          protected RequiredAttributesValidator $requiredAttributesValidator,
   97      ) {}
   98  

* packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:11-17
   11  use Webkul\Completeness\Repositories\ProductCompletenessScoreRepository;
   12  use Webkul\Core\Repositories\ChannelRepository;
   13  use Webkul\Core\Repositories\LocaleRepository;
   14  use Webkul\Product\Contracts\VariantStructurePlanner;
   15  use Webkul\Product\Models\Product;
   16  use Webkul\Product\Repositories\ProductRepository;
   17  
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:31-37
   31  
   32      protected ProductCompletenessScoreRepository $completenessResultsRepository;
   33  
   34      protected VariantStructurePlanner $variantStructurePlanner;
   35  
   36      protected array $channels = [];
   37  
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:127-133
  127          $this->attributeRepository = resolve(AttributeRepository::class);
  128          $this->completenessSettingsRepository = resolve(CompletenessSettingsRepository::class);
  129          $this->completenessResultsRepository = resolve(ProductCompletenessScoreRepository::class);
  130          $this->variantStructurePlanner = resolve(VariantStructurePlanner::class);
  131      }
  132  
  133      protected function loadStaticData(): void


========== ITEM uo-b-01 ==========
Question (registered, verbatim):
{
 "question": "Which files call the static method SafeWebhookUrl::validate (and no other method named validate)?",
 "probe": "validate",
 "declared_in": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:31"
}

Candidate files (11):

* packages/Webkul/Core/src/Rules/Address.php
--- packages/Webkul/Core/src/Rules/Address.php:10-16
   10      /**
   11       * Run the validation rule.
   12       */
   13      public function validate(string $attribute, mixed $value, Closure $fail): void
   14      {
   15          if (! preg_match("/^[a-zA-Z0-9\s'\p{Arabic}\p{Bengali}\p{Hebrew}\p{Latin}\p{Sinhala}\p{Cyrillic}\p{Devanagari}p{Hiragana}\p{Katakana}\p{Han}\-,\(\)]{1,60}$/iu", (string) $value)) {
   16              $fail('core::validation.address')->translate();

* packages/Webkul/Product/src/Validator/AssociationValidator.php
--- packages/Webkul/Product/src/Validator/AssociationValidator.php:54-60
   54       *
   55       * @throws ValidationException
   56       */
   57      public function validate(int $associationTypeId, array $additionalData, ?int $ignoreId = null, bool $skipLocaleSpecific = false): void
   58      {
   59          $requestData = ['additional_data' => $additionalData];
   60  
--- packages/Webkul/Product/src/Validator/AssociationValidator.php:64-70
   64  
   65          $rules = $this->inputFieldsRules($existsFields, $requestData, $ignoreId, $skipLocaleSpecific);
   66  
   67          Validator::make($requestData, $rules)->validate();
   68      }
   69  
   70      /**
--- packages/Webkul/Product/src/Validator/AssociationValidator.php:98-104
   98                  $validator->errors()->add('additional_data', trans('admin::app.catalog.association_types.unknown-fields', ['fields' => implode(', ', $unknownFields)]));
   99              });
  100  
  101              $validator->validate();
  102          }
  103      }
  104  

* packages/Webkul/DataGrid/src/DataGrid.php
--- packages/Webkul/DataGrid/src/DataGrid.php:249-255
  249       */
  250      public function validatedRequest(): array
  251      {
  252          request()->validate([
  253              'filters'         => ['sometimes', 'required', 'array'],
  254              'sort'            => ['sometimes', 'required', 'array'],
  255              'pagination'      => ['sometimes', 'required', 'array'],

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:5-11
    5  it('accepts a normal public https URL', function () {
    6      // Public IP literal — bypasses DNS so the test is deterministic in
    7      // network-restricted CI. 1.1.1.1 is in public unicast space.
    8      $result = SafeWebhookUrl::validate('https://1.1.1.1/inbound');
    9  
   10      expect($result['valid'])->toBeTrue();
   11      expect($result['reason'])->toBe('');
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:27-33
   27  });
   28  
   29  it('rejects loopback IPv4 literal', function () {
   30      $result = SafeWebhookUrl::validate('http://127.0.0.1:9999/probe');
   31  
   32      expect($result['valid'])->toBeFalse();
   33      expect($result['reason'])->toBe('restricted_ip');
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:34-40
   34  });
   35  
   36  it('rejects 0.0.0.0 unspecified address', function () {
   37      $result = SafeWebhookUrl::validate('http://0.0.0.0:8080/');
   38  
   39      expect($result['valid'])->toBeFalse();
   40      expect($result['reason'])->toBe('restricted_ip');

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:143-149
  143  
  144          $url = (string) $request->input('url');
  145  
  146          if (! SafeWebhookUrl::validate($url)['valid']) {
  147              return new JsonResponse([
  148                  'success' => false,
  149                  'message' => trans('webhook::app.webhooks.validation.unsafe-url'),

* packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:13-19
   13   *  - WebhookSettingsController::store + testWebhookUrl
   14   *  - WebhookService::sendDataToWebhook / sendCreatedToWebhook / sendBatch
   15   *
   16   * DNS-rebinding (TOCTOU) defense: callers pair validate() with
   17   * httpOptions($url), which returns a CURLOPT_RESOLVE entry pinning the
   18   * hostname to the validated IP so the connection cannot re-resolve to an
   19   * internal address between check and use. HTTP redirects are also disabled.
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:28-34
   28      /**
   29       * @return array{valid: bool, reason: string, ip?: string}
   30       */
   31      public static function validate(?string $url): array
   32      {
   33          if ($url === null || $url === '') {
   34              return ['valid' => false, 'reason' => 'empty_url'];
--- packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:85-91
   85       * is unaffected.
   86       *
   87       * Returns redirect-blocking options only when the URL fails validation —
   88       * the dispatch site MUST guard with validate() first, but this fallback
   89       * stops the request from following 30x chains in the failure path.
   90       *
   91       * @return array<string, mixed>

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php:186-192
  186       */
  187      protected function deliver(Webhook $webhook, array $payload, ?string $sku, string $event, $batchProducts = null): ?Response
  188      {
  189          $safety = SafeWebhookUrl::validate($webhook->url);
  190  
  191          if (! $safety['valid']) {
  192              Log::warning('Webhook dispatch blocked — unsafe URL', [

* packages/Webkul/MagicAI/src/Validator/PlatformValidator.php
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:45-51
   45       *
   46       * @throws ValidationException
   47       */
   48      public function validate(array $data): array
   49      {
   50          Validator::make($data, $this->rules())->validate();
   51  
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:47-53
   47       */
   48      public function validate(array $data): array
   49      {
   50          Validator::make($data, $this->rules())->validate();
   51  
   52          $data['models'] = $this->validateModelNames((string) $data['models']);
   53  
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:144-150
  144      {
  145          $apiUrl = trim((string) $apiUrl);
  146  
  147          return $apiUrl === '' || SafeWebhookUrl::validate($apiUrl)['valid'];
  148      }
  149  
  150      /**

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:16-22
   16  it('reproduces: the submitted url passes validation yet the client follows a redirect to an internal host', function () {
   17      // A public host passes the pre-fetch safety check; a literal public IP is
   18      // used so the check is deterministic offline (no DNS in the test env).
   19      expect(SafeWebhookUrl::validate('https://1.1.1.1/models')['valid'])->toBeTrue();
   20  
   21      $reached = [];
   22  

* packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php
--- packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:30-36
   30              'label'    => ['required', 'string', 'max:255'],
   31              'provider' => ['required', 'string', 'in:openai,anthropic,azure,custom'],
   32              'apiUrl'   => ['required', 'url', 'max:500', function (string $attribute, mixed $value, Closure $fail): void {
   33                  if (! SafeWebhookUrl::validate($value)['valid']) {
   34                      $fail(trans('admin::app.configuration.platform.message.unsafe-api-url'));
   35                  }
   36              }],

* packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:48-54
   48                  'max:2048',
   49                  'regex:#^https?://#i',
   50                  function (string $attribute, mixed $value, Closure $fail): void {
   51                      if (! SafeWebhookUrl::validate($value)['valid']) {
   52                          $fail(trans('webhook::app.webhooks.validation.unsafe-url'));
   53                      }
   54                  },


========== ITEM uo-b-02 ==========
Question (registered, verbatim):
{
 "question": "Which files reach SafeWebhookUrl::httpOptions within two call hops?",
 "probe": "httpOptions",
 "declared_in": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93"
}

Candidate files (41):

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php: no probe token in the file

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

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:151-157
  151          }
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',

* packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php
--- packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:12-18
   12      expect($result['ip'])->toBe('1.1.1.1');
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:13-19
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
   19      expect($options['curl'][CURLOPT_RESOLVE])->toBe(['1.1.1.1:443:1.1.1.1']);
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:20-26
   20  });
   21  
   22  it('omits the pin and falls back to redirect-disable when validation fails', function () {
   23      $options = SafeWebhookUrl::httpOptions('http://127.0.0.1/hook');
   24  
   25      expect($options['allow_redirects'])->toBeFalse();
   26      expect($options)->not->toHaveKey('curl');

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php: no probe token in the file

* packages/Webkul/MagicAI/src/Enums/AiProvider.php
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:377-383
  377       */
  378      private function discoveryOptions(string $url, ?string $apiUrl, array $options): array
  379      {
  380          return $apiUrl ? $this->ssrfGuardedOptions($url, $options) : $options;
  381      }
  382  
  383      private function fetchOpenAiCompatModels(Client $client, ?string $apiKey, string $url, bool $harden = false): array
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:389-395
  389              ],
  390          ];
  391  
  392          $response = $client->get($url, $harden ? $this->ssrfGuardedOptions($url, $options) : $options);
  393  
  394          $data = json_decode($response->getBody()->getContents(), true);
  395  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:400-406
  400      {
  401          $url = rtrim($baseUrl, '/').'/api/tags';
  402  
  403          $response = $client->get($url, $this->ssrfGuardedOptions($url));
  404  
  405          $data = json_decode($response->getBody()->getContents(), true);
  406  
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:419-425
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));
  423      }
  424  
  425      private function fetchAnthropicModels(Client $client, ?string $apiKey, ?string $apiUrl = null): array
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:451-457
  451  
  452          foreach (["{$base}/openai/v1/models?api-version=preview", "{$base}/openai/models?api-version=2024-10-21"] as $url) {
  453              try {
  454                  $response = $client->get($url, $this->ssrfGuardedOptions($url, [
  455                      'headers' => [
  456                          'api-key'      => $apiKey,
  457                          'Content-Type' => 'application/json',

* packages/Webkul/Webhook/src/Routes/web.php
--- packages/Webkul/Webhook/src/Routes/web.php: no probe token in the file

* packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php: no probe token in the file

* packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php: no probe token in the file

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php: no probe token in the file

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php:127-133
  127          $lastResponse = null;
  128  
  129          foreach ($webhooks as $webhook) {
  130              $lastResponse = $this->deliver($webhook, $payload, $product->sku, $event);
  131          }
  132  
  133          return $lastResponse;
--- packages/Webkul/Webhook/src/Services/WebhookService.php:172-178
  172          $lastResponse = null;
  173  
  174          foreach ($webhooks as $webhook) {
  175              $lastResponse = $this->deliver($webhook, $payload, null, $event, $products);
  176          }
  177  
  178          return $lastResponse;
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:93-99
   93  
   94          $body = $this->buildChatBody($messages, $maxTokens, $temperature);
   95  
   96          $response = $this->execute('POST', $endpoint, $body);
   97  
   98          return $this->parseChatResponse($response);
   99      }
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:128-134
  128      protected function execute(string $method, string $url, ?array $data = null): array
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.
  131          $safeOptions = SafeWebhookUrl::httpOptions($url);
  132  
  133          throw_unless(
  134              isset($safeOptions['curl'][CURLOPT_RESOLVE]),

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:39-45
   39      expect($reached)->toContain('http://169.254.169.254/latest/meta-data/');
   40  });
   41  
   42  it('confirms the fix primitive: SafeWebhookUrl::httpOptions disables redirect following', function () {
   43      $mock = new MockHandler([
   44          new Response(302, ['Location' => 'http://169.254.169.254/latest/meta-data/']),
   45      ]);
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:47-53
   47  
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
   53      expect($response->getStatusCode())->toBe(302);

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php: no probe token in the file

* packages/Webkul/AiAgent/src/Services/EnrichmentService.php
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php: no probe token in the file

* packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php: no probe token in the file

* packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php: no probe token in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Services/ImageToProductService.php
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php: no probe token in the file

* packages/Webkul/AiAgent/src/Services/VisionService.php
--- packages/Webkul/AiAgent/src/Services/VisionService.php: no probe token in the file

* packages/Webkul/MagicAI/src/Services/ModelDiscovery.php
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php: no probe token in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php: no probe token in the file

* packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php: no probe token in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php: no probe token in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php: no probe token in the file


========== ITEM uo-b-06 ==========
Question (registered, verbatim):
{
 "question": "Which files reach WebhookService::sendBatchByIds through any chain, including string-named event listeners?",
 "probe": "sendBatchByIds",
 "declared_in": "packages/Webkul/Webhook/src/Services/WebhookService.php:54"
}

Candidate files (3):

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:35-41
   35  
   36      expect($product->audits()->count())->toBe(0);
   37  
   38      app(WebhookService::class)->sendBatchByIds([$product->id]);
   39  
   40      Http::assertSent(fn ($request) => ($request->data()['event'] ?? null) === WebhookService::EVENT_PRODUCT_UPDATED
   41          && collect($request->data()['data'] ?? [])->pluck('sku')->contains('IMPORT-UPD-1'));

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:38-44
   38              return;
   39          }
   40  
   41          $webhookService->sendBatchByIds($this->ids);
   42      }
   43  }
   44  

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: no probe token in the file


========== ITEM uo-d-02 ==========
Question (registered, verbatim):
{
 "question": "Is there an accepted path from ProductGridViewController to WebhookService::deliver?",
 "probe": "ProductGridViewController",
 "probe_to": "deliver",
 "expected": "empty"
}

Candidate files (3):

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductGridViewController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductGridViewController.php:7-13
    7  use Webkul\Admin\Http\Requests\ProductGridViewForm;
    8  use Webkul\Product\Repositories\ProductGridViewRepository;
    9  
   10  class ProductGridViewController extends Controller
   11  {
   12      public function __construct(protected ProductGridViewRepository $productGridViewRepository) {}
   13  

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: no probe token in the file

* packages/Webkul/Product/src/Repositories/ProductGridViewRepository.php
--- packages/Webkul/Product/src/Repositories/ProductGridViewRepository.php: no probe token in the file


========== ITEM uo-d-01 ==========
Question (registered, verbatim):
{
 "question": "Is there an accepted path from the PruneWebhookLogs console command to WebhookService::deliver?",
 "probe": "PruneWebhookLogs",
 "probe_to": "deliver",
 "expected": "empty"
}

Candidate files (2):

* packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php
--- packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php:9-15
    9  
   10  #[Description('Delete webhook delivery logs older than the configured retention window')]
   11  #[Signature('webhook:logs:prune {--days= : Override the configured retention window}')]
   12  class PruneWebhookLogs extends Command
   13  {
   14      public function handle(): int
   15      {

* packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php
--- packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php:5-11
    5  use Illuminate\Console\Scheduling\Schedule;
    6  use Illuminate\Support\Facades\Route;
    7  use Illuminate\Support\ServiceProvider;
    8  use Webkul\Webhook\Console\Commands\PruneWebhookLogs;
    9  use Webkul\Webhook\Registry\EventRegistry;
   10  use Webkul\Webhook\Services\RecentProductAudits;
   11  
--- packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php:27-33
   27          $this->app->register(EventServiceProvider::class);
   28  
   29          if ($this->app->runningInConsole()) {
   30              $this->commands([PruneWebhookLogs::class]);
   31  
   32              $this->app->booted(function (): void {
   33                  $this->app->make(Schedule::class)->command('webhook:logs:prune')->daily();


========== ITEM uo-b-05 ==========
Question (registered, verbatim):
{
 "question": "Which JavaScript files call or import sanitizeCode?",
 "probe": "sanitizeCode",
 "declared_in": "packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:1"
}

Candidate files (3):

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


========== ITEM uo-b-04 ==========
Question (registered, verbatim):
{
 "question": "Which files reference the CONCRETE class Webkul\\Product\\Services\\VariantStructurePlanner (not the interface of the same short name)?",
 "probe": "VariantStructurePlanner",
 "declared_in": "packages/Webkul/Product/src/Services/VariantStructurePlanner.php:12"
}

Candidate files (19):

* packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:11-17
   11  use Webkul\Completeness\Repositories\ProductCompletenessScoreRepository;
   12  use Webkul\Core\Repositories\ChannelRepository;
   13  use Webkul\Core\Repositories\LocaleRepository;
   14  use Webkul\Product\Contracts\VariantStructurePlanner;
   15  use Webkul\Product\Models\Product;
   16  use Webkul\Product\Repositories\ProductRepository;
   17  
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:31-37
   31  
   32      protected ProductCompletenessScoreRepository $completenessResultsRepository;
   33  
   34      protected VariantStructurePlanner $variantStructurePlanner;
   35  
   36      protected array $channels = [];
   37  
--- packages/Webkul/Completeness/src/Jobs/ProductCompletenessJob.php:127-133
  127          $this->attributeRepository = resolve(AttributeRepository::class);
  128          $this->completenessSettingsRepository = resolve(CompletenessSettingsRepository::class);
  129          $this->completenessResultsRepository = resolve(ProductCompletenessScoreRepository::class);
  130          $this->variantStructurePlanner = resolve(VariantStructurePlanner::class);
  131      }
  132  
  133      protected function loadStaticData(): void

* packages/Webkul/Product/src/Services/VariantStructurePlanner.php
--- packages/Webkul/Product/src/Services/VariantStructurePlanner.php:2-8
    2  
    3  namespace Webkul\Product\Services;
    4  
    5  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
    6  use Webkul\Product\Enums\ProductType;
    7  use Webkul\Product\Enums\VariantLevel;
    8  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Services/VariantStructurePlanner.php:9-15
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureProxy;
   11  
   12  class VariantStructurePlanner implements VariantStructurePlannerContract
   13  {
   14      const LEVEL_ORDER = VariantLevel::ORDER;
   15  

* packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php
--- packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php:5-11
    5  use Webkul\Installer\Database\Seeders\Demo\DemoCoreSeeder;
    6  use Webkul\Installer\Database\Seeders\Demo\DemoFamilySeeder;
    7  use Webkul\Installer\Database\Seeders\Demo\DemoProductSeeder;
    8  use Webkul\Product\Contracts\VariantStructurePlanner;
    9  use Webkul\Product\Enums\ProductType;
   10  use Webkul\Product\Models\Product;
   11  use Webkul\Product\Repositories\ProductRepository;
--- packages/Webkul/Installer/tests/Feature/DemoProductStructureComplianceTest.php:53-59
   53  it('never writes a value onto a row the variant structure does not let own it', function () {
   54      seedDemoCatalog();
   55  
   56      $planner = resolve(VariantStructurePlanner::class);
   57  
   58      $offenders = [];
   59  

* packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php
--- packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php:3-9
    3  namespace Webkul\Admin\Http\Requests;
    4  
    5  use Illuminate\Foundation\Http\FormRequest;
    6  use Webkul\Product\Contracts\VariantStructurePlanner;
    7  use Webkul\Product\Models\Product;
    8  use Webkul\Product\Repositories\ProductRepository;
    9  
--- packages/Webkul/Admin/src/Http/Requests/CheckVariantUniquenessForm.php:14-20
   14       */
   15      public function __construct(
   16          protected ProductRepository $productRepository,
   17          protected VariantStructurePlanner $variantStructurePlanner,
   18      ) {}
   19  
   20      /**

* packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:17-23
   17  use Webkul\DataTransfer\Repositories\JobInstancesRepository;
   18  use Webkul\DataTransfer\Repositories\JobTrackRepository;
   19  use Webkul\DataTransfer\Services\JobLogger;
   20  use Webkul\Product\Contracts\VariantStructurePlanner;
   21  use Webkul\Product\Models\Product;
   22  use Webkul\Product\Repositories\ProductRepository;
   23  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:62-68
   62      /**
   63       * Resolves a product's variant structure level and attribute ownership.
   64       */
   65      protected VariantStructurePlanner $variantStructurePlanner;
   66  
   67      /**
   68       * Collected validation or process errors.
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:108-114
  108          $this->productRepository = resolve(ProductRepository::class);
  109          $this->attributeService = resolve(AttributeService::class);
  110          $this->valuesValidator = resolve(ProductValuesValidator::class);
  111          $this->variantStructurePlanner = resolve(VariantStructurePlanner::class);
  112  
  113          $jobInstance = $this->jobInstancesRepository->findOneByField('code', 'bulk_product_update')
  114              ?? $this->createDemoJobInstance();

* packages/Webkul/Product/src/Repositories/ProductRepository.php
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:11-17
   11  use Webkul\Attribute\Repositories\AttributeRepository;
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:12-18
   12  use Webkul\Core\Eloquent\Repository;
   13  use Webkul\Product\Contracts\Product;
   14  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   15  use Webkul\Product\Services\VariantStructurePlanner;
   16  use Webkul\Product\Type\AbstractType;
   17  
   18  class ProductRepository extends Repository
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:230-236
  230       */
  231      public function guardVariantLevelWrite(Product $product, array $submittedCommon, ?\Closure $onGuarded = null, ?VariantStructurePlannerContract $planner = null): array
  232      {
  233          $planner ??= resolve(VariantStructurePlanner::class);
  234  
  235          $structure = $planner->structureFor($product);
  236  

* packages/Webkul/Product/src/Type/Configurable.php
--- packages/Webkul/Product/src/Type/Configurable.php:6-12
    6  use Illuminate\Support\Facades\Event;
    7  use Illuminate\Support\Str;
    8  use Webkul\Admin\Validations\ConfigurableUniqueSku;
    9  use Webkul\Product\Contracts\VariantStructurePlanner;
   10  use Webkul\Product\Enums\ProductType;
   11  use Webkul\Product\Enums\VariantLevel;
   12  use Webkul\Product\Models\Product;
--- packages/Webkul/Product/src/Type/Configurable.php:204-210
  204       */
  205      protected function updateVariantGroups($product, array $data, $productSuperAttributes, Collection|array $uniqueAttributes = [])
  206      {
  207          $planner = resolve(VariantStructurePlanner::class);
  208  
  209          $groupAxis = $planner->axisCodesByLevel($product->variantStructure)['level_1'][0] ?? null;
  210  
--- packages/Webkul/Product/src/Type/Configurable.php:281-287
  281       * `ProductRepository::guardVariantLevelWrite()` for a sibling-scoped
  282       * duplicate-combination check.
  283       */
  284      public function updateVariantGroupValues(Product $group, ?string $groupAxis, array $groupData, ?VariantStructurePlanner $planner = null): void
  285      {
  286          $submitted = $groupData['group_values'] ?? [];
  287  

* packages/Webkul/Product/src/Validator/RequiredAttributesValidator.php
--- packages/Webkul/Product/src/Validator/RequiredAttributesValidator.php:7-13
    7  use Webkul\Attribute\Models\Attribute;
    8  use Webkul\Attribute\Models\AttributeProxy;
    9  use Webkul\Product\Models\Product;
   10  use Webkul\Product\Services\VariantStructurePlanner;
   11  use Webkul\Product\Type\AbstractType;
   12  
   13  /** Checks a product against every required attribute of its family. */
--- packages/Webkul/Product/src/Validator/RequiredAttributesValidator.php:14-20
   14  class RequiredAttributesValidator
   15  {
   16      public function __construct(
   17          protected VariantStructurePlanner $variantStructurePlanner
   18      ) {}
   19  
   20      /** @return array<string, array{code: string, name: string, group_id: int}> */

* packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:3-9
    3  use Illuminate\Foundation\Testing\DatabaseTransactions;
    4  use Webkul\Attribute\Models\Attribute;
    5  use Webkul\Attribute\Models\AttributeFamily;
    6  use Webkul\Product\Contracts\VariantStructurePlanner;
    7  use Webkul\Product\Models\VariantStructure;
    8  use Webkul\Product\Repositories\VariantStructureRepository;
    9  
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:46-52
   46  });
   47  
   48  it('binds the structure planner contract', function () {
   49      expect(app(VariantStructurePlanner::class))
   50          ->toBeInstanceOf(Webkul\Product\Services\VariantStructurePlanner::class);
   51  });
   52  
--- packages/Webkul/Product/tests/Unit/Models/VariantStructureTest.php:47-52
   47  
   48  it('binds the structure planner contract', function () {
   49      expect(app(VariantStructurePlanner::class))
   50          ->toBeInstanceOf(Webkul\Product\Services\VariantStructurePlanner::class);
   51  });
   52  

* packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php
--- packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php:4-10
    4  
    5  use Illuminate\Foundation\Http\FormRequest;
    6  use Illuminate\Validation\Rule;
    7  use Webkul\Product\Contracts\VariantStructurePlanner;
    8  use Webkul\Product\Enums\ProductType;
    9  use Webkul\Product\Repositories\ProductRepository;
   10  
--- packages/Webkul/Admin/src/Http/Requests/VariantChildrenForm.php:17-23
   17       */
   18      public function __construct(
   19          protected ProductRepository $productRepository,
   20          protected VariantStructurePlanner $variantStructurePlanner,
   21      ) {}
   22  
   23      /**

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:16-22
   16  use Webkul\Core\Rules\Sku;
   17  use Webkul\Product\Enums\ProductType;
   18  use Webkul\Product\Repositories\VariantStructureRepository;
   19  use Webkul\Product\Services\VariantStructurePlanner;
   20  use Webkul\Product\Type\AbstractType;
   21  use Webkul\Product\Type\Configurable;
   22  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:43-49
   43  
   44          $structure->load('axes.attribute');
   45  
   46          $axisCodes = app(VariantStructurePlanner::class)->allAxisCodes($structure);
   47  
   48          if (empty($data['super_attributes'])) {
   49              $data['super_attributes'] = $axisCodes;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:194-200
  194  
  195          $common = $request->input('values.common', []);
  196          $sku = $common['sku'];
  197          $axisCodes = app(VariantStructurePlanner::class)->axisCodesByLevel($parent->variantStructure)['level_1'] ?? [];
  198  
  199          $missingAxisCodes = array_values(array_diff($axisCodes, array_keys($common)));
  200  

* packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:37-43
   37  use Webkul\ElasticSearch\Indexing\Normalizer\ProductNormalizer;
   38  use Webkul\ElasticSearch\Observers\Product as ElasticProductObserver;
   39  use Webkul\Measurement\Helpers\MeasurementHelper;
   40  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   41  use Webkul\Product\Enums\ProductType;
   42  use Webkul\Product\Enums\VariantLevel;
   43  use Webkul\Product\Models\Product;

* packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:1-7
    1  <?php
    2  
    3  use Webkul\Product\Enums\VariantLevel;
    4  use Webkul\Product\Services\VariantStructurePlanner;
    5  use Webkul\Product\Services\VariantStructureWriter;
    6  
    7  describe('VariantLevel', function () {
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:26-32
   26          expect(VariantStructureWriter::PLACEMENT_LEVELS)->toBe(VariantLevel::VALUES);
   27  
   28          foreach (VariantLevel::cases() as $level) {
   29              expect(VariantStructurePlanner::LEVEL_ORDER[$level->value])->toBe($level->order());
   30          }
   31  
   32          expect(VariantStructurePlanner::LEVEL_ORDER)->toHaveCount(count(VariantLevel::cases()));
--- packages/Webkul/Product/tests/Unit/Enums/VariantLevelTest.php:29-35
   29              expect(VariantStructurePlanner::LEVEL_ORDER[$level->value])->toBe($level->order());
   30          }
   31  
   32          expect(VariantStructurePlanner::LEVEL_ORDER)->toHaveCount(count(VariantLevel::cases()));
   33      });
   34  });
   35  

* packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php:15-21
   15  use Webkul\Measurement\Helpers\MeasurementHelper;
   16  use Webkul\Product\Enums\ProductType;
   17  use Webkul\Product\Enums\VariantLevel;
   18  use Webkul\Product\Services\VariantStructurePlanner;
   19  
   20  /**
   21   * Seeds the demo catalog: configurable parents, their variant structures and
--- packages/Webkul/Installer/src/Database/Seeders/Demo/DemoProductSeeder.php:23-29
   23   *
   24   * A product declaring two axes gets a two-level structure — configurable →
   25   * variant_group (level 1) → simple (level 2) — which is the shape
   26   * {@see VariantStructurePlanner} expects. One axis
   27   * produces a single-level structure with simple variants directly under the
   28   * configurable.
   29   */

* packages/Webkul/AdminApi/src/ApiDataSource/Catalog/VariantStructureDataSource.php
--- packages/Webkul/AdminApi/src/ApiDataSource/Catalog/VariantStructureDataSource.php:8-14
    8  use Webkul\Product\Enums\VariantLevel;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Repositories\VariantStructureRepository;
   11  use Webkul\Product\Services\VariantStructurePlanner;
   12  
   13  /**
   14   * Serves the variant structures of one attribute family.
--- packages/Webkul/AdminApi/src/ApiDataSource/Catalog/VariantStructureDataSource.php:36-42
   36       */
   37      public function __construct(
   38          protected VariantStructureRepository $variantStructureRepository,
   39          protected VariantStructurePlanner $variantStructurePlanner,
   40      ) {}
   41  
   42      /**
--- packages/Webkul/AdminApi/src/ApiDataSource/Catalog/VariantStructureDataSource.php:174-180
  174       *
  175       * Read-only: a write request carrying this block has it ignored rather than
  176       * rejected, so a GET body can be edited and PUT straight back. Levels come from
  177       * VariantStructurePlanner, the same map the product write guard enforces.
  178       *
  179       * @return array<string, array<int, string>>
  180       */

* packages/Webkul/Product/tests/Unit/Services/VariantStructurePlannerTest.php
--- packages/Webkul/Product/tests/Unit/Services/VariantStructurePlannerTest.php:4-10
    4  use Illuminate\Support\Str;
    5  use Webkul\Attribute\Models\Attribute;
    6  use Webkul\Attribute\Models\AttributeFamily;
    7  use Webkul\Product\Contracts\VariantStructurePlanner as PlannerContract;
    8  use Webkul\Product\Enums\VariantLevel;
    9  use Webkul\Product\Models\VariantStructure;
   10  use Webkul\Product\Models\VariantStructureAttribute;

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:19-25
   19  use Webkul\Product\Helpers\ProductType as ProductTypeHelper;
   20  use Webkul\Product\Models\Product;
   21  use Webkul\Product\Repositories\ProductRepository;
   22  use Webkul\Product\Services\VariantStructurePlanner;
   23  use Webkul\Product\Type\AbstractType as ProductAbstractType;
   24  use Webkul\Product\Type\Configurable;
   25  use Webkul\Product\Validator\ProductValuesValidator;
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:435-441
  435              );
  436          }
  437  
  438          $planner = app(VariantStructurePlanner::class);
  439  
  440          $structure = $planner->structureFor($group);
  441  

* packages/Webkul/Product/src/Providers/ProductServiceProvider.php
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:6-12
    6  use Illuminate\Support\ServiceProvider;
    7  use Webkul\Product\Console\ResyncVariantsCommand;
    8  use Webkul\Product\Console\StripRedundantVariantValuesCommand;
    9  use Webkul\Product\Contracts\VariantStructurePlanner as VariantStructurePlannerContract;
   10  use Webkul\Product\Contracts\VariantValueResolver as VariantValueResolverContract;
   11  use Webkul\Product\Facades\ProductImage as ProductImageFacade;
   12  use Webkul\Product\Facades\ProductVideo as ProductVideoFacade;
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:45-51
   45  use Webkul\Product\ProductImage;
   46  use Webkul\Product\ProductVideo;
   47  use Webkul\Product\Services\ProductValueMapper;
   48  use Webkul\Product\Services\VariantStructurePlanner;
   49  use Webkul\Product\Services\VariantValueResolver;
   50  use Webkul\Product\ValueSetter;
   51  
--- packages/Webkul/Product/src/Providers/ProductServiceProvider.php:95-101
   95      {
   96          // Bound (fresh per resolve), not scoped: the per-product memo must not survive a same-request mutation.
   97          $this->app->bind(VariantValueResolverContract::class, VariantValueResolver::class);
   98          $this->app->bind(VariantStructurePlannerContract::class, VariantStructurePlanner::class);
   99      }
  100  
  101      /**

* packages/Webkul/Product/src/Models/Product.php
--- packages/Webkul/Product/src/Models/Product.php:24-30
   24  use Webkul\HistoryControl\Presenters\BooleanPresenter;
   25  use Webkul\HistoryControl\Traits\HistoryTrait;
   26  use Webkul\Product\Contracts\Product as ProductContract;
   27  use Webkul\Product\Contracts\VariantStructurePlanner;
   28  use Webkul\Product\Contracts\VariantValueResolver;
   29  use Webkul\Product\Database\Eloquent\Builder;
   30  use Webkul\Product\Database\Factories\ProductFactory;
--- packages/Webkul/Product/src/Models/Product.php:202-208
  202              return [];
  203          }
  204  
  205          $planner = resolve(VariantStructurePlanner::class);
  206  
  207          return CompletenessSetting::where('family_id', $this->attribute_family_id)
  208              ->where('channel_id', $channelId)


========== ITEM uo-e-03 ==========
Question (registered, verbatim):
{
 "question": "If WebhookService::getProductChangesForWebhook changes its contract, which files must be re-read?",
 "probe": "getProductChangesForWebhook",
 "declared_in": "packages/Webkul/Webhook/src/Services/WebhookService.php:366"
}

Candidate files (13):

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php: no probe token in the file

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php: no probe token in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php: no probe token in the file

* packages/Webkul/Webhook/src/Listeners/Product.php
--- packages/Webkul/Webhook/src/Listeners/Product.php:31-37
   31              return;
   32          }
   33  
   34          $changes = $this->webhookService->getProductChangesForWebhook($product);
   35  
   36          if ($changes === []) {
   37              return;
--- packages/Webkul/Webhook/src/Listeners/Product.php:46-52
   46              return;
   47          }
   48  
   49          $changes = $this->webhookService->getProductChangesForWebhook($product);
   50  
   51          if ($changes === []) {
   52              return;

* packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php
--- packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:10-16
   10  
   11      $product->update(['sku' => $product->sku.'-changed']);
   12  
   13      $changes = app(WebhookService::class)->getProductChangesForWebhook($product);
   14  
   15      expect($changes)->not->toBeEmpty()
   16          ->and($changes['changed'] ?? [])->toHaveKey('sku');
--- packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:23-29
   23  
   24      Carbon::setTestNow(now()->addSeconds(30));
   25  
   26      $changes = app(WebhookService::class)->getProductChangesForWebhook($product);
   27  
   28      Carbon::setTestNow();
   29  
--- packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:37-43
   37  
   38      Carbon::setTestNow(now()->addHours(3));
   39  
   40      $changes = app(WebhookService::class)->getProductChangesForWebhook($product);
   41  
   42      Carbon::setTestNow();
   43  

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:39-45
   39  
   40      app(ProductListener::class)->afterUpdate($product);
   41  
   42      Queue::assertPushed(SendProductWebhook::class);
   43  });
   44  
   45  it('sends exactly one batched webhook job for a bulk-edited product', function () {

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: no probe token in the file

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: no probe token in the file

* packages/Webkul/Webhook/src/Services/WebhookService.php
--- packages/Webkul/Webhook/src/Services/WebhookService.php:85-91
   85          $lastResponse = null;
   86  
   87          foreach (array_chunk($values, $this->batchChunkSize()) as $chunk) {
   88              $lastResponse = $this->sendBatch(
   89                  $this->productRepository->findWhereIn($field, $chunk),
   90                  $computeChanges,
   91                  $event,
--- packages/Webkul/Webhook/src/Services/WebhookService.php:149-155
  149  
  150          foreach ($products as $product) {
  151              $productChanges = $computeChanges
  152                  ? $this->getProductChangesForWebhook($product)
  153                  : [];
  154  
  155              if ($skipIfNoChanges && $productChanges === []) {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:363-369
  363       * one, so a slow write cannot lose its payload. Queued batches have no such record
  364       * and fall back to the newest audit by id, still bounded by product freshness.
  365       */
  366      public function getProductChangesForWebhook(Product $product): array
  367      {
  368          $latestChanges = $this->recentProductAudits->for($product->getKey())
  369              ?? $product->audits()->orderByDesc('id')->first();


========== ITEM uo-e-02 ==========
Question (registered, verbatim):
{
 "question": "If ProductRepository::isUniqueVariantForProduct changes its contract, which files must be re-read?",
 "probe": "isUniqueVariantForProduct",
 "declared_in": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184"
}

Candidate files (23):

* packages/Webkul/Product/src/Type/AbstractType.php
--- packages/Webkul/Product/src/Type/AbstractType.php:196-202
  196          };
  197  
  198          if ($product->parent_id && ! empty($productValues[self::COMMON_VALUES_KEY])) {
  199              $this->productRepository->guardVariantLevelWrite($product, $productValues[self::COMMON_VALUES_KEY], $persist);
  200          } else {
  201              $persist();
  202          }

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:60-66
   60  
   61      $repository = app(ProductRepository::class);
   62  
   63      expect(fn () => $repository->guardVariantLevelWrite($simple->fresh(), [$colorCode => 'green']))
   64          ->toThrow(ValidationException::class);
   65  });
   66  

* packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:106-112
  106          'variant_structure_id' => $structure->id,
  107      ]);
  108  
  109      expect(fn () => $repository->guardVariantLevelWrite($configurable->fresh(), [$color->code => 'red']))
  110          ->toThrow(ValidationException::class);
  111  
  112      $repository->update([

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:28-34
   28  
   29      $repository = app(ProductRepository::class);
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:30-36
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();
   35  });
   36  

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:213-219
  213          $node = DB::transaction(function () use ($parent, $sku, $axisTuple, $common) {
  214              $this->productRepository->getModel()::query()->whereKey($parent->id)->lockForUpdate()->first();
  215  
  216              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($parent->id, $axisTuple, null, '', ProductType::VariantGroup->value)) {
  217                  return null;
  218              }
  219  

* packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php: no probe token in the file

* packages/Webkul/Product/src/Type/Configurable.php
--- packages/Webkul/Product/src/Type/Configurable.php:301-307
  301          };
  302  
  303          if ($group->parent_id && $submitted !== []) {
  304              $this->productRepository->guardVariantLevelWrite($group, $submitted, $persist, $planner);
  305  
  306              return;
  307          }
--- packages/Webkul/Product/src/Type/Configurable.php:447-453
  447          if ($variant->parent_id && $suppliedCommonValues !== []) {
  448              $result = $variant;
  449  
  450              $this->productRepository->guardVariantLevelWrite($variant, $suppliedCommonValues, function () use (&$result, $persist): void {
  451                  $result = $persist();
  452              }, $planner);
  453  

* packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:305-311
  305          }
  306  
  307          try {
  308              $this->productRepository->guardVariantLevelWrite(
  309                  $product,
  310                  $submittedCommon,
  311                  $persist,

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1277-1283
 1277          $configurableValues = $this->ownLevelAxisValues($product, $data['values']['common'] ?? []);
 1278  
 1279          if (! empty($configurableValues) && $product->parent_id) {
 1280              $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1281                  productId: $product->parent_id,
 1282                  configAttributes: $configurableValues,
 1283                  variantId: $id
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1582-1588
 1582      {
 1583          $data = $request->validated();
 1584  
 1585          $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1586              $data['parentId'],
 1587              $data['variantAttributes'],
 1588              $data['sku'] ?? null,

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php: no probe token in the file

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php: no probe token in the file

* packages/Webkul/Admin/src/Routes/catalog-routes.php
--- packages/Webkul/Admin/src/Routes/catalog-routes.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php: no probe token in the file

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:206-212
  206          if ($product->parent_id && ! empty($submittedCommon)) {
  207              $result = $product;
  208  
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  210                  $result = $persist();
  211              });
  212  
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:484-490
  484          return DB::transaction(function () use ($group, $configurable, $axisTuple, $axisAttributes, $variantData): Product {
  485              $this->productRepository->getModel()::query()->whereKey($group->id)->lockForUpdate()->first();
  486  
  487              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($group->id, $axisTuple, null, '', ProductType::Simple->value)) {
  488                  throw new UnprocessableEntityHttpException(
  489                      trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($axisTuple)])
  490                  );
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:586-592
  586          }
  587  
  588          if (! empty($configurableValues) && $parentProduct) {
  589              $isUnique = $this->productRepository->isUniqueVariantForProduct(
  590                  productId: $parentProduct->id,
  591                  configAttributes: $configurableValues,
  592              );

* packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3136-3142
 3136  
 3137          $this->cachedVariantValues[$parentProduct->sku][$productData['sku']] = $variantConfigValues;
 3138  
 3139          $isUnique = $this->productRepository->isUniqueVariantForProduct($parentProduct->id, $variantConfigValues, $productData['sku'], $variationId);
 3140  
 3141          if (! $isUnique) {
 3142              $this->skipRow($rowNumber, self::ERROR_NOT_UNIQUE_VARIANT, 'sku', trans($this->messages[self::ERROR_NOT_UNIQUE_VARIANT]));

* packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php: no probe token in the file

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:157-163
  157      })->throws(ModelNotFoundException::class);
  158  });
  159  
  160  describe('isUniqueVariantForProduct', function () {
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:161-167
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
  164          $result = $this->productRepository->isUniqueVariantForProduct(
  165              $parent->id,
  166              ['color' => 'red']
  167          );
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:179-185
  179              ],
  180          ]);
  181  
  182          $result = $this->productRepository->isUniqueVariantForProduct(
  183              $parent->id,
  184              ['color' => 'blue'],
  185              null,

* packages/Webkul/Product/src/Repositories/ProductRepository.php
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:181-187
  181       *
  182       * @throws \InvalidArgumentException
  183       */
  184      public function isUniqueVariantForProduct(string|int $productId, array $configAttributes, ?string $sku = null, string|int|null $variantId = '', ?string $type = null): bool
  185      {
  186          foreach (array_keys($configAttributes) as $variantAttribute) {
  187              if (! preg_match('/^[A-Za-z0-9_]+$/', (string) $variantAttribute)) {
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:298-304
  298          DB::transaction(function () use ($product, $newTuple, $onGuarded): void {
  299              $this->getModel()::query()->whereKey($product->parent_id)->lockForUpdate()->exists();
  300  
  301              if (! $this->isUniqueVariantForProduct($product->parent_id, $newTuple, null, $product->id, $product->type)) {
  302                  throw ValidationException::withMessages([
  303                      'axis' => [trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($newTuple)])],
  304                  ]);

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php: no probe token in the file

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:480-486
  480              }
  481  
  482              try {
  483                  $this->productRepository->guardVariantLevelWrite(
  484                      $product,
  485                      $submittedCommon,
  486                      null,

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php: no probe token in the file

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:102-108
  102                      ($data['variant']['attributes'] ?? [])
  103                  );
  104  
  105                  $product = $this->createOrUpdateVariant($data);
  106                  unset($data['variant']);
  107              }
  108  

* packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php: no probe token in the file


========== ITEM uo-c-tests-02 ==========
Question (registered, verbatim):
{
 "question": "Which test files exercise WebhookService::sendBatchForBulkEdit, directly or through the job that calls it?",
 "probe": "sendBatchForBulkEdit"
}

Candidate files (8):

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php: no probe token in the file

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: no probe token in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php: no probe token in the file

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  


========== ITEM uo-c-tests-03 ==========
Question (registered, verbatim):
{
 "question": "Which test files exercise ProductRepository::isUniqueVariantForProduct, directly or through a caller?",
 "probe": "isUniqueVariantForProduct"
}

Candidate files (16):

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php:322-328
  322      $importer->setImport($jobTrack);
  323      $importer->setErrorHelper($errorHelper = app(Error::class));
  324  
  325      expect($importer->validateRow($row, 1))->toBeTrue(json_encode($errorHelper->getAllErrors()));
  326  
  327      $importer->importBatch(JobTrackBatch::factory()->create(['data' => [$row], 'job_track_id' => $jobTrack->id]));
  328  

* packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:183-189
  183          $importer->setImport($jobTrack);
  184          $importer->setErrorHelper(app(Error::class));
  185  
  186          expect($importer->validateRow($row, 1))->toBeTrue();
  187  
  188          $batch = JobTrackBatch::factory()->create([
  189              'data'         => [$row],

* packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:106-112
  106          'variant_structure_id' => $structure->id,
  107      ]);
  108  
  109      expect(fn () => $repository->guardVariantLevelWrite($configurable->fresh(), [$color->code => 'red']))
  110          ->toThrow(ValidationException::class);
  111  
  112      $repository->update([

* packages/Webkul/DataTransfer/tests/Feature/ProductAssociationImportTest.php
--- packages/Webkul/DataTransfer/tests/Feature/ProductAssociationImportTest.php: no probe token in the file

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:28-34
   28  
   29      $repository = app(ProductRepository::class);
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:30-36
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();
   35  });
   36  

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:105-111
  105  
  106      $repository = app(ProductRepository::class);
  107  
  108      expect(fn () => $repository->guardVariantLevelWrite($red->fresh(), [$colorCode => 'pink']))
  109          ->toThrow(ValidationException::class);
  110  });
  111  

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php: no probe token in the file

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:157-163
  157      })->throws(ModelNotFoundException::class);
  158  });
  159  
  160  describe('isUniqueVariantForProduct', function () {
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:161-167
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
  164          $result = $this->productRepository->isUniqueVariantForProduct(
  165              $parent->id,
  166              ['color' => 'red']
  167          );
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:179-185
  179              ],
  180          ]);
  181  
  182          $result = $this->productRepository->isUniqueVariantForProduct(
  183              $parent->id,
  184              ['color' => 'blue'],
  185              null,

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:207-213
  207          'variant_structure_id' => $structure->id,
  208      ]);
  209  
  210      $this->withHeaders($this->headers)->json('POST', route('admin.api.configurable_products.store'), [
  211          'type'   => ProductType::VariantGroup->value,
  212          'parent' => $configurable->sku,
  213          'values' => ['common' => ['sku' => 'vgp-group', $color->code => $color->options->first()->code]],

* packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php:339-345
  339          ],
  340      ];
  341  
  342      $expected = trans('admin::app.catalog.products.edit.types.configurable.variant-combination-exists', [
  343          'values' => ($attribute->name ?: $attribute->code).': '.$attribute->options->first()->code,
  344      ]);
  345  
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php:656-662
  656          ],
  657      ];
  658  
  659      $expected = trans('admin::app.catalog.products.edit.types.configurable.variant-combination-exists', [
  660          'values' => ($attribute->name ?: $attribute->code).': '.$attribute->options->first()->code,
  661      ]);
  662  

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php: no probe token in the file

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php:136-142
  136  
  137  function runBulkVariantLevelUpdate(array $payload): JobTrack
  138  {
  139      (new BulkProductUpdate($payload, auth()->guard('admin')->id()))->handle();
  140  
  141      return JobTrack::latest('id')->first();
  142  }

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php:75-81
   75  
   76  function putCommonValuesForCombinationTest($test, Product $product, array $commonValues)
   77  {
   78      return $test->put(route('admin.catalog.products.update', $product->id), [
   79          'sku'    => $product->sku,
   80          'values' => [
   81              'common' => array_merge(['sku' => $product->sku], $commonValues),

* packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php:41-47
   41  
   42  function postVariantUniquenessCheck($test, array $payload)
   43  {
   44      return $test->postJson(route('admin.catalog.products.check-variant'), $payload);
   45  }
   46  
   47  it('rejects a variant attribute key that is not an axis of the parent and never compiles it into a json path', function () {

* (every other test that PUTs admin.catalog.products.update or saves a product through AbstractType::update)
--- (every other test that PUTs admin.catalog.products.update or saves a product through AbstractType::update): no probe token in the file