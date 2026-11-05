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