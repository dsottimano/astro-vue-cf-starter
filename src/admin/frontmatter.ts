import yaml from 'js-yaml';

// Round-trip markdown entry files (YAML frontmatter + body) for the admin.
// js-yaml handles quoting/escaping so user-entered colons, quotes, etc. are safe.

export function serializeEntry(data: Record<string, unknown>, body: string): string {
  const fm = yaml.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false }).trimEnd();
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}

export function parseEntry(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const data = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
  return { data, body: match[2].replace(/^\n+/, '') };
}
