import type { Language } from '@/types/models';
import type { MetaEntry, ReportOptions, ReportTable } from '@/lib/pdf/report';

export type { MetaEntry, ReportTable };

export interface ExportPayload {
  language: Language;
  title: string;
  subtitle?: string;
  meta: MetaEntry[];
  table: ReportTable;
  summary?: MetaEntry[];
  generatedBy: string;
  fileName: string;
  branding: ReportOptions['branding'];
  pdfBranding: ReportOptions['pdfBranding'];
}

/** Streams a Blob to the user as a download. */
function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * PDF export. jsPDF, the Arabic shaper and the embedded font are all
 * loaded on demand, so none of that weight sits in the initial bundle.
 */
export async function exportPdf(payload: ExportPayload): Promise<void> {
  const { buildReportPdf } = await import('@/lib/pdf/report');
  await buildReportPdf({
    language: payload.language,
    title: payload.title,
    subtitle: payload.subtitle,
    branding: payload.branding,
    pdfBranding: payload.pdfBranding,
    meta: payload.meta,
    table: payload.table,
    summary: payload.summary,
    generatedBy: payload.generatedBy,
    fileName: payload.fileName.endsWith('.pdf') ? payload.fileName : `${payload.fileName}.pdf`,
  });
}

/**
 * Excel export — a real .xlsx with a branded header block, a styled table
 * and a summary section. Arabic workbooks open right-to-left.
 */
export async function exportExcel(payload: ExportPayload): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const rtl = payload.language === 'ar';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StaffFlow';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(payload.title.slice(0, 28) || 'Report', {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 0 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columnCount = Math.max(payload.table.head.length, 4);
  const accent = (payload.pdfBranding.accent_color || '#2563EB').replace('#', '').toUpperCase();

  /* ---- title block ---- */
  const companyName = rtl
    ? payload.branding.company_name_ar
    : payload.branding.company_name_en;

  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${companyName} — ${payload.title}`;
  titleCell.font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: rtl ? 'right' : 'left', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accent}` } };
  sheet.getRow(1).height = 28;

  if (payload.subtitle) {
    sheet.mergeCells(2, 1, 2, columnCount);
    const subtitleCell = sheet.getCell(2, 1);
    subtitleCell.value = payload.subtitle;
    subtitleCell.font = { size: 10, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: rtl ? 'right' : 'left' };
  }

  /* ---- meta block ---- */
  let row = payload.subtitle ? 4 : 3;
  for (let i = 0; i < payload.meta.length; i += 2) {
    const pair = payload.meta.slice(i, i + 2);
    pair.forEach((entry, index) => {
      const labelCell = sheet.getCell(row, index * 2 + 1);
      labelCell.value = entry.label;
      labelCell.font = { size: 9, color: { argb: 'FF6B7280' } };
      labelCell.alignment = { horizontal: rtl ? 'right' : 'left' };

      const valueCell = sheet.getCell(row, index * 2 + 2);
      valueCell.value = entry.value;
      valueCell.font = { size: 10, bold: true };
      valueCell.alignment = { horizontal: rtl ? 'right' : 'left' };
    });
    row += 1;
  }

  /* ---- data table ---- */
  row += 1;
  // Cells are addressed explicitly rather than through `row.values`, whose
  // 1-based array handling is easy to get subtly wrong.
  const headerRow = sheet.getRow(row);
  payload.table.head.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accent}` } };
    cell.alignment = { horizontal: rtl ? 'right' : 'left', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  });
  headerRow.height = 20;
  const headerRowNumber = row;

  payload.table.body.forEach((dataRow, index) => {
    row += 1;
    const sheetRow = sheet.getRow(row);
    dataRow.forEach((value, columnIndex) => {
      const cell = sheetRow.getCell(columnIndex + 1);
      cell.value = value;
      cell.alignment = { horizontal: rtl ? 'right' : 'left' };
      cell.font = { size: 10 };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFEDF0F5' } } };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row, column: payload.table.head.length },
  };

  // Width the columns from their content, within sensible bounds.
  payload.table.head.forEach((header, index) => {
    const longest = payload.table.body.reduce(
      (max, dataRow) => Math.max(max, String(dataRow[index] ?? '').length),
      header.length,
    );
    sheet.getColumn(index + 1).width = Math.min(42, Math.max(12, longest + 4));
  });

  /* ---- summary ---- */
  if (payload.summary && payload.summary.length > 0) {
    row += 2;
    const heading = sheet.getCell(row, 1);
    heading.value = rtl ? 'الملخص والإحصائيات' : 'Summary & statistics';
    heading.font = { bold: true, size: 11 };
    row += 1;

    for (const entry of payload.summary) {
      const labelCell = sheet.getCell(row, 1);
      labelCell.value = entry.label;
      labelCell.font = { size: 10, color: { argb: 'FF6B7280' } };
      const valueCell = sheet.getCell(row, 2);
      valueCell.value = entry.value;
      valueCell.font = { size: 11, bold: true, color: { argb: `FF${accent}` } };
      row += 1;
    }
  }

  /* ---- footer ---- */
  row += 1;
  sheet.mergeCells(row, 1, row, columnCount);
  const footerCell = sheet.getCell(row, 1);
  footerCell.value = rtl
    ? payload.pdfBranding.footer_text_ar
    : payload.pdfBranding.footer_text_en;
  footerCell.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  footerCell.alignment = { horizontal: 'center' };

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = payload.fileName.endsWith('.xlsx')
    ? payload.fileName
    : `${payload.fileName}.xlsx`;
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  );
}
