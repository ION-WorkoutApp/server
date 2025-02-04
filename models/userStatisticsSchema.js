import mongoose from 'mongoose';

// Sub-schema for user-level performance metrics
const performanceStatsSchema = new mongoose.Schema({
	totalWorkouts: { type: Number, default: 0 },
	averageWorkoutDuration: { type: Number, default: 0 }, // in minutes
	totalTimeSpent: { type: Number, default: 0 }, // in minutes
	totalCaloriesBurned: { type: Number, default: 0 },
	completionRate: { type: Number, default: 0 }, // value between 0 and 1
	averageSets: { type: Number, default: 0 },
	averageRestTime: { type: Number, default: 0 }, // in seconds
	// New Fields:
	bestWorkoutDuration: { type: Number, default: 0 }, // personal best duration in minutes
	bestCaloriesBurned: { type: Number, default: 0 },
	workoutStreak: { type: Number, default: 0 } // consecutive days or sessions completed
}, { _id: false });


const exerciseUsageStatsSchema = new mongoose.Schema({
	popularExerciseTypes: { type: Map, of: Number, default: {} },
	difficultyDistribution: { type: Map, of: Number, default: {} },
	averageRating: { type: Number, default: 0 },
	exerciseCompletionRate: { type: Number, default: 0 },
	mostPerformedExercise: { type: String, default: '' }, // exerciseId or name
	userFeedbackNotes: { type: Map, of: String, default: {} } // e.g., { exerciseId: "Too challenging on last set" }
}, { _id: false });

// Sub-schema for workout analytics
const workoutAnalyticsSchema = new mongoose.Schema({
	averageSupersetsPerWorkout: { type: Number, default: 0 },
	averageExercisesPerSuperset: { type: Number, default: 0 },
	supersetCompletionRate: { type: Number, default: 0 },
	timeDistribution: {
		activeExerciseTime: { type: Number, default: 0 },
		restTime: { type: Number, default: 0 }
	},
	progressOverTime: [{
		date: { type: Date },
		workoutsCompleted: { type: Number, default: 0 },
		totalCalories: { type: Number, default: 0 }
	}],
	intensityTrend: [{
		date: { type: Date },
		activeVsRestRatio: { type: Number, default: 0 } // e.g., a higher ratio means more intense workouts
	}],
	goalAchievementRate: { type: Number, default: 0 } // percentage of workouts where set goals were met/exceeded
}, { _id: false });


// Sub-schema for comparing declared preferences against actual behavior
const preferenceBehaviorStatsSchema = new mongoose.Schema({
	preferredWorkoutDurationMatch: { type: Number, default: 0 },
	workoutFrequencyMatch: { type: Number, default: 0 },
	preferenceGapHistory: [{
		date: { type: Date },
		durationGap: { type: Number, default: 0 }, // difference in minutes
		frequencyGap: { type: Number, default: 0 } // difference in number of sessions
	}],
	recommendationsProvided: { type: Number, default: 0 } // count of recommendations based on this gap
}, { _id: false });


// Main UserStatistics schema wrapping all the sub-schemas
const userStatisticsSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	performance: { type: performanceStatsSchema, default: () => ({}) },
	exerciseUsage: { type: exerciseUsageStatsSchema, default: () => ({}) },
	workoutAnalytics: { type: workoutAnalyticsSchema, default: () => ({}) },
	preferenceBehavior: { type: preferenceBehaviorStatsSchema, default: () => ({}) }
}, { timestamps: true });


export default mongoose.model('UserStatistics', userStatisticsSchema);
