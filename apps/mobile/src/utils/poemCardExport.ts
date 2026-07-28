export type PoemCardExportFormat = "JPG" | "PDF";

export type PoemCardExportOptions = {
  format: PoemCardExportFormat;
  title: string;
  backgroundColor?: string;
};

export async function exportPoemCard(
  node: unknown,
  options: PoemCardExportOptions
) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("Card downloads are currently available on LineSpace web.");
  }
  const element = resolveElement(node);
  if (!element) {
    throw new Error("The poem card is still preparing. Please try again.");
  }

  await waitForCardAssets(element);
  const width = Math.max(
    1,
    Math.ceil(element.scrollWidth || element.getBoundingClientRect().width)
  );
  const height = Math.max(
    1,
    Math.ceil(element.scrollHeight || element.getBoundingClientRect().height)
  );
  const longestEdge = Math.max(width, height);
  const pixelRatio = Math.max(1, Math.min(3, 4800 / longestEdge));
  const { toJpeg } = await import("html-to-image");
  const dataUrl = await toJpeg(element, {
    backgroundColor: options.backgroundColor ?? "#FFFFFF",
    cacheBust: true,
    pixelRatio,
    quality: 0.97,
    width,
    height
  });
  const filename = safeExportFilename(options.title);

  if (options.format === "JPG") {
    downloadDataUrl(dataUrl, `${filename}.jpg`);
    return;
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    orientation: width > height ? "landscape" : "portrait",
    unit: "px",
    format: [width, height],
    hotfixes: ["px_scaling"],
    compress: true
  });
  pdf.setProperties({
    title: options.title || "LineSpace poem",
    creator: "LineSpace"
  });
  pdf.addImage(dataUrl, "JPEG", 0, 0, width, height, undefined, "FAST");
  pdf.save(`${filename}.pdf`);
}

function resolveElement(node: unknown): HTMLElement | null {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return node;
  }
  if (!node || typeof node !== "object") return null;
  const candidate = node as {
    getScrollableNode?: () => unknown;
    getNativeScrollRef?: () => unknown;
  };
  const nested = candidate.getScrollableNode?.() ?? candidate.getNativeScrollRef?.();
  return typeof HTMLElement !== "undefined" && nested instanceof HTMLElement
    ? nested
    : null;
}

async function waitForCardAssets(element: HTMLElement) {
  if ("fonts" in document) {
    await document.fonts.ready;
  }
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        try {
          await image.decode();
        } catch {
          // A loaded image can still reject decode in older browsers.
        }
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function safeExportFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "linespace-poem"
  );
}
