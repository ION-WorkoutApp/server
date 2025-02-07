import { User } from '../models/userSchema.js';

// Helper function to calculate personalized recovery time
function getPersonalizedRecovery(user, baseTime) {
	// Age factor: Older users may need more recovery time?
	const ageFactor = user.age > 40 ? 1.2 : 1;

	// Activity level factor: Sedentary users may need more recovery time
	const activityFactor = {
		'sedentary': 1.3,
		'light': 1.1,
		'moderate': 1.0,
		'active': 0.9,
		'very active': 0.8
	}[user.generalPreferences.activityLevel];

	return baseTime * ageFactor * activityFactor;
}


export async function calculateRecovery(email) {
	try {
		const DEFAULT_RECOVERY = {
			'chest': 72, 'back': 72, 'legs': 96,
			'arms': 48, 'core': 24, 'shoulders': 48
		};

		const user = await User.findOne({ email })
			.populate({
				path: 'workouts',
				populate: {
					path: 'supersets.exercises.exercise',
					model: 'Exercise'
				}
			});

		const bodyPartTracker = {};

		// Get all body part last-used dates
		for (const workout of user.workouts.sort((a, b) => b.date - a.date)) {
			for (const superset of workout.supersets) {
				for (const exerciseInst of superset.exercises) {
					const bodyPart = exerciseInst.exercise.bodyPart;
					if (!bodyPartTracker[bodyPart] || workout.date > bodyPartTracker[bodyPart]) {
						bodyPartTracker[bodyPart] = workout.date;
					}
				}
			}
		}

		// Calculate recovery percentages
		const now = new Date();
		const recoveryReport = {};

		for (const [bodyPart, baseRecoveryHours] of Object.entries(DEFAULT_RECOVERY)) {
			const lastUsed = bodyPartTracker[bodyPart];
			const elapsed = lastUsed ? (now - new Date(lastUsed)) / 36e5 : Infinity;

			// Adjust recovery time based on user's age and activity level
			const personalizedRecoveryHours = getPersonalizedRecovery(user, baseRecoveryHours);

			// Calculate recovery percentage
			const recoveryPercentage = Math.min((elapsed / personalizedRecoveryHours) * 100, 100);

			recoveryReport[bodyPart] = {
				lastUsed: lastUsed?.toISOString() || 'Never',
				recoveryPercentage: recoveryPercentage,
				personalizedRecoveryHours: personalizedRecoveryHours
			};
		}

		return recoveryReport;
	}
	catch (err) {
		console.error(err);
		return null;
	}
}