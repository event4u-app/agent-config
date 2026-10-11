/**
 * uiRenderAssetTypes — the asset profile's declared vocabulary.
 *
 * Its own module so that the profile and its geometry comparison can both read
 * these without importing each other: the profile calls the comparison, the
 * comparison needs the classes and the tolerance shape, and a direct import
 * either way round is a cycle.
 *
 * Every constant here was pre-registered in step 0.3 of
 * `road-to-svg-with-a-witness` — before any checker existed — so a threshold
 * could not be chosen to fit what a rule already reported.
 */
import * as path from 'node:path';

import type { DeliveryMode, ViewBox } from '../../scripts/lint_svg_asset.js';
// TYPE-ONLY, and that is what keeps it legal: `AssetReading` carries the
// comparison's shape while the comparison needs the classes from here. A type
// import is erased, so the two modules describe each other without either one
// existing at the other's runtime.
import type { GeometryComparison } from './uiRenderAssetCompare.js';

// ---------------------------------------------------------------------------
// Declared constants — every one of them pre-registered in step 0.3
// ---------------------------------------------------------------------------

export const ASSET_CLASSES = ['icon', 'mark', 'illustration', 'diagram', 'animated'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

/**
 * Per class, never global. A file is loose BELOW its class threshold.
 * Overridden by a `fill_ratio_thresholds` block in `--thresholds <file>`.
 */
export const DEFAULT_FILL_RATIO_THRESHOLDS: Readonly<Record<AssetClass, number>> = {
    icon: 0.3,
    mark: 0.45,
    illustration: 0.4,
    diagram: 0.35,
    animated: 0.35,
};

export interface GeometryTolerance {
    silhouette_iou_min: number;
    max_boundary_distance_units: number;
}

/** Step 2.6's tolerances. Overridden by `geometry_tolerances` in `--thresholds`. */
export const DEFAULT_GEOMETRY_TOLERANCES: Readonly<Record<AssetClass, GeometryTolerance>> = {
    icon: { silhouette_iou_min: 0.98, max_boundary_distance_units: 1 },
    mark: { silhouette_iou_min: 0.98, max_boundary_distance_units: 2 },
    illustration: { silhouette_iou_min: 0.96, max_boundary_distance_units: 3 },
    diagram: { silhouette_iou_min: 0.97, max_boundary_distance_units: 2 },
    animated: { silhouette_iou_min: 0.97, max_boundary_distance_units: 2 },
};

/**
 * Used ONLY when no `tokens.json` resolves. The manifest records
 * `source: "fallback"` whenever these are used, because a reader cannot
 * otherwise tell a project's own background from this module's guess.
 */
export const FALLBACK_BACKGROUNDS = { light: '#ffffff', dark: '#111111' } as const;

/** The four paths the brand resolver searches, in its order. First hit wins. */
export const BRAND_TOKEN_PATHS: readonly string[] = [
    'tokens.json',
    'assets/tokens.json',
    'resources/tokens.json',
    path.join('agents', 'settings', 'brand', 'tokens.json'),
];

/** Icon sizes are the three the incumbent sets ship at. Other classes: 1x and 2x. */
export const ICON_SIZES: readonly number[] = [16, 24, 48];

/**
 * Below this, a draw-on animation is not reported. The planted row reads
 * 0.283 (a 300-unit dash on a 215-unit path) and its twin reads 0.0, so the
 * band between them is wide; 0.05 is inside it with room on both sides.
 */
export const DRAW_ON_DEAD_TIME_THRESHOLD = 0.05;

/** A channel at or above this, with alpha 1, counts as near-white paint. */
export const NEAR_WHITE_CHANNEL = 237;

/**
 * The synthetic host document. Fulfilled by the route handler at a URL inside
 * the asset's OWN directory, so a relative `href` inside the asset resolves
 * exactly as it would in place — without this module ever writing into the
 * directory it is reading.
 */
export const HOST_BASENAME = '__agent-config-asset-host__.html';

/** Schemes a page may reach. Everything else is aborted and counted. */
export const ALLOWED_SCHEMES = ['file:', 'data:', 'blob:', 'about:'];

// ---------------------------------------------------------------------------
// Manifest shapes — additive, keyed under `profile: "asset"` (step 2.2)
// ---------------------------------------------------------------------------

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface AssetSizeCapture {
    label: string;
    css_width: number;
    css_height: number;
    background: 'light' | 'dark';
    background_color: string;
    screenshot: string;
}

export interface OutsideViewBoxElement {
    index: number;
    id: string;
    tag: string;
    box: Box;
    wholly_outside: boolean;
}

export interface TextReading {
    index: number;
    id: string;
    text: string;
    box: Box;
    declared_box_id: string | null;
    declared_box: Box;
    fits: boolean;
    declared_family: string;
    first_family: string;
    resolved_family: string;
    first_family_resolved: boolean;
}

export interface DrawOnReading {
    index: number;
    id: string;
    total_length: number;
    path_length_attr: number | null;
    dash_units: number;
    offset_from: number;
    offset_to: number;
    dead_fraction: number;
}

export interface FrameReading {
    label: 'start' | 'mid' | 'end';
    t: number;
    digest: string;
}

export interface ReducedMotionReading {
    witnessable: boolean;
    /** Only meaningful when `witnessable` — `null` otherwise, never `true`. */
    frames_equal: boolean | null;
    reason: string;
    host_picture_route?: boolean;
}

export interface AssetFinding {
    rule: string;
    detail: string;
    severity: 'error' | 'warning';
}

export interface AssetReading {
    profile: 'asset';
    file: string;
    digest: string;
    asset_class: AssetClass;
    asset_class_inferred: boolean;
    delivery: DeliveryMode;
    view_box: ViewBox | null;
    intrinsic: { width: number; height: number };
    backgrounds: { light: string; dark: string; source: 'tokens' | 'fallback'; tokens_file: string | null };
    sizes: AssetSizeCapture[];
    readings_at: { css_width: number; css_height: number; background: 'light' | 'dark'; t: number } | null;
    true_vector: boolean;
    painted_box: Box | null;
    fill_ratio: number | null;
    fill_ratio_threshold: number;
    fill_ratio_threshold_source: 'manifest' | 'default';
    outside_view_box: OutsideViewBoxElement[];
    texts: TextReading[];
    accessible_names: Array<{ name: string; count: number }>;
    duplicate_accessible_names: string[];
    frames: FrameReading[];
    distinct_frames: number;
    draw_on: DrawOnReading[];
    icon_grid: IconGridReading | null;
    near_white_regions: Array<{ index: number; id: string; fill: string; enclosed_by: string }>;
    network: { aborted: number; blocked_urls: string[] };
    findings: AssetFinding[];
    comparison?: GeometryComparison;
    reduced_motion: ReducedMotionReading;
}

export interface IconGridReading {
    /** `unverified` when no reference icon shares this file's viewBox size (E6). */
    status: 'read' | 'unverified';
    reference_files: string[];
    reference_stroke_widths: number[];
    reference_padding: number[];
    stroke_width: number | null;
    padding: number | null;
    reason: string;
}

/**
 * The square sample grid both the profile and the comparison rasterise into.
 * One constant because a comparison taken at a different resolution than the
 * reading it is compared against is not a comparison.
 */
export const SAMPLE_RES = 256;
