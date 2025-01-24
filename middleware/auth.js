import jwt from 'jsonwebtoken';
import logger from '../helpers/logger.js';

const SECRET_KEY = process.env.SECRET_KEY || 'myverysecretkey1';

// middleware to verify jwt
export function verifyToken(req, res, next) {
    logger.info(`token validated on route ${req.path}`);

    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
        
        return decoded;
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        } else {
            return res.status(401).json({ message: 'Invalid token' });
        }
    }
}
