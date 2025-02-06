import ExcelJS from 'exceljs';
import { User } from '../models/userSchema.js';

export const exportUserDataXLSX = async (email, outputPath) => {
	try {
		const user = await User.findOne({ email })
			.select('-password -refreshToken')
			.populate({
				path: 'workouts',
				model: 'Workout',
				populate: {
					path: 'supersets.exercises.exercise',
					model: 'Exercise',
				},
			})
			.populate('savedWorkouts')
			.lean();


		// create a new workbook
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'ION Workout App';
		workbook.created = new Date();

		// SHEET 1: USER PROFILE
		const userProfileSheet = workbook.addWorksheet('User Profile');

		userProfileSheet.columns = [
			{ header: 'Field', key: 'field', width: 30 },
			{ header: 'Value', key: 'value', width: 50 },
		];

		// Add user profile data (top-level fields)
		// Exclude arrays or nested objects that go in separate sheets
		const topLevelFields = [
			'isAdmin',
			'email',
			'name',
			'age',
			'gender',
			'height',
			'weight',
			'weightUnit',
			'distanceUnit',
			'fitnessGoal',
			'preferredWorkoutType',
			'comfortLevel',
			'createdAt',
			'updatedAt',
		];

		topLevelFields.forEach((field) => {
			userProfileSheet.addRow({
				field,
				value: user[field],
			});
		});

		// SHEET 2: USER PREFERENCES (GENERAL, WORKOUT, NOTIFICATIONS, ETC.)
		const preferencesSheet = workbook.addWorksheet('Preferences');

		// flatten each preference sub-object and list each key-value pair
		preferencesSheet.columns = [
			{ header: 'Preference Category', key: 'category', width: 30 },
			{ header: 'Key', key: 'prefKey', width: 30 },
			{ header: 'Value', key: 'prefValue', width: 50 },
		];

		// A helper to push each key/value from an object to the sheet
		const addPreferencesToSheet = (obj, categoryName) => {
			if (!obj) return
			for (const [prefKey, prefValue] of Object.entries(obj)) {
				preferencesSheet.addRow({
					category: categoryName,
					prefKey,
					prefValue: Array.isArray(prefValue)
						? prefValue.join(', ')
						: prefValue,
				});
			}
		};

		// add preferences
		addPreferencesToSheet(user.generalPreferences, 'generalPreferences');
		addPreferencesToSheet(user.workoutPreferences, 'workoutPreferences');
		addPreferencesToSheet(user.progressTracking, 'progressTracking');
		addPreferencesToSheet(user.notifications, 'notifications');
		addPreferencesToSheet(user.socialPreferences, 'socialPreferences');


		// SHEET 3: USER WORKOUTS
		const workoutsSheet = workbook.addWorksheet('Workouts');

		workoutsSheet.columns = [
			{ header: 'Workout _id', key: '_id', width: 24 },
			{ header: 'Workout Name', key: 'workoutName', width: 20 },
			{ header: 'Total Time', key: 'totalTime', width: 15 },
			{ header: 'Workout Time', key: 'workoutTime', width: 15 },
			{ header: 'Is Saved', key: 'isSaved', width: 10 },
			{ header: 'Calories', key: 'calories', width: 10 },
			{ header: 'Created At', key: 'createdAt', width: 24 },
			{ header: 'Updated At', key: 'updatedAt', width: 24 },
			{ header: 'Supersets Count', key: 'supersetsCount', width: 15 },
		];

		// Add each workout as a row
		const userWorkouts = user.workouts || [];
		userWorkouts.forEach((workoutDoc) => {
			workoutsSheet.addRow({
				_id: workoutDoc._id.toString(),
				workoutName: workoutDoc.workoutName,
				totalTime: workoutDoc.totalTime,
				workoutTime: workoutDoc.workoutTime,
				isSaved: workoutDoc.isSaved,
				calories: workoutDoc.calories,
				createdAt: workoutDoc.createdAt,
				updatedAt: workoutDoc.updatedAt,
				supersetsCount: workoutDoc.supersets?.length || 0,
			});
		});


		// SHEET 4: SUPERSETS & EXERCISES
		const supersetsSheet = workbook.addWorksheet('Supersets');
		supersetsSheet.columns = [
			{ header: 'Workout ID', key: 'workoutId', width: 24 },
			{ header: 'Superset ID', key: 'supersetId', width: 24 },
			{ header: 'Is Single Exercise?', key: 'isSingleExercise', width: 18 },
			{ header: 'Is Done?', key: 'isDone', width: 10 },
			{ header: 'Current Exercise Index', key: 'currentExerciseIndex', width: 20 },
			{ header: 'Exercises Count', key: 'exercisesCount', width: 15 },
		];

		const exercisesSheet = workbook.addWorksheet('ExercisesInSupersets');
		exercisesSheet.columns = [
			{ header: 'Workout ID', key: 'workoutId', width: 24 },
			{ header: 'Superset ID', key: 'supersetId', width: 24 },
			{ header: 'Exercise Instance ID', key: 'id', width: 24 },
			{ header: 'Exercise DB ID', key: 'exerciseId', width: 24 },
			{ header: 'Exercise Title', key: 'title', width: 30 },
			{ header: 'Is Done?', key: 'isDone', width: 10 },
			{ header: 'Sets', key: 'sets', width: 10 },
			{ header: 'Sets Done', key: 'setsDone', width: 10 },
			{ header: 'Rest Time', key: 'restTime', width: 10 },
			{ header: 'Duration', key: 'duration', width: 10 },
			{ header: 'Calories', key: 'calories', width: 10 },
		];

		for (const workoutDoc of userWorkouts) {
			const workoutId = workoutDoc._id.toString();
			(workoutDoc.supersets || []).forEach((ss) => {
				// Add row to the Supersets sheet
				supersetsSheet.addRow({
					workoutId,
					supersetId: ss.id,
					isSingleExercise: ss.isSingleExercise,
					isDone: ss.isDone,
					currentExerciseIndex: ss.currentExerciseIndex,
					exercisesCount: ss.exercises.length,
				});

				// For each Exercise Instance in this superset, flatten them
				(ss.exercises || []).forEach((exInst) => {
					// The actual exercise document (populated) is exInst.exercise
					// If it was populated via "supersets.exercises.exercise", it should be an object
					// otherwise it's just an ObjectId
					const exerciseDoc = exInst.exercise || {};
					exercisesSheet.addRow({
						workoutId,
						supersetId: ss.id,
						id: exInst.id,
						exerciseId: exerciseDoc._id ? exerciseDoc._id.toString() : '(not populated)',
						title: exerciseDoc.title || '(unknown)',
						isDone: exInst.isDone,
						sets: exInst.sets,
						setsDone: exInst.setsDone,
						restTime: exInst.restTime,
						duration: exInst.duration,
						calories: exInst.calories,
					});
				});
			});
		}

		await workbook.xlsx.writeFile(outputPath);
	} catch (error) {
		console.error('Error exporting user data:', error);
		return false;
	}
};
