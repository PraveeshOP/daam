import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categories } from "@/lib/data";
import { CategoryIcon } from "@/components/CategoryIcon";

export default function CategoriesPage() {
  return (
    <main className="container py-12 sm:py-16">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0c8b67]">
        Explore the catalogue
      </p>
      <h1 className="text-4xl font-bold sm:text-5xl">
        What are you shopping for?
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-[#66736e]">
        Start with a category and compare the products that matter to you.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            href={`/search?category=${category.slug}`}
            key={category.id}
            className="group flex min-h-[180px] flex-col justify-between rounded-[4px] p-6 transition hover:-translate-y-1 hover:shadow-lg"
            style={{ backgroundColor: category.accent }}
          >
            <CategoryIcon name={category.icon as never} size={34} />
            <div>
              <h2 className="text-xl font-bold">{category.name}</h2>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold">
                Browse{" "}
                <ArrowRight
                  size={15}
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
