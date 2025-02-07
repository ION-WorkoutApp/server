import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import logger from './helpers/logger.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import exerciseRoutes from './routes/exerciseRoutes.js';
import workoutRoutes from './routes/workoutRoutes.js';
import userDataRoutes from './routes/exporters.js'
import testingRoutes from './routes/testing.js';
import genericRoutes from './routes/generic.js';
import docRoutes from './routes/docs.js'
import { checkFetchAndImport } from './functions/importCSV.js';
import { checkForExpiredDocuments } from './exporters/uploader.js';
import limiter from './helpers/rateLimit.js';
import adminRouter from './routes/adminRoutes.js';


// load secret key
if (!process.env.SECRET_KEY) throw "PLEASE MAKE SURE THE SECRET KEY IS IN THE ENV FILE";
(await import('./functions/preferences.js')).loadSettingsIntoENV()

const app = express();
const PORT = process.env.PORT || 1221;

// middlewares
app.use(express.raw());
app.use(express.json());
app.use(limiter);

// odd fix
if (process.env.DEBUGGING) app.use(cors({ origin: '*' }));
else app.use(cors());

// connect to mongodb
async function initializeDb() {
	const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/userDatabase';
	try {
		await mongoose.connect(mongoUri);
		logger.info('Connected to MongoDB');

		checkForExpiredDocuments();
		logger.info('Started expired docs scanner');
	} catch (err) {
		logger.error('Failed to connect to MongoDB:', err);
		process.exit(1);
	}
}
initializeDb().then(checkFetchAndImport);

// head route for ping/health
app.head('/', async (_, res) => {
	try {
		res.sendStatus(200);
	} catch (err) {
		logger.error(err);
	}
});

app.head('/isindebugmode', (_, res) => res.send(process.env.DEBUGGING ? true : false));


// mount routes
app.use('/auth', authRoutes);
app.use('/admin', adminRouter);
app.use('/users', userRoutes);
app.use('/exercises', exerciseRoutes);
app.use('/udata', userDataRoutes);
app.use('/workouts', workoutRoutes);
app.use('/test', testingRoutes); // This has a debug check in the router
app.use('/docs', docRoutes)
app.use('/', genericRoutes); // Generic routes on `/`


// start the server
app.listen(PORT, async () => {
	(await import('dns')).lookup((await import('os')).hostname(), { family: 4 }, (err, addr) => {
		if (!err) {
			logger.info(`Server is running on http://${addr}:${PORT}`);
		}
	});
});
