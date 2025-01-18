import mongoose from 'mongoose';
import { exec } from 'child_process';
import fs from 'fs';
import csvParser from 'csv-parser';
import { Exercise } from '../models/exerciseSchema.js';
import logger from '../helpers/logger.js';
import * as https from 'https';


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


// function to download and extract dataset
const fetchDatasetOld = (DATASET_URL, DATA_DIR, i) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

        const command = `mkdir -p ${DATA_DIR} && curl -L -o ${i}.zip ${DATASET_URL} && unzip -o ${i}.zip -d ${DATA_DIR} && rm ${i}.zip`;
        logger.info(`Downloading and unzipping dataset using command "${command}"`);

        const c = exec(command, (err, stdout, stderr) => {
            if (err) {
                logger.error('Error downloading or extracting dataset:', err);
                return reject(err);
            }
        });

        c.on('error', logger.error);
        c.on('message', m => logger.debug(`child proc: ${m.toString()}`));
        c.on('exit', () => {
            logger.info('Dataset downloaded and extracted successfully.');
            resolve();
        });
    });
};


function fetchDataset(DATASET_URL, DATA_DIR, i) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
        const outputPath = `${DATA_DIR}/${i}.csv`;

        https.get(DATASET_URL, (response) => {
            if (response.statusCode !== 200) {
                logger.error(`Failed to fetch the file. Status code: ${response.statusCode}`);
                return;
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
                    if (!row['']) fs.appendFileSync('notfound.txt', JSON.stringify(row) + '\n');

                    exercises.push({
                        exerciseId: row[''],
                        title: row['Title'],
                        description: row['Desc'] || "N/A",
                        type: row['Type'] || "N/A",
                        bodyPart: row['BodyPart'] || "N/A",
                        equipment: row['Equipment'] || "N/A",
                        level: row['Level'] || "N/A",
                        timeBased: (row['timeBased'] == 'True'),
                        rating: row['Rating'] ? parseFloat(row['Rating']) : 0,
                        ratingDescription: row['RatingDesc'] || "N/A",
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
                            .catch((err) => logger.error(`Batch insertion error for "${exercises.length}":`, err));
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

        logger.debug('No data found. Downloading and importing...');

        // URL and paths for dataset
        const arr = ['https://raw.githubusercontent.com/ION-WorkoutApp/data/refs/heads/main/megaGymDataset.csv'],
            DATA_DIR = './data';

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
