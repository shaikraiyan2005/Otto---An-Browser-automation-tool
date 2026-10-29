import { JobForm } from "./JobForm";

export default async function JobApplication({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  const { layout } = await searchParams;
  return <JobForm v2={layout === "v2"} />;
}
