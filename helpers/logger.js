import { createLogger, format, transports } from 'winston';

const logger = createLogger({
    level: 'debug',
    format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new transports.Console({
            format: format.combine(format.colorize())
        }),
        new transports.File({ 
            filename: 'logs/app.log',
            level: 'info' // info and above (info, warn, error)
        }),
        new transports.File({ 
            filename: 'logs/debug.log',
            level: 'debug' // only debug messages
        })
    ]
});

export default logger;