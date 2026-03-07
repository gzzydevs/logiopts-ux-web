/**
 * Server-Sent Events (SSE) endpoint.
 *
 * GET /api/events — opens a persistent connection for real-time push.
 * Events: profile-switched, config-applied, watcher-status
 */

import { Router } from 'express';
import { storeEvents } from '../state/memory-store';
import type { StoreEvent } from '../state/memory-store';

const router = Router();

router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: StoreEvent) => {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    };

    const handler = (event: StoreEvent) => send(event);
    storeEvents.on('change', handler);

    req.on('close', () => {
        storeEvents.off('change', handler);
    });
});

export default router;
