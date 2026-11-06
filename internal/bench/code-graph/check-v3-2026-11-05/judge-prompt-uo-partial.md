You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository; the source lines below were extracted mechanically from the subject at its registered pin, with line numbers. A reader with repository access proposed an answer set; a static reference engine (the oracle) listed files where it could. Neither is authoritative.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question) or `OUT`, and give a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Answer the question as worded. Do not reward or penalise a file for who proposed it.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `unopim` at its registered pin.



========== ITEM uo-b-02 ==========
Question (registered, verbatim):
{
 "id": "uo-b-02",
 "suite": "B",
 "class": "precise-semantics",
 "shape": "callers-transitive",
 "subject": "unopim",
 "language": "php",
 "question": "Which files reach SafeWebhookUrl::httpOptions within two call hops?",
 "probe": "httpOptions",
 "declared_in": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:154 (hop 1)",
  "packages/Webkul/Webhook/src/Services/WebhookService.php:205 inside deliver() (hop 1)",
  "packages/Webkul/MagicAI/src/Enums/AiProvider.php:422 (hop 1)",
  "packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:131 (hop 1)",
  "callers of WebhookService::deliver, AiProvider and AiApiClient (hop 2), resolved by the oracle"
 ],
 "distractors": [
  {
   "path": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php",
   "why": ":14 is a docblock listing call sites"
  },
  {
   "path": "packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php",
   "why": ":42 mentions httpOptions inside a test-name string; :50 is a real call and counts"
  }
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["depth cap 6 reached", "route hops not followed from 4 controller entry point(s)", "framework-invoked entry point(s) not followed: Webkul\\AiAgent\\Pipelines\\Stages\\CallAiProviderStage::handle, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\EnrichmentStep::handle, Webkul\\AiAgent\\Chat\\Tools\\GenerateContent::register, Webkul\\AiAgent\\Chat\\Tools\\AnalyzeImage::register, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\VisionDetectionStep::handle, Webkul\\AiAgent\\Services\\VisionService::analyzeContext, Webkul\\Webhook\\Jobs\\SendProductWebhook::handle, Webkul\\Webhook\\Services\\WebhookService::sendBatchBySkus, Webkul\\AiAgent\\Jobs\\AutoEnrichProductJob::handle, Webkul\\Webhook\\Jobs\\SendBulkEditProductWebhook::handle"]

Reader notes: answerable_as_registered=True; Method-level hop counting: a file is in if one of its functions calls httpOptions (hop 1) or calls a function that does (hop 2). Every hop-2 function lives in the same file as its hop-1 callee (deliver/ssrfGuardedOptions/execute are protected or private), so the 2-hop answer collapses to the 6 hop-1 files. The corpus basis says 'callers of WebhookService::deliver, AiProvider and AiApiClient (hop 2)'; deliver is protected and called only inside WebhookService, so read literally that adds nothing cross-file. Reading B (count any caller of the hop-1 *classes'* public entry points as hop 2) would add: Jobs/SendProductWebhook, SendBulkProductWebhook, SendBulkEditProductWebhook; MagicAI Services/ModelDiscovery; AiAgent CallAiProviderStage, EnrichmentStep, EnrichmentService, VisionService, CredentialController; and the tests calling WebhookService publics or AiProvider::fetchModels/discoverModels (WebhookFanOutTest, WebhookProductCreateTest, WebhookStatusTest, ProductMeasurementWebhookTest, BatchChunkTest, BatchLogSliceTest, ImportUpdateWebhookDeliveryTest, AiProviderCustomTest, AzureModelDiscoveryTest, ConcentrateProviderTest, CustomModelDiscoveryTest, AiProviderMatrixTest, AiProviderTest). The oracle's set is the >=3 transitive closure, not a 2-hop set.
Reader on the oracle's open list: Route hop: only route into a hop-1 method is webhook.test -> WebhookController::test; no PHP test requests that route (grep for 'webhook.test' in tests finds only the event string inside the controller). Framework entry points listed by the oracle (pipeline stages, chat tools, jobs, sendBatchBySkus) are all >=3 call hops from httpOptions; sendBatchBySkus has no caller at all at the pin. Depth cap is irrelevant under a 2-hop bound.

Candidate files (41):

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php  {"proposed_by_reader": true, "reader_reason": "hop 1: test() calls SafeWebhookUrl::httpOptions($url)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:151-157
  151          }
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',

* packages/Webkul/Webhook/src/Services/WebhookService.php  {"proposed_by_reader": true, "reader_reason": "hop 1: deliver() calls httpOptions; hop 2: fanOutSingle() and sendBatch() call deliver() (protected, same file)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);
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

* packages/Webkul/MagicAI/src/Enums/AiProvider.php  {"proposed_by_reader": true, "reader_reason": "hop 1: private ssrfGuardedOptions() calls httpOptions; hop 2: discoveryOptions/fetchOpenAiCompatModels/fetchOllamaModels/fetchAzureModels call it (all private, same file)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:419-425
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));
  423      }
  424  
  425      private function fetchAnthropicModels(Client $client, ?string $apiKey, ?string $apiUrl = null): array
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

* packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php  {"proposed_by_reader": true, "reader_reason": "hop 1: execute() calls httpOptions; hop 2: chat() calls execute() (same file)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:128-134
  128      protected function execute(string $method, string $url, ?array $data = null): array
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.
  131          $safeOptions = SafeWebhookUrl::httpOptions($url);
  132  
  133          throw_unless(
  134              isset($safeOptions['curl'][CURLOPT_RESOLVE]),
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:93-99
   93  
   94          $body = $this->buildChatBody($messages, $maxTokens, $temperature);
   95  
   96          $response = $this->execute('POST', $endpoint, $body);
   97  
   98          return $this->parseChatResponse($response);
   99      }

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct calls", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
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

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct call (line 42 is only a test-name string)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1 (:50)"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:47-53
   47  
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
   53      expect($response->getStatusCode())->toBe(302);

* packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: controller -> ModelDiscovery::discover -> AiProvider::discoverModels -> fetchModelCatalog -> fetchX -> ssrfGuardedOptions -> httpOptions: >=5 hops"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls AiProvider::fetchModels (:32): fetchModels->fetchModelCatalog->fetchX->ssrfGuardedOptions->httpOptions, >=4 hops"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: fetchModels caller (:31), >=4 hops"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: fetchModels caller (:40), >=4 hops"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: discoverModels caller (:32), >=4 hops"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendCreatedToWebhook (:38) -> fanOutSingle -> deliver -> httpOptions: 4 hops"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendCreatedToWebhook (:105), 4 hops"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendDataToWebhook (:45), 4 hops"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: VisionService::analyze -> ... -> chat -> execute -> httpOptions, >=4 hops"}
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: EnrichmentService::enrich -> chat -> execute -> httpOptions, 4 hops"}
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: testConnection (:144) -> chat -> execute -> httpOptions: 4 hops"}
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: ImageToProductService::execute chain, >=5 hops"}
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: EnrichmentService::enrich chain, 4 hops"}
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls chat (:34): chat -> execute -> httpOptions = 3 hops"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls chat (:108), 3 hops"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: VisionService::analyze chain, >=4 hops"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Services/EnrichmentService.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls chat (:82), 3 hops"}
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Services/ImageToProductService.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: VisionService/EnrichmentService chain, >=4 hops"}
--- packages/Webkul/AiAgent/src/Services/ImageToProductService.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Services/VisionService.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls chat (:132), 3 hops"}
--- packages/Webkul/AiAgent/src/Services/VisionService.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: its double overrides execute() (:18); chat() dispatches to the override, so httpOptions is never reached; even statically it is 3 hops"}
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: ModelDiscovery::discover (:199) chain, >=5 hops"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php: none of ['httpOptions'] appears in the file

* packages/Webkul/MagicAI/src/Services/ModelDiscovery.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: discoverModels (:19) -> fetchModelCatalog -> fetchX -> ssrfGuardedOptions -> httpOptions, >=4 hops"}
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php: none of ['httpOptions'] appears in the file

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: fetchModels caller (:210), >=4 hops"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: fetchModels/discoverModels caller, >=4 hops"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendCreatedToWebhook/sendDataToWebhook (:125,:170), 4 hops"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchForBulkEdit (:31) -> deliverChunked -> sendBatch -> deliver -> httpOptions: 5 hops"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchByIds/sendBatchCreatedByIds, 5 hops"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendCreatedToWebhook/sendDataToWebhook (:44-45), 4 hops"}
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchForBulkEdit (:31), 6 hops", "reader_excluded_because": "ChunkedWebhookService subclass (:9) overrides batchChunkSize only, does not call deliver"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchForBulkEdit (:26), 6 hops"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchByIds (:38), 6 hops"}
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: job handle (:114), >=6 hops"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php  {"proposed_by_reader": false, "reader_excluded_because": "declaring file; :17 is a docblock mention, no self-call"}
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

* packages/Webkul/Webhook/src/Routes/web.php  {"proposed_by_reader": false, "reader_excluded_because": "registers route webhook.test -> WebhookController::test (:16); a route registration, not a call"}
--- packages/Webkul/Webhook/src/Routes/web.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "frontend axios.post to route('webhook.test') (:251): an HTTP hop into WebhookController::test, i.e. hop 2 only if HTTP-from-Blade counts as a call; not a PHP call"}
--- packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php: none of ['httpOptions'] appears in the file


========== ITEM uo-b-05 ==========
Question (registered, verbatim):
{
 "id": "uo-b-05",
 "suite": "B",
 "class": "precise-semantics",
 "shape": "callers",
 "subject": "unopim",
 "language": "js",
 "question": "Which JavaScript files call or import sanitizeCode?",
 "probe": "sanitizeCode",
 "declared_in": "packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:1",
 "hop_stratum": 1,
 "basis": [
  "packages/Webkul/Admin/src/Resources/assets/js/directives/code.js:1 -- import",
  "packages/Webkul/Admin/src/Resources/assets/js/app.js:245,300 -- import, exposed as $sanitizeCode",
  "packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:12 -- generateCode calls it"
 ],
 "note": "JS-only question; the Blade consumers of $sanitizeCode belong to uo-e-x-01."
}

Reference engine (oracle) status: oracle; its open list: []

Reader notes: answerable_as_registered=True; grep over .js/.ts/.vue/.mjs in packages/ (excluding node_modules, vendor, build, dist, public) finds exactly these three files.
Reader on the oracle's open list: none listed. Blade templates using $sanitizeCode are out of scope (JS-only question, belong to uo-e-x-01).

Candidate files (3):

* packages/Webkul/Admin/src/Resources/assets/js/app.js  {"proposed_by_reader": true, "reader_reason": "imports sanitizeCode and exposes it as $sanitizeCode", "listed_by_oracle": true, "reader_on_oracle_file": "keep: import + global property"}
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

* packages/Webkul/Admin/src/Resources/assets/js/directives/code.js  {"proposed_by_reader": true, "reader_reason": "imports and calls it", "listed_by_oracle": true, "reader_on_oracle_file": "keep: import + call"}
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

