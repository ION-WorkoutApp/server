import { Workout } from '../models/exerciseSchema.js';
import { User } from '../models/userSchema.js';


/**
 * 
 * @deprecated replaced by calling {@link getWorkoutsOnDay} for individual days
 */
export async function getWorkoutsInMonth(email, date, offset) {
    try {
        // get the start and end of the month
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1),
            endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0),
            user = await User.findOne({ email: email });

        if (!user) return { code: 404, message: "user not found" };

        // find the user and populate workouts
        user.populate({
            path: 'workouts',
            options: { limit: 10, skip: offset },
            match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
        });

        if (!user) return { code: 404, message: 'user not found' };

        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // start of current week (Sunday)

        // process workouts to mark those in the current week/day
        const workoutsInMonth = user.workouts.map((workout) => {
            const workoutDate = new Date(workout.createdAt);
            return {
                ...workout._doc,
                isToday: workoutDate.toDateString() === today.toDateString(),
                isThisWeek: workoutDate >= startOfWeek && workoutDate <= today,
            };
        });

        return workoutsInMonth;
    } catch (err) {
        logger.error(err);
        return { code: 500, message: err.message }
    }
}



export async function getWorkoutsOnDay(email, date, offset) {
    try {
        const user = await User.findOne({ email: email });
        if (!user) return { code: 404, message: 'user not found' };

        await user.populate({
            path: 'workouts',
            match: { createdAt: { $gte: date[0], $lte: date[1] } },
            options: { limit: 10, skip: offset },
            populate: {
                path: 'supersets.exercises.exercise', // Deeply populate the exercise field
                model: 'Exercise'
            }
        });

        return { success: true, workouts: user.workouts };
    } catch (err) {
        logger.error(err);
        return { code: 500, message: err.message };
    }
}



export async function getWorkoutTimes(email) {
    try {
        // find the user by email and get their associated workout IDs
        const user = await User.findOne({ email }).select('workouts').lean();

        if (!user || !user.workouts.length) {
            return { code: 200, timestamps: [] }; // return an empty array for consistency
        }

        // find workouts and extract createdAt timestamps
        const timestamps = await Workout.aggregate([
            // match workouts by user's workout IDs
            { $match: { _id: { $in: user.workouts } } },

            // project the createdAt field
            { $project: { _id: 0, createdAt: 1 } },

            // sort the timestamps in ascending order
            { $sort: { createdAt: 1 } }
        ]);

        // return the array of timestamps
        return { code: 200, timestamps: timestamps.map(entry => entry.createdAt) };

    } catch (error) {
        logger.error(error);
        return { code: 500, message: 'Error fetching workout times:' };
    }
}

