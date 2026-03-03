import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      id: z.uuid().optional(),
      name: z.string().trim().min(1),
      weekDay: z.nativeEnum(WeekDay),
      isRestDay: z.boolean().default(false),
      estimatedDurationInSeconds: z.number().min(1),
      coverImageUrl: z.url().optional(),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});

export const WorkoutSessionResponseSchema = z.object({
  userWorkoutSessionId: z.uuid(),
});

export const UpdateWorkoutSessionSchema = z.object({
  completedAt: z.iso.datetime({offset: true}),
});

export const WorkoutSessionUpdatedResponseSchema = z.object({
  id: z.uuid(),
  completedAt: z.iso.datetime({offset:true}),
  startedAt: z.iso.datetime({offset:true}),
  userWorkoutSessionId: z.uuid(),
});
