import { Router } from 'express';
import {
  getRoomsFromDb,
  getRoomByIdFromDb,
  createRoomInDb,
  addParticipantToRoomInDb,
  addMessageToRoomInDb,
  getListingByIdFromDb,
  getNegotiationsFromDb,
  getRoomEventsSinceInDb,
  classifyMessageInsertError,
} from '../db';
import {
  isRoomParticipant,
  optionalAuth,
  requireAuth,
  issueSseTicket,
  consumeSseTicket,
  Principal,
} from '../auth';
import { rateLimit } from '../http-guard';
import { roomEventBus } from '../events';

export const roomsRouter = Router();

// Public rooms catalog: available without authentication to everyone
roomsRouter.get('/api/public/rooms', (req, res) => {
  try {
    const allRooms = getRoomsFromDb();
    let publicRooms = allRooms.filter((r: any) => r.visibility === 'public');

    const category = typeof req.query?.category === 'string' ? req.query.category.trim() : '';
    if (category && category !== 'all') {
      publicRooms = publicRooms.filter((r: any) => r.category === category);
    }

    const listingId = typeof req.query?.listing_id === 'string' ? req.query.listing_id.trim() : '';
    if (listingId) {
      publicRooms = publicRooms.filter((r: any) => r.listingId === listingId);
    }

    const q = typeof req.query?.query === 'string' ? req.query.query.trim().toLowerCase() : '';
    if (q) {
      publicRooms = publicRooms.filter(
        (r: any) =>
          (r.listingTitle || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          r.messages.some((m: any) => (m.text || '').toLowerCase().includes(q))
      );
    }

    res.json(publicRooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

roomsRouter.get('/api/rooms', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const includePublic = req.query?.include_public === 'true';
    // By default, returns the participant's rooms (strictly maintaining F-01/rest-api.test.ts contract).
    // With ?include_public=true, also includes all open public rooms.
    const rooms = getRoomsFromDb().filter((room: any) =>
      includePublic
        ? room.visibility === 'public' || isRoomParticipant(room, principalId)
        : isRoomParticipant(room, principalId)
    );
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

roomsRouter.post('/api/rooms', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { listingId, title, category, visibility, initialMessage } = req.body || {};
    let listing: any = null;
    if (listingId) {
      listing = getListingByIdFromDb(listingId);
    }
    const roomId = `room-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const participants = [principalId];
    if (listing && listing.owner && listing.owner !== principalId) {
      participants.push(listing.owner);
    }
    const newRoom = createRoomInDb({
      id: roomId,
      listingId: listing?.id || listingId || undefined,
      listingTitle: listing?.content?.title || title || 'Новая переговорная комната',
      category: category || listing?.content?.category || undefined,
      participants,
      visibility: visibility === 'public' ? 'public' : 'private',
    });

    if (initialMessage && typeof initialMessage === 'string' && initialMessage.trim()) {
      addMessageToRoomInDb({
        id: 'msg-' + Date.now(),
        roomId,
        sender: principalId,
        role: 'human',
        text: initialMessage.trim(),
        timestamp: Date.now(),
      });
    }

    res.status(201).json(getRoomByIdFromDb(roomId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

roomsRouter.get('/api/rooms/:id', optionalAuth, (req, res) => {
  try {
    const roomId = String(req.params.id);
    const room = getRoomByIdFromDb(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    // Public room is viewable by anyone
    if (room.visibility === 'public') {
      res.json(room);
      return;
    }
    // Private room requires authentication and participant membership
    if (!req.principal) {
      res.status(401).json({ error: 'unauthorized', message: 'Необходим действующий Bearer токен' });
      return;
    }
    if (!isRoomParticipant(room, req.principal.principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
      return;
    }
    res.json(room);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ticket generation endpoint for secure SSE connections without exposing Bearer tokens in URLs
roomsRouter.post('/api/rooms/:id/ticket', optionalAuth, (req, res) => {
  const roomId = String(req.params.id);
  const room = getRoomByIdFromDb(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  if (room.visibility !== 'public') {
    if (!req.principal) {
      res.status(401).json({ error: 'unauthorized', message: 'Необходим действующий Bearer токен' });
      return;
    }
    if (!isRoomParticipant(room, req.principal.principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
      return;
    }
  }

  const principal: Principal = req.principal || {
    principalId: `guest-${Date.now().toString(36)}`,
    keyId: 'guest-key',
    scopes: ['*'],
  };
  const ticket = issueSseTicket(principal, roomId);
  res.status(201).json({ success: true, ticket, expires_in_seconds: 30 });
});

roomsRouter.get('/api/rooms/:id/stream', optionalAuth, (req, res) => {
  const roomId = String(req.params.id);
  let streamPrincipal = req.principal;
  const ticketParam = typeof req.query?.ticket === 'string' ? req.query.ticket : undefined;
  if (ticketParam) {
    const ticketPrincipal = consumeSseTicket(ticketParam, roomId);
    if (ticketPrincipal) {
      streamPrincipal = ticketPrincipal;
    }
  }

  const room = getRoomByIdFromDb(roomId);
  if (!room) {
    res.status(404).json({ error: `Комната ${roomId} не найдена` });
    return;
  }

  if (room.visibility !== 'public') {
    if (!streamPrincipal) {
      res.status(401).json({ error: 'unauthorized', message: 'Необходим действующий ticket или Bearer токен' });
      return;
    }
    if (!isRoomParticipant(room, streamPrincipal.principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
      return;
    }
  }

  // Enforce max 50 concurrent SSE subscribers per room
  const MAX_ROOM_SUBSCRIBERS = 50;
  if (roomEventBus.getSubscriberCount(roomId) >= MAX_ROOM_SUBSCRIBERS) {
    res.status(429).json({ error: 'too_many_subscribers', message: 'Превышен лимит подключений к комнате (макс. 50)' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Client lastEventId for reconnection and replay support
  const lastEventId = (req.headers['last-event-id'] as string) || (req.query.lastEventId as string) || '';

  // Current negotiation if exists
  const negs = getNegotiationsFromDb();
  const roomNeg = negs.find((n) => n.roomId === roomId) || null;

  // Replay missing messages if lastEventId was provided
  let filteredMessages = room.messages;
  if (lastEventId) {
    const lastTimeMatch = lastEventId.match(/(\d+)$/);
    if (lastTimeMatch) {
      const lastTimestamp = Number(lastTimeMatch[1]);
      if (Number.isFinite(lastTimestamp)) {
        filteredMessages = room.messages.filter((m: any) => m.timestamp > lastTimestamp);
      }
    }
  }

  // Send initial snapshot with SQLite messages (replayed or full)
  const initialPayload = {
    roomId: room.id,
    listingTitle: room.listingTitle,
    participants: room.participants,
    status: room.status,
    messages: filteredMessages,
    negotiation: roomNeg,
    serverTime: Date.now(),
    lastEventId,
  };

  res.write(`retry: 2500\n`);
  res.write(`id: init-${Date.now()}\n`);
  res.write(`event: init\n`);
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  // Replay missed persistent events from SQLite room_events
  if (lastEventId) {
    const missedEvents = getRoomEventsSinceInDb(roomId, lastEventId);
    for (const ev of missedEvents) {
      res.write(`id: ${ev.id}\n`);
      res.write(`event: ${ev.eventType}\n`);
      res.write(`data: ${JSON.stringify(ev.payload)}\n\n`);
    }
  }

  // Subscribe to live room event bus
  const unsubscribe = roomEventBus.subscribe(roomId, (event) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  });

  // Heartbeat ping every 15s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

roomsRouter.post('/api/rooms/:id/messages', requireAuth, rateLimit('messages', 'RATE_LIMIT_MESSAGES_PER_MINUTE', 120), (req, res) => {
  try {
    const roomId = String(req.params.id);
    const room = getRoomByIdFromDb(roomId);
    if (!room) {
      res.status(404).json({ error: 'room_not_found', message: 'Room not found' });
      return;
    }
    const principalId = req.principal!.principalId;
    if (room.visibility === 'public') {
      if (!isRoomParticipant(room, principalId)) {
        addParticipantToRoomInDb(roomId, principalId);
      }
    } else {
      if (!isRoomParticipant(room, principalId)) {
        res.status(403).json({ error: 'forbidden', message: 'Вы не участник этой комнаты' });
        return;
      }
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(422).json({ error: 'invalid_message', message: 'text is required' });
      return;
    }

    const message = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      roomId,
      sender: principalId,
      role: req.body?.role === 'agent' ? 'agent' : 'human',
      text,
      timestamp: Date.now(),
    };

    try {
      addMessageToRoomInDb(message);
    } catch (err) {
      const reason = classifyMessageInsertError(err);
      if (reason === 'room_not_found') {
        res.status(404).json({ error: 'room_not_found', message: 'Room not found' });
        return;
      }
      if (reason === 'duplicate_message_id') {
        res.status(409).json({ error: 'duplicate_message_id' });
        return;
      }
      throw err;
    }

    roomEventBus.broadcast(roomId, 'message', message);
    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
