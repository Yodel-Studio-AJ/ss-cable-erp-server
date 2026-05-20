import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { customers, customerContacts } from '../db/schema';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../lib/jwt';

// ─── customers ────────────────────────────────────────────────────────────────

export async function getCustomers() {
  return db.select().from(customers).orderBy(customers.companyName);
}

export async function getCustomerById(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw new AppError('Customer not found', 404);

  const contacts = await db
    .select()
    .from(customerContacts)
    .where(eq(customerContacts.customerId, id))
    .orderBy(customerContacts.isPrimary);

  return { ...customer, contacts };
}

export interface CreateCustomerInput {
  companyName: string;
  industry?:   string;
  gstin?:      string;
  address?:    string;
  city?:       string;
  state?:      string;
  pincode?:    string;
  notes?:      string;
}

export async function createCustomer(input: CreateCustomerInput, caller: AccessTokenPayload) {
  const [created] = await db
    .insert(customers)
    .values({ ...input, createdByUserId: caller.userId })
    .returning();
  return created;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!existing) throw new AppError('Customer not found', 404);

  const [updated] = await db
    .update(customers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();
  return updated;
}

export async function deleteCustomer(id: string) {
  const [existing] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!existing) throw new AppError('Customer not found', 404);
  await db.delete(customers).where(eq(customers.id, id));
}

// ─── contacts ─────────────────────────────────────────────────────────────────

export interface CreateContactInput {
  name:         string;
  phone?:       string;
  email?:       string;
  designation?: string;
  isPrimary?:   boolean;
}

export async function getContacts(customerId: string) {
  const [cust] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) throw new AppError('Customer not found', 404);

  return db
    .select()
    .from(customerContacts)
    .where(eq(customerContacts.customerId, customerId))
    .orderBy(customerContacts.isPrimary);
}

export async function addContact(customerId: string, input: CreateContactInput) {
  const [cust] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) throw new AppError('Customer not found', 404);

  const [created] = await db
    .insert(customerContacts)
    .values({ customerId, ...input })
    .returning();
  return created;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export async function updateContact(contactId: string, input: UpdateContactInput) {
  const [existing] = await db.select({ id: customerContacts.id }).from(customerContacts).where(eq(customerContacts.id, contactId)).limit(1);
  if (!existing) throw new AppError('Contact not found', 404);

  const [updated] = await db
    .update(customerContacts)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(customerContacts.id, contactId))
    .returning();
  return updated;
}

export async function deleteContact(contactId: string) {
  const [existing] = await db.select({ id: customerContacts.id }).from(customerContacts).where(eq(customerContacts.id, contactId)).limit(1);
  if (!existing) throw new AppError('Contact not found', 404);
  await db.delete(customerContacts).where(eq(customerContacts.id, contactId));
}
