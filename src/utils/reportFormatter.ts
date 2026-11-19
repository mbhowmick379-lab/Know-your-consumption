export const REPORT_WIDTH = 76;
const DOUBLE_RULE = '='.repeat(REPORT_WIDTH);
const SINGLE_RULE = '-'.repeat(REPORT_WIDTH);

export interface ReportKeyValueRow {
  label: string;
  value?: string | null;
}

export interface ReportSection {
  title: string;
  lines: string[];
}

export interface StructuredReportConfig {
  reportTitle: string;
  reportCode: string;
  generatedAt?: string;
  subtitle?: string;
  sections: ReportSection[];
  disclaimer?: string;
}

/**
 * Word-wraps a paragraph cleanly to fit within `width` characters,
 * applying `continuationIndent` on wrapped lines.
 */
export function wrapText(
  text: string,
  width = REPORT_WIDTH,
  firstLineIndent = '',
  continuationIndent = firstLineIndent
): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const result: string[] = [];
  const paragraphs = cleaned.split('\n');

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx].trim();
    if (!para) {
      result.push('');
      continue;
    }

    const words = para.split(/\s+/);
    let currentIndent = pIdx === 0 ? firstLineIndent : continuationIndent;
    let currentLine = currentIndent;

    for (const word of words) {
      const needsSpace = currentLine.length > currentIndent.length;
      const candidateLen = currentLine.length + (needsSpace ? 1 : 0) + word.length;

      if (candidateLen <= width || !needsSpace) {
        currentLine += (needsSpace ? ' ' : '') + word;
      } else {
        result.push(currentLine);
        currentIndent = continuationIndent;
        currentLine = currentIndent + word;
      }
    }

    if (currentLine.trim().length > 0) {
      result.push(currentLine);
    }
  }

  return result;
}

/**
 * Formats aligned key-value metadata rows with clean hanging indentation on long values.
 */
export function formatKeyValueRows(
  rows: ReportKeyValueRow[],
  minLabelWidth = 20
): string[] {
  const validRows = rows.filter(
    (r): r is { label: string; value: string } =>
      typeof r.value === 'string' && r.value.trim().length > 0
  );
  if (validRows.length === 0) return [];

  const maxLabelLen = Math.min(
    26,
    Math.max(minLabelWidth, ...validRows.map((r) => r.label.trim().length))
  );
  const continuationIndent = ' '.repeat(maxLabelLen + 3);
  const out: string[] = [];

  for (const row of validRows) {
    const paddedLabel = row.label.trim().padEnd(maxLabelLen, ' ');
    const prefix = `${paddedLabel} : `;
    const wrapped = wrapText(row.value.trim(), REPORT_WIDTH, prefix, continuationIndent);
    out.push(...wrapped);
  }

  return out;
}

/**
 * Formats a numbered sequence (1., 2., 3.) with aligned hanging indents.
 */
export function formatNumberedList(items: string[], indent = '  '): string[] {
  const out: string[] = [];
  items
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((item, idx) => {
      const marker = `${indent}${idx + 1}. `;
      const contIndent = ' '.repeat(marker.length);
      out.push(...wrapText(item, REPORT_WIDTH, marker, contIndent));
    });
  return out;
}

/**
 * Formats a clean bulleted list (- ...) with aligned hanging indents.
 */
export function formatBulletList(items: string[], indent = '  '): string[] {
  const out: string[] = [];
  items
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((item) => {
      const marker = `${indent}- `;
      const contIndent = ' '.repeat(marker.length);
      out.push(...wrapText(item, REPORT_WIDTH, marker, contIndent));
    });
  return out;
}

/**
 * Generates a deterministic-format, human-readable report reference ID.
 */
export function createReportId(reportCode: string, timestampIso?: string): string {
  const d = timestampIso ? new Date(timestampIso) : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = validDate.getFullYear();
  const m = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const hh = String(validDate.getHours()).padStart(2, '0');
  const mm = String(validDate.getMinutes()).padStart(2, '0');
  return `KYC-${reportCode.toUpperCase()}-${y}${m}${day}-${hh}${mm}`;
}

/**
 * Builds a properly structured, sequentially numbered plain-text clinical report
 * with consistent header, aligned tables, wrapped paragraphs, and footer.
 */
export function buildStructuredReport(config: StructuredReportConfig): string {
  const timestamp = config.generatedAt || new Date().toLocaleString();
  const reportId = createReportId(config.reportCode);

  const nonEmptySections = config.sections.filter((sec) =>
    sec.lines.some((line) => line.trim().length > 0)
  );

  const lines: string[] = [
    DOUBLE_RULE,
    `KNOW YOUR CONSUMPTION(KYC) — ${config.reportTitle.toUpperCase()}`,
    'Designed by Manoj · Clinical Medication Safety & Health Portal',
    ...(config.subtitle ? [config.subtitle] : []),
    DOUBLE_RULE,
    ...formatKeyValueRows(
      [
        { label: 'Report Reference', value: reportId },
        { label: 'Generated On', value: timestamp },
        { label: 'Total Sections', value: `${nonEmptySections.length + 1} (Ordered Clinical Sequence)` },
      ],
      18
    ),
  ];

  nonEmptySections.forEach((section, index) => {
    const secNum = index + 1;
    lines.push(
      '',
      SINGLE_RULE,
      `SECTION ${secNum}. ${section.title.toUpperCase()}`,
      SINGLE_RULE
    );
    // Collapse consecutive blank lines inside a section
    let prevBlank = false;
    for (const rawLine of section.lines) {
      const isBlank = rawLine.trim().length === 0;
      if (isBlank && prevBlank) continue;
      lines.push(rawLine);
      prevBlank = isBlank;
    }
    // Trim trailing blank line inside section
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
  });

  const disclaimerSectionNum = nonEmptySections.length + 1;
  const disclaimerText =
    config.disclaimer ||
    'This report is provided for patient education and continuity of care. Always verify diagnosis, dosing, or medication changes with a licensed physician or pharmacist.';

  lines.push(
    '',
    SINGLE_RULE,
    `SECTION ${disclaimerSectionNum}. IMPORTANT MEDICAL NOTICE`,
    SINGLE_RULE,
    ...wrapText(disclaimerText, REPORT_WIDTH),
    '',
    DOUBLE_RULE,
    'END OF REPORT — Know Your Consumption(KYC) designed by Manoj',
    DOUBLE_RULE
  );

  return lines.join('\n') + '\n';
}
