import { prisma } from "../lib/db.js";

interface OutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number; // 0 a 100
}

export class GetUserTrainData {
  async execute(userId: string): Promise<OutputDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        weigthInGrams: true,
        heightInCentimeters: true,
        age: true,
        bodyFatPercentage: true,
      },
    });

    if (!user || user.weigthInGrams === null) {
      return null;
    }

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams: user.weigthInGrams,
      heightInCentimeters: user.heightInCentimeters!,
      age: user.age!,
      bodyFatPercentage: user.bodyFatPercentage ?? 0,
    };
  }
}
