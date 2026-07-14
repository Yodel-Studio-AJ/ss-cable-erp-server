import { relations } from 'drizzle-orm';
import { productGroups } from './product-groups';
import { attributes } from './attributes';
import { productGroupAttributes } from './product-group-attributes';

export const productGroupsRelations = relations(productGroups, ({ many }) => ({
  productGroupAttributes: many(productGroupAttributes),
}));

export const attributesRelations = relations(attributes, ({ many }) => ({
  productGroupAttributes: many(productGroupAttributes),
}));

export const productGroupAttributesRelations = relations(productGroupAttributes, ({ one }) => ({
  productGroup: one(productGroups, {
    fields: [productGroupAttributes.productGroupId],
    references: [productGroups.id],
  }),
  attribute: one(attributes, {
    fields: [productGroupAttributes.attributeId],
    references: [attributes.id],
  }),
}));
