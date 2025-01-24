import express from 'express';
import { User } from '../models/userSchema.js';
import { verifyToken } from '../middleware/auth.js';
import {
    insertUserWorkout, updateUserWorkout, getUserWorkouts,
    deleteUserWorkout, addSavedWorkout, deleteSavedWorkout,
    renameUserWorkout
} from '../functions/manageUserData.js';
import { getWorkoutsInMonth, getWorkoutsOnDay, getWorkoutTimes } from '../functions/byTime.js';
import logger from '../helpers/logger.js';

const router = express.Router();

// all paths should use auth
router.use(verifyToken);


//#region normal workouts

// create a workout
router.post('/workout', async (req, res) => {
    try {
        if (!req.body) return res.sendStatus(400);
        const user = await User.findOne({ email: req.user.email });
        const r = await insertUserWorkout(user, req.body);
        res.sendStatus(r);
    } catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});


// update a workout
router.put('/workout', async (req, res) => {
    try {
        const { workoutId, newTime } = req.body;
        if (!workoutId || !newTime) return res.sendStatus(400);

        const user = await User.findOne({ email: req.user.email }).populate('workouts');
        const r = await updateUserWorkout(user, workoutId, newTime);
        res.sendStatus(r);
    } catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});


// get workouts
router.get('/workouts', async (req, res) => {
    try {
        const { pagenum = 0, date } = req.query,
            offset = pagenum * 10;

        let r;

        if (date) {
            const [start, end] = date.replace(/[()]/g, '').split(',').map(date => new Date(date.trim()));
            r = await getWorkoutsOnDay(req.user.email, [start, end], offset);
        }
        else {
            r = await getUserWorkouts(req.user.email, false, offset);
        }

        res.send(JSON.stringify(r));
    }
    catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});


// delete a workout
router.delete('/workout', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.sendStatus(404);

        const user = await User
            .findOne({ email: req.user.email })
            .populate('workouts');
        const r = await deleteUserWorkout(user, id);

        r.success ? res.sendStatus(200) : res.status(500).send(r.message);
    } catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});


router.get('/workoutdates', async (req, res) => {
    const r = await getWorkoutTimes(req.user.email);

    if (r.timestamps) res.status(r.code).send(JSON.stringify(r.timestamps));
    else res.status(r.code).send(r.message);
});

//#endregion


//#region saved workouts

router.get('/savedworkouts', async (req, res) => {
    try {
        const r = await getUserWorkouts(req.user.email, true);
        res.send(JSON.stringify(r));
    } catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
});


router.post('/savedworkouts', async (req, res) => {
    const { workoutname, workout } = req.body;
    if (!workout || !workoutname) return res.sendStatus(501);

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).send("user not found");

    const r = await addSavedWorkout(workout, workoutname, user);
    res.sendStatus(r);
});


router.delete('/savedworkouts', async (req, res) => {
    const { workoutId } = req.body;
    if (!workoutId) return res.status(404).send('no workoutID provided!');

    const user = await User
        .findOne({ email: req.user.email })
        .populate('savedWorkouts');
    if (!user) return res.status(404).send("user not found");

    const r = await deleteSavedWorkout(workoutId, user);
    res.status(r.code).send(r.message);
});


router.put('/savedworkouts', async (req, res) => {
    const { workoutId, newName, newTime } = req.body;
    if (!workoutId || (!newName && !newTime)) return res.sendStatus(501);

    const user = await User
        .findOne({ email: req.user.email })
        .populate('savedWorkouts');
    if (!user) return res.status(404).send("user not found");

    const r = await renameUserWorkout(workoutId, user, newName, newTime);
    res.status(r.code).send(r.message);
});

//#endregion


export default router;
