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
      weekDay: z.enum(WeekDay),
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
  completedAt: z.iso.datetime({ offset: true }),
});

export const WorkoutSessionUpdatedResponseSchema = z.object({
  id: z.uuid(),
  completedAt: z.iso.datetime({ offset: true }),
  startedAt: z.iso.datetime({ offset: true }),
  userWorkoutSessionId: z.uuid(),
});

export const GetHomeDataParamsSchema = z.object({
  date: z.iso.date(),
});

export const GetHomeDataResponseSchema = z.object({
  activeWorkoutPlanId: z.uuid().optional(),
  todayWorkoutDay: z
    .object({
      workoutPlanId: z.uuid(),
      id: z.uuid(),
      name: z.string(),
      isRest: z.boolean(),
      weekDay: z.enum(WeekDay),
      estimatedDurationInSeconds: z.number(),
      coverImageUrl: z.url().optional().nullable(),
      exercisesCount: z.number(),
    })
    .optional(),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const GetWorkoutPlanResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      weekDay: z.enum(WeekDay),
      name: z.string(),
      isRest: z.boolean(),
      imageCoverUrl: z.url().optional().nullable(),
      estimatedDurationInSeconds: z.number(),
      exercisesCount: z.number(),
    }),
  ),
});

export const GetWorkoutPlansParamsSchema = z.object({
  active: z.string().transform((val) => val === "true").optional(),
});

export const GetWorkoutPlansResponseSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        weekDay: z.enum(WeekDay),
        isRest: z.boolean(),
        estimatedDurationInSeconds: z.number(),
        coverImageUrl: z.url().optional().nullable(),
        exercises: z.array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            order: z.number(),
            sets: z.number(),
            reps: z.number(),
            restTimeInSeconds: z.number(),
          }),
        ),
      }),
    ),
  }),
);

export const GetStatsParamsSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export const GetStatsResponseSchema = z.object({
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number(),
  conclusionRate: z.number(),
  totalTimeInSeconds: z.number(),
});

export const GetWorkoutDayResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isRest: z.boolean(),
  imageCoverUrl: z.url().optional().nullable(),
  estimatedDurationInSeconds: z.number(),
  exercisesCount: z.number(),
  exercises: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      order: z.number(),
      sets: z.number(),
      reps: z.number(),
      restTimeInSeconds: z.number(),
      workoutDayId: z.uuid(),
    }),
  ),
  weekDay: z.enum(WeekDay),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      workoutDayId: z.uuid(),
      startedAt: z.iso.date().optional(),
      completedAt: z.iso.date().optional(),
    }),
  ),
});

export const UserTrainDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const UpsertUserTrainDataSchema = UserTrainDataSchema.omit({
  userName: true,
});

export const GetUserTrainDataResponseSchema = UserTrainDataSchema.nullable();
