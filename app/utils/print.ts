import type { EventDetail } from "~/types/stats";

export const printPage = async (
  event: EventDetail,
  printSection: HTMLElement | null,
  chatId?: number,
  isGeneratingPdf?: Ref<boolean>,
) => {
  if (!globalThis.window || !printSection) return;

  if (!chatId) {
    alert(`Помилка: Не вдалося знайти ID користувача Telegram.`);
    return;
  }

  try {
    if (isGeneratingPdf) {
      isGeneratingPdf.value = true;
    }

    // Give fonts a beat to render
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Robust dynamic imports to avoid SSR issues
    const [{ toJpeg }, { jsPDF }] = await Promise.all([
      import("html-to-image"),
      import("jspdf"),
    ]);

    const dataUrl = await toJpeg(printSection, {
      quality: 0.85,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(dataUrl);
    // Total scaled height of the image in mm
    const imgHeightMm = (imgProps.height * pdfWidth) / imgProps.width;

    // Slice the image across as many pages as needed.
    // On each page we shift the image up by (pageIndex * pdfPageHeight) so only
    // the current slice is visible within the page bounds.
    const totalPages = Math.ceil(imgHeightMm / pdfPageHeight);
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(
        dataUrl,
        "JPEG",
        0,
        -(i * pdfPageHeight),
        pdfWidth,
        imgHeightMm,
      );
    }

    const filename = `Event_Stats_${event.name.replaceAll(/\s+/g, "_")}.pdf`;

    // Send as binary FormData — avoids base64 inflation and JSON body size limits
    const pdfBlob = pdf.output("blob");
    const form = new FormData();
    form.append("chatId", String(chatId));
    form.append("filename", filename);
    form.append("file", pdfBlob, filename);

    const res = await fetch("/api/file/send-pdf", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    // Give the user satisfying native feedback
    alert("✅ PDF успішно надіслано у ваш чат!");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    alert(`❌ Помилка: ${message}`);
  } finally {
    if (isGeneratingPdf) {
      isGeneratingPdf.value = false;
    }
  }
};
