import mongoose from 'mongoose';

// Schemas
export const exerciseSchema = new mongoose.Schema({
    exerciseId: { type: String, required: true, unique: true }, // Unique ID for the exercise
    title: { type: String, required: true }, // Name of the exercise (from 'Title' column)
    description: { type: String, required: true }, // Detailed description (from 'Desc' column)
    type: { type: String, required: true }, // Type of exercise (e.g., 'Strength')
    bodyPart: { type: String, required: true }, // Targeted body part (e.g., 'Abdominals')
    equipment: { type: String, required: true }, // Equipment used (e.g., 'Bands')
    level: { type: String, required: true }, // Difficulty level (e.g., 'Intermediate')
    timeBased: { type: Boolean, required: true }, // Difficulty level (e.g., 'Intermediate')
    rating: { type: Number, default: 0 }, // Numeric rating (optional)
    ratingDescription: { type: String }, // Description of the rating (optional)
    videoPath: { type: String }, // Optional: add a path to a video if relevant
}, { timestamps: true }); // Add createdAt and updatedAt timestamps


export const workoutSchema = new mongoose.Schema({
    exercises: { type: Array, required: true },
    totalTime: { type: Number, required: true },
    workoutTime: { type: Number, required: true },
    isSaved: { type: Boolean, required: true, default: false },
    workoutName: { type: String, required: false }
}, { timestamps: true });



// Exercise Model
export const Exercise = mongoose.model('Exercise', exerciseSchema);
export const Workout = mongoose.model('Workout', workoutSchema);
