import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroups, productGroupAttributes, attributes, productGroupInputs } from '../db/schema';
import { AppError } from '../lib/app-error';

// ─── types ────────────────────────────────────────────────────────────────────

export type ProductGroupType = 'raw_material' | 'intermediate' | 'finished_goods' | 'processed_product';
export type MaterialType     = 'metal' | 'pvc' | 'mixed';

export interface CreateProductGroupInput {
  name:         string;
  type:         ProductGroupType;
  isProcured:   boolean;
  materialType: MaterialType;
}

export type UpdateProductGroupInput = Partial<CreateProductGroupInput>;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertExists(id: string) {
  const [pg] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.id, id)).limit(1);
  if (!pg) throw new AppError('Product group not found', 404);
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function getProductGroups() {
  return db.select().from(productGroups);
}

// ─── single ───────────────────────────────────────────────────────────────────

export async function getProductGroupById(id: string) {
  const [pg] = await db.select().from(productGroups).where(eq(productGroups.id, id)).limit(1);
  if (!pg) throw new AppError('Product group not found', 404);
  const attrs = await getGroupAttributes(id);
  return { ...pg, attributes: attrs };
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createProductGroup(input: CreateProductGroupInput) {
  const [created] = await db.insert(productGroups).values(input).returning();
  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateProductGroup(id: string, input: UpdateProductGroupInput) {
  await assertExists(id);
  const [updated] = await db
    .update(productGroups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(productGroups.id, id))
    .returning();
  return updated;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteProductGroup(id: string) {
  await assertExists(id);
  await db.delete(productGroups).where(eq(productGroups.id, id));
}

// ─── group attributes ─────────────────────────────────────────────────────────

export async function getGroupAttributes(productGroupId: string) {
  const rows = await db
    .select({
      id:             productGroupAttributes.id,
      productGroupId: productGroupAttributes.productGroupId,
      attributeId:    productGroupAttributes.attributeId,
      formulaAlias:   productGroupAttributes.formulaAlias,
      isCalculated:   productGroupAttributes.isCalculated,
      formula:        productGroupAttributes.formula,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
      sortOrder:      productGroupAttributes.sortOrder,
      createdAt:      productGroupAttributes.createdAt,
      // joined attribute fields
      attrName:     attributes.name,
      attrUnit:     attributes.unit,
      attrDataType: attributes.dataType,
    })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(productGroupAttributes.attributeId, attributes.id))
    .where(eq(productGroupAttributes.productGroupId, productGroupId))
    .orderBy(asc(productGroupAttributes.sortOrder), asc(productGroupAttributes.createdAt));

  return rows.map((r) => ({
    id:             r.id,
    productGroupId: r.productGroupId,
    attributeId:    r.attributeId,
    formulaAlias:   r.formulaAlias,
    isCalculated:   r.isCalculated,
    formula:        r.formula,
    isQuantityBasis: r.isQuantityBasis,
    sortOrder:      r.sortOrder,
    createdAt:      r.createdAt,
    attribute: {
      id:       r.attributeId,
      name:     r.attrName,
      unit:     r.attrUnit,
      dataType: r.attrDataType,
    },
  }));
}

export interface AddGroupAttributeInput {
  attributeId:     string;
  formulaAlias?:   string;
  isCalculated?:   boolean;
  formula?:        string;
  isQuantityBasis?: boolean;
  sortOrder?:      number;
}

export async function addGroupAttribute(productGroupId: string, input: AddGroupAttributeInput) {
  await assertExists(productGroupId);

  // If setting as quantity basis, clear the flag on all other attrs in the group first
  if (input.isQuantityBasis) {
    await db
      .update(productGroupAttributes)
      .set({ isQuantityBasis: false })
      .where(eq(productGroupAttributes.productGroupId, productGroupId));
  }

  let created: typeof productGroupAttributes.$inferSelect;
  try {
    [created] = await db
      .insert(productGroupAttributes)
      .values({
        productGroupId,
        attributeId:     input.attributeId,
        formulaAlias:    input.formulaAlias ?? null,
        isCalculated:    input.isCalculated ?? false,
        formula:         input.formula ?? null,
        isQuantityBasis: input.isQuantityBasis ?? false,
        sortOrder:       input.sortOrder ?? 0,
      })
      .returning();
  } catch (err: any) {
    // Postgres unique-constraint violation (23505)
    if (err?.code === '23505') {
      throw new AppError('This attribute is already added to the group.', 409);
    }
    throw err;
  }

  const [full] = await getGroupAttributes(productGroupId).then((rows) =>
    rows.filter((r) => r.id === created!.id)
  );
  return full;
}

export interface UpdateGroupAttributeInput {
  formulaAlias?:   string | null;
  isCalculated?:   boolean;
  formula?:        string | null;
  isQuantityBasis?: boolean;
  sortOrder?:      number;
}

export async function updateGroupAttribute(
  productGroupId: string,
  pgaId: string,
  input: UpdateGroupAttributeInput,
) {
  const [existing] = await db
    .select({ id: productGroupAttributes.id })
    .from(productGroupAttributes)
    .where(eq(productGroupAttributes.id, pgaId))
    .limit(1);
  if (!existing) throw new AppError('Group attribute not found', 404);

  // If setting as quantity basis, clear the flag on all other attrs in the group first
  if (input.isQuantityBasis) {
    await db
      .update(productGroupAttributes)
      .set({ isQuantityBasis: false })
      .where(eq(productGroupAttributes.productGroupId, productGroupId));
  }

  await db
    .update(productGroupAttributes)
    .set(input)
    .where(eq(productGroupAttributes.id, pgaId));

  const [updated] = await getGroupAttributes(productGroupId).then((rows) =>
    rows.filter((r) => r.id === pgaId)
  );
  return updated;
}

export async function removeGroupAttribute(productGroupId: string, pgaId: string) {
  const [existing] = await db
    .select({ id: productGroupAttributes.id })
    .from(productGroupAttributes)
    .where(eq(productGroupAttributes.id, pgaId))
    .limit(1);
  if (!existing) throw new AppError('Group attribute not found', 404);
  await db.delete(productGroupAttributes).where(eq(productGroupAttributes.id, pgaId));
}

export async function reorderGroupAttributes(productGroupId: string, orderedIds: string[]) {
  await assertExists(productGroupId);
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(productGroupAttributes)
        .set({ sortOrder: index })
        .where(eq(productGroupAttributes.id, id))
    )
  );
  return getGroupAttributes(productGroupId);
}

