You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository; the source lines below were extracted mechanically from the subject at its registered pin, with line numbers. A reader with repository access proposed an answer set; a static reference engine (the oracle) listed files where it could. Neither is authoritative.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question) or `OUT`, and give a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Answer the question as worded. Do not reward or penalise a file for who proposed it.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `larasend` at its registered pin.



========== ITEM ls-c-route-01 ==========
Question (registered, verbatim):
{
 "id": "ls-c-route-01",
 "suite": "C",
 "class": "route-trace",
 "subject": "larasend",
 "language": "php",
 "question": "Through which files does POST /api/emails reach the Email model?",
 "probe": "POST /api/emails",
 "probe_to": "Email",
 "hop_stratum": ">=3",
 "basis": [
  "routes/api.php:13 -- Route::post('emails', [EmailController::class, 'store'])",
  "app/Http/Controllers/Api/EmailController.php:40,80 -- store() calls EmailSendService::send",
  "app/Services/EmailSendService.php:72 -- Email::create([...])",
  "tests/Feature/ApiEmailTest.php uses the /api/ prefix (route file loaded under api)"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; bootstrap/app.php is a registration hop, not a call. Drop it if the metric counts only call-path files.
Reader on the oracle's open list: Oracle open: no reference engine emits this relation. Followed by hand: api.php -> EmailController::store -> EmailSendService::send -> Email::create. The /api prefix comes from bootstrap/app.php:13.

Candidate files (11):

* routes/api.php  {"proposed_by_reader": true, "reader_reason": "Route::post('emails', [EmailController::class, 'store'])"}
--- routes/api.php:10-16
   10  
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
   16  });

* bootstrap/app.php  {"proposed_by_reader": true, "reader_reason": "registers routes/api.php under the api (/api) prefix, which makes the path /api/emails"}
--- bootstrap/app.php:10-16
   10  return Application::configure(basePath: dirname(__DIR__))
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
   14          commands: __DIR__.'/../routes/console.php',
   15          channels: __DIR__.'/../routes/channels.php',
   16          health: '/up',

