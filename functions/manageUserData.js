import logger from '../helpers/logger.js';
import { Exercise, Workout } from '../models/exerciseSchema.js';
import { User, userSchema } from '../models/userSchema.js';


function validateWorkoutData(workout) {
    try {
        return workout ? {
            exercises: workout.exercises.map(ex => ({
                exerciseId: ex.exercise.exerciseId,
                title: ex.exercise.title,
                description: ex.exercise.description,
                type: ex.exercise.type,
                bodyPart: ex.exercise.bodyPart,
                equipment: ex.exercise.equipment,
                level: ex.exercise.level,
                rating: ex.exercise.rating,
                ratingDescription: ex.exercise.ratingDescription,
                videoPath: ex.exercise.videoPath,
                timeBased: ex.exercise.timeBased,
                reps: ex.reps,
                times: ex.times,
                weight: ex.weight,
                sets: ex.sets,
                setsDone: ex.setsdone,
                isDone: ex.isDone,
                restTime: ex.restTime
            })),
            totalTime: workout.totalTime
        } : null;
    }
    catch (err) {
        logger.error(err);
        return null;
    }
}


const saveWorkout = async (workoutData) => {
    const newWorkout = new Workout({
        exercises: workoutData.exercises,
        totalTime: workoutData.totalTime
    });

    await newWorkout.save();
    return newWorkout._id; // Return the ID for linking to the User
};


/**
 * @param {userSchema} user 
 * @param {*} workoutId 
 */
const addWorkoutToUser = async (user, workoutId) => {
    if (!user) throw new Error('User not found');

    user.workouts.push(workoutId); // Add the workout ID to the user's workouts
    await user.save();
};


/**
 * @param {userSchema} user 
 * @param {*} workout 
 */
export async function insertUserWorkout(user, workoutRaw) {
    try {
        const workout = validateWorkoutData(workoutRaw);
        if (!user) return 404;
        else if (!workout) return 400;

        const workoutId = await saveWorkout(workout);
        if (!workoutId) return 501;

        await addWorkoutToUser(user, workoutId);
        return 200;
    }
    catch (err) {
        logger.error(err);
        return 500;
    }
}


export const getUserWorkouts = async (user) => {
    try {
        // Find the user and populate their workouts
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        return { success: true, workouts: user.workouts };
    } catch (err) {
        console.error('Error fetching user workouts:', err);
        return { success: false, message: 'Error fetching user workouts' };
    }
};


/**
 * @param {userSchema} user 
 * @param {string} workoutId 
 */
export const deleteUserWorkout = async (user, workoutId) => {
    try {
        if (!user) return { success: false, message: 'User not found' };

        console.log(user.workouts, workoutId);

        // Check if the workoutId exists in the user's workouts array
        const workoutIndex = user.workouts.find(w => (w._id == workoutId));
        if (workoutIndex === -1) {
            return { success: false, message: 'Workout not found for this user' };
        }

        // Remove the workoutId from the user's workouts array
        user.workouts.splice(workoutIndex, 1);
        await user.save();

        // Optionally, delete the workout document from the Workout collection
        await Workout.findByIdAndDelete(workoutId);

        return { success: true, message: 'Workout deleted successfully' };
    } catch (err) {
        logger.error('Error deleting user workout:', err);
        return { success: false, message: 'Error deleting user workout' };
    }
}
