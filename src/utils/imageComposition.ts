import type { CompositionItem, ExtractedMedicineImageResult } from '../types/clinical.ts';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// ~6 MB decoded limit (approx 8 MB base64 characters)
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export interface ParsedImageDataUrl {
  mimeType: string;
  base64Data: string;
}

/**
 * Validates and extracts MIME type + raw base64 payload from an image data URL.
 */
export function parseImageDataUrl(dataUrl: unknown): ParsedImageDataUrl | null {
  if (typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(trimmed);
  if (!match) return null;

  const rawMime = match[1].toLowerCase();
  const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  if (!ALLOWED_IMAGE_MIME_TYPES.has(rawMime)) return null;

  const base64Data = match[2].replace(/\s+/g, '');
  if (base64Data.length < 32 || base64Data.length > MAX_BASE64_LENGTH) return null;

  return { mimeType, base64Data };
}

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanPositiveNumber(value: unknown, maxVal: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > maxVal) return null;
  return Number(num.toFixed(2));
}

export interface RawExtractedMedicinePayload {
  brandName?: unknown;
  dosageForm?: unknown;
  compositions?: unknown;
  liquidStrengthMg?: unknown;
  liquidPerMl?: unknown;
  indicationHint?: unknown;
  confidence?: unknown;
  extractedSummary?: unknown;
  warnings?: unknown;
}

/**
 * Sanitizes, deduplicates, and bounds Gemini vision extraction output for medicine labels/strips.
 */
export function normalizeExtractedMedicineData(
  raw: RawExtractedMedicinePayload
): ExtractedMedicineImageResult {
  const brandName = cleanString(raw.brandName, 90);
  const dosageForm = cleanString(raw.dosageForm, 60);
  const indicationHint = cleanString(raw.indicationHint, 120);
  const extractedSummary = cleanString(raw.extractedSummary, 280);

  const rawConfidence = typeof raw.confidence === 'string' ? raw.confidence.toLowerCase().trim() : '';
  const confidence: 'high' | 'medium' | 'low' =
    rawConfidence === 'high' || rawConfidence === 'medium' || rawConfidence === 'low'
      ? rawConfidence
      : 'medium';

  const seen = new Set<string>();
  const compositions: CompositionItem[] = [];
  if (Array.isArray(raw.compositions)) {
    for (const item of raw.compositions) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as { name?: unknown; strength?: unknown };
      const name = cleanString(rec.name, 90);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const strength = cleanString(rec.strength, 40);
      compositions.push({ name, strength });
      if (compositions.length >= 8) break;
    }
  }

  let liquidStrengthMg = cleanPositiveNumber(raw.liquidStrengthMg, 10000);
  let liquidPerMl = cleanPositiveNumber(raw.liquidPerMl, 500);
  if (liquidStrengthMg !== null && liquidPerMl === null) {
    liquidPerMl = 5;
  } else if (liquidStrengthMg === null) {
    liquidPerMl = null;
  }

  const warnings: string[] = [];
  if (Array.isArray(raw.warnings)) {
    for (const w of raw.warnings) {
      const cleaned = cleanString(w, 180);
      if (cleaned && !warnings.includes(cleaned)) {
        warnings.push(cleaned);
      }
      if (warnings.length >= 4) break;
    }
  }

  return {
    brandName,
    dosageForm,
    compositions,
    liquidStrengthMg,
    liquidPerMl,
    indicationHint,
    confidence,
    extractedSummary,
    warnings,
  };
}

/**
 * Merges newly scanned compositions into existing Multi-Composition rows:
 * - Preserves already-entered non-empty rows (allowing patients to scan multiple strips sequentially)
 * - Deduplicates case-insensitively (updating empty strength if the new scan provides one)
 * - Caps at maxRows (default 8) and keeps at least minRows (default 3)
 */
export function mergeCompositionsIntoRows(
  existing: CompositionItem[],
  incoming: CompositionItem[],
  maxRows = 8,
  minRows = 3
): CompositionItem[] {
  const result: CompositionItem[] = [];
  const indexByName = new Map<string, number>();

  for (const row of existing) {
    const name = row.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!indexByName.has(key)) {
      indexByName.set(key, result.length);
      result.push({ name, strength: (row.strength || '').trim() });
    }
  }

  for (const item of incoming) {
    const name = item.name.trim();
    if (!name) continue;
    const strength = (item.strength || '').trim();
    const key = name.toLowerCase();
    const existingIdx = indexByName.get(key);
    if (existingIdx !== undefined) {
      if (!result[existingIdx].strength && strength) {
        result[existingIdx] = { ...result[existingIdx], strength };
      }
      continue;
    }
    if (result.length >= maxRows) break;
    indexByName.set(key, result.length);
    result.push({ name, strength });
  }

  while (result.length < minRows) {
    result.push({ name: '', strength: '' });
  }

  return result;
}

/**
 * Builds the best clean display input for Single Medicine mode from an extracted image scan.
 */
export function formatSingleMedicineFromScan(extracted: ExtractedMedicineImageResult): string {
  const brand = extracted.brandName.trim();
  const comps = extracted.compositions.filter((c) => c.name.trim().length > 0);

  if (brand && comps.length === 1) {
    const comp = comps[0];
    if (brand.toLowerCase().includes(comp.name.toLowerCase())) {
      return brand;
    }
    return `${brand} (${comp.name}${comp.strength ? ` ${comp.strength}` : ''})`;
  }
  if (brand && comps.length > 1) {
    return brand;
  }
  if (comps.length === 1) {
    return comps[0].name;
  }
  if (comps.length > 1) {
    return comps.map((c) => c.name).join(' + ');
  }
  return brand;
}
