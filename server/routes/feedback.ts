import { Router } from 'express';
import { saveFeedbackInDb, getFeedbackFromDb, getFeedbackByIdFromDb, addAuditLog } from '../db';
import { requireAuth } from '../auth';
import { rateLimit } from '../http-guard';

export const feedbackRouter = Router();

feedbackRouter.post('/api/feedback', requireAuth, rateLimit('feedback', 'RATE_LIMIT_FEEDBACK_PER_MINUTE', 20), (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { message, category, contact, metadata } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'invalid_message', message: 'Поле message обязательно и должно быть непустой строкой' });
      return;
    }

    const ticketId = 'fb-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const validCategories = ['feedback', 'feature_request', 'bug_report', 'support', 'other'];
    const cat = typeof category === 'string' && validCategories.includes(category.trim())
      ? category.trim()
      : 'feedback';

    const ticket = saveFeedbackInDb({
      id: ticketId,
      authorId: principalId,
      category: cat,
      message: message.trim(),
      contact: typeof contact === 'string' ? contact.trim() : undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });

    addAuditLog('feedback.submit', principalId, ticket.id, {
      category: ticket.category,
      hasContact: Boolean(ticket.contact),
    });

    res.status(201).json({
      success: true,
      ticket,
      message: 'Ваше обращение успешно передано команде платформы и разработчикам. Спасибо!',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

feedbackRouter.get('/api/feedback', requireAuth, (req, res) => {
  try {
    const principalId = req.principal!.principalId;
    const { status, limit } = req.query as any;

    const tickets = getFeedbackFromDb({
      authorId: principalId,
      status: typeof status === 'string' ? status : undefined,
      limit: Number(limit) || 50,
    });

    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
