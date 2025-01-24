import express from 'express';
import { Exercise } from '../models/exerciseSchema.js';
import logger from '../helpers/logger.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// all paths should use auth
router.use(verifyToken);

// get exercises
router.get('/exercises', async (req, res) => {
    try {
        const {
            muscleGroup, equipment, difficulty, minRating,
            page = 0, pageSize = 20, term = null
        } = req.query;

        // build the filter object dynamically
        const filter = {};
        if (term) filter.title = { $regex: term, $options: 'i' };
        if (muscleGroup) filter.bodyPart = muscleGroup;
        if (equipment) filter.equipment = equipment;
        if (difficulty) filter.difficulty = difficulty;
        if (minRating) filter.rating = { $gte: parseFloat(minRating) };

        // pagination
        const parsedPage = Math.max(0, parseInt(page, 10));
        const parsedPageSize = Math.max(1, parseInt(pageSize, 10));
        const skip = parsedPage * parsedPageSize;

        const exercises = await Exercise.find(filter)
            .sort({ muscleGroup: 1 })
            .skip(skip)
            .limit(parsedPageSize);

        const totalExercises = await Exercise.countDocuments(filter);

        logger.debug(
            `fetching ${parsedPageSize}/${(await Exercise.countDocuments(filter)).toFixed()} `
            + `on page ${page} with filter ${JSON.stringify(filter)}`
        );

        res.status(200).json({
            exercises,
            total: totalExercises,
            page: parsedPage,
            pageSize: parsedPageSize,
        });
    } catch (err) {
        res.status(500).json({
            message: 'Failed to retrieve exercises',
            error: err.message
        });
    }
});

// get categories
router.get('/categories', async (req, res) => {
    try {
        const { field } = req.query;
        const validFields = ['bodyPart', 'equipment', 'type'];

        if (!field || !validFields.includes(field)) {
            return res.status(400).json({
                message: `Invalid field. Please specify one of: ${validFields.join(', ')}`
            });
        }

        const categories = await Exercise.distinct(field);
        res.status(200).json({ field, categories });
    } catch (err) {
        res.status(500).json({
            message: 'Failed to retrieve categories',
            error: err.message
        });
    }
});


export default router;
