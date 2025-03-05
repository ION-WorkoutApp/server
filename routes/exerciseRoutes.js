import express from 'express';
import crypto from 'crypto';
import { Exercise } from '../models/exerciseSchema.js';
import logger from '../helpers/logger.js';
import { verifyToken } from '../middleware/auth.js';
import { createExerciseIndex, searchExercises, syncExercisesToElastic } from '../search/search.js';

const router = express.Router();

// all paths should use auth
router.use(verifyToken);

// needs to happen async
syncExercisesToElastic().then(() => createExerciseIndex()).catch((err) => {
	logger.error(err);
	logger.error('Failed to sync Elastic search, switching to regex');
}).then(() => logger.info('synced Elastic search'));


// get exercises
router.get('/exercises', async (req, res) => {
	try {
		const {
			muscleGroup,
			equipment,
			difficulty,
			minRating,
			page = 0,
			pageSize = 20,
			term
		} = req.query;

		// input Validation
		const parsedPage = Math.max(0, parseInt(page, 10)) || 0,
			parsedPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 100)), // Cap at 100 items/page

			startTime = process.hrtime(),
			{ exercises: orderedExercises, total } = await searchExercises(
				term,
				muscleGroup,
				equipment,
				difficulty,
				minRating,
				page,
				pageSize
			),
			endTime = process.hrtime(startTime);
		
		logger.debug(`an exercise search took ${endTime[0] * 1000 + endTime[1] / 1e6}ms`);

		res.status(200).json({
			exercises: orderedExercises,
			total,
			page: parsedPage,
			pageSize: parsedPageSize,
			totalPages: Math.ceil(total / parsedPageSize)
		});
	} catch (err) {
		console.error(err);

		logger.error('Exercise search failed');

		res.status(500).json({
			message: 'Failed to retrieve exercises',
			error: process.env.NODE_ENV === 'production'
				? 'Internal server error'
				: err.message
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
