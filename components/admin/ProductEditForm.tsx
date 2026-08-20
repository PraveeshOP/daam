"use client";

import { useActionState, useState } from "react";
import { updateProductAction, type ProductActionState } from "@/app/admin/actions/products";

type Category = { id: string; name: string };
type Spec = { label: string; value: string };

const inputClass = "w-full rounded-[3px] border border-[#d6dfda] bg-white px-3 py-2 text-sm outline-none focus:border-[#0c8b67]";
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-[#66736e]";

export function ProductEditForm({
  productId,
  categories,
  initial,
}: {
  productId: string;
  categories: Category[];
  initial: { name: string; brand: string; slug: string; categoryId: string | null; description: string; imageUrl: string; specifications: Spec[] };
}) {
  const [state, formAction] = useActionState<ProductActionState, FormData>(updateProductAction, undefined);
  const [specs, setSpecs] = useState<Spec[]>(initial.specifications.length ? initial.specifications : [{ label: "", value: "" }]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      {state?.error && <p role="alert" className="rounded-[3px] bg-[#fdecea] px-3 py-2.5 text-sm font-semibold text-[#c0392b]">{state.error}</p>}
      {state?.success && <p role="status" className="rounded-[3px] bg-[#f0fbf7] px-3 py-2.5 text-sm font-semibold text-[#0c8b67]">{state.success}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="name">Name</label>
          <input id="name" name="name" defaultValue={initial.name} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="brand">Brand</label>
          <input id="brand" name="brand" defaultValue={initial.brand} required className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="categoryId">Category</label>
          <select id="categoryId" name="categoryId" defaultValue={initial.categoryId || ""} className={inputClass}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="slug">
            Slug <span className="font-normal text-[#a0aaa5]">(changes the product&apos;s public URL)</span>
          </label>
          <input id="slug" name="slug" defaultValue={initial.slug} required pattern="^[a-z0-9]+(-[a-z0-9]+)*$" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="imageUrl">Image URL</label>
        <input id="imageUrl" name="imageUrl" defaultValue={initial.imageUrl} placeholder="https://…" className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="description">Description</label>
        <textarea id="description" name="description" defaultValue={initial.description} rows={3} className={inputClass} />
      </div>

      <div>
        <p className={labelClass}>Specifications</p>
        <div className="space-y-2">
          {specs.map((spec, index) => (
            <div key={index} className="flex gap-2">
              <input
                name="specLabel"
                defaultValue={spec.label}
                placeholder="Label (e.g. Storage)"
                className={inputClass}
              />
              <input
                name="specValue"
                defaultValue={spec.value}
                placeholder="Value (e.g. 128GB)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setSpecs((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="shrink-0 rounded-[3px] border border-[#d6dfda] px-3 text-sm font-bold text-[#66736e] hover:border-[#c0392b] hover:text-[#c0392b]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSpecs((current) => [...current, { label: "", value: "" }])}
          className="mt-2 text-sm font-bold text-[#0c8b67] hover:underline"
        >
          + Add specification
        </button>
      </div>

      <button type="submit" className="rounded-[3px] bg-[#17221f] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0c8b67]">
        Save changes
      </button>
    </form>
  );
}
