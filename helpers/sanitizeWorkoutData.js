export const sanitizeWorkouts = (workouts) => {
    return workouts.map(workout => {
        const {
            _id,
            supersets,
            isSaved,
            createdAt,
            updatedAt,
            ...restWorkout
        } = workout;

        const sanitizedSupersets = supersets.map(superset => {
            const { 
                id, 
                exercises 
            } = superset;

            const sanitizedExercises = exercises.map(exInst => {
                const { 
                    id: exId,
                    reps,
                    times,
                    weight,
                    exercise,
                    ...restExerciseInstance 
                } = exInst;

                return {
                    uid: exInst.uid,
                    exerciseId: exercise._id,
                    customExercise: exInst.customExercise,
                    sets: exInst.sets,
                    setsDone: exInst.setsDone,
                    reps: reps.map(rep => rep.value),
                    times: times.map(time => time.value),
                    weight: weight.map(w => w.value),
                    restTime: exInst.restTime,
                };
            });

            return {
                uid: superset.uid,
                restTime: superset.restTime,
                exercises: sanitizedExercises,
            };
        });

        return {
            uid: workout.uid,
            workoutName: restWorkout.workoutName,
            totalTime: restWorkout.totalTime,
            workoutTime: restWorkout.workoutTime,
            restTime: restWorkout.restTime,
            supersets: sanitizedSupersets,
            createdAt,
            updatedAt,
        };
    });
};
