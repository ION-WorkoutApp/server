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


// model
export const User = mongoose.model('User', userSchema);
