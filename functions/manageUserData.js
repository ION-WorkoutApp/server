import logger from '../helpers/logger.js';
import { Workout } from '../models/exerciseSchema.js';
import { User, userSchema } from '../models/userSchema.js';
import mongoose from 'mongoose';


function validateWorkoutData(workout, workoutName) {
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
            totalTime: workout.totalTime,
            workoutTime: workout.workoutTime,
            workoutName: workoutName
        } : null;
    }
    catch (err) {
        logger.error(err);
        return null;
    }
}


const saveWorkout = async (workoutData, isSaved = false) => {
    const newWorkout = new Workout({
        exercises: workoutData.exercises,
        totalTime: workoutData.totalTime,
        workoutTime: workoutData.workoutTime,
        isSaved: isSaved,
        workoutName: workoutData.workoutName
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


/**
 * @param {userSchema} user 
 * @param {String} workoutId
 * @param {Number} newTime 
 */
export async function updateUserWorkout(user, workoutId, newTime) {
    try {
        // convert workoutId to ObjectId
        const objectId = new mongoose.Types.ObjectId(workoutId),
            workoutIndex = user.workouts.findIndex(workout => workout._id.equals(objectId));

        if (!user) return 404;
        else if (workoutIndex === -1) return 400;

        user.workouts[workoutIndex].workoutTime = newTime;
        await user.save();

        return 200;
    }
    catch (err) {
        logger.error(err);
        return 500;
    }
}


/**
 * @param {*} workoutRaw
 * @param {String} workoutName 
 * @param {userSchema} user
 */
export async function addSavedWorkout(workoutRaw, workoutName, user) {
    try {
        const workout = validateWorkoutData(workoutRaw, workoutName);
        if (!user) return 404;
        else if (!workout) return 400;

        const workoutId = await saveWorkout(workout, true);
        if (!workoutId) return 501;

        user.savedWorkouts.push(workoutId);
        await user.save();

        return 200;
    }
    catch (err) {
        logger.error(err);
        return 500;
    }
}


/**
 * @param {userSchema} user 
 * @param {String} workoutId 
 * @returns {Number}
 */
const findSavedWorkout = (user, workoutId) => {
    // convert workoutId to ObjectId
    const objectId = new mongoose.Types.ObjectId(workoutId);

    // find the workout index
    return user.savedWorkouts.findIndex(workout => workout._id.equals(objectId));
}


/**
 * @param {String} workoutId 
 * @param {userSchema} user
 */
export async function deleteSavedWorkout(workoutId, user) {
    try {
        if (!user) return { code: 404, message: "user not found" };

        const workoutIndex = findSavedWorkout(user, workoutId);
        if (workoutIndex === -1) return { code: 404, message: "workout not found" };

        user.savedWorkouts.splice(workoutIndex, 1);

        await Promise.all([user.save(), Workout.findOneAndDelete({ _id: workoutId })]);

        return { code: 200, message: "" };
    } catch (err) {
        logger.error(err);
        return { code: 500, message: "" };
    }
}


/**
 * @param {String} workoutId 
 * @param {String} newName 
 * @param {userSchema} user
 */
export async function renameUserWorkout(workoutId, user, newName, newTime) {
    try {
        if (!user) return { code: 404, message: "User not found" };

        // find the workout index
        const workoutIndex = findSavedWorkout(user, workoutId);
        if (workoutIndex === -1) return { code: 404, message: "Workout not found" };

        // fetch the actual workout document
        const workout = await Workout.findById(workoutId);
        if (!workout) return { code: 404, message: "Workout not found in database" };

        // update the workout name
        if (newName) workout.workoutName = newName;
        if (newTime) workout.totalTime = newTime;
        await workout.save();

        return { code: 200, message: `Workout name changed to "${newName}"` };
    } catch (err) {
        logger.error(err);
        return { code: 500, message: "An error occurred while renaming the workout" };
    }
}


export const getUserWorkouts = async (email, saved = false, offset = 0) => {
    try {
        const user = await User.findOne({ email: email });
        if (!user) return { success: false, message: 'User not found' };

        await user.populate({
            path: saved ? 'savedWorkouts' : 'workouts',
            options: saved ? {} : { limit: 10, skip: offset }
        });

        return { success: true, workouts: (saved) ? user.savedWorkouts : user.workouts };
    } catch (err) {
        logger.error('Error fetching user workouts:', err);
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

        // convert workoutId to ObjectId
        const objectId = new mongoose.Types.ObjectId(workoutId),
            workoutIndex = user.workouts.findIndex(w => (w._id.equals(objectId)));

        if (workoutIndex === -1) return { success: false, message: 'Workout not found for this user' };

        // Remove the workoutId from the user's workouts array
        user.workouts.splice(workoutIndex, 1);
        await user.save();

        await Workout.findByIdAndDelete(objectId);

        return { success: true, message: 'Workout deleted successfully' };
    } catch (err) {
        logger.error('Error deleting user workout:', err);
        return { success: false, message: 'Error deleting user workout' };
    }
}
