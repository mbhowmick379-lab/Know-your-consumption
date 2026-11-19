import type { CompositionItem, MultiContainerBasis } from '../types/clinical.ts';

/**
 * Parses a numeric milligram (mg) quantity from a composition strength string.
 * Supports mg, g (converted to mg), and mcg / µg (converted to mg).
 * Returns null for non-mass strengths such as "60M spores", "1000 IU", or empty strings.
 */
export function parseMgFromStrength(strength?: string): number | null {
  if (!strength || typeof strength !== 'string') return null;
  const cleaned = strength.replace(/,/g, '').trim();
  if (!cleaned) return null;

  // Match mg (e.g., "500 mg", "125mg", "250 mg / 5 mL")
  const mgMatch = /(\d+(?:\.\d+)?)\s*mg\b/i.exec(cleaned);
  if (mgMatch) {
    const val = Number(mgMatch[1]);
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(3)) : null;
  }

  // Match grams (e.g., "1 g", "0.5 gm") -> convert to mg
  const gMatch = /(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams)\b/i.exec(cleaned);
  if (gMatch) {
    const val = Number(gMatch[1]) * 1000;
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(3)) : null;
  }

  // Match micrograms (e.g., "500 mcg", "10 µg") -> convert to mg
  const mcgMatch = /(\d+(?:\.\d+)?)\s*(?:mcg|µg|ug)\b/i.exec(cleaned);
  if (mcgMatch) {
    const val = Number(mcgMatch[1]) / 1000;
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(4)) : null;
  }

  // Bare number only (e.g., user typed "500")
  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    const val = Number(cleaned);
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(3)) : null;
  }

  return null;
}

export interface MultiTotalMgSummary {
  autoTotalMg: number;
  parsedCount: number;
  nonMgCount: number;
}

/**
 * Sums all mg-parseable active composition strengths cleanly.
 */
export function computeMultiCompositionTotalMg(
  compositions: CompositionItem[]
): MultiTotalMgSummary {
  let sum = 0;
  let parsedCount = 0;
  let nonMgCount = 0;

  for (const comp of compositions) {
    if (!comp.name.trim()) continue;
    const rawStr = (comp.strength || '').trim();
    if (!rawStr) continue;
    const mg = parseMgFromStrength(rawStr);
    if (mg !== null) {
      sum += mg;
      parsedCount += 1;
    } else {
      nonMgCount += 1;
    }
  }

  return {
    autoTotalMg: Number(sum.toFixed(3)),
    parsedCount,
    nonMgCount,
  };
}

/**
 * Formats a concise human-readable container summary for Multi-Composition labels:
 * e.g., "Each 5 mL contains 131 mg total (Paracetamol 125 mg + Phenylephrine 5 mg + Chlorpheniramine 1 mg)"
 */
export function formatMultiContainerSummary(params: {
  compositions: CompositionItem[];
  basis: MultiContainerBasis;
  perMl?: number | null;
  totalMg?: number | null;
}): string {
  const validComps = params.compositions.filter((c) => c.name.trim().length > 0);
  if (validComps.length === 0) return '';

  const { autoTotalMg } = computeMultiCompositionTotalMg(validComps);
  const effectiveTotalMg =
    params.totalMg !== null &&
    params.totalMg !== undefined &&
    Number.isFinite(params.totalMg) &&
    params.totalMg > 0
      ? Number(params.totalMg.toFixed(3))
      : autoTotalMg > 0
        ? autoTotalMg
        : null;

  const compParts = validComps.map((c) =>
    c.strength?.trim() ? `${c.name.trim()} ${c.strength.trim()}` : c.name.trim()
  );

  const containerPrefix =
    params.basis === 'liquid' && params.perMl && Number.isFinite(params.perMl) && params.perMl > 0
      ? `Each ${params.perMl} mL contains`
      : params.basis === 'capsule'
        ? 'Per 1 Capsule contains'
        : 'Per 1 Tablet contains';

  const totalText = effectiveTotalMg !== null ? `${effectiveTotalMg} mg total` : 'combined active doses';

  return `${containerPrefix} ${totalText} (${compParts.join(' + ')})`;
}
