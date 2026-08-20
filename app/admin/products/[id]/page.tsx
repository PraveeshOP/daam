import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getAdminProduct } from "@/lib/admin/products";
import { categories } from "@/lib/data";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { ProductEditForm } from "@/components/admin/ProductEditForm";
import { setProductStatusAction } from "@/app/admin/actions/products";

export const metadata: Metadata = { title: "Product — PriceNepal Admin" };

const npr = (value: number) => `NPR ${Math.round(value).toLocaleString("en-IN")}`;

export default async function AdminProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminProduct(id);

  if (!product) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link href="/admin/products" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
          <ArrowLeft size={14} /> Back to products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/products" className="flex items-center gap-2 text-sm font-bold text-[#0c8b67]">
        <ArrowLeft size={14} /> Back to products
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <StatusBadge label={product.status === "active" ? "Active" : "Inactive"} tone={product.status === "active" ? "green" : "gray"} />
          </div>
          <p className="mt-1 text-sm text-[#66736e]">{product.brand} · {product.categoryName}</p>
          {product.mergedInto && (
            <p className="mt-2 text-sm text-[#a8710b]">
              Merged into{" "}
              <Link href={`/admin/products/${product.mergedInto}`} className="font-bold underline">
                another product
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-[3px] border border-[#d6dfda] px-4 py-2.5 text-sm font-bold transition hover:border-[#0c8b67] hover:text-[#0c8b67]"
          >
            View on site <ExternalLink size={14} />
          </Link>
          {product.status === "active" ? (
            <ConfirmAction
              action={setProductStatusAction}
              hiddenFields={{ productId: product.id, status: "inactive" }}
              triggerLabel="Disable product"
              title="Disable this product?"
              description="This will disable this product from public search. Its price history and offers stay intact, and you can re-enable it any time."
              confirmLabel="Disable product"
            />
          ) : (
            <ConfirmAction
              action={setProductStatusAction}
              hiddenFields={{ productId: product.id, status: "active" }}
              triggerLabel="Re-enable product"
              triggerClassName="rounded-[3px] border border-[#d6dfda] px-3 py-1.5 text-sm font-bold transition hover:border-[#0c8b67] hover:text-[#0c8b67]"
              title="Re-enable this product?"
              description="This will make the product visible in public search and on the site again."
              confirmLabel="Re-enable"
              danger={false}
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Stores", value: product.offers.length },
          { label: "Lowest price", value: product.lowestPrice ? npr(product.lowestPrice) : "—" },
          { label: "Highest price", value: product.highestPrice ? npr(product.highestPrice) : "—" },
          { label: "Price history points", value: product.priceHistoryCount },
          { label: "Active alerts", value: product.activeAlertCount },
          { label: "Favorites", value: product.favoriteCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[4px] border border-[#e3e9e5] bg-white p-4">
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-xs font-semibold text-[#66736e]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <h2 className="mb-4 text-lg font-bold">Edit product</h2>
          <ProductEditForm
            productId={product.id}
            categories={categories.map((category) => ({ id: category.id, name: category.name }))}
            initial={{
              name: product.name,
              brand: product.brand,
              slug: product.slug,
              categoryId: product.categoryId,
              description: product.description || "",
              imageUrl: product.imageUrl || "",
              specifications: product.specifications,
            }}
          />
        </section>

        <div className="space-y-6">
          <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
            <h2 className="mb-3 text-lg font-bold">Offers ({product.offers.length})</h2>
            {product.offers.length === 0 ? (
              <p className="text-sm text-[#66736e]">No offers for this product.</p>
            ) : (
              <ul className="divide-y divide-[#edf1ee] text-sm">
                {product.offers.map((offer) => (
                  <li key={offer.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-semibold">{offer.storeName}</p>
                      <p className="text-xs text-[#88948e]">{offer.availability === "in_stock" ? "In stock" : "Out of stock"}{offer.isDisabled ? " · Disabled" : ""}</p>
                    </div>
                    <p className="font-bold">{npr(offer.price)}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/offers?product=${product.id}`} className="mt-3 inline-block text-sm font-bold text-[#0c8b67] hover:underline">
              Manage offers
            </Link>
          </section>

          <section className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
            <h2 className="mb-3 text-lg font-bold">Matching information</h2>
            {product.matchCandidates.length === 0 ? (
              <p className="text-sm text-[#66736e]">No match candidates involve this product.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {product.matchCandidates.map((match) => (
                  <li key={match.id} className="rounded-[3px] border border-[#e3e9e5] p-3">
                    <p>
                      {match.direction === "duplicate-of" ? "Possible duplicate of" : "Possible duplicate exists"}:{" "}
                      <Link href={`/admin/products/${match.otherProductId}`} className="font-bold text-[#0c8b67] hover:underline">
                        {match.otherProductName}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-[#88948e]">
                      {match.confidence}% confidence · {match.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/matches" className="mt-3 inline-block text-sm font-bold text-[#0c8b67] hover:underline">
              Review all matches
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
