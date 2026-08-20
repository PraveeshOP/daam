import Link from "next/link";
import type { Metadata } from "next";
import { listAdminProducts, listBrands } from "@/lib/admin/products";
import { categories } from "@/lib/data";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pagination } from "@/components/admin/Pagination";

export const metadata: Metadata = { title: "Products — PriceNepal Admin" };

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const filters = { search: params.q, category: params.category, brand: params.brand, status: params.status };

  const [{ items, total, pageSize = 20 }, brands] = await Promise.all([listAdminProducts(filters, page), listBrands()]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="mt-2 text-[#66736e]">{total.toLocaleString("en-IN")} products</p>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-3 rounded-[4px] border border-[#e3e9e5] bg-white p-4">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Search name or brand…"
          className="min-w-[220px] flex-1 rounded-[3px] border border-[#d6dfda] px-3 py-2 text-sm outline-none focus:border-[#0c8b67]"
        />
        <select name="category" defaultValue={params.category || ""} className="rounded-[3px] border border-[#d6dfda] px-3 py-2 text-sm outline-none focus:border-[#0c8b67]">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="brand" defaultValue={params.brand || ""} className="rounded-[3px] border border-[#d6dfda] px-3 py-2 text-sm outline-none focus:border-[#0c8b67]">
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status || ""} className="rounded-[3px] border border-[#d6dfda] px-3 py-2 text-sm outline-none focus:border-[#0c8b67]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="submit" className="rounded-[3px] bg-[#17221f] px-4 py-2 text-sm font-bold text-white hover:bg-[#0c8b67]">
          Filter
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[4px] border border-[#e3e9e5] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f7f6] text-left text-xs font-bold uppercase tracking-wide text-[#66736e]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Stores</th>
              <th className="px-4 py-3">Lowest price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1ee]">
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#66736e]">
                  No products match these filters.
                </td>
              </tr>
            )}
            {items.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-[#88948e]">{product.brand}</p>
                </td>
                <td className="px-4 py-3 text-[#66736e]">{product.categoryName}</td>
                <td className="px-4 py-3 text-[#66736e]">{product.storeCount}</td>
                <td className="px-4 py-3 font-semibold">{product.lowestPrice ? npr(product.lowestPrice) : "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge label={product.status === "active" ? "Active" : "Inactive"} tone={product.status === "active" ? "green" : "gray"} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/products/${product.id}`} className="font-bold text-[#0c8b67] hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} basePath="/admin/products" searchParams={{ q: params.q, category: params.category, brand: params.brand, status: params.status }} />
    </div>
  );
}
