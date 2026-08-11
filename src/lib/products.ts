import { supabase } from "@/integrations/supabase/client";

export type ProductCategory = {
  id: string;
  business: string;
  name: string;
  sort_order: number;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  unit: string | null;
  active: boolean;
  sort_order: number;
};

export async function loadProductCategories(): Promise<ProductCategory[]> {
  const { data } = await (supabase as any)
    .from("product_categories")
    .select("id,business,name,sort_order")
    .order("sort_order")
    .order("business");
  return (data as ProductCategory[]) || [];
}

export async function loadProducts(): Promise<Product[]> {
  const { data } = await (supabase as any)
    .from("products")
    .select("id,category_id,name,description,unit_price,unit,active,sort_order")
    .order("sort_order")
    .order("name");
  return (data as Product[]) || [];
}

export function categoryLabel(c: ProductCategory | undefined | null): string {
  if (!c) return "Uncategorized";
  return `${c.business} · ${c.name}`;
}

export async function createProduct(p: {
  name: string;
  description?: string | null;
  unit_price: number;
  unit?: string | null;
  category_id?: string | null;
}): Promise<Product | null> {
  const { data, error } = await (supabase as any)
    .from("products")
    .insert({
      name: p.name,
      description: p.description ?? null,
      unit_price: p.unit_price,
      unit: p.unit ?? null,
      category_id: p.category_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return (data as Product) || null;
}
