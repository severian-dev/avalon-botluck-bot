const SLOT_PATTERN = /\{([^{}]*)\}/g;
const SLOT_NAME_RX = /^[A-Za-z][A-Za-z0-9_]*$/;
const MAX_TEMPLATE_LENGTH = 4000;
const MAX_SLOTS = 25;

export interface ParsedTemplate {
  template: string;
  slots: string[];
}

export class TemplateParseError extends Error {}

export function parseTemplate(raw: string): ParsedTemplate {
  const template = raw.replace(/\r\n/g, '\n');

  if (template.length === 0) {
    throw new TemplateParseError('Template is empty.');
  }
  if (template.length > MAX_TEMPLATE_LENGTH) {
    throw new TemplateParseError(
      `Template is too long (${template.length} chars; max ${MAX_TEMPLATE_LENGTH}).`,
    );
  }

  const slots: string[] = [];
  const seen = new Set<string>();

  SLOT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SLOT_PATTERN.exec(template)) !== null) {
    const name = match[1].trim();
    if (!SLOT_NAME_RX.test(name)) {
      throw new TemplateParseError(
        `Invalid slot name "${match[1]}". Use letters, digits, and underscores; must start with a letter.`,
      );
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      throw new TemplateParseError(`Duplicate slot "${name}". Each slot name must appear once.`);
    }
    seen.add(lower);
    slots.push(name);
  }

  // Reject orphan/unmatched braces that didn't form a {slot} token.
  const stripped = template.replace(SLOT_PATTERN, '');
  if (stripped.includes('{') || stripped.includes('}')) {
    throw new TemplateParseError('Unmatched "{" or "}" in template.');
  }

  if (slots.length === 0) {
    throw new TemplateParseError('Template has no {slot} placeholders.');
  }
  if (slots.length > MAX_SLOTS) {
    throw new TemplateParseError(`Too many slots (${slots.length}; max ${MAX_SLOTS}).`);
  }

  return { template, slots };
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(SLOT_PATTERN, (_, rawName) => {
    const name = String(rawName).trim();
    return values[name] ?? `{${name}}`;
  });
}
