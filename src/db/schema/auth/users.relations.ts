import { relations } from 'drizzle-orm';
import { users } from './users';
import { subCompanyUsers } from '../companies/sub-company-users';

export const usersRelations = relations(users, ({ many }) => ({
  subCompanyUsers: many(subCompanyUsers),
}));
