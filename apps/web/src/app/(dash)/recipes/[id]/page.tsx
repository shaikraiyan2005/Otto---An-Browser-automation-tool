import type { RecipeStep } from "@otto/shared";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/Shell";
import { db } from "@/lib/db";
import { DeleteRecipe } from "./DeleteRecipe";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const recipe = await db.recipe.findUnique({ where: { id: (await params).id } });
  if (!recipe) notFound();
  const steps = recipe.steps as unknown as RecipeStep[];
  return (
    <>
      <PageTitle right={<DeleteRecipe id={recipe.id} />}>{recipe.title}</PageTitle>
      <div className="mb-4 font-mono text-xs text-muted">
        {recipe.origin}
        {recipe.path} · {recipe.formSig}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Label</th>
              <th className="th">Key</th>
              <th className="th">Widget</th>
              <th className="th">Name / id</th>
              <th className="th">Section</th>
              <th className="th">Source</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i}>
                <td className="td">{s.label}</td>
                <td className="td font-mono text-xs">{s.key ?? "—"}</td>
                <td className="td font-mono text-xs">{s.widget}</td>
                <td className="td font-mono text-xs text-muted">{s.fp.name || s.fp.id || "—"}</td>
                <td className="td text-muted">{s.fp.section || "—"}</td>
                <td className="td font-mono text-xs">{s.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
