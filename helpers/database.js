import mongoose from 'mongoose';
import logger from '../helpers/logger.js';

export const initializeDb = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/userDatabase';
    try {
        await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
};
