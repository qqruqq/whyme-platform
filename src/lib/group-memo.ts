export type InstructorMemoEntry = {
  createdAtIso: string;
  instructorName: string;
  content: string;
};

export type OpsMemoEntry = {
  createdAtIso: string;
  actorName: string;
  content: string;
};

const INSTRUCTOR_NOTE_PREFIX = '[강사특이사항]';
const OPS_NOTE_PREFIX = '[운영메모]';

function splitLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function sanitizeSingleLine(value: string): string {
  return value.replace(/\|/g, '／').replace(/\s*\n+\s*/g, ' / ').trim();
}

function appendLine(value: string | null | undefined, line: string): string {
  const lines = splitLines(value);
  lines.push(line);
  return lines.join('\n');
}

function parseTaggedLine(
  line: string,
  prefix: string
): { createdAtIso: string; actorName: string; content: string } | null {
  if (!line.startsWith(`${prefix}|`)) {
    return null;
  }

  const parts = line.split('|');
  if (parts.length < 4) {
    return null;
  }

  const [, createdAtIso, actorName, ...contentParts] = parts;
  const content = contentParts.join('|').trim();
  if (!createdAtIso || !actorName || !content) {
    return null;
  }

  return {
    createdAtIso,
    actorName,
    content,
  };
}

export function extractLocationFromMemo(memo: string | null | undefined): string | null {
  const lines = splitLines(memo);
  const locationLine = lines.find((line) => line.startsWith('교육 장소:'));
  if (!locationLine) return null;

  const location = locationLine.replace('교육 장소:', '').trim();
  return location || null;
}

export function upsertLocationInMemo(
  memo: string | null | undefined,
  location: string | null | undefined
): string | null {
  const normalized = location?.trim();
  const lines = splitLines(memo);
  const nextLines = lines.filter((line) => !line.startsWith('교육 장소:'));

  if (normalized) {
    nextLines.unshift(`교육 장소: ${normalized}`);
  }

  return nextLines.length > 0 ? nextLines.join('\n') : null;
}

export function appendInstructorMemo(
  memo: string | null | undefined,
  instructorName: string,
  content: string,
  createdAt = new Date()
): string {
  const line = [
    INSTRUCTOR_NOTE_PREFIX,
    createdAt.toISOString(),
    sanitizeSingleLine(instructorName || '담당강사'),
    sanitizeSingleLine(content),
  ].join('|');

  return appendLine(memo, line);
}

export function appendOpsMemo(
  memo: string | null | undefined,
  actorName: string,
  content: string,
  createdAt = new Date()
): string {
  const line = [
    OPS_NOTE_PREFIX,
    createdAt.toISOString(),
    sanitizeSingleLine(actorName || '실무자'),
    sanitizeSingleLine(content),
  ].join('|');

  return appendLine(memo, line);
}

export function extractInstructorMemos(memo: string | null | undefined): InstructorMemoEntry[] {
  const lines = splitLines(memo);

  return lines
    .map((line) => parseTaggedLine(line, INSTRUCTOR_NOTE_PREFIX))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      createdAtIso: entry.createdAtIso,
      instructorName: entry.actorName,
      content: entry.content,
    }))
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export function extractOpsMemos(memo: string | null | undefined): OpsMemoEntry[] {
  const lines = splitLines(memo);

  return lines
    .map((line) => parseTaggedLine(line, OPS_NOTE_PREFIX))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      createdAtIso: entry.createdAtIso,
      actorName: entry.actorName,
      content: entry.content,
    }))
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}
