import UserStatistics from '../models/userStatisticsSchema.js';

/**
 * Update statistics when a user completes a workout.
 * @param {ObjectId} userId - The user’s id.
 * @param {Object} workoutData - Data about the completed workout.
 *   Expected properties:
 *     - duration (minutes)
 *     - caloriesBurned
 *     - sets (total sets performed in workout)
 *     - restTime (in seconds)
 *     - isConsecutive (boolean, if this workout continues a streak)
 *     - supersetsCount (number of supersets in the workout)
 *     - totalExercisesCount (total number of exercises in all supersets)
 *     - supersetCompletionRate (ratio for the workout)
 *     - activeExerciseTime (minutes of active exercise)
 *     - restTime (minutes of rest during workout; note: may be distinct from the sets’ restTime)
 *     - goalAchieved (boolean, whether workout goals were met)
 */
export async function updateWorkoutStats(userId, workoutData) {
	let stats = (await UserStatistics.findOne({ user: userId })) || (new UserStatistics({ user: userId }));

	// Update performance metrics
	const perf = stats.performance;
	const prevTotalWorkouts = perf.totalWorkouts;
	perf.totalWorkouts += 1;
	perf.totalTimeSpent += workoutData.duration;
	perf.totalCaloriesBurned += workoutData.caloriesBurned;
	perf.averageWorkoutDuration = perf.totalTimeSpent / perf.totalWorkouts;

	if (workoutData.duration > perf.bestWorkoutDuration) {
		perf.bestWorkoutDuration = workoutData.duration;
	}
	if (workoutData.caloriesBurned > perf.bestCaloriesBurned) {
		perf.bestCaloriesBurned = workoutData.caloriesBurned;
	}
	// Update workout streak
	perf.workoutStreak = workoutData.isConsecutive ? perf.workoutStreak + 1 : 1;

	// Update average sets and rest time if provided
	if (workoutData.sets !== undefined) {
		perf.averageSets = (((perf.averageSets || 0) * prevTotalWorkouts) + workoutData.sets) / perf.totalWorkouts;
	}
	if (workoutData.restTime !== undefined) {
		perf.averageRestTime = (((perf.averageRestTime || 0) * prevTotalWorkouts) + workoutData.restTime) / perf.totalWorkouts;
	}

	// Update workout analytics
	const analytics = stats.workoutAnalytics;
	if (workoutData.supersetsCount !== undefined) {
		analytics.averageSupersetsPerWorkout =
			((analytics.averageSupersetsPerWorkout * prevTotalWorkouts) + workoutData.supersetsCount) / perf.totalWorkouts;
	}
	if (workoutData.totalExercisesCount !== undefined) {
		analytics.averageExercisesPerSuperset =
			((analytics.averageExercisesPerSuperset * prevTotalWorkouts) + workoutData.totalExercisesCount) / perf.totalWorkouts;
	}
	if (workoutData.supersetCompletionRate !== undefined) {
		analytics.supersetCompletionRate =
			((analytics.supersetCompletionRate * prevTotalWorkouts) + workoutData.supersetCompletionRate) / perf.totalWorkouts;
	}
	// Update time distribution within the workout
	analytics.timeDistribution.activeExerciseTime += workoutData.activeExerciseTime || 0;
	analytics.timeDistribution.restTime += workoutData.restTime || 0;

	// Append to progress history
	analytics.progressOverTime.push({
		date: new Date(),
		workoutsCompleted: perf.totalWorkouts,
		totalCalories: perf.totalCaloriesBurned,
	});

	// Record an intensity trend (if both active and rest times are provided)
	if (workoutData.activeExerciseTime && workoutData.restTime) {
		analytics.intensityTrend.push({
			date: new Date(),
			activeVsRestRatio: workoutData.activeExerciseTime / workoutData.restTime,
		});
	}

	// Update goal achievement rate.
	// Using auxiliary counters stored on analytics (initialize if not set)
	if (analytics.goalTotal === undefined) {
		analytics.goalTotal = 0;
		analytics.goalAchievedCount = 0;
	}
	analytics.goalTotal += 1;
	if (workoutData.goalAchieved) {
		analytics.goalAchievedCount += 1;
	}
	analytics.goalAchievementRate = analytics.goalAchievedCount / analytics.goalTotal;

	await stats.save();
}

/**
 * Update exercise usage statistics when a user performs an exercise.
 * @param {ObjectId} userId - The user’s id.
 * @param {Object} exerciseData - Data about the performed exercise.
 *   Expected properties:
 *     - exerciseId (unique identifier of the exercise)
 *     - type (e.g., 'Strength', 'Cardio')
 *     - difficulty (e.g., 'beginner', 'intermediate', 'advanced')
 *     - rating (numeric rating given to the exercise)
 *     - isCompleted (boolean indicating if the exercise was completed)
 *     - feedbackNote (optional string for user feedback)
 */
