import { User } from '../models/userSchema.js';
import { Parser } from 'json2csv';
import ical from 'ical-generator';
import fs from 'fs/promises';
import logger from '../helpers/logger.js';
import { sanitizeWorkouts } from '../helpers/sanitizeWorkoutData.js';


/**
 * Exports a user's data to a CSV file, including all necessary fields for import/export.
 *
 * @param {string} email - The email of the user to export data for.
 * @param {string} outputPath - The file path where the CSV will be saved.
 */
export const exportUserDataToCSV = async (email, outputPath) => {
    try {
        const user = await User.findOne({ email })
            .populate({
                path: 'workouts',
                populate: {
                    path: 'supersets.exercises.exercise',
                    select: '-__v -createdAt -updatedAt -videoPath -ratingDescription',
                    model: 'Exercise',
                },
            })
            .lean();

        if (!user) {
            throw new Error(`User with email ${email} not found.`);
        }

        const {
            password,
            refreshToken,
            _id,
            __v,
            lastRequestedData,
            savedWorkouts,
            ...userData
        } = user;


        const flattenedData = {
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
            workouts: JSON.stringify(sanitizeWorkouts(userData.workouts)), // serialize workouts as JSON
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
        };

        const json2csvParser = new Parser({ header: true });
        const csv = json2csvParser.parse(flattenedData);

        await fs.writeFile(outputPath, csv);
        logger.debug(`CSV file successfully written to ${outputPath}`);
    } catch (error) {
        logger.error(`Error exporting user data to CSV: ${error.message}`);
    }
};


/**
 * Exports a user's data to a JSON file, including all necessary fields for import/export.
 *
 * @param {string} email - The email of the user to export data for.
 * @param {string} outputPath - The file path where the JSON will be saved.
 */
export const exportUserDataToJSON = async (email, outputPath) => {
    try {
        const user = await User.findOne({ email })
            .populate({
                path: 'workouts',
                populate: {
                    path: 'supersets.exercises.exercise',
                    select: '-__v -createdAt -updatedAt -videoPath -ratingDescription',
                    model: 'Exercise',
                },
            })
            .lean();

        if (!user) {
            throw new Error(`User with email ${email} not found.`);
        }

        // Destructure to exclude sensitive and internal fields
        const {
            password,
            refreshToken,
            _id,
            __v,
            lastRequestedData,
            savedWorkouts,
            ...userData
        } = user;


        // Construct the final data object with metadata
        const exportData = {
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
            workouts: sanitizeWorkouts(userData.workouts),
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
        };

        const jsonData = JSON.stringify(exportData, null, 2);

        await fs.writeFile(outputPath, jsonData);
        logger.debug(`JSON file successfully written to ${outputPath}`);
    } catch (error) {
        logger.error(`Error exporting user data to JSON: ${error.message}`);
    }
};


/**
 * Exports a user's workouts to an ICS (iCalendar) file, including all necessary fields for import/export.
 *
 * @param {string} email - The email of the user whose workouts to export.
 * @param {string} outputPath - The file path where the ICS will be saved.
 */
export const exportUserWorkoutsToICS = async (email, outputPath) => {
    try {
        const user = await User.findOne({ email })
            .populate({
                path: 'workouts',
                populate: {
                    path: 'supersets.exercises.exercise',
                    select: '-__v -createdAt -updatedAt -videoPath -ratingDescription',
                    model: 'Exercise',
                },
            })
            .lean();

        if (!user) {
            throw new Error(`User with email ${email} not found.`);
        }

        if (!user.workouts || user.workouts.length === 0) {
            logger.debug('No workouts found for the user.');
            return;
        }

        const sanitizedWorkouts = sanitizeWorkouts(user.workouts),
            cal = ical({ name: `${user.name}'s Workout Schedule` });

        sanitizedWorkouts.forEach(workout => {
            //only "useful for export" type of fields
            const {
                uid, // UUID
                workoutName,
                totalTime,
                workoutTime,
                restTime,
                supersets,
                createdAt,
                updatedAt,
            } = workout;

            // Define start and end times
            const startTime = new Date(createdAt),
                endTime = new Date(startTime.getTime() + workoutTime * 60000); // workoutTime in minutes

            // Construct description with relevant workout details
            const descriptionLines = [
                `Workout ID: ${uid}`, // Include UUID for import reference
                `Workout Name: ${workoutName || 'Unnamed Workout'}`,
                `Total Time: ${totalTime} minutes`,
                `Workout Time: ${workoutTime} minutes`,
                `Rest Time: ${restTime} minutes`,
                `Created At: ${new Date(createdAt).toISOString()}`,
                `Updated At: ${new Date(updatedAt).toISOString()}`,
                'Exercises:',
            ];

            supersets.forEach((superset, supersetIndex) => {
                descriptionLines.push(`  Superset ${supersetIndex + 1}: Rest Time - ${superset.restTime} minutes`);
                superset.exercises.forEach((exInst, exIndex) => {
                    descriptionLines.push(`    Exercise ${exIndex + 1}: ${exInst.exercise.title}`);
                    descriptionLines.push(`      Description: ${exInst.exercise.description}`);
                    descriptionLines.push(`      Type: ${exInst.exercise.type}`);
                    descriptionLines.push(`      Body Part: ${exInst.exercise.bodyPart}`);
                    descriptionLines.push(`      Equipment: ${exInst.exercise.equipment}`);
                    descriptionLines.push(`      Level: ${exInst.exercise.level}`);
                    descriptionLines.push(`      Time Based: ${exInst.exercise.timeBased}`);
                    descriptionLines.push(`      Per Side: ${exInst.exercise.perSide}`);
                    if (exInst.exercise.rating !== undefined) {
                        descriptionLines.push(`      Rating: ${exInst.exercise.rating}`);
                    }
                    descriptionLines.push(`      Sets: ${exInst.sets}`);
                    descriptionLines.push(`      Sets Done: ${exInst.setsDone}`);
                    descriptionLines.push(`      Reps: ${exInst.reps.join(', ')}`);
                    descriptionLines.push(`      Times: ${exInst.times.join(', ')}`);
                    descriptionLines.push(`      Weight: ${exInst.weight.join(', ')}`);
                    descriptionLines.push(`      Rest Time: ${exInst.restTime} minutes`);
                });
            });


            cal.createEvent({
                start: startTime,
                end: endTime,
                summary: workoutName || 'Unnamed Workout',
                description: descriptionLines.join('\n'),
                location: 'Gym', // TODO: implement saving gym profiles
                uid: uid, // Use UUID for the event UID
            });
        });

        await cal.save(outputPath);
        logger.debug(`ICS file successfully written to ${outputPath}`);
    } catch (error) {
        logger.error(`Error exporting workouts to ICS: ${error.message}`);
    }
};
