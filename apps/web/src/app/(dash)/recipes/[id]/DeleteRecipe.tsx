"use client";

import { useRouter } from "next/navigation";

export function DeleteRecipe({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      className="btn"
      onClick={async () => {
        await fetch(`/api/recipes/${id}`, { method: "DELETE" });
        router.push("/recipes");
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
