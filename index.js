import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { validateEmail } from './validators/email.js';
import { User } from './models/userSchema.js';
import checkUsage from './tests/measureUsage.js';
import { Exercise, Workout } from './models/exerciseSchema.js';
import { checkFetchAndImport } from './functions/importCSV.js';
import logger from './helpers/logger.js';
import { addSavedWorkout, deleteSavedWorkout, deleteUserWorkout, getUserWorkouts, insertUserWorkout, renameUserWorkout } from './functions/manageUserData.js';


if (!process.env.SECRET_KEY) throw "PLEASE MAKE SURE THE SECRET KEY IS IN THE ENV FILE";

(await import('fs')).writeFileSync('temp.json', JSON.stringify(process.env))

const app = express();
const PORT = process.env.PORT || 1221;
const SECRET_KEY = process.env.SECRET_KEY || 'myverysecretkey1';

app.use(express.raw());
app.use(express.json());
app.use(cors());

// Connect to MongoDB
const initializeDb = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/userDatabase';
    try {
        await mongoose.connect(mongoUri);

        logger.info('Connected to MongoDB');
    } catch (err) {
        logger.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    }
};

initializeDb().then(checkFetchAndImport);


// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        } else {
            return res.status(401).json({ message: 'Invalid token' });
        }
    }
};



// Route to initialize account
app.post('/initaccount', async (req, res) => {
    try {
        const { name, email, password, age, gender, height, weight, fitnessGoal, preferredWorkoutType, comfortLevel } = req.body;
        // Check for missing fields

        if (!name || !email || !password || !age || !gender || !height || !weight || !fitnessGoal || !preferredWorkoutType || !comfortLevel) {
            return res.status(400).json({ message: 'Bad request. Missing required fields.' });
        }

        // Validate email
        if (!(await validateEmail(email))) return res.sendStatus(403);

        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.sendStatus(409); // Conflict

        // Create new user
        const user = new User({ name, email, password, age, gender, height, weight, fitnessGoal, preferredWorkoutType, comfortLevel });
        await user.save();

        res.status(200).json({ message: 'Account initialized successfully', uid: user._id });
    } catch (err) {
        res.status(500).json({ message: 'Failed to initialize account', error: err.message });
    }
});

// Route to check credentials and issue a token
// Route to check credentials and issue tokens
app.post('/checkcredentials', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.sendStatus(404);

        const user = await User.findOne({ email, password });

        if (user) {
            const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: '7d' });

            // Store the refresh token in the database
            user.refreshToken = refreshToken;
            await user.save();

            res.json({ message: 'Credentials verified', token, refreshToken });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to check credentials', error: err.message });
    }
});

// Route to refresh token
app.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, SECRET_KEY);

        // Find the user and validate the refresh token
        const user = await User.findOne({ _id: decoded.id, refreshToken });

        if (!user) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        // Issue a new access token
        const newToken = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });

        res.json({ token: newToken });
    } catch (err) {
        res.status(403).json({ message: 'Invalid or expired refresh token', error: err.message });
    }
});


// Route to log out and revoke refresh token
app.post('/logout', verifyToken, async (req, res) => {
    try {
        await User.findOneAndUpdate({ _id: req.user.id }, { $unset: { refreshToken: 1 } });
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to log out', error: err.message });
    }
});


// Route to get account details (protected)
app.get('/userdata', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email });

        if (user) {
            res.json(user);
        } else {
            res.status(400).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve user details', error: err.message });
    }
});

