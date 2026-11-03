import { Router } from 'express';
import { getProfilesFromDb, getProfileByIdFromDb } from '../db';

export const profilesRouter = Router();

profilesRouter.get('/api/profiles', (_req, res) => {
  try {
    const profiles = getProfilesFromDb();
    res.json(profiles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

profilesRouter.get('/api/profiles/:id', (req, res) => {
  try {
    const profile = getProfileByIdFromDb(req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Профиль не найден' });
      return;
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
