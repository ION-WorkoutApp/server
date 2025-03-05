import { Client } from "@elastic/elasticsearch";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Exercise } from "../models/exerciseSchema.js";
import logger from "../helpers/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createWatchWorker() {
	const watcherWorker = new Worker(join(__dirname, "./watcher.js"), { name: "db_indexing_worker" });
	watcherWorker.on("message", (msg) => {
		console.log("message from worker:", msg);
	});
	watcherWorker.on("error", (err) => {
		console.error("error from worker:", err);
	});
	watcherWorker.on("exit", (code) => {
		console.log("worker exited with code", code);
	});
}

const connectToClient = async () => {
	let error;
	for (let i = 0; i < 3; i++) {
		try {
			return new Client({ node: "http://elasticsearch:9200", maxRetries: 6 });
		} catch (err) {
			await new Promise(resolve => setTimeout(resolve, 2000));
			error = err;
		}
	}

	console.error(error);
	return null;
};


const clientPromise = connectToClient();


// updated index creation with rating field
export async function createExerciseIndex() {
	const client = await clientPromise;
	if (!client) throw "elastic search object is null";

	if (await client.indices.exists({ index: "exercises" })) return;
	await client.indices.create({
		index: "exercises",
		body: {
			settings: {
				analysis: {
					analyzer: {
						exercise_analyzer: {
							type: "custom",
							tokenizer: "standard",
							filter: ["lowercase", "edge_ngram_filter"]
						}
					},
					filter: {
						edge_ngram_filter: {
							type: "edge_ngram",
							min_gram: 2,
							max_gram: 15
						}
					}
				}
			},
			mappings: {
				properties: {
					title: {
						type: "text",
						analyzer: "exercise_analyzer",
						fields: {
							keyword: { type: "keyword" }
						}
					},
					bodyPart: { type: "keyword" },
					equipment: { type: "keyword" },
					description: { type: "text" },
					type: { type: "keyword" },
					level: { type: "keyword" },
					rating: { type: "float" }
				}
			}
		}
	});
}


// updated sync function with rating
export async function syncExercisesToElastic() {
	const client = await clientPromise;
	if (!client) return;

	// give the elastic 2 mins to update
	const exercises = await Exercise.find({}, null, { maxTimeMS: 120000 }).catch(console.error);
	if (!exercises) return logger.error("failed to sync elastic to mongo");

	const body = exercises.flatMap((exercise) => [
		{ index: { _index: "exercises", _id: exercise.exerciseId } },
		{
			title: exercise.title,
			description: exercise.description,
			bodyPart: exercise.bodyPart,
			equipment: exercise.equipment,
			type: exercise.type,
			level: exercise.level,
			rating: exercise.rating
		}
	]);

	await client.bulk({ refresh: true, body });
	const { count } = await client.count({ index: "exercises" });

	logger.info(`${count}/${exercises.length} exercises synced to Elastic search`);
}


function createFilter(term, muscleGroup, equipment, difficulty, minRating) {
	const filter = {};
	if (term) filter.title = { $regex: term, $options: "i" };
	if (muscleGroup) filter.bodyPart = muscleGroup;
	if (equipment) filter.equipment = equipment;
	if (difficulty) filter.level = difficulty;
	if (minRating) filter.rating = { $gte: parseFloat(minRating) };
	return filter;
}


async function searchRegex(
	term,
	muscleGroup,
	equipment,
	difficulty,
	minRating,
	page = 0,
	pageSize = 20
) {
	// build the filter object dynamically
	const filter = createFilter(term, muscleGroup, equipment, difficulty, minRating);

	// pagination
	const parsedPage = Math.max(0, parseInt(page, 10));
	const parsedPageSize = Math.max(1, parseInt(pageSize, 10));
	const skip = parsedPage * parsedPageSize;

	// conditionally set sort: if muscleGroup defined --> sort alphabetically by title
	// else sort by bodyPart
	const sortField = muscleGroup ? { title: 1 } : { bodyPart: 1 };

	const exercises = await Exercise.find(filter)
		.sort(sortField)
		.skip(skip)
		.limit(parsedPageSize);

	logger.debug(
		`fetching ${parsedPageSize}/${exercises.length} on page ${page} with filter ${JSON.stringify(filter)}`
	);
	return { exercises, total: await Exercise.countDocuments(filter) };
}


export async function searchExercises(
	term,
	muscleGroup,
	equipment,
	difficulty,
	minRating,
	page = 0,
	pageSize = 20
) {
	try {
		const client = await clientPromise;
		if (!client) {
			logger.debug(`searching for "${term}" using regex`);
			return searchRegex(term, muscleGroup, equipment, difficulty, minRating, page, pageSize);
		}
		else logger.debug(`searching for "${JSON.stringify(createFilter(term, muscleGroup, equipment, difficulty, minRating))}" using elastic`);

		const mustClauses = [];
		const parsedPage = Math.max(0, parseInt(page, 10));
		const parsedPageSize = Math.max(1, parseInt(pageSize, 10));
		const from = parsedPage * parsedPageSize;

		// text search
		if (term) {
			mustClauses.push({
				multi_match: {
					query: term,
					type: "best_fields",
					fields: ["title^3", "description"],
					fuzziness: "AUTO",
					prefix_length: 2
				}
			});
		}

		// filters
		if (muscleGroup) mustClauses.push({ term: { bodyPart: muscleGroup } });
		if (equipment) mustClauses.push({ term: { equipment } });
		if (difficulty) mustClauses.push({ term: { level: difficulty } });
		if (minRating) {
			mustClauses.push({
				range: { rating: { gte: parseFloat(minRating) } }
			});
		}

		// conditionally set sort: if muscleGroup is defined, sort by title only;
		// otherwise sort by bodyPart then title
		const sortClause = muscleGroup
			? [{ bodyPart: "asc" }, { "title.keyword": "asc" }]
			: [{ "title.keyword": "asc" }];

		const { hits } = await client.search({
			index: "exercises",
			body: {
				query: { bool: { must: mustClauses } },
				sort: sortClause,
				from,
				size: parsedPageSize
			}
		});

		const total = await client.count({
			index: "exercises",
			body: {
				query: { bool: { must: mustClauses } }
			}
		});

		// mongo document fetching
		const exerciseIds = hits.hits.map((hit) => hit._id),
			exercises = await Exercise.find({
				exerciseId: { $in: exerciseIds }
			}).lean();

		// order preservation
		const exerciseMap = new Map(exercises.map((ex) => [ex.exerciseId, ex]));
		
		return {
			total: total.count,
			exercises: exerciseIds.map((id) => exerciseMap.get(id)).filter(Boolean)
		};
	} catch (err) {
		console.error(err);
		return { exercises: [], total: 0 };
	}
}
