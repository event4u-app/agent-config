/**
 * WizardPage — step-by-step setup flow.
 *
 * Phase 3 of the unified-setup-and-settings-gui roadmap. The wizard
 * shares the SchemaForm primitive with SettingsPage so step bodies
 * stay declarative: each step picks a subset of schema paths and
 * renders only those fields. Final step calls `/api/v1/wizard/finish`
 * which dual-writes `.agent-settings.yml` + `.agent-user.md` via 2PC.
 *
 * Step layout lives in `wizard/steps.ts` and mirrors the chat-side
 * `~/.claude/skills/onboard/SKILL.md` so both surfaces collect the same
 * data points. Signal store is in `wizard/state.ts`.
 */

import { useEffect } from 'preact/hooks';
import { apiFetch, ApiCallError } from '../api.js';
import { topLevelCopy, fieldErrorMap } from '../copyErrors.js';
import { SchemaForm } from '../forms/SchemaForm.js';
import { Textarea } from '../forms/Textarea.js';
import type { JsonSchemaLeaf, JsonValue } from '../forms/schemaTypes.js';
import { WIZARD_STEPS, WIZARD_TOTAL_STEPS, stepAt } from '../wizard/steps.js';
import { sliceSchema } from '../wizard/sliceSchema.js';
import { StepHeader } from '../wizard/StepHeader.js';
import { StepNav } from '../wizard/StepNav.js';
import { WizardReview } from '../wizard/WizardReview.js';
import {
    banner,
    clampStep,
    diffLoading,
    errors,
    initialSettings,
    loaded,
    loadError,
    reviewChanges,
    saving,
    schema,
    settingsLastModified,
    startedAtNow,
    stepIndex,
    userMdBody,
    userMdExists,
    userMdInitial,
    userMdLoaded,
    userMdSkipped,
    values,
    type WizardServerState,
} from '../wizard/state.js';

interface SettingsGetResponse {
    values: Record<string, JsonValue>;
    lastModified: number;
    path: string;
    schema: JsonSchemaLeaf | { definitions?: Record<string, JsonSchemaLeaf>; $ref?: string };
}

interface UserMdGetResponse {
    body: string;
    exists: boolean;
    lastModified: number | null;
}

function unwrapSchema(raw: SettingsGetResponse['schema']): JsonSchemaLeaf {
    if ('$ref' in raw && raw.$ref !== undefined && 'definitions' in raw && raw.definitions !== undefined) {
        const name = raw.$ref.replace('#/definitions/', '');
        const def = raw.definitions[name];
        if (def !== undefined) return def;
    }
    return raw as JsonSchemaLeaf;
}

async function loadAll(): Promise<void> {
    loadError.value = null;
    try {
        const [serverState, settingsRes] = await Promise.all([
            apiFetch<WizardServerState>('/api/v1/wizard/state'),
            apiFetch<SettingsGetResponse>('/api/v1/settings'),
        ]);
        schema.value = unwrapSchema(settingsRes.schema);
        settingsLastModified.value = settingsRes.lastModified;
        initialSettings.value = settingsRes.values;
        // Resume from server partial when present; otherwise seed from disk values.
        const partialKeys = Object.keys(serverState.partial ?? {});
        values.value = partialKeys.length > 0
            ? { ...settingsRes.values, ...serverState.partial }
            : settingsRes.values;
        stepIndex.value = clampStep(serverState.step);
        loaded.value = true;
    } catch (err) {
        if (err instanceof ApiCallError) {
            loadError.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            loadError.value = err instanceof Error ? err.message : String(err);
        }
    }
}

async function loadUserMdOnce(): Promise<void> {
    if (userMdLoaded.value) return;
    try {
        const res = await apiFetch<UserMdGetResponse>('/api/v1/user-md');
        userMdInitial.value = res.body;
        userMdBody.value = res.body;
        userMdExists.value = res.exists;
        if (!res.exists) {
            try {
                const tpl = await apiFetch<{ body: string }>('/api/v1/user-md/template');
                userMdBody.value = tpl.body;
            } catch {
                /* leave empty */
            }
        }
    } catch (err) {
        banner.value = err instanceof Error ? err.message : String(err);
    } finally {
        userMdLoaded.value = true;
    }
}

async function persistStep(nextIndex: number, partial: Record<string, JsonValue>): Promise<void> {
    try {
        await apiFetch('/api/v1/wizard/state', {
            method: 'POST',
            body: {
                step: nextIndex,
                totalSteps: WIZARD_TOTAL_STEPS,
                partial,
                startedAt: startedAtNow(null),
            },
        });
    } catch (err) {
        banner.value = err instanceof Error ? err.message : String(err);
    }
}


