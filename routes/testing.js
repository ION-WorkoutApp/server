import express from 'express';
import { User } from '../models/userSchema.js';
import checkUsage from '../tests/measureUsage.js';
import { checkAdmin } from '../middleware/auth.js';


const router = express.Router();
router.use(checkAdmin);

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