// Route to update account details (protected)
app.put('/updatedetails', verifyToken, async (req, res) => {
    try {
        const updatedUser = await User.findOneAndUpdate(
            { email: req.user.email },
            { $set: req.body },
            { new: true }
        );

        if (updatedUser) {
            res.json({ message: 'Account details updated successfully', user: updatedUser });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to update account details', error: err.message });
    }
});

// Route to delete account (protected)
app.delete('/deleteaccount', verifyToken, async (req, res) => {
    try {
        const result = await User.deleteOne({ email: req.user.email });

        if (result.deletedCount > 0) {
            res.sendStatus(200);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete account', error: err.message });
    }
});



//#region exercises

app.get('/exercises', verifyToken, async (req, res) => {
    try {
        const { muscleGroup, equipment, difficulty, minRating, page = 0, pageSize = 20, term = null } = req.query;

        // Build the filter object dynamically based on provided criteria
        const filter = {};
        if (term) filter.title = { $regex: term, $options: 'i' };
        if (muscleGroup) filter.bodyPart = muscleGroup; // Matching muscleGroup
        if (equipment) filter.equipment = equipment; // Matching equipment
        if (difficulty) filter.difficulty = difficulty; // Matching difficulty
        if (minRating) filter.rating = { $gte: parseFloat(minRating) }; // Minimum rating

        // Convert page and pageSize to numbers and calculate skip value
        const parsedPage = Math.max(0, parseInt(page, 10)); // Ensure non-negative
        const parsedPageSize = Math.max(1, parseInt(pageSize, 10)); // Ensure at least 1 per page
        const skip = parsedPage * parsedPageSize;

        // Fetch exercises with filters, pagination, and sorting
        const exercises = await Exercise.find(filter)
            .sort({ muscleGroup: 1 }) // Sorting by muscleGroup (ascending)
            .skip(skip)
            .limit(parsedPageSize);

        logger.debug(`fetching ${parsedPageSize}/${(await Exercise.countDocuments(filter)).toFixed()} on page ${page} with filter ${JSON.stringify(filter)}`)

        // Optionally, return total count for the client to handle total pages
        const totalExercises = await Exercise.countDocuments(filter);

        res.status(200).json({
            exercises,
            total: totalExercises,
            page: parsedPage,
            pageSize: parsedPageSize,
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve exercises', error: err.message });
    }
});



app.get('/categories', verifyToken, async (req, res) => {
    try {
        const { field } = req.query;

        // Validate the requested field
        const validFields = ['bodyPart', 'equipment', 'type'];
        if (!field || !validFields.includes(field)) {
            return res.status(400).json({
                message: `Invalid field. Please specify one of the following fields: ${validFields.join(', ')}.`,
            });
        }

        // Use MongoDB distinct method to get unique values for the requested field
        const categories = await Exercise.distinct(field);

        res.status(200).json({ field, categories });
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve categories', error: err.message });
    }
});


//#endregion


//#region workouts

app.post('/workout', verifyToken, async (req, res) => {
    try {
        if (!req.body) return res.sendStatus(400);

        const user = await User.findOne({ email: req.user.email });
        const r = await insertUserWorkout(user, req.body);
        res.sendStatus(r);
    }
    catch (err) {
        console.error(err);
        res.sendStatus(500)
    }
});


app.get('/workouts', verifyToken, async (req, res) => {
    const user = await User.findOne({ email: req.user.email }).populate('workouts'),
        r = await getUserWorkouts(user);

    res.send(JSON.stringify(r));
});


app.delete('/workout', verifyToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.sendStatus(404);

        const user = await User.findOne({ email: req.user.email }).populate('workouts'),
            r = await deleteUserWorkout(user, id)

        r.success ? res.sendStatus(200) : res.status(500).send(r.message);
    }
    catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

//#endregion


//#region saved workouts

app.get('/savedworkouts', verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.user.email }).populate('savedWorkouts'),
            r = await getUserWorkouts(user, true);

        res.send(JSON.stringify(r));
    }
    catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

app.post('/savedworkouts', verifyToken, async (req, res) => {
    const { workoutname, workout } = req.body
    if (!workout || !workoutname) return res.sendStatus(501)

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).send("user not found");

    const r = await addSavedWorkout(workout, workoutname, user);
    res.sendStatus(r);
});


app.delete('/savedworkouts', verifyToken, async (req, res) => {
    const { workoutId } = req.body;
    if (!workoutId) return res.status(404).send('no workoutID provided!');

    const user = await User.findOne({ email: req.user.email }).populate('savedWorkouts');
    if (!user) return res.status(404).send("user not found");

    const r = await deleteSavedWorkout(workoutId, user);
    res.status(r.code).send(r.message);
});


app.put('/savedworkouts', verifyToken, async (req, res) => {
    const { workoutId, newName } = req.body;
    if (!workoutId || !newName) return res.sendStatus(501)

    const user = await User.findOne({ email: req.user.email }).populate('savedWorkouts');
    if (!user) return res.status(404).send("user not found");

    const r = await renameUserWorkout(workoutId, newName, user);
    res.status(r.code).send(r.message);
});


//#endregion


//#region TESTING
app.get('/getallusers', async (req, res) => {
    try {
        const users = await User.find({});
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve users', error: err.message });
    }
});

app.get('/sysusage', async (req, res) => {
    try {
        const usage = await checkUsage();
        res.status(200).send(usage);
    }
    catch (err) {
        logger.error(err);
        res.sendStatus(500);
    }
})

//#endregion

// Generic routes
app.get('*', (req, res) => {
    if (req.path === '/ping') return res.sendStatus(200);
    logger.debug(`GET request made at ${req.path}`);
    res.sendStatus(404);
});

app.post('*', (req, res) => {
    logger.debug(`POST request made at ${req.path}`);
    res.sendStatus(404);
});

// Start the server
app.listen(PORT, async () => {
    (await import('node:dns')).lookup((await import('node:os')).hostname(), { family: 4 }, (err, addr) => {
        logger.debug(`Server is running on http://${addr}:${PORT}`);
    });
});