async function refreshDiff(): Promise<void> {
    diffLoading.value = true;
    try {
        const res = await apiFetch<{ changes: { path: string; before: JsonValue; after: JsonValue }[] }>(
            '/api/v1/settings/diff',
            {
                method: 'POST',
                body: { values: values.value, ifUnmodifiedSince: settingsLastModified.value },
            },
        );
        reviewChanges.value = res.changes;
        errors.value = {};
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            banner.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        diffLoading.value = false;
    }
}

function userMdChanged(): boolean {
    if (userMdSkipped.value) return false;
    return userMdBody.value !== userMdInitial.value;
}

async function goTo(nextIndex: number): Promise<void> {
    const target = clampStep(nextIndex);
    await persistStep(target, values.value);
    stepIndex.value = target;
    banner.value = null;
    const next = stepAt(target);
    if (next.kind === 'userMd') {
        void loadUserMdOnce();
    }
    if (next.kind === 'review') {
        void refreshDiff();
    }
}

async function finish(): Promise<void> {
    saving.value = true;
    banner.value = null;
    try {
        const body: { settings: Record<string, JsonValue>; userMd?: string } = {
            settings: values.value,
        };
        if (userMdChanged()) {
            body.userMd = userMdBody.value;
        }
        const res = await apiFetch<{ writtenPaths: string[]; txnId: string }>(
            '/api/v1/wizard/finish',
            { method: 'POST', body },
        );
        banner.value = `Saved (${res.writtenPaths.join(', ')}). Wizard complete.`;
        // Drop wizard state on success — server unlinks; mirror locally.
        stepIndex.value = clampStep(WIZARD_TOTAL_STEPS - 1);
        // Refresh initialSettings to match the just-written state so a
        // re-entry into the wizard doesn't show stale "changes".
        initialSettings.value = values.value;
        userMdInitial.value = userMdChanged() ? userMdBody.value : userMdInitial.value;
        reviewChanges.value = [];
    } catch (err) {
        if (err instanceof ApiCallError) {
            errors.value = fieldErrorMap(err.body.error ?? { code: 'UNKNOWN', message: err.message });
            banner.value = topLevelCopy(err.body.error ?? { code: 'UNKNOWN', message: err.message });
        } else {
            banner.value = err instanceof Error ? err.message : String(err);
        }
    } finally {
        saving.value = false;
    }
}

function StepBody(): preact.JSX.Element | null {
    const step = stepAt(stepIndex.value);
    if (step.kind === 'form') {
        const sliced = sliceSchema(schema.value!, step.paths ?? []);
        return (
            <SchemaForm
                schema={sliced}
                values={values.value}
                errors={errors.value}
                onChange={(next): void => { values.value = next; }}
            />
        );
    }
    if (step.kind === 'userMd') {
        if (!userMdLoaded.value) return <p>Loading .agent-user.md…</p>;
        return (
            <Textarea
                id="user-md-body"
                name="body"
                label="Body"
                description="Long-form persona / preferences. Saved verbatim at .agent-user.md. Use Skip to leave the file unchanged."
                rows={20}
                value={userMdBody.value}
                onChange={(next): void => { userMdBody.value = next; userMdSkipped.value = false; }}
            />
        );
    }
    // review
    return (
        <WizardReview
            changes={reviewChanges.value}
            userMdChanged={userMdChanged()}
            userMdAction={userMdExists.value ? 'replace' : 'create'}
            loading={diffLoading.value}
        />
    );
}

export function WizardPage({ path: _path }: { path: string }): preact.JSX.Element {
    useEffect(() => { void loadAll(); }, []);

    if (!loaded.value || schema.value === null) {
        return (
            <div class="ac-page">
                <h1>Setup wizard</h1>
                {loadError.value !== null
                    ? <p class="ac-banner ac-banner--error">{loadError.value}</p>
                    : <p>Loading…</p>}
            </div>
        );
    }

    const idx = stepIndex.value;
    const step = stepAt(idx);
    const isLast = idx === WIZARD_TOTAL_STEPS - 1;

    return (
        <div class="ac-page">
            <StepHeader step={step} index={idx} total={WIZARD_TOTAL_STEPS} />
            {banner.value !== null ? <p class="ac-banner">{banner.value}</p> : null}
            <div class="ac-wizard__step">
                <StepBody />
            </div>
            <StepNav
                canGoPrev={idx > 0}
                canGoNext={!isLast}
                canSkip={step.kind === 'userMd'}
                isLast={isLast}
                busy={saving.value || diffLoading.value}
                onPrev={(): void => { void goTo(idx - 1); }}
                onNext={(): void => { void goTo(idx + 1); }}
                onSkip={(): void => { userMdSkipped.value = true; void goTo(idx + 1); }}
                onFinish={(): void => { void finish(); }}
            />
        </div>
    );
}
