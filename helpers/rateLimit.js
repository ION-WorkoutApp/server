import rateLimit from 'express-rate-limit';

const skipPatterns = [
	/^\/$/,                 // Root path '/'
	/^\/ping$/,             // Exact match '/ping'
	/^\/admin\//,           // Any path that starts with '/admin/'
	/^\/testing\//          // Any path that starts with '/testing/'
];

// limit each IP to 100 requests per 5 minutes
const limiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 100,
	skip: (req, _) => skipPatterns.some(pattern => pattern.test(req.path)),
	handler: (_, res, next) => {
		res.status(429).json({
			message: 'Too many requests from this IP, please try again after 5 minutes.'
		});
	},
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
	validate: { xForwardedForHeader: true, trustProxy: true } // deal with error? (see https://express-rate-limit.mintlify.app/reference/error-codes#err-erl-unexpected-x-forwarded-for)
});


// 20 requests every 15 minutes
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	handler: (req, res, next) => {
		res.status(429).json({
			message: 'Too many authentication attempts, please try again after 15 minutes.'
		});
	},
	standardHeaders: true,
	legacyHeaders: false,
});


export default limiter;