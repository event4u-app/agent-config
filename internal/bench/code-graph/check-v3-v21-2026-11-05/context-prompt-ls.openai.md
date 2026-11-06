You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


These edges come back with more context: the source file's imports, the declarations of the receiver the call goes through, and route registration / group prefixes where routes are involved.


Subject: `larasend` at its registered pin.



===== EDGE E08d7a3aed1 =====
{"id": "E08d7a3aed1", "from": "database/seeders/InboxDemoSeeder.php:209", "to_symbol": "ThreadResolver::attachOutbound", "to": "app/Services/ThreadResolver.php:49", "kind": "call"}
--- database/seeders/InboxDemoSeeder.php:207-211
  207          $email->recipients()->create(['type' => 'to', 'email' => $to]);
  208  
  209          $resolver->attachOutbound($email);
  210  
  211          return $email;
--- app/Services/ThreadResolver.php:47-51
   47      }
   48  
   49      public function attachOutbound(Email $email): Thread
   50      {
   51          $email->loadMissing('recipients');
--- database/seeders/InboxDemoSeeder.php (imports)
    3  namespace Database\Seeders;
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Models\Project;
    8  use App\Services\ThreadResolver;
    9  use Illuminate\Database\Seeder;
   10  use Illuminate\Support\Carbon;
   11  use Illuminate\Support\Facades\Storage;
   12  use Illuminate\Support\Str;
--- database/seeders/InboxDemoSeeder.php (declarations of resolver)
   22      public function __construct(private ThreadResolver $resolver) {}


===== EDGE E505da826c8 =====
{"id": "E505da826c8", "from": "tests/Feature/ApiEmailTest.php:438", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Suppression::create with email"}
--- tests/Feature/ApiEmailTest.php:436-440
  436      Queue::fake();
  437  
  438      Suppression::create([
  439          'workspace_id' => $workspace->id,
  440          'project_id' => $project->id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/ApiEmailTest.php (imports)
    3  use App\Jobs\RecoverStuckQueuedEmails;
    4  use App\Jobs\SendQueuedEmail;
    5  use App\Models\ApiKey;
    6  use App\Models\Email;
    7  use App\Models\Project;
    8  use App\Models\Source;
    9  use App\Models\Suppression;
   10  use App\Models\User;
   11  use App\Models\Workspace;
   12  use App\Services\EmailSendService;
   13  use App\Services\Providers\EmailProviderFactory;
   14  use App\Services\SesV2Client;
   15  use Illuminate\Cache\RateLimiter as CacheRateLimiter;
   16  use Illuminate\Console\Scheduling\Schedule;
   17  use Illuminate\Contracts\Bus\Dispatcher;
   18  use Illuminate\Contracts\Queue\ShouldBeUnique;
   19  use Illuminate\Database\QueryException;
   20  use Illuminate\Http\Client\Request;
   21  use Illuminate\Http\Request as HttpRequest;
   22  use Illuminate\Support\Facades\Http;
   23  use Illuminate\Support\Facades\Queue;
   24  use Illuminate\Support\Facades\Storage;
   25  use Illuminate\Validation\ValidationException;


===== EDGE Ee4efe76a53 =====
{"id": "Ee4efe76a53", "from": "app/Services/EmailSendService.php:242", "to_symbol": "MimeMessageBuilder::splitAddress", "to": "app/Services/MimeMessageBuilder.php:84", "kind": "call", "note": "ensureRecipientsAreSendable (line 237)"}
--- app/Services/EmailSendService.php:240-244
  240              ->flatMap(fn (string $type) => $payload[$type] ?? [])
  241              ->map(fn (string $recipient): string => Suppression::normalizeEmail(
  242                  $this->mimeBuilder->splitAddress($recipient)['email'],
  243              ))
  244              ->filter()
--- app/Services/MimeMessageBuilder.php:82-86
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of mimeBuilder)
   25          private MimeMessageBuilder $mimeBuilder,
   49          $mime = $this->mimeBuilder->build(
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   96                          $address = $this->mimeBuilder->splitAddress($recipient);


===== EDGE E12b7ac6a91 =====
{"id": "E12b7ac6a91", "from": "resources/js/pages/Activity.vue:1306", "to_symbol": "PUT {project}/webhooks/{endpoint}", "to": "routes/web.php:61", "kind": "route", "note": "router.put via projectAction"}
--- resources/js/pages/Activity.vue:1304-1308
 1304  
 1305      if (editingWebhookId.value) {
 1306          router.put(
 1307              projectAction(`/webhooks/${editingWebhookId.value}`),
 1308              webhookForm,
--- routes/web.php:59-63
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E3582417500 =====
{"id": "E3582417500", "from": "resources/js/pages/Activity.vue:1351", "to_symbol": "POST {project}/emails/{email}/resend", "to": "routes/web.php:64", "kind": "route", "note": "router.post via projectAction"}
--- resources/js/pages/Activity.vue:1349-1353
 1349      }
 1350  
 1351      router.post(
 1352          projectAction(`/emails/${selected.value.id}/resend`),
 1353          {},
--- routes/web.php:62-66
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   66          Route::post('threads/{thread:public_id}/read', [ThreadActionController::class, 'read'])->name('threads.read');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E7948eaefb8 =====
{"id": "E7948eaefb8", "from": "database/seeders/DatabaseSeeder.php:78", "to_symbol": "InboxDemoSeeder::seed", "to": "database/seeders/InboxDemoSeeder.php:40", "kind": "call"}
--- database/seeders/DatabaseSeeder.php:76-80
   76              $this->seedWebhooks($demoProject);
   77              $this->seedEmails($workspace, $demoProject, $source, $templates);
   78              $this->inboxDemoSeeder->seed($demoProject);
   79          }
   80      }
--- database/seeders/InboxDemoSeeder.php:38-42
   38      }
   39  
   40      public function seed(Project $project): void
   41      {
   42          $owner = $project->workspace->users()->first();
--- database/seeders/DatabaseSeeder.php (imports)
    3  namespace Database\Seeders;
    5  use App\Models\ApiKey;
    6  use App\Models\Domain;
    7  use App\Models\Email;
    8  use App\Models\InboundEmail;
    9  use App\Models\Project;
   10  use App\Models\Source;
   11  use App\Models\Template;
   12  use App\Models\User;
   13  use App\Models\WebhookEndpoint;
   14  use App\Models\Workspace;
   15  use Illuminate\Database\Seeder;
   16  use Illuminate\Support\Carbon;
   17  use Illuminate\Support\Facades\Hash;
   18  use Illuminate\Support\Facades\Storage;
   19  use Illuminate\Support\Str;
   20  use RuntimeException;
--- database/seeders/DatabaseSeeder.php (declarations of inboxDemoSeeder)
   24      public function __construct(private InboxDemoSeeder $inboxDemoSeeder) {}


===== EDGE Ee562fde546 =====
{"id": "Ee562fde546", "from": "resources/js/app.ts:27", "to_symbol": "AppLayout", "to": "resources/js/layouts/AppLayout.vue:1", "kind": "framework", "note": "Inertia createInertiaApp layout resolver returns AppLayout (default case)"}
--- resources/js/app.ts:25-29
   25                  return SettingsLayout;
   26              default:
   27                  return AppLayout;
   28          }
   29      },
--- resources/js/layouts/AppLayout.vue:1-3
    1  <script setup lang="ts">
    2  import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
    3  import type { BreadcrumbItem } from '@/types';
--- resources/js/app.ts (imports)
    1  import { createInertiaApp } from '@inertiajs/vue3';
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
    6  import { initializeFlashToast } from '@/lib/flashToast';


===== EDGE Ea7b65ecf4e =====
{"id": "Ea7b65ecf4e", "from": "resources/js/pages/Inbox.vue:743", "to_symbol": "POST {project}/threads/{thread}/forward", "to": "routes/web.php:71", "kind": "route", "note": "Inertia form post"}
--- resources/js/pages/Inbox.vue:741-745
  741      }
  742  
  743      forwardForm.post(
  744          `${props.project.path}/threads/${props.selectedThread.public_id}/forward`,
  745          {
--- routes/web.php:69-73
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
   73          Route::post('threads/{thread:public_id}/unsnooze', [ThreadActionController::class, 'unsnooze'])->name('threads.unsnooze');
--- resources/js/pages/Inbox.vue (imports)
    2  import { Head, Link, router, useForm, usePoll } from '@inertiajs/vue3';
    3  import {
   27  import {
   35  import GlobalRail from '@/components/GlobalRail.vue';
   36  import PaginationControls from '@/components/PaginationControls.vue';
   37  import RichTextEditor from '@/components/RichTextEditor.vue';
   38  import { Toaster } from '@/components/ui/sonner';
   39  import { inbox as inboxRoute } from '@/routes/projects';
 2206                          required
 2222                          required
 2374                          required
--- resources/js/pages/Inbox.vue (declarations of forwardForm)
  736  const forwardForm = useForm({ to: '', text: '' });
 2372                          v-model="forwardForm.to"
 2379                          v-if="forwardForm.errors.to"
 2388                          v-model="forwardForm.text"
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E1caccd7839 =====
{"id": "E1caccd7839", "from": "app/Services/SuppressionRemovalService.php:48", "to_symbol": "CloudflareApiClient::listStableSuppressions", "to": "app/Services/CloudflareApiClient.php:97", "kind": "call"}
--- app/Services/SuppressionRemovalService.php:46-50
   46  
   47          try {
   48              $upstreamSuppressions = $this->cloudflare->listStableSuppressions(
   49                  $source,
   50                  self::CLOUDFLARE_SNAPSHOT_BUDGET_SECONDS,
--- app/Services/CloudflareApiClient.php:95-99
   95       * @return array<int, array{id: string, email: string, reason: string, created_at: string|null, expires_at: string|null}>
   96       */
   97      public function listStableSuppressions(Source $source, float $budgetSeconds): array
   98      {
   99          if ($budgetSeconds <= 0) {
--- app/Services/SuppressionRemovalService.php (imports)
    3  namespace App\Services;
    5  use App\Enums\SourceProvider;
    6  use App\Exceptions\SuppressionProviderUnavailableException;
    7  use App\Exceptions\SuppressionRemovalException;
    8  use App\Models\Suppression;
    9  use Throwable;
--- app/Services/SuppressionRemovalService.php (declarations of cloudflare)
   17          private CloudflareApiClient $cloudflare,
   48              $upstreamSuppressions = $this->cloudflare->listStableSuppressions(


===== EDGE Eef70dccacb =====
{"id": "Eef70dccacb", "from": "resources/js/layouts/settings/Layout.vue:146", "to_symbol": "isCurrentOrParentUrl", "to": "resources/js/composables/useCurrentUrl.ts:61", "kind": "call", "note": "from useCurrentUrl() at line 49"}
--- resources/js/layouts/settings/Layout.vue:144-148
  144                              :class="{
  145                                  'text-zinc-950 after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full after:bg-teal-400 dark:text-zinc-100':
  146                                      isCurrentOrParentUrl(item.href),
  147                              }"
  148                          >
--- resources/js/composables/useCurrentUrl.ts:59-63
   59      }
   60  
   61      function isCurrentOrParentUrl(
   62          urlToCheck: NonNullable<InertiaLinkProps['href']>,
   63          currentUrl?: string,
--- resources/js/layouts/settings/Layout.vue (imports)
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { Palette, ShieldCheck, UserRound } from 'lucide-vue-next';
    4  import { computed } from 'vue';
    5  import GlobalRail from '@/components/GlobalRail.vue';
    6  import { Toaster } from '@/components/ui/sonner';
    7  import { useCurrentUrl } from '@/composables/useCurrentUrl';
    8  import { dashboard } from '@/routes';
    9  import { edit as editAppearance } from '@/routes/appearance';
   10  import { edit as editProfile } from '@/routes/profile';
   11  import { section as projectSection } from '@/routes/projects';
   12  import { edit as editSecurity } from '@/routes/security';


===== EDGE E5778c32278 =====
{"id": "E5778c32278", "from": "app/Http/Controllers/Api/SuppressionController.php:28", "to_symbol": "SuppressionRemovalService::remove", "to": "app/Services/SuppressionRemovalService.php:20", "kind": "call"}
--- app/Http/Controllers/Api/SuppressionController.php:26-30
   26  
   27          try {
   28              $removalService->remove($suppression);
   29          } catch (SuppressionProviderUnavailableException $exception) {
   30              return response()->json(['message' => $exception->getMessage()], 503);
--- app/Services/SuppressionRemovalService.php:18-22
   18      ) {}
   19  
   20      public function remove(Suppression $suppression): void
   21      {
   22          $source = $suppression->source;
--- app/Http/Controllers/Api/SuppressionController.php (imports)
    3  namespace App\Http\Controllers\Api;
    5  use App\Exceptions\SuppressionProviderUnavailableException;
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Controllers\Controller;
    8  use App\Models\Project;
    9  use App\Models\Suppression;
   10  use App\Services\SuppressionRemovalService;
   11  use Illuminate\Http\JsonResponse;
   12  use Illuminate\Http\Request;
   13  use Illuminate\Http\Response;


===== EDGE Ef587aa8f62 =====
{"id": "Ef587aa8f62", "from": "app/Http/Controllers/Webhooks/CloudflareInboundController.php:87", "to_symbol": "InboundEmailIngestor::ingest", "to": "app/Services/InboundEmailIngestor.php:29", "kind": "call"}
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php:85-89
   85  
   86          try {
   87              $inbound = $ingestor->ingest($source, $validated['from'], $validated['to'], $mime);
   88          } catch (Throwable $exception) {
   89              report($exception);
--- app/Services/InboundEmailIngestor.php:27-31
   27      ) {}
   28  
   29      public function ingest(Source $source, string $envelopeFrom, string $envelopeTo, string $mime): InboundEmail
   30      {
   31          $project = $source->project;
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php (imports)
    3  namespace App\Http\Controllers\Webhooks;
    5  use App\Enums\SourceProvider;
    6  use App\Http\Controllers\Controller;
    7  use App\Models\Source;
    8  use App\Models\WebhookLog;
    9  use App\Services\InboundEmailIngestor;
   10  use App\Services\Providers\CloudflareInboundProvisioner;
   11  use Illuminate\Http\JsonResponse;
   12  use Illuminate\Http\Request;
   13  use Illuminate\Support\Facades\Validator;
   14  use Illuminate\Support\Str;
   15  use Throwable;
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php (declarations of ingestor)
   87              $inbound = $ingestor->ingest($source, $validated['from'], $validated['to'], $mime);


===== EDGE Edb8875530b =====
{"id": "Edb8875530b", "from": "app/Services/EmailSendService.php:142", "to_symbol": "MimeMessageBuilder::splitAddress", "to": "app/Services/MimeMessageBuilder.php:84", "kind": "call", "note": "ensureSourceCanSend (line 140)"}
--- app/Services/EmailSendService.php:140-144
  140      private function ensureSourceCanSend(Project $project, Source $source, string $from): void
  141      {
  142          if (blank($from) || ! $this->mimeBuilder->splitAddress($from)['email']) {
  143              throw ValidationException::withMessages([
  144                  'from' => 'A valid sender address is required before sending.',
--- app/Services/MimeMessageBuilder.php:82-86
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of mimeBuilder)
   25          private MimeMessageBuilder $mimeBuilder,
   49          $mime = $this->mimeBuilder->build(
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   96                          $address = $this->mimeBuilder->splitAddress($recipient);


===== EDGE Eae54c09c86 =====
{"id": "Eae54c09c86", "from": "database/seeders/InboxDemoSeeder.php:161", "to_symbol": "ThreadResolver::attachInbound", "to": "app/Services/ThreadResolver.php:25", "kind": "call"}
--- database/seeders/InboxDemoSeeder.php:159-163
  159          ]);
  160  
  161          $resolver->attachInbound($inbound);
  162  
  163          return $inbound;
--- app/Services/ThreadResolver.php:23-27
   23      private const SUBJECT_MATCH_WINDOW_DAYS = 60;
   24  
   25      public function attachInbound(InboundEmail $inbound): Thread
   26      {
   27          $participants = array_filter([
--- database/seeders/InboxDemoSeeder.php (imports)
    3  namespace Database\Seeders;
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Models\Project;
    8  use App\Services\ThreadResolver;
    9  use Illuminate\Database\Seeder;
   10  use Illuminate\Support\Carbon;
   11  use Illuminate\Support\Facades\Storage;
   12  use Illuminate\Support\Str;
--- database/seeders/InboxDemoSeeder.php (declarations of resolver)
   22      public function __construct(private ThreadResolver $resolver) {}


===== EDGE Ebe148880de =====
{"id": "Ebe148880de", "from": "tests/Feature/DashboardActionsTest.php:747", "to_symbol": "POST /bounces/retry-soft", "to": "routes/web.php:115", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:745-749
  745  
  746      $this->actingAs($user)
  747          ->post('/bounces/retry-soft')
  748          ->assertRedirect('/bounces')
  749          ->assertInertiaFlash('toast');
--- routes/web.php:113-117
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
  117      Route::get('emails/{email:public_id}/preview', EmailPreviewController::class)->name('emails.preview');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Eadee447480 =====
{"id": "Eadee447480", "from": "tests/Feature/InboxReplyTest.php:72", "to_symbol": "POST /api/webhooks/inbound/cloudflare/{token}", "to": "routes/api.php:22", "kind": "route"}
--- tests/Feature/InboxReplyTest.php:70-74
   70      ], fn ($line) => $line !== null));
   71  
   72      $test->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   73          'from' => 'maya@customer.test',
   74          'to' => 'hello@example.com',
--- routes/api.php:20-24
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
--- tests/Feature/InboxReplyTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\InboundEmail;
    5  use App\Models\Project;
    6  use App\Models\Source;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use Illuminate\Http\UploadedFile;
   11  use Illuminate\Support\Facades\Queue;
   12  use Illuminate\Support\Facades\Storage;
--- tests/Feature/InboxReplyTest.php (declarations of test)
   25          'cloudflare_api_token' => 'cf-test-token',
   44  function receiveReplyableEmail($test, Source $source, string $withAttachment = '', string $messageId = 'q-1@customer.test'): void
   73          'from' => 'maya@customer.test',
  113              'to' => 'lead@customer.test, billing@customer.test',
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE Ee60b2a72c5 =====
{"id": "Ee60b2a72c5", "from": "app/Jobs/SyncCloudflareSourceSuppressions.php:164", "to_symbol": "scopeWhereNormalizedEmail", "to": "app/Models/Suppression.php:56", "kind": "framework", "note": "Eloquent local scope ->whereNormalizedEmail()"}
--- app/Jobs/SyncCloudflareSourceSuppressions.php:162-166
  162      {
  163          return $project->suppressions()
  164              ->whereNormalizedEmail($email)
  165              ->firstOrCreate([], ['email' => $email, ...$values]);
  166      }
--- app/Models/Suppression.php:54-58
   54       * @param  Builder<Suppression>  $query
   55       */
   56      public function scopeWhereNormalizedEmail(Builder $query, string $email): void
   57      {
   58          $query->where($this->normalizedEmailColumn(), self::normalizeEmail($email));
--- app/Jobs/SyncCloudflareSourceSuppressions.php (imports)
    3  namespace App\Jobs;
    5  use App\Enums\SourceProvider;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\Suppression;
    9  use App\Services\CloudflareApiClient;
   10  use Illuminate\Contracts\Queue\ShouldBeUnique;
   11  use Illuminate\Contracts\Queue\ShouldQueue;
   12  use Illuminate\Foundation\Queue\Queueable;
   13  use Illuminate\Queue\Attributes\UniqueFor;
   14  use Illuminate\Support\Carbon;
   15  use Illuminate\Support\Facades\DB;
   16  use RuntimeException;
   17  use Throwable;
   25      use Queueable;


===== EDGE E798dea8f31 =====
{"id": "E798dea8f31", "from": "resources/js/pages/Activity.vue:1319", "to_symbol": "POST {project}/bounces/retry-soft", "to": "routes/web.php:63", "kind": "route", "note": "router.post via projectAction"}
--- resources/js/pages/Activity.vue:1317-1321
 1317  
 1318  function retrySoftBounces(): void {
 1319      router.post(
 1320          projectAction('/bounces/retry-soft'),
 1321          {},
--- routes/web.php:61-65
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Ec85e969734 =====
{"id": "Ec85e969734", "from": "resources/js/layouts/app/AppHeaderLayout.vue:19", "to_symbol": "AppHeader", "to": "resources/js/components/AppHeader.vue:1", "kind": "component"}
--- resources/js/layouts/app/AppHeaderLayout.vue:17-21
   17  <template>
   18      <AppShell variant="header">
   19          <AppHeader :breadcrumbs="breadcrumbs" />
   20          <AppContent variant="header">
   21              <slot />
--- resources/js/components/AppHeader.vue:1-3
    1  <script setup lang="ts">
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { BookOpen, Folder, LayoutGrid, Menu, Search } from 'lucide-vue-next';
--- resources/js/layouts/app/AppHeaderLayout.vue (imports)
    2  import AppContent from '@/components/AppContent.vue';
    3  import AppHeader from '@/components/AppHeader.vue';
    4  import AppShell from '@/components/AppShell.vue';
    5  import { Toaster } from '@/components/ui/sonner';
    6  import type { BreadcrumbItem } from '@/types';


===== EDGE E4676a4c094 =====
{"id": "E4676a4c094", "from": "resources/js/components/AppSidebar.vue:57", "to_symbol": "NavMain", "to": "resources/js/components/NavMain.vue:1", "kind": "component"}
--- resources/js/components/AppSidebar.vue:55-59
   55  
   56          <SidebarContent>
   57              <NavMain :items="mainNavItems" />
   58          </SidebarContent>
   59  
--- resources/js/components/NavMain.vue:1-3
    1  <script setup lang="ts">
    2  import { Link } from '@inertiajs/vue3';
    3  import {
--- resources/js/components/AppSidebar.vue (imports)
    2  import { Link } from '@inertiajs/vue3';
    3  import { BookOpen, FolderGit2, LayoutGrid } from 'lucide-vue-next';
    4  import AppLogo from '@/components/AppLogo.vue';
    5  import NavFooter from '@/components/NavFooter.vue';
    6  import NavMain from '@/components/NavMain.vue';
    7  import NavUser from '@/components/NavUser.vue';
    8  import {
   17  import { dashboard } from '@/routes';
   18  import type { NavItem } from '@/types';


===== EDGE Eec83896bdf =====
{"id": "Eec83896bdf", "from": "app/Http/Controllers/DashboardActionController.php:387", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "sendEmail"}
--- app/Http/Controllers/DashboardActionController.php:385-389
  385          }
  386  
  387          $email = $emailSendService->send($project, $source, $request->validated());
  388  
  389          Inertia::flash('toast', ['type' => 'success', 'message' => "Email queued as {$email->public_id}."]);
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/DashboardActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Enums\SourceProvider;
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Requests\DashboardSendEmailRequest;
    8  use App\Http\Requests\StoreApiKeyRequest;
    9  use App\Http\Requests\StoreDomainRequest;
   10  use App\Http\Requests\StoreTemplateRequest;
   11  use App\Http\Requests\StoreWebhookEndpointRequest;
   12  use App\Http\Requests\UpdateSourceRequest;
   13  use App\Jobs\RecheckPendingDomains;
   14  use App\Models\ApiKey;
   15  use App\Models\Domain;
   16  use App\Models\Email;
   17  use App\Models\Project;
   18  use App\Models\Source;
   19  use App\Models\Suppression;
   20  use App\Models\User;
   21  use App\Models\WebhookEndpoint;
   22  use App\Services\DnsRecordVerifier;
   23  use App\Services\EmailSendService;
   24  use App\Services\Providers\CloudflareInboundProvisioner;
   25  use App\Services\Providers\DomainOnboardingException;
   26  use App\Services\Providers\EmailProviderFactory;
   27  use App\Services\SuppressionRemovalService;
   28  use App\Support\ProjectContext;
--- app/Http/Controllers/DashboardActionController.php (declarations of emailSendService)
  376      public function sendEmail(DashboardSendEmailRequest $request, EmailSendService $emailSendService): RedirectResponse
  387          $email = $emailSendService->send($project, $source, $request->validated());
  394      public function resendEmail(Email $email, EmailSendService $emailSendService): RedirectResponse
  401      public function resendProjectEmail(string $projectSlug, Email $email, EmailSendService $emailSendService): RedirectResponse
--- app/Http/Controllers/DashboardActionController.php (declarations of request)
   44      public function storeDomain(StoreDomainRequest $request): RedirectResponse
   50          $domainName = Str::lower(trim($request->string('domain')->toString()));
   90      public function updateSource(UpdateSourceRequest $request): RedirectResponse
   96          $validated = $request->validated();


===== EDGE E979014cad6 =====
{"id": "E979014cad6", "from": "app/Http/Controllers/ThreadActionController.php:71", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "reply; injected at :26"}
--- app/Http/Controllers/ThreadActionController.php:69-73
   69  
   70          try {
   71              $this->sendService->send($project, $source, [
   72                  'from' => $lastInbound->to_email,
   73                  'to' => [$lastInbound->from_email],
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/ThreadActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Models\InboundEmail;
    6  use App\Models\Project;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Services\EmailSendService;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Http\RedirectResponse;
   12  use Illuminate\Http\Request;
   13  use Illuminate\Http\UploadedFile;
   14  use Illuminate\Support\Facades\Auth;
   15  use Illuminate\Support\Facades\Storage;
   16  use Illuminate\Support\Str;
   17  use Illuminate\Validation\ValidationException;
   18  use Inertia\Inertia;
   19  use Throwable;
   20  use ZBateson\MailMimeParser\MailMimeParser;
--- app/Http/Controllers/ThreadActionController.php (declarations of sendService)
   26          private EmailSendService $sendService,
  132              $email = $this->sendService->send($project, $source, [


===== EDGE Ef457f7389a =====
{"id": "Ef457f7389a", "from": "tests/Feature/DashboardActionsTest.php:601", "to_symbol": "POST /send", "to": "routes/web.php:114", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:599-603
  599  
  600      $this->actingAs($user)
  601          ->post('/send', [
  602              'from' => 'Larasend <receipts@example.com>',
  603              'to' => 'maya@example.com, team@example.com',
--- routes/web.php:112-116
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E0e142c441a =====
{"id": "E0e142c441a", "from": "resources/js/components/AppHeader.vue:218", "to_symbol": "toUrl", "to": "resources/js/lib/utils.ts:10", "kind": "call"}
--- resources/js/components/AppHeader.vue:216-220
  216                                              >
  217                                                  <a
  218                                                      :href="toUrl(item.href)"
  219                                                      target="_blank"
  220                                                      rel="noopener noreferrer"
--- resources/js/lib/utils.ts:8-12
    8  }
    9  
   10  export function toUrl(href: NonNullable<InertiaLinkProps['href']>) {
   11      return typeof href === 'string' ? href : href?.url;
   12  }
--- resources/js/components/AppHeader.vue (imports)
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { BookOpen, Folder, LayoutGrid, Menu, Search } from 'lucide-vue-next';
    4  import { computed } from 'vue';
    5  import AppLogo from '@/components/AppLogo.vue';
    6  import AppLogoIcon from '@/components/AppLogoIcon.vue';
    7  import Breadcrumbs from '@/components/Breadcrumbs.vue';
    8  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    9  import { Button } from '@/components/ui/button';
   10  import {
   15  import {
   21  import {
   28  import {
   34  import UserMenuContent from '@/components/UserMenuContent.vue';
   35  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   36  import { getInitials } from '@/composables/useInitials';
   37  import { toUrl } from '@/lib/utils';
   38  import { dashboard } from '@/routes';
   39  import type { BreadcrumbItem, NavItem } from '@/types';


===== EDGE E3ea92445ce =====
{"id": "E3ea92445ce", "from": "resources/js/pages/Activity.vue:1315", "to_symbol": "POST {project}/webhooks", "to": "routes/web.php:60", "kind": "route", "note": "router.post via projectAction"}
--- resources/js/pages/Activity.vue:1313-1317
 1313      }
 1314  
 1315      router.post(projectAction('/webhooks'), webhookForm, options);
 1316  }
 1317  
--- routes/web.php:58-62
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E222e6922e5 =====
{"id": "E222e6922e5", "from": "resources/js/components/AppSidebar.vue:61", "to_symbol": "NavFooter", "to": "resources/js/components/NavFooter.vue:1", "kind": "component"}
--- resources/js/components/AppSidebar.vue:59-63
   59  
   60          <SidebarFooter>
   61              <NavFooter :items="footerNavItems" />
   62              <NavUser />
   63          </SidebarFooter>
--- resources/js/components/NavFooter.vue:1-3
    1  <script setup lang="ts">
    2  import {
    3      SidebarGroup,
--- resources/js/components/AppSidebar.vue (imports)
    2  import { Link } from '@inertiajs/vue3';
    3  import { BookOpen, FolderGit2, LayoutGrid } from 'lucide-vue-next';
    4  import AppLogo from '@/components/AppLogo.vue';
    5  import NavFooter from '@/components/NavFooter.vue';
    6  import NavMain from '@/components/NavMain.vue';
    7  import NavUser from '@/components/NavUser.vue';
    8  import {
   17  import { dashboard } from '@/routes';
   18  import type { NavItem } from '@/types';


===== EDGE E0f70663c39 =====
{"id": "E0f70663c39", "from": "app/Http/Controllers/DashboardActionController.php:457", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "retrySoftBounces"}
--- app/Http/Controllers/DashboardActionController.php:455-459
  455                  }
  456  
  457                  $emailSendService->send($project, $email->source, $this->payloadForRetry($email));
  458                  $retried++;
  459              });
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/DashboardActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Enums\SourceProvider;
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Requests\DashboardSendEmailRequest;
    8  use App\Http\Requests\StoreApiKeyRequest;
    9  use App\Http\Requests\StoreDomainRequest;
   10  use App\Http\Requests\StoreTemplateRequest;
   11  use App\Http\Requests\StoreWebhookEndpointRequest;
   12  use App\Http\Requests\UpdateSourceRequest;
   13  use App\Jobs\RecheckPendingDomains;
   14  use App\Models\ApiKey;
   15  use App\Models\Domain;
   16  use App\Models\Email;
   17  use App\Models\Project;
   18  use App\Models\Source;
   19  use App\Models\Suppression;
   20  use App\Models\User;
   21  use App\Models\WebhookEndpoint;
   22  use App\Services\DnsRecordVerifier;
   23  use App\Services\EmailSendService;
   24  use App\Services\Providers\CloudflareInboundProvisioner;
   25  use App\Services\Providers\DomainOnboardingException;
   26  use App\Services\Providers\EmailProviderFactory;
   27  use App\Services\SuppressionRemovalService;
   28  use App\Support\ProjectContext;
--- app/Http/Controllers/DashboardActionController.php (declarations of emailSendService)
  376      public function sendEmail(DashboardSendEmailRequest $request, EmailSendService $emailSendService): RedirectResponse
  387          $email = $emailSendService->send($project, $source, $request->validated());
  394      public function resendEmail(Email $email, EmailSendService $emailSendService): RedirectResponse
  401      public function resendProjectEmail(string $projectSlug, Email $email, EmailSendService $emailSendService): RedirectResponse


===== EDGE E97c639fd9c =====
{"id": "E97c639fd9c", "from": "resources/js/components/NavFooter.vue:32", "to_symbol": "toUrl", "to": "resources/js/lib/utils.ts:10", "kind": "call"}
--- resources/js/components/NavFooter.vue:30-34
   30                      >
   31                          <a
   32                              :href="toUrl(item.href)"
   33                              target="_blank"
   34                              rel="noopener noreferrer"
--- resources/js/lib/utils.ts:8-12
    8  }
    9  
   10  export function toUrl(href: NonNullable<InertiaLinkProps['href']>) {
   11      return typeof href === 'string' ? href : href?.url;
   12  }
--- resources/js/components/NavFooter.vue (imports)
    2  import {
    9  import { toUrl } from '@/lib/utils';
   10  import type { NavItem } from '@/types';


===== EDGE E873b82d9b5 =====
{"id": "E873b82d9b5", "from": "tests/Feature/InboxReplyTest.php:202", "to_symbol": "POST /projects/{project}/threads/{thread}/forward", "to": "routes/web.php:71", "kind": "route"}
--- tests/Feature/InboxReplyTest.php:200-204
  200  
  201      $this->actingAs($user)
  202          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/forward", [
  203              'to' => 'teammate@example.org',
  204              'text' => 'Can you take this one?',
--- routes/web.php:69-73
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
   73          Route::post('threads/{thread:public_id}/unsnooze', [ThreadActionController::class, 'unsnooze'])->name('threads.unsnooze');
--- tests/Feature/InboxReplyTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\InboundEmail;
    5  use App\Models\Project;
    6  use App\Models\Source;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use Illuminate\Http\UploadedFile;
   11  use Illuminate\Support\Facades\Queue;
   12  use Illuminate\Support\Facades\Storage;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E665238d94f =====
{"id": "E665238d94f", "from": "resources/js/components/AppHeader.vue:131", "to_symbol": "toUrl", "to": "resources/js/lib/utils.ts:10", "kind": "call"}
--- resources/js/components/AppHeader.vue:129-133
  129                                          v-for="item in rightNavItems"
  130                                          :key="item.title"
  131                                          :href="toUrl(item.href)"
  132                                          target="_blank"
  133                                          rel="noopener noreferrer"
--- resources/js/lib/utils.ts:8-12
    8  }
    9  
   10  export function toUrl(href: NonNullable<InertiaLinkProps['href']>) {
   11      return typeof href === 'string' ? href : href?.url;
   12  }
--- resources/js/components/AppHeader.vue (imports)
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { BookOpen, Folder, LayoutGrid, Menu, Search } from 'lucide-vue-next';
    4  import { computed } from 'vue';
    5  import AppLogo from '@/components/AppLogo.vue';
    6  import AppLogoIcon from '@/components/AppLogoIcon.vue';
    7  import Breadcrumbs from '@/components/Breadcrumbs.vue';
    8  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    9  import { Button } from '@/components/ui/button';
   10  import {
   15  import {
   21  import {
   28  import {
   34  import UserMenuContent from '@/components/UserMenuContent.vue';
   35  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   36  import { getInitials } from '@/composables/useInitials';
   37  import { toUrl } from '@/lib/utils';
   38  import { dashboard } from '@/routes';
   39  import type { BreadcrumbItem, NavItem } from '@/types';


===== EDGE E57127119aa =====
{"id": "E57127119aa", "from": "tests/Feature/SuppressionManagementTest.php:50", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Suppression::create with email"}
--- tests/Feature/SuppressionManagementTest.php:48-52
   48  function managedSuppression(Project $project, ?Source $source, string $email = 'blocked@example.com'): Suppression
   49  {
   50      return Suppression::create([
   51          'workspace_id' => $project->workspace_id,
   52          'project_id' => $project->id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/SuppressionManagementTest.php (imports)
    3  use App\Models\ApiKey;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use Illuminate\Http\Client\Request;
   10  use Illuminate\Http\Client\RequestException;
   11  use Illuminate\Support\Carbon;
   12  use Illuminate\Support\Facades\Exceptions;
   13  use Illuminate\Support\Facades\Http;


===== EDGE E810fb2e8f8 =====
{"id": "E810fb2e8f8", "from": "app/Services/InboundEmailIngestor.php:77", "to_symbol": "ThreadResolver::attachInbound", "to": "app/Services/ThreadResolver.php:25", "kind": "call", "note": "injected at :26"}
--- app/Services/InboundEmailIngestor.php:75-79
   75                  ]);
   76  
   77                  $this->threads->attachInbound($inbound);
   78  
   79                  return $inbound;
--- app/Services/ThreadResolver.php:23-27
   23      private const SUBJECT_MATCH_WINDOW_DAYS = 60;
   24  
   25      public function attachInbound(InboundEmail $inbound): Thread
   26      {
   27          $participants = array_filter([
--- app/Services/InboundEmailIngestor.php (imports)
    3  namespace App\Services;
    5  use App\Jobs\DeliverInboundWebhook;
    6  use App\Models\InboundEmail;
    7  use App\Models\Source;
    8  use Illuminate\Support\Facades\DB;
    9  use Illuminate\Support\Facades\Storage;
   10  use Illuminate\Support\Str;
   11  use Throwable;
   12  use ZBateson\MailMimeParser\Header\HeaderConsts;
   13  use ZBateson\MailMimeParser\IMessage;
   14  use ZBateson\MailMimeParser\MailMimeParser;
--- app/Services/InboundEmailIngestor.php (declarations of threads)
   26          private ThreadResolver $threads,


===== EDGE E20ceeabe3d =====
{"id": "E20ceeabe3d", "from": "app/Services/EmailSendService.php:70", "to_symbol": "MimeMessageBuilder::splitAddress", "to": "app/Services/MimeMessageBuilder.php:84", "kind": "call", "note": "inside send (line 34); mimeBuilder injected at :25"}
--- app/Services/EmailSendService.php:68-72
   68          try {
   69              $email = DB::transaction(function () use ($project, $source, $payload, $template, $from, $publicId, $mime, $mimeDisk, $mimePath, $idempotencyKey, $idempotencyHash) {
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   71  
   72                  $email = Email::create([
--- app/Services/MimeMessageBuilder.php:82-86
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of mimeBuilder)
   25          private MimeMessageBuilder $mimeBuilder,
   49          $mime = $this->mimeBuilder->build(
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   96                          $address = $this->mimeBuilder->splitAddress($recipient);


===== EDGE E59951a7797 =====
{"id": "E59951a7797", "from": "tests/Feature/DashboardActionsTest.php:667", "to_symbol": "POST /emails/{email}/resend", "to": "routes/web.php:116", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:665-669
  665  
  666      $this->actingAs($user)
  667          ->post("/emails/{$original->public_id}/resend")
  668          ->assertRedirect('/activity');
  669  
--- routes/web.php:114-118
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
  117      Route::get('emails/{email:public_id}/preview', EmailPreviewController::class)->name('emails.preview');
  118      Route::get('emails/{email:public_id}/mime', EmailMimeController::class)->name('emails.mime');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E1aace1d009 =====
{"id": "E1aace1d009", "from": "tests/Feature/SuppressionManagementTest.php:112", "to_symbol": "DELETE /suppressions/{suppression}", "to": "routes/web.php:95", "kind": "route"}
--- tests/Feature/SuppressionManagementTest.php:110-114
  110  
  111      $this->actingAs($member)
  112          ->delete("/suppressions/{$suppression->id}")
  113          ->assertRedirect('/suppressions');
  114  
--- routes/web.php:93-97
   93      Route::get('complaints', ActivityController::class)->defaults('section', 'complaints')->name('complaints');
   94      Route::get('suppressions', ActivityController::class)->defaults('section', 'suppressions')->name('suppressions');
   95      Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroySuppression'])->name('suppressions.destroy');
   96      Route::get('identities', ActivityController::class)->defaults('section', 'identities')->name('identities');
   97      Route::get('templates', ActivityController::class)->defaults('section', 'templates')->name('templates');
--- tests/Feature/SuppressionManagementTest.php (imports)
    3  use App\Models\ApiKey;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use Illuminate\Http\Client\Request;
   10  use Illuminate\Http\Client\RequestException;
   11  use Illuminate\Support\Carbon;
   12  use Illuminate\Support\Facades\Exceptions;
   13  use Illuminate\Support\Facades\Http;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E83424daf8a =====
{"id": "E83424daf8a", "from": "tests/Feature/SesWebhookTest.php:47", "to_symbol": "POST /api/webhooks/ses/{token}", "to": "routes/api.php:18", "kind": "route"}
--- tests/Feature/SesWebhookTest.php:45-49
   45      ]);
   46  
   47      $this->postJson("/api/webhooks/ses/{$source->webhook_token}", $envelope)->assertSuccessful();
   48  
   49      expect(WebhookLog::query()->where('status', 'confirmed')->exists())->toBeTrue();
--- routes/api.php:16-20
   16  });
   17  
   18  Route::post('webhooks/ses/{token}', SesWebhookController::class)
   19      ->middleware('throttle:120,1')
   20      ->name('webhooks.ses');
--- tests/Feature/SesWebhookTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\WebhookLog;
    9  use App\Models\Workspace;
   10  use App\Services\SesEventNormalizer;
   11  use Illuminate\Support\Facades\DB;
   12  use Illuminate\Support\Facades\Event;
   13  use Illuminate\Support\Facades\Http;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE E20beca397d =====
{"id": "E20beca397d", "from": "resources/js/pages/settings/Appearance.vue:30", "to_symbol": "AppearanceTabs", "to": "resources/js/components/AppearanceTabs.vue:1", "kind": "component"}
--- resources/js/pages/settings/Appearance.vue:28-32
   28              description="Update your account's appearance settings"
   29          />
   30          <AppearanceTabs />
   31      </div>
   32  </template>
--- resources/js/components/AppearanceTabs.vue:1-3
    1  <script setup lang="ts">
    2  import { Monitor, Moon, Sun } from 'lucide-vue-next';
    3  import { useAppearance } from '@/composables/useAppearance';
--- resources/js/pages/settings/Appearance.vue (imports)
    2  import { Head } from '@inertiajs/vue3';
    3  import AppearanceTabs from '@/components/AppearanceTabs.vue';
    4  import Heading from '@/components/Heading.vue';
    5  import { edit } from '@/routes/appearance';


===== EDGE Eb71cab1a24 =====
{"id": "Eb71cab1a24", "from": "tests/Feature/OnboardingTest.php:53", "to_symbol": "POST /onboarding", "to": "routes/web.php:33", "kind": "route"}
--- tests/Feature/OnboardingTest.php:51-55
   51  
   52      $this->actingAs($member)
   53          ->post('/onboarding', [
   54              'credential_mode' => 'configure_later',
   55              'source_name' => 'Compromised',
--- routes/web.php:31-35
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   33      Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
   34      Route::post('onboarding/validate', [OnboardingController::class, 'validateCredentials'])->name('onboarding.validate');
   35      Route::get('projects', ActivityController::class)->defaults('section', 'projects')->name('projects.index');
--- tests/Feature/OnboardingTest.php (imports)
    3  use App\Models\User;
    4  use App\Support\ProjectContext;
    5  use Illuminate\Support\Facades\Http;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E50eabd1d1d =====
{"id": "E50eabd1d1d", "from": "app/Http/Controllers/Api/EmailController.php:80", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call"}
--- app/Http/Controllers/Api/EmailController.php:78-82
   78  
   79          try {
   80              $email = $emailSendService->send($project, $source, $payload, $idempotencyKey, $idempotencyHash);
   81          } catch (QueryException $exception) {
   82              if ($idempotencyKey === null || ! $this->isUniqueConstraintViolation($exception)) {
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/Api/EmailController.php (imports)
    3  namespace App\Http\Controllers\Api;
    5  use App\Http\Controllers\Controller;
    6  use App\Http\Requests\SendEmailRequest;
    7  use App\Jobs\SendQueuedEmail;
    8  use App\Models\Email;
    9  use App\Models\Project;
   10  use App\Models\Source;
   11  use App\Services\EmailSendService;
   12  use Illuminate\Database\QueryException;
   13  use Illuminate\Http\JsonResponse;
   14  use Illuminate\Http\Request;
--- app/Http/Controllers/Api/EmailController.php (declarations of emailSendService)
   40      public function store(SendEmailRequest $request, EmailSendService $emailSendService): JsonResponse
   80              $email = $emailSendService->send($project, $source, $payload, $idempotencyKey, $idempotencyHash);


===== EDGE Ed5daee3626 =====
{"id": "Ed5daee3626", "from": "tests/Feature/DashboardActionsTest.php:501", "to_symbol": "POST /webhooks", "to": "routes/web.php:112", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:499-503
  499  
  500      $this->actingAs($user)
  501          ->post('/webhooks', [
  502              'url' => 'https://example.com/webhooks/larasend',
  503              'events' => ['delivery', 'bounce', 'complaint'],
--- routes/web.php:110-114
  110      Route::post('api-keys/{apiKey}/rotate', [DashboardActionController::class, 'rotateApiKey'])->name('api-keys.rotate');
  111      Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Ec9d86bd754 =====
{"id": "Ec9d86bd754", "from": "tests/Feature/SuppressionManagementTest.php:315", "to_symbol": "DELETE /api/suppressions/{suppression}", "to": "routes/api.php:15", "kind": "route"}
--- tests/Feature/SuppressionManagementTest.php:313-317
  313  
  314      $this->withToken($readKey['plain_text'])
  315          ->deleteJson("/api/suppressions/{$suppression->id}")
  316          ->assertForbidden()
  317          ->assertJsonPath('message', 'This Larasend API key is missing the manage:suppressions scope.');
--- routes/api.php:13-17
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
   16  });
   17  
--- tests/Feature/SuppressionManagementTest.php (imports)
    3  use App\Models\ApiKey;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use Illuminate\Http\Client\Request;
   10  use Illuminate\Http\Client\RequestException;
   11  use Illuminate\Support\Carbon;
   12  use Illuminate\Support\Facades\Exceptions;
   13  use Illuminate\Support\Facades\Http;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE E2efcba9b12 =====
{"id": "E2efcba9b12", "from": "resources/js/pages/Inbox.vue:680", "to_symbol": "POST {project}/threads/{thread}/reply", "to": "routes/web.php:70", "kind": "route", "note": "Inertia form post"}
--- resources/js/pages/Inbox.vue:678-682
  678      const thread = props.selectedThread.public_id;
  679  
  680      replyForm.post(`${props.project.path}/threads/${thread}/reply`, {
  681          preserveScroll: true,
  682          onSuccess: () => {
--- routes/web.php:68-72
   68          Route::post('threads/{thread:public_id}/archive', [ThreadActionController::class, 'archive'])->name('threads.archive');
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
--- resources/js/pages/Inbox.vue (imports)
    2  import { Head, Link, router, useForm, usePoll } from '@inertiajs/vue3';
    3  import {
   27  import {
   35  import GlobalRail from '@/components/GlobalRail.vue';
   36  import PaginationControls from '@/components/PaginationControls.vue';
   37  import RichTextEditor from '@/components/RichTextEditor.vue';
   38  import { Toaster } from '@/components/ui/sonner';
   39  import { inbox as inboxRoute } from '@/routes/projects';
 2206                          required
 2222                          required
 2374                          required
--- resources/js/pages/Inbox.vue (declarations of replyForm)
  663  const replyForm = useForm({
  878          replyForm.text = draft?.text ?? '';
  879          replyForm.html = draft?.html ?? '';
  880          replyForm.attachments = [];
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E7bda04878a =====
{"id": "E7bda04878a", "from": "app/Services/EmailSendService.php:254", "to_symbol": "scopeWhereNormalizedEmailIn", "to": "app/Models/Suppression.php:65", "kind": "framework", "note": "Eloquent local scope"}
--- app/Services/EmailSendService.php:252-256
  252          $suppressed = $project->suppressions()
  253              ->active()
  254              ->whereNormalizedEmailIn($recipients)
  255              ->pluck('email')
  256              ->map(fn (string $email): string => Suppression::normalizeEmail($email))
--- app/Models/Suppression.php:63-67
   63       * @param  iterable<int, string>  $emails
   64       */
   65      public function scopeWhereNormalizedEmailIn(Builder $query, iterable $emails): void
   66      {
   67          $query->whereIn($this->normalizedEmailColumn(), $this->normalizeEmails($emails));
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;


===== EDGE E536d48070e =====
{"id": "E536d48070e", "from": "resources/js/pages/Activity.vue:1257", "to_symbol": "DELETE {project}/suppressions/{suppression}", "to": "routes/web.php:59", "kind": "route", "note": "router.delete via projectAction"}
--- resources/js/pages/Activity.vue:1255-1259
 1255  
 1256              removingSuppressionId.value = suppression.id;
 1257              router.delete(projectAction(`/suppressions/${suppression.id}`), {
 1258                  preserveScroll: true,
 1259                  onFinish: () => {
--- routes/web.php:57-61
   57          Route::post('api-keys/{apiKey}/rotate', [DashboardActionController::class, 'rotateApiKey'])->name('api-keys.rotate');
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E80c25e3d32 =====
{"id": "E80c25e3d32", "from": "app/Http/Controllers/DashboardActionController.php:331", "to_symbol": "SuppressionRemovalService::remove", "to": "app/Services/SuppressionRemovalService.php:20", "kind": "call", "note": "deleteSuppression"}
--- app/Http/Controllers/DashboardActionController.php:329-333
  329  
  330          try {
  331              $removalService->remove($suppression);
  332          } catch (SuppressionRemovalException $exception) {
  333              Inertia::flash('toast', ['type' => 'error', 'message' => $exception->getMessage()]);
--- app/Services/SuppressionRemovalService.php:18-22
   18      ) {}
   19  
   20      public function remove(Suppression $suppression): void
   21      {
   22          $source = $suppression->source;
--- app/Http/Controllers/DashboardActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Enums\SourceProvider;
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Requests\DashboardSendEmailRequest;
    8  use App\Http\Requests\StoreApiKeyRequest;
    9  use App\Http\Requests\StoreDomainRequest;
   10  use App\Http\Requests\StoreTemplateRequest;
   11  use App\Http\Requests\StoreWebhookEndpointRequest;
   12  use App\Http\Requests\UpdateSourceRequest;
   13  use App\Jobs\RecheckPendingDomains;
   14  use App\Models\ApiKey;
   15  use App\Models\Domain;
   16  use App\Models\Email;
   17  use App\Models\Project;
   18  use App\Models\Source;
   19  use App\Models\Suppression;
   20  use App\Models\User;
   21  use App\Models\WebhookEndpoint;
   22  use App\Services\DnsRecordVerifier;
   23  use App\Services\EmailSendService;
   24  use App\Services\Providers\CloudflareInboundProvisioner;
   25  use App\Services\Providers\DomainOnboardingException;
   26  use App\Services\Providers\EmailProviderFactory;
   27  use App\Services\SuppressionRemovalService;
   28  use App\Support\ProjectContext;


===== EDGE E3755a27993 =====
{"id": "E3755a27993", "from": "resources/js/pages/Inbox.vue:713", "to_symbol": "POST {project}/inbox/compose", "to": "routes/web.php:76", "kind": "route", "note": "Inertia form post"}
--- resources/js/pages/Inbox.vue:711-715
  711  
  712  function sendCompose(): void {
  713      composeForm.post(`${props.project.path}/inbox/compose`, {
  714          onSuccess: () => {
  715              composeForm.reset();
--- routes/web.php:74-78
   74          Route::post('threads/{thread:public_id}/notes', [ThreadActionController::class, 'storeNote'])->name('threads.notes.store');
   75          Route::patch('threads/{thread:public_id}/workflow', [ThreadActionController::class, 'updateWorkflow'])->name('threads.workflow.update');
   76          Route::post('inbox/compose', [ThreadActionController::class, 'compose'])->name('inbox.compose');
   77          Route::post('inbox/bulk', [ThreadActionController::class, 'bulk'])->name('inbox.bulk');
   78          Route::get('inbound/{inboundEmail:public_id}/attachments/{index}', InboundAttachmentController::class)
--- resources/js/pages/Inbox.vue (imports)
    2  import { Head, Link, router, useForm, usePoll } from '@inertiajs/vue3';
    3  import {
   27  import {
   35  import GlobalRail from '@/components/GlobalRail.vue';
   36  import PaginationControls from '@/components/PaginationControls.vue';
   37  import RichTextEditor from '@/components/RichTextEditor.vue';
   38  import { Toaster } from '@/components/ui/sonner';
   39  import { inbox as inboxRoute } from '@/routes/projects';
 2206                          required
 2222                          required
 2374                          required
--- resources/js/pages/Inbox.vue (declarations of composeForm)
  701  const composeForm = useForm({
  731      composeForm.subject = template.subject;
  732      composeForm.html = template.html ?? '';
  733      composeForm.text = template.text ?? '';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E4d255e3744 =====
{"id": "E4d255e3744", "from": "resources/js/layouts/app/AppSidebarLayout.vue:20", "to_symbol": "AppSidebar", "to": "resources/js/components/AppSidebar.vue:1", "kind": "component"}
--- resources/js/layouts/app/AppSidebarLayout.vue:18-22
   18  <template>
   19      <AppShell variant="sidebar">
   20          <AppSidebar />
   21          <AppContent variant="sidebar" class="overflow-x-hidden">
   22              <AppSidebarHeader :breadcrumbs="breadcrumbs" />
--- resources/js/components/AppSidebar.vue:1-3
    1  <script setup lang="ts">
    2  import { Link } from '@inertiajs/vue3';
    3  import { BookOpen, FolderGit2, LayoutGrid } from 'lucide-vue-next';
--- resources/js/layouts/app/AppSidebarLayout.vue (imports)
    2  import AppContent from '@/components/AppContent.vue';
    3  import AppShell from '@/components/AppShell.vue';
    4  import AppSidebar from '@/components/AppSidebar.vue';
    5  import AppSidebarHeader from '@/components/AppSidebarHeader.vue';
    6  import { Toaster } from '@/components/ui/sonner';
    7  import type { BreadcrumbItem } from '@/types';


===== EDGE E8ef606c75a =====
{"id": "E8ef606c75a", "from": "tests/Feature/DashboardActionsTest.php:533", "to_symbol": "POST /projects/{project}/webhooks", "to": "routes/web.php:60", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:531-535
  531  
  532      $this->actingAs($user)
  533          ->post("/projects/{$project->slug}/webhooks", [
  534              'url' => $url,
  535              'events' => ['delivery'],
--- routes/web.php:58-62
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Ea788709375 =====
{"id": "Ea788709375", "from": "app/Services/EmailSendService.php:113", "to_symbol": "ThreadResolver::attachOutbound", "to": "app/Services/ThreadResolver.php:49", "kind": "call", "note": "injected at :27"}
--- app/Services/EmailSendService.php:111-115
  111                  }
  112  
  113                  $this->threads->attachOutbound($email);
  114  
  115                  return $email->load(['recipients', 'events', 'attachments', 'source', 'template']);
--- app/Services/ThreadResolver.php:47-51
   47      }
   48  
   49      public function attachOutbound(Email $email): Thread
   50      {
   51          $email->loadMissing('recipients');
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of threads)
   27          private ThreadResolver $threads,


===== EDGE E8934cef55e =====
{"id": "E8934cef55e", "from": "resources/js/components/AppHeader.vue:183", "to_symbol": "isCurrentUrl", "to": "resources/js/composables/useCurrentUrl.ts:37", "kind": "call", "note": "from useCurrentUrl() at line 51"}
--- resources/js/components/AppHeader.vue:181-185
  181                                  </Link>
  182                                  <div
  183                                      v-if="isCurrentUrl(item.href)"
  184                                      class="absolute bottom-0 left-0 h-0.5 w-full translate-y-px bg-black dark:bg-white"
  185                                  ></div>
--- resources/js/composables/useCurrentUrl.ts:35-39
   35  
   36  export function useCurrentUrl(): UseCurrentUrlReturn {
   37      function isCurrentUrl(
   38          urlToCheck: NonNullable<InertiaLinkProps['href']>,
   39          currentUrl?: string,
--- resources/js/components/AppHeader.vue (imports)
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { BookOpen, Folder, LayoutGrid, Menu, Search } from 'lucide-vue-next';
    4  import { computed } from 'vue';
    5  import AppLogo from '@/components/AppLogo.vue';
    6  import AppLogoIcon from '@/components/AppLogoIcon.vue';
    7  import Breadcrumbs from '@/components/Breadcrumbs.vue';
    8  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    9  import { Button } from '@/components/ui/button';
   10  import {
   15  import {
   21  import {
   28  import {
   34  import UserMenuContent from '@/components/UserMenuContent.vue';
   35  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   36  import { getInitials } from '@/composables/useInitials';
   37  import { toUrl } from '@/lib/utils';
   38  import { dashboard } from '@/routes';
   39  import type { BreadcrumbItem, NavItem } from '@/types';


===== EDGE Edd4ccb9e58 =====
{"id": "Edd4ccb9e58", "from": "app/Http/Controllers/Webhooks/SesWebhookController.php:61", "to_symbol": "SesEventNormalizer::record", "to": "app/Services/SesEventNormalizer.php:21", "kind": "call"}
--- app/Http/Controllers/Webhooks/SesWebhookController.php:59-63
   59          }
   60  
   61          $normalizer->record($source, $eventPayload, is_string($payload['MessageId'] ?? null) ? $payload['MessageId'] : null);
   62          $log->forceFill(['status' => 'processed'])->save();
   63  
--- app/Services/SesEventNormalizer.php:19-23
   19       * @param  array<string, mixed>  $payload
   20       */
   21      public function record(Source $source, array $payload, ?string $providerMessageId = null): ?EmailEvent
   22      {
   23          $message = $payload['mail'] ?? [];
--- app/Http/Controllers/Webhooks/SesWebhookController.php (imports)
    3  namespace App\Http\Controllers\Webhooks;
    5  use App\Http\Controllers\Controller;
    6  use App\Models\Source;
    7  use App\Models\WebhookLog;
    8  use App\Services\SesEventNormalizer;
    9  use App\Services\SnsSignatureVerifier;
   10  use Illuminate\Http\JsonResponse;
   11  use Illuminate\Http\Request;
   12  use Illuminate\Support\Facades\Http;
   13  use Illuminate\Support\Str;
--- app/Http/Controllers/Webhooks/SesWebhookController.php (declarations of normalizer)
   17      public function __invoke(Request $request, string $token, SesEventNormalizer $normalizer, SnsSignatureVerifier $signatureVerifier): JsonResponse


===== EDGE Ecf054fcc02 =====
{"id": "Ecf054fcc02", "from": "tests/Feature/InboxReplyTest.php:112", "to_symbol": "POST /projects/{project}/inbox/compose", "to": "routes/web.php:76", "kind": "route"}
--- tests/Feature/InboxReplyTest.php:110-114
  110  
  111      $this->actingAs($user)
  112          ->post("/projects/{$project->slug}/inbox/compose", [
  113              'to' => 'lead@customer.test, billing@customer.test',
  114              'cc' => 'sales@customer.test, owner@customer.test',
--- routes/web.php:74-78
   74          Route::post('threads/{thread:public_id}/notes', [ThreadActionController::class, 'storeNote'])->name('threads.notes.store');
   75          Route::patch('threads/{thread:public_id}/workflow', [ThreadActionController::class, 'updateWorkflow'])->name('threads.workflow.update');
   76          Route::post('inbox/compose', [ThreadActionController::class, 'compose'])->name('inbox.compose');
   77          Route::post('inbox/bulk', [ThreadActionController::class, 'bulk'])->name('inbox.bulk');
   78          Route::get('inbound/{inboundEmail:public_id}/attachments/{index}', InboundAttachmentController::class)
--- tests/Feature/InboxReplyTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\InboundEmail;
    5  use App\Models\Project;
    6  use App\Models\Source;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use Illuminate\Http\UploadedFile;
   11  use Illuminate\Support\Facades\Queue;
   12  use Illuminate\Support\Facades\Storage;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E63f4f7ba5d =====
{"id": "E63f4f7ba5d", "from": "tests/Feature/CloudflareSendTest.php:97", "to_symbol": "POST /api/emails", "to": "routes/api.php:13", "kind": "route"}
--- tests/Feature/CloudflareSendTest.php:95-99
   95      Queue::fake();
   96  
   97      $this->withToken($token)->postJson('/api/emails', [
   98          'from' => 'Larasend <receipts@example.com>',
   99          'to' => ['Maya <maya@example.com>'],
--- routes/api.php:11-15
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
--- tests/Feature/CloudflareSendTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use App\Services\Providers\CloudflareEmailProvider;
   11  use App\Services\Providers\CloudflareSmtpTransportFactory;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Support\Facades\Queue;
   14  use Symfony\Component\Mailer\Envelope;
   15  use Symfony\Component\Mailer\Exception\TransportException;
   16  use Symfony\Component\Mailer\SentMessage;
   17  use Symfony\Component\Mailer\Transport\TransportInterface;
   18  use Symfony\Component\Mime\RawMessage;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE E688ddf04a0 =====
{"id": "E688ddf04a0", "from": "resources/js/pages/Onboarding.vue:346", "to_symbol": "POST /onboarding", "to": "routes/web.php:33", "kind": "route", "note": "Inertia form post"}
--- resources/js/pages/Onboarding.vue:344-348
  344  
  345  function submit(): void {
  346      form.post('/onboarding', {
  347          preserveScroll: true,
  348          onError: () => {
--- routes/web.php:31-35
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   33      Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
   34      Route::post('onboarding/validate', [OnboardingController::class, 'validateCredentials'])->name('onboarding.validate');
   35      Route::get('projects', ActivityController::class)->defaults('section', 'projects')->name('projects.index');
--- resources/js/pages/Onboarding.vue (imports)
    2  import { Head, Link, useForm, useHttp } from '@inertiajs/vue3';
    3  import {
   16  import { computed, ref, watch } from 'vue';
   17  import { Toaster } from '@/components/ui/sonner';
  646                                          required
  656                                          required
  669                                          required
--- resources/js/pages/Onboarding.vue (declarations of form)
   90  const form = useForm({
  153  const canShowAwsFields = computed(() => form.credential_mode === 'aws_keys');
  155      () => form.credential_mode === 'cloudflare_token',
  191      () => form.credential_mode === 'configure_later',
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Ef6dbe1eb7f =====
{"id": "Ef6dbe1eb7f", "from": "tests/Feature/InboxTest.php:52", "to_symbol": "POST /api/webhooks/inbound/cloudflare/{token}", "to": "routes/api.php:22", "kind": "route"}
--- tests/Feature/InboxTest.php:50-54
   50      ]);
   51  
   52      $test->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   53          'from' => $from,
   54          'to' => $to,
--- routes/api.php:20-24
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
--- tests/Feature/InboxTest.php (imports)
    3  use App\Models\Project;
    4  use App\Models\Source;
    5  use App\Models\Thread;
    6  use App\Models\ThreadUserState;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use Illuminate\Support\Facades\Queue;
--- tests/Feature/InboxTest.php (declarations of test)
   22          'cloudflare_api_token' => 'cf-test-token',
   39  function receiveThreadedEmail($test, Source $source, string $subject, string $messageId, string $from = 'maya@customer.test', string $to = 'support@example.com'): void
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE Effa404abce =====
{"id": "Effa404abce", "from": "app/Services/EmailSendService.php:96", "to_symbol": "MimeMessageBuilder::splitAddress", "to": "app/Services/MimeMessageBuilder.php:84", "kind": "call", "note": "inside send"}
--- app/Services/EmailSendService.php:94-98
   94                  foreach (['to', 'cc', 'bcc'] as $type) {
   95                      foreach ($payload[$type] ?? [] as $recipient) {
   96                          $address = $this->mimeBuilder->splitAddress($recipient);
   97                          $email->recipients()->create([
   98                              'type' => $type,
--- app/Services/MimeMessageBuilder.php:82-86
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of mimeBuilder)
   25          private MimeMessageBuilder $mimeBuilder,
   49          $mime = $this->mimeBuilder->build(
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   96                          $address = $this->mimeBuilder->splitAddress($recipient);


===== EDGE Ee4a64b4a83 =====
{"id": "Ee4a64b4a83", "from": "app/Http/Controllers/ThreadActionController.php:132", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "compose"}
--- app/Http/Controllers/ThreadActionController.php:130-134
  130  
  131          try {
  132              $email = $this->sendService->send($project, $source, [
  133                  'from' => ($validated['from'] ?? null) ?: $source->default_from_email,
  134                  'to' => $this->recipientList($validated['to']),
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/ThreadActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Models\InboundEmail;
    6  use App\Models\Project;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Services\EmailSendService;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Http\RedirectResponse;
   12  use Illuminate\Http\Request;
   13  use Illuminate\Http\UploadedFile;
   14  use Illuminate\Support\Facades\Auth;
   15  use Illuminate\Support\Facades\Storage;
   16  use Illuminate\Support\Str;
   17  use Illuminate\Validation\ValidationException;
   18  use Inertia\Inertia;
   19  use Throwable;
   20  use ZBateson\MailMimeParser\MailMimeParser;
--- app/Http/Controllers/ThreadActionController.php (declarations of sendService)
   26          private EmailSendService $sendService,
  132              $email = $this->sendService->send($project, $source, [


===== EDGE E08d792cedd =====
{"id": "E08d792cedd", "from": "resources/js/pages/Activity.vue:1334", "to_symbol": "POST {project}/send", "to": "routes/web.php:62", "kind": "route", "note": "router.post via projectAction"}
--- resources/js/pages/Activity.vue:1332-1336
 1332  
 1333  function sendEmail(): void {
 1334      router.post(
 1335          projectAction('/send'),
 1336          {
--- routes/web.php:60-64
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
--- resources/js/pages/Activity.vue (imports)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
    3  import {
   21  import {
   29  import DashboardPanel from '@/components/DashboardPanel.vue';
   30  import EmailProviderPanel from '@/components/EmailProviderPanel.vue';
   31  import GlobalRail from '@/components/GlobalRail.vue';
   32  import PaginationControls from '@/components/PaginationControls.vue';
   33  import { Toaster } from '@/components/ui/sonner';
   34  import { section as projectSectionRoute } from '@/routes/projects';
   35  import { transfer as transferWorkspaceOwnershipRoute } from '@/routes/workspace-members/ownership';
 2860                                                  required
 2877                                                  required
 3161                                          required
 3537                                          required
 3546                                          required
 3587                                      required
 3652                                          required
 4270                                          required
 4278                                          required
 4295                                      required
 4460                                              required
 4889                                          required
 5432                              required
--- resources/js/pages/Activity.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E906d197d46 =====
{"id": "E906d197d46", "from": "resources/js/app.ts:36", "to_symbol": "initializeTheme", "to": "resources/js/composables/useAppearance.ts:73", "kind": "call"}
--- resources/js/app.ts:34-38
   34  
   35  // This will set light / dark mode on page load...
   36  initializeTheme();
   37  
   38  // This will listen for flash toast data from the server...
--- resources/js/composables/useAppearance.ts:71-75
   71  };
   72  
   73  export function initializeTheme(): void {
   74      if (typeof window === 'undefined') {
   75          return;
--- resources/js/app.ts (imports)
    1  import { createInertiaApp } from '@inertiajs/vue3';
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
    6  import { initializeFlashToast } from '@/lib/flashToast';


===== EDGE E816df3552f =====
{"id": "E816df3552f", "from": "app/Http/Controllers/DashboardActionController.php:421", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "resendStoredEmail"}
--- app/Http/Controllers/DashboardActionController.php:419-423
  419  
  420          try {
  421              $resent = $emailSendService->send($project, $email->source, $this->payloadForRetry($email));
  422          } catch (Throwable $exception) {
  423              report($exception);
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/DashboardActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Enums\SourceProvider;
    6  use App\Exceptions\SuppressionRemovalException;
    7  use App\Http\Requests\DashboardSendEmailRequest;
    8  use App\Http\Requests\StoreApiKeyRequest;
    9  use App\Http\Requests\StoreDomainRequest;
   10  use App\Http\Requests\StoreTemplateRequest;
   11  use App\Http\Requests\StoreWebhookEndpointRequest;
   12  use App\Http\Requests\UpdateSourceRequest;
   13  use App\Jobs\RecheckPendingDomains;
   14  use App\Models\ApiKey;
   15  use App\Models\Domain;
   16  use App\Models\Email;
   17  use App\Models\Project;
   18  use App\Models\Source;
   19  use App\Models\Suppression;
   20  use App\Models\User;
   21  use App\Models\WebhookEndpoint;
   22  use App\Services\DnsRecordVerifier;
   23  use App\Services\EmailSendService;
   24  use App\Services\Providers\CloudflareInboundProvisioner;
   25  use App\Services\Providers\DomainOnboardingException;
   26  use App\Services\Providers\EmailProviderFactory;
   27  use App\Services\SuppressionRemovalService;
   28  use App\Support\ProjectContext;
--- app/Http/Controllers/DashboardActionController.php (declarations of emailSendService)
  376      public function sendEmail(DashboardSendEmailRequest $request, EmailSendService $emailSendService): RedirectResponse
  387          $email = $emailSendService->send($project, $source, $request->validated());
  394      public function resendEmail(Email $email, EmailSendService $emailSendService): RedirectResponse
  401      public function resendProjectEmail(string $projectSlug, Email $email, EmailSendService $emailSendService): RedirectResponse


===== EDGE Eece8d1edbd =====
{"id": "Eece8d1edbd", "from": "tests/Feature/ApiEmailTest.php:64", "to_symbol": "POST /api/emails", "to": "routes/api.php:13", "kind": "route"}
--- tests/Feature/ApiEmailTest.php:62-66
   62      Queue::fake();
   63  
   64      $response = $this->withToken($token)->postJson('/api/emails', [
   65          'from' => 'Larasend <receipts@example.com>',
   66          'to' => ['Maya <maya@example.com>'],
--- routes/api.php:11-15
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
--- tests/Feature/ApiEmailTest.php (imports)
    3  use App\Jobs\RecoverStuckQueuedEmails;
    4  use App\Jobs\SendQueuedEmail;
    5  use App\Models\ApiKey;
    6  use App\Models\Email;
    7  use App\Models\Project;
    8  use App\Models\Source;
    9  use App\Models\Suppression;
   10  use App\Models\User;
   11  use App\Models\Workspace;
   12  use App\Services\EmailSendService;
   13  use App\Services\Providers\EmailProviderFactory;
   14  use App\Services\SesV2Client;
   15  use Illuminate\Cache\RateLimiter as CacheRateLimiter;
   16  use Illuminate\Console\Scheduling\Schedule;
   17  use Illuminate\Contracts\Bus\Dispatcher;
   18  use Illuminate\Contracts\Queue\ShouldBeUnique;
   19  use Illuminate\Database\QueryException;
   20  use Illuminate\Http\Client\Request;
   21  use Illuminate\Http\Request as HttpRequest;
   22  use Illuminate\Support\Facades\Http;
   23  use Illuminate\Support\Facades\Queue;
   24  use Illuminate\Support\Facades\Storage;
   25  use Illuminate\Validation\ValidationException;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE E0f0c970718 =====
{"id": "E0f0c970718", "from": "resources/js/pages/Inbox.vue:391", "to_symbol": "POST {project}/emails/{email}/resend", "to": "routes/web.php:64", "kind": "route", "note": "router.post"}
--- resources/js/pages/Inbox.vue:389-393
  389  
  390  function retryMessage(messageId: string): void {
  391      router.post(
  392          `${props.project.path}/emails/${messageId}/resend`,
  393          {},
--- routes/web.php:62-66
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   66          Route::post('threads/{thread:public_id}/read', [ThreadActionController::class, 'read'])->name('threads.read');
--- resources/js/pages/Inbox.vue (imports)
    2  import { Head, Link, router, useForm, usePoll } from '@inertiajs/vue3';
    3  import {
   27  import {
   35  import GlobalRail from '@/components/GlobalRail.vue';
   36  import PaginationControls from '@/components/PaginationControls.vue';
   37  import RichTextEditor from '@/components/RichTextEditor.vue';
   38  import { Toaster } from '@/components/ui/sonner';
   39  import { inbox as inboxRoute } from '@/routes/projects';
 2206                          required
 2222                          required
 2374                          required
--- resources/js/pages/Inbox.vue (declarations of router)
    2  import { Head, Link, router, useForm, usePoll } from '@inertiajs/vue3';
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E14838d5670 =====
{"id": "E14838d5670", "from": "app/Console/Commands/ThreadBackfillCommand.php:31", "to_symbol": "ThreadResolver::attachInbound", "to": "app/Services/ThreadResolver.php:25", "kind": "call"}
--- app/Console/Commands/ThreadBackfillCommand.php:29-33
   29              $entry['model'] instanceof Email
   30                  ? $threads->attachOutbound($entry['model'])
   31                  : $threads->attachInbound($entry['model']);
   32              $count++;
   33          }
--- app/Services/ThreadResolver.php:23-27
   23      private const SUBJECT_MATCH_WINDOW_DAYS = 60;
   24  
   25      public function attachInbound(InboundEmail $inbound): Thread
   26      {
   27          $participants = array_filter([
--- app/Console/Commands/ThreadBackfillCommand.php (imports)
    3  namespace App\Console\Commands;
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Services\ThreadResolver;
    8  use Illuminate\Console\Attributes\Description;
    9  use Illuminate\Console\Attributes\Signature;
   10  use Illuminate\Console\Command;
--- app/Console/Commands/ThreadBackfillCommand.php (declarations of threads)
   16      public function handle(ThreadResolver $threads): int


===== EDGE E36aa533261 =====
{"id": "E36aa533261", "from": "app/Jobs/SyncCloudflareSourceSuppressions.php:114", "to_symbol": "scopeWhereNormalizedEmailNotIn", "to": "app/Models/Suppression.php:74", "kind": "framework", "note": "Eloquent local scope"}
--- app/Jobs/SyncCloudflareSourceSuppressions.php:112-116
  112          }
  113  
  114          $providerSyncSuppressions->whereNormalizedEmailNotIn($syncedEmails)->delete();
  115      }
  116  
--- app/Models/Suppression.php:72-76
   72       * @param  iterable<int, string>  $emails
   73       */
   74      public function scopeWhereNormalizedEmailNotIn(Builder $query, iterable $emails): void
   75      {
   76          $query->whereNotIn($this->normalizedEmailColumn(), $this->normalizeEmails($emails));
--- app/Jobs/SyncCloudflareSourceSuppressions.php (imports)
    3  namespace App\Jobs;
    5  use App\Enums\SourceProvider;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\Suppression;
    9  use App\Services\CloudflareApiClient;
   10  use Illuminate\Contracts\Queue\ShouldBeUnique;
   11  use Illuminate\Contracts\Queue\ShouldQueue;
   12  use Illuminate\Foundation\Queue\Queueable;
   13  use Illuminate\Queue\Attributes\UniqueFor;
   14  use Illuminate\Support\Carbon;
   15  use Illuminate\Support\Facades\DB;
   16  use RuntimeException;
   17  use Throwable;
   25      use Queueable;
--- app/Jobs/SyncCloudflareSourceSuppressions.php (declarations of providerSyncSuppressions)
  104          $providerSyncSuppressions = $project->suppressions()


===== EDGE E807872656a =====
{"id": "E807872656a", "from": "tests/Feature/InboxReplyTest.php:88", "to_symbol": "POST /projects/{project}/threads/{thread}/reply", "to": "routes/web.php:70", "kind": "route"}
--- tests/Feature/InboxReplyTest.php:86-90
   86  
   87      $this->actingAs($user)
   88          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/reply", [
   89              'text' => "Sure!\n\nGo to Settings > Billing.",
   90          ])
--- routes/web.php:68-72
   68          Route::post('threads/{thread:public_id}/archive', [ThreadActionController::class, 'archive'])->name('threads.archive');
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
--- tests/Feature/InboxReplyTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\InboundEmail;
    5  use App\Models\Project;
    6  use App\Models\Source;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use Illuminate\Http\UploadedFile;
   11  use Illuminate\Support\Facades\Queue;
   12  use Illuminate\Support\Facades\Storage;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E33b5bad978 =====
{"id": "E33b5bad978", "from": "resources/js/layouts/AppLayout.vue:11", "to_symbol": "AppSidebarLayout (imported as AppLayout, line 2)", "to": "resources/js/layouts/app/AppSidebarLayout.vue:1", "kind": "component"}
--- resources/js/layouts/AppLayout.vue:9-13
    9  
   10  <template>
   11      <AppLayout :breadcrumbs="breadcrumbs">
   12          <slot />
   13      </AppLayout>
--- resources/js/layouts/app/AppSidebarLayout.vue:1-3
    1  <script setup lang="ts">
    2  import AppContent from '@/components/AppContent.vue';
    3  import AppShell from '@/components/AppShell.vue';
--- resources/js/layouts/AppLayout.vue (imports)
    2  import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
    3  import type { BreadcrumbItem } from '@/types';


===== EDGE E7668f42a9a =====
{"id": "E7668f42a9a", "from": "app/Rules/PublicWebhookUrl.php:21", "to_symbol": "WebhookUrlGuard::isSafe", "to": "app/Services/WebhookUrlGuard.php:11", "kind": "call"}
--- app/Rules/PublicWebhookUrl.php:19-23
   19      public function validate(string $attribute, mixed $value, Closure $fail): void
   20      {
   21          if (! is_string($value) || ! ($this->guard ?? app(WebhookUrlGuard::class))->isSafe($value)) {
   22              $fail('The :attribute must use a publicly reachable HTTP or HTTPS address.');
   23          }
--- app/Services/WebhookUrlGuard.php:9-13
    9  class WebhookUrlGuard
   10  {
   11      public function isSafe(string $url): bool
   12      {
   13          try {
--- app/Rules/PublicWebhookUrl.php (imports)
    3  namespace App\Rules;
    5  use App\Services\WebhookUrlGuard;
    6  use Closure;
    7  use Illuminate\Contracts\Validation\ValidationRule;
    8  use Illuminate\Translation\PotentiallyTranslatedString;


===== EDGE E98e93ff171 =====
{"id": "E98e93ff171", "from": "app/Jobs/SyncCloudflareSourceSuppressions.php:53", "to_symbol": "CloudflareApiClient::listStableSuppressions", "to": "app/Services/CloudflareApiClient.php:97", "kind": "call"}
--- app/Jobs/SyncCloudflareSourceSuppressions.php:51-55
   51  
   52          $project = $source->project;
   53          $suppressions = $cloudflare->listStableSuppressions(
   54              $source,
   55              min(self::SNAPSHOT_BUDGET_SECONDS, $this->remainingWorkBudget($deadline)),
--- app/Services/CloudflareApiClient.php:95-99
   95       * @return array<int, array{id: string, email: string, reason: string, created_at: string|null, expires_at: string|null}>
   96       */
   97      public function listStableSuppressions(Source $source, float $budgetSeconds): array
   98      {
   99          if ($budgetSeconds <= 0) {
--- app/Jobs/SyncCloudflareSourceSuppressions.php (imports)
    3  namespace App\Jobs;
    5  use App\Enums\SourceProvider;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\Suppression;
    9  use App\Services\CloudflareApiClient;
   10  use Illuminate\Contracts\Queue\ShouldBeUnique;
   11  use Illuminate\Contracts\Queue\ShouldQueue;
   12  use Illuminate\Foundation\Queue\Queueable;
   13  use Illuminate\Queue\Attributes\UniqueFor;
   14  use Illuminate\Support\Carbon;
   15  use Illuminate\Support\Facades\DB;
   16  use RuntimeException;
   17  use Throwable;
   25      use Queueable;
--- app/Jobs/SyncCloudflareSourceSuppressions.php (declarations of cloudflare)
   37      public function handle(CloudflareApiClient $cloudflare): void
   53          $suppressions = $cloudflare->listStableSuppressions(


===== EDGE Ef0c059e433 =====
{"id": "Ef0c059e433", "from": "tests/Feature/SuppressionEmailNormalizationMigrationTest.php:189", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Suppression::create with email"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:187-191
  187          ->and($suppressionQueries->sole())->toMatch('/on conflict|on duplicate key update/i');
  188  
  189      $normalizedByModel = Suppression::create([
  190          'workspace_id' => $workspace->id,
  191          'project_id' => $project->id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php (imports)
    3  use App\Jobs\SyncCloudflareSourceSuppressions;
    4  use App\Models\Email;
    5  use App\Models\Project;
    6  use App\Models\Source;
    7  use App\Models\Suppression;
    8  use App\Models\User;
    9  use App\Models\Workspace;
   10  use App\Services\CloudflareApiClient;
   11  use App\Services\SesEventNormalizer;
   12  use Illuminate\Database\Migrations\Migration;
   13  use Illuminate\Database\QueryException;
   14  use Illuminate\Support\Carbon;
   15  use Illuminate\Support\Facades\DB;
   16  use Illuminate\Support\Facades\Http;


===== EDGE E354082ab05 =====
{"id": "E354082ab05", "from": "tests/Feature/ActivityDashboardTest.php:74", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Eloquent set-mutator fires on Suppression::query()->create(['email'=>...])"}
--- tests/Feature/ActivityDashboardTest.php:72-76
   72      $expiredAt = now()->subDay()->startOfSecond();
   73  
   74      Suppression::query()->create([
   75          'workspace_id' => $project->workspace_id,
   76          'project_id' => $project->id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/ActivityDashboardTest.php (imports)
    3  use App\Actions\BuildProjectDashboard;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\Suppression;
    9  use App\Models\Thread;
   10  use App\Models\User;
   11  use App\Models\WebhookEndpoint;
   12  use App\Models\Workspace;
   13  use App\Support\ProjectContext;
   14  use Illuminate\Support\Str;
   16  use function Pest\Laravel\mock;


===== EDGE E5204c5fb5b =====
{"id": "E5204c5fb5b", "from": "resources/js/app.ts:25", "to_symbol": "SettingsLayout", "to": "resources/js/layouts/settings/Layout.vue:1", "kind": "framework", "note": "Inertia layout resolver for settings/* pages"}
--- resources/js/app.ts:23-27
   23                  return AuthLayout;
   24              case name.startsWith('settings/'):
   25                  return SettingsLayout;
   26              default:
   27                  return AppLayout;
--- resources/js/layouts/settings/Layout.vue:1-3
    1  <script setup lang="ts">
    2  import { Link, usePage } from '@inertiajs/vue3';
    3  import { Palette, ShieldCheck, UserRound } from 'lucide-vue-next';
--- resources/js/app.ts (imports)
    1  import { createInertiaApp } from '@inertiajs/vue3';
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
    6  import { initializeFlashToast } from '@/lib/flashToast';


===== EDGE E81daabf2e9 =====
{"id": "E81daabf2e9", "from": "app/Services/EmailSendService.php:197", "to_symbol": "MimeMessageBuilder::splitAddress", "to": "app/Services/MimeMessageBuilder.php:84", "kind": "call", "note": "fromAddressUsesVerifiedDomain (line 195)"}
--- app/Services/EmailSendService.php:195-199
  195      private function fromAddressUsesVerifiedDomain(Project $project, string $from): bool
  196      {
  197          $fromDomain = Str::lower(Str::after($this->mimeBuilder->splitAddress($from)['email'], '@'));
  198  
  199          if ($fromDomain === '') {
--- app/Services/MimeMessageBuilder.php:82-86
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
--- app/Services/EmailSendService.php (imports)
    3  namespace App\Services;
    5  use App\Events\EmailActivityUpdated;
    6  use App\Jobs\SendQueuedEmail;
    7  use App\Models\Email;
    8  use App\Models\Project;
    9  use App\Models\Source;
   10  use App\Models\Suppression;
   11  use App\Models\Template;
   12  use App\Services\Providers\EmailProviderFactory;
   13  use Illuminate\Bus\UniqueLock;
   14  use Illuminate\Contracts\Cache\Repository as Cache;
   15  use Illuminate\Support\Arr;
   16  use Illuminate\Support\Facades\DB;
   17  use Illuminate\Support\Facades\Storage;
   18  use Illuminate\Support\Str;
   19  use Illuminate\Validation\ValidationException;
   20  use Throwable;
--- app/Services/EmailSendService.php (declarations of mimeBuilder)
   25          private MimeMessageBuilder $mimeBuilder,
   49          $mime = $this->mimeBuilder->build(
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   96                          $address = $this->mimeBuilder->splitAddress($recipient);


===== EDGE Eae1a978431 =====
{"id": "Eae1a978431", "from": "tests/Feature/SuppressionManagementTest.php:79", "to_symbol": "DELETE /projects/{project}/suppressions/{suppression}", "to": "routes/web.php:59", "kind": "route"}
--- tests/Feature/SuppressionManagementTest.php:77-81
   77  
   78      $this->actingAs($owner)
   79          ->delete("/projects/{$project->slug}/suppressions/{$suppression->id}")
   80          ->assertRedirect("/projects/{$project->slug}/suppressions");
   81  
--- routes/web.php:57-61
   57          Route::post('api-keys/{apiKey}/rotate', [DashboardActionController::class, 'rotateApiKey'])->name('api-keys.rotate');
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
--- tests/Feature/SuppressionManagementTest.php (imports)
    3  use App\Models\ApiKey;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use Illuminate\Http\Client\Request;
   10  use Illuminate\Http\Client\RequestException;
   11  use Illuminate\Support\Carbon;
   12  use Illuminate\Support\Facades\Exceptions;
   13  use Illuminate\Support\Facades\Http;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE Ed256bb6654 =====
{"id": "Ed256bb6654", "from": "tests/Feature/InboundEmailTest.php:74", "to_symbol": "POST /api/webhooks/inbound/cloudflare/{token}", "to": "routes/api.php:22", "kind": "route"}
--- tests/Feature/InboundEmailTest.php:72-76
   72      Queue::fake();
   73  
   74      $this->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   75          'from' => 'maya@customer.test',
   76          'to' => 'support@example.com',
--- routes/api.php:20-24
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
--- tests/Feature/InboundEmailTest.php (imports)
    3  use App\Jobs\DeliverInboundWebhook;
    4  use App\Models\CloudflareInboundDomain;
    5  use App\Models\InboundEmail;
    6  use App\Models\Project;
    7  use App\Models\Source;
    8  use App\Models\User;
    9  use App\Models\WebhookEndpoint;
   10  use App\Models\Workspace;
   11  use App\Services\InboundEmailIngestor;
   12  use Illuminate\Contracts\Bus\Dispatcher;
   13  use Illuminate\Support\Facades\Http;
   14  use Illuminate\Support\Facades\Queue;
   15  use Illuminate\Support\Facades\Storage;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE E440dff1269 =====
{"id": "E440dff1269", "from": "app/Http/Controllers/ThreadActionController.php:198", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "forward"}
--- app/Http/Controllers/ThreadActionController.php:196-200
  196  
  197          try {
  198              $this->sendService->send($project, $this->projectContext->currentSource($project), [
  199                  'from' => $lastInbound->to_email,
  200                  'to' => [$validated['to']],
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,
--- app/Http/Controllers/ThreadActionController.php (imports)
    3  namespace App\Http\Controllers;
    5  use App\Models\InboundEmail;
    6  use App\Models\Project;
    7  use App\Models\Thread;
    8  use App\Models\User;
    9  use App\Services\EmailSendService;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Http\RedirectResponse;
   12  use Illuminate\Http\Request;
   13  use Illuminate\Http\UploadedFile;
   14  use Illuminate\Support\Facades\Auth;
   15  use Illuminate\Support\Facades\Storage;
   16  use Illuminate\Support\Str;
   17  use Illuminate\Validation\ValidationException;
   18  use Inertia\Inertia;
   19  use Throwable;
   20  use ZBateson\MailMimeParser\MailMimeParser;
--- app/Http/Controllers/ThreadActionController.php (declarations of projectContext)
   25          private ProjectContext $projectContext,
   68          $source = $this->projectContext->currentSource($project);
  113          $project = $this->projectContext->projectFor($user, is_string($request->route('project')) ? $request->route('project') : null);
  129          $source = $this->projectContext->currentSource($project);
--- app/Http/Controllers/ThreadActionController.php (declarations of sendService)
   26          private EmailSendService $sendService,
  132              $email = $this->sendService->send($project, $source, [


===== EDGE Ec8f3f524c3 =====
{"id": "Ec8f3f524c3", "from": "tests/Feature/DashboardActionsTest.php:514", "to_symbol": "PUT /webhooks/{endpoint}", "to": "routes/web.php:113", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:512-516
  512  
  513      $this->actingAs($user)
  514          ->put("/webhooks/{$endpoint->public_id}", [
  515              'url' => 'https://example.com/webhooks/updated',
  516              'events' => ['delivery'],
--- routes/web.php:111-115
  111      Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E863152023f =====
{"id": "E863152023f", "from": "resources/js/components/AppearanceTabs.vue:21", "to_symbol": "updateAppearance", "to": "resources/js/composables/useAppearance.ts:107", "kind": "call", "note": "obtained from useAppearance() at line 5"}
--- resources/js/components/AppearanceTabs.vue:19-23
   19              v-for="{ value, Icon, label } in tabs"
   20              :key="value"
   21              @click="updateAppearance(value)"
   22              :class="[
   23                  'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
--- resources/js/composables/useAppearance.ts:105-109
  105      });
  106  
  107      function updateAppearance(value: Appearance) {
  108          appearance.value = value;
  109  
--- resources/js/components/AppearanceTabs.vue (imports)
    2  import { Monitor, Moon, Sun } from 'lucide-vue-next';
    3  import { useAppearance } from '@/composables/useAppearance';


===== EDGE Edc1656a8cc =====
{"id": "Edc1656a8cc", "from": "resources/js/composables/useCurrentUrl.ts:43", "to_symbol": "toUrl", "to": "resources/js/lib/utils.ts:10", "kind": "call", "note": "inside isCurrentUrl (line 37)"}
--- resources/js/composables/useCurrentUrl.ts:41-45
   41      ) {
   42          const urlToCompare = currentUrl ?? currentUrlReactive.value;
   43          const urlString = toUrl(urlToCheck);
   44  
   45          const comparePath = (path: string): boolean =>
--- resources/js/lib/utils.ts:8-12
    8  }
    9  
   10  export function toUrl(href: NonNullable<InertiaLinkProps['href']>) {
   11      return typeof href === 'string' ? href : href?.url;
   12  }
--- resources/js/composables/useCurrentUrl.ts (imports)
    1  import type { InertiaLinkProps } from '@inertiajs/vue3';
    2  import { usePage } from '@inertiajs/vue3';
    3  import type { ComputedRef, DeepReadonly } from 'vue';
    4  import { computed, readonly } from 'vue';
    5  import { toUrl } from '@/lib/utils';


===== EDGE E071caec023 =====
{"id": "E071caec023", "from": "tests/Feature/CloudflareSuppressionSyncTest.php:421", "to_symbol": "POST /api/emails", "to": "routes/api.php:13", "kind": "route"}
--- tests/Feature/CloudflareSuppressionSyncTest.php:419-423
  419      Queue::fake();
  420  
  421      $this->withToken($issued['plain_text'])->postJson('/api/emails', [
  422          'from' => 'Larasend <receipts@example.com>',
  423          'to' => ['Expired Collision <expired-collision@example.com>'],
--- routes/api.php:11-15
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
--- tests/Feature/CloudflareSuppressionSyncTest.php (imports)
    3  use App\Jobs\SyncCloudflareSourceSuppressions;
    4  use App\Jobs\SyncCloudflareSuppressions;
    5  use App\Models\ApiKey;
    6  use App\Models\Email;
    7  use App\Models\Project;
    8  use App\Models\Source;
    9  use App\Models\Suppression;
   10  use App\Models\User;
   11  use App\Models\Workspace;
   12  use App\Services\CloudflareApiClient;
   13  use Illuminate\Console\Scheduling\Schedule;
   14  use Illuminate\Contracts\Queue\ShouldBeUnique;
   15  use Illuminate\Queue\Attributes\UniqueFor;
   16  use Illuminate\Support\Facades\Http;
   17  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {


===== EDGE Ee3e0f60335 =====
{"id": "Ee3e0f60335", "from": "tests/Feature/CloudflareSuppressionSyncTest.php:135", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Suppression::create with email"}
--- tests/Feature/CloudflareSuppressionSyncTest.php:133-137
  133      ]);
  134  
  135      $missingUpstream = Suppression::create([
  136          'workspace_id' => $project->workspace_id,
  137          'project_id' => $project->id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/CloudflareSuppressionSyncTest.php (imports)
    3  use App\Jobs\SyncCloudflareSourceSuppressions;
    4  use App\Jobs\SyncCloudflareSuppressions;
    5  use App\Models\ApiKey;
    6  use App\Models\Email;
    7  use App\Models\Project;
    8  use App\Models\Source;
    9  use App\Models\Suppression;
   10  use App\Models\User;
   11  use App\Models\Workspace;
   12  use App\Services\CloudflareApiClient;
   13  use Illuminate\Console\Scheduling\Schedule;
   14  use Illuminate\Contracts\Queue\ShouldBeUnique;
   15  use Illuminate\Queue\Attributes\UniqueFor;
   16  use Illuminate\Support\Facades\Http;
   17  use Illuminate\Support\Facades\Queue;


===== EDGE Eefc5163008 =====
{"id": "Eefc5163008", "from": "resources/js/components/NavMain.vue:27", "to_symbol": "isCurrentUrl", "to": "resources/js/composables/useCurrentUrl.ts:37", "kind": "call", "note": "from useCurrentUrl() at line 17"}
--- resources/js/components/NavMain.vue:25-29
   25                  <SidebarMenuButton
   26                      as-child
   27                      :is-active="isCurrentUrl(item.href)"
   28                      :tooltip="item.title"
   29                  >
--- resources/js/composables/useCurrentUrl.ts:35-39
   35  
   36  export function useCurrentUrl(): UseCurrentUrlReturn {
   37      function isCurrentUrl(
   38          urlToCheck: NonNullable<InertiaLinkProps['href']>,
   39          currentUrl?: string,
--- resources/js/components/NavMain.vue (imports)
    2  import { Link } from '@inertiajs/vue3';
    3  import {
   10  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   11  import type { NavItem } from '@/types';


===== EDGE E9e7bf8e0e6 =====
{"id": "E9e7bf8e0e6", "from": "tests/Feature/SesWebhookTest.php:273", "to_symbol": "Suppression email() mutator", "to": "app/Models/Suppression.php:37", "kind": "framework", "note": "Suppression::create with email"}
--- tests/Feature/SesWebhookTest.php:271-275
  271          'webhook_token' => 'cloudflare-webhook-token',
  272      ]);
  273      $suppression = Suppression::create([
  274          'workspace_id' => $email->workspace_id,
  275          'project_id' => $email->project_id,
--- app/Models/Suppression.php:35-39
   35      }
   36  
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
--- tests/Feature/SesWebhookTest.php (imports)
    3  use App\Models\Email;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Suppression;
    7  use App\Models\User;
    8  use App\Models\WebhookLog;
    9  use App\Models\Workspace;
   10  use App\Services\SesEventNormalizer;
   11  use Illuminate\Support\Facades\DB;
   12  use Illuminate\Support\Facades\Event;
   13  use Illuminate\Support\Facades\Http;


===== EDGE Ec6a589fff6 =====
{"id": "Ec6a589fff6", "from": "app/Console/Commands/ThreadBackfillCommand.php:30", "to_symbol": "ThreadResolver::attachOutbound", "to": "app/Services/ThreadResolver.php:49", "kind": "call"}
--- app/Console/Commands/ThreadBackfillCommand.php:28-32
   28          foreach ($messages as $entry) {
   29              $entry['model'] instanceof Email
   30                  ? $threads->attachOutbound($entry['model'])
   31                  : $threads->attachInbound($entry['model']);
   32              $count++;
--- app/Services/ThreadResolver.php:47-51
   47      }
   48  
   49      public function attachOutbound(Email $email): Thread
   50      {
   51          $email->loadMissing('recipients');
--- app/Console/Commands/ThreadBackfillCommand.php (imports)
    3  namespace App\Console\Commands;
    5  use App\Models\Email;
    6  use App\Models\InboundEmail;
    7  use App\Services\ThreadResolver;
    8  use Illuminate\Console\Attributes\Description;
    9  use Illuminate\Console\Attributes\Signature;
   10  use Illuminate\Console\Command;
--- app/Console/Commands/ThreadBackfillCommand.php (declarations of threads)
   16      public function handle(ThreadResolver $threads): int


===== EDGE E35df506372 =====
{"id": "E35df506372", "from": "tests/Feature/DashboardActionsTest.php:686", "to_symbol": "POST /projects/{project}/send", "to": "routes/web.php:62", "kind": "route"}
--- tests/Feature/DashboardActionsTest.php:684-688
  684  
  685      $this->actingAs($user)
  686          ->post("/projects/{$project->slug}/send", [
  687              'from' => 'Larasend <receipts@example.com>',
  688              'to' => 'maya@example.com',
--- routes/web.php:60-64
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
--- tests/Feature/DashboardActionsTest.php (imports)
    3  use App\Jobs\SendQueuedEmail;
    4  use App\Models\ApiKey;
    5  use App\Models\Email;
    6  use App\Models\Project;
    7  use App\Models\User;
    8  use App\Models\WebhookEndpoint;
    9  use App\Services\DnsRecordVerifier;
   10  use App\Support\ProjectContext;
   11  use Illuminate\Support\Facades\Http;
   12  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/web.php (route groups / registration)
   28  })->name('home');
   30  Route::middleware(['auth', 'verified'])->group(function () {
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   46      Route::prefix('projects/{project}')->name('projects.')->group(function () {
   47          Route::get('/', [ProjectController::class, 'show'])->name('show');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   83              ->name('section');
   86      Route::get('activity', ActivityController::class)->defaults('section', 'activity')->name('activity');
   88      Route::get('outbound', ActivityController::class)->defaults('section', 'outbound')->name('outbound');
   89      Route::get('sent', ActivityController::class)->defaults('section', 'sent')->name('sent');
   90      Route::get('inbound', ActivityController::class)->defaults('section', 'inbound')->name('inbound');


===== EDGE E7cf1c2456f =====
{"id": "E7cf1c2456f", "from": "tests/Feature/ThreadingTest.php:62", "to_symbol": "POST /api/webhooks/inbound/cloudflare/{token}", "to": "routes/api.php:22", "kind": "route"}
--- tests/Feature/ThreadingTest.php:60-64
   60      Queue::fake();
   61  
   62      $post = fn (string $mime) => $this->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   63          'from' => 'maya@customer.test',
   64          'to' => 'support@example.com',
--- routes/api.php:20-24
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
--- tests/Feature/ThreadingTest.php (imports)
    3  use App\Models\InboundEmail;
    4  use App\Models\Project;
    5  use App\Models\Source;
    6  use App\Models\Thread;
    7  use App\Models\User;
    8  use App\Models\Workspace;
    9  use App\Services\EmailSendService;
   10  use Illuminate\Support\Facades\Queue;
--- bootstrap/app.php (route groups / registration)
   11      ->withRouting(
   12          web: __DIR__.'/../routes/web.php',
   13          api: __DIR__.'/../routes/api.php',
--- routes/api.php (route groups / registration)
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {