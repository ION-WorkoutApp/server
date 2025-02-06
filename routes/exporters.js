import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import exportQueue from '../exporters/queue.js';
import logger from '../helpers/logger.js';
import { User } from '../models/userSchema.js';
import ExportRequest from '../models/exportSchema.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use((req, res, next) => {
	if (req.path === '/download') next();
	else verifyToken(req, res, next);
});


const isWithinPastMonth = (date) => {
	if (process.env.DEBUGGING) return false;
	
	const now = new Date();
	const oneMonthAgo = new Date();
	oneMonthAgo.setMonth(now.getMonth() - 1);

	return date >= oneMonthAgo && date <= now;
};


/**
 * Route to initiate an export request
 */
router.post('/export', async (req, res) => {
	try {
		const { format } = req.body;
		const email = req.user.email;

		if (!['csv', 'json', 'ics'].includes(format)) {
			return res.status(400).json({ message: 'Invalid export format' });
		}

		const user = await User.findOne({ email }).lean(true);
		if (!email || !user) {
			return res.status(404).send({ message: 'User not found' });
		}

		// Check if user has requested data within the past month
		if (user.lastRequestedData && isWithinPastMonth(user.lastRequestedData)) {
			return res.status(429).json({ error: `You have already requested your data within the past month on ${user.lastRequestedData}. Please try again later` });
		}

		// Create a new ExportRequest document with status 'pending'
		const exportRequest = new ExportRequest({
			user: user._id,
			format,
			password: crypto.randomBytes(16).toString('hex'),
			status: 'pending',
			requestedAt: new Date()
		});


		await exportRequest.save();
		await exportQueue.add({ exportRequestId: exportRequest._id }, { attempts: 3, backoff: 5000 });

		logger.info(`Export request added to queue for ${email} in ${format} format with ExportRequest ID ${exportRequest._id}.`);

		// Update user's lastRequestedData
		await User.findOneAndUpdate({ email }, { $set: { lastRequestedData: new Date() } });

		res.status(202).json({ message: `Your data export request has been received and is being processed. You will receive an email once it is ready. Please make sure you mark ${process.env.EMAIL_USER} as not spam!` });
	}
	catch (err) {
		logger.error(err);
		res.sendStatus(500);
	}
});


/**
 * Route to check if a user can request export
 */
router.get('/canrequest', async (req, res) => {
	try {
		const user = await User.findOne({ email: req.user.email }).lean(true);

		if (!req.user.email || !user) {
			return res.status(404).send({ message: 'User not found' });
		}
		else if (user.lastRequestedData && isWithinPastMonth(user.lastRequestedData)) {
			return res.sendStatus(429);
		}
		else {
			return res.sendStatus(200);
		}
	}
	catch (err) {
		logger.error(err);
		res.sendStatus(500);
	}
});


/**
 * Route to download the exported file
 */
router.get('/download', async (req, res) => {
	try {
		const { totp, email } = req.query;

		if (!totp) return res.status(400).send('Missing required query parameter "totp"');
		if (!email) return res.status(400).send('Missing required query parameter "email"');

		const user = await User.findOne({ email });
		if (!user) return res.status(404).send('User not found');

		// Find the ExportRequest with matching user and password
		const exportRequest = await ExportRequest.findOne({ user: user._id, password: totp });

		if (!exportRequest) return res.status(403).send('Invalid password or export request not found');
		else if (exportRequest.status !== 'completed') {
			return res.status(401).send(`Your export request is currently "${exportRequest.status}". Please wait until it is completed.`);
		}

		// Absolute file path
		const filePath = path.resolve(exportRequest.fileUrl);

		try {
			await fs.access(filePath);
		} catch (err) {
			return res.status(404).send('File not found');
		}

		res.download(filePath, path.basename(filePath), async (err) => {
			if (err) {
				logger.error(`Error sending file: ${err.message}`);
				res.status(500).send('Error downloading the file');
			}
			else {
				// Delete the file after successful download
				await fs.rm(filePath).catch(logger.error);

				// Delete the ExportRequest document
				await ExportRequest.deleteOne({ _id: exportRequest._id }).catch(logger.error);
			}
		});
	} catch (error) {
		logger.error(`Error in /download: ${error.message}`);
		res.status(500).send('Internal server error');
	}
});


router.get('/status', async (req, res) => {
	const user = await User.findOne({ email: req.user.email });
	if (!user) return res.status(404).send('User not found');

	// Find the ExportRequest with matching user and password
	const exportRequest = await ExportRequest.findOne({ user: user._id });
	if (!exportRequest) return res.status(404).send('No Request Made');

	switch (exportRequest.status) {
		case 'completed': res.status(200).send('Request Completed');
			break;
		case 'failed': res.status(500).send(exportRequest.error);
			break;
		default: res.status(425).send("Request Pending"); // too early
	}
});


export default router;
