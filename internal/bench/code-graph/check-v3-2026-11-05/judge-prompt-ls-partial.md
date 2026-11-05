You are a judge establishing ground truth for a code-navigation benchmark. You cannot read the repository; the source lines below were extracted mechanically from the subject at its registered pin, with line numbers. A reader with repository access proposed an answer set; a static reference engine (the oracle) listed files where it could. Neither is authoritative.

For every ITEM:

1. For every candidate file decide `IN` (belongs in the answer to the registered question) or `OUT`, and give a one-line reason grounded in the shown source lines. If the shown lines are insufficient to decide, answer `UNSURE` and say what you would need to see.
2. Name any file the shown source implies must be in the answer but is not among the candidates (`missing`), citing the line that implies it.
3. If the question is ambiguous or not answerable as registered, say so in `item_note`.

Answer the question as worded. Do not reward or penalise a file for who proposed it.

Return ONLY a JSON object, no prose around it:
{"items": [{"id": "<item id>", "files": [{"path": "<path>", "verdict": "IN|OUT|UNSURE", "reason": "<one line>"}], "missing": [{"path": "<path>", "reason": "<one line>"}], "item_note": "<text or empty>"}]}


Subject: `larasend` at its registered pin.



========== ITEM ls-b-04 ==========
Question (registered, verbatim):
{
 "id": "ls-b-04",
 "suite": "B",
 "class": "precise-semantics",
 "shape": "callers",
 "subject": "larasend",
 "language": "ts",
 "question": "Which files call the toUrl helper declared in resources/js/lib/utils.ts?",
 "probe": "toUrl",
 "declared_in": "resources/js/lib/utils.ts:10",
 "hop_stratum": 1,
 "basis": [
  "resources/js/composables/useCurrentUrl.ts:5,43 -- import and call",
  "resources/js/components/NavFooter.vue:9,32 -- import and template call",
  "resources/js/components/AppHeader.vue:37,131,218 -- import and template calls"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["scip-typescript does not index .vue single-file components; Vue call sites need the human reading"]

Reader notes: answerable_as_registered=True; Oracle missed both Vue callers because scip-typescript does not index .vue files.
Reader on the oracle's open list: Vue SFCs read by hand: exactly two .vue files reference toUrl (NavFooter.vue, AppHeader.vue). A word-boundary grep over resources, app, routes, tests finds no other occurrence.

Candidate files (6):

* resources/js/composables/useCurrentUrl.ts  {"proposed_by_reader": true, "reader_reason": "imports toUrl and calls it inside isCurrentUrl", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct call at :43"}
--- resources/js/composables/useCurrentUrl.ts:2-8
    2  import { usePage } from '@inertiajs/vue3';
    3  import type { ComputedRef, DeepReadonly } from 'vue';
    4  import { computed, readonly } from 'vue';
    5  import { toUrl } from '@/lib/utils';
    6  
    7  export type UseCurrentUrlReturn = {
    8      currentUrl: DeepReadonly<ComputedRef<string>>;
--- resources/js/composables/useCurrentUrl.ts:40-46
   40          startsWith: boolean = false,
   41      ) {
   42          const urlToCompare = currentUrl ?? currentUrlReactive.value;
   43          const urlString = toUrl(urlToCheck);
   44  
   45          const comparePath = (path: string): boolean =>
   46              startsWith ? urlToCompare.startsWith(path) : path === urlToCompare;

* resources/js/components/NavFooter.vue  {"proposed_by_reader": true, "reader_reason": "imports toUrl and calls it in the template :href binding"}
--- resources/js/components/NavFooter.vue:6-12
    6      SidebarMenuButton,
    7      SidebarMenuItem,
    8  } from '@/components/ui/sidebar';
    9  import { toUrl } from '@/lib/utils';
   10  import type { NavItem } from '@/types';
   11  
   12  type Props = {
--- resources/js/components/NavFooter.vue:29-35
   29                          as-child
   30                      >
   31                          <a
   32                              :href="toUrl(item.href)"
   33                              target="_blank"
   34                              rel="noopener noreferrer"
   35                          >

* resources/js/components/AppHeader.vue  {"proposed_by_reader": true, "reader_reason": "imports toUrl and calls it in two template :href bindings"}
--- resources/js/components/AppHeader.vue:34-40
   34  import UserMenuContent from '@/components/UserMenuContent.vue';
   35  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   36  import { getInitials } from '@/composables/useInitials';
   37  import { toUrl } from '@/lib/utils';
   38  import { dashboard } from '@/routes';
   39  import type { BreadcrumbItem, NavItem } from '@/types';
   40  
--- resources/js/components/AppHeader.vue:128-134
  128                                      <a
  129                                          v-for="item in rightNavItems"
  130                                          :key="item.title"
  131                                          :href="toUrl(item.href)"
  132                                          target="_blank"
  133                                          rel="noopener noreferrer"
  134                                          class="flex items-center space-x-2 text-sm font-medium"
--- resources/js/components/AppHeader.vue:215-221
  215                                                  class="group h-9 w-9 cursor-pointer"
  216                                              >
  217                                                  <a
  218                                                      :href="toUrl(item.href)"
  219                                                      target="_blank"
  220                                                      rel="noopener noreferrer"
  221                                                  >

* resources/js/lib/utils.ts  {"proposed_by_reader": false, "reader_excluded_because": "declaring file (:10); no self-call of toUrl"}
--- resources/js/lib/utils.ts:7-13
    7      return twMerge(clsx(inputs));
    8  }
    9  
   10  export function toUrl(href: NonNullable<InertiaLinkProps['href']>) {
   11      return typeof href === 'string' ? href : href?.url;
   12  }
   13  

* resources/js/components/NavMain.vue  {"proposed_by_reader": false, "reader_excluded_because": "uses useCurrentUrl (indirect, hop 2), never calls toUrl itself"}
--- resources/js/components/NavMain.vue: none of ['toUrl'] appears in the file

* resources/js/layouts/settings/Layout.vue  {"proposed_by_reader": false, "reader_excluded_because": "uses useCurrentUrl (indirect, hop 2), never calls toUrl itself"}
--- resources/js/layouts/settings/Layout.vue: none of ['toUrl'] appears in the file


========== ITEM ls-b-05 ==========
Question (registered, verbatim):
{
 "id": "ls-b-05",
 "suite": "B",
 "class": "precise-semantics",
 "shape": "callers-transitive",
 "subject": "larasend",
 "language": "ts",
 "question": "Which files reach updateTheme within two call hops?",
 "probe": "updateTheme",
 "declared_in": "resources/js/composables/useAppearance.ts:13",
 "hop_stratum": 2,
 "basis": [
  "resources/js/composables/useAppearance.ts:80 -- initializeTheme() calls updateTheme",
  "resources/js/app.ts:2,36 -- imports and calls initializeTheme (second hop)"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["scip-typescript does not index .vue single-file components; Vue call sites need the human reading"]

Reader notes: answerable_as_registered=True; The corpus basis lists useAppearance.ts and app.ts. It misses AppearanceTabs.vue, which is a two-hop caller through updateAppearance. Reading 'reach' as 'calls the composable that defines a caller' would add TwoFactorSetupModal.vue and Sonner.vue, but neither executes a path that reaches updateTheme.
Reader on the oracle's open list: Vue SFCs read by hand: AppearanceTabs.vue is the only .vue file that invokes a function reaching updateTheme (updateAppearance). The other two useAppearance consumers only read reactive state.

Candidate files (6):

* resources/js/composables/useAppearance.ts  {"proposed_by_reader": true, "reader_reason": "hop 1: handleSystemThemeChange, initializeTheme and updateAppearance (inside useAppearance) all call updateTheme", "listed_by_oracle": true, "reader_on_oracle_file": "keep: declares and internally calls updateTheme (hop 1)"}
--- resources/js/composables/useAppearance.ts:67-73
   67  const handleSystemThemeChange = () => {
   68      const currentAppearance = getStoredAppearance();
   69  
   70      updateTheme(currentAppearance || 'system');
   71  };
   72  
   73  export function initializeTheme(): void {
--- resources/js/composables/useAppearance.ts:77-83
   77  
   78      // Initialize theme from saved preference or default to system...
   79      const savedAppearance = getStoredAppearance();
   80      updateTheme(savedAppearance || 'system');
   81  
   82      // Set up system theme change listener...
   83      mediaQuery()?.addEventListener('change', handleSystemThemeChange);
--- resources/js/composables/useAppearance.ts:113-119
  113          // Store in cookie for SSR...
  114          setCookie('appearance', value);
  115  
  116          updateTheme(value);
  117      }
  118  
  119      return {

* resources/js/app.ts  {"proposed_by_reader": true, "reader_reason": "hop 2: calls initializeTheme, which calls updateTheme"}
--- resources/js/app.ts:1-5
    1  import { createInertiaApp } from '@inertiajs/vue3';
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
--- resources/js/app.ts:33-39
   33  });
   34  
   35  // This will set light / dark mode on page load...
   36  initializeTheme();
   37  
   38  // This will listen for flash toast data from the server...
   39  initializeFlashToast();

* resources/js/components/AppearanceTabs.vue  {"proposed_by_reader": true, "reader_reason": "hop 2: @click calls updateAppearance, which calls updateTheme at useAppearance.ts:116"}
--- resources/js/components/AppearanceTabs.vue:2-8
    2  import { Monitor, Moon, Sun } from 'lucide-vue-next';
    3  import { useAppearance } from '@/composables/useAppearance';
    4  
    5  const { appearance, updateAppearance } = useAppearance();
    6  
    7  const tabs = [
    8      { value: 'light', Icon: Sun, label: 'Light' },
--- resources/js/components/AppearanceTabs.vue:18-24
   18          <button
   19              v-for="{ value, Icon, label } in tabs"
   20              :key="value"
   21              @click="updateAppearance(value)"
   22              :class="[
   23                  'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
   24                  appearance === value

* resources/js/components/TwoFactorSetupModal.vue  {"proposed_by_reader": false, "reader_excluded_because": "calls useAppearance() (:32) but only reads resolvedAppearance; useAppearance itself does not invoke updateTheme on call, so updateTheme is never reached"}
--- resources/js/components/TwoFactorSetupModal.vue: none of ['updateTheme'] appears in the file

* resources/js/components/ui/sonner/Sonner.vue  {"proposed_by_reader": false, "reader_excluded_because": "calls useAppearance() (:6) but only reads appearance; never calls updateAppearance"}
--- resources/js/components/ui/sonner/Sonner.vue: none of ['updateTheme'] appears in the file

* resources/js/pages/settings/Appearance.vue  {"proposed_by_reader": false, "reader_excluded_because": "renders AppearanceTabs, which is hop 3, outside the two-hop bound"}
--- resources/js/pages/settings/Appearance.vue: none of ['updateTheme'] appears in the file


========== ITEM ls-b-06 ==========
Question (registered, verbatim):
{
 "id": "ls-b-06",
 "suite": "B",
 "class": "precise-semantics",
 "shape": "callers-transitive",
 "subject": "larasend",
 "language": "vue",
 "question": "Which files reach toUrl through any chain of calls or component usage (three or more hops)?",
 "probe": "toUrl",
 "declared_in": "resources/js/lib/utils.ts:10",
 "hop_stratum": ">=3",
 "basis": [
  "resources/js/composables/useCurrentUrl.ts:43 -- calls toUrl (hop 1)",
  "resources/js/components/NavMain.vue:10,17 and resources/js/layouts/settings/Layout.vue:7,49 -- call useCurrentUrl (hop 2)",
  "components that render NavMain / settings Layout, and pages that render those (hop 3+), resolved by the oracle"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["scip-typescript does not index .vue single-file components; Vue call sites need the human reading"]

Reader notes: answerable_as_registered=True; The question has two readings. Reading A, every file at any depth (hop 1 up to the top): the 10 answer_files. Reading B, only files whose shortest distance is 3 or more hops: AppSidebarLayout.vue (3), AppLayout.vue (4), app.ts (3). Under the resolver-as-usage reading, both readings also add Dashboard.vue and the three settings pages. The corpus basis expects 'pages that render those'. No page renders NavMain or settings Layout itself; pages get them only through app.ts.
Reader on the oracle's open list: Vue component usage traced by hand from import plus template tags. Chain: toUrl <- {useCurrentUrl.ts, NavFooter.vue, AppHeader.vue} <- {NavMain.vue, settings/Layout.vue, AppSidebar.vue, AppHeaderLayout.vue} <- AppSidebarLayout.vue <- AppLayout.vue <- app.ts (layout resolver). app.ts also reaches settings/Layout.vue directly. Pages reach layouts only through the resolver. There are no relative imports of chain components.

Candidate files (18):

* resources/js/composables/useCurrentUrl.ts  {"proposed_by_reader": true, "reader_reason": "hop 1: calls toUrl", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- resources/js/composables/useCurrentUrl.ts:40-46
   40          startsWith: boolean = false,
   41      ) {
   42          const urlToCompare = currentUrl ?? currentUrlReactive.value;
   43          const urlString = toUrl(urlToCheck);
   44  
   45          const comparePath = (path: string): boolean =>
   46              startsWith ? urlToCompare.startsWith(path) : path === urlToCompare;

* resources/js/components/NavFooter.vue  {"proposed_by_reader": true, "reader_reason": "hop 1: template calls toUrl"}
--- resources/js/components/NavFooter.vue:29-35
   29                          as-child
   30                      >
   31                          <a
   32                              :href="toUrl(item.href)"
   33                              target="_blank"
   34                              rel="noopener noreferrer"
   35                          >

* resources/js/components/AppHeader.vue  {"proposed_by_reader": true, "reader_reason": "hop 1: calls toUrl directly, and also uses useCurrentUrl"}
--- resources/js/components/AppHeader.vue:128-134
  128                                      <a
  129                                          v-for="item in rightNavItems"
  130                                          :key="item.title"
  131                                          :href="toUrl(item.href)"
  132                                          target="_blank"
  133                                          rel="noopener noreferrer"
  134                                          class="flex items-center space-x-2 text-sm font-medium"
--- resources/js/components/AppHeader.vue:48-54
   48  
   49  const page = usePage();
   50  const auth = computed(() => page.props.auth);
   51  const { isCurrentUrl, whenCurrentUrl } = useCurrentUrl();
   52  
   53  const activeItemStyles =
   54      'text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100';

* resources/js/components/NavMain.vue  {"proposed_by_reader": true, "reader_reason": "hop 2: uses useCurrentUrl"}
--- resources/js/components/NavMain.vue:7-13
    7      SidebarMenuButton,
    8      SidebarMenuItem,
    9  } from '@/components/ui/sidebar';
   10  import { useCurrentUrl } from '@/composables/useCurrentUrl';
   11  import type { NavItem } from '@/types';
   12  
   13  defineProps<{
--- resources/js/components/NavMain.vue:14-20
   14      items: NavItem[];
   15  }>();
   16  
   17  const { isCurrentUrl } = useCurrentUrl();
   18  </script>
   19  
   20  <template>

* resources/js/layouts/settings/Layout.vue  {"proposed_by_reader": true, "reader_reason": "hop 2: uses useCurrentUrl"}
--- resources/js/layouts/settings/Layout.vue:4-10
    4  import { computed } from 'vue';
    5  import GlobalRail from '@/components/GlobalRail.vue';
    6  import { Toaster } from '@/components/ui/sonner';
    7  import { useCurrentUrl } from '@/composables/useCurrentUrl';
    8  import { dashboard } from '@/routes';
    9  import { edit as editAppearance } from '@/routes/appearance';
   10  import { edit as editProfile } from '@/routes/profile';
--- resources/js/layouts/settings/Layout.vue:46-52
   46      { title: 'Appearance', href: editAppearance(), icon: Palette },
   47  ];
   48  
   49  const { isCurrentOrParentUrl } = useCurrentUrl();
   50  </script>
   51  
   52  <template>

* resources/js/components/AppSidebar.vue  {"proposed_by_reader": true, "reader_reason": "hop 2: renders NavMain and NavFooter"}
--- resources/js/components/AppSidebar.vue:2-8
    2  import { Link } from '@inertiajs/vue3';
    3  import { BookOpen, FolderGit2, LayoutGrid } from 'lucide-vue-next';
    4  import AppLogo from '@/components/AppLogo.vue';
    5  import NavFooter from '@/components/NavFooter.vue';
    6  import NavMain from '@/components/NavMain.vue';
    7  import NavUser from '@/components/NavUser.vue';
    8  import {
--- resources/js/components/AppSidebar.vue:3-9
    3  import { BookOpen, FolderGit2, LayoutGrid } from 'lucide-vue-next';
    4  import AppLogo from '@/components/AppLogo.vue';
    5  import NavFooter from '@/components/NavFooter.vue';
    6  import NavMain from '@/components/NavMain.vue';
    7  import NavUser from '@/components/NavUser.vue';
    8  import {
    9      Sidebar,
--- resources/js/components/AppSidebar.vue:54-60
   54          </SidebarHeader>
   55  
   56          <SidebarContent>
   57              <NavMain :items="mainNavItems" />
   58          </SidebarContent>
   59  
   60          <SidebarFooter>

* resources/js/layouts/app/AppHeaderLayout.vue  {"proposed_by_reader": true, "reader_reason": "hop 2: renders AppHeader. Nothing in the tree imports this layout."}
--- resources/js/layouts/app/AppHeaderLayout.vue:1-6
    1  <script setup lang="ts">
    2  import AppContent from '@/components/AppContent.vue';
    3  import AppHeader from '@/components/AppHeader.vue';
    4  import AppShell from '@/components/AppShell.vue';
    5  import { Toaster } from '@/components/ui/sonner';
    6  import type { BreadcrumbItem } from '@/types';
--- resources/js/layouts/app/AppHeaderLayout.vue:16-22
   16  
   17  <template>
   18      <AppShell variant="header">
   19          <AppHeader :breadcrumbs="breadcrumbs" />
   20          <AppContent variant="header">
   21              <slot />
   22          </AppContent>

* resources/js/layouts/app/AppSidebarLayout.vue  {"proposed_by_reader": true, "reader_reason": "hop 3: renders AppSidebar"}
--- resources/js/layouts/app/AppSidebarLayout.vue:1-7
    1  <script setup lang="ts">
    2  import AppContent from '@/components/AppContent.vue';
    3  import AppShell from '@/components/AppShell.vue';
    4  import AppSidebar from '@/components/AppSidebar.vue';
    5  import AppSidebarHeader from '@/components/AppSidebarHeader.vue';
    6  import { Toaster } from '@/components/ui/sonner';
    7  import type { BreadcrumbItem } from '@/types';
--- resources/js/layouts/app/AppSidebarLayout.vue:17-23
   17  
   18  <template>
   19      <AppShell variant="sidebar">
   20          <AppSidebar />
   21          <AppContent variant="sidebar" class="overflow-x-hidden">
   22              <AppSidebarHeader :breadcrumbs="breadcrumbs" />
   23              <slot />

* resources/js/layouts/AppLayout.vue  {"proposed_by_reader": true, "reader_reason": "hop 4: renders AppSidebarLayout"}
--- resources/js/layouts/AppLayout.vue:1-5
    1  <script setup lang="ts">
    2  import AppLayout from '@/layouts/app/AppSidebarLayout.vue';
    3  import type { BreadcrumbItem } from '@/types';
    4  
    5  const { breadcrumbs = [] } = defineProps<{
--- resources/js/layouts/AppLayout.vue:8-14
    8  </script>
    9  
   10  <template>
   11      <AppLayout :breadcrumbs="breadcrumbs">
   12          <slot />
   13      </AppLayout>
   14  </template>

* resources/js/app.ts  {"proposed_by_reader": true, "reader_reason": "hop 3 via settings Layout and hop 5 via AppLayout: the Inertia layout resolver returns SettingsLayout and AppLayout"}
--- resources/js/app.ts:1-6
    1  import { createInertiaApp } from '@inertiajs/vue3';
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
    6  import { initializeFlashToast } from '@/lib/flashToast';
--- resources/js/app.ts:2-8
    2  import { initializeTheme } from '@/composables/useAppearance';
    3  import AppLayout from '@/layouts/AppLayout.vue';
    4  import AuthLayout from '@/layouts/AuthLayout.vue';
    5  import SettingsLayout from '@/layouts/settings/Layout.vue';
    6  import { initializeFlashToast } from '@/lib/flashToast';
    7  
    8  const appName = import.meta.env.VITE_APP_NAME || 'Larasend';
--- resources/js/app.ts:22-28
   22              case name.startsWith('auth/'):
   23                  return AuthLayout;
   24              case name.startsWith('settings/'):
   25                  return SettingsLayout;
   26              default:
   27                  return AppLayout;
   28          }

* resources/js/pages/Dashboard.vue  {"proposed_by_reader": false, "reader_excluded_because": "Gets AppLayout only through the app.ts resolver default branch (app.ts:27). The page never imports or renders a layout itself; its defineOptions layout (:7) only passes breadcrumbs. Include it if resolver-assigned layouts count as component usage."}
--- resources/js/pages/Dashboard.vue: none of ['toUrl'] appears in the file

* resources/js/pages/settings/Appearance.vue  {"proposed_by_reader": false, "reader_excluded_because": "Same as Dashboard.vue: SettingsLayout comes only through the app.ts resolver (app.ts:24-25). Include under the resolver reading."}
--- resources/js/pages/settings/Appearance.vue: none of ['toUrl'] appears in the file

* resources/js/pages/settings/Profile.vue  {"proposed_by_reader": false, "reader_excluded_because": "same as settings/Appearance.vue"}
--- resources/js/pages/settings/Profile.vue: none of ['toUrl'] appears in the file

* resources/js/pages/settings/Security.vue  {"proposed_by_reader": false, "reader_excluded_because": "same as settings/Appearance.vue"}
--- resources/js/pages/settings/Security.vue: none of ['toUrl'] appears in the file

* resources/js/pages/Welcome.vue, Activity.vue, Inbox.vue, Onboarding.vue  {"proposed_by_reader": false, "reader_excluded_because": "the resolver returns null layout for these (app.ts:14-21), and none imports a component on the chain"}
--- resources/js/pages/Welcome.vue, Activity.vue, Inbox.vue, Onboarding.vue: FILE NOT FOUND at the pin

* resources/js/pages/auth/*.vue  {"proposed_by_reader": false, "reader_excluded_because": "get AuthLayout (AuthSimpleLayout), which renders no chain component"}
--- resources/js/pages/auth/*.vue: FILE NOT FOUND at the pin

* resources/js/layouts/AuthLayout.vue, layouts/auth/*.vue  {"proposed_by_reader": false, "reader_excluded_because": "no toUrl or useCurrentUrl chain; only AppLogoIcon"}
--- resources/js/layouts/AuthLayout.vue, layouts/auth/*.vue: FILE NOT FOUND at the pin

* resources/js/components/NavUser.vue, UserMenuContent.vue, UserInfo.vue, Breadcrumbs.vue, AppLogo.vue  {"proposed_by_reader": false, "reader_excluded_because": "these are siblings rendered by chain components, not consumers of the chain"}
--- resources/js/components/NavUser.vue, UserMenuContent.vue, UserInfo.vue, Breadcrumbs.vue, AppLogo.vue: FILE NOT FOUND at the pin


========== ITEM ls-c-tests-01 ==========
Question (registered, verbatim):
{
 "id": "ls-c-tests-01",
 "suite": "C",
 "class": "tests-for",
 "subject": "larasend",
 "language": "php",
 "question": "Which test files exercise ThreadResolver, directly or through a route or service that calls it?",
 "probe": "ThreadResolver",
 "hop_stratum": 2,
 "basis": [
  "tests/Feature/ThreadingTest.php, tests/Feature/InboxTest.php, tests/Feature/InboundEmailTest.php -- post to the Cloudflare inbound route, which reaches ThreadResolver"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 9 controller entry point(s)", "framework-invoked entry point(s) not followed: App\\Console\\Commands\\ThreadBackfillCommand::handle, App\\Services\\EmailSendService::__construct, App\\Services\\InboundEmailIngestor::__construct, Database\\Seeders\\InboxDemoSeeder::__construct, Database\\Seeders\\InboxDemoSeeder::run"]

Reader notes: answerable_as_registered=True; The corpus basis lists 3 files, and the oracle finds 4. Following the routes and the send path gives 9. CloudflareSuppressionSyncTest is statically reached but probably does not run attachOutbound, so drop it under a runtime reading (8 files).
Reader on the oracle's open list: Route hops followed: ThreadResolver is constructor-injected into EmailSendService (:27, used at :113) and InboundEmailIngestor (:26, used at :77). It is method-injected into ThreadBackfillCommand::handle and InboxDemoSeeder. ThreadActionController mentions ThreadResolver only in a comment (:373) and reaches it through EmailSendService in reply, compose and forward. Entry routes: api.php:13 (emails.store), api.php:22 (cloudflare inbound), web.php:62-64, 70-71, 76, 114-116.

Candidate files (13):

* tests/Feature/ThreadingTest.php  {"proposed_by_reader": true, "reader_reason": "posts to the Cloudflare inbound route (InboundEmailIngestor -> attachInbound), calls EmailSendService::send directly (attachOutbound), and runs larasend:thread-backfill (ThreadBackfillCommand::handle(ThreadResolver))", "listed_by_oracle": true, "reader_on_oracle_file": "keep: inbound route, direct send, backfill command"}
--- tests/Feature/ThreadingTest.php:59-65
   59  
   60      Queue::fake();
   61  
   62      $post = fn (string $mime) => $this->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   63          'from' => 'maya@customer.test',
   64          'to' => 'support@example.com',
   65          'raw' => base64_encode($mime),
--- tests/Feature/ThreadingTest.php:90-96
   90          'raw' => base64_encode(threadedInboundMime('Need a refund', 'msg-9@customer.test')),
   91      ])->assertStatus(202);
   92  
   93      $email = app(EmailSendService::class)->send($project, $source, [
   94          'from' => 'Support <support@example.com>',
   95          'to' => ['maya@customer.test'],
   96          'subject' => 'Re: Need a refund',
--- tests/Feature/ThreadingTest.php:146-152
  146          'received_at' => now()->subDay(),
  147      ]);
  148  
  149      $this->artisan('larasend:thread-backfill')
  150          ->expectsOutputToContain('Threaded 2 message(s).')
  151          ->assertExitCode(0);
  152  

* tests/Feature/InboxTest.php  {"proposed_by_reader": true, "reader_reason": "posts to the Cloudflare inbound route -> CloudflareInboundController -> InboundEmailIngestor::ingest -> ThreadResolver::attachInbound (InboundEmailIngestor.php:77)"}
--- tests/Feature/InboxTest.php:49-55
   49          '',
   50      ]);
   51  
   52      $test->postJson("/api/webhooks/inbound/cloudflare/{$source->webhook_token}", [
   53          'from' => $from,
   54          'to' => $to,
   55          'raw' => base64_encode($mime),

* tests/Feature/InboundEmailTest.php  {"proposed_by_reader": true, "reader_reason": "posts to the inbound route and calls InboundEmailIngestor::ingest directly", "listed_by_oracle": true, "reader_on_oracle_file": "keep: inbound route plus a direct ingestor call"}
--- tests/Feature/InboundEmailTest.php:99-105
   99  
  100      $this->call(
  101          'POST',
  102          "/api/webhooks/inbound/cloudflare/{$source->webhook_token}",
  103          server: [
  104              'CONTENT_TYPE' => 'message/rfc822',
  105              'HTTP_LARASEND_ENVELOPE_FROM' => 'maya@customer.test',
--- tests/Feature/InboundEmailTest.php:176-182
  176          'Please keep this message.',
  177      ]);
  178  
  179      expect(fn () => app(InboundEmailIngestor::class)->ingest(
  180          $source,
  181          'maya@customer.test',
  182          'support@example.com',

* tests/Feature/ApiEmailTest.php  {"proposed_by_reader": true, "reader_reason": "calls EmailSendService::send directly and posts to /api/emails (EmailController::store -> send -> attachOutbound at EmailSendService.php:113)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct EmailSendService::send calls plus the /api/emails route"}
--- tests/Feature/ApiEmailTest.php:119-125
  119      $this->app->instance(Dispatcher::class, $dispatcher);
  120  
  121      try {
  122          expect(fn () => app(EmailSendService::class)->send($project, $source, [
  123              'from' => 'Larasend <receipts@example.com>',
  124              'to' => ['maya@example.com'],
  125              'subject' => 'Durable queue handoff',
--- tests/Feature/ApiEmailTest.php:183-189
  183  
  184      $first = $this->withToken($token)
  185          ->withHeader('Idempotency-Key', 'order-4821')
  186          ->postJson('/api/emails', $payload)
  187          ->assertAccepted();
  188      $second = $this->withToken($token)
  189          ->withHeader('Idempotency-Key', 'order-4821')
--- tests/Feature/ApiEmailTest.php:471-477
  471          'event_type' => 'complaint',
  472      ]);
  473  
  474      $allowed = app(EmailSendService::class)->send($project, $source, [
  475          'from' => 'Larasend <receipts@example.com>',
  476          'to' => ['Distinct <äBC@example.com>'],
  477          'subject' => 'Distinct non-ASCII recipient',

* tests/Feature/CloudflareSendTest.php  {"proposed_by_reader": true, "reader_reason": "posts to /api/emails -> EmailSendService::send -> attachOutbound"}
--- tests/Feature/CloudflareSendTest.php:94-100
   94  
   95      Queue::fake();
   96  
   97      $this->withToken($token)->postJson('/api/emails', [
   98          'from' => 'Larasend <receipts@example.com>',
   99          'to' => ['Maya <maya@example.com>'],
  100          'cc' => ['copy@example.com'],
--- tests/Feature/CloudflareSendTest.php:136-142
  136  
  137      Queue::fake();
  138  
  139      $this->withToken($token)->postJson('/api/emails', [
  140          'from' => 'Larasend <receipts@example.com>',
  141          'to' => ['Maya <maya@example.com>'],
  142          'subject' => 'Rejected send',
--- tests/Feature/CloudflareSendTest.php:172-178
  172  
  173      Queue::fake();
  174  
  175      $this->withToken($token)->postJson('/api/emails', [
  176          'from' => 'Larasend <receipts@example.com>',
  177          'to' => ['Maya <maya@example.com>'],
  178          'subject' => 'Transient failure',

* tests/Feature/DashboardActionsTest.php  {"proposed_by_reader": true, "reader_reason": "posts to the /send, resend and retry-soft routes -> DashboardActionController -> EmailSendService::send"}
--- tests/Feature/DashboardActionsTest.php:598-604
  598      $user = User::factory()->create();
  599  
  600      $this->actingAs($user)
  601          ->post('/send', [
  602              'from' => 'Larasend <receipts@example.com>',
  603              'to' => 'maya@example.com, team@example.com',
  604              'cc' => '',
--- tests/Feature/DashboardActionsTest.php:664-670
  664      $original = Email::query()->where('subject', 'Resend me')->firstOrFail();
  665  
  666      $this->actingAs($user)
  667          ->post("/emails/{$original->public_id}/resend")
  668          ->assertRedirect('/activity');
  669  
  670      $resent = Email::query()->where('subject', 'Resend me')->latest('id')->first();
--- tests/Feature/DashboardActionsTest.php:695-701
  695      $original = Email::query()->where('subject', 'Project scoped resend')->firstOrFail();
  696  
  697      $this->actingAs($user)
  698          ->post("/projects/{$project->slug}/emails/{$original->public_id}/resend")
  699          ->assertRedirect("/projects/{$project->slug}/activity");
  700  
  701      $resent = Email::query()->where('subject', 'Project scoped resend')->latest('id')->first();

* tests/Feature/InboxReplyTest.php  {"proposed_by_reader": true, "reader_reason": "posts to inbox compose, thread reply and forward -> ThreadActionController (:71,:132,:198) -> EmailSendService::send"}
--- tests/Feature/InboxReplyTest.php:109-115
  109      Queue::fake();
  110  
  111      $this->actingAs($user)
  112          ->post("/projects/{$project->slug}/inbox/compose", [
  113              'to' => 'lead@customer.test, billing@customer.test',
  114              'cc' => 'sales@customer.test, owner@customer.test',
  115              'bcc' => 'audit@example.com',
--- tests/Feature/InboxReplyTest.php:138-144
  138      $inbound->forceFill(['headers' => [...$inbound->headers, 'Cc' => 'finance@customer.test, support@example.com']])->save();
  139  
  140      $this->actingAs($user)
  141          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/reply", [
  142              'text' => 'Replying to everyone',
  143              'reply_all' => true,
  144          ])
--- tests/Feature/InboxReplyTest.php:199-205
  199      $thread = Thread::query()->firstOrFail();
  200  
  201      $this->actingAs($user)
  202          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/forward", [
  203              'to' => 'teammate@example.org',
  204              'text' => 'Can you take this one?',
  205          ])

* tests/Feature/DatabaseSeederSafetyTest.php  {"proposed_by_reader": true, "reader_reason": "seeds DatabaseSeeder -> InboxDemoSeeder::seed -> ThreadResolver attachInbound and attachOutbound", "listed_by_oracle": true, "reader_on_oracle_file": "keep: seeder chain reaches InboxDemoSeeder, which calls ThreadResolver"}
--- tests/Feature/DatabaseSeederSafetyTest.php:21-27
   21          'subject' => 'Do not delete',
   22      ]);
   23  
   24      $this->seed(DatabaseSeeder::class);
   25  
   26      expect($project->fresh())
   27          ->name->toBe('Customer Production')
--- database/seeders/DatabaseSeeder.php:75-81
   75              $this->seedApiKeys($demoProject, $source);
   76              $this->seedWebhooks($demoProject);
   77              $this->seedEmails($workspace, $demoProject, $source, $templates);
   78              $this->inboxDemoSeeder->seed($demoProject);
   79          }
   80      }
   81  
--- database/seeders/InboxDemoSeeder.php:158-164
  158              'received_at' => $at,
  159          ]);
  160  
  161          $resolver->attachInbound($inbound);
  162  
  163          return $inbound;
  164      }

* tests/Feature/CloudflareSuppressionSyncTest.php  {"proposed_by_reader": true, "reader_reason": "posts to /api/emails, which statically reaches EmailSendService::send. This test expects a 422 on 'to', so attachOutbound is likely not executed at runtime."}
--- tests/Feature/CloudflareSuppressionSyncTest.php:418-424
  418      $issued = ApiKey::issue($project, 'Collision test', $historicalSource);
  419      Queue::fake();
  420  
  421      $this->withToken($issued['plain_text'])->postJson('/api/emails', [
  422          'from' => 'Larasend <receipts@example.com>',
  423          'to' => ['Expired Collision <expired-collision@example.com>'],
  424          'subject' => 'Must stay blocked',

* tests/Feature/SuppressionEmailNormalizationMigrationTest.php  {"proposed_by_reader": false, "reader_excluded_because": "only reads EmailSendService.php as a string (:426) and does not execute it"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php: none of ['ThreadResolver'] appears in the file

* tests/Feature/SesWebhookTest.php, tests/Feature/OutboundWebhookDeliveryTest.php  {"proposed_by_reader": false, "reader_excluded_because": "SES webhook path (SesEventNormalizer) never touches ThreadResolver"}
--- tests/Feature/SesWebhookTest.php, tests/Feature/OutboundWebhookDeliveryTest.php: FILE NOT FOUND at the pin

* tests/Feature/LarasendLaravelPackageTest.php  {"proposed_by_reader": false, "reader_excluded_because": "fakes outbound HTTP to an external /api/emails URL; no app route is hit"}
--- tests/Feature/LarasendLaravelPackageTest.php: none of ['ThreadResolver'] appears in the file

* tests/Feature/ActivityDashboardTest.php  {"proposed_by_reader": false, "reader_excluded_because": "only GETs /send (the ActivityController page), never POSTs to the send route"}
--- tests/Feature/ActivityDashboardTest.php: none of ['ThreadResolver'] appears in the file


========== ITEM ls-c-tests-02 ==========
Question (registered, verbatim):
{
 "id": "ls-c-tests-02",
 "suite": "C",
 "class": "tests-for",
 "subject": "larasend",
 "language": "php",
 "question": "Which test files exercise SuppressionRemovalService, directly or through a route that calls it?",
 "probe": "SuppressionRemovalService",
 "hop_stratum": 2,
 "basis": [
  "tests/Feature/SuppressionManagementTest.php -- dashboard and API suppression removal"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 3 controller entry point(s)", "framework-invoked entry point(s) not followed: App\\Services\\SuppressionRemovalService::__construct"]

Reader notes: answerable_as_registered=True; The oracle set is empty because it does not follow route hops.
Reader on the oracle's open list: Route hops followed: routes/web.php:59,95 -> DashboardActionController (:308,:316 -> deleteSuppression :323-331), and routes/api.php:15 -> Api\SuppressionController::destroy (:17-20). A grep of tests for suppressions/ URLs and route names finds only SuppressionManagementTest.

Candidate files (3):

* tests/Feature/SuppressionManagementTest.php  {"proposed_by_reader": true, "reader_reason": "sends DELETE to the project and global suppression routes (DashboardActionController::destroyProjectSuppression and destroySuppression -> deleteSuppression -> SuppressionRemovalService::remove at :331) and to /api/suppressions (Api\\SuppressionController::destroy)"}
--- tests/Feature/SuppressionManagementTest.php:76-82
   76          );
   77  
   78      $this->actingAs($owner)
   79          ->delete("/projects/{$project->slug}/suppressions/{$suppression->id}")
   80          ->assertRedirect("/projects/{$project->slug}/suppressions");
   81  
   82      $this->assertModelMissing($suppression);
--- tests/Feature/SuppressionManagementTest.php:109-115
  109      $suppression = managedSuppression($project, $source);
  110  
  111      $this->actingAs($member)
  112          ->delete("/suppressions/{$suppression->id}")
  113          ->assertRedirect('/suppressions');
  114  
  115      $this->assertModelMissing($suppression);
--- tests/Feature/SuppressionManagementTest.php:312-318
  312      $manageKey = ApiKey::issue($project, 'Manage key', $source, ['manage:suppressions']);
  313  
  314      $this->withToken($readKey['plain_text'])
  315          ->deleteJson("/api/suppressions/{$suppression->id}")
  316          ->assertForbidden()
  317          ->assertJsonPath('message', 'This Larasend API key is missing the manage:suppressions scope.');
  318  

* tests/Feature/CloudflareSuppressionSyncTest.php  {"proposed_by_reader": false, "reader_excluded_because": "exercises the suppression sync job and CloudflareApiClient, not the removal service or its routes"}
--- tests/Feature/CloudflareSuppressionSyncTest.php: none of ['SuppressionRemovalService'] appears in the file

* tests/Feature/DashboardActionsTest.php  {"proposed_by_reader": false, "reader_excluded_because": "has DELETE calls only for domains and api-keys routes, none to suppressions"}
--- tests/Feature/DashboardActionsTest.php: none of ['SuppressionRemovalService'] appears in the file


========== ITEM ls-d-01 ==========
Question (registered, verbatim):
{
 "id": "ls-d-01",
 "suite": "D",
 "class": "negative-control",
 "shape": "path",
 "subject": "larasend",
 "language": "php",
 "question": "Is there an accepted path from SesWebhookController to the outbound-HTTP job DeliverInboundWebhook?",
 "probe": "SesWebhookController",
 "probe_to": "DeliverInboundWebhook",
 "threat_row": "threats.csv:24 SSRF via user-supplied URL",
 "hop_stratum": ">=3",
 "expected": "empty",
 "reason": "The SES path ends in WebhookDeliveryService, which dispatches DeliverWebhook only (app/Services/WebhookDeliveryService.php:23). DeliverInboundWebhook is dispatched only from app/Services/InboundEmailIngestor.php:40,87, which is referenced only by app/Http/Controllers/Webhooks/CloudflareInboundController.php. The SES event EmailActivityUpdated is broadcast-only (app/Events/EmailActivityUpdated.php:12)."
}

Reference engine (oracle) status: confirms-empty; its open list: ["engine-only: route, queue and event dispatch hops are not followed"]

Reader notes: answerable_as_registered=True; The registered negative control holds: no accepted path exists.
Reader on the oracle's open list: Followed route, queue and event hops by hand. SesWebhookController uses SesEventNormalizer and SnsSignatureVerifier, and Http::get only for the SNS SubscribeURL (:46). None of these reaches InboundEmailIngestor or DeliverInboundWebhook.

Candidate files (4):

* app/Services/SesEventNormalizer.php  {"proposed_by_reader": false, "reader_excluded_because": "SES path: dispatches EmailActivityUpdated (:36,:77) and calls WebhookDeliveryService::dispatchFor (:39,:80)"}
--- app/Services/SesEventNormalizer.php: none of ['SesWebhookController', 'DeliverInboundWebhook'] appears in the file

* app/Services/WebhookDeliveryService.php  {"proposed_by_reader": false, "reader_excluded_because": "dispatches DeliverWebhook only (:23)"}
--- app/Services/WebhookDeliveryService.php: none of ['SesWebhookController', 'DeliverInboundWebhook'] appears in the file

* app/Events/EmailActivityUpdated.php  {"proposed_by_reader": false, "reader_excluded_because": "ShouldBroadcast (:12); no listeners. There is no app/Listeners directory and no Event::listen or observer registration in app/ or bootstrap/."}
--- app/Events/EmailActivityUpdated.php: none of ['SesWebhookController', 'DeliverInboundWebhook'] appears in the file

* app/Services/InboundEmailIngestor.php  {"proposed_by_reader": false, "reader_excluded_because": "the only dispatcher of DeliverInboundWebhook (:40,:87), referenced only by CloudflareInboundController.php:9,28"}
--- app/Services/InboundEmailIngestor.php:2-8
    2  
    3  namespace App\Services;
    4  
    5  use App\Jobs\DeliverInboundWebhook;
    6  use App\Models\InboundEmail;
    7  use App\Models\Source;
    8  use Illuminate\Support\Facades\DB;
--- app/Services/InboundEmailIngestor.php:37-43
   37              ->first();
   38  
   39          if ($existing) {
   40              DeliverInboundWebhook::dispatch($existing->id)->onQueue('webhooks');
   41  
   42              return $existing;
   43          }
--- app/Services/InboundEmailIngestor.php:84-90
   84              throw $exception;
   85          }
   86  
   87          DeliverInboundWebhook::dispatch($inbound->id)->onQueue('webhooks');
   88  
   89          return $inbound;
   90      }


========== ITEM ls-d-02 ==========
Question (registered, verbatim):
{
 "id": "ls-d-02",
 "suite": "D",
 "class": "negative-control",
 "shape": "path",
 "subject": "larasend",
 "language": "ts",
 "question": "Is there an accepted path from the getInitials display helper to the outbound-HTTP job DeliverWebhook?",
 "probe": "getInitials",
 "probe_to": "DeliverWebhook",
 "threat_row": "threats.csv:24 SSRF via user-supplied URL",
 "hop_stratum": ">=3",
 "expected": "empty",
 "reason": "getInitials (resources/js/composables/useInitials.ts:5) is a pure string helper rendered in AppHeader.vue:259 and UserInfo.vue:28; it calls nothing. DeliverWebhook is a queued PHP job reached only from WebhookDeliveryService."
}

Reference engine (oracle) status: unresolved; its open list: ["declaration not found in the scip index"]

Reader notes: answerable_as_registered=True; No accepted path exists, so the expected-empty answer is confirmed. The oracle's 'unresolved' status is an indexing gap, not evidence.
Reader on the oracle's open list: The oracle reported 'declaration not found in the scip index', but the declaration exists at resources/js/composables/useInitials.ts:5. Read by hand, getInitials has no outgoing calls. DeliverWebhook is a PHP job dispatched only from app/Services/WebhookDeliveryService.php:23.

Candidate files (2):

* resources/js/composables/useInitials.ts  {"proposed_by_reader": false, "reader_excluded_because": "getInitials (:5-22) is pure string manipulation that calls nothing outside String methods"}
--- resources/js/composables/useInitials.ts:1-5
    1  export type UseInitialsReturn = {
    2      getInitials: (fullName?: string) => string;
    3  };
    4  
    5  export function getInitials(fullName?: string): string {
--- resources/js/composables/useInitials.ts:2-8
    2      getInitials: (fullName?: string) => string;
    3  };
    4  
    5  export function getInitials(fullName?: string): string {
    6      if (!fullName) {
    7          return '';
    8      }
--- resources/js/composables/useInitials.ts:21-26
   21  }
   22  
   23  export function useInitials(): UseInitialsReturn {
   24      return { getInitials };
   25  }
   26  

* resources/js/components/AppHeader.vue, resources/js/components/UserInfo.vue  {"proposed_by_reader": false, "reader_excluded_because": "these call getInitials (AppHeader.vue:259, UserInfo.vue:28), which are callers, not callees"}
--- resources/js/components/AppHeader.vue, resources/js/components/UserInfo.vue: FILE NOT FOUND at the pin


========== ITEM ls-d-03 ==========
Question (registered, verbatim):
{
 "id": "ls-d-03",
 "suite": "D",
 "class": "negative-control",
 "shape": "symbol",
 "subject": "larasend",
 "language": "php",
 "question": "Which files call attachForwarded?",
 "probe": "attachForwarded",
 "hop_stratum": 1,
 "expected": "empty",
 "reason": "Near-miss of attachInbound / attachOutbound (app/Services/ThreadResolver.php:25,49). Verified absent from the whole clone with a word-boundary search at construction time."
}

Reference engine (oracle) status: confirms-empty; its open list: ["no declaration of the probe exists at the pin"]

Reader notes: answerable_as_registered=True; The symbol does not exist at the pin, so the empty answer is correct.
Reader on the oracle's open list: A word-boundary grep for attachForwarded across the subject (excluding vendor and node_modules) returns zero matches.

Candidate files (1):

* app/Services/ThreadResolver.php  {"proposed_by_reader": false, "reader_excluded_because": "declares attachInbound (:25) and attachOutbound (:49), the near-misses; no attachForwarded"}
--- app/Services/ThreadResolver.php: none of ['attachForwarded'] appears in the file


========== ITEM ls-e-01 ==========
Question (registered, verbatim):
{
 "id": "ls-e-01",
 "suite": "E",
 "class": "change-impact",
 "subject": "larasend",
 "language": "php",
 "question": "If WebhookUrlGuard::isSafe changes its contract, which files must be re-read?",
 "probe": "isSafe",
 "declared_in": "app/Services/WebhookUrlGuard.php:11",
 "hop_stratum": 2,
 "basis": [
  "app/Rules/PublicWebhookUrl.php:21 (hop 1) -- used by app/Http/Requests/StoreWebhookEndpointRequest.php and StoreOnboardingRequest.php (hop 2)",
  "app/Jobs/DeliverWebhook.php:45 and app/Jobs/DeliverInboundWebhook.php:54,85 (hop 1)",
  "tests/Pest.php:23 and tests/Unit/WebhookUrlGuardTest.php -- subclass it"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["framework-invoked entry point(s) not followed: App\\Rules\\PublicWebhookUrl::validate"]

Reader notes: answerable_as_registered=True; The corpus basis over-claims. Both jobs and Pest.php use WebhookUrlGuard but not isSafe. Under a whole-class reading ('any change to WebhookUrlGuard'), DeliverWebhook.php, DeliverInboundWebhook.php and tests/Pest.php would join.
Reader on the oracle's open list: PublicWebhookUrl::validate is framework-invoked through Laravel validation. It is instantiated in StoreWebhookEndpointRequest.php:28 and StoreOnboardingRequest.php:49, and these are the hop-2 files. Feature tests that post webhook URLs through those requests would be hop 3+.

Candidate files (8):

* app/Rules/PublicWebhookUrl.php  {"proposed_by_reader": true, "reader_reason": "hop 1: calls isSafe in validate()", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Rules/PublicWebhookUrl.php:18-24
   18       */
   19      public function validate(string $attribute, mixed $value, Closure $fail): void
   20      {
   21          if (! is_string($value) || ! ($this->guard ?? app(WebhookUrlGuard::class))->isSafe($value)) {
   22              $fail('The :attribute must use a publicly reachable HTTP or HTTPS address.');
   23          }
   24      }

* tests/Unit/WebhookUrlGuardTest.php  {"proposed_by_reader": true, "reader_reason": "hop 1: calls isSafe directly and asserts its contract", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- tests/Unit/WebhookUrlGuardTest.php:5-11
    5  use App\Services\WebhookUrlGuard;
    6  
    7  it('rejects local and private webhook destinations', function (string $url) {
    8      expect((new WebhookUrlGuard)->isSafe($url))->toBeFalse();
    9  })->with([
   10      'localhost' => 'http://localhost/internal',
   11      'loopback ipv4' => 'http://127.0.0.1/internal',
--- tests/Unit/WebhookUrlGuardTest.php:24-30
   24          }
   25      };
   26  
   27      expect($guard->isSafe('https://hooks.example.com/events'))->toBeFalse();
   28  });
   29  
   30  it('rejects trailing-dot webhook hostnames before dns resolution', function () {
--- tests/Unit/WebhookUrlGuardTest.php:56-62
   56  
   57      $options = $guard->requestOptions('https://hooks.example.com/events');
   58  
   59      expect($guard->isSafe('https://hooks.example.com/events'))->toBeTrue()
   60          ->and($options['curl'][CURLOPT_RESOLVE])->toBe(['hooks.example.com:443:93.184.216.34']);
   61  });
   62  

* app/Http/Requests/StoreWebhookEndpointRequest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: uses the PublicWebhookUrl rule"}
--- app/Http/Requests/StoreWebhookEndpointRequest.php:25-31
   25      public function rules(): array
   26      {
   27          return [
   28              'url' => ['required', 'url:http,https', 'max:2048', new PublicWebhookUrl],
   29              'events' => ['required', 'array', 'min:1'],
   30              'events.*' => ['string', Rule::in(['delivery', 'bounce', 'complaint', 'open', 'click', 'suppress', 'inbound.received'])],
   31              'status' => ['required', Rule::in(['active', 'paused'])],

* app/Http/Requests/StoreOnboardingRequest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: uses the PublicWebhookUrl rule"}
--- app/Http/Requests/StoreOnboardingRequest.php:46-52
   46              'sending_domain' => ['nullable', 'string', 'max:255', 'regex:/^(?!-)[A-Za-z0-9.-]+(?<!-)$/'],
   47              'create_api_key' => ['boolean'],
   48              'api_key_name' => ['nullable', 'string', 'max:255'],
   49              'webhook_url' => ['nullable', 'url:http,https', 'max:2048', new PublicWebhookUrl],
   50          ];
   51      }
   52  }

* app/Jobs/DeliverWebhook.php  {"proposed_by_reader": false, "reader_excluded_because": "calls requestOptions (:65), not isSafe. isSafe wraps requestOptions, so the job is beside isSafe, not downstream of it. The corpus basis claim (:45) is the handle signature, not an isSafe call."}
--- app/Jobs/DeliverWebhook.php: none of ['isSafe'] appears in the file

* app/Jobs/DeliverInboundWebhook.php  {"proposed_by_reader": false, "reader_excluded_because": "calls requestOptions (:92), not isSafe. Lines :54 and :85 are signatures that take a WebhookUrlGuard."}
--- app/Jobs/DeliverInboundWebhook.php: none of ['isSafe'] appears in the file

* tests/Pest.php  {"proposed_by_reader": false, "reader_excluded_because": "binds an anonymous subclass that overrides resolveHost only (:23-28). It neither calls nor overrides isSafe, so it is not a dependency on isSafe's contract."}
--- tests/Pest.php: none of ['isSafe'] appears in the file

* app/Services/WebhookUrlGuard.php  {"proposed_by_reader": false, "reader_excluded_because": "declaring file; no other method calls isSafe"}
--- app/Services/WebhookUrlGuard.php:8-14
    8  
    9  class WebhookUrlGuard
   10  {
   11      public function isSafe(string $url): bool
   12      {
   13          try {
   14              $this->requestOptions($url);


========== ITEM ls-e-02 ==========
Question (registered, verbatim):
{
 "id": "ls-e-02",
 "suite": "E",
 "class": "change-impact",
 "subject": "larasend",
 "language": "php",
 "question": "If Suppression::normalizeEmail changes its contract, which files must be re-read?",
 "probe": "normalizeEmail",
 "declared_in": "app/Models/Suppression.php:44",
 "hop_stratum": 2,
 "basis": [
  "direct users: app/Services/EmailSendService.php, SuppressionRemovalService.php, SesEventNormalizer.php, CloudflareApiClient.php, app/Jobs/SyncCloudflareSourceSuppressions.php",
  "their callers (hop 2), resolved by the oracle"
 ],
 "distractors": [
  {
   "path": "app/Models/Suppression.php",
   "why": ":121 declares normalizeEmails (plural), a different symbol; the file counts only for its own calls of normalizeEmail"
  }
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 12 controller entry point(s)", "framework-invoked entry point(s) not followed: App\\Models\\Suppression::email, App\\Models\\Suppression::scopeWhereNormalizedEmail, runCloudflareSuppressionSourceSync, App\\Models\\Suppression::scopeWhereNormalizedEmailIn, App\\Models\\Suppression::scopeWhereNormalizedEmailNotIn"]

Reader notes: answerable_as_registered=True; The oracle's 16 are all correct. Adding the two mutator-only tests gives 18. Drop those two if framework-invoked mutators do not count as call hops.
Reader on the oracle's open list: Framework-invoked entry points followed by hand. The email mutator (Suppression.php:37-41) fires on every Eloquent write of 'email', which adds ActivityDashboardTest and SuppressionManagementTest. The scope users are EmailSendService:254, SyncCloudflareSourceSuppressions:114 and :164, and SuppressionEmailNormalizationMigrationTest:430. runCloudflareSuppressionSourceSync is a test helper in CloudflareSuppressionSyncTest.php:39. Route hops are hop 3 and fall outside the bound.

Candidate files (22):

* app/Models/Suppression.php  {"proposed_by_reader": true, "reader_reason": "hop 1: the email mutator, scopeWhereNormalizedEmail and normalizeEmails (plural, which feeds the In and NotIn scopes) all call normalizeEmail", "listed_by_oracle": true, "reader_on_oracle_file": "keep: self-calls at :40, :58, :124. The distractor normalizeEmails is a different symbol, but the file also calls the probe directly."}
--- app/Models/Suppression.php:37-43
   37      protected function email(): Attribute
   38      {
   39          return Attribute::make(
   40              set: fn (string $email): string => self::normalizeEmail($email),
   41          );
   42      }
   43  
--- app/Models/Suppression.php:55-61
   55       */
   56      public function scopeWhereNormalizedEmail(Builder $query, string $email): void
   57      {
   58          $query->where($this->normalizedEmailColumn(), self::normalizeEmail($email));
   59      }
   60  
   61      /**
--- app/Models/Suppression.php:121-127
  121      private function normalizeEmails(iterable $emails): array
  122      {
  123          return collect($emails)
  124              ->map(fn (string $email): string => self::normalizeEmail($email))
  125              ->uniqueStrict()
  126              ->values()
  127              ->all();

* app/Services/EmailSendService.php  {"proposed_by_reader": true, "reader_reason": "hop 1: direct calls in ensureRecipientsAreSendable, plus whereNormalizedEmailIn", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Services/EmailSendService.php:238-244
  238      {
  239          $recipients = collect(['to', 'cc', 'bcc'])
  240              ->flatMap(fn (string $type) => $payload[$type] ?? [])
  241              ->map(fn (string $recipient): string => Suppression::normalizeEmail(
  242                  $this->mimeBuilder->splitAddress($recipient)['email'],
  243              ))
  244              ->filter()
--- app/Services/EmailSendService.php:253-259
  253              ->active()
  254              ->whereNormalizedEmailIn($recipients)
  255              ->pluck('email')
  256              ->map(fn (string $email): string => Suppression::normalizeEmail($email))
  257              ->all();
  258  
  259          if ($suppressed === []) {
--- app/Services/EmailSendService.php:251-257
  251  
  252          $suppressed = $project->suppressions()
  253              ->active()
  254              ->whereNormalizedEmailIn($recipients)
  255              ->pluck('email')
  256              ->map(fn (string $email): string => Suppression::normalizeEmail($email))
  257              ->all();

* app/Services/SuppressionRemovalService.php  {"proposed_by_reader": true, "reader_reason": "hop 1", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Services/SuppressionRemovalService.php:58-64
   58              );
   59          }
   60  
   61          $email = Suppression::normalizeEmail($suppression->email);
   62          $stillSuppressed = collect($upstreamSuppressions)
   63              ->contains(
   64                  fn (array $upstream): bool => Suppression::normalizeEmail($upstream['email']) === $email,
--- app/Services/SuppressionRemovalService.php:61-67
   61          $email = Suppression::normalizeEmail($suppression->email);
   62          $stillSuppressed = collect($upstreamSuppressions)
   63              ->contains(
   64                  fn (array $upstream): bool => Suppression::normalizeEmail($upstream['email']) === $email,
   65              );
   66  
   67          if ($stillSuppressed) {

* app/Services/SesEventNormalizer.php  {"proposed_by_reader": true, "reader_reason": "hop 1: in recordSuppression and upsertSqlServerSuppression", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Services/SesEventNormalizer.php:156-162
  156  
  157          $attributes = (new Suppression)->forceFill([
  158              'project_id' => $email->project_id,
  159              'email' => Suppression::normalizeEmail($recipient),
  160              'workspace_id' => $email->workspace_id,
  161              'source_id' => $email->source_id,
  162              'email_id' => $email->id,
--- app/Services/SesEventNormalizer.php:196-202
  196              $attributes['source_id'],
  197              $attributes['email_id'],
  198              $attributes['email'],
  199              Suppression::normalizeEmail($attributes['email']),
  200              $attributes['reason'],
  201              $attributes['event_type'],
  202              $attributes['expires_at'],

* app/Services/CloudflareApiClient.php  {"proposed_by_reader": true, "reader_reason": "hop 1: in normalizeSuppressionSnapshot, which listStableSuppressions uses", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Services/CloudflareApiClient.php:125-131
  125          return collect($suppressions)
  126              ->map(fn (array $suppression): array => [
  127                  'id' => trim($suppression['id']),
  128                  'email' => Suppression::normalizeEmail($suppression['email']),
  129                  'reason' => trim($suppression['reason']),
  130                  'created_at' => $suppression['created_at'],
  131                  'expires_at' => $suppression['expires_at'],
--- app/Services/CloudflareApiClient.php:104-110
  104          $previousSnapshot = null;
  105  
  106          for ($attempt = 0; $attempt < 3; $attempt++) {
  107              $snapshot = $this->normalizeSuppressionSnapshot($this->listSuppressionsUntil($source, $deadline));
  108  
  109              if ($previousSnapshot !== null && $snapshot === $previousSnapshot) {
  110                  return $snapshot;

* app/Jobs/SyncCloudflareSourceSuppressions.php  {"proposed_by_reader": true, "reader_reason": "hop 1 direct call, plus the scopes (hop 2)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Jobs/SyncCloudflareSourceSuppressions.php:58-64
   58  
   59          foreach ($suppressions as $suppression) {
   60              $this->ensureWithinWorkBudget($deadline);
   61              $email = Suppression::normalizeEmail($suppression['email']);
   62  
   63              if ($email === '') {
   64                  continue;
--- app/Jobs/SyncCloudflareSourceSuppressions.php:111-117
  111              return;
  112          }
  113  
  114          $providerSyncSuppressions->whereNormalizedEmailNotIn($syncedEmails)->delete();
  115      }
  116  
  117      /**
--- app/Jobs/SyncCloudflareSourceSuppressions.php:161-167
  161      private function suppressionForEmail(Project $project, string $email, array $values): Suppression
  162      {
  163          return $project->suppressions()
  164              ->whereNormalizedEmail($email)
  165              ->firstOrCreate([], ['email' => $email, ...$values]);
  166      }
  167  

* app/Http/Controllers/Api/EmailController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls EmailSendService::send", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send caller"}
--- app/Http/Controllers/Api/EmailController.php:77-83
   77          }
   78  
   79          try {
   80              $email = $emailSendService->send($project, $source, $payload, $idempotencyKey, $idempotencyHash);
   81          } catch (QueryException $exception) {
   82              if ($idempotencyKey === null || ! $this->isUniqueConstraintViolation($exception)) {
   83                  throw $exception;

* app/Http/Controllers/DashboardActionController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls send and SuppressionRemovalService::remove", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send and removal caller"}
--- app/Http/Controllers/DashboardActionController.php:384-390
  384              return $this->redirectToSendSetup($project);
  385          }
  386  
  387          $email = $emailSendService->send($project, $source, $request->validated());
  388  
  389          Inertia::flash('toast', ['type' => 'success', 'message' => "Email queued as {$email->public_id}."]);
  390  
--- app/Http/Controllers/DashboardActionController.php:328-334
  328          abort_unless($suppression->project_id === $project->id, 404);
  329  
  330          try {
  331              $removalService->remove($suppression);
  332          } catch (SuppressionRemovalException $exception) {
  333              Inertia::flash('toast', ['type' => 'error', 'message' => $exception->getMessage()]);
  334  

* app/Http/Controllers/ThreadActionController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls EmailSendService::send", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send caller"}
--- app/Http/Controllers/ThreadActionController.php:68-74
   68          $source = $this->projectContext->currentSource($project);
   69  
   70          try {
   71              $this->sendService->send($project, $source, [
   72                  'from' => $lastInbound->to_email,
   73                  'to' => [$lastInbound->from_email],
   74                  'cc' => collect($this->recipientList($validated['cc'] ?? ''))
--- app/Http/Controllers/ThreadActionController.php:129-135
  129          $source = $this->projectContext->currentSource($project);
  130  
  131          try {
  132              $email = $this->sendService->send($project, $source, [
  133                  'from' => ($validated['from'] ?? null) ?: $source->default_from_email,
  134                  'to' => $this->recipientList($validated['to']),
  135                  'cc' => $this->recipientList($validated['cc'] ?? ''),
--- app/Http/Controllers/ThreadActionController.php:195-201
  195          $text = ($note !== '' ? $note."\n\n" : '').$quoted;
  196  
  197          try {
  198              $this->sendService->send($project, $this->projectContext->currentSource($project), [
  199                  'from' => $lastInbound->to_email,
  200                  'to' => [$validated['to']],
  201                  'subject' => $subject,

* app/Http/Controllers/Api/SuppressionController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: injects and uses SuppressionRemovalService", "listed_by_oracle": true, "reader_on_oracle_file": "keep: removal service caller"}
--- app/Http/Controllers/Api/SuppressionController.php:17-23
   17      public function destroy(
   18          Request $request,
   19          Suppression $suppression,
   20          SuppressionRemovalService $removalService,
   21      ): Response|JsonResponse {
   22          /** @var Project $project */
   23          $project = $request->attributes->get('larasend_project');

* app/Http/Controllers/Webhooks/SesWebhookController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls SesEventNormalizer::record", "listed_by_oracle": true, "reader_on_oracle_file": "keep: record caller"}
--- app/Http/Controllers/Webhooks/SesWebhookController.php:58-64
   58              return response()->json(['message' => 'Invalid event payload.'], 422);
   59          }
   60  
   61          $normalizer->record($source, $eventPayload, is_string($payload['MessageId'] ?? null) ? $payload['MessageId'] : null);
   62          $log->forceFill(['status' => 'processed'])->save();
   63  
   64          return response()->json(['message' => 'Event processed.']);

* tests/Feature/ApiEmailTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls EmailSendService::send directly, and Suppression::create triggers the email mutator", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct send calls"}
--- tests/Feature/ApiEmailTest.php:119-125
  119      $this->app->instance(Dispatcher::class, $dispatcher);
  120  
  121      try {
  122          expect(fn () => app(EmailSendService::class)->send($project, $source, [
  123              'from' => 'Larasend <receipts@example.com>',
  124              'to' => ['maya@example.com'],
  125              'subject' => 'Durable queue handoff',
--- tests/Feature/ApiEmailTest.php:435-441
  435  
  436      Queue::fake();
  437  
  438      Suppression::create([
  439          'workspace_id' => $workspace->id,
  440          'project_id' => $project->id,
  441          'source_id' => $source->id,

* tests/Feature/ThreadingTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls EmailSendService::send directly", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct send call"}
--- tests/Feature/ThreadingTest.php:90-96
   90          'raw' => base64_encode(threadedInboundMime('Need a refund', 'msg-9@customer.test')),
   91      ])->assertStatus(202);
   92  
   93      $email = app(EmailSendService::class)->send($project, $source, [
   94          'from' => 'Support <support@example.com>',
   95          'to' => ['maya@customer.test'],
   96          'subject' => 'Re: Need a refund',

* tests/Feature/SesWebhookTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls SesEventNormalizer::record directly, plus Suppression::create through the mutator", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct record calls"}
--- tests/Feature/SesWebhookTest.php:192-198
  192      });
  193  
  194      try {
  195          app(SesEventNormalizer::class)->record($source, [
  196              'eventType' => 'Delivery',
  197              'mail' => [
  198                  'messageId' => 'ses-1',
--- tests/Feature/SesWebhookTest.php:302-308
  302      DB::flushQueryLog();
  303      DB::enableQueryLog();
  304  
  305      app(SesEventNormalizer::class)->record($source, $payload);
  306  
  307      $suppressionQueries = collect(DB::getQueryLog())
  308          ->pluck('query')
--- tests/Feature/SesWebhookTest.php:270-276
  270          'cloudflare_account_id' => 'account',
  271          'webhook_token' => 'cloudflare-webhook-token',
  272      ]);
  273      $suppression = Suppression::create([
  274          'workspace_id' => $email->workspace_id,
  275          'project_id' => $email->project_id,
  276          'source_id' => $cloudflareSource->id,

* tests/Feature/CloudflareSuppressionSyncTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: runs SyncCloudflareSourceSuppressions::handle directly (runCloudflareSuppressionSourceSync), plus Suppression::create through the mutator", "listed_by_oracle": true, "reader_on_oracle_file": "keep: runs the sync job's handle directly"}
--- tests/Feature/CloudflareSuppressionSyncTest.php:38-44
   38  
   39  function runCloudflareSuppressionSourceSync(Source $source, ?CloudflareApiClient $cloudflare = null): void
   40  {
   41      (new SyncCloudflareSourceSuppressions($source->id))
   42          ->handle($cloudflare ?? app(CloudflareApiClient::class));
   43  }
   44  
--- tests/Feature/CloudflareSuppressionSyncTest.php:132-138
  132          'webhook_token' => 'token-'.str()->random(8),
  133      ]);
  134  
  135      $missingUpstream = Suppression::create([
  136          'workspace_id' => $project->workspace_id,
  137          'project_id' => $project->id,
  138          'source_id' => $source->id,

* tests/Feature/SuppressionEmailNormalizationMigrationTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls record and the sync job directly, calls whereNormalizedEmailIn, and creates Suppressions through the mutator", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct record, job and scope calls"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:153-159
  153      DB::flushQueryLog();
  154      DB::enableQueryLog();
  155  
  156      app(SesEventNormalizer::class)->record($sesSource, [
  157          'eventType' => 'Complaint',
  158          'mail' => [
  159              'messageId' => 'ses-incoming',
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:292-298
  292              ->push(['success' => true, 'result' => []]),
  293      ]);
  294  
  295      (new SyncCloudflareSourceSuppressions($cloudflareSource->id))
  296          ->handle(app(CloudflareApiClient::class));
  297  
  298      expect($survivor->fresh())
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php:427-433
  427      $syncJobSource = file_get_contents(app_path('Jobs/SyncCloudflareSourceSuppressions.php'));
  428      $sesNormalizerSource = file_get_contents(app_path('Services/SesEventNormalizer.php'));
  429  
  430      $query = Suppression::query()->whereNormalizedEmailIn([
  431          ' ASCII@Example.com ',
  432          'ÄBC@Example.com',
  433      ]);

* tests/Feature/ActivityDashboardTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2 through framework indirection: Suppression::query()->create(['email' => ...]) invokes the email mutator, which calls normalizeEmail"}
--- tests/Feature/ActivityDashboardTest.php:71-77
   71      ]);
   72      $expiredAt = now()->subDay()->startOfSecond();
   73  
   74      Suppression::query()->create([
   75          'workspace_id' => $project->workspace_id,
   76          'project_id' => $project->id,
   77          'source_id' => $source->id,

* tests/Feature/SuppressionManagementTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2 through framework indirection: Suppression::create(['email' => ...]) invokes the mutator. Its route calls to SuppressionRemovalService are hop 3."}
--- tests/Feature/SuppressionManagementTest.php:47-53
   47  
   48  function managedSuppression(Project $project, ?Source $source, string $email = 'blocked@example.com'): Suppression
   49  {
   50      return Suppression::create([
   51          'workspace_id' => $project->workspace_id,
   52          'project_id' => $project->id,
   53          'source_id' => $source?->id,

* app/Jobs/SyncCloudflareSuppressions.php  {"proposed_by_reader": false, "reader_excluded_because": "Only dispatches SyncCloudflareSourceSuppressions to the queue (:40) and never calls handle. It is hop 2 only if queue hops count."}
--- app/Jobs/SyncCloudflareSuppressions.php: none of ['normalizeEmail'] appears in the file

* tests/Feature/DashboardActionsTest.php, CloudflareSendTest.php, InboxReplyTest.php  {"proposed_by_reader": false, "reader_excluded_because": "they reach EmailSendService through routes, which is hop 3"}
--- tests/Feature/DashboardActionsTest.php, CloudflareSendTest.php, InboxReplyTest.php: FILE NOT FOUND at the pin

* routes/web.php, routes/api.php  {"proposed_by_reader": false, "reader_excluded_because": "register hop-2 controllers, which puts them at hop 3"}
--- routes/web.php, routes/api.php: FILE NOT FOUND at the pin

* app/Http/Controllers/ActivityController.php, ActivityExportController.php  {"proposed_by_reader": false, "reader_excluded_because": "query suppressions() and active() only, never a normalizing scope or email write"}
--- app/Http/Controllers/ActivityController.php, ActivityExportController.php: FILE NOT FOUND at the pin


========== ITEM ls-e-03 ==========
Question (registered, verbatim):
{
 "id": "ls-e-03",
 "suite": "E",
 "class": "change-impact",
 "subject": "larasend",
 "language": "php",
 "question": "If MimeMessageBuilder::splitAddress changes its contract, which files must be re-read (full closure)?",
 "probe": "splitAddress",
 "declared_in": "app/Services/MimeMessageBuilder.php:84",
 "hop_stratum": ">=3",
 "basis": [
  "app/Services/EmailSendService.php:70,96,142,197,242 (hop 1)",
  "EmailSendService is called from app/Http/Controllers/Api/EmailController.php:80 and the dashboard send path (hop 2), which are reached from routes/api.php and routes/web.php (hop 3)"
 ]
}

Reference engine (oracle) status: oracle-partial; its open list: ["route hops not followed from 8 controller entry point(s)"]

Reader notes: answerable_as_registered=True; The full closure, counting the routes files and route-level tests, is 12 files. Without routes and route-level tests, it is the oracle's 6. In ApiEmailTest, one test mocks EmailSendService (:234-258), but other tests in the file call the real service.
Reader on the oracle's open list: Route hops followed from the three controllers to the routes files and to the tests that call those routes. No artisan command, job or listener calls EmailSendService::send.

Candidate files (17):

* app/Services/EmailSendService.php  {"proposed_by_reader": true, "reader_reason": "hop 1: the only caller of splitAddress", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct caller"}
--- app/Services/EmailSendService.php:67-73
   67  
   68          try {
   69              $email = DB::transaction(function () use ($project, $source, $payload, $template, $from, $publicId, $mime, $mimeDisk, $mimePath, $idempotencyKey, $idempotencyHash) {
   70                  $fromAddress = $this->mimeBuilder->splitAddress($from);
   71  
   72                  $email = Email::create([
   73                      'public_id' => $publicId,
--- app/Services/EmailSendService.php:93-99
   93  
   94                  foreach (['to', 'cc', 'bcc'] as $type) {
   95                      foreach ($payload[$type] ?? [] as $recipient) {
   96                          $address = $this->mimeBuilder->splitAddress($recipient);
   97                          $email->recipients()->create([
   98                              'type' => $type,
   99                              'email' => $address['email'],
--- app/Services/EmailSendService.php:139-145
  139       */
  140      private function ensureSourceCanSend(Project $project, Source $source, string $from): void
  141      {
  142          if (blank($from) || ! $this->mimeBuilder->splitAddress($from)['email']) {
  143              throw ValidationException::withMessages([
  144                  'from' => 'A valid sender address is required before sending.',
  145              ]);

* app/Http/Controllers/Api/EmailController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: calls send", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send caller"}
--- app/Http/Controllers/Api/EmailController.php:77-83
   77          }
   78  
   79          try {
   80              $email = $emailSendService->send($project, $source, $payload, $idempotencyKey, $idempotencyHash);
   81          } catch (QueryException $exception) {
   82              if ($idempotencyKey === null || ! $this->isUniqueConstraintViolation($exception)) {
   83                  throw $exception;

* app/Http/Controllers/DashboardActionController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: send, resend and retrySoftBounces", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send caller"}
--- app/Http/Controllers/DashboardActionController.php:384-390
  384              return $this->redirectToSendSetup($project);
  385          }
  386  
  387          $email = $emailSendService->send($project, $source, $request->validated());
  388  
  389          Inertia::flash('toast', ['type' => 'success', 'message' => "Email queued as {$email->public_id}."]);
  390  
--- app/Http/Controllers/DashboardActionController.php:418-424
  418          }
  419  
  420          try {
  421              $resent = $emailSendService->send($project, $email->source, $this->payloadForRetry($email));
  422          } catch (Throwable $exception) {
  423              report($exception);
  424  
--- app/Http/Controllers/DashboardActionController.php:454-460
  454                      return;
  455                  }
  456  
  457                  $emailSendService->send($project, $email->source, $this->payloadForRetry($email));
  458                  $retried++;
  459              });
  460  

* app/Http/Controllers/ThreadActionController.php  {"proposed_by_reader": true, "reader_reason": "hop 2: reply, compose and forward", "listed_by_oracle": true, "reader_on_oracle_file": "keep: send caller"}
--- app/Http/Controllers/ThreadActionController.php:68-74
   68          $source = $this->projectContext->currentSource($project);
   69  
   70          try {
   71              $this->sendService->send($project, $source, [
   72                  'from' => $lastInbound->to_email,
   73                  'to' => [$lastInbound->from_email],
   74                  'cc' => collect($this->recipientList($validated['cc'] ?? ''))
--- app/Http/Controllers/ThreadActionController.php:129-135
  129          $source = $this->projectContext->currentSource($project);
  130  
  131          try {
  132              $email = $this->sendService->send($project, $source, [
  133                  'from' => ($validated['from'] ?? null) ?: $source->default_from_email,
  134                  'to' => $this->recipientList($validated['to']),
  135                  'cc' => $this->recipientList($validated['cc'] ?? ''),
--- app/Http/Controllers/ThreadActionController.php:195-201
  195          $text = ($note !== '' ? $note."\n\n" : '').$quoted;
  196  
  197          try {
  198              $this->sendService->send($project, $this->projectContext->currentSource($project), [
  199                  'from' => $lastInbound->to_email,
  200                  'to' => [$validated['to']],
  201                  'subject' => $subject,

* tests/Feature/ApiEmailTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: direct send, and the /api/emails route (hop 3)", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct send"}
--- tests/Feature/ApiEmailTest.php:119-125
  119      $this->app->instance(Dispatcher::class, $dispatcher);
  120  
  121      try {
  122          expect(fn () => app(EmailSendService::class)->send($project, $source, [
  123              'from' => 'Larasend <receipts@example.com>',
  124              'to' => ['maya@example.com'],
  125              'subject' => 'Durable queue handoff',
--- tests/Feature/ApiEmailTest.php:183-189
  183  
  184      $first = $this->withToken($token)
  185          ->withHeader('Idempotency-Key', 'order-4821')
  186          ->postJson('/api/emails', $payload)
  187          ->assertAccepted();
  188      $second = $this->withToken($token)
  189          ->withHeader('Idempotency-Key', 'order-4821')

* tests/Feature/ThreadingTest.php  {"proposed_by_reader": true, "reader_reason": "hop 2: direct send", "listed_by_oracle": true, "reader_on_oracle_file": "keep: direct send"}
--- tests/Feature/ThreadingTest.php:90-96
   90          'raw' => base64_encode(threadedInboundMime('Need a refund', 'msg-9@customer.test')),
   91      ])->assertStatus(202);
   92  
   93      $email = app(EmailSendService::class)->send($project, $source, [
   94          'from' => 'Support <support@example.com>',
   95          'to' => ['maya@customer.test'],
   96          'subject' => 'Re: Need a refund',

* routes/api.php  {"proposed_by_reader": true, "reader_reason": "hop 3: registers EmailController::store"}
--- routes/api.php:10-16
   10  
   11  Route::middleware(['throttle:larasend-api-ip', AuthenticateLarasendApiKey::class, ThrottleLarasendApiKey::class])->group(function () {
   12      Route::get('emails', [EmailController::class, 'index'])->name('api.emails.index');
   13      Route::post('emails', [EmailController::class, 'store'])->name('api.emails.store');
   14      Route::get('emails/{email}', [EmailController::class, 'show'])->name('api.emails.show');
   15      Route::delete('suppressions/{suppression}', [SuppressionController::class, 'destroy'])->name('api.suppressions.destroy');
   16  });

* routes/web.php  {"proposed_by_reader": true, "reader_reason": "hop 3: registers the send, resend, retry, reply, forward and compose routes"}
--- routes/web.php:59-65
   59          Route::delete('suppressions/{suppression}', [DashboardActionController::class, 'destroyProjectSuppression'])->name('suppressions.destroy');
   60          Route::post('webhooks', [DashboardActionController::class, 'storeWebhookEndpoint'])->name('webhooks.store');
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
--- routes/web.php:61-67
   61          Route::put('webhooks/{endpoint:public_id}', [DashboardActionController::class, 'updateWebhookEndpoint'])->name('webhooks.update');
   62          Route::post('send', [DashboardActionController::class, 'sendEmail'])->name('send.store');
   63          Route::post('bounces/retry-soft', [DashboardActionController::class, 'retrySoftBounces'])->name('bounces.retry-soft');
   64          Route::post('emails/{email:public_id}/resend', [DashboardActionController::class, 'resendProjectEmail'])->name('emails.resend');
   65          Route::get('inbox', InboxController::class)->name('inbox');
   66          Route::post('threads/{thread:public_id}/read', [ThreadActionController::class, 'read'])->name('threads.read');
   67          Route::post('threads/{thread:public_id}/unread', [ThreadActionController::class, 'unread'])->name('threads.unread');
--- routes/web.php:67-73
   67          Route::post('threads/{thread:public_id}/unread', [ThreadActionController::class, 'unread'])->name('threads.unread');
   68          Route::post('threads/{thread:public_id}/archive', [ThreadActionController::class, 'archive'])->name('threads.archive');
   69          Route::post('threads/{thread:public_id}/unarchive', [ThreadActionController::class, 'unarchive'])->name('threads.unarchive');
   70          Route::post('threads/{thread:public_id}/reply', [ThreadActionController::class, 'reply'])->name('threads.reply');
   71          Route::post('threads/{thread:public_id}/forward', [ThreadActionController::class, 'forward'])->name('threads.forward');
   72          Route::post('threads/{thread:public_id}/snooze', [ThreadActionController::class, 'snooze'])->name('threads.snooze');
   73          Route::post('threads/{thread:public_id}/unsnooze', [ThreadActionController::class, 'unsnooze'])->name('threads.unsnooze');

* tests/Feature/CloudflareSendTest.php  {"proposed_by_reader": true, "reader_reason": "hop 3: POST /api/emails"}
--- tests/Feature/CloudflareSendTest.php:94-100
   94  
   95      Queue::fake();
   96  
   97      $this->withToken($token)->postJson('/api/emails', [
   98          'from' => 'Larasend <receipts@example.com>',
   99          'to' => ['Maya <maya@example.com>'],
  100          'cc' => ['copy@example.com'],

* tests/Feature/CloudflareSuppressionSyncTest.php  {"proposed_by_reader": true, "reader_reason": "hop 3: POST /api/emails"}
--- tests/Feature/CloudflareSuppressionSyncTest.php:418-424
  418      $issued = ApiKey::issue($project, 'Collision test', $historicalSource);
  419      Queue::fake();
  420  
  421      $this->withToken($issued['plain_text'])->postJson('/api/emails', [
  422          'from' => 'Larasend <receipts@example.com>',
  423          'to' => ['Expired Collision <expired-collision@example.com>'],
  424          'subject' => 'Must stay blocked',

* tests/Feature/DashboardActionsTest.php  {"proposed_by_reader": true, "reader_reason": "hop 3: send, resend and retry-soft routes"}
--- tests/Feature/DashboardActionsTest.php:598-604
  598      $user = User::factory()->create();
  599  
  600      $this->actingAs($user)
  601          ->post('/send', [
  602              'from' => 'Larasend <receipts@example.com>',
  603              'to' => 'maya@example.com, team@example.com',
  604              'cc' => '',
--- tests/Feature/DashboardActionsTest.php:664-670
  664      $original = Email::query()->where('subject', 'Resend me')->firstOrFail();
  665  
  666      $this->actingAs($user)
  667          ->post("/emails/{$original->public_id}/resend")
  668          ->assertRedirect('/activity');
  669  
  670      $resent = Email::query()->where('subject', 'Resend me')->latest('id')->first();
--- tests/Feature/DashboardActionsTest.php:744-750
  744      ]);
  745  
  746      $this->actingAs($user)
  747          ->post('/bounces/retry-soft')
  748          ->assertRedirect('/bounces')
  749          ->assertInertiaFlash('toast');
  750  

* tests/Feature/InboxReplyTest.php  {"proposed_by_reader": true, "reader_reason": "hop 3: compose, reply and forward routes"}
--- tests/Feature/InboxReplyTest.php:109-115
  109      Queue::fake();
  110  
  111      $this->actingAs($user)
  112          ->post("/projects/{$project->slug}/inbox/compose", [
  113              'to' => 'lead@customer.test, billing@customer.test',
  114              'cc' => 'sales@customer.test, owner@customer.test',
  115              'bcc' => 'audit@example.com',
--- tests/Feature/InboxReplyTest.php:138-144
  138      $inbound->forceFill(['headers' => [...$inbound->headers, 'Cc' => 'finance@customer.test, support@example.com']])->save();
  139  
  140      $this->actingAs($user)
  141          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/reply", [
  142              'text' => 'Replying to everyone',
  143              'reply_all' => true,
  144          ])
--- tests/Feature/InboxReplyTest.php:199-205
  199      $thread = Thread::query()->firstOrFail();
  200  
  201      $this->actingAs($user)
  202          ->post("/projects/{$project->slug}/threads/{$thread->public_id}/forward", [
  203              'to' => 'teammate@example.org',
  204              'text' => 'Can you take this one?',
  205          ])

* app/Services/MimeMessageBuilder.php  {"proposed_by_reader": false, "reader_excluded_because": "declaring file; it has no internal call of splitAddress"}
--- app/Services/MimeMessageBuilder.php:81-87
   81      /**
   82       * @return array{email: string, name: string|null}
   83       */
   84      public function splitAddress(string $value): array
   85      {
   86          $address = $this->address($value);
   87  

* app/Services/Providers/CloudflareEmailProvider.php  {"proposed_by_reader": false, "reader_excluded_because": "uses MimeMessageBuilder but never calls splitAddress"}
--- app/Services/Providers/CloudflareEmailProvider.php: none of ['splitAddress'] appears in the file

* tests/Feature/SuppressionEmailNormalizationMigrationTest.php  {"proposed_by_reader": false, "reader_excluded_because": "reads EmailSendService.php only as a string (:426)"}
--- tests/Feature/SuppressionEmailNormalizationMigrationTest.php: none of ['splitAddress'] appears in the file

* resources/js/pages/Inbox.vue, Activity.vue  {"proposed_by_reader": false, "reader_excluded_because": "post to the send and thread routes over HTTP from the browser, so they are not a code-call closure. The Wayfinder actions and routes are generated and gitignored, and absent at the pin."}
--- resources/js/pages/Inbox.vue, Activity.vue: FILE NOT FOUND at the pin

* tests/Feature/ActivityDashboardTest.php  {"proposed_by_reader": false, "reader_excluded_because": "only GETs /send (ActivityController)"}
--- tests/Feature/ActivityDashboardTest.php: none of ['splitAddress'] appears in the file