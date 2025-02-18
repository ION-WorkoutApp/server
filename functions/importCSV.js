import mongoose from 'mongoose';
import fs from 'fs';
import csvParser from 'csv-parser';
import { Exercise } from '../models/exerciseSchema.js';
import logger from '../helpers/logger.js';
import * as https from 'https';
import { createBlankUser } from '../models/userSchema.js';
import { exit } from 'process';
import { createDefaultPreferencesIfNotPresent } from './preferences.js';


// function to check if data already exists
const checkDataExists = async () => {
	try {
		const existingData = await Exercise.findOne({});
		return existingData !== null;
	} catch (err) {
		logger.error('Error checking existing data:', err);
		throw err;
	}
};


function fetchDataset(DATASET_URL, DATA_DIR, i) {
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
		const outputPath = `${DATA_DIR}/${i}.csv`;

		https.get(DATASET_URL, (response) => {
			if (response.statusCode !== 200) {
				logger.error(`Failed to fetch the file. Status code: ${response.statusCode}`);
				return reject(response.statusCode);
			}

			const fileStream = fs.createWriteStream(outputPath);
			response.pipe(fileStream);

			fileStream.on('finish', () => {
				logger.info(`File saved successfully at ${outputPath}`);
				resolve(true);
			});

			fileStream.on('error', (err) => {
				reject(err);
				logger.error('Error writing to file:', err);
			});
		}).on('error', (err) => {
			reject(err);
			logger.error('Error fetching the URL:', err);
		});

	})
}


/**
 * @description function to import CSV data
 * MADE EXCLUSIVELY FOR https://www.kaggle.com/api/v1/datasets/download/niharika41298/gym-exercise-data
 * @param {String} CSV_FILE_PATH 
 */
const importCSV = async (CSV_FILE_PATH) => {
	return new Promise((resolve, reject) => {
		try {
			const exercises = [];
			const BATCH_SIZE = 500;
			let batchCount = 0;

			fs.createReadStream(CSV_FILE_PATH)
				.pipe(csvParser())
				.on('data', function (row) {
					if (!row['Id']) fs.appendFileSync('notfound.txt', `${row['Id']} --> ${JSON.stringify(row)}\n`);
					else {
						fs.appendFileSync('rows.txt', JSON.stringify(row) + '\n')
						exercises.push({
							exerciseId: row['Id'],
							title: row['Title'],
							description: row['Desc'] || "N/A",
							type: row['Type'] || "N/A",
							bodyPart: row['BodyPart'] || "N/A",
							equipment: row['Equipment'] || "N/A",
							level: row['Level'] || "N/A",
							measureType: row['measure'] || "reps",
							perSide: (row['perside'] == 'True'),
							rating: row['Rating'] ? parseFloat(row['Rating']) : 0,
							ratingDescription: row['RatingDesc'] || "N/A",
							met: row['met'] ? parseFloat(row['met']) : 0,
							videoPath: '', // empty for now
						});

						if (exercises.length === BATCH_SIZE) {
							this.pause();
							Exercise.insertMany(exercises)
								.then(() => {
									batchCount += exercises.length;
									logger.debug(`${batchCount} documents inserted so far`);
									exercises.length = 0;
									this.resume();
								})
								.catch((err) => {
									logger.error(`Batch insertion error for "${exercises.length}":`, err)
									this.resume();
								});
						}
					}
				})
				.on('end', async () => {
					if (exercises.length > 0) {
						try {
							await Exercise.insertMany(exercises);
							batchCount += exercises.length;
							logger.debug(`${batchCount} documents inserted in total`);
							resolve(true);
						} catch (error) {
							logger.error('Error inserting final batch:', error);
						}
					}
					mongoose.connection.close();
				})
				.on('error', (err) => {
					logger.error('Error reading CSV:', err);
					reject();
					mongoose.connection.close();
				});
		} catch (err) {
			logger.error('Failed to connect to MongoDB:', err);
			reject();
		}
	});
};


// main function to check, fetch, and import
export const checkFetchAndImport = async () => {
	try {
		const dataExists = await checkDataExists();

		if (dataExists) {
			logger.debug('Data already exists in the database. Skipping download and import.');
			return;
		}

		logger.debug(`No ADMIN Users detected, creating admin user with email ${process.env.EMAIL_USER} and password "password", please change it as soon as possible`);

		if (!process.env.EMAIL_USER) {
			logger.error("FAILED TO FIND process.env.EMAIL_USER, PLEASE SET IT TO CONTINUE")
			exit(1);
		}

		// other imports
		await createBlankUser(process.env.EMAIL_USER, "password", true);
		createDefaultPreferencesIfNotPresent();

		logger.debug('No data found. Downloading and importing...');

		// URL and paths for dataset
		const arr = ['https://raw.githubusercontent.com/ION-WorkoutApp/data/refs/heads/main/megaGymDataset.csv'],
			DATA_DIR = '/data/csvs';

		await Promise.all(arr.map((fURL, i) => fetchDataset(fURL, DATA_DIR, i)));

		// not async
		for (const f of fs.readdirSync(DATA_DIR, { recursive: false, withFileTypes: true })) {
			if (f.isDirectory()) continue;
			await importCSV(`${DATA_DIR}/${f.name}`);
		}

		logger.info('finished importing data!');
	} catch (err) {
		logger.error('Error during check, fetch, and import:', err);
	}
};
