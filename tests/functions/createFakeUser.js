import fetch from 'node-fetch';
import fs from 'fs';

export const baseUrl = 'http://test.ion606.com';
export const defaultPassword = 'testpass123';

if (!(await fetch(baseUrl)).ok) throw 'SERVER UNREACHABLE';

function generateRandomEmail() {
	const randomPart = Math.random().toString(36).substring(2, 8);
	return `fakeuser_${randomPart}@example.com`;
}

export async function handleResponse(response) {
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${response.status} - ${response.statusText}: ${text}`);
	}
	return response.json().catch(() => ({}));
}

export async function getCategories(token, field) {
	const queryParams = new URLSearchParams({
		field
	});
	const url = `${baseUrl}/exercises/categories?${queryParams.toString()}`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'authorization': token
		}
	});
	if (!response.ok) {
		throw new Error(`${response.status} - ${response.statusText}`);
	}
	return await response.json();
}


export async function getExercisesForMuscleGroup(token, muscleGroup) {
	const url = `${baseUrl}/exercises/exercises?muscleGroup=${muscleGroup}`;
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'authorization': token
		}
	});
	if (!response.ok) {
		throw new Error(`${response.status} - ${response.statusText}`);
	}
	return await response.json();
}

// helper to generate a random id string
const randomId = () => Math.random().toString(36).substring(2, 10);

// helper to shuffle an array and return the first n elements
function getRandomElements(arr, n) {
	const shuffled = arr.slice().sort(() => 0.5 - Math.random());
	return shuffled.slice(0, n);
}


function generateRandomInset() {
	// generate a random count between 1 and 3 insets
	const insetCount = Math.floor(Math.random() * 3) + 1;
	const insets = [];
	for (let i = 0; i < insetCount; i++) {
		insets.push({
			id: randomId(),
			isDone: Math.random() < 0.5,
			restTime: Math.floor(Math.random() * 100) + 1, // rest time between 1 and 100
			distance: Math.random() < 0.5 ? null : Math.floor(Math.random() * 1000), // either null or a random distance
			value: Math.floor(Math.random() * 50) + 1, // value between 1 and 50
		});
	}
	return insets;
}

// each containing between 1 and 3 random exercises
export async function generateSampleWorkout(token) {
	const categoriesResponse = await getCategories(token, 'bodyPart');

	const categories = categoriesResponse.categories;
	if (!categories || categories.length === 0) {
		throw new Error('no muscle group categories available');
	}

	const randomMuscleGroup = categories[Math.floor(Math.random() * categories.length)];
	console.log(`selected muscle group: ${randomMuscleGroup}`);

	const exercisesResponse = await getExercisesForMuscleGroup(token, randomMuscleGroup);

	const exercises = exercisesResponse.exercises;
	if (!exercises || exercises.length === 0) {
		throw new Error(`no exercises available for muscle group: ${randomMuscleGroup}`);
	}

	// generate a random number of supersets (say 1 to 4 for variety)
	const supersetCount = Math.floor(Math.random() * 4) + 1;
	const supersets = [];

	for (let i = 0; i < supersetCount; i++) {
		// each superset can have 1 to 3 random exercises
		const exerciseCount = Math.max(1, Math.floor(Math.random() * 4));
		const chosenExercises = getRandomElements(exercises, exerciseCount);
		const supersetExercises = [];

		chosenExercises.forEach(chosenExercise => {
			supersetExercises.push({
				exercise: chosenExercise,
				id: `${chosenExercise.exerciseId}_${randomId()}`,
				isDone: false,
				inset: generateRandomInset(),
				weight: generateRandomInset(),
				restTime: Math.floor(Math.random() * 90) + 30, // 30 to 120 seconds
				sets: Math.floor(Math.random() * 3) + 1,       // 1 to 3 sets
				setsDone: 0,
				calories: 0,
				duration: Math.floor(Math.random() * 60) + 20  // 20 to 80 seconds
			});
		});

		supersets.push({
			currentExerciseIndex: 0,
			exercises: supersetExercises,
			id: `sup_${randomId()}`,
			isDone: false,
			isSingleExercise: supersetExercises.length <= 1
		});
	}

	// build sample workout object
	const workout = {
		workoutName: `Workout for ${randomMuscleGroup}`,
		supersets,
		totalTime: Math.floor(Math.random() * 60) + 20,  // total time between 20 and 80 minutes
		workoutTime: Math.floor(Math.random() * 60) + 20,  // workout time between 20 and 80 minutes
		isSaved: false,
		calories: Math.floor(Math.random() * 500) + 100    // calories between 100 and 600
	};

	return workout;
}

export async function createFakeUser() {
	try {
		// generate random email
		const email = generateRandomEmail();
		console.log(`\n--- starting flow with random email: ${email} ---\n`);

		fs.appendFile('temp.txt', `${email}, `, () => null) //fakeuser_eovq97@example.com

		// dummy data, setting the program to debug mode will bypass this
		const code = '123456';

		// call /initaccount to actually create the user
		console.log('calling /initaccount...');
		await handleResponse(await fetch(`${baseUrl}/auth/initaccount`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email,
				code,
				password: defaultPassword,
				name: 'John Doe',
				age: 25,
				gender: 'male',
				height: 175,
				weight: 70,
				weightUnit: 'kg',
				distanceUnit: 'km',
				fitnessGoal: 'muscle building',
				preferredWorkoutType: 'strength training',
				comfortLevel: 'moderate',
				generalPreferences: {
					activityLevel: 'moderate',
					preferredWorkoutTime: 'morning',
					workoutFrequency: 3
				}
			})
		}));
		console.log('account created successfully.');

		// log in with /checkcredentials to get a token
		console.log('calling /checkcredentials...');
		const loginRes = await handleResponse(await fetch(`${baseUrl}/auth/checkcredentials`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email,
				password: defaultPassword
			})
		}));
		const token = loginRes.token;
		console.log(`user logged in, got token: ${token}`);

		console.log('\n--- done! ---\n');
		return token
	} catch (err) {
		console.error(err);
		return false
	}
}
