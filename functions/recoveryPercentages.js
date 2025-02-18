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
			'Abdominals': 24,
			'Adductors': 96,
			'Abductors': 96,
			'Biceps': 48,
			'Calves': 96,
			'Chest': 72,
			'Forearms': 48,
			'Glutes': 96,
			'Hamstrings': 96,
			'Lats': 72,
			'Lower Back': 72,
			'Middle Back': 72,
			'Traps': 72,
			'Neck': 48,
			'Quadriceps': 96,
			'Shoulders': 48,
			'Triceps': 48
		};

		const user = await User.findOne({ email })
			.populate({
				path: 'workouts',
				populate: {
					path: 'supersets.exercises.exercise',
					model: 'Exercise'
				}
			});

		// raw exercise categories
		const bodyPartTracker = {};

		for (const workout of user.workouts.sort((a, b) => b.createdAt - a.createdAt)) {
			for (const superset of workout.supersets) {
				for (const exerciseInst of superset.exercises) {
					const rawBodyPart = exerciseInst.exercise.bodyPart;
					if (!bodyPartTracker[rawBodyPart] || workout.createdAt > bodyPartTracker[rawBodyPart]) {
						bodyPartTracker[rawBodyPart] = workout.createdAt;
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
		
		const timestamps = user.workouts.map(w => (new Date(w.createdAt)).getTime());
		const maxTime = new Date(Math.max(...timestamps))
		recoveryReport.lastUpdated = maxTime.toISOString()

		return recoveryReport;
	}
	catch (err) {
		console.error(err);
		return {};
	}
}