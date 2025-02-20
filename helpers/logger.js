import { createLogger, format, transports } from 'winston';

const lPath = '/logs'; // 'logs'

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
            filename: `${lPath}/app.log`,
            level: 'info' // info and above (info, warn, error)
        }),
        new transports.File({ 
            filename: `${lPath}/debug.log`,
            level: 'debug' // only debug messages
        })
    ]
});

export default logger;