// Turns an uploaded quote into plain text in the browser, so only text (never
// the binary file) reaches the database.
export async function fileToText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return pdfToText(file);
  }
  return file.text();
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Group text runs into visual lines by their baseline so table rows stay
    // on one line; quotes are mostly tables.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((r) => r.s.trim())
          .join("  "),
      );
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n--- page break ---\n\n");
}
