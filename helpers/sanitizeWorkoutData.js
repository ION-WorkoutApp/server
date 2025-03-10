export const sanitizeWorkouts = (workouts) => {	
    return workouts.map(workout => {
        const {
            supersets,
            isSaved,
            createdAt,
            updatedAt,
            calories,
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
                    inset,
                    weight,
                    exercise,
                    calories,
                    ..._ 
                } = exInst;

                return {
                    uid: exInst.uid,
                    exerciseId: exercise._id,
                    customExercise: exInst.customExercise,
                    sets: exInst.sets,
                    setsDone: exInst.setsDone,
                    inset: inset.map(i => i.value),
                    distances: (inset.at(0)?.distance) ? inset.map(i => i.distance) : null,
                    weight: weight.map(w => w.value),
                    restTime: exInst.restTime,
                    calories
                };
            });

            return {
                uid: superset.uid,
                restTime: superset.restTime,
                exercises: sanitizedExercises,
                calories
            };
        });

        return {
            _id: workout._id,
            workoutName: restWorkout.workoutName,
            totalTime: restWorkout.totalTime,
            workoutTime: restWorkout.workoutTime,
            restTime: restWorkout.restTime,
            supersets: sanitizedSupersets,
            createdAt,
            updatedAt,
            calories
        };
    });
};
