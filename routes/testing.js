import express from 'express';
import { User } from '../models/userSchema.js';
import checkUsage from '../tests/measureUsage.js';


const router = express.Router();
router.use(async (_, res, next) => {
    if (process.env.DEBUGGING) next();
    else res.status(401).send("The application is not currently in Testing Mode, set process.env.DEBUGGING to true to enable it");
});

router.get('/getallusers', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        res.status(500).json({
            message: 'Failed to retrieve users',
            error: err.message
        });
    }
});

router.get('/sysusage', async (req, res) => {
    try {
        const usage = await checkUsage();
        res.status(200).send(usage);
    } catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});

export default router;
