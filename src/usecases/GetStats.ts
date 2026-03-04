import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { prisma } from "../lib/db.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const fromDate = dayjs.utc(dto.from).startOf("day");
    const toDate = dayjs.utc(dto.to).endOf("day");

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: {
            userId: dto.userId,
          },
        },
        createdAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
      orderBy: {
        startedAt: "asc",
      },
    });

    const consistencyByDay: OutputDto["consistencyByDay"] = {};
    let completedWorkoutsCount = 0;
    let totalTimeInSeconds = 0;

    sessions.forEach((session) => {
      const dayKey = dayjs.utc(session.startedAt).format("YYYY-MM-DD");
      
      if (!consistencyByDay[dayKey]) {
        consistencyByDay[dayKey] = {
          workoutDayStarted: false,
          workoutDayCompleted: false,
        };
      }

      consistencyByDay[dayKey].workoutDayStarted = true;
      if (session.completedAt) {
        consistencyByDay[dayKey].workoutDayCompleted = true;
        completedWorkoutsCount++;
        
        const duration = dayjs(session.completedAt).diff(dayjs(session.startedAt), "second");
        totalTimeInSeconds += duration > 0 ? duration : 0;
      }
    });

    const totalSessions = sessions.length;
    const conclusionRate = totalSessions > 0 ? completedWorkoutsCount / totalSessions : 0;

    const workoutStreak = await this.calculateStreak(dto.userId);

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
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

    const completedDays = Array.from(
      new Set(
        sessions.map((s) => dayjs.utc(s.completedAt).startOf("day").valueOf()),
      ),
    ).sort((a, b) => b - a);

    const today = dayjs.utc().startOf("day");
    const yesterday = today.subtract(1, "day");

    let currentStreakDate = dayjs.utc(completedDays[0]);

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
