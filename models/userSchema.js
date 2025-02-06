import mongoose from 'mongoose';


// Sub-schemas for optional preferences
const workoutPreferencesSchema = new mongoose.Schema({
	preferredWorkoutDuration: { type: Number, min: 5, max: 180, default: 30 }, // default to 30 minutes
	exerciseDifficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
	warmupAndCooldownPreference: { type: Boolean, default: true },
	preferredWorkoutMusic: { type: String, default: 'No preference' }
});


const progressTrackingSchema = new mongoose.Schema({
	stepGoal: { type: Number, default: 10000 },
	waterIntakeGoal: { type: Number, default: 2000 }, // in ml
	sleepTracking: { type: Boolean, default: false }
});


const notificationsSchema = new mongoose.Schema({
	remindersEnabled: { type: Boolean, default: true },
	notificationFrequency: { type: String, enum: ['daily', 'weekly', 'none'], default: 'daily' },
	preferredReminderTime: { type: String, default: '08:00 AM' }
});

const socialPreferencesSchema = new mongoose.Schema({
	socialSharing: { type: Boolean, default: false },
	leaderboardParticipation: { type: Boolean, default: false },
	badgesAndAchievements: { type: [String], default: [] }
});


const generalPreferencesSchema = new mongoose.Schema({
	activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very active'], default: 'moderate' },
	preferredWorkoutTime: { type: String, enum: ['morning', 'afternoon', 'evening', 'no preference'], default: 'no preference' },
	workoutFrequency: { type: Number, min: 1, max: 7, default: 3 },
	injuriesOrLimitations: { type: [String], default: [] },
	equipmentAccess: { type: [String], default: [] },
	preferredWorkoutEnvironment: { type: String, enum: ['gym', 'home', 'outdoor', 'no preference'], default: 'no preference' }
});


export const userSchema = new mongoose.Schema({
	// Essential Fields
	isAdmin: { type: Boolean, default: false },
	email: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	password: { type: String, required: true },
	age: { type: Number, required: true },
	gender: { type: String, required: true },
	height: { type: Number, required: true }, // in centimeters
	weight: { type: Number, required: true },
	weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'lbs', required: true },
	distanceUnit: { type: String, enum: ['km', 'miles'], default: 'km', required: true },
	fitnessGoal: { type: String, required: true },
	preferredWorkoutType: { type: String, required: true },
	comfortLevel: { type: String, required: true },

	// Optional Preferences (with defaults)
	generalPreferences: { type: generalPreferencesSchema, required: true },
	workoutPreferences: { type: workoutPreferencesSchema, required: false },
	progressTracking: { type: progressTrackingSchema, required: false },
	notifications: { type: notificationsSchema, required: false },
	socialPreferences: { type: socialPreferencesSchema, required: false },

	// Other Fields
	refreshToken: { type: String, required: false },
	lastRequestedData: { type: Date, default: null, required: false },
	workouts: { type: [mongoose.Schema.Types.ObjectId], ref: 'Workout', default: [] },
	savedWorkouts: { type: [mongoose.Schema.Types.ObjectId], ref: 'Workout', default: [] },
});


export const createBlankUser = async (email, password, isAdmin) => {
	try {
		const newUser = new User({
			email,
			password: password,
			isAdmin,
			name: 'ADMIN',
			age: 30,
			gender: 'prefer not to say',
			height: 170, // default height in cm
			weight: 70, // default weight
			weightUnit: 'kg',
			distanceUnit: 'km',
			fitnessGoal: 'general fitness',
			preferredWorkoutType: 'strength training',
			comfortLevel: 'moderate',

			// default preferences
			generalPreferences: {
				activityLevel: 'moderate',
				preferredWorkoutTime: 'no preference',
				workoutFrequency: 3,
				injuriesOrLimitations: [],
				equipmentAccess: [],
				preferredWorkoutEnvironment: 'no preference'
			}
		});

		await newUser.save();
		console.log('Admin user created successfully.');
		return newUser;
	} catch (error) {
		console.error('Error creating admin user:', error);
		throw error;
	}
};


// model
export const User = mongoose.model('User', userSchema);
