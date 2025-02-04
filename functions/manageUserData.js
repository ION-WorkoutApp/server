// workoutService.js

import logger from '../helpers/logger.js';
import { Workout, Exercise } from '../models/exerciseSchema.js'; // Combined import for schema models
import { User } from '../models/userSchema.js';
import mongoose from 'mongoose';

/**
 * Validates and transforms raw workout data to match the updated Workout schema.
 * Adds missing fields with default values if they are not provided.
 * @param {Object} workoutRaw - The raw workout data input.
 * @param {String} [workoutName] - Optional workout name.
 * @returns {Promise<Object|null>} - The validated and transformed workout data or null if invalid.
 */
async function validateWorkoutData(workoutRaw, workoutName = '') {
	try {
		if (!workoutRaw) {
			throw new Error('No workout data provided.');
		}

		// Transform each superset in workoutRaw to the new superset structure
		const supersets = await Promise.all(
			workoutRaw.supersets.map(async (superset) => {
				if (!superset.exercises || superset.exercises.length === 0) {
					throw new Error('Superset must contain at least one exercise.');
				}

				// Transform each exercise instance within the superset
				const exercises = await Promise.all(
					superset.exercises.map(async (exerciseInstance) => {
						// Find the Exercise document by exerciseId
						const exercise = await Exercise.findOne({ exerciseId: exerciseInstance.exercise.exerciseId });
						if (!exercise) {
							throw new Error(`Exercise with ID ${exerciseInstance.exercise.exerciseId} not found.`);
						}

						const mapMetrics = (metrics) => {
							return metrics.map(metric => ({
								id: metric.id,
								isDone: metric.isDone || false,
								restTime: metric.restTime || 0,
								value: metric.value || 0,
								distance: metric.distance || null
							}));
						};

						return {
							exercise: exercise._id, // Reference to the Exercise document
							id: exerciseInstance.id || new mongoose.Types.ObjectId(),
							isDone: exerciseInstance.isDone || false,
							inset: mapMetrics(exerciseInstance.inset || []),
							weight: mapMetrics(exerciseInstance.weight || []),
							measureType: exerciseInstance.measure || 0,
							restTime: exerciseInstance.restTime || 0,
							sets: exerciseInstance.sets || 1,
							setsDone: exerciseInstance.setsDone || 0,
							calories: exerciseInstance.calories || 0,
							duration: exerciseInstance.duration || 0
						};
					})
				);

				return {
					currentExerciseIndex: superset.currentExerciseIndex || 0,
					exercises,
					id: superset.id || new mongoose.Types.ObjectId().toString(),
					isDone: superset.isDone || false,
					isSingleExercise: superset.isSingleExercise || false,
				};
			})
		);

		const totalTime = workoutRaw.workoutTime || workoutRaw.supersets.reduce((t, superset) => (
			t + superset.exercises.reduce((e, eSum) => (eSum + e.duration))
		), 0)

		return {
			supersets,
			totalTime,
			// If workoutTime is missing, default to totalTime
			workoutTime: totalTime,
			calories: workoutRaw.calories || 0,
			workoutName,
		};
	} catch (err) {
		logger.error(`validateWorkoutData Error: ${err.message}`);
		return null;
	}
}

/**
 * Saves a new workout to the database.
 * @param {Object} workoutData - The validated workout data.
 * @param {Boolean} isSaved - Indicates if the workout is a saved workout.
 * @returns {Promise<ObjectId|null>} - The ID of the newly created workout or null if failed.
 */
const saveWorkout = async (workoutData, isSaved = false) => {
	try {
		const newWorkout = new Workout({
			supersets: workoutData.supersets,
			totalTime: workoutData.totalTime,
			workoutTime: workoutData.workoutTime,
			isSaved: isSaved,
			workoutName: workoutData.workoutName || '',
			calories: workoutData.calories || 0
		});

		await newWorkout.save();
		return newWorkout._id;
	} catch (err) {
		logger.error(`saveWorkout Error: ${err.message}`);
		return null;
	}
};

/**
 * Adds a workout ID to the user's workouts array.
 * @param {Object} user - The user document.
 * @param {Promise<ObjectId>} workoutId - The workout ID to add.
 */
const addWorkoutToUser = async (user, workoutId) => {
	try {
		if (!user) throw new Error('User not found.');

		user.workouts.push(workoutId);
		await user.save();
	} catch (err) {
		logger.error(`addWorkoutToUser Error: ${err.message}`);
		throw err;
	}
};

