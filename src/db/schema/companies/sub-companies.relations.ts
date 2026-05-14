import { relations } from 'drizzle-orm';
import { subCompanies } from './sub-companies';
import { subCompanyUsers } from './sub-company-users';

export const subCompaniesRelations = relations(subCompanies, ({ many }) => ({
  subCompanyUsers: many(subCompanyUsers),
}));
