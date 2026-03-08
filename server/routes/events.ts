/**
 * Server-Sent Events (SSE) endpoint.
 *
 * GET /api/events — opens a persistent connection for real-time push.
 * Events: profile-switched, config-applied, watcher-status
 */

import { Router } from 'express';
import { storeEvents } from '../state/memory-store';
import type { StoreEvent } from '../state/memory-store';
import { xinputMissing } from '../services/keyListener';

const router = Router();

router.get('/events', (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const send = (event: StoreEvent) => {
            try {
                res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
            } catch {
                // Connection may have been closed
            }
        };

        const handler = (event: StoreEvent) => send(event);
        storeEvents.on('change', handler);

        // Replay missed startup events to this new client
        if (xinputMissing) {
            send({
                type: 'xinput-missing',
                payload: { installHint: 'sudo rpm-ostree install xorg-x11-server-utils && systemctl reboot' },
            });
        }

        req.on('close', () => {
            storeEvents.off('change', handler);
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: msg });
        }
    }
});

export default router;
