import logger from "./logger.js";

/**
 * @returns false if failed, but it will send the error for you
 */
export default async function validateConfCode(res, redisClient, email, code, removeCodeOnTrue = true) {
	if (process.env.DEBUGGING) {
		logger.info('bypassing conf code due to process.env.DEBUGGING being set');
		return true
	}

    const storedCode = await redisClient.get(`confirmation:${email}`);

    if (storedCode !== code) {
        // increment failed attempt counter
        const attemptKey = `attempts:${email}`;
        let attempts = await redisClient.get(attemptKey);
        attempts = attempts ? parseInt(attempts) : 0;
        attempts++;
        
        // set the counter with the same expiry as the confirmation code
        await redisClient.set(attemptKey, attempts, { EX: 600 });

        if (attempts >= 3) {
            // remove the confirmation code and the attempts counter after 3 failed attempts
            await redisClient.del(`confirmation:${email}`);
            await redisClient.del(attemptKey);
            res.status(400).json({ error: 'too many failed attempts, confirmation code removed' });
            return false
        } else {
            res.status(400).json({ error: 'invalid or expired confirmation code' });
            return false;
        }
    } else {
        if (!removeCodeOnTrue) return true;

        await redisClient.del(`confirmation:${email}`);
        await redisClient.del(`attempts:${email}`);
        return true;
    }
}