/**
 * Inserts a workout for a user by validating, saving, and linking the workout.
 * @param {Object} user - The user document.
 * @param {Object} workoutRaw - The raw workout data input.
 * @returns {Promise<Number>} - HTTP status code indicating the result.
 */
export async function insertUserWorkout(user, workoutRaw) {
	try {
		if (!user) {
			logger.warn('insertUserWorkout: User not found.');
			return 404;
		}

		const workout = await validateWorkoutData(workoutRaw);
		if (!workout) {
			logger.warn('insertUserWorkout: Invalid workout data.');
			return 400;
		}

		const workoutId = await saveWorkout(workout);
		if (!workoutId) {
			logger.error('insertUserWorkout: Failed to save workout.');
			return 500;
		}

		await addWorkoutToUser(user, workoutId);
		return 200;
	} catch (err) {
		logger.error(`insertUserWorkout Error: ${err.message}`);
		return 500;
	}
}

/**
 * Updates the workout time for a user's specific workout.
 * @param {Object} user - The user document.
 * @param {String} workoutId - The ID of the workout to update.
 * @param {Number} newTime - The new workout time in seconds.
 * @returns {Number} - HTTP status code indicating the result.
 */
export async function updateUserWorkout(user, workoutId, newTime) {
	try {
		if (!user) {
			logger.warn('updateUserWorkout: User not found.');
			return 404;
		}

		if (!mongoose.Types.ObjectId.isValid(workoutId)) {
			logger.warn('updateUserWorkout: Invalid workoutId format.');
			return 400;
		}

		const workout = await Workout.findById(workoutId);
		if (!workout) {
			logger.warn(`updateUserWorkout: Workout with ID ${workoutId} not found.`);
			return 404;
		}

		workout.workoutTime = newTime;
		await workout.save();

		return 200;
	} catch (err) {
		logger.error(`updateUserWorkout Error: ${err.message}`);
		return 500;
	}
}

/**
 * Adds a saved workout for a user by validating, saving, and linking the workout.
 * @param {Object} workoutRaw - The raw workout data input.
 * @param {String} workoutName - The name of the workout.
 * @param {Object} user - The user document.
 * @returns {Promise<Number>} - HTTP status code indicating the result.
 */
export async function addSavedWorkout(workoutRaw, workoutName, user) {
	try {
		if (!user) {
			logger.warn('addSavedWorkout: User not found.');
			return 404;
		}

		const workout = await validateWorkoutData(workoutRaw, workoutName);
		if (!workout) {
			logger.warn('addSavedWorkout: Invalid workout data.');
			return 400;
		}

		const workoutId = await saveWorkout(workout, true);
		if (!workoutId) {
			logger.error('addSavedWorkout: Failed to save workout.');
			return 500;
		}

		user.savedWorkouts.push(workoutId);
		await user.save();

		return 200;
	} catch (err) {
		logger.error(`addSavedWorkout Error: ${err.message}`);
		return 500;
	}
};

/**
 * Finds the index of a saved workout in the user's savedWorkouts array.
 * @param {Object} user - The user document.
 * @param {String} workoutId - The ID of the workout to find.
 * @returns {Number} - The index of the workout or -1 if not found.
 */
const findSavedWorkout = (user, workoutId) => {
	if (!mongoose.Types.ObjectId.isValid(workoutId)) {
		return -1;
	}

	const objectId = new mongoose.Types.ObjectId(workoutId);
	return user.savedWorkouts.findIndex(workout => workout.equals(objectId));
};

/**
 * Deletes a saved workout from the user's savedWorkouts array and removes it from the database.
 * @param {String} workoutId - The ID of the workout to delete.
 * @param {Object} user - The user document.
 * @returns {Promise<Object>} - An object containing the status code and message.
 */
export async function deleteSavedWorkout(workoutId, user) {
	try {
		if (!user) {
			logger.warn('deleteSavedWorkout: User not found.');
			return { code: 404, message: 'User not found' };
		}

		const workoutIndex = findSavedWorkout(user, workoutId);
		if (workoutIndex === -1) {
			logger.warn(`deleteSavedWorkout: Workout with ID ${workoutId} not found in savedWorkouts.`);
			return { code: 404, message: 'Workout not found' };
		}

		user.savedWorkouts.splice(workoutIndex, 1);
		await Promise.all([
			user.save(),
			Workout.findByIdAndDelete(workoutId)
		]);

		return { code: 200, message: 'Workout deleted successfully' };
	} catch (err) {
		logger.error(`deleteSavedWorkout Error: ${err.message}`);
		return { code: 500, message: 'Internal server error' };
	}
};

