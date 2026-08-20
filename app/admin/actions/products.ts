"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, AdminAuthError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

export type ProductActionState = { error?: string; success?: string } | undefined;

const trimmed = (formData: FormData, name: string) => String(formData.get(name) || "").trim();

/** §10: edits the fields an admin is meant to touch. `slug` is deliberately excluded from the
 * default edit path — changing it breaks every existing link/bookmark to the product, so it's
 * validated separately and requires the admin to type it, not a click. */
export async function updateProductAction(_prevState: ProductActionState, formData: FormData): Promise<ProductActionState> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (error) {
    return { error: error instanceof AdminAuthError ? error.message : "Not authorized." };
  }

  const id = trimmed(formData, "productId");
  const name = trimmed(formData, "name");
  const brand = trimmed(formData, "brand");
  const slug = trimmed(formData, "slug");
  const description = trimmed(formData, "description");
  const imageUrl = trimmed(formData, "imageUrl");
  const categoryId = trimmed(formData, "categoryId");

  if (!id) return { error: "Missing product." };
  if (!name) return { error: "Product name is required." };
  if (!brand) return { error: "Brand is required." };
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: "Slug must be lowercase letters, numbers, and hyphens only." };
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return { error: "Image URL must start with http:// or https://." };

  const labels = formData.getAll("specLabel").map(String);
  const values = formData.getAll("specValue").map(String);
  const specifications: Record<string, string> = {};
  labels.forEach((label, index) => {
    if (label.trim()) specifications[label.trim()] = (values[index] || "").trim();
  });

  const { error } = await admin.supabase
    .from("products")
    .update({
      name,
      brand,
      slug,
      description: description || null,
      image_url: imageUrl || null,
      category_id: categoryId || null,
      specifications,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message.includes("duplicate key") ? "That slug is already used by another product." : "Could not save changes." };

  await logAdminAction(admin, "product.update", "product", id, { name, brand, slug });
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/products");
  return { success: "Product updated." };
}

/** §11/§27: soft-disable instead of delete, behind a confirmation dialog. */
export async function setProductStatusAction(formData: FormData): Promise<{ error?: string }> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch (error) {
    return { error: error instanceof AdminAuthError ? error.message : "Not authorized." };
  }

  const id = trimmed(formData, "productId");
  const status = trimmed(formData, "status");
  if (!id || (status !== "active" && status !== "inactive")) return { error: "Invalid request." };

  const { error } = await admin.supabase.from("products").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Could not update product status." };

  await logAdminAction(admin, status === "inactive" ? "product.disable" : "product.enable", "product", id);
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/data-quality");
  return {};
}
