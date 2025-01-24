import express from 'express';
import logger from '../helpers/logger.js';

const router = express.Router();

// generic routes
router.get('/', async (_, res) => res.redirect('https://workout.ion606.com'));

// a legacy ping check - if you prefer to keep a true /ping route, you could do so here
router.get('*', (req, res) => {
    if (req.path === '/ping') return res.sendStatus(200);

    logger.debug(`GET request made at ${req.path}`);
    res.sendStatus(404);
});

router.post('*', (req, res) => {
    logger.debug(`POST request made at ${req.path}`);
    res.sendStatus(404);
});

export default router;
