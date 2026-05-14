import { relations } from 'drizzle-orm';
import { subCompanyUsers } from './sub-company-users';
import { users } from '../auth/users';
import { subCompanies } from './sub-companies';

export const subCompanyUsersRelations = relations(subCompanyUsers, ({ one }) => ({
  user: one(users, {
    fields: [subCompanyUsers.userId],
    references: [users.id],
  }),
  subCompany: one(subCompanies, {
    fields: [subCompanyUsers.subCompanyId],
    references: [subCompanies.id],
  }),
}));
