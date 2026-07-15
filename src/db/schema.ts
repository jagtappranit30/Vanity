import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table mapping Firebase Auth UIDs
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assessments table storing full assessment metadata, metrics, and scoring breakdowns
export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(),
  userUid: text("user_uid")
    .references(() => users.uid)
    .notNull(),
  date: text("date").notNull(),
  companyName: text("company_name").notNull(),
  sector: text("sector").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  metrics: jsonb("metrics").notNull(),
  scores: jsonb("scores").notNull(),
  benchmarks: jsonb("benchmarks").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  assessments: many(assessments),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  user: one(users, {
    fields: [assessments.userUid],
    references: [users.uid],
  }),
}));
