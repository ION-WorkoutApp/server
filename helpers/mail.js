import nodemailer from 'nodemailer'
import logger from './logger.js'


const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


export default async function sendEmail(to, subject, text) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_SENDER,
            to,
            subject,
            text,
        };

		logger.debug(`sending email to ${to}`);
		
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) logger.error(error);
            else logger.debug('Email sent: ' + info.response);
        });
    }
    catch(err) {
        logger.error(err);
    }
}
