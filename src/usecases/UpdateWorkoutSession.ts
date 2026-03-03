import { ForbiddenError, NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  sessionId: string;
  completedAt: Date;
}

interface OutputDto {
  id: string;
  completedAt: string;
  startedAt: string;
  userWorkoutSessionId: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
      select: { userId: true },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError("You are not the owner of this workout plan");
    }
    
    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day nont found");
    }


    const session = await prisma.workoutSession.findFirst({
      where: {
        id: dto.sessionId,
        workoutDayId: dto.workoutDayId,
        workoutDay: {
          workoutPlanId: dto.workoutPlanId,
        },
      },
    });

    if (!session) {
      throw new NotFoundError("Workout session not found");
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: dto.sessionId },
      data: {
        completedAt: dto.completedAt,
      },
    });

    return {
      id: updatedSession.id,
      completedAt: updatedSession.completedAt!.toISOString(),
      startedAt: updatedSession.startedAt.toISOString(),
      userWorkoutSessionId: updatedSession.id,
    };
  }
}
