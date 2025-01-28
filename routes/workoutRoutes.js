import express from 'express';
import { User } from '../models/userSchema.js';
import { verifyToken } from '../middleware/auth.js';
import {
    insertUserWorkout,
    updateUserWorkout,
    getUserWorkouts,
    deleteUserWorkout,
    addSavedWorkout,
    deleteSavedWorkout,
    renameUserWorkout
} from '../functions/manageUserData.js';
import { getWorkoutsOnDay, getWorkoutTimes } from '../functions/byTime.js';
import logger from '../helpers/logger.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);


// #region Normal Workouts

/**
 * @route   POST /workout
 * @desc    Create a new workout
 * @access  Private
 */
router.post('/workout', async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ message: 'Workout data is required.' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const statusCode = await insertUserWorkout(user, req.body);
        
        // Provide more descriptive responses based on status codes
        switch (statusCode) {
            case 200:
                return res.status(200).json({ message: 'Workout created successfully.' });
            case 400:
                return res.status(400).json({ message: 'Invalid workout data.' });
            case 501:
                return res.status(501).json({ message: 'Workout could not be saved.' });
            default:
                return res.status(statusCode).end();
        }
    } catch (err) {
        logger.error('Error creating workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   PUT /workout
 * @desc    Update an existing workout's time
 * @access  Private
 */
router.put('/workout', async (req, res) => {
    try {
        const { workoutId, newTime } = req.body;

        if (!workoutId || typeof newTime !== 'number') {
            return res.status(400).json({ message: 'workoutId and newTime are required.' });
        }

        const user = await User.findOne({ email: req.user.email }).populate('workouts');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const statusCode = await updateUserWorkout(user, workoutId, newTime);

        switch (statusCode) {
            case 200:
                return res.status(200).json({ message: 'Workout updated successfully.' });
            case 400:
                return res.status(400).json({ message: 'Workout not found for this user.' });
            case 404:
                return res.status(404).json({ message: 'Workout not found.' });
            default:
                return res.status(statusCode).end();
        }
    } catch (err) {
        logger.error('Error updating workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   GET /workouts
 * @desc    Retrieve user workouts with optional date filtering and pagination
 * @access  Private
 */
router.get('/workouts', async (req, res) => {
    try {
        const { pagenum = 0, date } = req.query;
        const offset = parseInt(pagenum) * 10;

        let result;

        if (date) {
            // Expecting date in format "(start, end)"
            const [startStr, endStr] = date.replace(/[()]/g, '').split(',').map(d => d.trim());
            const start = new Date(startStr);
            const end = new Date(endStr);

            if (isNaN(start) || isNaN(end)) {
                return res.status(400).json({ message: 'Invalid date format.' });
            }

            result = await getWorkoutsOnDay(req.user.email, [start, end], offset);
        } else {
            result = await getUserWorkouts(req.user.email, false, offset);
        }

        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error fetching workouts:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   DELETE /workout
 * @desc    Delete a specific workout
 * @access  Private
 */
router.delete('/workout', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Workout ID is required.' });
        }

        const user = await User.findOne({ email: req.user.email }).populate('workouts');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const deletionResult = await deleteUserWorkout(user, id);

        if (deletionResult.success) {
            return res.status(200).json({ message: 'Workout deleted successfully.' });
        } else {
            return res.status(deletionResult.code || 500).json({ message: deletionResult.message || 'Deletion failed.' });
        }
    } catch (err) {
        logger.error('Error deleting workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   GET /workoutdates
 * @desc    Retrieve workout timestamps
 * @access  Private
 */
router.get('/workoutdates', async (req, res) => {
    try {
        const result = await getWorkoutTimes(req.user.email);

        if (result.timestamps) {
            return res.status(result.code || 200).json(result.timestamps);
        } else {
            return res.status(result.code || 400).json({ message: result.message || 'No timestamps found.' });
        }
    } catch (err) {
        logger.error('Error fetching workout dates:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// #endregion

// #region Saved Workouts

/**
 * @route   GET /savedworkouts
 * @desc    Retrieve user's saved workouts
 * @access  Private
 */
router.get('/savedworkouts', async (req, res) => {
    try {
        const result = await getUserWorkouts(req.user.email, true);

        return res.status(200).json(result);
    } catch (err) {
        logger.error('Error fetching saved workouts:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   POST /savedworkouts
 * @desc    Add a workout to saved workouts
 * @access  Private
 */
router.post('/savedworkouts', async (req, res) => {
    try {
        const { workoutname, workout } = req.body;

        if (!workout || !workoutname) {
            return res.status(400).json({ message: 'workout and workoutname are required.' });
        }

        const user = await User.findOne({ email: req.user.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const statusCode = await addSavedWorkout(workout, workoutname, user);

        switch (statusCode) {
            case 200:
                return res.status(200).json({ message: 'Saved workout added successfully.' });
            case 400:
                return res.status(400).json({ message: 'Invalid workout data.' });
            case 501:
                return res.status(501).json({ message: 'Workout could not be saved.' });
            default:
                return res.status(statusCode).end();
        }
    } catch (err) {
        logger.error('Error adding saved workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   DELETE /savedworkouts
 * @desc    Delete a workout from saved workouts
 * @access  Private
 */
router.delete('/savedworkouts', async (req, res) => {
    try {
        const { workoutId } = req.body;

        if (!workoutId) {
            return res.status(400).json({ message: 'Workout ID is required.' });
        }

        const user = await User.findOne({ email: req.user.email }).populate('savedWorkouts');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const deletionResult = await deleteSavedWorkout(workoutId, user);

        if (deletionResult.code === 200) {
            return res.status(200).json({ message: 'Saved workout deleted successfully.' });
        } else {
            return res.status(deletionResult.code || 500).json({ message: deletionResult.message || 'Deletion failed.' });
        }
    } catch (err) {
        logger.error('Error deleting saved workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route   PUT /savedworkouts
 * @desc    Rename a saved workout and/or update its time
 * @access  Private
 */
router.put('/savedworkouts', async (req, res) => {
    try {
        const { workoutId, newName, newTime } = req.body;

        if (!workoutId || (!newName && typeof newTime !== 'number')) {
            return res.status(400).json({ message: 'workoutId and at least one of newName or newTime are required.' });
        }

        const user = await User.findOne({ email: req.user.email }).populate('savedWorkouts');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const renameResult = await renameUserWorkout(workoutId, user, newName, newTime);

        if (renameResult.code === 200) {
            return res.status(200).json({ message: renameResult.message });
        } else {
            return res.status(renameResult.code || 500).json({ message: renameResult.message || 'Rename failed.' });
        }
    } catch (err) {
        logger.error('Error renaming saved workout:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// #endregion


export default router;
