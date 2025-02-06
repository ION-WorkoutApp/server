import { User } from '../models/userSchema.js';
import ical from 'ical-generator';
import fs from 'fs/promises';
import logger from '../helpers/logger.js';
import { sanitizeWorkouts } from '../helpers/sanitizeWorkoutData.js';


// helper function to fetch a user and remove sensitive fields
const fetchUserData = async (email) => {
	const user = await User.findOne({ email })
		.populate({
			path: 'workouts',
			model: 'Workout',
			populate: [
				{
					// populate the supersets array
					path: 'supersets',
					populate: {
						// populate each superset's exercises array
						path: 'exercises',
						populate: {
							// populate the exercise in each exercise instance
							path: 'exercise',
							model: 'Exercise',
							select: '-__v -createdAt -updatedAt -videoPath -ratingDescription',
						},
					},
				},
			],
		}).lean();

	if (!user) {
		throw new Error(`user with email ${email} not found.`);
	}

	// destructure to remove sensitive/internal fields
	const {
		password,
		refreshToken,
		__v,
		lastRequestedData,
		savedWorkouts,
		...userData
	} = user;

	return userData;
};


// helper to build common export data with metadata
const buildExportData = (userData, serializeWorkouts = true) => ({
	version: '1.0',
	exportedBy: 'YourAppName',
	email: userData.email,
	name: userData.name,
	age: userData.age,
	gender: userData.gender,
	height: userData.height,
	weight: userData.weight,
	weightUnit: userData.weightUnit,
	fitnessGoal: userData.fitnessGoal,
	preferredWorkoutType: userData.preferredWorkoutType,
	comfortLevel: userData.comfortLevel,
	workouts: serializeWorkouts
		? JSON.stringify(sanitizeWorkouts(userData.workouts))
		: sanitizeWorkouts(userData.workouts),
	createdAt: userData.createdAt,
	updatedAt: userData.updatedAt,
});


// exports a user's data to json
export const exportUserDataToJSON = async (email, outputPath) => {
	try {
		const userData = await fetchUserData(email);
		const exportData = buildExportData(userData, false);
		const jsonData = JSON.stringify(exportData, null, 2);
		await fs.writeFile(outputPath, jsonData);
		logger.err(`json file successfully written to ${outputPath}`);
	} catch (err) {
		console.log(err)
	}
};


// exports a user's workouts to an ics file
export const exportUserWorkoutsToICS = async (email, outputPath) => {
	try {
		const userData = await fetchUserData(email);
		if (!userData.workouts || userData.workouts.length === 0) {
			logger.debug('no workouts found for the user.');
			return;
		}
		const sanitizedWorkouts = sanitizeWorkouts(userData.workouts);
		const cal = ical({ name: `${userData.name}'s workout schedule` });

		sanitizedWorkouts.forEach((workout) => {
			// use _id from the workout document
			const {
				_id,
				workoutName,
				totalTime,
				workoutTime,
				restTime,
				supersets,
				createdAt,
				updatedAt,
			} = workout;
			const startTime = new Date(createdAt);
			const endTime = new Date(startTime.getTime() + workoutTime * 60000);
			const descriptionLines = [
				`workout id: ${_id.toString()}`,
				`workout name: ${workoutName || 'unnamed workout'}`,
				`total time: ${totalTime} minutes`,
				`workout time: ${workoutTime} minutes`,
				`rest time: ${restTime} minutes`,
				`created at: ${new Date(createdAt).toISOString()}`,
				`updated at: ${new Date(updatedAt).toISOString()}`,
				'exercises:',
			];

			supersets.forEach((superset, supersetIndex) => {
				descriptionLines.push(
					`  superset ${supersetIndex + 1}: rest time - ${superset.restTime} minutes`
				);
				superset.exercises.forEach((exInst, exIndex) => {
					descriptionLines.push(`    exercise ${exIndex + 1}: ${exInst.exercise.title}`);
					descriptionLines.push(`      description: ${exInst.exercise.description}`);
					descriptionLines.push(
						`      type: ${exInst.exercise.type} (measured in ${exInst.exercise.measureType})`
					);
					descriptionLines.push(`      body part: ${exInst.exercise.bodyPart}`);
					descriptionLines.push(`      equipment: ${exInst.exercise.equipment}`);
					descriptionLines.push(`      level: ${exInst.exercise.level}`);
					descriptionLines.push(`      per side: ${exInst.exercise.perSide}`);
					if (exInst.exercise.rating !== undefined) {
						descriptionLines.push(`      rating: ${exInst.exercise.rating}`);
					}
					descriptionLines.push(`      sets: ${exInst.sets}`);
					descriptionLines.push(`      sets done: ${exInst.setsDone}`);
					switch (exInst.exercise.measureType) {
						case 0:
							descriptionLines.push(
								`      reps: ${exInst.inset.map(metric => metric.value).join(', ')}`
							);
							break;
						case 1:
							descriptionLines.push(
								`      times: ${exInst.inset.map(metric => metric.value).join(', ')}`
							);
							break;
						case 2:
							descriptionLines.push(
								`      distances: ${exInst.inset.map(metric => metric.value).join(', ')}`
							);
							break;
						default:
							break;
					}
					descriptionLines.push(
						`      weight: ${exInst.weight.map(metric => metric.value).join(', ')}`
					);
					descriptionLines.push(`      rest time: ${exInst.restTime} minutes`);
				});
			});

			cal.createEvent({
				start: startTime,
				end: endTime,
				summary: workoutName || 'unnamed workout',
				description: descriptionLines.join('\n'),
				location: 'gym', // placeholder location
				uid: _id.toString(),
			});
		});

		await cal.save(outputPath);
		logger.debug(`ics file successfully written to ${outputPath}`);
	} catch (err) {
		console.error(err);
	}
};
