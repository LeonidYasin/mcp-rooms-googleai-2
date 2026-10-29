import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { initDatabase, addMessageToRoomInDb, createRoomInDb } from '../server/db';
import { issueSseTicket } from '../server/auth';
import { app } from '../server';

describe('SSE Last-Event-ID & Replay Support', () => {
  const dbPath = path.resolve(process.cwd(), 'data', 'test_sse_replay.db');
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    process.env.DATABASE_PATH = dbPath;
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    initDatabase();

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('should replay missed room messages when Last-Event-ID header is present', async () => {
    const now = Date.now();
    const roomId = 'room-sse-test-' + now;

    createRoomInDb({
      id: roomId,
      listingTitle: 'SSE Test Listing',
      participants: ['user:alice', 'user:bob'],
    });

    const msg1 = {
      id: 'msg-' + now + '-100',
      roomId,
      sender: 'user:alice',
      role: 'human',
      text: 'First message',
      timestamp: 1000000,
    };
    const msg2 = {
      id: 'msg-' + now + '-200',
      roomId,
      sender: 'user:bob',
      role: 'human',
      text: 'Second message (missed)',
      timestamp: 2000000,
    };
    const msg3 = {
      id: 'msg-' + now + '-300',
      roomId,
      sender: 'user:alice',
      role: 'human',
      text: 'Third message (missed)',
      timestamp: 3000000,
    };

    addMessageToRoomInDb(msg1);
    addMessageToRoomInDb(msg2);
    addMessageToRoomInDb(msg3);

    const principal = { principalId: 'user:alice', keyId: 'key-alice', scopes: ['*' as const] };
    const ticket = issueSseTicket(principal, roomId);

    const responseText = await new Promise<string>((resolve, reject) => {
      const req = http.get(
        `${baseUrl}/api/rooms/${roomId}/stream?ticket=${ticket}`,
        {
          headers: {
            'Last-Event-ID': '1000000',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
            if (data.includes('data: {')) {
              req.destroy();
              resolve(data);
            }
          });
        }
      );
      req.on('error', (err) => {
        if ((err as any).code === 'ECONNRESET') return;
        reject(err);
      });
    });

    expect(responseText).toContain('event: init');
    expect(responseText).toContain('Second message (missed)');
    expect(responseText).toContain('Third message (missed)');
    expect(responseText).not.toContain('First message');
  });
});
