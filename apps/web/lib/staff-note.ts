/** Strip internal reject tags like `[invalid]` / `[spam]` for citizen-facing copy. */
export function publicStaffNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note.replace(/^\[(invalid|spam)\]\s*/i, '').trim();
  return cleaned || null;
}
