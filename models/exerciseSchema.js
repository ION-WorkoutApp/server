import mongoose from 'mongoose';


// exercise schema
export const exerciseSchema = new mongoose.Schema({
    exerciseId: { type: String, required: true, unique: true }, // unique ID for the exercise
    title: { type: String, required: true }, // name of the exercise
    description: { type: String, required: true }, // detailed description
    type: { type: String, required: true }, // type of exercise (e.g., 'Strength')
    bodyPart: { type: String, required: true }, // targeted body part
    equipment: { type: String, required: true }, // equipment used
    level: { type: String, required: true }, // difficulty level
    timeBased: { type: Boolean, required: true }, // indicates if the exercise is time-based
    perSide: { type: Boolean, required: true }, // indicates if the exercise is time-based
    rating: { type: Number, default: 0 }, // numeric rating
    ratingDescription: { type: String }, // description of the rating
    videoPath: { type: String }, // path to the exercise video
}, { timestamps: true }); // add createdAt and updatedAt timestamps


// schemas for nested properties
const metricSchema = new mongoose.Schema({
    id: { type: String, required: true },
    isDone: { type: Boolean, default: false },
    restTime: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
}, { _id: false });

// exercise instance schema
const exerciseInstanceSchema = new mongoose.Schema({
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    id: { type: String, required: true }, // unique identifier for the instance
    isDone: { type: Boolean, default: false },
    reps: { type: [metricSchema], default: [] },
    times: { type: [metricSchema], default: [] },
    weight: { type: [metricSchema], default: [] },
    restTime: { type: Number, default: 0 },
    sets: { type: Number, default: 1 },
    setsDone: { type: Number, default: 0 },
}, { _id: false });


// superset schema
const supersetSchema = new mongoose.Schema({
    currentExerciseIndex: { type: Number, default: 0 },
    exercises: { type: [exerciseInstanceSchema], required: true },
    id: { type: String, required: true },
    isDone: { type: Boolean, default: false },
    isSingleExercise: { type: Boolean, default: false },
}, { _id: false });


// main workout schema
export const workoutSchema = new mongoose.Schema({
    workoutName: { type: String, required: false },
    supersets: { type: [supersetSchema], required: true },
    totalTime: { type: Number, required: true },
    workoutTime: { type: Number, required: true },
    isSaved: { type: Boolean, default: false },
}, { timestamps: true });


// Export the models
export const Exercise = mongoose.model('Exercise', exerciseSchema);
export const Workout = mongoose.model('Workout', workoutSchema);
