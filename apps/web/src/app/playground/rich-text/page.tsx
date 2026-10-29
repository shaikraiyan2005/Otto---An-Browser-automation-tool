"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState } from "react";
import { useCase } from "@/playground/useCase";

export default function RichTextCase() {
  const [summary, setSummary] = useState("");
  const aboutRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "min-h-32 rounded-lg border border-stone-300 bg-white p-3 outline-none", "aria-label": "Cover letter" } },
  });
  useCase("rich-text", () => ({
    coverLetter: editor?.getText() ?? "",
    about: aboutRef.current?.innerText ?? "",
    summary,
  }));
  return (
    <div className="min-h-screen bg-stone-100 py-12 font-serif text-stone-900">
      <div className="mx-auto grid max-w-2xl gap-6">
        <h1 className="text-3xl">Application essay</h1>
        <div className="grid gap-2">
          <span className="text-sm">Cover letter</span>
          <EditorContent editor={editor} />
        </div>
        <div className="grid gap-2">
          <span className="text-sm" id="about-label">Tell us about yourself</span>
          <div ref={aboutRef} contentEditable suppressContentEditableWarning aria-labelledby="about-label" className="min-h-24 rounded-lg border border-stone-300 bg-white p-3 outline-none" />
        </div>
        <label className="grid gap-2 text-sm">
          Professional summary
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="rounded-lg border border-stone-300 bg-white p-3" />
        </label>
      </div>
    </div>
  );
}
