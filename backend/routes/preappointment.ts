import { Router, Request, Response } from 'express';

const router = Router();

// POST /vregister: returns mock sessionId, jwt, and apiKey
router.post('/vregister', (req: Request, res: Response) => {
  const sessionId = 'mock-preappt-session-' + Math.random().toString(36).substring(2, 10);
  const token = 'mock-token-' + Math.random().toString(36).substring(2, 10);
  const token2 = 'mock-token2-' + Math.random().toString(36).substring(2, 10);
  const created = Date.now();
  const id = sessionId;
  const lang = 'en-US';
  const streams = [];
  const apiKey = 'mock-api-key';
  res.json({
    message: 'vregister success',
    session: {
      sessionId,
      token,
      token2,
      created,
      id,
      lang,
      streams,
      apiKey,
    },
  });
});

// POST /vstart: expects sessionId, streamId, language, promptId, filter, voice
router.post('/vstart', (req: Request, res: Response) => {
  const { sessionId, streamId, language, promptId, filter, voice } = req.body;
  // Log the received payload for debugging
  console.log('[MOCK] /vstart received:', {
    sessionId,
    streamId,
    language,
    promptId,
    filter,
    voice,
  });
  res.json({
    uuid: 'mock-uuid-' + Math.random().toString(36).substring(2, 10),
    id: 'mock-id-' + Math.random().toString(36).substring(2, 10),
    connectionId: 'mock-connection-' + Math.random().toString(36).substring(2, 10),
  });
});

// POST /vstop: expects sessionId, returns empty response (204)
router.post('/vstop', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  console.log('[MOCK] /vstop received:', { sessionId });
  res.status(204).send();
});

export default router;
