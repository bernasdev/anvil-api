import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod/v4";

import { WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { CreateWorkoutPlan } from "../usecases/CreateWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "AI Chat with Personal Trainer",
      body: z.object({
        messages: z.array(z.any()),
      }),
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply
          .status(401)
          .send({ error: "unauthorized", code: "UNAUTHORIZED" });
      }

      const { messages } = request.body as { messages: UIMessage[] };

      const result = streamText({
        model: google('gemini-2.5-flash'),
        system: `Você é um personal trainer virtual especialista em montagem de planos de treino.
Seu tom é amigável, motivador e você usa linguagem simples, sem jargões técnicos, pois seu público é leigo em musculação.

REGRAS OBRIGATÓRIAS:
1. SEMPRE chame a tool 'getUserTrainData' no início de qualquer interação para conhecer o usuário.
2. Se 'getUserTrainData' retornar null:
   - Pergunte em uma única mensagem: nome, peso (em kg), altura (em cm), idade e % de gordura corporal.
   - Seja direto e simples.
   - Após receber os dados, use a tool 'updateUserTrainData'. IMPORTANTE: Converta o peso de kg para gramas (multiplique por 1000) antes de enviar para a tool.
3. Se o usuário já tem dados:
   - Cumprimente-o pelo nome.
4. Para criar um plano de treino:
   - Pergunte: objetivo, dias disponíveis por semana e restrições físicas/lesões.
   - Seja direto e simples.
5. Ao montar o plano:
   - O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY).
   - Dias sem treino: 'isRestDay: true', 'exercises: []', 'estimatedDurationInSeconds: 0'.
   - Escolha a divisão (split) adequada com base nos dias disponíveis:
     - 2-3 dias/semana: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
     - 4 dias/semana: Upper/Lower (superior 2x, inferior 2x) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
     - 5 dias/semana: PPLUL — Push/Pull/Legs + Upper/Lower
     - 6 dias/semana: PPL 2x — Push/Pull/Legs repetido
   - Princípios gerais:
     - Músculos sinérgicos juntos (peito+tríceps, costas+bíceps).
     - Exercícios compostos primeiro, isoladores depois.
     - 4 a 8 exercícios por sessão.
     - 3-4 séries por exercício. 8-12 reps (hipertrofia), 4-6 reps (força).
     - Descanso: 60-90s (hipertrofia), 2-3min (compostos pesados).
     - Evite treinar o mesmo grupo muscular em dias consecutivos.
     - Nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso").
6. Imagens de capa (coverImageUrl):
   - SEMPRE forneça um 'coverImageUrl' para cada dia de treino.
   - Dias majoritariamente superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body) ou descanso:
     - 'https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v'
     - 'https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL'
   - Dias majoritariamente inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
     - 'https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj'
     - 'https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY'
   - Alterne entre as duas opções de cada categoria para variar.
7. Respostas curtas e objetivas.`,
        messages: await convertToModelMessages(messages),
        tools: {
          getUserTrainData: tool({
            description:
              "Retorna os dados de treino do usuário (peso, altura, idade, etc).",
            inputSchema: z.object({}),
            execute: async () => {
              const usecase = new GetUserTrainData();
              return await usecase.execute(session.user.id);
            },
          }),
          updateUserTrainData: tool({
            description: "Cria ou atualiza os dados de treino do usuário.",
            inputSchema: z.object({
              weightInGrams: z.number().int().describe("Peso em gramas"),
              heightInCentimeters: z
                .number()
                .int()
                .describe("Altura em centímetros"),
              age: z.number().int().describe("Idade"),
              bodyFatPercentage: z
                .number()
                .int()
                .describe("Percentual de gordura corporal (0 a 100)"),
            }),
            execute: async (input) => {
              const usecase = new UpsertUserTrainData();
              return await usecase.execute({
                userId: session.user.id,
                ...input,
              });
            },
          }),
          getWorkoutPlans: tool({
            description: "Lista os planos de treino do usuário.",
            inputSchema: z.object({}),
            execute: async () => {
              const usecase = new ListWorkoutPlans();
              return await usecase.execute({ userId: session.user.id });
            },
          }),
          createWorkoutPlan: tool({
            description: "Cria um novo plano de treino completo.",
            inputSchema: z.object({
              name: z.string().describe("Nome do plano de treino"),
              workoutDays: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                    weekDay: z.enum(WeekDay).describe("Dia da semana"),
                    isRestDay: z
                      .boolean()
                      .describe(
                        "Se é dia de descanso (true) ou treino (false)",
                      ),
                    estimatedDurationInSeconds: z
                      .number()
                      .describe(
                        "Duração estimada em segundos (0 para descanso)",
                      ),
                    coverImageUrl: z
                      .string()
                      .url()
                      .describe("URL da imagem de capa"),
                    exercises: z
                      .array(
                        z.object({
                          order: z.number().min(0),
                          name: z.string().trim().min(1),
                          sets: z.number().min(1),
                          reps: z.number().min(1),
                          restTimeInSeconds: z.number().min(1),
                        }),
                      )
                      .describe(
                        "Lista de exercícios (vazia para dias de descanso)",
                      ),
                  }),
                )
                .describe(
                  "Array com exatamente 7 dias de treino (MONDAY a SUNDAY)",
                ),
            }),
            execute: async (input) => {
              const usecase = new CreateWorkoutPlan();
              return await usecase.execute({
                userId: session.user.id,
                ...input,
              });
            },
          }),
        },
        stopWhen: stepCountIs(5),
      });

      const response = result.toUIMessageStreamResponse();
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body);
    },
  });
};