* app/Http/Controllers/Api/EmailController.php  {"proposed_by_reader": true, "reader_reason": "store() calls EmailSendService::send"}
--- app/Http/Controllers/Api/EmailController.php:37-43
   37          ]);
   38      }
   39  
   40      public function store(SendEmailRequest $request, EmailSendService $emailSendService): JsonResponse
   41      {
   42          /** @var Project $project */
   43          $project = $request->attributes->get('larasend_project');
--- app/Http/Controllers/Api/EmailController.php:77-83
   77          }
   78  
   79          try {
   80              $email = $emailSendService->send($project, $source, $payload, $idempotencyKey, $idempotencyHash);
   81          } catch (QueryException $exception) {
   82              if ($idempotencyKey === null || ! $this->isUniqueConstraintViolation($exception)) {
   83                  throw $exception;

* app/Services/EmailSendService.php  {"proposed_by_reader": true, "reader_reason": "send() returns Email and calls Email::create"}
--- app/Services/EmailSendService.php:37-43
   37          array $payload,
   38          ?string $idempotencyKey = null,
   39          ?string $idempotencyHash = null,
   40      ): Email {
   41          $source ??= $project->sources()->where('environment', $project->default_environment)->firstOrFail();
   42          $template = $this->resolveTemplate($project, $payload);
   43          $payload = $this->applyTemplate($payload, $template);
--- app/Services/EmailSendService.php:69-75
   69              $email = DB::transaction(function () use ($project, $source, $payload, $template, $from, $publicId, $mime, $mimeDisk, $mimePath, $idempotencyKey, $idempotencyHash) {
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   71  
   72                  $email = Email::create([
   73                      'public_id' => $publicId,
   74                      'idempotency_key' => $idempotencyKey,
   75                      'idempotency_hash' => $idempotencyHash,

* app/Models/Email.php  {"proposed_by_reader": true, "reader_reason": "target model"}
--- app/Services/EmailSendService.php:4-10
    4  
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;

* app/Models/Project.php  {"proposed_by_reader": false, "reader_excluded_because": "store() also reaches Email via $project->emails() (EmailController.php:60,86; Project.php:54-56) on the idempotency-replay branch. That is a secondary branch, not the create path; include it if the question means every branch."}
--- app/Models/Project.php:51-57
   51          return $this->hasMany(Template::class);
   52      }
   53  
   54      public function emails(): HasMany
   55      {
   56          return $this->hasMany(Email::class);
   57      }
--- app/Models/Project.php:53-59
   53  
   54      public function emails(): HasMany
   55      {
   56          return $this->hasMany(Email::class);
   57      }
   58  
   59      public function webhookEndpoints(): HasMany
--- app/Models/Project.php:66-72
   66          return $this->hasMany(Suppression::class);
   67      }
   68  
   69      public function inboundEmails(): HasMany
   70      {
   71          return $this->hasMany(InboundEmail::class);
   72      }

* app/Http/Middleware/AuthenticateLarasendApiKey.php  {"proposed_by_reader": false, "reader_excluded_because": "route middleware; resolves the project/source attributes and does not touch Email"}
--- app/Http/Middleware/AuthenticateLarasendApiKey.php:36-42
   36          }
   37  
   38          $requiredScope = match ($request->route()?->getName()) {
   39              'api.emails.index', 'api.emails.show' => 'read:activity',
   40              'api.emails.store' => 'send',
   41              'api.suppressions.destroy' => 'manage:suppressions',
   42              default => null,
--- app/Http/Middleware/AuthenticateLarasendApiKey.php:37-43
   37  
   38          $requiredScope = match ($request->route()?->getName()) {
   39              'api.emails.index', 'api.emails.show' => 'read:activity',
   40              'api.emails.store' => 'send',
   41              'api.suppressions.destroy' => 'manage:suppressions',
   42              default => null,
   43          };

* app/Http/Middleware/ThrottleLarasendApiKey.php  {"proposed_by_reader": false, "reader_excluded_because": "middleware with no Email relation"}
--- app/Http/Middleware/ThrottleLarasendApiKey.php: none of ['emails', 'Email'] appears in the file

* app/Http/Requests/SendEmailRequest.php  {"proposed_by_reader": false, "reader_excluded_because": "validation only"}
--- app/Http/Requests/SendEmailRequest.php:6-12
    6  use Illuminate\Foundation\Http\FormRequest;
    7  use Illuminate\Validation\Validator;
    8  
    9  class SendEmailRequest extends FormRequest
   10  {
   11      /**
   12       * Determine if the user is authorized to make this request.

* app/Jobs/SendQueuedEmail.php  {"proposed_by_reader": false, "reader_excluded_because": "dispatched with an Email id after creation; downstream of the model, not on the path to it"}
--- app/Jobs/SendQueuedEmail.php:2-8
    2  
    3  namespace App\Jobs;
    4  
    5  use App\Events\EmailActivityUpdated;
    6  use App\Models\Email;
    7  use App\Services\Providers\EmailProviderFactory;
    8  use Illuminate\Contracts\Queue\ShouldBeUnique;
--- app/Jobs/SendQueuedEmail.php:3-9
    3  namespace App\Jobs;
    4  
    5  use App\Events\EmailActivityUpdated;
    6  use App\Models\Email;
    7  use App\Services\Providers\EmailProviderFactory;
    8  use Illuminate\Contracts\Queue\ShouldBeUnique;
    9  use Illuminate\Contracts\Queue\ShouldQueue;
--- app/Jobs/SendQueuedEmail.php:4-10
    4  
    5  use App\Events\EmailActivityUpdated;
    6  use App\Models\Email;
    7  use App\Services\Providers\EmailProviderFactory;
    8  use Illuminate\Contracts\Queue\ShouldBeUnique;
    9  use Illuminate\Contracts\Queue\ShouldQueue;
   10  use Illuminate\Foundation\Queue\Queueable;

* app/Services/ThreadResolver.php  {"proposed_by_reader": false, "reader_excluded_because": "attachOutbound(Email) receives the Email after it is created"}
--- app/Services/ThreadResolver.php:2-8
    2  
    3  namespace App\Services;
    4  
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Models\Thread;
    8  use Illuminate\Support\Str;
--- app/Services/ThreadResolver.php:3-9
    3  namespace App\Services;
    4  
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Models\Thread;
    8  use Illuminate\Support\Str;
    9  
--- app/Services/ThreadResolver.php:18-24
   18  {
   19      /**
   20       * Days after which a dormant thread no longer attracts subject-matched
   21       * messages — prevents years of "Invoice" emails collapsing into one.
   22       */
   23      private const SUBJECT_MATCH_WINDOW_DAYS = 60;
   24  


========== ITEM ls-c-route-02 ==========
Question (registered, verbatim):
{
 "id": "ls-c-route-02",
 "suite": "C",
 "class": "route-trace",
 "subject": "larasend",
 "language": "php",
 "question": "Through which files does POST /api/webhooks/inbound/cloudflare/{token} reach the Thread model?",
 "probe": "POST /api/webhooks/inbound/cloudflare/{token}",
 "probe_to": "Thread",
 "hop_stratum": ">=3",
 "basis": [
  "routes/api.php:22 -- invokable CloudflareInboundController",
  "app/Http/Controllers/Webhooks/CloudflareInboundController.php:28,87 -- InboundEmailIngestor::ingest",
  "app/Services/InboundEmailIngestor.php:77 -- $this->threads->attachInbound($inbound)",
  "app/Services/ThreadResolver.php:25 -- attachInbound returns Thread"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Same bootstrap/app.php caveat as ls-c-route-01.
Reader on the oracle's open list: Followed by hand through the invokable controller, the ingestor and the resolver.

Candidate files (10):

* routes/api.php  {"proposed_by_reader": true, "reader_reason": "route to the invokable CloudflareInboundController"}
--- routes/api.php:19-25
   19      ->middleware('throttle:120,1')
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
   25  

* bootstrap/app.php  {"proposed_by_reader": true, "reader_reason": "registers the api route file with the /api prefix"}
--- bootstrap/app.php:10-16
   10  return Application::configure(basePath: dirname(__DIR__))
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
   14          commands: __DIR__.'/../routes/console.php',
   15          channels: __DIR__.'/../routes/channels.php',
   16          health: '/up',

* app/Http/Controllers/Webhooks/CloudflareInboundController.php  {"proposed_by_reader": true, "reader_reason": "__invoke injects InboundEmailIngestor and calls ingest()"}
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php:25-31
   25      public function __invoke(
   26          Request $request,
   27          string $token,
   28          InboundEmailIngestor $ingestor,
   29          CloudflareInboundProvisioner $provisioner,
   30      ): JsonResponse {
   31          $source = Source::query()
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php:84-90
   84          ]);
   85  
   86          try {
   87              $inbound = $ingestor->ingest($source, $validated['from'], $validated['to'], $mime);
   88          } catch (Throwable $exception) {
   89              report($exception);
   90              $log->forceFill(['status' => 'failed', 'error' => $exception->getMessage()])->save();

* app/Services/InboundEmailIngestor.php  {"proposed_by_reader": true, "reader_reason": "ingest() calls $this->threads->attachInbound($inbound)"}
--- app/Services/InboundEmailIngestor.php:23-29
   23  {
   24      public function __construct(
   25          private MailMimeParser $parser,
   26          private ThreadResolver $threads,
   27      ) {}
   28  
   29      public function ingest(Source $source, string $envelopeFrom, string $envelopeTo, string $mime): InboundEmail
--- app/Services/InboundEmailIngestor.php:74-80
   74                      'received_at' => now(),
   75                  ]);
   76  
   77                  $this->threads->attachInbound($inbound);
   78  
   79                  return $inbound;
   80              });

* app/Services/ThreadResolver.php  {"proposed_by_reader": true, "reader_reason": "attachInbound returns a Thread, which it finds or creates through Thread::query()"}
--- app/Services/ThreadResolver.php:22-28
   22       */
   23      private const SUBJECT_MATCH_WINDOW_DAYS = 60;
   24  
   25      public function attachInbound(InboundEmail $inbound): Thread
   26      {
   27          $participants = array_filter([
   28              Str::lower($inbound->from_email),
--- app/Services/ThreadResolver.php:156-162
  156  
  157      private function createThread(int $workspaceId, int $projectId, ?string $subject): Thread
  158      {
  159          return Thread::query()->create([
  160              'public_id' => 'thread_'.Str::random(24),
  161              'workspace_id' => $workspaceId,
  162              'project_id' => $projectId,

* app/Models/Thread.php  {"proposed_by_reader": true, "reader_reason": "target model"}
--- app/Services/ThreadResolver.php:4-10
    4  
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Models\Thread;
    8  use Illuminate\Support\Str;
    9  
   10  /**

* app/Models/InboundEmail.php  {"proposed_by_reader": false, "reader_excluded_because": "created by the ingestor and passed to attachInbound. It carries thread_id, but the path reaches Thread through ThreadResolver"}
--- app/Models/InboundEmail.php:55-61
   55  
   56      public function thread(): BelongsTo
   57      {
   58          return $this->belongsTo(Thread::class);
   59      }
   60  }
   61  

* app/Jobs/DeliverInboundWebhook.php  {"proposed_by_reader": false, "reader_excluded_because": "dispatched by the ingestor; does not lead to Thread"}
--- app/Jobs/DeliverInboundWebhook.php:17-23
   17  use Throwable;
   18  
   19  /**
   20   * Fans an inbound email out to every active endpoint subscribed to the
   21   * "inbound.received" event, using the same signature scheme and delivery
   22   * records as outbound event webhooks.
   23   */
--- app/Jobs/DeliverInboundWebhook.php:18-24
   18  
   19  /**
   20   * Fans an inbound email out to every active endpoint subscribed to the
   21   * "inbound.received" event, using the same signature scheme and delivery
   22   * records as outbound event webhooks.
   23   */
   24  class DeliverInboundWebhook implements ShouldBeUnique, ShouldQueue
--- app/Jobs/DeliverInboundWebhook.php:19-25
   19  /**
   20   * Fans an inbound email out to every active endpoint subscribed to the
   21   * "inbound.received" event, using the same signature scheme and delivery
   22   * records as outbound event webhooks.
   23   */
   24  class DeliverInboundWebhook implements ShouldBeUnique, ShouldQueue
   25  {

* app/Services/Providers/CloudflareInboundProvisioner.php  {"proposed_by_reader": false, "reader_excluded_because": "domain check in the controller; no Thread access"}
--- app/Services/Providers/CloudflareInboundProvisioner.php:13-19
   13  use Throwable;
   14  
   15  /**
   16   * Turns on inbound email for a domain with zero manual Cloudflare steps:
   17   * uploads the passthrough Worker, enables Email Routing on the zone, and
   18   * points the catch-all rule at the Worker. Failures throw with the exact
   19   * missing piece plus manual instructions, mirroring how automatic domain
--- app/Services/Providers/CloudflareInboundProvisioner.php:25-31
   25       * The MX records Cloudflare Email Routing expects at the zone apex.
   26       */
   27      private const ROUTING_MX = [
   28          ['priority' => 20, 'target' => 'route1.mx.cloudflare.net'],
   29          ['priority' => 59, 'target' => 'route2.mx.cloudflare.net'],
   30          ['priority' => 99, 'target' => 'route3.mx.cloudflare.net'],
   31      ];
--- app/Services/Providers/CloudflareInboundProvisioner.php:26-32
   26       */
   27      private const ROUTING_MX = [
   28          ['priority' => 20, 'target' => 'route1.mx.cloudflare.net'],
   29          ['priority' => 59, 'target' => 'route2.mx.cloudflare.net'],
   30          ['priority' => 99, 'target' => 'route3.mx.cloudflare.net'],
   31      ];
   32  

* app/Models/WebhookLog.php  {"proposed_by_reader": false, "reader_excluded_because": "logging in the controller; no Thread access"}
--- app/Models/WebhookLog.php: none of ['webhooks', 'inbound', 'cloudflare', '{token}', 'Thread'] appears in the file


========== ITEM ls-c-route-03 ==========
Question (registered, verbatim):
{
 "id": "ls-c-route-03",
 "suite": "C",
 "class": "route-trace",
 "subject": "larasend",
 "language": "php",
 "question": "Through which files does DELETE /api/suppressions/{suppression} reach the Suppression model?",
 "probe": "DELETE /api/suppressions/{suppression}",
 "probe_to": "Suppression",
 "hop_stratum": ">=3",
 "basis": [
  "routes/api.php:15 -- SuppressionController::destroy",
  "app/Http/Controllers/Api/SuppressionController.php:17,28 -- calls SuppressionRemovalService::remove",
  "app/Services/SuppressionRemovalService.php:20,25 -- $suppression->delete()"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Same bootstrap/app.php caveat.
Reader on the oracle's open list: Followed by hand. The controller already reaches Suppression directly through implicit binding (hop 2); the service performs the delete.

Candidate files (8):

* routes/api.php  {"proposed_by_reader": true, "reader_reason": "Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])"}
--- routes/api.php:12-18
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
   16  });
   17  
   18  Route::post('webhooks/ses/{token}', SesWebhookController::class)

* bootstrap/app.php  {"proposed_by_reader": true, "reader_reason": "registers the api route file with the /api prefix"}
--- bootstrap/app.php:10-16
   10  return Application::configure(basePath: dirname(__DIR__))
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
   14          commands: __DIR__.'/../routes/console.php',
   15          channels: __DIR__.'/../routes/channels.php',
   16          health: '/up',

* app/Http/Controllers/Api/SuppressionController.php  {"proposed_by_reader": true, "reader_reason": "binds Suppression through implicit route-model binding, then calls SuppressionRemovalService::remove"}
--- app/Http/Controllers/Api/SuppressionController.php:16-22
   16  {
   17      public function destroy(
   18          Request $request,
   19          Suppression $suppression,
   20          SuppressionRemovalService $removalService,
   21      ): Response|JsonResponse {
   22          /** @var Project $project */
--- app/Http/Controllers/Api/SuppressionController.php:25-31
   25          abort_unless($suppression->project_id === $project->id, 404);
   26  
   27          try {
   28              $removalService->remove($suppression);
   29          } catch (SuppressionProviderUnavailableException $exception) {
   30              return response()->json(['message' => $exception->getMessage()], 503);
   31          } catch (SuppressionRemovalException $exception) {

* app/Services/SuppressionRemovalService.php  {"proposed_by_reader": true, "reader_reason": "remove(Suppression) calls $suppression->delete()"}
--- app/Services/SuppressionRemovalService.php:17-23
   17          private CloudflareApiClient $cloudflare,
   18      ) {}
   19  
   20      public function remove(Suppression $suppression): void
   21      {
   22          $source = $suppression->source;
   23  
--- app/Services/SuppressionRemovalService.php:22-28
   22          $source = $suppression->source;
   23  
   24          if ($source === null) {
   25              $suppression->delete();
   26  
   27              return;
   28          }
--- app/Services/SuppressionRemovalService.php:70-76
   70              );
   71          }
   72  
   73          $suppression->delete();
   74      }
   75  }
   76  

* app/Models/Suppression.php  {"proposed_by_reader": true, "reader_reason": "target model"}
--- app/Http/Controllers/Api/SuppressionController.php:6-12
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Controllers\Controller;
    8  use App\Models\Project;
    9  use App\Models\Suppression;
   10  use App\Services\SuppressionRemovalService;
   11  use Illuminate\Http\JsonResponse;
   12  use Illuminate\Http\Request;

* app/Services/SesV2Client.php  {"proposed_by_reader": false, "reader_excluded_because": "provider call inside remove(); does not touch the Suppression model"}
--- app/Services/SesV2Client.php: none of ['suppressions', '{suppression}', 'Suppression'] appears in the file

* app/Services/CloudflareApiClient.php  {"proposed_by_reader": false, "reader_excluded_because": "provider call inside remove(); no model access"}
--- app/Services/CloudflareApiClient.php:3-9
    3  namespace App\Services;
    4  
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use Illuminate\Http\Client\PendingRequest;
    8  use Illuminate\Http\Client\Response;
    9  use Illuminate\Support\Facades\Http;
--- app/Services/CloudflareApiClient.php:33-39
   33      }
   34  
   35      /**
   36       * All account-level suppressions, paginated to exhaustion.
   37       *
   38       * @return array<int, array{id: string, email: string, reason: string, created_at: string|null, expires_at: string|null}>
   39       */
--- app/Services/CloudflareApiClient.php:37-43
   37       *
   38       * @return array<int, array{id: string, email: string, reason: string, created_at: string|null, expires_at: string|null}>
   39       */
   40      public function listSuppressions(Source $source): array
   41      {
   42          return $this->listSuppressionsUntil($source);
   43      }

* app/Http/Middleware/AuthenticateLarasendApiKey.php  {"proposed_by_reader": false, "reader_excluded_because": "maps the route name to a scope (line 41); no Suppression access"}
--- app/Http/Middleware/AuthenticateLarasendApiKey.php:38-44
   38          $requiredScope = match ($request->route()?->getName()) {
   39              'api.emails.index', 'api.emails.show' => 'read:activity',
   40              'api.emails.store' => 'send',
   41              'api.suppressions.destroy' => 'manage:suppressions',
   42              default => null,
   43          };
   44  


========== ITEM ls-c-model-01 ==========
Question (registered, verbatim):
{
 "id": "ls-c-model-01",
 "suite": "C",
 "class": "model-table",
 "subject": "larasend",
 "language": "php",
 "question": "Which table does the WebhookDelivery model persist to, and which migration files define or alter it?",
 "probe": "WebhookDelivery",
 "hop_stratum": 1,
 "basis": [
  "app/Models/WebhookDelivery.php -- no $table override (conventional name)",
  "database/migrations/2026_05_11_120741_create_webhook_deliveries_table.php:14 -- Schema::create('webhook_deliveries')"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Table: webhook_deliveries. No migration alters it.
Reader on the oracle's open list: Grepped all migrations for webhook_deliveries; only the create migration matches.

Candidate files (2):

* app/Models/WebhookDelivery.php  {"proposed_by_reader": true, "reader_reason": "no $table property, so the conventional table webhook_deliveries applies"}
--- app/Models/WebhookDelivery.php:6-12
    6  use Illuminate\Database\Eloquent\Model;
    7  use Illuminate\Database\Eloquent\Relations\BelongsTo;
    8  
    9  class WebhookDelivery extends Model
   10  {
   11      use HasFactory;
   12  

* database/migrations/2026_05_11_120741_create_webhook_deliveries_table.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('webhook_deliveries')"}
--- database/migrations/2026_05_11_120741_create_webhook_deliveries_table.php:11-17
   11       */
   12      public function up(): void
   13      {
   14          Schema::create('webhook_deliveries', function (Blueprint $table) {
   15              $table->id();
   16              $table->foreignId('webhook_endpoint_id')->constrained()->cascadeOnDelete();
   17              $table->string('public_id')->unique();


========== ITEM ls-c-model-02 ==========
Question (registered, verbatim):
{
 "id": "ls-c-model-02",
 "suite": "C",
 "class": "model-table",
 "subject": "larasend",
 "language": "php",
 "question": "Which table does the Thread model persist to, and which migration files define or alter it?",
 "probe": "Thread",
 "hop_stratum": 1,
 "basis": [
  "database/migrations/2026_07_11_001656_create_threads_table.php:15 -- Schema::create('threads')",
  "database/migrations/2026_07_12_034640_add_team_workflow_to_threads_table.php -- alters threads"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Table: threads.
Reader on the oracle's open list: Grepped the migrations for threads.

Candidate files (7):

* app/Models/Thread.php  {"proposed_by_reader": true, "reader_reason": "no $table property, so the table is threads"}
--- app/Models/Thread.php:6-12
    6  use Illuminate\Database\Eloquent\Relations\BelongsTo;
    7  use Illuminate\Database\Eloquent\Relations\HasMany;
    8  
    9  class Thread extends Model
   10  {
   11      protected $fillable = [
   12          'public_id',

* database/migrations/2026_07_11_001656_create_threads_table.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('threads')"}
--- database/migrations/2026_07_11_001656_create_threads_table.php:12-18
   12              return;
   13          }
   14  
   15          Schema::create('threads', function (Blueprint $table) {
   16              $table->id();
   17              $table->string('public_id')->unique();
   18              $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();

* database/migrations/2026_07_12_034640_add_team_workflow_to_threads_table.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('threads') adds columns"}
--- database/migrations/2026_07_12_034640_add_team_workflow_to_threads_table.php:11-17
   11       */
   12      public function up(): void
   13      {
   14          Schema::table('threads', function (Blueprint $table) {
   15              $table->string('status')->default('open')->after('snoozed_until')->index();
   16              $table->string('priority')->default('normal')->after('status')->index();
   17              $table->foreignId('assigned_to_user_id')->nullable()->after('priority')->constrained('users')->nullOnDelete();

* database/migrations/2026_07_11_001657_add_thread_id_to_email_tables.php  {"proposed_by_reader": false, "reader_excluded_because": "adds thread_id foreign keys to the email tables that reference threads; it alters those tables, not threads"}
--- database/migrations/2026_07_11_001657_add_thread_id_to_email_tables.php: none of ['Thread'] appears in the file

* database/migrations/2026_07_12_034640_create_thread_events_table.php  {"proposed_by_reader": false, "reader_excluded_because": "foreign key to threads; defines thread_events"}
--- database/migrations/2026_07_12_034640_create_thread_events_table.php: none of ['Thread'] appears in the file

* database/migrations/2026_07_12_034640_create_thread_user_states_table.php  {"proposed_by_reader": false, "reader_excluded_because": "foreign key to threads; defines thread_user_states"}
--- database/migrations/2026_07_12_034640_create_thread_user_states_table.php: none of ['Thread'] appears in the file

* database/migrations/2026_07_11_055756_create_thread_notes_table.php  {"proposed_by_reader": false, "reader_excluded_because": "foreign key to threads; defines thread_notes"}
--- database/migrations/2026_07_11_055756_create_thread_notes_table.php: none of ['Thread'] appears in the file


========== ITEM ls-c-model-03 ==========
Question (registered, verbatim):
{
 "id": "ls-c-model-03",
 "suite": "C",
 "class": "model-table",
 "subject": "larasend",
 "language": "php",
 "question": "Which table does the ApiKey model persist to, and which migration files define or alter it?",
 "probe": "ApiKey",
 "hop_stratum": 1,
 "basis": [
  "database/migrations/2026_05_11_033056_create_larasend_core_tables.php:78 -- Schema::create('api_keys') inside a multi-table migration",
  "database/migrations/2026_06_24_141106_add_governance_fields_to_api_keys_table.php -- alters api_keys"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Table: api_keys.
Reader on the oracle's open list: Grepped the migrations for api_keys.

Candidate files (4):

* app/Models/ApiKey.php  {"proposed_by_reader": true, "reader_reason": "no $table property, so the table is api_keys"}
--- app/Models/ApiKey.php:7-13
    7  use Illuminate\Database\Eloquent\Relations\BelongsTo;
    8  use Illuminate\Support\Str;
    9  
   10  class ApiKey extends Model
   11  {
   12      use HasFactory;
   13  

* database/migrations/2026_05_11_033056_create_larasend_core_tables.php  {"proposed_by_reader": true, "reader_reason": "Schema::create('api_keys') inside a multi-table migration"}
--- database/migrations/2026_05_11_033056_create_larasend_core_tables.php:75-81
   75              $table->index(['project_id', 'environment']);
   76          });
   77  
   78          Schema::create('api_keys', function (Blueprint $table) {
   79              $table->id();
   80              $table->foreignId('project_id')->constrained()->cascadeOnDelete();
   81              $table->foreignId('source_id')->nullable()->constrained()->cascadeOnDelete();

* database/migrations/2026_06_24_141106_add_governance_fields_to_api_keys_table.php  {"proposed_by_reader": true, "reader_reason": "Schema::table('api_keys') adds columns"}
--- database/migrations/2026_06_24_141106_add_governance_fields_to_api_keys_table.php:11-17
   11       */
   12      public function up(): void
   13      {
   14          Schema::table('api_keys', function (Blueprint $table) {
   15              $table->json('scopes')->nullable()->after('key_hash');
   16              $table->string('last_used_ip', 45)->nullable()->after('last_used_at');
   17              $table->text('last_used_user_agent')->nullable()->after('last_used_ip');

* database/migrations/2026_07_04_160533_merge_duplicate_sources_and_add_unique_constraint.php  {"proposed_by_reader": false, "reader_excluded_because": "lists api_keys at line 17 and rewrites source_id values through DB::table (a data migration). It makes no schema change to api_keys; include it only if 'alter' covers data changes"}
--- database/migrations/2026_07_04_160533_merge_duplicate_sources_and_add_unique_constraint.php: none of ['ApiKey'] appears in the file


========== ITEM ls-e-x-01 ==========
Question (registered, verbatim):
{
 "id": "ls-e-x-01",
 "suite": "E",
 "class": "change-impact-xplane",
 "subject": "larasend",
 "language": "php",
 "target_language": "vue",
 "question": "If the props InboxController passes to its page change, which frontend files must be re-read?",
 "probe": "InboxController",
 "hop_stratum": 1,
 "basis": [
  "app/Http/Controllers/InboxController.php:51 -- Inertia::render('Inbox', [...])",
  "resources/js/pages/Inbox.vue -- the page component that receives those props"
 ],
 "note": "Wayfinder route helpers (resources/js/actions, routes, wayfinder) are gitignored generated code and are absent at the pin; no arm runs code generation."
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; Ambiguous. Read literally ('which frontend files must be re-read'), the question could include the child components the props are forwarded to. The hop-1 reading gives {Inbox.vue}; the transitive reading adds GlobalRail.vue and PaginationControls.vue.
Reader on the oracle's open list: Followed Inertia page resolution: 'Inbox' -> resources/js/pages/Inbox.vue. The layout resolver gives Inbox no layout.

Candidate files (6):

* resources/js/pages/Inbox.vue  {"proposed_by_reader": true, "reader_reason": "Inertia::render('Inbox') resolves to pages/Inbox.vue, whose defineProps receives the props"}
--- app/Http/Controllers/InboxController.php:48-54
   48              );
   49          }
   50  
   51          return Inertia::render('Inbox', [
   52              'project' => [
   53                  'name' => $project->name,
   54                  'slug' => $project->slug,
--- resources/js/pages/Inbox.vue:78-84
   78      at_human: string | null;
   79  };
   80  
   81  const props = defineProps<{
   82      project: {
   83          name: string;
   84          slug: string;

* resources/js/components/GlobalRail.vue  {"proposed_by_reader": false, "reader_excluded_because": "hop 2: receives project.path/name/slug, projects and counts.unread (Inbox.vue:1001-1007). It is outside the registered hop-1 stratum; include it if the question is read transitively"}
--- resources/js/components/GlobalRail.vue: none of ['InboxController'] appears in the file

* resources/js/components/PaginationControls.vue  {"proposed_by_reader": false, "reader_excluded_because": "hop 2: receives pagination.* (Inbox.vue:1439-1445). Same caveat"}
--- resources/js/components/PaginationControls.vue: none of ['InboxController'] appears in the file

* resources/js/components/RichTextEditor.vue  {"proposed_by_reader": false, "reader_excluded_because": "bound to form state (replyForm/composeForm), not to controller props"}
--- resources/js/components/RichTextEditor.vue: none of ['InboxController'] appears in the file

* resources/js/app.ts  {"proposed_by_reader": false, "reader_excluded_because": "page and layout resolution. Inbox gets a null layout (app.ts:18-19), so no layout receives the props"}
--- resources/js/app.ts: none of ['InboxController'] appears in the file

* resources/js/routes/projects  {"proposed_by_reader": false, "reader_excluded_because": "generated Wayfinder helper, absent at the pin"}
--- resources/js/routes/projects: FILE NOT FOUND at the pin


========== ITEM ls-e-x-02 ==========
Question (registered, verbatim):
{
 "id": "ls-e-x-02",
 "suite": "E",
 "class": "change-impact-xplane",
 "subject": "larasend",
 "language": "php",
 "target_language": "vue",
 "question": "If the props ActivityController passes to its page change, which frontend files must be re-read (page and the components it passes them to)?",
 "probe": "ActivityController",
 "hop_stratum": 2,
 "basis": [
  "app/Http/Controllers/ActivityController.php:127 -- Inertia::render('Activity', [...])",
  "resources/js/pages/Activity.vue -- receives the props (hop 1); child components it forwards them to (hop 2)"
 ]
}

Reference engine (oracle) status: human-required; its open list: ["no reference engine emits this relation (registration \u00a7 Truth)"]

Reader notes: answerable_as_registered=True; ActivityController has only one Inertia::render (line 127).
Reader on the oracle's open list: Checked every component Activity.vue imports (DashboardPanel, EmailProviderPanel, GlobalRail, PaginationControls, Toaster) and its bindings. DashboardPanel imports no further components, so hop 3 from it is empty.

Candidate files (9):

* resources/js/pages/Activity.vue  {"proposed_by_reader": true, "reader_reason": "the page that receives the props"}
--- app/Http/Controllers/ActivityController.php:124-130
  124              );
  125          }
  126  
  127          return Inertia::render('Activity', [
  128              'project' => [
  129                  'name' => $project->name,
  130                  'slug' => $project->slug,
--- resources/js/pages/Activity.vue:178-184
  178      onConfirm: () => void;
  179  } | null;
  180  
  181  const props = defineProps<{
  182      project: {
  183          name: string;
  184          slug: string;

* resources/js/components/GlobalRail.vue  {"proposed_by_reader": true, "reader_reason": "receives project.name/slug, section, projects, sidebarCounts and inboxUnread"}
--- resources/js/pages/Activity.vue:1888-1894
 1888          <div
 1889              class="grid h-full min-h-0 grid-cols-1 grid-rows-[60px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)] lg:grid-rows-[64px_minmax(0,1fr)]"
 1890          >
 1891              <GlobalRail
 1892                  :project-path="projectBasePath"
 1893                  :project-name="project.name"
 1894                  :project-slug="project.slug"

* resources/js/components/DashboardPanel.vue  {"proposed_by_reader": true, "reader_reason": "receives metrics, emails, recentThreads, dashboard and system"}
--- resources/js/pages/Activity.vue:2082-2088
 2082                      v-if="section === 'activity' && dashboard"
 2083                      class="min-h-0 flex-1 overflow-auto p-3 sm:p-5"
 2084                  >
 2085                      <DashboardPanel
 2086                          :project-slug="project.slug"
 2087                          :metrics="metrics"
 2088                          :emails="emails"

* resources/js/components/EmailProviderPanel.vue  {"proposed_by_reader": true, "reader_reason": "receives source, quota, workspace.can_manage_domains, setup.webhook_url and values derived from domains"}
--- resources/js/pages/Activity.vue:3476-3482
 3476                          </section>
 3477                      </div>
 3478  
 3479                      <EmailProviderPanel
 3480                          v-else-if="section === 'source'"
 3481                          :project-slug="project.slug"
 3482                          :project-path="projectBasePath"

* resources/js/components/PaginationControls.vue  {"proposed_by_reader": true, "reader_reason": "receives emailPagination.*"}
--- resources/js/pages/Activity.vue:2517-2523
 2517                                  </button>
 2518                              </template>
 2519                          </div>
 2520                          <PaginationControls
 2521                              :page="emailPagination.page"
 2522                              :from="emailPagination.from"
 2523                              :to="emailPagination.to"

* resources/js/components/ui/sonner  {"proposed_by_reader": false, "reader_excluded_because": "Toaster is rendered without props (Activity.vue:5715)"}
--- resources/js/components/ui/sonner: FILE NOT FOUND at the pin

* resources/js/app.ts  {"proposed_by_reader": false, "reader_excluded_because": "Activity gets a null layout (app.ts:16-17), so no layout receives the props"}
--- resources/js/app.ts: none of ['ActivityController'] appears in the file

* resources/js/routes/projects  {"proposed_by_reader": false, "reader_excluded_because": "generated Wayfinder helper, absent at the pin"}
--- resources/js/routes/projects: FILE NOT FOUND at the pin

* resources/js/routes/workspace-members/ownership  {"proposed_by_reader": false, "reader_excluded_because": "generated Wayfinder helper, absent at the pin"}
--- resources/js/routes/workspace-members/ownership: FILE NOT FOUND at the pin