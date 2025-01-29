import sendEmail from '../helpers/mail.js'

const serverLink = process.env.SERVERURL || 'workout.ion606.com'

/**
 * Sends an export email to the user with the download link
 * @param {string} to
 * @param {string} fquery
 * @param {string} format
 */
export const sendExportEmail = async (to, fquery, format) => {
    const text = `Hello,

Your requested ${format.toUpperCase()} fitness data export is ready. You can download your data using the link below. Please note that the link will expire in 48 hours.

Download Link: https://${serverLink}/udata/download?${fquery}

If you did not request this export, please change your password immediately.
`;

    await sendEmail(to, 'Your Fitness Data Export is Ready!', text);
};
