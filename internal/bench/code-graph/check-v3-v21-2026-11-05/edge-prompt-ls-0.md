You are a judge verifying individual code relations (edges) for a code-navigation benchmark. You cannot read the repository. Each EDGE below claims: a line in a source file uses a symbol (call, instantiation, type use, inheritance, template/component usage, job or event dispatch, a route pointing to a controller action, or a test's HTTP request matching a route), and that symbol is declared at a line in a target file. Source lines around both ends were extracted mechanically from the subject at its registered pin, with line numbers. Edges were assembled from several sources and some are wrong.

For every EDGE rule:
- `VALID` — the shown lines establish the claim: the source line uses `to_symbol` (or requests / routes to it), and the target lines declare it.
- `INVALID` — the shown lines contradict it: a different symbol of the same name, a comment or string only, the wrong route or HTTP method, a declaration that is not the one used.
- `UNSURE` — the lines are not enough to decide; say what is missing.

A `framework` edge names a convention in its note (container binding, mutator, observer, middleware); rule it `VALID` only if the shown lines make that convention visible.

Return ONLY a JSON object, no prose around it:
{"edges": [{"id": "<edge id>", "verdict": "VALID|INVALID|UNSURE", "reason": "<one line>"}]}


Subject: `larasend` at its registered pin.



===== EDGE E011502dfd1 =====
{"id": "E011502dfd1", "from": "resources/js/composables/useCurrentUrl.ts:65", "to_symbol": "isCurrentUrl", "to": "resources/js/composables/useCurrentUrl.ts:37", "kind": "call", "note": "isCurrentOrParentUrl"}
--- resources/js/composables/useCurrentUrl.ts:63-67
   63          currentUrl?: string,
   64      ) {
   65          return isCurrentUrl(urlToCheck, currentUrl, true);
   66      }
   67  
