import { baseUrl, createFakeUser, generateSampleWorkout, handleResponse } from "./functions/createFakeUser.js";
import autoUserLogin from './functions/autoUserLogin.js'

async function insertWorkouts(numworkouts, email = null, password = null) {
	const token = await ((email && password) ? autoUserLogin(baseUrl, email, password) : createFakeUser());
	if (!token) return;

	const workouts = await Promise.all([...Array(numworkouts)].map(_ => generateSampleWorkout(token)));
	(await import('fs')).writeFileSync('tests/temp.json', JSON.stringify(workouts))

	for (const workout of workouts) {
		console.log(`creating workout: ${workout.workoutName}`);
		await handleResponse(await fetch(`${baseUrl}/workouts/workout`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'authorization': token
			},
			body: JSON.stringify(workout)
		}));
		console.log(`workout "${workout.workoutName}" created successfully.`);
	}

	// retrieve the user’s workouts from /workouts
	console.log('calling /workouts to list user workouts...');
	const userWorkouts = await handleResponse(await fetch(`${baseUrl}/workouts/workouts`, {
		method: 'GET',
		headers: { 'authorization': token }
	}));
	console.log('retrieved user workouts:');
	console.dir(userWorkouts, { depth: 5 });
}

// insertWorkouts(5)
insertWorkouts(5, "main@ion606.com", "password")