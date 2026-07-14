import { pgTable, uuid, varchar, pgEnum, timestamp } from 'drizzle-orm/pg-core';

export const attributeDataTypeEnum = pgEnum('attribute_data_type', ['string', 'number']);

export const attributes = pgTable('attributes', {
  id:       uuid('id').primaryKey().defaultRandom(),
  name:     varchar('name', { length: 255 }).notNull(),
  unit:     varchar('unit', { length: 50 }),       // e.g. "kg", "m", "mm²", "kg/m³"
  dataType: attributeDataTypeEnum('data_type').notNull().default('number'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Attribute    = typeof attributes.$inferSelect;
export type NewAttribute = typeof attributes.$inferInsert;
