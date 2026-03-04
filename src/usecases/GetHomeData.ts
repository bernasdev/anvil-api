import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import weekday from "dayjs/plugin/weekday.js";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);
dayjs.extend(weekday);

interface InputDto {
  userId: string;
  date: string; // YYYY-MM-DD
}

interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string | null;
    exercisesCount: number;
  } | null;
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const targetDate = dayjs.utc(dto.date).startOf("day");
    const weekDayOfTargetDate = targetDate
      .format("dddd")
      .toUpperCase() as WeekDay;

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: dto.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          include: {
            exercises: true,
          },
        },
      },
    });

    if (!activeWorkoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWorkoutDay = activeWorkoutPlan.workoutDays.find(
      (day) => day.weekDay === weekDayOfTargetDate,
    );

    const todayWorkoutDayFormatted = todayWorkoutDay
      ? {
          workoutPlanId: todayWorkoutDay.workoutPlanId,
          id: todayWorkoutDay.id,
          name: todayWorkoutDay.name,
          isRest: todayWorkoutDay.isRestDay,
          weekDay: todayWorkoutDay.weekDay,
          estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
          coverImageUrl: todayWorkoutDay.coverImageUrl,
          exercisesCount: todayWorkoutDay.exercises.length,
        }
      : null;

    // Calculate Consistency for the current week (Sunday to Saturday)
    const startOfWeek = targetDate.startOf("week"); // Default is Sunday
    const endOfWeek = targetDate.endOf("week"); // Default is Saturday

    const sessionsThisWeek = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        startedAt: {
          gte: startOfWeek.toDate(),
          lte: endOfWeek.toDate(),
        },
      },
    });

    const consistencyByDay: OutputDto["consistencyByDay"] = {};
    for (let i = 0; i < 7; i++) {
      const currentDay = startOfWeek.add(i, "day");
      const dayKey = currentDay.format("YYYY-MM-DD");
      
      const sessionsForDay = sessionsThisWeek.filter((s) =>
        dayjs.utc(s.startedAt).isSame(currentDay, "day"),
      );

      consistencyByDay[dayKey] = {
        workoutDayStarted: sessionsForDay.length > 0,
        workoutDayCompleted: sessionsForDay.some((s) => s.completedAt !== null),
      };
    }

    // Calculate Streak: Consecutive days with at least one completed session
    const workoutStreak = await this.calculateStreak(dto.userId);

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: todayWorkoutDayFormatted,
      workoutStreak,
      consistencyByDay,
    };
  }

  private async calculateStreak(userId: string): Promise<number> {
    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId,
          },
        },
        completedAt: {
          not: null,
        },
      },
      orderBy: {
        completedAt: "desc",
      },
      select: {
        completedAt: true,
      },
    });

    if (sessions.length === 0) return 0;

    // Get unique completed days in descending order
    const completedDays = Array.from(
      new Set(
        sessions.map((s) => dayjs.utc(s.completedAt).startOf("day").valueOf()),
      ),
    ).sort((a, b) => b - a);

    const today = dayjs.utc().startOf("day");
    const yesterday = today.subtract(1, "day");

    let currentStreakDate = dayjs.utc(completedDays[0]);

    // If the most recent completion is not today or yesterday, streak is 0
    if (
      !currentStreakDate.isSame(today, "day") &&
      !currentStreakDate.isSame(yesterday, "day")
    ) {
      return 0;
    }

    let streak = 1;
    for (let i = 1; i < completedDays.length; i++) {
      const previousDay = dayjs.utc(completedDays[i]);
      const expectedDate = currentStreakDate.subtract(1, "day");

      if (previousDay.isSame(expectedDate, "day")) {
        streak++;
        currentStreakDate = previousDay;
      } else {
        break;
      }
    }

    return streak;
  }
}