/**
 * Renames a user's workout and optionally updates its totalTime.
 * @param {String} workoutId - The ID of the workout to rename.
 * @param {Object} user - The user document.
 * @param {String} newName - The new name for the workout.
 * @param {Number} [newTime] - The new total time for the workout in seconds.
 * @returns {Promise<Object>} - An object containing the status code and message.
 */
export async function renameUserWorkout(workoutId, user, newName, newTime = null) {
	try {
		if (!user) {
			logger.warn('renameUserWorkout: User not found.');
			return { code: 404, message: 'User not found' };
		}

		const isSavedWorkout = user.savedWorkouts.some(workout => workout.equals(workoutId));
		const isRegularWorkout = user.workouts.some(workout => workout.equals(workoutId));

		if (!isSavedWorkout && !isRegularWorkout) {
			logger.warn(`renameUserWorkout: Workout with ID ${workoutId} not associated with user.`);
			return { code: 404, message: 'Workout not found for this user' };
		}

		const workout = await Workout.findById(workoutId);
		if (!workout) {
			logger.warn(`renameUserWorkout: Workout with ID ${workoutId} not found in database.`);
			return { code: 404, message: 'Workout not found in database' };
		}

		if (newName) {
			workout.workoutName = newName;
		}

		if (newTime !== null) { // Allow setting newTime to 0
			workout.totalTime = newTime;
		}

		await workout.save();

		return { code: 200, message: `Workout updated successfully${newName ? ` to "${newName}"` : ''}` };
	} catch (err) {
		logger.error(`renameUserWorkout Error: ${err.message}`);
		return { code: 500, message: 'An error occurred while renaming the workout' };
	}
};

/**
 * Retrieves workouts for a user, either saved or regular workouts, with pagination support.
 * @param {String} email - The email of the user.
 * @param {Boolean} [saved=false] - Whether to retrieve saved workouts or regular workouts.
 * @param {Number} [offset=0] - The pagination offset.
 * @param {Number} [limit=10] - The number of workouts to retrieve.
 * @returns {Promise<Object>} - An object indicating success and containing the workouts or an error message.
 */
export const getUserWorkouts = async (email, saved = false, offset = 0, limit = 10) => {
	try {
		const user = await User.findOne({ email: email });
		if (!user) {
			logger.warn('getUserWorkouts: User not found.');
			return { success: false, message: 'User not found' };
		}

		const populateOptions = {
			path: saved ? 'savedWorkouts' : 'workouts',
			populate: {
				path: 'supersets.exercises.exercise', // Populate the Exercise within each exercise instance
				model: 'Exercise'
			},
			options: saved ? {} : { limit: limit, skip: offset }
		};

		await user.populate(populateOptions);

		return {
			success: true,
			workouts: saved ? user.savedWorkouts : user.workouts
		};
	} catch (err) {
		logger.error(`getUserWorkouts Error: ${err.message}`);
		return { success: false, message: 'Error fetching user workouts' };
	}
};

/**
 * Deletes a workout from a user's workouts array and removes it from the database.
 * @param {Object} user - The user document.
 * @param {String} workoutId - The ID of the workout to delete.
 * @returns {Promise<Object>} - An object containing the success status and message.
 */
export const deleteUserWorkout = async (user, workoutId) => {
	try {
		if (!user) {
			logger.warn('deleteUserWorkout: User not found.');
			return { success: false, message: 'User not found' };
		}

		const isSavedWorkout = user.savedWorkouts.some(workout => workout.equals(workoutId));
		const isRegularWorkout = user.workouts.some(workout => workout.equals(workoutId));

		if (!isSavedWorkout && !isRegularWorkout) {
			logger.warn(`deleteUserWorkout: Workout with ID ${workoutId} not associated with user.`);
			return { success: false, message: 'Workout not found for this user' };
		}

		// Determine which array to remove from
		if (isSavedWorkout) {
			user.savedWorkouts = user.savedWorkouts.filter(workout => !workout.equals(workoutId));
		} else if (isRegularWorkout) {
			user.workouts = user.workouts.filter(workout => !workout.equals(workoutId));
		}

		await user.save();
		await Workout.findByIdAndDelete(workoutId);

		return { success: true, message: 'Workout deleted successfully' };
	} catch (err) {
		logger.error(`deleteUserWorkout Error: ${err.message}`);
		return { success: false, message: 'Error deleting user workout' };
	}
};
