import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../auth';
import { saveUploadInDb, addAuditLog } from '../db';

export const uploadsRouter = Router();

export const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

uploadsRouter.post('/api/uploads', requireAuth, (req, res) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/json')) {
    res.status(400).json({ error: 'invalid_content_type', message: 'Expected multipart/form-data or JSON base64 upload' });
    return;
  }

  const { filename, mimeType, base64Data } = req.body || {};
  if (!base64Data || typeof base64Data !== 'string') {
    res.status(400).json({ error: 'invalid_upload_data', message: 'base64Data is required' });
    return;
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(413).json({ error: 'payload_too_large', message: 'Maximum file size is 5MB' });
    return;
  }

  const fileExt = (filename && path.extname(filename)) || '.png';
  const fileId = 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const targetFilename = fileId + fileExt;
  const targetPath = path.join(uploadsDir, targetFilename);

  fs.writeFileSync(targetPath, buffer);

  const url = '/uploads/' + targetFilename;
  const record = saveUploadInDb({
    id: fileId,
    filename: filename || targetFilename,
    mimeType: mimeType || 'image/png',
    size: buffer.length,
    url,
    owner: req.principal!.principalId,
    createdAt: Date.now(),
  });

  addAuditLog('media.upload', req.principal!.principalId, record.id, { filename: record.filename, size: record.size });

  res.status(201).json({ success: true, upload: record });
});
