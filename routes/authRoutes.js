import express from 'express';
import jwt from 'jsonwebtoken';
import { validateEmail } from '../validators/email.js';
import { User } from '../models/userSchema.js';
import { authLimiter } from '../helpers/rateLimit.js';
import logger from '../helpers/logger.js'

const router = express.Router();
router.use(authLimiter);
const SECRET_KEY = process.env.SECRET_KEY || 'myverysecretkey1';


// route to initialize account
router.post('/initaccount', async (req, res) => {
    try {
        const { email } = req.body;

        // validate email
        if (!(await validateEmail(email))) return res.status(403).json({ error: `unallowed email used (${email})` });

        // check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(409).json({ error: `email "${email}" already in use` }); // conflict

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
