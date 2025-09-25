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

// POST /vstart: expects publisherId, returns mock audioConnectorId
router.post('/vstart', (req: Request, res: Response) => {
  const { publisherId } = req.body;
  res.json({
    message: 'vstart success',
    publisherId,
    audioConnectorId: 'mock-audio-connector-' + Math.random().toString(36).substring(2, 10),
  });
});

// POST /vstop: returns stopped confirmation
router.post('/vstop', (req: Request, res: Response) => {
  res.json({
    message: 'vstop success',
    stopped: true,
  });
});

export default router;
