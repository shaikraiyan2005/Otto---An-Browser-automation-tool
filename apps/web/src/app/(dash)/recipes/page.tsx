import Link from "next/link";
import { Empty, PageTitle } from "@/components/Shell";
import { db } from "@/lib/db";

export default async function RecipesPage() {
  const recipes = await db.recipe.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageTitle>Recipes</PageTitle>
      <div className="card overflow-hidden">
        {recipes.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Form</th>
                <th className="th">Page</th>
                <th className="th text-right">Steps</th>
                <th className="th text-right">Runs</th>
                <th className="th text-right">Healed</th>
                <th className="th">Updated</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => {
                const stats = r.stats as { runs: number; healed: number };
                return (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className="td">
                      <Link href={`/recipes/${r.id}`}>{r.title}</Link>
                    </td>
                    <td className="td font-mono text-xs text-muted">
                      {r.origin}
                      {r.path}
                    </td>
                    <td className="td text-right font-mono">{(r.steps as unknown[]).length}</td>
                    <td className="td text-right font-mono">{stats.runs}</td>
                    <td className="td text-right font-mono">{stats.healed}</td>
                    <td className="td font-mono text-xs text-muted">{r.updatedAt.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
