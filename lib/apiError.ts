import { Prisma } from "@prisma/client";

type ApiErrorPayload = {
  status: number;
  message: string;
};

export function toApiError(error: unknown, fallbackMessage = "Internal server error"): ApiErrorPayload {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return {
        status: 503,
        message: "Database schema is outdated. Run prisma migrate deploy."
      };
    }

    if (error.code === "P2025") {
      return {
        status: 404,
        message: "Not found"
      };
    }
  }

  return {
    status: 500,
    message: fallbackMessage
  };
}
