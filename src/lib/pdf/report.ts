import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ar } from './arabic';
import type { BrandingSettings, Language, PdfBrandingSettings } from '@/types/models';

export interface MetaEntry {
  label: string;
  value: string;
}

export interface ReportTable {
  head: string[];
  body: (string | number)[][];
}

export interface ReportOptions {
  language: Language;
  title: string;
  subtitle?: string;
  branding: BrandingSettings;
  pdfBranding: PdfBrandingSettings;
  /** Employee name, ID, department, manager, gender, date range… */
  meta: MetaEntry[];
  table: ReportTable;
  summary?: MetaEntry[];
  generatedBy: string;
  fileName: string;
}

const PAGE_MARGIN = 12;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full || '2563eb', 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Fetches an image URL and returns a data URL, or null if it cannot be used. */
async function loadImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Registers the embedded Amiri faces. The font module is ~200 KB, so it is
 * imported here rather than in the app bundle: nobody downloads it until
 * they export something.
 */
async function registerFonts(doc: jsPDF): Promise<void> {
  const { AMIRI_REGULAR, AMIRI_BOLD } = await import('./amiri-font');
  doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_REGULAR);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.addFileToVFS('Amiri-Bold.ttf', AMIRI_BOLD);
  doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
}

/**
 * Builds the report document.
 *
 * Layout: branded header band, report title, a meta block, the data table,
 * a summary strip, and — on every page — the configurable copyright footer
 * with page numbers. Returned rather than saved so the same code path can
 * be rendered and inspected outside a browser.
 */
