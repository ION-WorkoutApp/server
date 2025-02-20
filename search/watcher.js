import { parentPort } from 'worker_threads';
import { Client } from '@elastic/elasticsearch';
import { Exercise } from '../models/exerciseSchema.js';

// NO EXPORTS
// file should be self-contained bc it's running in it's own thread

const client = new Client({ node: 'http://elasticsearch:9200' });

// BROKEN
async function watchChanges() {
	try {
		// intellisense might tell you not to await this. It lies
		const cursor = await Exercise.db.collection('').watch();
		console.log(cursor);

		while (await cursor.hasNext()) {
			const change = await cursor.next();
			if (change.operationType === 'insert' || change.operationType === 'update') {
				const doc = change.fullDocument;
				await client.index({
					index: 'exercises',
					id: doc.exerciseId,
					body: {
						title: doc.title,
						description: doc.description,
						bodyPart: doc.bodyPart,
						equipment: doc.equipment,
						type: doc.type,
						level: doc.level,
						rating: doc.rating
					}
				});
			}
			if (change.operationType === 'delete') {
				await client.delete({
					index: 'exercises',
					id: change.documentKey._id
				});
			}
		}
	} catch (err) {
		// send error back to parent thread
		parentPort?.postMessage({ error: err.toString() });
	}
}

// start watching
watchChanges();
