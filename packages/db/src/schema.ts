import {
  pgEnum,
  pgSchema,
  pgTable,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import type { ServerAuth } from '@adaptivegate/shared';

// Dimensions for the local embedding model (Xenova/all-MiniLM-L6-v2) — if the
// model ever changes, this (and a migration) need to change with it.
export const EMBEDDING_DIMENSIONS = 384;

// Mirrors packages/shared's Zod schemas 1:1 — one source of truth per entity,
// just expressed twice (runtime validation vs. storage), as CLAUDE.md requires.

// Minimal reference into Supabase Auth's own schema, so `users.id` can match
// the id Supabase issues — we don't own or migrate this table.
const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  hashedKey: text('hashed_key').notNull(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  auth: jsonb('auth').notNull().$type<ServerAuth>(),
  enabledTools: jsonb('enabled_tools').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  yaml: text('yaml').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const toolEmbeddings = pgTable(
  'tool_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serverId: uuid('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    // Denormalized from servers.userId so every query can scope by user ID
    // directly, per CLAUDE.md's convention, without an extra join.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    description: text('description').notNull(),
    inputSchema: jsonb('input_schema').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: text('embedding_model').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.serverId, table.toolName)],
);

export const eventType = pgEnum('event_type', [
  'tool_call',
  'policy_decision',
  'recovery_attempt',
  'approval_decision',
]);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: eventType('type').notNull(),
  // Append-only: no update/delete path should ever target this table.
  payload: jsonb('payload').notNull(),
  // Hash chain is scoped per user (not global) — see
  // apps/server/src/governance/auditLog.ts. previousHash is null only for
  // the first event in a given user's chain.
  hash: text('hash').notNull(),
  previousHash: text('previous_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