* packages/Webkul/Admin/src/Resources/assets/js/utils/code.js  {"proposed_by_reader": true, "reader_reason": "generateCode calls sanitizeCode (declared at :1)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: self-call in generateCode"}
--- packages/Webkul/Admin/src/Resources/assets/js/utils/code.js:9-15
    9  }
   10  
   11  export function generateCode(value) {
   12      return sanitizeCode(
   13          value
   14              .toString()
   15              .trim()


========== ITEM uo-c-tests-01 ==========
Question (registered, verbatim):
{
 "id": "uo-c-tests-01",
 "suite": "C",
 "class": "tests-for",
 "subject": "unopim",
 "language": "php",
 "question": "Which test files exercise SafeWebhookUrl, directly or through a caller?",
 "probe": "SafeWebhookUrl",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php -- direct",
  "packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php and PlatformExtrasSsrfTest.php -- import it"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["depth cap 6 reached", "route hops not followed from 7 controller entry point(s)", "framework-invoked entry point(s) not followed: webhookRules, Webkul\\AiAgent\\Pipelines\\Stages\\CallAiProviderStage::handle, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\EnrichmentStep::handle, Webkul\\AiAgent\\Chat\\Tools\\GenerateContent::register, Webkul\\AiAgent\\Chat\\Tools\\AnalyzeImage::register, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\VisionDetectionStep::handle, Webkul\\AiAgent\\Services\\VisionService::analyzeContext, Webkul\\Webhook\\Jobs\\SendProductWebhook::handle, Webkul\\Webhook\\Services\\WebhookService::sendBatchBySkus, Webkul\\AiAgent\\Jobs\\AutoEnrichProductJob::handle, Webkul\\MagicAI\\Console\\Commands\\Platform\\AddPlatform::perform, Webkul\\MagicAI\\Console\\Commands\\Platform\\EditPlatform::perform, Webkul\\Webhook\\Jobs\\SendBulkEditProductWebhook::handle"]

Reader notes: answerable_as_registered=True; Criterion: a test exercises SafeWebhookUrl when its executed code path reaches validate() or httpOptions(); tests whose only route to it is a faked queue/bus are excluded. Product-saving tests that fire catalog.product.*.after with no active webhook stop at hasActiveForEvent and are excluded. The MagicAI route tests are kept on the basis that their route handler calls PlatformValidator::isSafeApiUrl/validateApiUrl; individual cases that 403 or 404 before the handler (AclBypass first two cases, OrphanPlatformFallback) lower confidence for those files. The corpus basis is right for SafeWebhookUrlTest and FetchModelsSsrfTest but PlatformExtrasSsrfTest does not import SafeWebhookUrl; it reaches it via the route.
Reader on the oracle's open list: Route hops followed: webhook.store/update (WebhookForm), admin.magic_ai.platform.store/update/test/fetch_models (PlatformValidator + ModelDiscovery), webhook.test (no test hits it). CredentialController has no route at the pin (only its own file references it), so no credential route test exists. Framework-invoked: catalog.product.*.after events -> Listeners/Product -> jobs; QUEUE_CONNECTION=sync in phpunit.xml:137, so a test with an active webhook and no queue fake reaches deliver (BulkEditWebhookActingUserTest). AddPlatform/EditPlatform::perform reached via artisan in PlatformCommandsTest. 'webhookRules' in the oracle's open list is the helper inside WebhookFormValidationTest.

Candidate files (42):

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php  {"proposed_by_reader": true, "reader_reason": "direct validate/httpOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
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

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php  {"proposed_by_reader": true, "reader_reason": "direct validate/httpOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
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

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php  {"proposed_by_reader": true, "reader_reason": "runs WebhookForm rules through Validator; url closure calls SafeWebhookUrl::validate", "listed_by_oracle": true, "reader_on_oracle_file": "keep: WebhookForm rule closure"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFormValidationTest.php:8-14
    8      $request = WebhookForm::create('/admin/configuration/webhook/create', 'POST');
    9      $request->setContainer(app());
   10  
   11      return $request->rules();
   12  }
   13  
   14  function validateWebhook(array $payload): Illuminate\Contracts\Validation\Validator
--- packages/Webkul/Webhook/src/Http/Requests/WebhookForm.php:48-54
   48                  'max:2048',
   49                  'regex:#^https?://#i',
   50                  function (string $attribute, mixed $value, Closure $fail): void {
   51                      if (! SafeWebhookUrl::validate($value)['valid']) {
   52                          $fail(trans('webhook::app.webhooks.validation.unsafe-url'));
   53                      }
   54                  },

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php  {"proposed_by_reader": true, "reader_reason": "POST webhook.store -> WebhookForm url rule -> SafeWebhookUrl::validate"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookQuickCreateTest.php:34-40
   34  });
   35  
   36  it('creates a webhook from the required fields and returns the edit redirect', function () {
   37      $response = $this->postJson(route('webhook.store'), [
   38          'name'   => 'Quick Created',
   39          'url'    => 'https://example.com/quick-create',
   40          'events' => ['product.created'],

* packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php  {"proposed_by_reader": true, "reader_reason": "validates against CredentialForm rules whose closure calls SafeWebhookUrl::validate", "listed_by_oracle": true, "reader_on_oracle_file": "keep: CredentialForm rule closure"}
--- packages/Webkul/AiAgent/tests/Unit/CredentialApiUrlSsrfTest.php:22-28
   22  it('rejects an api url pointing at the cloud metadata address', function () {
   23      $validator = Validator::make(
   24          credentialPayload('http://169.254.169.254/latest/meta-data'),
   25          (new CredentialForm)->rules()
   26      );
   27  
   28      expect($validator->fails())->toBeTrue()
--- packages/Webkul/AiAgent/src/Http/Requests/CredentialForm.php:30-36
   30              'label'    => ['required', 'string', 'max:255'],
   31              'provider' => ['required', 'string', 'in:openai,anthropic,azure,custom'],
   32              'apiUrl'   => ['required', 'url', 'max:500', function (string $attribute, mixed $value, Closure $fail): void {
   33                  if (! SafeWebhookUrl::validate($value)['valid']) {
   34                      $fail(trans('admin::app.configuration.platform.message.unsafe-api-url'));
   35                  }
   36              }],

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php  {"proposed_by_reader": true, "reader_reason": "sendCreatedToWebhook -> deliver -> validate/httpOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:35-41
   35  
   36      $product = Product::factory()->create();
   37  
   38      app(WebhookService::class)->sendCreatedToWebhook($product);
   39  
   40      Http::assertSent(fn ($request) => str_contains($request->url(), '1.1.1.1'));
   41      Http::assertSent(fn ($request) => str_contains($request->url(), '8.8.8.8'));

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php  {"proposed_by_reader": true, "reader_reason": "sendCreatedToWebhook -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver (:105)"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:102-108
  102  
  103      Http::fake();
  104  
  105      $service->sendCreatedToWebhook($product);
  106  
  107      Http::assertSent(function ($request) use ($product) {
  108          $body = $request->data();

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php  {"proposed_by_reader": true, "reader_reason": "sendDataToWebhook -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:42-48
   42  
   43      $product = Product::factory()->create();
   44  
   45      app(WebhookService::class)->sendDataToWebhook($product);
   46  
   47      $log = DB::table('webhook_logs')->where('sku', $product->sku)->first();
   48  

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php  {"proposed_by_reader": true, "reader_reason": "sendCreatedToWebhook/sendDataToWebhook -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:122-128
  122  
  123      activeMeasurementWebhook();
  124  
  125      app(WebhookService::class)->sendCreatedToWebhook($product->fresh(), $changes);
  126  
  127      Http::assertSent(function ($request) use ($attribute, $family, $sku): bool {
  128          $body = json_decode($request->body(), true);

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchForBulkEdit -> sendBatch -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchForBulkEdit -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service -> deliver"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchByIds and SendBulkProductWebhook::handle -> deliver", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service/job -> deliver"}
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

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php  {"proposed_by_reader": true, "reader_reason": "BulkProductUpdate fires catalog.product.bulk.edit.after; listener dispatches SendBulkEditProductWebhook (queue is sync in phpunit.xml:137, nothing faked, active webhook) -> deliver"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:268-274
  268          }
  269  
  270          if ($productIds !== []) {
  271              Event::dispatch('catalog.product.bulk.edit.after', ['ids' => $productIds]);
  272          }
  273  
  274          $this->updateProgress($processed);
--- packages/Webkul/Webhook/src/Listeners/Product.php:87-93
   87              return;
   88          }
   89  
   90          dispatch(new SendBulkEditProductWebhook($ids, auth('admin')?->user()?->id))->onQueue('webhooks');
   91      }
   92  }
   93  

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php  {"proposed_by_reader": true, "reader_reason": "AiProvider::fetchModels (and platform routes) -> PlatformValidator / ssrfGuardedOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels + platform routes"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:29-35
   29  });
   30  
   31  it('returns an empty model list for Custom when no api_url is supplied', function () {
   32      expect(AiProvider::Custom->fetchModels('sk-test-key', null))->toBe([]);
   33      expect(AiProvider::Custom->fetchModels('sk-test-key', ''))->toBe([]);
   34  });
   35  

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels -> fetchAzureModels -> ssrfGuardedOptions -> httpOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchAzureModels -> ssrfGuardedOptions"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:28-34
   28          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o']]])),
   29      ], $reached);
   30  
   31      $models = AiProvider::Azure->fetchModels('azure-key', 'https://1.1.1.1', $client);
   32  
   33      expect($models)->toBe(['gpt-4o']);
   34      expect($reached)->toBe(['https://1.1.1.1/openai/v1/models?api-version=preview']);

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels with api url -> guarded options", "listed_by_oracle": true, "reader_on_oracle_file": "keep: guarded fetch with api url"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:58-64
   58          };
   59      });
   60  
   61      $provider->fetchModels('sk-test-key', $apiUrl, new Client(['handler' => $stack]));
   62  
   63      expect($reached[0])->toStartWith($expected);
   64  })->with([

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php  {"proposed_by_reader": true, "reader_reason": "discoverModels -> ssrfGuardedOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: discoverModels"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:29-35
   29          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o-mini']]])),
   30      ], $reached);
   31  
   32      $discovery = AiProvider::Custom->discoverModels('sk-test-key', 'https://1.1.1.1', $client);
   33  
   34      expect($discovery['models'])->toBe(['gpt-4o-mini']);
   35      expect($discovery['api_url'])->toBe('https://1.1.1.1/v1');

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels across providers", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:207-213
  207      $history = [];
  208      $client = matrixClient([new Response(200, [], json_encode($expected['body']))], $history);
  209  
  210      $models = $provider->fetchModels('platform-key', $expected['apiUrl'] ?? null, $client);
  211      $request = $history[0]['request'];
  212  
  213      expect($models)->toBe($expected['models'])

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels with proxy url / Ollama -> ssrfGuardedOptions", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels/discoverModels"}
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

* packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php  {"proposed_by_reader": true, "reader_reason": "POST admin.magic_ai.platform.test -> isSafeApiUrl -> SafeWebhookUrl::validate (it does NOT import the class; :11 is a comment)"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/PlatformExtrasSsrfTest.php:16-22
   16  
   17      Http::fake(['*' => Http::response(['choices' => [['message' => ['content' => 'OK']]]], 200)]);
   18  
   19      $this->postJson(route('admin.magic_ai.platform.test'), [
   20          'provider' => AiProvider::Custom->value,
   21          'api_key'  => 'sk-test-key-1234567890',
   22          'api_url'  => 'https://api.openai.com/v1',
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:217-223
  217              abort(403);
  218          }
  219  
  220          if (! $this->platformValidator()->isSafeApiUrl(request()->input('api_url'))) {
  221              return new JsonResponse([
  222                  'success' => false,
  223                  'message' => trans('admin::app.configuration.platform.message.test-fail'),
--- packages/Webkul/MagicAI/src/Validator/PlatformValidator.php:144-150
  144      {
  145          $apiUrl = trim((string) $apiUrl);
  146  
  147          return $apiUrl === '' || SafeWebhookUrl::validate($apiUrl)['valid'];
  148      }
  149  
  150      /**

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php  {"proposed_by_reader": true, "reader_reason": "permitted update case (assertOk :62) runs validateApiUrl -> isSafeApiUrl -> validate"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformAclBypassTest.php:53-59
   53  
   54          $this->loginWithPermissions('custom', ['ai-agent', 'ai-agent.platform', 'ai-agent.platform.edit']);
   55  
   56          $this->putJson(route('admin.magic_ai.platform.update', $platform->id), [
   57              'label'      => 'Updated',
   58              'provider'   => 'openai',
   59              'models'     => 'gpt-4o',
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:126-132
  126          $data = request()->only(['label', 'provider', 'api_url', 'models', 'is_default', 'status']);
  127  
  128          $this->validateModelNames($data['models']);
  129          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
  130  
  131          if (! isset($data['status'])) {
  132              $data['status'] = false;

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformDefaultValidationTest.php  {"proposed_by_reader": true, "reader_reason": "hits platform store/update route -> validateApiUrl"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformModelsSubmitTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update route"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSaveValidatesCredentialsTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update route"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update/test/fetch_models routes"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:324-330
  324              abort(403);
  325          }
  326  
  327          if (! $this->platformValidator()->isSafeApiUrl(request()->input('api_url'))) {
  328              return new JsonResponse([
  329                  'message' => trans('admin::app.configuration.platform.message.fetch-models-fail'),
  330              ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update routes"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformTildeModelTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update routes"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php  {"proposed_by_reader": true, "reader_reason": "PUT platform.update (id 99999; may 404 before validation - medium)"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/OrphanPlatformFallbackTest.php:112-118
  112  });
  113  
  114  it('returns clean 404 JSON when updating a deleted platform', function () {
  115      $response = $this->putJson(route('admin.magic_ai.platform.update', 99999), [
  116          'label'    => 'Ghost',
  117          'provider' => 'openai',
  118          'models'   => 'gpt-4o-mini',

* packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update routes"}
--- packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php:39-45
   39  it('never lets a request set the managed flag', function () {
   40      $this->loginWithPermissions('all');
   41  
   42      postJson(route('admin.magic_ai.platform.store'), managedPayload([
   43          'label'      => 'Client platform',
   44          'api_key'    => 'sk-client-own-key',
   45          'is_managed' => 1,

* packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php  {"proposed_by_reader": true, "reader_reason": "platform test/fetch_models routes"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:217-223
  217              abort(403);
  218          }
  219  
  220          if (! $this->platformValidator()->isSafeApiUrl(request()->input('api_url'))) {
  221              return new JsonResponse([
  222                  'success' => false,
  223                  'message' => trans('admin::app.configuration.platform.message.test-fail'),

* packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php  {"proposed_by_reader": true, "reader_reason": "platform store/update/fetch_models routes"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:63-69
   63          $data = $request->only(['label', 'provider', 'api_url', 'api_key', 'models', 'is_default', 'status']);
   64  
   65          $this->validateModelNames($data['models']);
   66          $this->platformValidator()->validateApiUrl($data['provider'] ?? null, $data['api_url'] ?? null);
   67  
   68          if (! isset($data['status'])) {
   69              $data['status'] = true;

* packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php  {"proposed_by_reader": true, "reader_reason": "artisan AddPlatform -> PlatformValidator apiUrlError/validate -> SafeWebhookUrl::validate (ModelDiscovery is mocked, the validator is not)"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php:51-57
   51  
   52      $previousDefault = MagicAIPlatform::factory()->default()->create();
   53  
   54      $command = answerConnection(artisan(WIZARD), 'Hosted AI', 'sk-hosted-key')
   55          ->expectsQuestion(wizardLabel('fields.models'), ['gpt-4o', 'gpt-4o-mini'])
   56          ->expectsQuestion(wizardLabel('command.models-additional'), '');
   57  
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:82-88
   82              label: trans('admin::app.configuration.platform.fields.api-url'),
   83              default: $sameProvider ? (string) $platform?->api_url : $provider->defaultUrl(),
   84              validate: fn (string $value): ?string => $this->fieldError('api_url', trim($value) ?: null)
   85                  ?? $this->platformValidator->apiUrlError($provider->value, $value),
   86              hint: trans('admin::app.configuration.platform.fields.api-url-hint'),
   87          ));
   88  
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:339-345
  339          }
  340  
  341          try {
  342              $payload = $this->platformValidator->validate($payload);
  343          } catch (ValidationException $e) {
  344              foreach ($e->validator->errors()->all() as $message) {
  345                  error($message);

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: double overrides execute() (:18), the only method that touches SafeWebhookUrl; chat() never reaches it"}
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: only non-faked call is SendBulkProductWebhook([])->handle (:112-114): empty id list, deliverChunked loops zero chunks, SafeWebhookUrl never runs; all other cases Queue::fake. Statically reachable, not exercised"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Queue::fake (:14); job never runs"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Queue::fake; only asserts pushes"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Queue::fake for both webhook jobs (:14)"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php  {"proposed_by_reader": false, "reader_excluded_because": "fakes the queue; asserts SendProductWebhook pushed"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Core/tests/Unit/HttpExceptionRenderingTest.php  {"proposed_by_reader": false, "reader_excluded_because": "builds a Request for the webhook URL path (:17), does not dispatch it"}
--- packages/Webkul/Core/tests/Unit/HttpExceptionRenderingTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/Admin/tests/Feature/Acl/MagicAi/MagicAiPlatformAclTest.php  {"proposed_by_reader": false, "reader_excluded_because": "references platform routes but not store/update/test/fetch_models by name in a way that passes authorization; not verified to reach the validator"}
--- packages/Webkul/Admin/tests/Feature/Acl/MagicAi/MagicAiPlatformAclTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/AiAgent/tests/Unit/EnrichmentLocaleAwarenessTest.php  {"proposed_by_reader": false, "reader_excluded_because": "reads an EnrichmentService constant via reflection only"}
--- packages/Webkul/AiAgent/tests/Unit/EnrichmentLocaleAwarenessTest.php: none of ['SafeWebhookUrl'] appears in the file

* packages/Webkul/AiAgent/tests/Unit/MagicAIPermissionTest.php  {"proposed_by_reader": false, "reader_excluded_because": "lists service class names only"}
--- packages/Webkul/AiAgent/tests/Unit/MagicAIPermissionTest.php: none of ['SafeWebhookUrl'] appears in the file


========== ITEM uo-c-tests-02 ==========
Question (registered, verbatim):
{
 "id": "uo-c-tests-02",
 "suite": "C",
 "class": "tests-for",
 "subject": "unopim",
 "language": "php",
 "question": "Which test files exercise WebhookService::sendBatchForBulkEdit, directly or through the job that calls it?",
 "probe": "sendBatchForBulkEdit",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:26 -- direct",
  "packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:31 -- calls it on a subclass (ChunkedWebhookService)",
  "packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:31 -- the job; tests that push it are hop 2"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["framework-invoked entry point(s) not followed: Webkul\\Webhook\\Jobs\\SendBulkEditProductWebhook::handle"]

Reader notes: answerable_as_registered=True; Two readings of 'through the job': (a) tests in which the job actually runs -> 3 files above; (b) corpus reading 'tests that push it are hop 2' -> add BulkEditWebhookQueuedTest, BulkEditWebhookNotDuplicatedTest, ProductBulkEditWebhookDedupeTest (6 files), though none of those executes sendBatchForBulkEdit.
Reader on the oracle's open list: SendBulkEditProductWebhook::handle is reached through catalog.product.bulk.edit.after (fired at BulkProductUpdate.php:271) -> Listeners/Product::afterBulkEdit (EventServiceProvider.php:32) -> dispatch(...) with sync queue in tests. Only BulkEditWebhookActingUserTest runs this path unfaked with an active webhook.

Candidate files (8):

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php  {"proposed_by_reader": true, "reader_reason": "direct call", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php  {"proposed_by_reader": true, "reader_reason": "direct call on subclass ChunkedWebhookService (inherits sendBatchForBulkEdit)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php  {"proposed_by_reader": true, "reader_reason": "runs BulkProductUpdate with an active product.updated webhook and no fakes; event -> listener -> SendBulkEditProductWebhook (sync queue) -> sendBatchForBulkEdit"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:268-274
  268          }
  269  
  270          if ($productIds !== []) {
  271              Event::dispatch('catalog.product.bulk.edit.after', ['ids' => $productIds]);
  272          }
  273  
  274          $this->updateProgress($processed);
--- packages/Webkul/Webhook/src/Listeners/Product.php:87-93
   87              return;
   88          }
   89  
   90          dispatch(new SendBulkEditProductWebhook($ids, auth('admin')?->user()?->id))->onQueue('webhooks');
   91      }
   92  }
   93  

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php  {"proposed_by_reader": false, "reader_excluded_because": "pushes the job via listener but Queue::fake (:14) - handle never runs. Counts only under the corpus's 'tests that push it' reading"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: none of ['sendBatchForBulkEdit'] appears in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Queue::fake; asserts SendBulkEditProductWebhook pushed (:61) but never runs it. Same reading caveat"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php: none of ['sendBatchForBulkEdit'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Queue::fake for SendBulkEditProductWebhook (:14); asserts pushed (:36). Same reading caveat"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditWebhookDedupeTest.php: none of ['sendBatchForBulkEdit'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php  {"proposed_by_reader": false, "reader_excluded_because": "Event::fake on catalog.product.bulk.edit.after (:88)"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductBulkEditTest.php: none of ['sendBatchForBulkEdit'] appears in the file

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php  {"proposed_by_reader": false, "reader_excluded_because": "runs BulkProductUpdate but creates no webhook; listener returns at hasActiveForEvent (Listeners/Product.php:86)"}
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php: none of ['sendBatchForBulkEdit'] appears in the file


========== ITEM uo-c-tests-03 ==========
Question (registered, verbatim):
{
 "id": "uo-c-tests-03",
 "suite": "C",
 "class": "tests-for",
 "subject": "unopim",
 "language": "php",
 "question": "Which test files exercise ProductRepository::isUniqueVariantForProduct, directly or through a caller?",
 "probe": "isUniqueVariantForProduct",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:160 -- direct",
  "packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:31 -- direct",
  "callers: packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1280,1585; AdminApi ProductController.php:487,589; ConfigurableProductController.php:216; DataTransfer Importer.php:3139"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 9 controller entry point(s)", "framework-invoked entry point(s) not followed: Webkul\\Product\\Type\\Configurable::update, Webkul\\DataTransfer\\Helpers\\Importers\\Product\\Importer::saveValidatedBatches, runBulkVariantLevelUpdate"]

Reader notes: answerable_as_registered=True; Core (direct + one hop, high confidence): ProductRepositoryTest, ProductRepositoryVariantUniquenessTest, ProductRepositoryGuardVariantLevelWriteTest, AbstractTypeVariantGuardTest, ProductCheckVariantUniquenessTest, ProductVariantCombinationExistsTest, ProductTest, ApiVariantGroupProductTest. Deeper transitive tests (hop 3-4) are included because 'through a caller' is unbounded in the wording; drop them if the benchmark caps at the registered hop stratum 2. The oracle misses ProductRepositoryTest (a direct caller) and all route-hop tests.
Reader on the oracle's open list: Route hops: ProductController::update (products.update) and checkVariantUniqueness (catalog-routes.php:226); AdminApi storeVariantGroup via configurable_products.store; createVariantUnderGroup / validateVariantConfiguration via SimpleProductController::store -> createOrUpdateVariant. Framework entry points: Configurable::update and AbstractType::update call guardVariantLevelWrite (Configurable.php:304,:450; AbstractType.php:199); Importer::saveValidatedBatches is not on the path - the call sits in validateRow (:1303). 'runBulkVariantLevelUpdate' is the helper inside BulkProductUpdateVariantLevelTest.

Candidate files (16):

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php  {"proposed_by_reader": true, "reader_reason": "direct (describe block :160); repository bound in beforeEach (:14), untyped property, which is likely why the oracle missed it"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:161-167
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
  164          $result = $this->productRepository->isUniqueVariantForProduct(
  165              $parent->id,
  166              ['color' => 'red']
  167          );

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php  {"proposed_by_reader": true, "reader_reason": "direct", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:28-34
   28  
   29      $repository = app(ProductRepository::class);
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls guardVariantLevelWrite, which calls isUniqueVariantForProduct on an axis rename", "listed_by_oracle": true, "reader_on_oracle_file": "keep: guardVariantLevelWrite"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:105-111
  105  
  106      $repository = app(ProductRepository::class);
  107  
  108      expect(fn () => $repository->guardVariantLevelWrite($red->fresh(), [$colorCode => 'pink']))
  109          ->toThrow(ValidationException::class);
  110  });
  111  
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:298-304
  298          DB::transaction(function () use ($product, $newTuple, $onGuarded): void {
  299              $this->getModel()::query()->whereKey($product->parent_id)->lockForUpdate()->exists();
  300  
  301              if (! $this->isUniqueVariantForProduct($product->parent_id, $newTuple, null, $product->id, $product->type)) {
  302                  throw ValidationException::withMessages([
  303                      'axis' => [trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($newTuple)])],
  304                  ]);

* packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: guardVariantLevelWrite"}
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:106-112
  106          'variant_structure_id' => $structure->id,
  107      ]);
  108  
  109      expect(fn () => $repository->guardVariantLevelWrite($configurable->fresh(), [$color->code => 'red']))
  110          ->toThrow(ValidationException::class);
  111  
  112      $repository->update([

* packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php  {"proposed_by_reader": true, "reader_reason": "route admin.catalog.products.check-variant -> checkVariantUniqueness -> isUniqueVariantForProduct"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php:41-47
   41  
   42  function postVariantUniquenessCheck($test, array $payload)
   43  {
   44      return $test->postJson(route('admin.catalog.products.check-variant'), $payload);
   45  }
   46  
   47  it('rejects a variant attribute key that is not an axis of the parent and never compiles it into a json path', function () {
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1582-1588
 1582      {
 1583          $data = $request->validated();
 1584  
 1585          $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1586              $data['parentId'],
 1587              $data['variantAttributes'],
 1588              $data['sku'] ?? null,

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php  {"proposed_by_reader": true, "reader_reason": "PUT products.update on a child with axis values; asserts the combination-exists message produced by the uniqueness branch"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php:75-81
   75  
   76  function putCommonValuesForCombinationTest($test, Product $product, array $commonValues)
   77  {
   78      return $test->put(route('admin.catalog.products.update', $product->id), [
   79          'sku'    => $product->sku,
   80          'values' => [
   81              'common' => array_merge(['sku' => $product->sku], $commonValues),
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1277-1283
 1277          $configurableValues = $this->ownLevelAxisValues($product, $data['values']['common'] ?? []);
 1278  
 1279          if (! empty($configurableValues) && $product->parent_id) {
 1280              $isUnique = $this->productRepository->isUniqueVariantForProduct(
 1281                  productId: $product->parent_id,
 1282                  configAttributes: $configurableValues,
 1283                  variantId: $id

* packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php  {"proposed_by_reader": true, "reader_reason": "PUT products.update asserting variant-combination-exists -> ProductController::update:1280"}
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

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php  {"proposed_by_reader": true, "reader_reason": "POST configurable_products.store with parent -> storeVariantGroup -> isUniqueVariantForProduct"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php:207-213
  207          'variant_structure_id' => $structure->id,
  208      ]);
  209  
  210      $this->withHeaders($this->headers)->json('POST', route('admin.api.configurable_products.store'), [
  211          'type'   => ProductType::VariantGroup->value,
  212          'parent' => $configurable->sku,
  213          'values' => ['common' => ['sku' => 'vgp-group', $color->code => $color->options->first()->code]],
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:213-219
  213          $node = DB::transaction(function () use ($parent, $sku, $axisTuple, $common) {
  214              $this->productRepository->getModel()::query()->whereKey($parent->id)->lockForUpdate()->first();
  215  
  216              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($parent->id, $axisTuple, null, '', ProductType::VariantGroup->value)) {
  217                  return null;
  218              }
  219  

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php  {"proposed_by_reader": true, "reader_reason": "transitive (hop 3): BulkProductUpdate::persistProduct -> guardVariantLevelWrite -> isUniqueVariantForProduct on variant-level axis writes", "listed_by_oracle": true, "reader_on_oracle_file": "keep: BulkProductUpdate -> guardVariantLevelWrite"}
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php:136-142
  136  
  137  function runBulkVariantLevelUpdate(array $payload): JobTrack
  138  {
  139      (new BulkProductUpdate($payload, auth()->guard('admin')->id()))->handle();
  140  
  141      return JobTrack::latest('id')->first();
  142  }
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:305-311
  305          }
  306  
  307          try {
  308              $this->productRepository->guardVariantLevelWrite(
  309                  $product,
  310                  $submittedCommon,
  311                  $persist,

* packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php  {"proposed_by_reader": true, "reader_reason": "transitive (hop 4): Importer::validateRow -> isUniqueVariation -> validateVariantUniqueness -> isUniqueVariantForProduct (only for simple rows with a parent)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: Importer::validateRow chain (transitive, hop 4)"}
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php:322-328
  322      $importer->setImport($jobTrack);
  323      $importer->setErrorHelper($errorHelper = app(Error::class));
  324  
  325      expect($importer->validateRow($row, 1))->toBeTrue(json_encode($errorHelper->getAllErrors()));
  326  
  327      $importer->importBatch(JobTrackBatch::factory()->create(['data' => [$row], 'job_track_id' => $jobTrack->id]));
  328  
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:1300-1306
 1300              }
 1301          }
 1302  
 1303          $this->isUniqueVariation($rowData, $rowNumber);
 1304  
 1305          return ! $this->errorHelper->isRowInvalid($rowNumber);
 1306      }
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3136-3142
 3136  
 3137          $this->cachedVariantValues[$parentProduct->sku][$productData['sku']] = $variantConfigValues;
 3138  
 3139          $isUnique = $this->productRepository->isUniqueVariantForProduct($parentProduct->id, $variantConfigValues, $productData['sku'], $variationId);
 3140  
 3141          if (! $isUnique) {
 3142              $this->skipRow($rowNumber, self::ERROR_NOT_UNIQUE_VARIANT, 'sku', trans($this->messages[self::ERROR_NOT_UNIQUE_VARIANT]));

* packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php  {"proposed_by_reader": true, "reader_reason": "transitive (hop 4): product Importer::validateRow, same chain", "listed_by_oracle": true, "reader_on_oracle_file": "keep: Importer::validateRow chain"}
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php:183-189
  183          $importer->setImport($jobTrack);
  184          $importer->setErrorHelper(app(Error::class));
  185  
  186          expect($importer->validateRow($row, 1))->toBeTrue();
  187  
  188          $batch = JobTrackBatch::factory()->create([
  189              'data'         => [$row],

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php  {"proposed_by_reader": true, "reader_reason": "transitive: runs BulkProductUpdate -> persistProduct -> guardVariantLevelWrite (the product has no parent, so the uniqueness query short-circuits at ProductRepository.php:285; statically reachable)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: statically via BulkProductUpdate; at runtime the product has no parent so the uniqueness check is skipped - keep only under a static reading"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/DataTransfer/tests/Feature/ProductAssociationImportTest.php  {"proposed_by_reader": false, "reader_excluded_because": "uses ProductAssociation\\Importer, not the product importer"}
--- packages/Webkul/DataTransfer/tests/Feature/ProductAssociationImportTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php  {"proposed_by_reader": false, "reader_excluded_because": "PUT configurable_products.update (:189) -> updateProduct/setVaraints; does not hit createVariantUnderGroup/validateVariantConfiguration/storeVariantGroup (not verified line-by-line)"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantStructureReferenceTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php  {"proposed_by_reader": false, "reader_excluded_because": "matched a 'combination' grep but asserts webhook pushes; variant creation path not shown to reach the uniqueness check"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantNodeCreateTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* (every other test that PUTs admin.catalog.products.update or saves a product through AbstractType::update)  {"proposed_by_reader": false, "reader_excluded_because": "statically reaches guardVariantLevelWrite / ProductController::update, but the uniqueness call only runs for a child product with own-level axis values; not enumerated"}
--- (every other test that PUTs admin.catalog.products.update or saves a product through AbstractType::update): FILE NOT FOUND at the pin


========== ITEM uo-d-01 ==========
Question (registered, verbatim):
{
 "id": "uo-d-01",
 "suite": "D",
 "class": "negative-control",
 "shape": "path",
 "subject": "unopim",
 "language": "php",
 "question": "Is there an accepted path from the PruneWebhookLogs console command to WebhookService::deliver?",
 "probe": "PruneWebhookLogs",
 "probe_to": "deliver",
 "probe_to_declared_in": "packages/Webkul/Webhook/src/Services/WebhookService.php:187",
 "threat_row": "threats.csv:24 SSRF via user-supplied URL",
 "hop_stratum": ">=3",
 "expected": "empty",
 "reason": "packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php imports only the console attributes, Command and the DB facade (:5-8) and has one method, handle() (:14). The outbound HTTP call sits in WebhookService::deliver (:187, :205)."
}

Reference engine (oracle) status: confirms-empty; its open list: ["engine-only: route, queue and event dispatch hops are not followed"]

Reader notes: answerable_as_registered=True; Negative control confirmed empty.
Reader on the oracle's open list: No route, queue or event hop exists: the command fires no event (raw DB deletes on webhook_logs fire no model events) and dispatches no job.

Candidate files (2):

* packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php  {"proposed_by_reader": false, "reader_excluded_because": "imports only Description, Signature, Command and DB (:5-8); handle() (:14) only deletes from webhook_logs and prints; no service, event, job or HTTP call"}
--- packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php:7-13
    7  use Illuminate\Console\Command;
    8  use Illuminate\Support\Facades\DB;
    9  
   10  #[Description('Delete webhook delivery logs older than the configured retention window')]
   11  #[Signature('webhook:logs:prune {--days= : Override the configured retention window}')]
   12  class PruneWebhookLogs extends Command
   13  {
--- packages/Webkul/Webhook/src/Console/Commands/PruneWebhookLogs.php:9-15
    9  
   10  #[Description('Delete webhook delivery logs older than the configured retention window')]
   11  #[Signature('webhook:logs:prune {--days= : Override the configured retention window}')]
   12  class PruneWebhookLogs extends Command
   13  {
   14      public function handle(): int
   15      {

* packages/Webkul/Webhook/src/Providers/WebhookServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "schedules webhook:logs:prune daily (:33); scheduling is not a path to deliver"}
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


========== ITEM uo-d-02 ==========
Question (registered, verbatim):
{
 "id": "uo-d-02",
 "suite": "D",
 "class": "negative-control",
 "shape": "path",
 "subject": "unopim",
 "language": "php",
 "question": "Is there an accepted path from ProductGridViewController to WebhookService::deliver?",
 "probe": "ProductGridViewController",
 "probe_to": "deliver",
 "probe_to_declared_in": "packages/Webkul/Webhook/src/Services/WebhookService.php:187",
 "threat_row": "threats.csv:24 SSRF via user-supplied URL",
 "hop_stratum": ">=3",
 "expected": "empty",
 "reason": "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductGridViewController.php uses only ProductGridViewRepository (:8, :25, :42, :69). Webhook delivery is driven by the catalog.product.* and data_transfer.* events bound in packages/Webkul/Webhook/src/Providers/EventServiceProvider.php:28-38; saving a grid view fires none of them."
}

Reference engine (oracle) status: confirms-empty; its open list: ["engine-only: route, queue and event dispatch hops are not followed"]

Reader notes: answerable_as_registered=True; Negative control confirmed empty.
Reader on the oracle's open list: Checked for event dispatch in the controller and repository: none. ProductGridView model has no webhook-related observer (registered only as a module model in Product ModuleServiceProvider.php:28).

Candidate files (3):

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductGridViewController.php  {"proposed_by_reader": false, "reader_excluded_because": "only depends on ProductGridViewRepository (:8,:12) and ProductGridViewForm; visibleTo/updateOrCreate/find/delete"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductGridViewController.php:7-13
    7  use Webkul\Admin\Http\Requests\ProductGridViewForm;
    8  use Webkul\Product\Repositories\ProductGridViewRepository;
    9  
   10  class ProductGridViewController extends Controller
   11  {
   12      public function __construct(protected ProductGridViewRepository $productGridViewRepository) {}
   13  

* packages/Webkul/Product/src/Repositories/ProductGridViewRepository.php  {"proposed_by_reader": false, "reader_excluded_because": "plain repository (extends Repository, :9); no Event::dispatch"}
--- packages/Webkul/Product/src/Repositories/ProductGridViewRepository.php: none of ['ProductGridViewController', 'deliver'] appears in the file

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "webhook listeners bound only to catalog.product.* and data_transfer.imports.* events (:28-36); grid-view saves fire none"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: none of ['ProductGridViewController', 'deliver'] appears in the file


========== ITEM uo-d-03 ==========
Question (registered, verbatim):
{
 "id": "uo-d-03",
 "suite": "D",
 "class": "negative-control",
 "shape": "symbol",
 "subject": "unopim",
 "language": "php",
 "question": "Which files call sendBatchBySku?",
 "probe": "sendBatchBySku",
 "hop_stratum": 1,
 "expected": "empty",
 "reason": "Near-miss of sendBatchBySkus (packages/Webkul/Webhook/src/Services/WebhookService.php:72). Verified absent from the whole clone with a word-boundary search at construction time."
}

Reference engine (oracle) status: confirms-empty; its open list: ["no declaration of the probe exists at the pin"]

Reader notes: answerable_as_registered=True; Negative control confirmed empty.
Reader on the oracle's open list: n/a. Side finding: sendBatchBySkus itself has no caller at the pin either.

Candidate files (1):

* packages/Webkul/Webhook/src/Services/WebhookService.php  {"proposed_by_reader": false, "reader_excluded_because": "declares sendBatchBySkus (:72), the near-miss; a word-boundary search for sendBatchBySku over the whole tree (excluding vendor/node_modules/storage) returns nothing"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:69-75
   69      /**
   70       * Send a batch of products to every subscribed webhook by their SKUs.
   71       */
   72      public function sendBatchBySkus(array $skus): ?Response
   73      {
   74          return $this->deliverChunked('sku', $skus);
   75      }


========== ITEM uo-e-01 ==========
Question (registered, verbatim):
{
 "id": "uo-e-01",
 "suite": "E",
 "class": "change-impact",
 "subject": "unopim",
 "language": "php",
 "question": "If SafeWebhookUrl::httpOptions changes its contract, which files must be re-read (full closure, across packages)?",
 "probe": "httpOptions",
 "declared_in": "packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php:93",
 "hop_stratum": ">=3",
 "basis": [
  "hop 1: WebhookController.php:154, WebhookService.php:205, MagicAI AiProvider.php:422, AiAgent AiApiClient.php:131",
  "hop 2+: the jobs, listeners and controllers that reach those, across the Webhook, MagicAI and AiAgent packages"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["depth cap 6 reached", "route hops not followed from 4 controller entry point(s)", "framework-invoked entry point(s) not followed: Webkul\\AiAgent\\Pipelines\\Stages\\CallAiProviderStage::handle, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\EnrichmentStep::handle, Webkul\\AiAgent\\Chat\\Tools\\GenerateContent::register, Webkul\\AiAgent\\Chat\\Tools\\AnalyzeImage::register, Webkul\\AiAgent\\Pipelines\\Stages\\Image\\VisionDetectionStep::handle, Webkul\\AiAgent\\Services\\VisionService::analyzeContext, Webkul\\Webhook\\Jobs\\SendProductWebhook::handle, Webkul\\Webhook\\Services\\WebhookService::sendBatchBySkus, Webkul\\AiAgent\\Jobs\\AutoEnrichProductJob::handle, Webkul\\Webhook\\Jobs\\SendBulkEditProductWebhook::handle"]

Reader notes: answerable_as_registered=True; Full static closure with queue, pipeline and route hops followed, stopping at event fan-in. The 'must be re-read' set in the strictest sense (code that depends on the returned array shape) is only the 6 direct callers plus the two tests asserting on the options: WebhookController, WebhookService, AiProvider, AiApiClient, SafeWebhookUrlTest, FetchModelsSsrfTest. Additions over the oracle: Listeners/Product, ProductEventListener, AgentPipeline, AgentService, ExecutionController, ExecuteAgentJob, BatchAgentJob, BaseAgent, ImageProductAgent, BulkProductEnricherAgent, the three Examples, AddPlatform, EditPlatform, BulkEditWebhookActingUserTest, four fetch_models route tests.
Reader on the oracle's open list: Followed: queue hops (Listeners/Product -> 3 webhook jobs; ProductEventListener -> AutoEnrichProductJob), pipeline hop (AgentService -> AgentPipeline -> CallAiProviderStage::handle), agent contract binding (AgentServiceContract -> AgentService), routes (ExecutionController execute route, GenerateController, MagicAIPlatformController fetch_models, webhook.test), trait use (CollectsPlatform in AddPlatform/EditPlatform), chat tools registered in Config/ai-agent.php:38,41. EnrichmentStep and VisionDetectionStep are not referenced by any pipeline list at the pin (dead-ish but still callers). CredentialController has no route. Not enumerated: route tests for ai-agent execute/generate/chat endpoints (most are ACL tests).

Candidate files (65):

* packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php  {"proposed_by_reader": true, "reader_reason": "hop 1", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Webhook/src/Http/Controllers/WebhookController.php:151-157
  151          }
  152  
  153          try {
  154              $response = Http::withOptions(SafeWebhookUrl::httpOptions($url))
  155                  ->timeout(self::TEST_REQUEST_TIMEOUT)
  156                  ->post($url, [
  157                      'event'     => 'webhook.test',

* packages/Webkul/Webhook/src/Services/WebhookService.php  {"proposed_by_reader": true, "reader_reason": "hop 1", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:202-208
  202          $exception = null;
  203  
  204          try {
  205              $response = Http::withOptions(SafeWebhookUrl::httpOptions($webhook->url))
  206                  ->withHeaders($this->buildHeaders($webhook, $event, $body))
  207                  ->withBody($body, 'application/json')
  208                  ->post($webhook->url);

* packages/Webkul/MagicAI/src/Enums/AiProvider.php  {"proposed_by_reader": true, "reader_reason": "hop 1", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/MagicAI/src/Enums/AiProvider.php:419-425
  419       */
  420      private function ssrfGuardedOptions(string $url, array $options = []): array
  421      {
  422          return array_merge($options, SafeWebhookUrl::httpOptions($url));
  423      }
  424  
  425      private function fetchAnthropicModels(Client $client, ?string $apiKey, ?string $apiUrl = null): array

* packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php  {"proposed_by_reader": true, "reader_reason": "hop 1; :133 asserts the CURLOPT_RESOLVE key of the returned array, so it depends on the return shape", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/AiAgent/src/Http/Client/AiApiClient.php:128-134
  128      protected function execute(string $method, string $url, ?array $data = null): array
  129      {
  130          // Pin the connection to the validated IP and block redirects to prevent SSRF TOCTOU rebinding.
  131          $safeOptions = SafeWebhookUrl::httpOptions($url);
  132  
  133          throw_unless(
  134              isset($safeOptions['curl'][CURLOPT_RESOLVE]),

* packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php  {"proposed_by_reader": true, "reader_reason": "asserts on the returned options", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Webhook/tests/Unit/SafeWebhookUrlTest.php:13-19
   13  });
   14  
   15  it('pins the resolved IP in httpOptions to close DNS-rebinding TOCTOU', function () {
   16      $options = SafeWebhookUrl::httpOptions('https://1.1.1.1/inbound');
   17  
   18      expect($options['allow_redirects'])->toBeFalse();
   19      expect($options['curl'][CURLOPT_RESOLVE])->toBe(['1.1.1.1:443:1.1.1.1']);

* packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php  {"proposed_by_reader": true, "reader_reason": "asserts on the returned options", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/FetchModelsSsrfTest.php:47-53
   47  
   48      $response = $client->get(
   49          'https://1.1.1.1/models',
   50          SafeWebhookUrl::httpOptions('https://1.1.1.1/models')
   51      );
   52  
   53      expect($response->getStatusCode())->toBe(302);

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php  {"proposed_by_reader": true, "reader_reason": "WebhookService publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php:41-47
   41          }
   42  
   43          match ($this->eventType) {
   44              'created' => $webhookService->sendCreatedToWebhook($product, $this->changes),
   45              'updated' => $webhookService->sendDataToWebhook($product, $this->changes),
   46              default   => null,
   47          };

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php  {"proposed_by_reader": true, "reader_reason": "WebhookService publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php:33-39
   33          }
   34  
   35          if ($this->event === WebhookService::EVENT_PRODUCT_CREATED) {
   36              $webhookService->sendBatchCreatedByIds($this->ids);
   37  
   38              return;
   39          }

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php  {"proposed_by_reader": true, "reader_reason": "sendBatchForBulkEdit", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php:28-34
   28              Auth::login($user);
   29          }
   30  
   31          $webhookService->sendBatchForBulkEdit($this->ids);
   32      }
   33  }
   34  

* packages/Webkul/Webhook/src/Listeners/Product.php  {"proposed_by_reader": true, "reader_reason": "queue hop: dispatches the three jobs"}
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

* packages/Webkul/MagicAI/src/Services/ModelDiscovery.php  {"proposed_by_reader": true, "reader_reason": "discoverModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: discoverModels"}
--- packages/Webkul/MagicAI/src/Services/ModelDiscovery.php:16-22
   16       */
   17      public function discover(AiProvider $provider, ?string $apiKey, ?string $apiUrl): array
   18      {
   19          return $provider->discoverModels($apiKey, $apiUrl);
   20      }
   21  }
   22  

* packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php  {"proposed_by_reader": true, "reader_reason": "ModelDiscovery::discover", "listed_by_oracle": true, "reader_on_oracle_file": "keep: ModelDiscovery"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php  {"proposed_by_reader": true, "reader_reason": "ModelDiscovery::discover", "listed_by_oracle": true, "reader_on_oracle_file": "keep: ModelDiscovery"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/Concerns/CollectsPlatform.php:196-202
  196      {
  197          try {
  198              $models = spin(
  199                  fn (): array => resolve(ModelDiscovery::class)->discover($provider, $apiKey, $apiUrl ?: null)['models'],
  200                  trans('admin::app.configuration.platform.command.fetching-models', ['provider' => $provider->label()]),
  201              );
  202          } catch (\Throwable $e) {

* packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php  {"proposed_by_reader": true, "reader_reason": "uses CollectsPlatform; perform -> collectAndSave -> askModels -> fetchModels"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/AddPlatform.php:20-26
   20  #[Description('Add a Magic AI platform, optionally managed, storing its API key encrypted in the database')]
   21  class AddPlatform extends PlatformCommand
   22  {
   23      use CollectsPlatform;
   24  
   25      protected function perform(): int
   26      {

* packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php  {"proposed_by_reader": true, "reader_reason": "uses CollectsPlatform"}
--- packages/Webkul/MagicAI/src/Console/Commands/Platform/EditPlatform.php:25-31
   25  #[Description('Edit a Magic AI platform; an empty key keeps the stored one')]
   26  class EditPlatform extends PlatformCommand
   27  {
   28      use ChoosesPlatform, CollectsPlatform;
   29  
   30      protected function perform(): int
   31      {

* packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php  {"proposed_by_reader": true, "reader_reason": "chat", "listed_by_oracle": true, "reader_on_oracle_file": "keep: chat"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/CallAiProviderStage.php:31-37
   31  
   32          $this->apiClient->configure($config);
   33  
   34          $response = $this->apiClient->chat(
   35              messages: $payload->messages,
   36              maxTokens: $payload->metadata['maxTokens'] ?? 4096,
   37              temperature: $payload->metadata['temperature'] ?? 0.7,

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php  {"proposed_by_reader": true, "reader_reason": "chat (class is not referenced by any pipeline list at the pin)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: chat"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/EnrichmentStep.php:105-111
  105          $locale = $payload->context['enrichLocale'] ?? 'en_US';
  106          $messages = $this->buildMessages($mapped, array_values($missingTargets), $locale);
  107  
  108          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
  109          $generated = $this->parseGenerated($response['content'] ?? '');
  110  
  111          // Merge: existing mapped values take priority; generated fills gaps

* packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php  {"proposed_by_reader": true, "reader_reason": "VisionService::analyze (unreferenced stage)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: VisionService"}
--- packages/Webkul/AiAgent/src/Pipelines/Stages/Image/VisionDetectionStep.php:59-65
   59              unset($options['systemPrompt']);
   60          }
   61  
   62          $visionCtx = $this->visionService->analyze(
   63              imageContent: $imageContent,
   64              credentialId: $payload->credentialId,
   65              options: $options,

* packages/Webkul/AiAgent/src/Services/VisionService.php  {"proposed_by_reader": true, "reader_reason": "chat", "listed_by_oracle": true, "reader_on_oracle_file": "keep: chat"}
--- packages/Webkul/AiAgent/src/Services/VisionService.php:129-135
  129          $messages = $this->buildVisionMessages($provider, $imageContent, $systemPrompt, $locale);
  130  
  131          $rawResponse = $this->callWithRetry(
  132              fn (): array => $this->apiClient->chat($messages, $maxTokens, $temperature),
  133              $maxAttempts,
  134              $baseDelayMs,
  135              $capDelayMs,

* packages/Webkul/AiAgent/src/Services/EnrichmentService.php  {"proposed_by_reader": true, "reader_reason": "chat", "listed_by_oracle": true, "reader_on_oracle_file": "keep: chat"}
--- packages/Webkul/AiAgent/src/Services/EnrichmentService.php:79-85
   79  
   80          $messages = $this->buildMessages($existing, array_values($missing), $locale, $instruction, $ctx, $common);
   81  
   82          $response = $this->apiClient->chat(messages: $messages, maxTokens: 2048, temperature: 0.6);
   83          $generated = $this->parseResponse($response['content'] ?? '');
   84  
   85          // Score: AI-generated fields get medium confidence

* packages/Webkul/AiAgent/src/Services/ImageToProductService.php  {"proposed_by_reader": true, "reader_reason": "VisionService/EnrichmentService", "listed_by_oracle": true, "reader_on_oracle_file": "keep: services"}
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

* packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php  {"proposed_by_reader": true, "reader_reason": "ImageToProductService::execute", "listed_by_oracle": true, "reader_on_oracle_file": "keep: ImageToProductService"}
--- packages/Webkul/AiAgent/src/Http/Controllers/GenerateController.php:39-45
   39          $firstImage = $images[0];
   40  
   41          try {
   42              $ctx = $this->imageToProductService->execute(
   43                  image: $firstImage,
   44                  credentialId: (int) $validated['credential_id'],
   45                  options: [

* packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php  {"proposed_by_reader": true, "reader_reason": "testConnection (controller has no route at the pin)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: testConnection"}
--- packages/Webkul/AiAgent/src/Http/Controllers/CredentialController.php:141-147
  141          $config = CredentialConfig::fromModel($data);
  142  
  143          $this->apiClient->configure($config);
  144          $result = $this->apiClient->testConnection();
  145  
  146          return new JsonResponse([
  147              'success' => $result['success'],

* packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php  {"proposed_by_reader": true, "reader_reason": "VisionService::analyze", "listed_by_oracle": true, "reader_on_oracle_file": "keep: VisionService"}
--- packages/Webkul/AiAgent/src/Chat/Tools/AnalyzeImage.php:81-87
   81                          model: $this->context->model,
   82                      ));
   83  
   84                      $ctx = $this->visionService->analyze(
   85                          imageContent: $dataUri,
   86                          credentialId: 0,
   87                          apiClient: $apiClient,

* packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php  {"proposed_by_reader": true, "reader_reason": "EnrichmentService::enrich", "listed_by_oracle": true, "reader_on_oracle_file": "keep: EnrichmentService"}
--- packages/Webkul/AiAgent/src/Chat/Tools/GenerateContent.php:93-99
   93                          model: $this->context->model,
   94                      ));
   95  
   96                      $enriched = $this->enrichmentService->enrich(
   97                          ctx: $ctx,
   98                          credentialId: 0,
   99                          apiClient: $apiClient,

* packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php  {"proposed_by_reader": true, "reader_reason": "EnrichmentService::enrich", "listed_by_oracle": true, "reader_on_oracle_file": "keep: EnrichmentService"}
--- packages/Webkul/AiAgent/src/Jobs/AutoEnrichProductJob.php:108-114
  108                  category: $values['categories'][0] ?? null,
  109              );
  110  
  111              $enriched = $enrichmentService->enrich(
  112                  ctx: $ctx,
  113                  credentialId: 0,
  114                  apiClient: $apiClient,

* packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php  {"proposed_by_reader": true, "reader_reason": "queue hop: dispatches AutoEnrichProductJob"}
--- packages/Webkul/AiAgent/src/Listeners/ProductEventListener.php:20-26
   20              return;
   21          }
   22  
   23          dispatch(new AutoEnrichProductJob(productId: $product->id, locale: core()->getRequestedLocaleCode(), channel: core()->getRequestedChannelCode()))->delay(now()->addSeconds(5)); // Small delay to ensure product is 
   24      }
   25  
   26      /**

* packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php  {"proposed_by_reader": true, "reader_reason": "pipeline invokes stage handle() (via('handle'))"}
--- packages/Webkul/AiAgent/src/Pipelines/AgentPipeline.php:39-45
   39          return resolve(Pipeline::class)
   40              ->send($payload)
   41              ->through($this->stages)
   42              ->via('handle')
   43              ->thenReturn();
   44      }
   45  }

* packages/Webkul/AiAgent/src/Services/AgentService.php  {"proposed_by_reader": true, "reader_reason": "default stages include CallAiProviderStage"}
--- packages/Webkul/AiAgent/src/Services/AgentService.php:117-123
  117          return [
  118              ValidateInputStage::class,
  119              BuildPromptStage::class,
  120              CallAiProviderStage::class,
  121              ParseResponseStage::class,
  122              LogExecutionStage::class,
  123          ];

* packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php  {"proposed_by_reader": true, "reader_reason": "AgentService::execute (routed, ai-agent-routes.php:53)"}
--- packages/Webkul/AiAgent/src/Http/Controllers/ExecutionController.php:36-42
   36              ]);
   37          }
   38  
   39          $result = $this->agentService->execute($payload);
   40  
   41          return new JsonResponse($result->toArray());
   42      }

* packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php  {"proposed_by_reader": true, "reader_reason": "AgentService::execute"}
--- packages/Webkul/AiAgent/src/Jobs/ExecuteAgentJob.php:50-56
   50      {
   51          $payload = AgentPayload::fromArray($this->payloadData);
   52  
   53          $agentService->execute($payload);
   54      }
   55  
   56      /**

* packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php  {"proposed_by_reader": true, "reader_reason": "AgentService::execute"}
--- packages/Webkul/AiAgent/src/Jobs/BatchAgentJob.php:35-41
   35          foreach ($this->payloads as $payloadData) {
   36              try {
   37                  $payload = AgentPayload::fromArray($payloadData);
   38                  $agentService->execute($payload);
   39              } catch (\Throwable $e) {
   40                  Log::error('BatchAgentJob item failed', [
   41                      'agentId' => $payloadData['agentId'] ?? null,

* packages/Webkul/AiAgent/src/Agents/BaseAgent.php  {"proposed_by_reader": true, "reader_reason": "agentService->execute (contract bound to AgentService)"}
--- packages/Webkul/AiAgent/src/Agents/BaseAgent.php:58-64
   58              context: $context,
   59          );
   60  
   61          return $this->agentService->execute($payload);
   62      }
   63  
   64      /**

* packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php  {"proposed_by_reader": true, "reader_reason": "agentService->execute"}
--- packages/Webkul/AiAgent/src/Agents/ImageProductAgent.php:71-77
   71              context: $context,
   72          );
   73  
   74          return $this->agentService->execute($payload);
   75      }
   76  
   77      /**

* packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php  {"proposed_by_reader": true, "reader_reason": "BaseAgent::execute"}
--- packages/Webkul/AiAgent/src/Agents/BulkProductEnricherAgent.php:55-61
   55          int $credentialId,
   56          array $context = [],
   57      ): AgentResult {
   58          return $this->execute(
   59              input: [
   60                  'productCount' => count($products),
   61                  'products'     => $products,

* packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php  {"proposed_by_reader": true, "reader_reason": "agent->execute (example code, unrouted)"}
--- packages/Webkul/AiAgent/src/Examples/ExampleAgentController.php:89-95
   89          $agentId = (int) request('agentId');
   90          $credentialId = (int) request('credentialId');
   91  
   92          $result = $agent->execute(
   93              input: $input,
   94              agentId: $agentId,
   95              credentialId: $credentialId,

* packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php  {"proposed_by_reader": true, "reader_reason": "uses BulkProductEnricherAgent (example)"}
--- packages/Webkul/AiAgent/src/Examples/EnrichProductsBatchCommand.php:25-31
   25       * Execute the console command.
   26       */
   27      public function handle(
   28          BulkProductEnricherAgent $enricher,
   29          ProductRepository $productRepository,
   30      ): int {
   31          $limit = (int) $this->option('limit');

* packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php  {"proposed_by_reader": true, "reader_reason": "uses ImageProductAgent (example)"}
--- packages/Webkul/AiAgent/src/Examples/AnalyzeProductImageCommand.php:26-32
   26       * Execute the console command.
   27       */
   28      public function handle(
   29          ImageProductAgent $imageAgent,
   30          AgentRepository $agentRepository,
   31          CredentialRepository $credentialRepository,
   32      ): int {

* packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AiProviderCustomTest.php:29-35
   29  });
   30  
   31  it('returns an empty model list for Custom when no api_url is supplied', function () {
   32      expect(AiProvider::Custom->fetchModels('sk-test-key', null))->toBe([]);
   33      expect(AiProvider::Custom->fetchModels('sk-test-key', ''))->toBe([]);
   34  });
   35  

* packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/AzureModelDiscoveryTest.php:28-34
   28          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o']]])),
   29      ], $reached);
   30  
   31      $models = AiProvider::Azure->fetchModels('azure-key', 'https://1.1.1.1', $client);
   32  
   33      expect($models)->toBe(['gpt-4o']);
   34      expect($reached)->toBe(['https://1.1.1.1/openai/v1/models?api-version=preview']);

* packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/ConcentrateProviderTest.php:37-43
   37          };
   38      });
   39  
   40      $models = AiProvider::Concentrate->fetchModels('sk-test-key', null, new Client(['handler' => $stack]));
   41  
   42      expect($models)->toBe(['gpt-5.6-terra']);
   43      expect($reached)->toBe(['https://api.concentrate.ai/v1/models']);

* packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php  {"proposed_by_reader": true, "reader_reason": "discoverModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: discoverModels"}
--- packages/Webkul/Admin/tests/Feature/MagicAI/CustomModelDiscoveryTest.php:29-35
   29          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o-mini']]])),
   30      ], $reached);
   31  
   32      $discovery = AiProvider::Custom->discoverModels('sk-test-key', 'https://1.1.1.1', $client);
   33  
   34      expect($discovery['models'])->toBe(['gpt-4o-mini']);
   35      expect($discovery['api_url'])->toBe('https://1.1.1.1/v1');

* packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderMatrixTest.php:207-213
  207      $history = [];
  208      $client = matrixClient([new Response(200, [], json_encode($expected['body']))], $history);
  209  
  210      $models = $provider->fetchModels('platform-key', $expected['apiUrl'] ?? null, $client);
  211      $request = $history[0]['request'];
  212  
  213      expect($models)->toBe($expected['models'])

* packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php  {"proposed_by_reader": true, "reader_reason": "fetchModels/discoverModels", "listed_by_oracle": true, "reader_on_oracle_file": "keep: fetchModels"}
--- packages/Webkul/MagicAI/tests/Unit/AiProviderTest.php:60-66
   60          new Response(200, [], json_encode(['data' => [['id' => 'gpt-4o'], ['id' => 'dall-e-3']]])),
   61      ], $history);
   62  
   63      $models = AiProvider::OpenAI->fetchModels('sk-test', 'https://proxy.test/v1', $client);
   64  
   65      expect($models)->toBe(['dall-e-3', 'gpt-4o'])
   66          ->and((string) $history[0]['request']->getUri())->toBe('https://proxy.test/v1/models')

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php  {"proposed_by_reader": true, "reader_reason": "service publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookFanOutTest.php:35-41
   35  
   36      $product = Product::factory()->create();
   37  
   38      app(WebhookService::class)->sendCreatedToWebhook($product);
   39  
   40      Http::assertSent(fn ($request) => str_contains($request->url(), '1.1.1.1'));
   41      Http::assertSent(fn ($request) => str_contains($request->url(), '8.8.8.8'));

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php  {"proposed_by_reader": true, "reader_reason": "service publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookProductCreateTest.php:102-108
  102  
  103      Http::fake();
  104  
  105      $service->sendCreatedToWebhook($product);
  106  
  107      Http::assertSent(function ($request) use ($product) {
  108          $body = $request->data();

* packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php  {"proposed_by_reader": true, "reader_reason": "service publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Admin/tests/Feature/Webhook/WebhookStatusTest.php:42-48
   42  
   43      $product = Product::factory()->create();
   44  
   45      app(WebhookService::class)->sendDataToWebhook($product);
   46  
   47      $log = DB::table('webhook_logs')->where('sku', $product->sku)->first();
   48  

* packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php  {"proposed_by_reader": true, "reader_reason": "service publics", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Measurement/tests/Feature/Verify/ProductMeasurementWebhookTest.php:122-128
  122  
  123      activeMeasurementWebhook();
  124  
  125      app(WebhookService::class)->sendCreatedToWebhook($product->fresh(), $changes);
  126  
  127      Http::assertSent(function ($request) use ($attribute, $family, $sku): bool {
  128          $body = json_decode($request->body(), true);

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchForBulkEdit", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php:28-34
   28          ->map(fn (int $i): int => Product::factory()->simple()->create(['sku' => "CHUNK-{$i}"])->id)
   29          ->all();
   30  
   31      app(ChunkedWebhookService::class)->sendBatchForBulkEdit($ids);
   32  
   33      // 5 products / chunk size 2 => 3 chunks => 3 delivery requests to the webhook.
   34      Http::assertSentCount(3);

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchForBulkEdit", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php:23-29
   23      $first = Product::factory()->simple()->create(['sku' => 'BATCH-A']);
   24      $second = Product::factory()->simple()->create(['sku' => 'BATCH-B']);
   25  
   26      app(WebhookService::class)->sendBatchForBulkEdit([$first->id, $second->id]);
   27  
   28      $logs = WebhookLog::all();
   29  

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php  {"proposed_by_reader": true, "reader_reason": "sendBatchByIds / job handle", "listed_by_oracle": true, "reader_on_oracle_file": "keep: service"}
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php:35-41
   35  
   36      expect($product->audits()->count())->toBe(0);
   37  
   38      app(WebhookService::class)->sendBatchByIds([$product->id]);
   39  
   40      Http::assertSent(fn ($request) => ($request->data()['event'] ?? null) === WebhookService::EVENT_PRODUCT_UPDATED
   41          && collect($request->data()['data'] ?? [])->pluck('sku')->contains('IMPORT-UPD-1'));

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php  {"proposed_by_reader": true, "reader_reason": "job handle (static caller)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: static caller of job handle"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php:111-117
  111  
  112      $job = new SendBulkProductWebhook([], null, WebhookService::EVENT_PRODUCT_CREATED);
  113  
  114      $job->handle(app(WebhookService::class));
  115  })->throwsNoExceptions();
  116  
  117  it('queues only a created webhook when afterBulkCreate is called directly', function () {

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php  {"proposed_by_reader": true, "reader_reason": "event+sync-queue path to deliver"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php:33-39
   33  
   34      Auth::logout();
   35  
   36      (new BulkProductUpdate([$product->id => [$attribute->code => 'bulk-changed-value']], $admin->id))->handle();
   37  
   38      $log = WebhookLog::latest('id')->first();
   39  

* packages/Webkul/Admin/tests/Feature/MagicAI/MagicAIPlatformSecurityTest.php  {"proposed_by_reader": true, "reader_reason": "fetch_models route -> ModelDiscovery"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/MagicAI/tests/Feature/PlatformManagementTest.php  {"proposed_by_reader": true, "reader_reason": "fetch_models route"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/MagicAI/tests/Feature/PlatformConnectionTest.php  {"proposed_by_reader": true, "reader_reason": "fetch_models route"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/MagicAI/tests/Feature/ManagedPlatformTest.php  {"proposed_by_reader": true, "reader_reason": "fetch_models route"}
--- packages/Webkul/Admin/src/Http/Controllers/MagicAI/MagicAIPlatformController.php:348-354
  348  
  349          try {
  350              $provider = AiProvider::from(request()->input('provider'));
  351              $discovery = app(ModelDiscovery::class)->discover(
  352                  $provider,
  353                  $this->resolveApiKey(),
  354                  request()->input('api_url'),

* packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: its double replaces execute(); a change to httpOptions cannot affect it"}
--- packages/Webkul/AiAgent/tests/Unit/AiApiClientPromptCachingTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Validators/SafeWebhookUrl.php  {"proposed_by_reader": false, "reader_excluded_because": "the changed file itself (its docblock :14-17 names the call sites and describes the return value, so it is edited, not re-read)"}
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

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "event wiring only (:28-36); no code depends on httpOptions' contract"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: none of ['httpOptions'] appears in the file

* packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "wiring (Event::listen :58, bindings :104-110)"}
--- packages/Webkul/AiAgent/src/Providers/AiAgentServiceProvider.php: none of ['httpOptions'] appears in the file

* packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php  {"proposed_by_reader": false, "reader_excluded_because": "mocks ModelDiscovery (:22); the httpOptions path is replaced"}
--- packages/Webkul/MagicAI/tests/Feature/PlatformCommandsTest.php: none of ['httpOptions'] appears in the file

* packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php  {"proposed_by_reader": false, "reader_excluded_because": "frontend posts to webhook.test (:251); behaviour-coupled but not code-coupled"}
--- packages/Webkul/Webhook/src/Resources/views/webhooks/_fields.blade.php: none of ['httpOptions'] appears in the file

* (product-saving code that fires catalog.product.*.after / data_transfer.imports.batch.* events: ProductRepository, Admin/AdminApi product controllers, DataTransfer importer, BulkProductUpdate, ...)  {"proposed_by_reader": false, "reader_excluded_because": "event fan-in to the webhook/AutoEnrich listeners; the closure stops at the listeners because any product write reaches them"}
--- (product-saving code that fires catalog.product.*.after / data_transfer.imports.batch.* events: ProductRepository, Admin/AdminApi product controllers, DataTransfer importer, BulkProductUpdate, ...): FILE NOT FOUND at the pin

* (tests faking the queue: BulkEditWebhookQueuedTest, BulkEditWebhookNotDuplicatedTest, ProductBulkEditWebhookDedupeTest, ProductVariantNodeCreateTest)  {"proposed_by_reader": false, "reader_excluded_because": "jobs never run"}
--- (tests faking the queue: BulkEditWebhookQueuedTest, BulkEditWebhookNotDuplicatedTest, ProductBulkEditWebhookDedupeTest, ProductVariantNodeCreateTest): FILE NOT FOUND at the pin


========== ITEM uo-e-02 ==========
Question (registered, verbatim):
{
 "id": "uo-e-02",
 "suite": "E",
 "class": "change-impact",
 "subject": "unopim",
 "language": "php",
 "question": "If ProductRepository::isUniqueVariantForProduct changes its contract, which files must be re-read?",
 "probe": "isUniqueVariantForProduct",
 "declared_in": "packages/Webkul/Product/src/Repositories/ProductRepository.php:184",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Product/src/Repositories/ProductRepository.php:301 (self-call)",
  "packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php:1280,1585",
  "packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:487,589 and ConfigurableProductController.php:216",
  "packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3139"
 ],
 "note": "Two controllers named ProductController in different packages; the oracle resolves both."
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 9 controller entry point(s)", "framework-invoked entry point(s) not followed: Webkul\\Product\\Type\\Configurable::update, Webkul\\DataTransfer\\Helpers\\Importers\\Product\\Importer::saveValidatedBatches, runBulkVariantLevelUpdate"]

Reader notes: answerable_as_registered=True; Answer = hop 1 + hop 2 (registered stratum 2). Oracle misses ProductRepositoryTest (direct caller through an untyped Pest property). Oracle's 4 test files at hop >=3 are dropped under the 2-hop bound; they belong in a full transitive closure.
Reader on the oracle's open list: Configurable::update and AbstractType::update are hop-2 callers via guardVariantLevelWrite; Importer::saveValidatedBatches is not on the path (the call is validateRow:1303 -> isUniqueVariation:3159 -> validateVariantUniqueness:3139). Route hops land on Admin ProductController update/checkVariantUniqueness and AdminApi controllers; route-hop tests listed under excluded with the caveat. runBulkVariantLevelUpdate is a test helper in BulkProductUpdateVariantLevelTest.

Candidate files (23):

* packages/Webkul/Product/src/Repositories/ProductRepository.php  {"proposed_by_reader": true, "reader_reason": "hop 1: guardVariantLevelWrite self-call", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1 + declaring file"}
--- packages/Webkul/Product/src/Repositories/ProductRepository.php:298-304
  298          DB::transaction(function () use ($product, $newTuple, $onGuarded): void {
  299              $this->getModel()::query()->whereKey($product->parent_id)->lockForUpdate()->exists();
  300  
  301              if (! $this->isUniqueVariantForProduct($product->parent_id, $newTuple, null, $product->id, $product->type)) {
  302                  throw ValidationException::withMessages([
  303                      'axis' => [trans('admin::app.catalog.products.edit.types.configurable.variant-given-exists', ['variants' => json_encode($newTuple)])],
  304                  ]);

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductController.php  {"proposed_by_reader": true, "reader_reason": "hop 1: update, checkVariantUniqueness", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
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

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php  {"proposed_by_reader": true, "reader_reason": "hop 1: createVariantUnderGroup, validateVariantConfiguration; hop 2: updateProduct/patchProduct call guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
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
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ProductController.php:206-212
  206          if ($product->parent_id && ! empty($submittedCommon)) {
  207              $result = $product;
  208  
  209              $this->productRepository->guardVariantLevelWrite($product, $submittedCommon, function () use (&$result, $persist): void {
  210                  $result = $persist();
  211              });
  212  

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php  {"proposed_by_reader": true, "reader_reason": "hop 1: storeVariantGroup", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/ConfigurableProductController.php:213-219
  213          $node = DB::transaction(function () use ($parent, $sku, $axisTuple, $common) {
  214              $this->productRepository->getModel()::query()->whereKey($parent->id)->lockForUpdate()->first();
  215  
  216              if ($axisTuple !== [] && ! $this->productRepository->isUniqueVariantForProduct($parent->id, $axisTuple, null, '', ProductType::VariantGroup->value)) {
  217                  return null;
  218              }
  219  

* packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php  {"proposed_by_reader": true, "reader_reason": "hop 1: validateVariantUniqueness", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/DataTransfer/src/Helpers/Importers/Product/Importer.php:3136-3142
 3136  
 3137          $this->cachedVariantValues[$parentProduct->sku][$productData['sku']] = $variantConfigValues;
 3138  
 3139          $isUnique = $this->productRepository->isUniqueVariantForProduct($parentProduct->id, $variantConfigValues, $productData['sku'], $variationId);
 3140  
 3141          if (! $isUnique) {
 3142              $this->skipRow($rowNumber, self::ERROR_NOT_UNIQUE_VARIANT, 'sku', trans($this->messages[self::ERROR_NOT_UNIQUE_VARIANT]));

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct test calls"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryTest.php:161-167
  161      it('returns true when no duplicate variant exists', function () {
  162          $parent = Product::factory()->configurable()->create();
  163  
  164          $result = $this->productRepository->isUniqueVariantForProduct(
  165              $parent->id,
  166              ['color' => 'red']
  167          );

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryVariantUniquenessTest.php:28-34
   28  
   29      $repository = app(ProductRepository::class);
   30  
   31      expect($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::VariantGroup->value))
   32          ->toBeFalse()
   33          ->and($repository->isUniqueVariantForProduct($parent->id, ['color' => 'red'], null, '', ProductType::Configurable->value))
   34          ->toBeTrue();

* packages/Webkul/Product/src/Type/AbstractType.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
--- packages/Webkul/Product/src/Type/AbstractType.php:196-202
  196          };
  197  
  198          if ($product->parent_id && ! empty($productValues[self::COMMON_VALUES_KEY])) {
  199              $this->productRepository->guardVariantLevelWrite($product, $productValues[self::COMMON_VALUES_KEY], $persist);
  200          } else {
  201              $persist();
  202          }

* packages/Webkul/Product/src/Type/Configurable.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
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

* packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
--- packages/Webkul/DataTransfer/src/Jobs/System/BulkProductUpdate.php:305-311
  305          }
  306  
  307          try {
  308              $this->productRepository->guardVariantLevelWrite(
  309                  $product,
  310                  $submittedCommon,
  311                  $persist,

* packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
--- packages/Webkul/Admin/src/Http/Controllers/Catalog/ProductBulkEditController.php:480-486
  480              }
  481  
  482              try {
  483                  $this->productRepository->guardVariantLevelWrite(
  484                      $product,
  485                      $submittedCommon,
  486                      null,

* packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
--- packages/Webkul/Product/tests/Unit/Repositories/ProductRepositoryGuardVariantLevelWriteTest.php:60-66
   60  
   61      $repository = app(ProductRepository::class);
   62  
   63      expect(fn () => $repository->guardVariantLevelWrite($simple->fresh(), [$colorCode => 'green']))
   64          ->toThrow(ValidationException::class);
   65  });
   66  

* packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: guardVariantLevelWrite", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2"}
--- packages/Webkul/Product/tests/Unit/Type/AbstractTypeVariantGuardTest.php:106-112
  106          'variant_structure_id' => $structure->id,
  107      ]);
  108  
  109      expect(fn () => $repository->guardVariantLevelWrite($configurable->fresh(), [$color->code => 'red']))
  110          ->toThrow(ValidationException::class);
  111  
  112      $repository->update([

* packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php  {"proposed_by_reader": true, "reader_reason": "subclass of the AdminApi ProductController; store calls inherited createOrUpdateVariant -> createVariantUnderGroup / validateVariantConfiguration (hop 3 by calls, but it inherits and directly drives the hop-1 methods; include for change-impact)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: inherits and drives the hop-1 methods"}
--- packages/Webkul/AdminApi/src/Http/Controllers/API/Catalog/SimpleProductController.php:102-108
  102                      ($data['variant']['attributes'] ?? [])
  103                  );
  104  
  105                  $product = $this->createOrUpdateVariant($data);
  106                  unset($data['variant']);
  107              }
  108  

* packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: Importer::validateRow -> isUniqueVariation -> validateVariantUniqueness -> target: hop 4 for a 2-hop change-impact set"}
--- packages/Webkul/Admin/tests/Feature/DataTransfer/ImageZipDocumentUploadTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: BulkProductUpdate::handle -> ... -> persistProduct -> guardVariantLevelWrite -> target: hop >=3"}
--- packages/Webkul/DataTransfer/tests/Feature/BulkProductUpdateVariantLevelTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: hop 4 via Importer::validateRow"}
--- packages/Webkul/DataTransfer/tests/Feature/ProductMediaExportImportTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: BulkProductUpdate::handle caller, hop >=3"}
--- packages/Webkul/Webhook/tests/Feature/BulkEditWebhookActingUserTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php  {"proposed_by_reader": false, "reader_excluded_because": "route hop into checkVariantUniqueness (hop 2 only if a route counts as a call); include if the benchmark follows route hops"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductCheckVariantUniquenessTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php  {"proposed_by_reader": false, "reader_excluded_because": "route hop into ProductController::update; same caveat"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductVariantCombinationExistsTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php  {"proposed_by_reader": false, "reader_excluded_because": "route hop into ProductController::update (:342,:659 assert the uniqueness message); same caveat"}
--- packages/Webkul/Admin/tests/Feature/Catalog/ProductTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php  {"proposed_by_reader": false, "reader_excluded_because": "route hop into storeVariantGroup (:210); same caveat"}
--- packages/Webkul/AdminApi/tests/Feature/Catalog/ApiVariantGroupProductTest.php: none of ['isUniqueVariantForProduct'] appears in the file

* packages/Webkul/Admin/src/Routes/catalog-routes.php  {"proposed_by_reader": false, "reader_excluded_because": "route registration (:226) only"}
--- packages/Webkul/Admin/src/Routes/catalog-routes.php: none of ['isUniqueVariantForProduct'] appears in the file


========== ITEM uo-e-03 ==========
Question (registered, verbatim):
{
 "id": "uo-e-03",
 "suite": "E",
 "class": "change-impact",
 "subject": "unopim",
 "language": "php",
 "question": "If WebhookService::getProductChangesForWebhook changes its contract, which files must be re-read?",
 "probe": "getProductChangesForWebhook",
 "declared_in": "packages/Webkul/Webhook/src/Services/WebhookService.php:366",
 "hop_stratum": 2,
 "basis": [
  "packages/Webkul/Webhook/src/Listeners/Product.php:34,49 (hop 1)",
  "packages/Webkul/Webhook/src/Services/WebhookService.php:152 (self-call inside sendBatch)",
  "packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:13"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["framework-invoked entry point(s) not followed: Webkul\\Webhook\\Listeners\\Product::afterCreate, Webkul\\Webhook\\Services\\WebhookService::sendBatchBySkus, Webkul\\Webhook\\Jobs\\SendBulkEditProductWebhook::handle"]

Reader notes: answerable_as_registered=True; Hop<=2 answer. Data-flow note for a contract change: SendProductWebhook receives the listener's changes array and passes it to sendDataToWebhook/sendCreatedToWebhook -> normalizeWebhookData (WebhookService.php:317), so a shape change also needs SendProductWebhook read even though it never calls the method. Under the full transitive reading add the oracle's dropped files (the two bulk jobs and four tests).
Reader on the oracle's open list: Listener::afterCreate/afterUpdate are reached from catalog.product.create/update.after events (EventServiceProvider.php:28-30); every product-saving path fires them, so event fan-in is not enumerated. sendBatchBySkus has no callers. SendBulkEditProductWebhook::handle is hop 4.

Candidate files (13):

* packages/Webkul/Webhook/src/Services/WebhookService.php  {"proposed_by_reader": true, "reader_reason": "hop 1: sendBatch self-call; hop 2: deliverChunked calls sendBatch (same file)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
--- packages/Webkul/Webhook/src/Services/WebhookService.php:149-155
  149  
  150          foreach ($products as $product) {
  151              $productChanges = $computeChanges
  152                  ? $this->getProductChangesForWebhook($product)
  153                  : [];
  154  
  155              if ($skipIfNoChanges && $productChanges === []) {
--- packages/Webkul/Webhook/src/Services/WebhookService.php:85-91
   85          $lastResponse = null;
   86  
   87          foreach (array_chunk($values, $this->batchChunkSize()) as $chunk) {
   88              $lastResponse = $this->sendBatch(
   89                  $this->productRepository->findWhereIn($field, $chunk),
   90                  $computeChanges,
   91                  $event,

* packages/Webkul/Webhook/src/Listeners/Product.php  {"proposed_by_reader": true, "reader_reason": "hop 1: afterUpdate/afterCreate; uses the returned array ([] check, passes it into the job)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 1"}
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

* packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct; asserts on the returned shape", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct"}
--- packages/Webkul/Webhook/tests/Unit/ProductWebhookChangeResolutionTest.php:10-16
   10  
   11      $product->update(['sku' => $product->sku.'-changed']);
   12  
   13      $changes = app(WebhookService::class)->getProductChangesForWebhook($product);
   14  
   15      expect($changes)->not->toBeEmpty()
   16          ->and($changes['changed'] ?? [])->toHaveKey('sku');

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls ProductListener::afterUpdate directly (3 calls)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: hop 2 via afterUpdate"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookNotDuplicatedTest.php:39-45
   39  
   40      app(ProductListener::class)->afterUpdate($product);
   41  
   42      Queue::assertPushed(SendProductWebhook::class);
   43  });
   44  
   45  it('sends exactly one batched webhook job for a bulk-edited product', function () {

* packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchForBulkEdit -> deliverChunked -> sendBatch -> target: hop 4; and that path passes skipIfNoChanges=false but computeChanges=true, still >2 hops"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkEditProductWebhook.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: hop 4 (sendBatchCreatedByIds even sets computeChanges=false)"}
--- packages/Webkul/Webhook/src/Jobs/SendBulkProductWebhook.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchForBulkEdit caller, hop 4"}
--- packages/Webkul/Webhook/tests/Feature/BatchChunkTest.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: hop 4"}
--- packages/Webkul/Webhook/tests/Feature/BatchLogSliceTest.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: sendBatchByIds caller, hop 4"}
--- packages/Webkul/Webhook/tests/Feature/ImportUpdateWebhookDeliveryTest.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php  {"proposed_by_reader": false, "listed_by_oracle": true, "reader_on_oracle_file": "drop: calls afterBulkCreate/afterBulkEditFromImport, which do not call the target; job handle path is hop >=5"}
--- packages/Webkul/Webhook/tests/Unit/ImportProductWebhookTest.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/src/Providers/EventServiceProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "binds afterUpdate/afterCreate to catalog.product.update/create.after (:28,:30); wiring, hop 2 only if registration counts as a call"}
--- packages/Webkul/Webhook/src/Providers/EventServiceProvider.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php  {"proposed_by_reader": false, "reader_excluded_because": "consumes the changes array produced by the listener (constructor arg) - a data dependency, not a call; worth reading if the array shape changes"}
--- packages/Webkul/Webhook/src/Jobs/SendProductWebhook.php: none of ['getProductChangesForWebhook'] appears in the file

* packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php  {"proposed_by_reader": false, "reader_excluded_because": "calls afterBulkEdit only, which does not compute changes"}
--- packages/Webkul/Webhook/tests/Unit/BulkEditWebhookQueuedTest.php: none of ['getProductChangesForWebhook'] appears in the file