export async function renderReport(options: ReportOptions): Promise<jsPDF> {
  const { language, pdfBranding, branding } = options;
  const rtl = language === 'ar';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  await registerFonts(doc);
  const font = 'Amiri';
  doc.setFont(font, 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const accent = hexToRgb(pdfBranding.accent_color || '#2563eb');
  const T = (value: string | number) => ar(value);

  const logo = pdfBranding.show_logo ? await loadImage(branding.logo_url) : null;

  /* ---------------- header band ---------------- */
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageWidth, 26, 'F');

  const companyName = rtl ? branding.company_name_ar : branding.company_name_en;
  const systemName = rtl ? branding.system_name_ar : branding.system_name_en;

  let textX = rtl ? pageWidth - PAGE_MARGIN : PAGE_MARGIN;
  const align = rtl ? 'right' : 'left';

  if (logo) {
    try {
      const logoX = rtl ? pageWidth - PAGE_MARGIN - 16 : PAGE_MARGIN;
      doc.addImage(logo, 'PNG', logoX, 5, 16, 16);
      textX = rtl ? pageWidth - PAGE_MARGIN - 20 : PAGE_MARGIN + 20;
    } catch {
      /* an unusable logo must never block the export */
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont(font, 'bold');
  doc.setFontSize(15);
  doc.text(T(companyName || 'StaffFlow'), textX, 12, { align });
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(T(systemName || ''), textX, 19, { align });

  /* ---------------- title ---------------- */
  doc.setTextColor(20, 24, 32);
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.text(T(options.title), rtl ? pageWidth - PAGE_MARGIN : PAGE_MARGIN, 37, { align });

  if (options.subtitle) {
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 118, 132);
    doc.text(T(options.subtitle), rtl ? pageWidth - PAGE_MARGIN : PAGE_MARGIN, 43, { align });
  }

  /* ---------------- meta block ---------------- */
  // Label above value, four to a row, so long Arabic labels never collide
  // with their own value the way a single-line layout would.
  const metaTop = options.subtitle ? 50 : 45;
  const metaColumns = 4;
  const metaWidth = (pageWidth - PAGE_MARGIN * 2) / metaColumns;
  const metaRowHeight = 11;

  options.meta.forEach((entry, index) => {
    const column = index % metaColumns;
    const row = Math.floor(index / metaColumns);
    const y = metaTop + row * metaRowHeight;
    const x = rtl
      ? pageWidth - PAGE_MARGIN - column * metaWidth
      : PAGE_MARGIN + column * metaWidth;

    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 138, 152);
    doc.text(T(entry.label), x, y, { align });

    doc.setFont(font, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(28, 33, 43);
    doc.text(T(entry.value || '—'), x, y + 5, {
      align,
      maxWidth: metaWidth - 4,
    });
  });

  const metaRows = Math.ceil(options.meta.length / metaColumns);
  const tableTop = metaTop + metaRows * metaRowHeight + 2;

  /* ---------------- data table ---------------- */
  const head = rtl ? [...options.table.head].reverse() : options.table.head;
  const body = rtl
    ? options.table.body.map((row) => [...row].reverse())
    : options.table.body;

  autoTable(doc, {
    startY: tableTop,
    head: [head.map((cell) => T(cell))],
    body: body.map((row) => row.map((cell) => T(cell))),
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 18 },
    styles: {
      font,
      fontStyle: 'normal',
      fontSize: 8.5,
      cellPadding: 2.2,
      halign: align,
      textColor: [35, 41, 53],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      font,
      fontStyle: 'bold',
      fillColor: accent,
      textColor: [255, 255, 255],
      halign: align,
    },
    alternateRowStyles: { fillColor: [246, 248, 252] },
    theme: 'grid',
  });

  /* ---------------- summary ---------------- */
  const afterTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let cursorY = (afterTable?.finalY ?? tableTop) + 8;

  if (options.summary && options.summary.length > 0) {
    if (cursorY > pageHeight - 40) {
      doc.addPage();
      cursorY = 24;
    }

    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 33, 43);
    doc.text(
      T(rtl ? 'الملخص والإحصائيات' : 'Summary & statistics'),
      rtl ? pageWidth - PAGE_MARGIN : PAGE_MARGIN,
      cursorY,
      { align },
    );
    cursorY += 4;

    const boxWidth = (pageWidth - PAGE_MARGIN * 2 - 3 * 4) / 4;
    options.summary.forEach((entry, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = rtl
        ? pageWidth - PAGE_MARGIN - (column + 1) * boxWidth - column * 4
        : PAGE_MARGIN + column * (boxWidth + 4);
      const y = cursorY + row * 18;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(249, 250, 252);
      doc.roundedRect(x, y, boxWidth, 15, 2, 2, 'FD');

      const innerX = rtl ? x + boxWidth - 3 : x + 3;
      doc.setFont(font, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(130, 138, 152);
      doc.text(T(entry.label), innerX, y + 5.5, { align });

      doc.setFont(font, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text(T(entry.value), innerX, y + 12, { align });
    });
  }

  /* ---------------- footer on every page ---------------- */
  const footerText = rtl ? pdfBranding.footer_text_ar : pdfBranding.footer_text_en;
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(PAGE_MARGIN, pageHeight - 12, pageWidth - PAGE_MARGIN, pageHeight - 12);

    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 128, 142);

    // The copyright line is always shown in Arabic as configured, centred.
    doc.text(ar(footerText || ''), pageWidth / 2, pageHeight - 7, { align: 'center' });

    const pageLabel = rtl ? `${pageCount} / ${page}` : `${page} / ${pageCount}`;
    doc.text(pageLabel, rtl ? PAGE_MARGIN : pageWidth - PAGE_MARGIN, pageHeight - 7, {
      align: rtl ? 'left' : 'right',
    });

    doc.text(
      T(`${options.generatedBy}`),
      rtl ? pageWidth - PAGE_MARGIN : PAGE_MARGIN,
      pageHeight - 7,
      { align },
    );
  }

  return doc;
}

/** Builds the report and hands the browser a PDF to download. */
export async function buildReportPdf(options: ReportOptions): Promise<void> {
  const doc = await renderReport(options);
  doc.save(options.fileName);
}
