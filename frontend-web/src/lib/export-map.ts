import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export async function exportToPng(element: HTMLElement, filename = "mind-map.png") {
  const dataUrl = await toPng(element, { quality: 1.0, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function exportToPdf(element: HTMLElement, filename = "mind-map.pdf") {
  const dataUrl = await toPng(element, { quality: 1.0, backgroundColor: "#ffffff" });
  const img = new Image();
  img.src = dataUrl;
  await new Promise(resolve => { img.onload = resolve; });

  const pdf = new jsPDF({
    orientation: img.width > img.height ? "landscape" : "portrait",
    unit: "px",
    format: [img.width, img.height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
  pdf.save(filename);
}
