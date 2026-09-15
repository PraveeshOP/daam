import { describe, expect, it } from "vitest";
import { resolveCanonicalProductId, resolveSlugOwner, type SlugOwner } from "@/collectors/core/mergeResolution";

/** Minimal stand-in for the two queries these helpers make, keyed the way PostgREST is. */
function fakeClient(rows: (SlugOwner & { slug?: string })[]) {
  return {
    from() {
      const state: { col?: string; value?: string } = {};
      const builder = {
        select: () => builder,
        eq(column: string, value: string) { state.col = column; state.value = value; return builder; },
        maybeSingle() {
          const found = rows.find((row) => (state.col === "slug" ? row.slug === state.value : row.id === state.value));
          return Promise.resolve({ data: found ?? null, error: null });
        },
      };
      return builder;
    },
  } as never;
}

describe("slug-deadlock resolution", () => {
  it("returns null when the slug is free, so the importer still inserts normally", async () => {
    expect(await resolveSlugOwner(fakeClient([]), "lg-fridge-abc")).toBeNull();
  });

  /**
   * The exact live failure: `accept_product_match` retires a duplicate but leaves its slug in the
   * unique index, so the next run regenerated the same slug and the insert died on
   * `products_slug_key` — dropping that listing on every run, forever.
   */
  it("resolves a retired product's slug to the product it was merged into", async () => {
    const client = fakeClient([
      { id: "dupe", slug: "lg-lg-refrigerator-437-ltr-model-8fc1bb57c9", status: "inactive", merged_into: "canonical" },
      { id: "canonical", status: "active", merged_into: null },
    ]);
    const owner = await resolveSlugOwner(client, "lg-lg-refrigerator-437-ltr-model-8fc1bb57c9");
    expect(owner?.id).toBe("dupe");
    expect(await resolveCanonicalProductId(client, owner!)).toBe("canonical");
  });

  it("follows a multi-hop merge chain to the surviving product", async () => {
    const client = fakeClient([
      { id: "a", status: "inactive", merged_into: "b" },
      { id: "b", status: "inactive", merged_into: "c" },
      { id: "c", status: "active", merged_into: null },
    ]);
    expect(await resolveCanonicalProductId(client, { id: "a", status: "inactive", merged_into: "b" })).toBe("c");
  });

  it("returns an active slug owner unchanged", async () => {
    const client = fakeClient([{ id: "live", slug: "s", status: "active", merged_into: null }]);
    expect(await resolveCanonicalProductId(client, (await resolveSlugOwner(client, "s"))!)).toBe("live");
  });

  /** Nothing in the schema prevents a cycle, and an unbounded walk would hang the collector. */
  it("gives up on a merge cycle instead of looping forever", async () => {
    const client = fakeClient([
      { id: "x", status: "inactive", merged_into: "y" },
      { id: "y", status: "inactive", merged_into: "x" },
    ]);
    const resolved = await resolveCanonicalProductId(client, { id: "x", status: "inactive", merged_into: "y" }, 4);
    expect(["x", "y"]).toContain(resolved);
  });

  it("stops at the last real row when merged_into dangles", async () => {
    const client = fakeClient([{ id: "a", status: "inactive", merged_into: "deleted" }]);
    expect(await resolveCanonicalProductId(client, { id: "a", status: "inactive", merged_into: "deleted" })).toBe("a");
  });
});
