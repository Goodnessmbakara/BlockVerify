import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  universityName: text("university_name"),
});

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").notNull(),
  universityId: integer("university_id").notNull(),
  credentialType: text("credential_type").notNull(),
  hash: text("hash").notNull(),
  transactionId: text("transaction_id").notNull(),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  universityName: true,
});

export const insertCredentialSchema = createInsertSchema(credentials);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
