/**
 * Shared signal store for the wizard page.
 *
 * Splitting the signals out of `WizardPage.tsx` keeps the page render
 * function readable and lets the chrome components (StepNav, StepHeader)
 * stay pure — they read props, not module state.
 */

import { signal } from '@preact/signals';
import type { JsonSchemaLeaf, JsonValue } from '../forms/schemaTypes.js';
import { WIZARD_TOTAL_STEPS } from './steps.js';

export interface WizardServerState {
    step: number;
    totalSteps: number;
    partial: Record<string, JsonValue>;
    startedAt: string | null;
}

export interface DiffChange {
    path: string;
    from: JsonValue;
    to: JsonValue;
}

export const loaded = signal(false);
export const loadError = signal<string | null>(null);
export const banner = signal<string | null>(null);
export const saving = signal(false);
export const diffLoading = signal(false);

export const stepIndex = signal(0);
export const schema = signal<JsonSchemaLeaf | null>(null);
export const values = signal<Record<string, JsonValue>>({});
export const initialSettings = signal<Record<string, JsonValue>>({});
export const settingsLastModified = signal<number>(0);
export const errors = signal<Record<string, string>>({});

export const userMdBody = signal<string>('');
export const userMdInitial = signal<string>('');
export const userMdExists = signal(false);
export const userMdLoaded = signal(false);
export const userMdSkipped = signal(false);

export const reviewChanges = signal<DiffChange[]>([]);

export function startedAtNow(existing: string | null): string {
    return existing ?? new Date().toISOString();
}

export function clampStep(idx: number): number {
    return Math.max(0, Math.min(WIZARD_TOTAL_STEPS - 1, idx));
}
