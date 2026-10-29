"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useCase } from "@/playground/useCase";

export default function FilesCase() {
  const [resume, setResume] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const dz = useDropzone({ multiple: false, onDrop: (files) => setPortfolio(files[0]?.name ?? "") });
  useCase("files", () => ({ resume, portfolio }));
  return (
    <div className="min-h-screen bg-white py-12 font-sans">
      <div className="mx-auto grid max-w-md gap-6">
        <h1 className="text-xl font-semibold">Upload documents</h1>
        <label className="grid gap-2 text-sm">
          Resume / CV
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files?.[0]?.name ?? "")} />
        </label>
        <div className="grid gap-2 text-sm">
          <span>Portfolio or work sample</span>
          <div {...dz.getRootProps({ className: "rounded-xl border-2 border-dashed border-neutral-300 p-8 text-center text-neutral-500" })}>
            <input {...dz.getInputProps()} />
            {portfolio || "Drop a file here, or click to select"}
          </div>
        </div>
      </div>
    </div>
  );
}
