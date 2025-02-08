import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { validateEmail } from '../validators/email.js';
import { User } from '../models/userSchema.js';
import { authLimiter } from '../helpers/rateLimit.js';
import logger from '../helpers/logger.js'
import sendEmail from '../helpers/mail.js';
import validateConfCode from '../helpers/validateConfCode.js';
import UsedEmails from '../models/UsedEmails.js';
import { checkPreference, getPreference } from '../functions/preferences.js'


const router = express.Router();
router.use(authLimiter);
const SECRET_KEY = process.env.SECRET_KEY || 'myverysecretkey1';

// redis[s]://[[username][:password]@][host][:port][/db-number]
const redisClient = createClient({
	url: `redis://${process.env.REDIS_HOST || 'redis'}:${Number(process.env.REDIS_PORT) || 6379}`
});

redisClient.on('error', (err) => console.error('redis error:', err));
await redisClient.connect();


const checkSignupsAllowedMiddleware = (_, res, next) => {
	if (checkPreference("ALLOW_SIGNUPS")) next();
	else res.status(401).json({ error: 'signups are disabled on this server' });
}


// abstraction to check lists
// NOTE: if you ever implement free trials, comment the blacklist back in to prevent spoofing
const validateUser = async (email) => {
	if (await User.findOne({ email })) return false
	// else if (await UsedEmails.findOne({ email })) return false;
	else return true;
}


// region codes

router.post('/gencode', checkSignupsAllowedMiddleware, async (req, res) => {
	try {
		if (!checkPreference("REQUIRE_EMAIL_VERIFICATION")) return res.sendStatus(200);

		const { email } = req.body;
		if (!email) {
			return res.status(400).json({ error: 'email is required' });
		}
		else if (!(await validateEmail(email))) return res.status(403).json({ error: `unallowed email used (${email})` });
		else if (!(await validateUser(email))) return res.status(409).json({ error: `email "${email}" already in use` });

		// random 6-digit confirmation code
		const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

		//10-minute expiry (600 seconds)
		await redisClient.set(`confirmation:${email}`, confirmationCode, { EX: 600 });
		await redisClient.del(`attempts:${email}`);

		await sendEmail(email, `Your ION Workout App Code`, `Your ION Workout App Code is ${confirmationCode}\n\nIf you did not request this code, it is safe to ignore this email`)

		logger.debug(`account creation confirmation email sent to ${email}`);

		res.sendStatus(200);
	}
	catch (err) {
		console.error(err);
		res.sendStatus(500);
	}
});

router.post('/testcode', async (req, res) => {
	try {
		if (!checkPreference("REQUIRE_EMAIL_VERIFICATION")) return res.sendStatus(200);

		const { email, code } = req.body;

		// validate email
		if (!email || !code) return res.status(400).send('code and email are required');
		if (!(await validateEmail(email))) return res.status(403).json({ error: `unallowed email used (${email})` });

		const r = await validateConfCode(res, redisClient, email, code, false);
		if (r) res.sendStatus(200);
	}
	catch (err) {
		console.error(err);
		res.sendStatus(500);
	}
});

// endregion


// route to initialize account
router.post('/initaccount', checkSignupsAllowedMiddleware, async (req, res) => {
	try {
		const { email, code } = req.body;

		// validate email
		if (!email || (!code && checkPreference("REQUIRE_EMAIL_VERIFICATION"))) return res.status(400).send('code and email are required');
		if (!(await validateEmail(email))) return res.status(403).json({ error: `unallowed email used (${email})` });

		const r = await validateConfCode(res, redisClient, email, code);
		if (!r) return;

		// check for existing user
		if (!(await validateUser(email))) return res.status(409).json({ error: `email "${email}" already in use` }); // conflict

		// create new user
		const user = new User(req.body);
		await user.save();

		res.status(200).json({
			message: 'Account initialized successfully',
			uid: user._id
		});
	} catch (err) {
		logger.error(err);

		res.status(500).json({
			message: 'Failed to initialize account',
			error: err.message
		});
	}
});


// route to check credentials and issue a token (this is the login route)
router.post('/checkcredentials', async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) return res.sendStatus(404);

		const user = await User.findOne({ email, password });
		if (!user) return res.status(401).json({ message: 'Invalid credentials' });

		const token = jwt.sign(
			{ id: user._id, email: user.email },
			SECRET_KEY,
			{ expiresIn: '1h' }
		);
		const refreshToken = jwt.sign(
			{ id: user._id },
			SECRET_KEY,
			{ expiresIn: '7d' }
		);

		// store the refresh token in the database (overwrite)
		user.refreshToken = refreshToken;
		await user.save();

		res.json({
			message: 'Credentials verified',
			token,
			refreshToken
		});
	} catch (err) {
		logger.error(err);

		res.status(500).json({
			message: 'Failed to check credentials',
			error: err.message
		});
	}
});


// route to refresh token
router.post('/refresh-token', async (req, res) => {
	const { refreshToken } = req.body;
	if (!refreshToken) {
		return res.status(400).json({ message: 'Refresh token is required' });
	}

	try {
		const decoded = jwt.verify(refreshToken, SECRET_KEY);

		// find the user and validate the refresh token
		const user = await User.findOne({ _id: decoded.id, refreshToken });
		if (!user) {
			return res.status(403).json({ message: 'Invalid refresh token' });
		}

		// issue a new access token
		const newToken = jwt.sign(
			{ id: user._id, email: user.email },
			SECRET_KEY,
			{ expiresIn: '1h' }
		);

		res.json({ token: newToken });
	} catch (err) {
		logger.error(err);

		res.status(403).json({
			message: 'Invalid or expired refresh token',
			error: err.message
		});
	}
});


// route to log out and revoke refresh token
export default router;
