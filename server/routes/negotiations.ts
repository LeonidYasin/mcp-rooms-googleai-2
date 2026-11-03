import { Router } from 'express';
import {
  getNegotiationsFromDb,
  getNegotiationByIdFromDb,
  saveNegotiationInDb,
  getRoomsFromDb,
  getRoomByIdFromDb,
  addMessageToRoomInDb,
  addAuditLog,
} from '../db';
import { requireAuth, isRoomParticipant } from '../auth';
import { rateLimit } from '../http-guard';
import { runAutonomousNegotiation } from '../negotiator';
import { roomEventBus } from '../events';

export const negotiationsRouter = Router();

negotiationsRouter.get('/api/negotiations', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const visibleRoomIds = new Set(
      getRoomsFromDb()
        .filter((room: any) => isRoomParticipant(room, principalId))
        .map((room: any) => room.id)
    );
    const negs = getNegotiationsFromDb().filter((n: any) => visibleRoomIds.has(n.roomId));
    res.json(negs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

negotiationsRouter.get('/api/negotiations/:id', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const negotiation = getNegotiationByIdFromDb(String(req.params.id));
    if (!negotiation) {
      res.status(404).json({ error: 'negotiation_not_found', message: 'Negotiation not found' });
      return;
    }
    const room = getRoomByIdFromDb(negotiation.roomId);
    if (!room || !isRoomParticipant(room, principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник переговоров' });
      return;
    }
    res.json(negotiation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

negotiationsRouter.post('/api/negotiations/:id/accept', requireAuth, rateLimit('negotiate_accept', 'RATE_LIMIT_NEGOTIATE_PER_MINUTE', 30), (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const negotiation = getNegotiationByIdFromDb(String(req.params.id));
    if (!negotiation) {
      res.status(404).json({ error: 'negotiation_not_found', message: 'Negotiation not found' });
      return;
    }
    const room = getRoomByIdFromDb(negotiation.roomId);
    if (!room || !isRoomParticipant(room, principalId)) {
      res.status(403).json({ error: 'forbidden', message: 'Вы не участник переговоров' });
      return;
    }
    if (negotiation.status === 'agreed') {
      res.json({ message: 'Negotiation already agreed', negotiation });
      return;
    }
    const now = Date.now();
    const agreedTerms = {
      ...(negotiation.agreedTerms || {}),
      ...(req.body?.agreedTerms || {}),
      mutual_consent: true,
      agreed_at: now,
    };
    const rounds = [
      ...negotiation.rounds,
      {
        round: negotiation.rounds.length + 1,
        sender: principalId,
        role: req.body?.role === 'agent' ? 'agent' : 'human',
        action: 'accept',
        terms: agreedTerms,
        comment: req.body?.comment || 'Условия согласованы и приняты.',
        timestamp: now,
      },
    ];

    saveNegotiationInDb({
      id: negotiation.id,
      roomId: negotiation.roomId,
      listingId: negotiation.listingId,
      userGoal: negotiation.userGoal,
      initiatorAgent: negotiation.initiatorAgent,
      counterpartAgent: negotiation.counterpartAgent,
      status: 'agreed',
      rounds,
      agreedTerms,
    });

    addMessageToRoomInDb({
      id: `msg-sys-${now}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: negotiation.roomId,
      sender: principalId,
      role: 'human',
      text: `🤝 Участник ${principalId} подтвердил согласие. Сделка успешно согласована.`,
      toolCall: { name: 'accept_terms', agreedTerms },
      timestamp: now,
    });

    roomEventBus.broadcast(negotiation.roomId, 'agreement', agreedTerms);

    addAuditLog('negotiation.manual_accept', principalId, negotiation.id, {
      roomId: negotiation.roomId,
      agreedTerms,
    });

    const updated = getNegotiationByIdFromDb(negotiation.id);
    res.json({ success: true, negotiation: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

negotiationsRouter.post('/api/agent/negotiate', requireAuth, rateLimit('negotiate', 'RATE_LIMIT_NEGOTIATE_PER_MINUTE', 30), async (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { prompt, targetListingId, mode, proposedTerms } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    const result = await runAutonomousNegotiation(prompt, targetListingId, {
      principalId,
      mode: mode === 'live' ? 'live' : 'preview',
      proposedTerms,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
