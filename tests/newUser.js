const val = {
    "name": "Name Here",
    "email": "ion606@protonmail.com",
    "password": "password",
    "age": 22,
    "gender": "Male",
    "height": 202,
    "weight": 80,
    "weightUnit": "kg",
    "distanceUnit": "km",
    "fitnessGoal": "Lose Weight",
    "preferredWorkoutType": "Gym Workouts",
    "comfortLevel": "Advanced",
    "generalPreferences": {
        "activityLevel": "light",
        "preferredWorkoutTime": "no preference",
        "workoutFrequency": 5,
        "injuriesOrLimitations": [],
        "equipmentAccess": [],
        "preferredWorkoutEnvironment": "no preference"
    },
    "workoutPreferences": {
        "preferredWorkoutDuration": 30,
        "exerciseDifficulty": "beginner",
        "warmupAndCooldownPreference": true,
        "preferredWorkoutMusic": "No preference"
    },
    "progressTracking": {
        "stepGoal": 10000,
        "waterIntakeGoal": 2000,
        "sleepTracking": false
    },
    "notifications": {
        "remindersEnabled": true,
        "notificationFrequency": "daily",
        "preferredReminderTime": "08:00 AM"
    },
    "socialPreferences": {
        "socialSharing": false,
        "leaderboardParticipation": false,
        "badgesAndAchievements": []
    }
}

const r = await fetch('https://test.ion606.com/auth/initaccount', {
    body: JSON.stringify(val),
    headers: {
        'Content-Type': 'application/json'
    },
    method: 'POST'
});

console.log(await r.text());