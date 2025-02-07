import logger from '../helpers/logger.js'
import { calculateRecovery } from './recoveryPercentages.js';

export async function analyzeUserData(user) {
	if (!user || !Array.isArray(user.workouts)) return { error: 'No user or user workouts found' };

	// prepare data structures for aggregations
	const workouts = user.workouts;
	let totalWorkouts = 0;
	let totalWorkoutTime = 0;   // sum of workoutTime
	let totalCalories = 0;      // sum of all workouts' calories
	let totalDuration = 0;      // sum of totalTime if you track that separately

	// Tracking daily stats (for trends, charts, etc.)
	const dailyStatsMap = {};

	// distribution by type, body part, etc.
	const exerciseTypeCount = {};
	const bodyPartCount = {};
	const exerciseUsageCount = {};

	// performance & volume tracking
	const totalVolume = workouts.reduce((sum, w) => sum +
		w.supersets.reduce((sSum, s) => sSum +
			s.exercises.reduce((eSum, e) => eSum +
				(e.weight?.length ? e.weight[0] * e.inset.length * e.reps : 0), 0), 0), 0); // total of (sets * reps * weight)

	const personalBests = {};

	// for consistency and streaks
	// track workouts by date, see which days have workouts
	const workoutDates = new Set(); // store YYYY-MM-DD strings


	for (const workout of workouts) {
		totalWorkouts++;
		totalWorkoutTime += workout.workoutTime || 0;
		totalCalories += workout.calories || 0;
		totalDuration += workout.totalTime || 0;

		// daily stats
		const date = new Date(workout.createdAt);
		const dateKey = date.toISOString().split('T')[0];
		workoutDates.add(dateKey);

		if (!dailyStatsMap[dateKey]) {
			dailyStatsMap[dateKey] = {
				workoutCount: 0,
				totalCalories: 0,
				totalWorkoutTime: 0,
				totalDuration: 0,
			};
		}
		dailyStatsMap[dateKey].workoutCount++;
		dailyStatsMap[dateKey].totalCalories += workout.calories || 0;
		dailyStatsMap[dateKey].totalWorkoutTime += workout.workoutTime || 0;
		dailyStatsMap[dateKey].totalDuration += workout.totalTime || 0;

		// supersets & exercises
		if (Array.isArray(workout.supersets)) {
			workout.supersets.forEach((ss) => {
				if (Array.isArray(ss.exercises)) {
					ss.exercises.forEach((exInst) => {
						const exerciseDoc = exInst.exercise;
						if (!exerciseDoc) return; // might be null if not populated

						// -- Exercise distribution by type
						if (exerciseDoc.type) {
							exerciseTypeCount[exerciseDoc.type] =
								(exerciseTypeCount[exerciseDoc.type] || 0) + 1;
						}

						// -- By body part
						if (exerciseDoc.bodyPart) {
							bodyPartCount[exerciseDoc.bodyPart] =
								(bodyPartCount[exerciseDoc.bodyPart] || 0) + 1;
						}

						// -- Usage count by exercise title
						if (exerciseDoc.title) {
							exerciseUsageCount[exerciseDoc.title] =
								(exerciseUsageCount[exerciseDoc.title] || 0) + 1;
						}

						// PERFORMANCE / VOLUME:
						let exerciseVolume = 0;

						// exInst.inset[] might store the reps, exInst.weight[] might store weight
						// for each set index, we can multiply "reps * weight" if they line up
						const repArray = exInst.inset || [];
						const weightArray = exInst.weight || [];

						for (let i = 0; i < repArray.length; i++) {
							const reps = repArray[i].value || 0;
							const wgt = weightArray[i]?.value || 0;
							exerciseVolume += reps * wgt;
						}

						// Get the heaviest set, defaulting to -Infinity to avoid Math.max([]) issues
						const heaviestSet = weightArray.length > 0
							? Math.max(...weightArray.map((w) => w.value || 0))
							: -Infinity;

						// Get the maximum reps performed in a set
						const maxReps = repArray.length > 0
							? Math.max(...repArray.map(r => r.value || 0))
							: 0;

						// Get the maximum duration (in seconds/minutes depending on your data model)
						const maxDuration = exInst.duration || 0;

						// Ensure we track personal bests even if weight is 0, based on reps and duration
						const currentBest = personalBests[exerciseDoc.title] || { maxWeight: 0, maxReps: 0, maxDuration: 0 };
						
						// Only update personal bests if:
						if (
							(heaviestSet > currentBest.maxWeight && heaviestSet > 0) ||  // New max weight
							(heaviestSet === currentBest.maxWeight && maxReps > currentBest.maxReps) ||  // If weight is tied, compare reps
							(heaviestSet === currentBest.maxWeight && maxReps === currentBest.maxReps && maxDuration > currentBest.maxDuration) // If both weight and reps are tied, compare duration
						) {
							personalBests[exerciseDoc.title] = {
								maxWeight: heaviestSet > 0 ? heaviestSet : currentBest.maxWeight, // Ensure weight is never negative
								maxReps: maxReps,
								maxDuration: maxDuration
							};
						}
						else logger.debug(`heaviest: ${heaviestSet}\tpersonalbest: `)
					});
				}
			});
		}
	}

	// -------------------------------------------------------------------------
	// 3) Build derived stats
	// -------------------------------------------------------------------------
	// a) Daily stats as an array (sorted by date)
	const dailyStats = Object.keys(dailyStatsMap)
		.map((dateKey) => {
			return {
				date: dateKey,
				...dailyStatsMap[dateKey],
			};
		})
		.sort((a, b) => new Date(a.date) - new Date(b.date));

	// b) Average workout duration & average calories
	const averageWorkoutTime = totalWorkouts > 0 ? (totalWorkoutTime / totalWorkouts) : 0;
	const averageCalories = totalWorkouts > 0 ? (totalCalories / totalWorkouts) : 0;

	// c) Workouts per week or month (simple approach)
	//    We'll create a map of "YYYY-WW" or "YYYY-MM" to counts
	//    Here we do monthly for demonstration:
	const monthlyWorkoutsMap = {};
	for (const dateKey of workoutDates) {
		const [year, month] = dateKey.split('-'); // e.g. "2025-02"
		const monthKey = `${year}-${month}`;
		monthlyWorkoutsMap[monthKey] = (monthlyWorkoutsMap[monthKey] || 0) + 1;
	}
	const monthlyWorkouts = Object.keys(monthlyWorkoutsMap).map((m) => ({
		month: m,
		workoutCount: monthlyWorkoutsMap[m],
	}));

	// d) Streaks (very basic calculation of daily workout streak)
	//    Sort the workoutDates array and see how many consecutive days
	const sortedWorkoutDates = Array.from(workoutDates).sort(
		(a, b) => new Date(a) - new Date(b)
	);
	let longestStreak = 0;
	let currentStreak = 0;
	let prevDate = null;

	for (const d of sortedWorkoutDates) {
		if (!prevDate) {
			currentStreak = 1;
		} else {
			// check if today's date is exactly 1 day after prevDate
			const diff = (new Date(d).getTime() - new Date(prevDate).getTime()) / (1000 * 60 * 60 * 24);
			if (diff === 1) {
				currentStreak++;
			} else {
				// reset
				currentStreak = 1;
			}
		}
		if (currentStreak > longestStreak) {
			longestStreak = currentStreak;
		}
		prevDate = d;
	}

	// e) Top exercises by usage (e.g. top 5)
	const exerciseUsageArray = Object.entries(exerciseUsageCount).map(([title, count]) => ({
		title,
		count,
	}));
	exerciseUsageArray.sort((a, b) => b.count - a.count);
	const topExercises = exerciseUsageArray.slice(0, 5);

	// f) Convert personalBests from an object to an array if needed
	//    e.g. { "Bench Press": { maxWeight: 200 }, "Squat": { maxWeight: 250 } }
	const personalBestsArray = Object.entries(personalBests).map(([title, data]) => ({
		title,
		...data,
	}));

	// -------------------------------------------------------------------------
	// 4) Compile final stats object
	// -------------------------------------------------------------------------
	return {
		muscleRecovery: await calculateRecovery(user.email) || {},
		
		overallActivity: {
			totalWorkouts,
			totalVolume,       // sets*reps*weight sum
			longestStreak,
			currentStreak,     // might be the same as longestStreak if user didn't break it yet
		},

		timeAndDuration: {
			totalWorkoutTime,
			totalDuration,
			averageWorkoutTime,
			dailyStats,  // for line charts over time (time, calories, etc.)
		},

		calories: {
			totalCalories,
			averageCalories,
		},

		exerciseDistribution: {
			byType: exerciseTypeCount,
			byBodyPart: bodyPartCount,
			topExercises, // top 5
		},

		performance: {
			totalVolume,
			personalBests: personalBestsArray,
			// Could add more advanced calculations like 1RM, etc.
		},

		consistency: {
			monthlyWorkouts, // array of { month: '2025-02', workoutCount: n }
		},
	};
}
