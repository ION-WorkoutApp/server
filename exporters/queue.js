import Bull from 'bull';
import crypto from 'crypto';
import path from 'path';
import { exportUserDataToCSV, exportUserDataToJSON, exportUserWorkoutsToICS } from './exporters.js';
import { sendExportEmail } from './mailHandler.js';
import ExportRequest from '../models/exportSchema.js';
import logger from '../helpers/logger.js';

const exportQueue = new Bull('exportQueue', {
    redis: {
        host: process.env.REDIS_HOST || 'redis', // Docker service name
        port: Number(process.env.REDIS_PORT) || 6379, // Internal Redis port
    },
});

exportQueue.on('connect', () => {
    logger.info('Bull queue connected to Redis');
});

exportQueue.process(async (job) => {
    const { exportRequestId } = job.data;

    try {
        // Fetch the ExportRequest document
        const exportRequest = await ExportRequest.findById(exportRequestId).populate({
            path: 'user',
            select: 'email name',
        });

        if (!exportRequest) {
            throw new Error(`ExportRequest with ID ${exportRequestId} not found.`);
        }

        // Update status to 'processing'
        exportRequest.status = 'processing';
        await exportRequest.save();

        const { format, user } = exportRequest;
        const email = user.email;
        const fname = crypto.randomUUID();
        let outputPath;
        let exportFunction;

        switch (format) {
            case 'csv':
                outputPath = path.join('/exports', `${fname}_data.csv`);
                exportFunction = exportUserDataToCSV;
                break;
            case 'json':
                outputPath = path.join('/exports', `${fname}_data.json`);
                exportFunction = exportUserDataToJSON;
                break;
            case 'ics':
                outputPath = path.join('/exports', `${fname}_workouts.ics`);
                exportFunction = exportUserWorkoutsToICS;
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        // Perform the export
        await exportFunction(email, outputPath);

        // After successful export, update ExportRequest
        exportRequest.status = 'completed';
        exportRequest.fileUrl = outputPath;
        exportRequest.completedAt = new Date();
        await exportRequest.save();

        // Send export completion email to the user
        await sendExportEmail(email, `email=${email}&totp=${exportRequest.password}`, format);

        logger.debug(`Export job completed for ${email} in ${format} format.`);
    }
    catch (error) {
        logger.error(`Export job failed for ExportRequest ID ${job.data.exportRequestId}: ${error.message}`);

        // Update the ExportRequest status to 'failed' and record the error
        const exportRequest = await ExportRequest.findById(job.data.exportRequestId);
        if (exportRequest) {
            exportRequest.status = 'failed';
            exportRequest.error = error.message;
            exportRequest.completedAt = new Date();
            await exportRequest.save();
        }

        // Optionally, you can re-throw the error to let Bull handle retries
        throw error;
    }
});

exportQueue.on('completed', (job, result) => {
    logger.debug(`Export job completed for ExportRequest ID ${job.data.exportRequestId}`);
});

exportQueue.on('failed', (job, err) => {
    logger.error(`Export job failed for ExportRequest ID ${job.data.exportRequestId}: ${err.message}`);
});

export default exportQueue;
