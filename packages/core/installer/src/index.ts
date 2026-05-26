/**
 * Retirement stub for the legacy v3 TypeScript installer.
 *
 * The standalone `@event4u/installer` workspace was retired in v4.0.0
 * (road-to-unified-setup § D1). All install logic now lives in
 * `src/install/` under the root package and is driven by
 * `agent-config install` / `agent-config setup`.
 *
 * This stub stays in place so the legacy
 * `.github/workflows/tests.yml` Node-Tests matrix keeps passing
 * until a maintainer with `workflow` OAuth scope removes the three
 * "Installer (…)" steps from that workflow. Once the workflow file
 * is patched and merged, this directory can be deleted in full.
 */
export const RETIRED = true;