// ─── BOM inputs ───────────────────────────────────────────────────────────────

export async function getGroupInputs(outputGroupId: string) {
  const rows = await db
    .select({
      id:            productGroupInputs.id,
      outputGroupId: productGroupInputs.outputGroupId,
      inputGroupId:  productGroupInputs.inputGroupId,
      qtyFormula:    productGroupInputs.qtyFormula,
      formulaVars:   productGroupInputs.formulaVars,
      yieldFactor:   productGroupInputs.yieldFactor,
      label:         productGroupInputs.label,
      sortOrder:     productGroupInputs.sortOrder,
      notes:         productGroupInputs.notes,
      createdAt:     productGroupInputs.createdAt,
      inputGroupName: productGroups.name,
      inputGroupType: productGroups.type,
    })
    .from(productGroupInputs)
    .innerJoin(productGroups, eq(productGroupInputs.inputGroupId, productGroups.id))
    .where(eq(productGroupInputs.outputGroupId, outputGroupId))
    .orderBy(asc(productGroupInputs.sortOrder), asc(productGroupInputs.createdAt));

  return rows.map((r) => ({
    id:            r.id,
    outputGroupId: r.outputGroupId,
    inputGroupId:  r.inputGroupId,
    qtyFormula:    r.qtyFormula,
    formulaVars:   r.formulaVars as Record<string, { pgaId: string; groupId: string; groupName: string; attrName: string }> | null,
    yieldFactor:   r.yieldFactor,
    label:         r.label,
    sortOrder:     r.sortOrder,
    notes:         r.notes,
    createdAt:     r.createdAt,
    inputGroup: {
      id:   r.inputGroupId,
      name: r.inputGroupName,
      type: r.inputGroupType,
    },
  }));
}

export interface FormulaVar {
  pgaId:     string;
  groupId:   string;
  groupName: string;
  attrName:  string;
}

export interface AddGroupInputInput {
  inputGroupId: string;
  qtyFormula:   string;
  formulaVars?: Record<string, FormulaVar>;
  yieldFactor?: number;
  label?:       string;
  sortOrder?:   number;
  notes?:       string;
}

export async function addGroupInput(outputGroupId: string, input: AddGroupInputInput) {
  await assertExists(outputGroupId);
  // verify the input group exists
  const [inputGroup] = await db
    .select({ id: productGroups.id })
    .from(productGroups)
    .where(eq(productGroups.id, input.inputGroupId))
    .limit(1);
  if (!inputGroup) throw new AppError('Input product group not found', 404);
  if (input.inputGroupId === outputGroupId) throw new AppError('A product group cannot be its own input', 400);

  const [created] = await db
    .insert(productGroupInputs)
    .values({
      outputGroupId,
      inputGroupId:  input.inputGroupId,
      qtyFormula:    input.qtyFormula,
      formulaVars:   input.formulaVars ?? null,
      yieldFactor:   String(input.yieldFactor ?? 1.0),
      label:         input.label ?? null,
      sortOrder:     input.sortOrder ?? 0,
      notes:         input.notes ?? null,
    })
    .returning();

  const [full] = await getGroupInputs(outputGroupId).then((rows) =>
    rows.filter((r) => r.id === created.id)
  );
  return full;
}

export interface UpdateGroupInputInput {
  qtyFormula?:   string;
  formulaVars?:  Record<string, FormulaVar> | null;
  yieldFactor?:  number;
  label?:        string | null;
  sortOrder?:    number;
  notes?:        string | null;
}

export async function updateGroupInput(
  outputGroupId: string,
  inputId: string,
  input: UpdateGroupInputInput,
) {
  const [existing] = await db
    .select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(eq(productGroupInputs.id, inputId))
    .limit(1);
  if (!existing) throw new AppError('BOM input not found', 404);

  await db
    .update(productGroupInputs)
    .set({
      ...(input.qtyFormula  !== undefined && { qtyFormula:  input.qtyFormula }),
      ...(input.formulaVars !== undefined && { formulaVars: input.formulaVars }),
      ...(input.yieldFactor !== undefined && { yieldFactor: String(input.yieldFactor) }),
      ...(input.label       !== undefined && { label:       input.label }),
      ...(input.sortOrder   !== undefined && { sortOrder:   input.sortOrder }),
      ...(input.notes       !== undefined && { notes:       input.notes }),
    })
    .where(eq(productGroupInputs.id, inputId));

  const [updated] = await getGroupInputs(outputGroupId).then((rows) =>
    rows.filter((r) => r.id === inputId)
  );
  return updated;
}

export async function removeGroupInput(inputId: string) {
  const [existing] = await db
    .select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(eq(productGroupInputs.id, inputId))
    .limit(1);
  if (!existing) throw new AppError('BOM input not found', 404);
  await db.delete(productGroupInputs).where(eq(productGroupInputs.id, inputId));
}