export async function updateExerciseUsage(userId, exerciseData) {
	let stats = await UserStatistics.findOne({ user: userId });
	if (!stats) {
		stats = new UserStatistics({ user: userId });
	}

	const usage = stats.exerciseUsage;
	// Update popular exercise types count
	const currentTypeCount = usage.popularExerciseTypes.get(exerciseData.type) || 0;
	usage.popularExerciseTypes.set(exerciseData.type, currentTypeCount + 1);

	// Update difficulty distribution count
	const currentDiffCount = usage.difficultyDistribution.get(exerciseData.difficulty) || 0;
	usage.difficultyDistribution.set(exerciseData.difficulty, currentDiffCount + 1);

	// Update average rating using an auxiliary counter (ratingCount)
	if (usage.ratingCount === undefined) {
		usage.ratingCount = 0;
	}
	usage.ratingCount += 1;
	usage.averageRating =
		((usage.averageRating * (usage.ratingCount - 1)) + exerciseData.rating) / usage.ratingCount;

	// Update exercise completion rate using auxiliary counters
	if (usage.totalExercises === undefined) {
		usage.totalExercises = 0;
		usage.completedExercises = 0;
	}
	usage.totalExercises += 1;
	if (exerciseData.isCompleted) {
		usage.completedExercises += 1;
	}
	usage.exerciseCompletionRate = usage.completedExercises / usage.totalExercises;

	// Track counts per exercise ID for determining the most performed exercise.
	if (!usage.exerciseCounts) {
		usage.exerciseCounts = new Map();
	}
	const currentExCount = usage.exerciseCounts.get(exerciseData.exerciseId) || 0;
	usage.exerciseCounts.set(exerciseData.exerciseId, currentExCount + 1);

	// Determine the most performed exercise based on the counts.
	let maxCount = 0;
	let mostPerformed = usage.mostPerformedExercise;
	usage.exerciseCounts.forEach((count, exId) => {
		if (count > maxCount) {
			maxCount = count;
			mostPerformed = exId;
		}
	});
	usage.mostPerformedExercise = mostPerformed;

	// Update feedback notes if provided.
	if (exerciseData.feedbackNote) {
		usage.userFeedbackNotes.set(exerciseData.exerciseId, exerciseData.feedbackNote);
	}

	await stats.save();
}

/**
 * Update preference behavior statistics based on a comparison between
 * declared workout preferences and actual performance.
 * @param {ObjectId} userId - The user’s id.
 * @param {Object} preferenceData - Data about the gap between user preference and performance.
 *   Expected properties:
 *     - durationGap (difference in minutes between preferred and actual workout duration)
 *     - frequencyGap (difference in the number of sessions between desired and actual frequency)
 */
export async function updatePreferenceBehavior(userId, preferenceData) {
	let stats = await UserStatistics.findOne({ user: userId });
	if (!stats) {
		stats = new UserStatistics({ user: userId });
	}

	const pref = stats.preferenceBehavior;
	// Append the new gap record.
	pref.preferenceGapHistory.push({
		date: new Date(),
		durationGap: preferenceData.durationGap,
		frequencyGap: preferenceData.frequencyGap,
	});

	// Recalculate the average gap over the history.
	const history = pref.preferenceGapHistory;
	const avgDurationGap = history.reduce((sum, rec) => sum + rec.durationGap, 0) / history.length;
	const avgFrequencyGap = history.reduce((sum, rec) => sum + rec.frequencyGap, 0) / history.length;

	// For a simple match score, we convert the gap to a value between 0 and 1.
	// (A perfect match has a gap of 0 giving a score of 1.)
	pref.preferredWorkoutDurationMatch = 1 / (1 + Math.abs(avgDurationGap));
	pref.workoutFrequencyMatch = 1 / (1 + Math.abs(avgFrequencyGap));

	await stats.save();
}


export function calculateSupersetCompletionRate(supersets) {
	if (!supersets || supersets.length === 0) return 0;

	let totalRate = 0;

	supersets.forEach(superset => {
		const exercises = superset.exercises || [];
		if (exercises.length === 0) return; 

		// If the entire superset is marked as done, count it as fully complete
		if (superset.isDone) {
			totalRate += 1;
		} else {
			const completedCount = exercises.reduce((count, exerciseInstance) => {
				return count + (exerciseInstance.isDone ? 1 : 0);
			}, 0);
			totalRate += (completedCount / exercises.length);
		}
	});

	// Average the rates over all supersets.
	return totalRate / supersets.length;
}