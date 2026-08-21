import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { quotes, quoteItems, products, customers } from '../db/schema';
import type { QuoteStatus } from '../db/schema/sales/quotes';
import { AppError } from '../lib/app-error';

// ─── types ────────────────────────────────────────────────────────────────────

export interface QuoteItemInput {
  productId:    string;
  displayName?: string | null; // defaults to product name if omitted
  quantity:     number;
  unitPrice?:   number | null;
  notes?:       string | null;
}

export interface CreateQuoteInput {
  customerId?: string | null;
  notes?:      string | null;
  validUntil?: string | null;
  items:       QuoteItemInput[];
}

export interface UpdateQuoteInput {
  customerId?: string | null;
  notes?:      string | null;
  validUntil?: string | null;
  status?:     QuoteStatus;
}

// ─── quote number generator ───────────────────────────────────────────────────

async function nextQuoteNumber(): Promise<string> {
  const prefix = `QT-${new Date().getFullYear()}-`;
  const all = await db.select({ quoteNumber: quotes.quoteNumber })
    .from(quotes)
    .orderBy(desc(quotes.createdAt));

  const nums = all
    .filter((r) => r.quoteNumber.startsWith(prefix))
    .map((r) => parseInt(r.quoteNumber.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

// ─── row → quote shape ────────────────────────────────────────────────────────

type RawQuoteRow = {
  id: string; quoteNumber: string; status: string; notes: string | null;
  validUntil: string | null; createdAt: Date; updatedAt: Date; createdBy: string | null;
  customerId: string | null; customerName: string | null;
  itemId: string | null; itemProductId: string | null; itemDisplayName: string | null;
  itemProductSku: string | null; itemQuantity: number | null; itemUnitPrice: number | null;
  itemTotalAmount: number | null; itemNotes: string | null;
};

function groupRows(rows: RawQuoteRow[]) {
  const quoteMap = new Map<string, ReturnType<typeof buildQuoteSummary>>();
  for (const row of rows) {
    if (!quoteMap.has(row.id)) quoteMap.set(row.id, buildQuoteSummary(row));
    if (row.itemId) {
      quoteMap.get(row.id)!.items.push({
        id:          row.itemId,
        productId:   row.itemProductId!,
        displayName: row.itemDisplayName ?? '—',
        productSku:  row.itemProductSku,
        quantity:    row.itemQuantity!,
        unitPrice:   row.itemUnitPrice,
        totalAmount: row.itemTotalAmount,
        notes:       row.itemNotes,
      });
    }
  }
  return Array.from(quoteMap.values()).map(decorateQuote);
}

function buildQuoteSummary(row: RawQuoteRow) {
  return {
    id:          row.id,
    quoteNumber: row.quoteNumber,
    status:      row.status as QuoteStatus,
    notes:       row.notes,
    validUntil:  row.validUntil,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
    createdBy:   row.createdBy,
    customerId:  row.customerId,
    customerName: row.customerName,
    items: [] as {
      id: string; productId: string; displayName: string; productSku: string | null;
      quantity: number; unitPrice: number | null; totalAmount: number | null; notes: string | null;
    }[],
  };
}

function decorateQuote<T extends ReturnType<typeof buildQuoteSummary>>(quote: T) {
  const totalAmount = quote.items.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const itemCount    = quote.items.length;
  return { ...quote, totalAmount, itemCount };
}

// ─── shared select columns ────────────────────────────────────────────────────

const QUOTE_SELECT = {
  id:              quotes.id,
  quoteNumber:     quotes.quoteNumber,
  status:          quotes.status,
  notes:           quotes.notes,
  validUntil:      quotes.validUntil,
  createdAt:       quotes.createdAt,
  updatedAt:       quotes.updatedAt,
  createdBy:       quotes.createdBy,
  customerId:      quotes.customerId,
  customerName:    customers.companyName,
  itemId:          quoteItems.id,
  itemProductId:   quoteItems.productId,
  itemDisplayName: quoteItems.displayName,
  itemProductSku:  products.sku,
  itemQuantity:    quoteItems.quantity,
  itemUnitPrice:   quoteItems.unitPrice,
  itemTotalAmount: quoteItems.totalAmount,
  itemNotes:       quoteItems.notes,
} as const;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listQuotes(customerId?: string) {
  if (customerId) {
    const idRows = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.customerId, customerId));

    if (idRows.length === 0) return [];

    const ids = idRows.map((r) => r.id);
    const rows = await db
      .select(QUOTE_SELECT)
      .from(quotes)
      .leftJoin(customers, eq(customers.id, quotes.customerId))
      .leftJoin(quoteItems, eq(quoteItems.quoteId, quotes.id))
      .leftJoin(products, eq(products.id, quoteItems.productId))
      .where(inArray(quotes.id, ids))
      .orderBy(desc(quotes.createdAt));
    return groupRows(rows as unknown as RawQuoteRow[]);
  }

  const rows = await db
    .select(QUOTE_SELECT)
    .from(quotes)
    .leftJoin(customers, eq(customers.id, quotes.customerId))
    .leftJoin(quoteItems, eq(quoteItems.quoteId, quotes.id))
    .leftJoin(products, eq(products.id, quoteItems.productId))
    .orderBy(desc(quotes.createdAt));
  return groupRows(rows as unknown as RawQuoteRow[]);
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getQuoteById(id: string) {
  const rows = await db
    .select(QUOTE_SELECT)
    .from(quotes)
    .leftJoin(customers, eq(customers.id, quotes.customerId))
    .leftJoin(quoteItems, eq(quoteItems.quoteId, quotes.id))
    .leftJoin(products, eq(products.id, quoteItems.productId))
    .where(eq(quotes.id, id))
    .orderBy(quoteItems.createdAt);

  if (rows.length === 0) throw new AppError('Quote not found', 404);
  const grouped = groupRows(rows as unknown as RawQuoteRow[]);
  return grouped[0];
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createQuote(input: CreateQuoteInput, createdBy?: string) {
  if (!input.items || input.items.length === 0) {
    throw new AppError('At least one item is required', 400);
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const productRows = await db.select({ id: products.id, name: products.name })
    .from(products).where(inArray(products.id, productIds));
  const nameById = new Map(productRows.map((p) => [p.id, p.name]));

  const quoteNumber = await nextQuoteNumber();

  const [quote] = await db.insert(quotes).values({
    quoteNumber,
    customerId: input.customerId ?? null,
    status:     'draft',
    notes:      input.notes ?? null,
    validUntil: input.validUntil ?? null,
    createdBy:  createdBy ?? null,
  }).returning();

  await db.insert(quoteItems).values(
    input.items.map((item) => ({
      quoteId:     quote.id,
      productId:   item.productId,
      displayName: item.displayName?.trim() || nameById.get(item.productId) || 'Item',
      quantity:    item.quantity,
      unitPrice:   item.unitPrice ?? null,
      totalAmount: item.unitPrice != null ? item.quantity * item.unitPrice : null,
      notes:       item.notes ?? null,
    }))
  );

  return getQuoteById(quote.id);
}

// ─── add a single item (e.g. directly from the BOM calculator) ───────────────

export async function addQuoteItem(quoteId: string, item: QuoteItemInput) {
  const existing = await getQuoteById(quoteId);
  if (existing.status !== 'draft') {
    throw new AppError('Only draft quotes can be modified', 400);
  }

  let displayName = item.displayName?.trim();
  if (!displayName) {
    const [product] = await db.select({ name: products.name }).from(products)
      .where(eq(products.id, item.productId)).limit(1);
    displayName = product?.name ?? 'Item';
  }

  await db.insert(quoteItems).values({
    quoteId,
    productId:   item.productId,
    displayName,
    quantity:    item.quantity,
    unitPrice:   item.unitPrice ?? null,
    totalAmount: item.unitPrice != null ? item.quantity * item.unitPrice : null,
    notes:       item.notes ?? null,
  });

  return getQuoteById(quoteId);
}

export async function removeQuoteItem(quoteId: string, itemId: string) {
  const existing = await getQuoteById(quoteId);
  if (existing.status !== 'draft') {
    throw new AppError('Only draft quotes can be modified', 400);
  }
  const item = existing.items.find((i) => i.id === itemId);
  if (!item) throw new AppError('Item not found on this quote', 404);

  await db.delete(quoteItems).where(eq(quoteItems.id, itemId));
  return getQuoteById(quoteId);
}

// ─── update quote-level fields ────────────────────────────────────────────────

export async function updateQuote(id: string, input: UpdateQuoteInput) {
  const existing = await getQuoteById(id);

  if (input.status) {
    if (!validTransition(existing.status, input.status)) {
      throw new AppError(`Cannot transition from '${existing.status}' to '${input.status}'`, 400);
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.customerId !== undefined) patch.customerId = input.customerId;
  if (input.notes      !== undefined) patch.notes      = input.notes;
  if (input.validUntil !== undefined) patch.validUntil = input.validUntil;
  if (input.status     !== undefined) patch.status     = input.status;

  await db.update(quotes).set(patch).where(eq(quotes.id, id));

  return getQuoteById(id);
}

function validTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  const allowed: Record<QuoteStatus, QuoteStatus[]> = {
    draft:    ['sent', 'rejected'],
    sent:     ['accepted', 'rejected', 'expired'],
    accepted: [],
    rejected: [],
    expired:  [],
  };
  return allowed[from].includes(to);
}
