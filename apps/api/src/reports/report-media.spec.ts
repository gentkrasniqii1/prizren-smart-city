import { describe, expect, it } from 'vitest';
import { resolveReportMedia } from './report-media';

describe('resolveReportMedia', () => {
  it('uses relational rows when present and hides staff attachments from the public', () => {
    const media = resolveReportMedia({
      photoUrl: 'https://cdn.example/primary.jpg',
      photoAfterUrl: null,
      staff: false,
      media: [
        {
          id: 'm1',
          role: 'INITIAL',
          sortOrder: 1,
          url: 'https://cdn.example/b.jpg',
          mimeType: 'image/jpeg',
          visibility: 'PUBLIC',
          createdAt: new Date('2026-08-22T00:00:00Z'),
        },
        {
          id: 'm0',
          role: 'INITIAL',
          sortOrder: 0,
          url: 'https://cdn.example/a.jpg',
          mimeType: 'image/jpeg',
          visibility: 'PUBLIC',
          createdAt: new Date('2026-08-22T00:00:00Z'),
        },
        {
          id: 'secret',
          role: 'ATTACHMENT',
          sortOrder: 0,
          url: 'https://cdn.example/note.pdf',
          mimeType: 'application/pdf',
          visibility: 'STAFF',
          createdAt: new Date('2026-08-22T00:00:00Z'),
        },
      ],
    });
    expect(media.map((row) => row.url)).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/b.jpg',
    ]);
  });

  it('falls back to denormalized photoUrl/photoAfterUrl', () => {
    const media = resolveReportMedia({
      media: [],
      photoUrl: 'https://cdn.example/before.jpg',
      photoAfterUrl: 'https://cdn.example/after.jpg',
      staff: false,
    });
    expect(media).toEqual([
      expect.objectContaining({ role: 'INITIAL', url: 'https://cdn.example/before.jpg' }),
      expect.objectContaining({ role: 'AFTER', url: 'https://cdn.example/after.jpg' }),
    ]);
  });
});