--- resources/js/composables/useCurrentUrl.ts:35-39
   35  
   36  export function useCurrentUrl(): UseCurrentUrlReturn {
   37      function isCurrentUrl(
   38          urlToCheck: NonNullable<InertiaLinkProps['href']>,
   39          currentUrl?: string,


===== EDGE E03d4d9b57d =====
{"id": "E03d4d9b57d", "from": "app/Jobs/SyncCloudflareSourceSuppressions.php:61", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call"}
--- app/Jobs/SyncCloudflareSourceSuppressions.php:59-63
   59          foreach ($suppressions as $suppression) {
   60              $this->ensureWithinWorkBudget($deadline);
   61              $email = Suppression::normalizeEmail($suppression['email']);
   62  
   63              if ($email === '') {
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE E051e79afa4 =====
{"id": "E051e79afa4", "from": "routes/web.php:63", "to_symbol": "DashboardActionController::retrySoftBounces", "to": "app/Http/Controllers/DashboardActionController.php:438", "kind": "route"}
--- routes/web.php:61-65
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
--- app/Http/Controllers/DashboardActionController.php:436-440
  436      }
  437  
  438      public function retrySoftBounces(EmailSendService $emailSendService): RedirectResponse
  439      {
  440          $project = $this->projectFor(Auth::user());


===== EDGE E05b7f33506 =====
{"id": "E05b7f33506", "from": "routes/web.php:116", "to_symbol": "DashboardActionController::resendEmail", "to": "app/Http/Controllers/DashboardActionController.php:394", "kind": "route"}
--- routes/web.php:114-118
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
  117      Route::get('emails/{email:public_id}/preview', EmailPreviewController::class)->name('emails.preview');
  118      Route::get('emails/{email:public_id}/mime', EmailMimeController::class)->name('emails.mime');
--- app/Http/Controllers/DashboardActionController.php:392-396
  392      }
  393  
  394      public function resendEmail(Email $email, EmailSendService $emailSendService): RedirectResponse
  395      {
  396          $project = $this->projectFor(Auth::user());


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


===== EDGE E0a43b9db84 =====
{"id": "E0a43b9db84", "from": "tests/Feature/CloudflareSuppressionSyncTest.php:41", "to_symbol": "SyncCloudflareSourceSuppressions", "to": "app/Jobs/SyncCloudflareSourceSuppressions.php:23", "kind": "use", "note": "instantiates the job and calls handle (line 37)"}
--- tests/Feature/CloudflareSuppressionSyncTest.php:39-43
   39  function runCloudflareSuppressionSourceSync(Source $source, ?CloudflareApiClient $cloudflare = null): void
   40  {
   41      (new SyncCloudflareSourceSuppressions($source->id))
   42          ->handle($cloudflare ?? app(CloudflareApiClient::class));
   43  }
--- app/Jobs/SyncCloudflareSourceSuppressions.php:21-25
   21   */
   22  #[UniqueFor(3900)]
   23  class SyncCloudflareSourceSuppressions implements ShouldBeUnique, ShouldQueue
   24  {
   25      use Queueable;


===== EDGE E0ce540f780 =====
{"id": "E0ce540f780", "from": "app/Models/Suppression.php:40", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "inside email() Attribute mutator (line 37)"}
--- app/Models/Suppression.php:38-42
   38      {
   39          return Attribute::make(
   40              set: fn (string $email): string => self::normalizeEmail($email),
   41          );
   42      }
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE E0d9c1f3e7a =====
{"id": "E0d9c1f3e7a", "from": "app/Models/Suppression.php:76", "to_symbol": "Suppression::normalizeEmails", "to": "app/Models/Suppression.php:121", "kind": "call", "note": "scopeWhereNormalizedEmailNotIn (line 74)"}
--- app/Models/Suppression.php:74-78
   74      public function scopeWhereNormalizedEmailNotIn(Builder $query, iterable $emails): void
   75      {
   76          $query->whereNotIn($this->normalizedEmailColumn(), $this->normalizeEmails($emails));
   77      }
   78  
--- app/Models/Suppression.php:119-123
  119       * @return array<int, string>
  120       */
  121      private function normalizeEmails(iterable $emails): array
  122      {
  123          return collect($emails)


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


===== EDGE E14b0f681cf =====
{"id": "E14b0f681cf", "from": "app/Services/EmailSendService.php:45", "to_symbol": "EmailSendService::ensureSourceCanSend", "to": "app/Services/EmailSendService.php:140", "kind": "call"}
--- app/Services/EmailSendService.php:43-47
   43          $payload = $this->applyTemplate($payload, $template);
   44          $from = $payload['from'] ?? $source->default_from_email;
   45          $this->ensureSourceCanSend($project, $source, (string) $from);
   46          $this->ensureRecipientsAreSendable($project, $payload);
   47  
--- app/Services/EmailSendService.php:138-142
  138       * @throws ValidationException
  139       */
  140      private function ensureSourceCanSend(Project $project, Source $source, string $from): void
  141      {
  142          if (blank($from) || ! $this->mimeBuilder->splitAddress($from)['email']) {


===== EDGE E19ca1f0842 =====
{"id": "E19ca1f0842", "from": "routes/web.php:61", "to_symbol": "DashboardActionController::updateWebhookEndpoint", "to": "app/Http/Controllers/DashboardActionController.php:362", "kind": "route"}
--- routes/web.php:59-63
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
--- app/Http/Controllers/DashboardActionController.php:360-364
  360      }
  361  
  362      public function updateWebhookEndpoint(StoreWebhookEndpointRequest $request, WebhookEndpoint $endpoint): RedirectResponse
  363      {
  364          $project = $this->projectFor(Auth::user());


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


===== EDGE E1cb3bd322d =====
{"id": "E1cb3bd322d", "from": "tests/Feature/ApiEmailTest.php:122", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call", "note": "app(EmailSendService::class)->send"}
--- tests/Feature/ApiEmailTest.php:120-124
  120  
  121      try {
  122          expect(fn () => app(EmailSendService::class)->send($project, $source, [
  123              'from' => 'Larasend <receipts@example.com>',
  124              'to' => ['maya@example.com'],
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,


===== EDGE E1d2c196d65 =====
{"id": "E1d2c196d65", "from": "routes/api.php:13", "to_symbol": "EmailController::store", "to": "app/Http/Controllers/Api/EmailController.php:40", "kind": "route"}
--- routes/api.php:11-15
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
--- app/Http/Controllers/Api/EmailController.php:38-42
   38      }
   39  
   40      public function store(SendEmailRequest $request, EmailSendService $emailSendService): JsonResponse
   41      {
   42          /** @var Project $project */


===== EDGE E1d6cc56e35 =====
{"id": "E1d6cc56e35", "from": "tests/Feature/ThreadingTest.php:149", "to_symbol": "larasend:thread-backfill", "to": "app/Console/Commands/ThreadBackfillCommand.php:12", "kind": "framework", "note": "artisan command signature attribute -> handle(ThreadResolver) at line 16"}
--- tests/Feature/ThreadingTest.php:147-151
  147      ]);
  148  
  149      $this->artisan('larasend:thread-backfill')
  150          ->expectsOutputToContain('Threaded 2 message(s).')
  151          ->assertExitCode(0);
--- app/Console/Commands/ThreadBackfillCommand.php:10-14
   10  use Illuminate\Console\Command;
   11  
   12  #[Signature('larasend:thread-backfill')]
   13  #[Description('Group existing outbound and inbound emails into conversation threads')]
   14  class ThreadBackfillCommand extends Command


===== EDGE E1fd93941a5 =====
{"id": "E1fd93941a5", "from": "resources/js/components/AppearanceTabs.vue:5", "to_symbol": "useAppearance", "to": "resources/js/composables/useAppearance.ts:88", "kind": "call"}
--- resources/js/components/AppearanceTabs.vue:3-7
    3  import { useAppearance } from '@/composables/useAppearance';
    4  
    5  const { appearance, updateAppearance } = useAppearance();
    6  
    7  const tabs = [
--- resources/js/composables/useAppearance.ts:86-90
   86  const appearance = ref<Appearance>('system');
   87  
   88  export function useAppearance(): UseAppearanceReturn {
   89      onMounted(() => {
   90          const savedAppearance = localStorage.getItem(


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


===== EDGE E23eaa8610c =====
{"id": "E23eaa8610c", "from": "routes/api.php:22", "to_symbol": "CloudflareInboundController::__invoke", "to": "app/Http/Controllers/Webhooks/CloudflareInboundController.php:25", "kind": "route"}
--- routes/api.php:20-24
   20      ->name('webhooks.ses');
   21  
   22  Route::post('webhooks/inbound/cloudflare/{token}', CloudflareInboundController::class)
   23      ->middleware('throttle:240,1')
   24      ->name('webhooks.inbound.cloudflare');
--- app/Http/Controllers/Webhooks/CloudflareInboundController.php:23-27
   23      private const MAX_MESSAGE_BYTES = 26_214_400; // 25 MiB
   24  
   25      public function __invoke(
   26          Request $request,
   27          string $token,


===== EDGE E25c3a3987c =====
{"id": "E25c3a3987c", "from": "resources/js/composables/useCurrentUrl.ts:73", "to_symbol": "isCurrentUrl", "to": "resources/js/composables/useCurrentUrl.ts:37", "kind": "call", "note": "whenCurrentUrl"}
--- resources/js/composables/useCurrentUrl.ts:71-75
   71          ifFalse: any = null,
   72      ) {
   73          return isCurrentUrl(urlToCheck) ? ifTrue : ifFalse;
   74      }
   75  
--- resources/js/composables/useCurrentUrl.ts:35-39
   35  
   36  export function useCurrentUrl(): UseCurrentUrlReturn {
   37      function isCurrentUrl(
   38          urlToCheck: NonNullable<InertiaLinkProps['href']>,
   39          currentUrl?: string,


===== EDGE E2ce53b488e =====
{"id": "E2ce53b488e", "from": "tests/Feature/ThreadingTest.php:93", "to_symbol": "EmailSendService::send", "to": "app/Services/EmailSendService.php:34", "kind": "call"}
--- tests/Feature/ThreadingTest.php:91-95
   91      ])->assertStatus(202);
   92  
   93      $email = app(EmailSendService::class)->send($project, $source, [
   94          'from' => 'Support <support@example.com>',
   95          'to' => ['maya@customer.test'],
--- app/Services/EmailSendService.php:32-36
   32       * @param  array<string, mixed>  $payload
   33       */
   34      public function send(
   35          Project $project,
   36          ?Source $source,


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


===== EDGE E34a01c2b8e =====
{"id": "E34a01c2b8e", "from": "tests/Feature/InboundEmailTest.php:179", "to_symbol": "InboundEmailIngestor::ingest", "to": "app/Services/InboundEmailIngestor.php:29", "kind": "call"}
--- tests/Feature/InboundEmailTest.php:177-181
  177      ]);
  178  
  179      expect(fn () => app(InboundEmailIngestor::class)->ingest(
  180          $source,
  181          'maya@customer.test',
--- app/Services/InboundEmailIngestor.php:27-31
   27      ) {}
   28  
   29      public function ingest(Source $source, string $envelopeFrom, string $envelopeTo, string $mime): InboundEmail
   30      {
   31          $project = $source->project;


===== EDGE E34d57c4ca0 =====
{"id": "E34d57c4ca0", "from": "app/Services/CloudflareApiClient.php:107", "to_symbol": "CloudflareApiClient::normalizeSuppressionSnapshot", "to": "app/Services/CloudflareApiClient.php:123", "kind": "call", "note": "inside listStableSuppressions"}
--- app/Services/CloudflareApiClient.php:105-109
  105  
  106          for ($attempt = 0; $attempt < 3; $attempt++) {
  107              $snapshot = $this->normalizeSuppressionSnapshot($this->listSuppressionsUntil($source, $deadline));
  108  
  109              if ($previousSnapshot !== null && $snapshot === $previousSnapshot) {
--- app/Services/CloudflareApiClient.php:121-125
  121       * @return array<int, array{id: string, email: string, reason: string, created_at: string|null, expires_at: string|null}>
  122       */
  123      private function normalizeSuppressionSnapshot(array $suppressions): array
  124      {
  125          return collect($suppressions)


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


===== EDGE E35da9aa2bf =====
{"id": "E35da9aa2bf", "from": "routes/web.php:60", "to_symbol": "DashboardActionController::storeWebhookEndpoint", "to": "app/Http/Controllers/DashboardActionController.php:344", "kind": "route"}
--- routes/web.php:58-62
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
--- app/Http/Controllers/DashboardActionController.php:342-346
  342      }
  343  
  344      public function storeWebhookEndpoint(StoreWebhookEndpointRequest $request): RedirectResponse
  345      {
  346          $project = $this->projectFor(Auth::user());


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


===== EDGE E467c889d93 =====
{"id": "E467c889d93", "from": "app/Services/SuppressionRemovalService.php:61", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "inside remove (line 20)"}
--- app/Services/SuppressionRemovalService.php:59-63
   59          }
   60  
   61          $email = Suppression::normalizeEmail($suppression->email);
   62          $stillSuppressed = collect($upstreamSuppressions)
   63              ->contains(
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE E4736c71e62 =====
{"id": "E4736c71e62", "from": "resources/js/composables/useAppearance.ts:116", "to_symbol": "updateTheme", "to": "resources/js/composables/useAppearance.ts:13", "kind": "call", "note": "inside updateAppearance (line 107)"}
--- resources/js/composables/useAppearance.ts:114-118
  114          setCookie('appearance', value);
  115  
  116          updateTheme(value);
  117      }
  118  
--- resources/js/composables/useAppearance.ts:11-15
   11  };
   12  
   13  export function updateTheme(value: Appearance): void {
   14      if (typeof window === 'undefined') {
   15          return;


===== EDGE E4862882b86 =====
{"id": "E4862882b86", "from": "tests/Feature/SuppressionEmailNormalizationMigrationTest.php:295", "to_symbol": "SyncCloudflareSourceSuppressions", "to": "app/Jobs/SyncCloudflareSourceSuppressions.php:23", "kind": "use", "note": "instantiates and calls ->handle at line 296"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:293-297
  293      ]);
  294  
  295      (new SyncCloudflareSourceSuppressions($cloudflareSource->id))
  296          ->handle(app(CloudflareApiClient::class));
  297  
--- app/Jobs/SyncCloudflareSourceSuppressions.php:21-25
   21   */
   22  #[UniqueFor(3900)]
   23  class SyncCloudflareSourceSuppressions implements ShouldBeUnique, ShouldQueue
   24  {
   25      use Queueable;


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


===== EDGE E54460610e1 =====
{"id": "E54460610e1", "from": "app/Http/Controllers/OnboardingController.php:145", "to_symbol": "StoreOnboardingRequest", "to": "app/Http/Requests/StoreOnboardingRequest.php:10", "kind": "framework", "note": "FormRequest type-hint: validated on resolution"}
--- app/Http/Controllers/OnboardingController.php:143-147
  143      }
  144  
  145      public function store(StoreOnboardingRequest $request, ProjectContext $context): RedirectResponse
  146      {
  147          $workspace = $context->workspaceFor($request->user());
--- app/Http/Requests/StoreOnboardingRequest.php:8-12
    8  use Illuminate\Validation\Rule;
    9  
   10  class StoreOnboardingRequest extends FormRequest
   11  {
   12      public function authorize(): bool


===== EDGE E54e6c8c4b5 =====
{"id": "E54e6c8c4b5", "from": "resources/js/composables/useAppearance.ts:80", "to_symbol": "updateTheme", "to": "resources/js/composables/useAppearance.ts:13", "kind": "call", "note": "inside initializeTheme (line 73)"}
--- resources/js/composables/useAppearance.ts:78-82
   78      // Initialize theme from saved preference or default to system...
   79      const savedAppearance = getStoredAppearance();
   80      updateTheme(savedAppearance || 'system');
   81  
   82      // Set up system theme change listener...
--- resources/js/composables/useAppearance.ts:11-15
   11  };
   12  
   13  export function updateTheme(value: Appearance): void {
   14      if (typeof window === 'undefined') {
   15          return;


===== EDGE E56f0d91b5d =====
{"id": "E56f0d91b5d", "from": "tests/Feature/SesWebhookTest.php:195", "to_symbol": "SesEventNormalizer::record", "to": "app/Services/SesEventNormalizer.php:21", "kind": "call"}
--- tests/Feature/SesWebhookTest.php:193-197
  193  
  194      try {
  195          app(SesEventNormalizer::class)->record($source, [
  196              'eventType' => 'Delivery',
  197              'mail' => [
--- app/Services/SesEventNormalizer.php:19-23
   19       * @param  array<string, mixed>  $payload
   20       */
   21      public function record(Source $source, array $payload, ?string $providerMessageId = null): ?EmailEvent
   22      {
   23          $message = $payload['mail'] ?? [];


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


===== EDGE E58131e3efc =====
{"id": "E58131e3efc", "from": "app/Models/Suppression.php:124", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "normalizeEmails (line 121)"}
--- app/Models/Suppression.php:122-126
  122      {
  123          return collect($emails)
  124              ->map(fn (string $email): string => self::normalizeEmail($email))
  125              ->uniqueStrict()
  126              ->values()
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


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


===== EDGE E6408998ae3 =====
{"id": "E6408998ae3", "from": "app/Services/EmailSendService.php:241", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "ensureRecipientsAreSendable (line 237)"}
--- app/Services/EmailSendService.php:239-243
  239          $recipients = collect(['to', 'cc', 'bcc'])
  240              ->flatMap(fn (string $type) => $payload[$type] ?? [])
  241              ->map(fn (string $recipient): string => Suppression::normalizeEmail(
  242                  $this->mimeBuilder->splitAddress($recipient)['email'],
  243              ))
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE E6472831538 =====
{"id": "E6472831538", "from": "routes/web.php:115", "to_symbol": "DashboardActionController::retrySoftBounces", "to": "app/Http/Controllers/DashboardActionController.php:438", "kind": "route"}
--- routes/web.php:113-117
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
  117      Route::get('emails/{email:public_id}/preview', EmailPreviewController::class)->name('emails.preview');
--- app/Http/Controllers/DashboardActionController.php:436-440
  436      }
  437  
  438      public function retrySoftBounces(EmailSendService $emailSendService): RedirectResponse
  439      {
  440          $project = $this->projectFor(Auth::user());


===== EDGE E65910225fb =====
{"id": "E65910225fb", "from": "app/Services/EmailSendService.php:46", "to_symbol": "EmailSendService::ensureRecipientsAreSendable", "to": "app/Services/EmailSendService.php:237", "kind": "call", "note": "inside send (line 34)"}
--- app/Services/EmailSendService.php:44-48
   44          $from = $payload['from'] ?? $source->default_from_email;
   45          $this->ensureSourceCanSend($project, $source, (string) $from);
   46          $this->ensureRecipientsAreSendable($project, $payload);
   47  
   48          $publicId = 'email_'.Str::random(24);
--- app/Services/EmailSendService.php:235-239
  235       * @throws ValidationException
  236       */
  237      private function ensureRecipientsAreSendable(Project $project, array $payload): void
  238      {
  239          $recipients = collect(['to', 'cc', 'bcc'])


===== EDGE E65bb2836a6 =====
{"id": "E65bb2836a6", "from": "app/Services/EmailSendService.php:256", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call"}
--- app/Services/EmailSendService.php:254-258
  254              ->whereNormalizedEmailIn($recipients)
  255              ->pluck('email')
  256              ->map(fn (string $email): string => Suppression::normalizeEmail($email))
  257              ->all();
  258  
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


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


===== EDGE E668b69bc7e =====
{"id": "E668b69bc7e", "from": "tests/Feature/SuppressionEmailNormalizationMigrationTest.php:430", "to_symbol": "scopeWhereNormalizedEmailIn", "to": "app/Models/Suppression.php:65", "kind": "framework", "note": "Eloquent local scope"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:428-432
  428      $sesNormalizerSource = file_get_contents(app_path('Services/SesEventNormalizer.php'));
  429  
  430      $query = Suppression::query()->whereNormalizedEmailIn([
  431          ' ASCII@Example.com ',
  432          'ÄBC@Example.com',
--- app/Models/Suppression.php:63-67
   63       * @param  iterable<int, string>  $emails
   64       */
   65      public function scopeWhereNormalizedEmailIn(Builder $query, iterable $emails): void
   66      {
   67          $query->whereIn($this->normalizedEmailColumn(), $this->normalizeEmails($emails));


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


===== EDGE E692abcc108 =====
{"id": "E692abcc108", "from": "app/Services/CloudflareApiClient.php:128", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "normalizeSuppressionSnapshot (line 123)"}
--- app/Services/CloudflareApiClient.php:126-130
  126              ->map(fn (array $suppression): array => [
  127                  'id' => trim($suppression['id']),
  128                  'email' => Suppression::normalizeEmail($suppression['email']),
  129                  'reason' => trim($suppression['reason']),
  130                  'created_at' => $suppression['created_at'],
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE E6d2b96ae60 =====
{"id": "E6d2b96ae60", "from": "resources/js/composables/useAppearance.ts:70", "to_symbol": "updateTheme", "to": "resources/js/composables/useAppearance.ts:13", "kind": "call", "note": "inside handleSystemThemeChange (line 67)"}
--- resources/js/composables/useAppearance.ts:68-72
   68      const currentAppearance = getStoredAppearance();
   69  
   70      updateTheme(currentAppearance || 'system');
   71  };
   72  
--- resources/js/composables/useAppearance.ts:11-15
   11  };
   12  
   13  export function updateTheme(value: Appearance): void {
   14      if (typeof window === 'undefined') {
   15          return;


===== EDGE E6feea2d242 =====
{"id": "E6feea2d242", "from": "routes/api.php:18", "to_symbol": "SesWebhookController::__invoke", "to": "app/Http/Controllers/Webhooks/SesWebhookController.php:17", "kind": "route"}
--- routes/api.php:16-20
   16  });
   17  
   18  Route::post('webhooks/ses/{token}', SesWebhookController::class)
   19      ->middleware('throttle:120,1')
   20      ->name('webhooks.ses');
--- app/Http/Controllers/Webhooks/SesWebhookController.php:15-19
   15  class SesWebhookController extends Controller
   16  {
   17      public function __invoke(Request $request, string $token, SesEventNormalizer $normalizer, SnsSignatureVerifier $signatureVerifier): JsonResponse
   18      {
   19          $source = Source::query()->where('webhook_token', $token)->firstOrFail();


===== EDGE E705fd15b28 =====
{"id": "E705fd15b28", "from": "app/Http/Controllers/DashboardActionController.php:310", "to_symbol": "DashboardActionController::deleteSuppression", "to": "app/Http/Controllers/DashboardActionController.php:321", "kind": "call", "note": "destroySuppression"}
--- app/Http/Controllers/DashboardActionController.php:308-312
  308          SuppressionRemovalService $removalService,
  309      ): RedirectResponse {
  310          return $this->deleteSuppression($suppression, $removalService);
  311      }
  312  
--- app/Http/Controllers/DashboardActionController.php:319-323
  319      }
  320  
  321      private function deleteSuppression(
  322          Suppression $suppression,
  323          SuppressionRemovalService $removalService,


===== EDGE E71111dc028 =====
{"id": "E71111dc028", "from": "app/Http/Controllers/DashboardActionController.php:344", "to_symbol": "StoreWebhookEndpointRequest", "to": "app/Http/Requests/StoreWebhookEndpointRequest.php:10", "kind": "framework", "note": "FormRequest type-hint: validated on resolution"}
--- app/Http/Controllers/DashboardActionController.php:342-346
  342      }
  343  
  344      public function storeWebhookEndpoint(StoreWebhookEndpointRequest $request): RedirectResponse
  345      {
  346          $project = $this->projectFor(Auth::user());
--- app/Http/Requests/StoreWebhookEndpointRequest.php:8-12
    8  use Illuminate\Validation\Rule;
    9  
   10  class StoreWebhookEndpointRequest extends FormRequest
   11  {
   12      /**


===== EDGE E71f6b4db9d =====
{"id": "E71f6b4db9d", "from": "routes/web.php:71", "to_symbol": "ThreadActionController::forward", "to": "app/Http/Controllers/ThreadActionController.php:160", "kind": "route"}
--- routes/web.php:69-73
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
   73          Route::post('threads/{thread:public_id}/unsnooze', [ThreadActionController::class, 'unsnooze'])->name('threads.unsnooze');
--- app/Http/Controllers/ThreadActionController.php:158-162
  158       * original attachments and quoting the original in the body.
  159       */
  160      public function forward(Request $request, string $projectSlug, Thread $thread): RedirectResponse
  161      {
  162          $project = $this->authorizeThread($thread);


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


===== EDGE E787d3207b4 =====
{"id": "E787d3207b4", "from": "app/Services/SesEventNormalizer.php:171", "to_symbol": "SesEventNormalizer::upsertSqlServerSuppression", "to": "app/Services/SesEventNormalizer.php:190", "kind": "call"}
--- app/Services/SesEventNormalizer.php:169-173
  169  
  170          if ($connection->getDriverName() === 'sqlsrv') {
  171              $this->upsertSqlServerSuppression($connection, $attributes);
  172  
  173              return;
--- app/Services/SesEventNormalizer.php:188-192
  188       * @param  array<string, mixed>  $attributes
  189       */
  190      private function upsertSqlServerSuppression(ConnectionInterface $connection, array $attributes): void
  191      {
  192          $timestamp = now();


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


===== EDGE E797b8baa92 =====
{"id": "E797b8baa92", "from": "app/Jobs/SyncCloudflareSuppressions.php:40", "to_symbol": "SyncCloudflareSourceSuppressions", "to": "app/Jobs/SyncCloudflareSourceSuppressions.php:23", "kind": "dispatch"}
--- app/Jobs/SyncCloudflareSuppressions.php:38-42
   38          $sourceIds
   39              ->take(self::BATCH_SIZE)
   40              ->each(fn (int $sourceId) => SyncCloudflareSourceSuppressions::dispatch($sourceId));
   41  
   42          if ($sourceIds->count() > self::BATCH_SIZE) {
--- app/Jobs/SyncCloudflareSourceSuppressions.php:21-25
   21   */
   22  #[UniqueFor(3900)]
   23  class SyncCloudflareSourceSuppressions implements ShouldBeUnique, ShouldQueue
   24  {
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


===== EDGE E810482ea8a =====
{"id": "E810482ea8a", "from": "app/Http/Controllers/DashboardActionController.php:405", "to_symbol": "DashboardActionController::resendStoredEmail", "to": "app/Http/Controllers/DashboardActionController.php:408", "kind": "call", "note": "resendProjectEmail"}
--- app/Http/Controllers/DashboardActionController.php:403-407
  403          $project = $this->projectFor(Auth::user());
  404  
  405          return $this->resendStoredEmail($project, $email, $emailSendService);
  406      }
  407  
--- app/Http/Controllers/DashboardActionController.php:406-410
  406      }
  407  
  408      private function resendStoredEmail(Project $project, Email $email, EmailSendService $emailSendService): RedirectResponse
  409      {
  410          $this->authorizeWorkspaceCapability($project, 'send');


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


===== EDGE E89134a0330 =====
{"id": "E89134a0330", "from": "app/Services/SuppressionRemovalService.php:64", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call"}
--- app/Services/SuppressionRemovalService.php:62-66
   62          $stillSuppressed = collect($upstreamSuppressions)
   63              ->contains(
   64                  fn (array $upstream): bool => Suppression::normalizeEmail($upstream['email']) === $email,
   65              );
   66  
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


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


===== EDGE E90779764de =====
{"id": "E90779764de", "from": "routes/web.php:112", "to_symbol": "DashboardActionController::storeWebhookEndpoint", "to": "app/Http/Controllers/DashboardActionController.php:344", "kind": "route"}
--- routes/web.php:110-114
  110      Route::post('api-keys/{apiKey}/rotate', [DashboardActionController::class, 'rotateApiKey'])->name('api-keys.rotate');
  111      Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
--- app/Http/Controllers/DashboardActionController.php:342-346
  342      }
  343  
  344      public function storeWebhookEndpoint(StoreWebhookEndpointRequest $request): RedirectResponse
  345      {
  346          $project = $this->projectFor(Auth::user());


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


===== EDGE Ea248f65b61 =====
{"id": "Ea248f65b61", "from": "tests/Feature/SuppressionEmailNormalizationMigrationTest.php:156", "to_symbol": "SesEventNormalizer::record", "to": "app/Services/SesEventNormalizer.php:21", "kind": "call"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:154-158
  154      DB::enableQueryLog();
  155  
  156      app(SesEventNormalizer::class)->record($sesSource, [
  157          'eventType' => 'Complaint',
  158          'mail' => [
--- app/Services/SesEventNormalizer.php:19-23
   19       * @param  array<string, mixed>  $payload
   20       */
   21      public function record(Source $source, array $payload, ?string $providerMessageId = null): ?EmailEvent
   22      {
   23          $message = $payload['mail'] ?? [];


===== EDGE Ea6d80cf6fb =====
{"id": "Ea6d80cf6fb", "from": "routes/api.php:15", "to_symbol": "SuppressionController::destroy", "to": "app/Http/Controllers/Api/SuppressionController.php:17", "kind": "route"}
--- routes/api.php:13-17
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
   16  });
   17  
--- app/Http/Controllers/Api/SuppressionController.php:15-19
   15  class SuppressionController extends Controller
   16  {
   17      public function destroy(
   18          Request $request,
   19          Suppression $suppression,


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


===== EDGE Ea945685da9 =====
{"id": "Ea945685da9", "from": "app/Http/Requests/StoreWebhookEndpointRequest.php:28", "to_symbol": "PublicWebhookUrl", "to": "app/Rules/PublicWebhookUrl.php:10", "kind": "use", "note": "new PublicWebhookUrl in rules()"}
--- app/Http/Requests/StoreWebhookEndpointRequest.php:26-30
   26      {
   27          return [
   28              'url' => ['required', 'url:http,https', 'max:2048', new PublicWebhookUrl],
   29              'events' => ['required', 'array', 'min:1'],
   30              'events.*' => ['string', Rule::in(['delivery', 'bounce', 'complaint', 'open', 'click', 'suppress', 'inbound.received'])],
--- app/Rules/PublicWebhookUrl.php:8-12
    8  use Illuminate\Translation\PotentiallyTranslatedString;
    9  
   10  class PublicWebhookUrl implements ValidationRule
   11  {
   12      public function __construct(private ?WebhookUrlGuard $guard = null) {}


===== EDGE Eaa938a5186 =====
{"id": "Eaa938a5186", "from": "app/Http/Requests/StoreOnboardingRequest.php:49", "to_symbol": "PublicWebhookUrl", "to": "app/Rules/PublicWebhookUrl.php:10", "kind": "use", "note": "new PublicWebhookUrl in rules()"}
--- app/Http/Requests/StoreOnboardingRequest.php:47-51
   47              'create_api_key' => ['boolean'],
   48              'api_key_name' => ['nullable', 'string', 'max:255'],
   49              'webhook_url' => ['nullable', 'url:http,https', 'max:2048', new PublicWebhookUrl],
   50          ];
   51      }
--- app/Rules/PublicWebhookUrl.php:8-12
    8  use Illuminate\Translation\PotentiallyTranslatedString;
    9  
   10  class PublicWebhookUrl implements ValidationRule
   11  {
   12      public function __construct(private ?WebhookUrlGuard $guard = null) {}


===== EDGE Eab32b67abe =====
{"id": "Eab32b67abe", "from": "app/Services/SesEventNormalizer.php:199", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "upsertSqlServerSuppression (line 190)"}
--- app/Services/SesEventNormalizer.php:197-201
  197              $attributes['email_id'],
  198              $attributes['email'],
  199              Suppression::normalizeEmail($attributes['email']),
  200              $attributes['reason'],
  201              $attributes['event_type'],
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE Eacae3451f6 =====
{"id": "Eacae3451f6", "from": "routes/web.php:33", "to_symbol": "OnboardingController::store", "to": "app/Http/Controllers/OnboardingController.php:145", "kind": "route"}
--- routes/web.php:31-35
   31      Route::get('dashboard', [OnboardingController::class, 'entry'])->name('dashboard');
   32      Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
   33      Route::post('onboarding', [OnboardingController::class, 'store'])->name('onboarding.store');
   34      Route::post('onboarding/validate', [OnboardingController::class, 'validateCredentials'])->name('onboarding.validate');
   35      Route::get('projects', ActivityController::class)->defaults('section', 'projects')->name('projects.index');
--- app/Http/Controllers/OnboardingController.php:143-147
  143      }
  144  
  145      public function store(StoreOnboardingRequest $request, ProjectContext $context): RedirectResponse
  146      {
  147          $workspace = $context->workspaceFor($request->user());


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


===== EDGE Eb17974be7b =====
{"id": "Eb17974be7b", "from": "routes/web.php:113", "to_symbol": "DashboardActionController::updateWebhookEndpoint", "to": "app/Http/Controllers/DashboardActionController.php:362", "kind": "route"}
--- routes/web.php:111-115
  111      Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
--- app/Http/Controllers/DashboardActionController.php:360-364
  360      }
  361  
  362      public function updateWebhookEndpoint(StoreWebhookEndpointRequest $request, WebhookEndpoint $endpoint): RedirectResponse
  363      {
  364          $project = $this->projectFor(Auth::user());


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


===== EDGE Eb89d80fd9e =====
{"id": "Eb89d80fd9e", "from": "routes/web.php:95", "to_symbol": "DashboardActionController::destroySuppression", "to": "app/Http/Controllers/DashboardActionController.php:306", "kind": "route"}
--- routes/web.php:93-97
   93      Route::get('complaints', ActivityController::class)->defaults('section', 'complaints')->name('complaints');
   94      Route::get('suppressions', ActivityController::class)->defaults('section', 'suppressions')->name('suppressions');
   95      Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroySuppression'])->name('suppressions.destroy');
   96      Route::get('identities', ActivityController::class)->defaults('section', 'identities')->name('identities');
   97      Route::get('templates', ActivityController::class)->defaults('section', 'templates')->name('templates');
--- app/Http/Controllers/DashboardActionController.php:304-308
  304      }
  305  
  306      public function destroySuppression(
  307          Suppression $suppression,
  308          SuppressionRemovalService $removalService,


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


===== EDGE Ebea7896261 =====
{"id": "Ebea7896261", "from": "routes/web.php:62", "to_symbol": "DashboardActionController::sendEmail", "to": "app/Http/Controllers/DashboardActionController.php:376", "kind": "route"}
--- routes/web.php:60-64
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
--- app/Http/Controllers/DashboardActionController.php:374-378
  374      }
  375  
  376      public function sendEmail(DashboardSendEmailRequest $request, EmailSendService $emailSendService): RedirectResponse
  377      {
  378          $project = $this->projectFor(Auth::user());


===== EDGE Ebefe0cacdf =====
{"id": "Ebefe0cacdf", "from": "routes/web.php:70", "to_symbol": "ThreadActionController::reply", "to": "app/Http/Controllers/ThreadActionController.php:34", "kind": "route"}
--- routes/web.php:68-72
   68          Route::post('threads/{thread:public_id}/archive', [ThreadActionController::class, 'archive'])->name('threads.archive');
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
--- app/Http/Controllers/ThreadActionController.php:32-36
   32       * so every mail client (and our own resolver) keeps it in the thread.
   33       */
   34      public function reply(Request $request, string $projectSlug, Thread $thread): RedirectResponse
   35      {
   36          $project = $this->authorizeThread($thread);


===== EDGE Ec311600457 =====
{"id": "Ec311600457", "from": "tests/Feature/DatabaseSeederSafetyTest.php:24", "to_symbol": "DatabaseSeeder::run", "to": "database/seeders/DatabaseSeeder.php:26", "kind": "framework", "note": "$this->seed(DatabaseSeeder::class) runs the seeder"}
--- tests/Feature/DatabaseSeederSafetyTest.php:22-26
   22      ]);
   23  
   24      $this->seed(DatabaseSeeder::class);
   25  
   26      expect($project->fresh())
--- database/seeders/DatabaseSeeder.php:24-28
   24      public function __construct(private InboxDemoSeeder $inboxDemoSeeder) {}
   25  
   26      public function run(): void
   27      {
   28          if (! app()->environment(['local', 'testing'])) {


===== EDGE Ec3eeedf568 =====
{"id": "Ec3eeedf568", "from": "routes/web.php:64", "to_symbol": "DashboardActionController::resendProjectEmail", "to": "app/Http/Controllers/DashboardActionController.php:401", "kind": "route"}
--- routes/web.php:62-66
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   66          Route::post('threads/{thread:public_id}/read', [ThreadActionController::class, 'read'])->name('threads.read');
--- app/Http/Controllers/DashboardActionController.php:399-403
  399      }
  400  
  401      public function resendProjectEmail(string $projectSlug, Email $email, EmailSendService $emailSendService): RedirectResponse
  402      {
  403          $project = $this->projectFor(Auth::user());


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


===== EDGE Ec9b6c58409 =====
{"id": "Ec9b6c58409", "from": "routes/console.php:22", "to_symbol": "SyncCloudflareSuppressions", "to": "app/Jobs/SyncCloudflareSuppressions.php:17", "kind": "framework", "note": "Schedule::job hourly"}
--- routes/console.php:20-24
   20      ->onOneServer();
   21  Schedule::job(new RecoverStuckQueuedEmails)->everyMinute()->withoutOverlapping()->onOneServer();
   22  Schedule::job(new SyncCloudflareSuppressions)->hourly()->withoutOverlapping()->onOneServer();
   23  Schedule::job(new RecheckPendingDomains)->everyTenMinutes()->withoutOverlapping()->onOneServer();
   24  Schedule::job(new SyncStaleSourceQuotas)->everyThirtyMinutes()->withoutOverlapping()->onOneServer();
--- app/Jobs/SyncCloudflareSuppressions.php:15-19
   15   */
   16  #[UniqueFor(3900)]
   17  class SyncCloudflareSuppressions implements ShouldBeUnique, ShouldQueue
   18  {
   19      use Queueable;


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


===== EDGE Ed5f16e1864 =====
{"id": "Ed5f16e1864", "from": "app/Services/SesEventNormalizer.php:70", "to_symbol": "SesEventNormalizer::recordSuppression", "to": "app/Services/SesEventNormalizer.php:141", "kind": "call", "note": "inside record (line 21)"}
--- app/Services/SesEventNormalizer.php:68-72
   68  
   69              if ($lockedEmail) {
   70                  $this->recordSuppression($lockedEmail, $eventType, $payload, $recipient);
   71              }
   72  
--- app/Services/SesEventNormalizer.php:139-143
  139       * @param  array<string, mixed>  $payload
  140       */
  141      private function recordSuppression(Email $email, string $eventType, array $payload, ?string $recipient): void
  142      {
  143          if (! $recipient) {


===== EDGE Ed7b64b1b44 =====
{"id": "Ed7b64b1b44", "from": "app/Services/SesEventNormalizer.php:159", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "recordSuppression (line 141)"}
--- app/Services/SesEventNormalizer.php:157-161
  157          $attributes = (new Suppression)->forceFill([
  158              'project_id' => $email->project_id,
  159              'email' => Suppression::normalizeEmail($recipient),
  160              'workspace_id' => $email->workspace_id,
  161              'source_id' => $email->source_id,
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


===== EDGE Eda8663218c =====
{"id": "Eda8663218c", "from": "routes/web.php:114", "to_symbol": "DashboardActionController::sendEmail", "to": "app/Http/Controllers/DashboardActionController.php:376", "kind": "route"}
--- routes/web.php:112-116
  112      Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
  113      Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
  114      Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
  115      Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
  116      Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendEmail'])->name('emails.resend');
--- app/Http/Controllers/DashboardActionController.php:374-378
  374      }
  375  
  376      public function sendEmail(DashboardSendEmailRequest $request, EmailSendService $emailSendService): RedirectResponse
  377      {
  378          $project = $this->projectFor(Auth::user());


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


===== EDGE Edc2cfd98b7 =====
{"id": "Edc2cfd98b7", "from": "tests/Unit/WebhookUrlGuardTest.php:8", "to_symbol": "WebhookUrlGuard::isSafe", "to": "app/Services/WebhookUrlGuard.php:11", "kind": "call"}
--- tests/Unit/WebhookUrlGuardTest.php:6-10
    6  
    7  it('rejects local and private webhook destinations', function (string $url) {
    8      expect((new WebhookUrlGuard)->isSafe($url))->toBeFalse();
    9  })->with([
   10      'localhost' => 'http://localhost/internal',
--- app/Services/WebhookUrlGuard.php:9-13
    9  class WebhookUrlGuard
   10  {
   11      public function isSafe(string $url): bool
   12      {
   13          try {


===== EDGE Edd46319ae9 =====
{"id": "Edd46319ae9", "from": "app/Models/Suppression.php:58", "to_symbol": "Suppression::normalizeEmail", "to": "app/Models/Suppression.php:44", "kind": "call", "note": "scopeWhereNormalizedEmail (line 56)"}
--- app/Models/Suppression.php:56-60
   56      public function scopeWhereNormalizedEmail(Builder $query, string $email): void
   57      {
   58          $query->where($this->normalizedEmailColumn(), self::normalizeEmail($email));
   59      }
   60  
--- app/Models/Suppression.php:42-46
   42      }
   43  
   44      public static function normalizeEmail(string $email): string
   45      {
   46          return strtr(


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


===== EDGE Edf60e6a0a8 =====
{"id": "Edf60e6a0a8", "from": "app/Http/Controllers/DashboardActionController.php:362", "to_symbol": "StoreWebhookEndpointRequest", "to": "app/Http/Requests/StoreWebhookEndpointRequest.php:10", "kind": "framework", "note": "FormRequest type-hint: validated on resolution"}
--- app/Http/Controllers/DashboardActionController.php:360-364
  360      }
  361  
  362      public function updateWebhookEndpoint(StoreWebhookEndpointRequest $request, WebhookEndpoint $endpoint): RedirectResponse
  363      {
  364          $project = $this->projectFor(Auth::user());
--- app/Http/Requests/StoreWebhookEndpointRequest.php:8-12
    8  use Illuminate\Validation\Rule;
    9  
   10  class StoreWebhookEndpointRequest extends FormRequest
   11  {
   12      /**


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


===== EDGE Eeaf6540786 =====
{"id": "Eeaf6540786", "from": "app/Models/Suppression.php:67", "to_symbol": "Suppression::normalizeEmails", "to": "app/Models/Suppression.php:121", "kind": "call", "note": "scopeWhereNormalizedEmailIn (line 65)"}
--- app/Models/Suppression.php:65-69
   65      public function scopeWhereNormalizedEmailIn(Builder $query, iterable $emails): void
   66      {
   67          $query->whereIn($this->normalizedEmailColumn(), $this->normalizeEmails($emails));
   68      }
   69  
--- app/Models/Suppression.php:119-123
  119       * @return array<int, string>
  120       */
  121      private function normalizeEmails(iterable $emails): array
  122      {
  123          return collect($emails)


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


===== EDGE Eefad89ef47 =====
{"id": "Eefad89ef47", "from": "routes/web.php:59", "to_symbol": "DashboardActionController::destroyProjectSuppression", "to": "app/Http/Controllers/DashboardActionController.php:313", "kind": "route"}
--- routes/web.php:57-61
   57          Route::post('api-keys/{apiKey}/rotate', [DashboardActionController::class, 'rotateApiKey'])->name('api-keys.rotate');
   58          Route::delete('api-keys/{apiKey}', [DashboardActionController::class, 'destroyApiKey'])->name('api-keys.destroy');
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
--- app/Http/Controllers/DashboardActionController.php:311-315
  311      }
  312  
  313      public function destroyProjectSuppression(
  314          string $projectSlug,
  315          Suppression $suppression,


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


===== EDGE Ef3d7e9130a =====
{"id": "Ef3d7e9130a", "from": "tests/Pest.php:23", "to_symbol": "WebhookUrlGuard", "to": "app/Services/WebhookUrlGuard.php:9", "kind": "use", "note": "anonymous subclass (overrides resolveHost only) inherits isSafe and is container-bound for Feature tests, so PublicWebhookUrl's app(WebhookUrlGuard) resolves to it"}
--- tests/Pest.php:21-25
   21      ->beforeEach(function (): void {
   22          $this->withoutVite();
   23          $this->app->bind(WebhookUrlGuard::class, fn () => new class extends WebhookUrlGuard
   24          {
   25              protected function resolveHost(string $host): array
--- app/Services/WebhookUrlGuard.php:7-11
    7  use Throwable;
    8  
    9  class WebhookUrlGuard
   10  {
   11      public function isSafe(string $url): bool


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


===== EDGE Ef483927c77 =====
{"id": "Ef483927c77", "from": "app/Http/Controllers/DashboardActionController.php:398", "to_symbol": "DashboardActionController::resendStoredEmail", "to": "app/Http/Controllers/DashboardActionController.php:408", "kind": "call", "note": "resendEmail"}
--- app/Http/Controllers/DashboardActionController.php:396-400
  396          $project = $this->projectFor(Auth::user());
  397  
  398          return $this->resendStoredEmail($project, $email, $emailSendService);
  399      }
  400  
--- app/Http/Controllers/DashboardActionController.php:406-410
  406      }
  407  
  408      private function resendStoredEmail(Project $project, Email $email, EmailSendService $emailSendService): RedirectResponse
  409      {
  410          $this->authorizeWorkspaceCapability($project, 'send');


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


===== EDGE Ef5aa9a66e2 =====
{"id": "Ef5aa9a66e2", "from": "app/Services/EmailSendService.php:156", "to_symbol": "EmailSendService::fromAddressUsesVerifiedDomain", "to": "app/Services/EmailSendService.php:195", "kind": "call"}
--- app/Services/EmailSendService.php:154-158
  154          }
  155  
  156          if (! $this->fromAddressUsesVerifiedDomain($project, $from)) {
  157              throw ValidationException::withMessages([
  158                  'from' => 'The sender domain is not verified for this project.',
--- app/Services/EmailSendService.php:193-197
  193      }
  194  
  195      private function fromAddressUsesVerifiedDomain(Project $project, string $from): bool
  196      {
  197          $fromDomain = Str::lower(Str::after($this->mimeBuilder->splitAddress($from)['email'], '@'));


===== EDGE Ef5ca6dad01 =====
{"id": "Ef5ca6dad01", "from": "routes/web.php:76", "to_symbol": "ThreadActionController::compose", "to": "app/Http/Controllers/ThreadActionController.php:107", "kind": "route"}
--- routes/web.php:74-78
   74          Route::post('threads/{thread:public_id}/notes', [ThreadActionController::class, 'storeNote'])->name('threads.notes.store');
   75          Route::patch('threads/{thread:public_id}/workflow', [ThreadActionController::class, 'updateWorkflow'])->name('threads.workflow.update');
   76          Route::post('inbox/compose', [ThreadActionController::class, 'compose'])->name('inbox.compose');
   77          Route::post('inbox/bulk', [ThreadActionController::class, 'bulk'])->name('inbox.bulk');
   78          Route::get('inbound/{inboundEmail:public_id}/attachments/{index}', InboundAttachmentController::class)
--- app/Http/Controllers/ThreadActionController.php:105-109
  105       * Start a brand-new conversation from the inbox composer.
  106       */
  107      public function compose(Request $request, string $projectSlug): RedirectResponse
  108      {
  109          $user = Auth::user();


===== EDGE Ef6c459d08a =====
{"id": "Ef6c459d08a", "from": "app/Http/Controllers/DashboardActionController.php:318", "to_symbol": "DashboardActionController::deleteSuppression", "to": "app/Http/Controllers/DashboardActionController.php:321", "kind": "call", "note": "destroyProjectSuppression"}
--- app/Http/Controllers/DashboardActionController.php:316-320
  316          SuppressionRemovalService $removalService,
  317      ): RedirectResponse {
  318          return $this->deleteSuppression($suppression, $removalService);
  319      }
  320  
--- app/Http/Controllers/DashboardActionController.php:319-323
  319      }
  320  
  321      private function deleteSuppression(
  322          Suppression $suppression,
  323          SuppressionRemovalService $removalService,


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