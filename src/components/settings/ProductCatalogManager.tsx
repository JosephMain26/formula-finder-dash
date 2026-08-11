import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadProductCategories, loadProducts, categoryLabel, type Product, type ProductCategory } from "@/lib/products";
import { toast } from "sonner";

export function ProductCatalogManager() {
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [newCat, setNewCat] = useState({ business: "", name: "" });
  const [newProd, setNewProd] = useState({ name: "", unit_price: "", unit: "", description: "", category_id: "" });

  async function refresh() {
    const [c, p] = await Promise.all([loadProductCategories(), loadProducts()]);
    setCats(c);
    setProducts(p);
  }
  useEffect(() => { refresh(); }, []);

  async function addCat() {
    const business = newCat.business.trim();
    const name = newCat.name.trim();
    if (!business || !name) return toast.error("Business and category name required");
    const { error } = await (supabase as any).from("product_categories").insert({ business, name });
    if (error) return toast.error(error.message);
    setNewCat({ business: "", name: "" });
    refresh();
  }
  async function updateCat(id: string, patch: Partial<ProductCategory>) {
    await (supabase as any).from("product_categories").update(patch).eq("id", id);
    refresh();
  }
  async function deleteCat(id: string) {
    if (!confirm("Delete this category? Products in it become uncategorized.")) return;
    await (supabase as any).from("product_categories").delete().eq("id", id);
    refresh();
  }

  async function addProduct() {
    const name = newProd.name.trim();
    if (!name) return toast.error("Product name required");
    const { error } = await (supabase as any).from("products").insert({
      name,
      unit_price: Number(newProd.unit_price) || 0,
      unit: newProd.unit.trim() || null,
      description: newProd.description.trim() || null,
      category_id: newProd.category_id || (activeCat !== "all" ? activeCat : null),
    });
    if (error) return toast.error(error.message);
    setNewProd({ name: "", unit_price: "", unit: "", description: "", category_id: "" });
    refresh();
  }
  async function updateProduct(id: string, patch: Partial<Product>) {
    await (supabase as any).from("products").update(patch).eq("id", id);
    refresh();
  }
  async function deleteProduct(id: string) {
    await (supabase as any).from("products").delete().eq("id", id);
    refresh();
  }

  const businesses = Array.from(new Set(cats.map((c) => c.business)));
  const shown = activeCat === "all" ? products : products.filter((p) => (activeCat === "none" ? !p.category_id : p.category_id === activeCat));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Grouped by business (e.g. Garage · Residential). Add, rename or remove as you like.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[140px] flex-1">
              <label className="text-[11px] font-medium text-muted-foreground">Business</label>
              <Input className="h-8" list="pc-businesses" placeholder="Garage" value={newCat.business}
                onChange={(e) => setNewCat((p) => ({ ...p, business: e.target.value }))} />
              <datalist id="pc-businesses">
                {businesses.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="text-[11px] font-medium text-muted-foreground">Category</label>
              <Input className="h-8" placeholder="Residential" value={newCat.name}
                onChange={(e) => setNewCat((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <Button size="sm" className="h-8" onClick={addCat}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
          <div className="space-y-1.5">
            {cats.length === 0 && <p className="text-xs text-muted-foreground">No categories yet.</p>}
            {cats.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border p-1.5">
                <Input defaultValue={c.business} className="h-7 text-xs flex-1"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.business) updateCat(c.id, { business: v }); }} />
                <span className="text-xs text-muted-foreground">·</span>
                <Input defaultValue={c.name} className="h-7 text-xs flex-1"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) updateCat(c.id, { name: v }); }} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCat(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products & Services</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">These appear in the estimate/invoice item picker.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[160px] flex-1">
              <label className="text-[11px] font-medium text-muted-foreground">Name</label>
              <Input className="h-8" placeholder="Torsion spring replacement" value={newProd.name}
                onChange={(e) => setNewProd((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="w-24">
              <label className="text-[11px] font-medium text-muted-foreground">Price</label>
              <Input className="h-8" type="number" step="0.01" value={newProd.unit_price}
                onChange={(e) => setNewProd((p) => ({ ...p, unit_price: e.target.value }))} />
            </div>
            <div className="w-24">
              <label className="text-[11px] font-medium text-muted-foreground">Unit</label>
              <Input className="h-8" placeholder="each" value={newProd.unit}
                onChange={(e) => setNewProd((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div className="min-w-[160px]">
              <label className="text-[11px] font-medium text-muted-foreground">Category</label>
              <Select value={newProd.category_id || "none"} onValueChange={(v) => setNewProd((p) => ({ ...p, category_id: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{categoryLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8" onClick={addProduct}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter</span>
            <Select value={activeCat} onValueChange={setActiveCat}>
              <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="none">Uncategorized</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{categoryLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            {shown.length === 0 && <p className="text-xs text-muted-foreground">No products here yet.</p>}
            {shown.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border p-1.5">
                <Input defaultValue={p.name} className="h-7 text-xs flex-1 min-w-[140px]"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) updateProduct(p.id, { name: v }); }} />
                <Input defaultValue={String(p.unit_price)} type="number" step="0.01" className="h-7 text-xs w-24"
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== p.unit_price) updateProduct(p.id, { unit_price: v }); }} />
                <Input defaultValue={p.unit || ""} placeholder="unit" className="h-7 text-xs w-20"
                  onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== p.unit) updateProduct(p.id, { unit: v }); }} />
                <Select value={p.category_id || "none"} onValueChange={(v) => updateProduct(p.id, { category_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-7 text-xs w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{categoryLabel(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteProduct(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
