import { RunsTable } from "@/components/RunsTable";
import { PageTitle } from "@/components/Shell";
import { db } from "@/lib/db";

export default async function RunsPage() {
  const runs = await db.run.findMany({ orderBy: { createdAt: "desc" }, take: 200, omit: { details: true } });
  return (
    <>
      <PageTitle>Runs</PageTitle>
      <div className="card overflow-hidden">
        <RunsTable runs={runs} />
      </div>
    </>
  );
}
