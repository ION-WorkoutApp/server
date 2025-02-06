import jwt from 'jsonwebtoken';
import logger from '../helpers/logger.js';
import { User } from '../models/userSchema.js';

const SECRET_KEY = process.env.SECRET_KEY || 'myverysecretkey1';

export const checkAdmin = async (req, res, next) => {
	try {
		const user = verifyToken(req, res, next, true);
		if (!user) return;

		const isNotAdmin = (!user.email || !(await User.findOne({ email: user.email, isAdmin: true })));

		if (isNotAdmin) return res.status(403).json({ error: "Forbidden" });
		else next();
	}
	catch (err) {
		console.error(err);
	}
};


// middleware to verify jwt
export function verifyToken(req, res, next, isReturnCall = false) {
	logger.debug(`token validating on route ${req.path}`);

	const token = req.headers['authorization'];
	if (!token) {
		res.status(401).json({ message: 'Access denied. No token provided.' });
		return false;
	}

	try {
		const decoded = jwt.verify(token, SECRET_KEY);
		req.user = decoded;

		if (isReturnCall) return decoded;
		next();

		return decoded;
	} catch (err) {
		if (err.name === 'TokenExpiredError') {
			res.status(401).json({ message: 'Token expired' });
			return false
		} else {
			res.status(401).json({ message: 'Invalid token' });
			return false
		}
	}
}
