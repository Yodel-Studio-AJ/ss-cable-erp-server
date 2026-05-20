import { relations } from 'drizzle-orm';
import { customers } from './customers';
import { customerContacts } from './customer-contacts';

export const customersRelations = relations(customers, ({ many }) => ({
  contacts: many(customerContacts),
}));

export const customerContactsRelations = relations(customerContacts, ({ one }) => ({
  customer: one(customers, {
    fields: [customerContacts.customerId],
    references: [customers.id],
  }),
}));
