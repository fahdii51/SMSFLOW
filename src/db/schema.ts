// src/db/schema.ts
import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, doublePrecision, boolean } from 'drizzle-orm/pg-core';

// Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or internal unique ID
  email: text('email').notNull(),
  fullName: text('full_name'),
  role: text('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Wallets Table
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  balance: doublePrecision('balance').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// SMS Activations Table
export const activations = pgTable('activations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  service: text('service').notNull(),
  serviceName: text('service_name').notNull(),
  activationId: text('activation_id').notNull(),
  phoneNumber: text('phone_number').notNull(),
  costUsd: doublePrecision('cost_usd'),
  sellingPrice: doublePrecision('selling_price').notNull(),
  status: text('status').notNull(), // 'waiting', 'code_received', 'completed', 'cancelled'
  otpCode: text('otp_code'),
  provider: text('provider').default('smsbower').notNull(),
  token: text('token').notNull(),
  shortUrl: text('short_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Mail Activations Table
export const mailActivations = pgTable('mail_activations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  service: text('service').notNull(),
  serviceName: text('service_name').notNull(),
  mailId: text('mail_id').notNull(),
  mailAddress: text('mail_address').notNull(),
  domain: text('domain'),
  sellingPrice: doublePrecision('selling_price').notNull(),
  status: text('status').notNull(),
  code: text('code'),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deposit Requests Table
export const depositRequests = pgTable('deposit_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: doublePrecision('amount').notNull(),
  method: text('method').notNull(),
  txnId: text('txn_id').notNull(),
  screenshotUrl: text('screenshot_url'),
  status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Facebook IDs Inventory Table
export const facebookIds = pgTable('facebook_ids', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull(),
  password: text('password').notNull(),
  status: text('status').default('available').notNull(), // 'available', 'sold'
  soldToUserId: integer('sold_to_user_id').references(() => users.id),
  soldDate: timestamp('sold_date'),
  price: doublePrecision('price').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Settings Table
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  activations: many(activations),
  mailActivations: many(mailActivations),
  depositRequests: many(depositRequests),
  facebookPurchases: many(facebookIds),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const activationsRelations = relations(activations, ({ one }) => ({
  user: one(users, {
    fields: [activations.userId],
    references: [users.id],
  }),
}));

export const mailActivationsRelations = relations(mailActivations, ({ one }) => ({
  user: one(users, {
    fields: [mailActivations.userId],
    references: [users.id],
  }),
}));

export const depositRequestsRelations = relations(depositRequests, ({ one }) => ({
  user: one(users, {
    fields: [depositRequests.userId],
    references: [users.id],
  }),
}));

export const facebookIdsRelations = relations(facebookIds, ({ one }) => ({
  buyer: one(users, {
    fields: [facebookIds.soldToUserId],
    references: [users.id],
  }),
}));
