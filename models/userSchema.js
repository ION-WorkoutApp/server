import mongoose from "mongoose";

// schema
export const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    height: { type: Number, required: true },           // in centimeters
    weight: { type: Number, required: true },           // in kilograms
    fitnessGoal: { type: String, required: true },
    preferredWorkoutType: { type: String, required: true },
    comfortLevel: { type: String, required: true },
    refreshToken: { type: String, required: false },
    workouts: { type: [mongoose.Schema.Types.ObjectId], ref: 'Workout', default: [] },
    savedWorkouts: { type: [mongoose.Schema.Types.ObjectId], ref: 'Workout', default: [] },
});


// model
export const User = mongoose.model('User', userSchema);
