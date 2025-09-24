import { Router, Request, Response } from 'express';

const router = Router();

// POST /vregister: returns mock sessionId, jwt, and apiKey
router.post('/vregister', (req: Request, res: Response) => {
  const sessionId = 'mock-preappt-session-' + Math.random().toString(36).substring(2, 10);
  const jwt = 'mock-jwt-' + Math.random().toString(36).substring(2, 10);
  res.json({
    message: 'vregister success',
    sessionId,
    jwt,
    apiKey: 'mock-api-key',
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
