import pidusage from 'pidusage';
import logger from '../helpers/logger.js';


export default async function checkUsage() {
    var sysStats = await new Promise((resolve) => {
        pidusage(process.pid, (err, stats) => {
            if (err) {
                logger.error('Error fetching stats:', err);
                return;
            }
            resolve(`CPU: ${stats.cpu}% | Memory: ${stats.memory / 1024 / 1024} MB\n`);
        });
    });

    const memoryUsage = process.memoryUsage();
    sysStats += `Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;

    const cpuUsage = process.cpuUsage();
    sysStats += `User CPU Time: ${cpuUsage.user / 1000} ms\n`;
    sysStats += `System CPU Time: ${cpuUsage.system / 1000} ms`;

    return sysStats;
}
