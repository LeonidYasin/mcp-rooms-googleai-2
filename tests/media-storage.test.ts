import { describe, it, expect, beforeEach } from 'vitest';
import { issueTestKey } from './auth-helpers';
import { getUploadByIdFromDb, saveUploadInDb } from '../server/db';

describe('Persistent Image & Media Storage API', () => {
  let userKey: string;

  beforeEach(() => {
    const res = issueTestKey('user:media-uploader');
    userKey = res.key;
  });

  it('persists and retrieves upload record in SQLite DB', () => {
    const uploadId = 'img-test-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const upload = saveUploadInDb({
      id: uploadId,
      filename: 'sample.png',
      mimeType: 'image/png',
      size: 1024,
      url: `/uploads/${uploadId}.png`,
      owner: 'user:media-uploader',
      createdAt: Date.now(),
    });

    expect(upload.id).toBe(uploadId);

    const retrieved = getUploadByIdFromDb(uploadId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.filename).toBe('sample.png');
    expect(retrieved!.size).toBe(1024);
    expect(retrieved!.owner).toBe('user:media-uploader');
  });
});
