import * as crypto from 'crypto';
import fs from 'fs/promises';
import { User } from "../models/userSchema.js";
import exportSchema from "../models/exportSchema.js";
import logger from '../helpers/logger.js';


export default async function uploadDataExport(outputPath, email, format) {
    try {
        const u = await User.findOne({ email });
        if (!u) return null;

        const password = crypto.randomUUID().split('').map(o => (o == '-' || o == '.') ? Math.random().toString() : o).join(''),
            exportRequest = new exportSchema({
                user: u.id,
                fileUrl: outputPath,
                format,
                password: password
            });

        await exportRequest.save();
        return encodeURI(`totp=${password}&email=${email}`);
    }
    catch (err) {
        logger.error(err);
        return null;
    }
}


export async function checkForExpiredDocuments() {
    setInterval(async () => {
        const nowTS = new Date(),
            expiredDocs = await exportSchema.find({ expiresAt: { $lt: nowTS } });

        logger.debug(`polling for expired docs returned ${expiredDocs.length} results`);

        if (expiredDocs.length > 0) {
            await Promise.all(expiredDocs.map(doc => new Promise(resolve => {
                fs.rm(doc.fileUrl).then(() => { resolve(true) })
                    .catch((err) => {
                        logger.error(err);
                        resolve(null)
                    })
            })));

            await exportSchema.deleteMany({ expiresAt: { $lte: nowTS } });

            expiredDocs.forEach(doc => {
                fs.rm(doc.fileUrl).then(() => exportSchema.findOneAndDelete({ _id: doc._id })).catch(logger.error)
            });
        }
    }, 600000); // Poll every 10 minutes (600,000 ms)
}