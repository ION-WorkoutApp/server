import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import endpoints from '../docs/routes.json' with { type: 'json' };

const router = express.Router();

const options = {
	definition: {
		openapi: '3.0.0',
		info: {
			title: 'ion workout app api docs',
			version: '1.0.0',
		},
		paths: {},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'jwt',
				},
			},
		},
		tags: [],
	},
	apis: [],
};

const openapiSpecification = swaggerJsdoc(options);

// helper function to generate a summary string for an endpoint
function generateSummary(endpoint, method) {
	const methodUpper = method.toUpperCase();
	// remove leading/trailing slashes and replace inner slashes with a space for a cleaner description
	const pathDescription = endpoint.path.replace(/^\/|\/$/g, '').replace(/\//g, ' ') || 'root';
	let summary = '';

	switch (endpoint.category) {
		case 'general':
			summary = `general: ${methodUpper} ${pathDescription}`;
			break;
		case 'authentication':
			summary = `authentication: ${methodUpper} ${pathDescription}`;
			break;
		case 'administration':
			summary = `administration: ${methodUpper} ${pathDescription}`;
			break;
		case 'users':
			summary = `users: ${methodUpper} ${pathDescription}`;
			break;
		case 'exercises':
			summary = `exercises: ${methodUpper} ${pathDescription}`;
			break;
		case 'statistics':
			summary = `statistics: ${methodUpper} ${pathDescription}`;
			break;
		case 'workouts':
			summary = `workouts: ${methodUpper} ${pathDescription}`;
			break;
		case 'testing':
			summary = `testing: ${methodUpper} ${pathDescription}`;
			break;
		default:
			summary = `${methodUpper} ${pathDescription}`;
			break;
	}

	return summary;
}

// gather unique categories from endpoints and add them as tags in the openapi spec
const uniqueCategories = new Set();
endpoints.forEach((endpoint) => {
	if (endpoint.category) uniqueCategories.add(endpoint.category);
});
uniqueCategories.forEach((category) => {
	openapiSpecification.tags.push({
		name: category,
		description: `${category} endpoints`,
	});
});

// iterate over endpoints to build openapi paths with generated summaries, request bodies, query/path parameters, and assigned tags
endpoints.forEach((endpoint) => {
	// convert express-style parameters (e.g. :id) to openapi format (e.g. {id})
	const openapiPath = endpoint.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
	openapiSpecification.paths[openapiPath] = openapiSpecification.paths[openapiPath] || {};
	endpoint.methods.forEach((method) => {
		const operationObject = {
			summary: generateSummary(endpoint, method),
			tags: endpoint.category ? [endpoint.category] : [],
			responses: {
				200: {
					description: 'successful operation',
				},
			},
			security: (endpoint.middlewares.includes('verifyToken') || endpoint.middlewares.includes('checkAdmin'))
				? [
					{
						bearerAuth: [],
					},
				]
				: [],
		};

		// add requestBody if a non-empty body is provided
		if (endpoint.body && Object.keys(endpoint.body).length > 0) {
			operationObject.requestBody = {
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: endpoint.body,
						},
					},
				},
				required: true,
			};
		}

		// add parameters from the params array
		if (endpoint.params && endpoint.params.length > 0) {
			const parameters = [];
			endpoint.params.forEach((param) => {
				if (openapiPath.includes(`{${param}}`)) {
					parameters.push({
						name: param,
						in: 'path',
						required: true,
						schema: { type: 'string' },
					});
				} else {
					parameters.push({
						name: param,
						in: 'query',
						required: false,
						schema: { type: 'string' },
					});
				}
			});
			operationObject.parameters = parameters;
		}

		openapiSpecification.paths[openapiPath][method.toLowerCase()] = operationObject;
	});
});

// serve the openapi spec as json
router.get('/openapi.json', (req, res) => {
	res.json(openapiSpecification);
});

// serve the redoc page, which displays endpoints grouped by tags
router.get('/', (req, res) => {
	res.send(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>ion workout app api docs</title>
			<meta charset="utf-8" />
			<link rel="icon" href="https://avatars.githubusercontent.com/u/194176806?s=200" />
			<style>body { margin: 0; padding: 0; }</style>
		</head>
		<body>
			<redoc spec-url="/docs/openapi.json" options='{ "hideDownloadButton": true, "sortTagsAlphabetically": true }'></redoc>
			<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
		</body>
		</html>
	`);
});

export default router;
