import { z } from "zod";

export const DeliveryLocationSchema = z.object({
  line: z.string().min(1).max(32),
  container: z.string().min(1).max(32),
  landmark: z.string().max(80).optional().or(z.literal(""))
});

export const CreateOrderSchema = z.object({
  restaurantSlug: z.string().min(1),
  paymentMethod: z.enum(["qr_image", "cash"]).default("qr_image"),
  customerPhone: z.string().trim().min(7).max(24).regex(/^\+?[0-9\s\-()]+$/),
  comment: z.string().max(120).optional().or(z.literal("")),
  location: DeliveryLocationSchema,
  items: z.array(z.object({ menuItemId: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1)
});

export const UpsertCategorySchema = z.object({
  restaurantSlug: z.string().min(1),
  title: z.string().min(1).max(40),
  sortOrder: z.number().int().min(0).max(999).default(0)
});

export const UpsertItemSchema = z.object({
  id: z.string().optional(),
  restaurantSlug: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1).max(60),
  description: z.string().max(200).optional().or(z.literal("")),
  photoUrl: z.string().min(1),
  priceKgs: z.number().int().min(0).max(1_000_000),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).optional()
});
