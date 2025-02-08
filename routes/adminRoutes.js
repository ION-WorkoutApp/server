import express from 'express';
import mongoose from 'mongoose';
import { checkAdmin } from '../middleware/auth.js';
import { User } from '../models/userSchema.js';
import { Workout } from '../models/exerciseSchema.js';
import { AdminActivity } from '../models/auditSchema.js';
import ExportSchema from '../models/exportSchema.js';
import {
	createDefaultPreferencesIfNotPresent,
	getAllEnabledPreferences,
	changePreferences,
	checkPreference
} from '../functions/preferences.js';

const adminRouter = express.Router();
adminRouter.use((req, res, next) => {
	if (req.path === '/settings' && req.method.toLowerCase() === 'get') next()
	else checkAdmin(req, res, next);
});


// Preferences Routes
adminRouter.get('/settings', (req, res) => {
	try {
		const prefs = createDefaultPreferencesIfNotPresent();
		res.json(prefs);
	} catch (err) {
		res.status(500).json({ error: 'Server error' });
	}
});


adminRouter.get('/settings/enabled', (req, res) => {
	try {
		const enabled = getAllEnabledPreferences();
		res.json(enabled);
	} catch (err) {
		res.status(500).json({ error: 'Server error' });
	}
});


adminRouter.put('/settings', (req, res) => {
	try {
		const updated = changePreferences(req.body);
		res.json(updated);
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});


adminRouter.get('/settings/:key', (req, res) => {
	try {
		const value = checkPreference(req.params.key);
		res.json({ [req.params.key]: value });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});


// User Management Routes
adminRouter.get('/users', async (req, res) => {
	try {
		const { limit = 20, after } = req.query;
		const query = after ? { _id: { $gt: after } } : {};
		const users = await User.find(query)
			.select('-password -refreshToken -__v')
			.limit(parseInt(limit))
			.lean();
		res.json({
			data: users.map(u => ({
				...u,
				email: u.email.replace(/(.{2}).+@(.+)/, '$1***@$2')
			})),
			nextCursor: users.length ? users[users.length - 1]._id : null
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

adminRouter.get('/users/:id', async (req, res) => {
	try {
		const user = await User.findById(req.params.id)
			.select('-password -refreshToken -__v')
			.populate('workouts', 'workoutTime calories')
			.lean();
		if (!user) return res.status(404).json({ error: 'User not found' });
		user.email = user.email.replace(/(.{2}).+@(.+)/, '$1***@$2');
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

adminRouter.delete('/users/:id', async (req, res) => {
	try {
		await User.findByIdAndUpdate(req.params.id, {
			$set: {
				deletedAt: new Date(),
				email: `deleted_${Date.now()}@${req.params.id}.inactive`,
				refreshToken: null
			}
		});

		await AdminActivity.create({
			admin: req.user._id,
			action: 'USER_SOFT_DELETED',
			targetUser: req.params.id
		});

		res.sendStatus(204);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});


// Workout Management Routes
const workoutQueryProjection = {
	'supersets.exercises.inset': 0,
	'supersets.exercises.weight': 0,
	'supersets.exercises.calories': 0
};


adminRouter.get('/workouts', async (req, res) => {
	try {
		const workouts = await Workout.find()
			.select(workoutQueryProjection)
			.populate('user', 'name email')
			.lean();
		res.json(workouts);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});


adminRouter.get('/workouts/user/:userId', async (req, res) => {
	try {
		const workouts = await Workout.find({ user: req.params.userId })
			.select(workoutQueryProjection)
			.lean();

		res.json(workouts);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});


// Export Request Routes
adminRouter.get('/exports', async (req, res) => {
	try {
		const exports = await ExportSchema.find()
			.select('-password -fileUrl')
			.populate('user', 'name email')
			.lean();

		res.json(exports);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});


// Security Routes
adminRouter.get('/audit-logs', async (req, res) => {
	try {
		const { email } = req.user;
		if (!email) return res.status(404).json({ error: 'user not found' });

		const user = await User.findOne({ email });
		if (!user) return res.status(403).json({ error: 'Forbidden' });

		const logs = await AdminActivity.find()
			.populate('admin targetUser', 'name email')
			.sort('-timestamp')
			.lean();

		res.json(logs);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});


// System Routes
adminRouter.get('/health', async (req, res) => {
	try {
		const dbStatus = mongoose.connection.readyState === 1 ? 'OK' : 'DOWN';
		res.json({
			status: 'OK',
			database: dbStatus,
			uptime: process.uptime()
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

export default adminRouter;