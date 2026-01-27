import { randomUUID } from "crypto";
import type { Client } from "@libsql/client";

const SESSION_DAYS = 30;

export const createSession = async (database: Client, userId: string) => {
  const token = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(createdAt.getDate() + SESSION_DAYS);

  await database.execute({
    sql: "INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, createdAt.toISOString(), expiresAt.toISOString()],
  });

  return { token, expiresAt };
};
