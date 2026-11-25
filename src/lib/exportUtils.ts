import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';
import type { ManagedDocument } from '../types/document';

function safeFileName(title: string, ext: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${base || 'vellumdesk-document'}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDocumentToPdf(doc: ManagedDocument): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 56;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = 60;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - 64) {
      pdf.addPage();
      cursorY = 60;
    }
  };

  // Top accent rule
  pdf.setDrawColor(212, 76, 60); // #d44c3c
  pdf.setLineWidth(2);
  pdf.line(marginX, cursorY - 18, marginX + 48, cursorY - 18);

  // Document kicker
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  const categoryLabel =
    doc.category === 'contract' ? 'COMMERCIAL AGREEMENT' : 'EXECUTIVE BUSINESS REPORT';
  pdf.text(
    `${categoryLabel}  ·  VERSION ${doc.currentVersion}.0  ·  ${doc.status.replace('_', ' ').toUpperCase()}`,
    marginX,
    cursorY
  );
  cursorY += 22;

  // Title
  pdf.setFont('times', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(26, 46, 42); // #1a2e2a
  const titleLines = pdf.splitTextToSize(doc.title || 'Untitled Document', maxWidth) as string[];
  for (const line of titleLines) {
    ensureSpace(28);
    pdf.text(line, marginX, cursorY);
    cursorY += 26;
  }
  cursorY += 6;

  // Metadata summary row
  const metaEntries = Object.entries(doc.metadata || {}).filter(
    ([k, v]) => k !== 'tone' && typeof v === 'string' && v.trim().length > 0
  );
  if (metaEntries.length > 0) {
    pdf.setDrawColor(26, 46, 42);
    pdf.setLineWidth(0.75);
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 16;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85);

    const summaryText = metaEntries
      .map(
        ([k, v]) =>
          `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}: ${v}`
      )
      .join('   |   ');
    const metaLines = pdf.splitTextToSize(summaryText, maxWidth) as string[];
    for (const mLine of metaLines) {
      ensureSpace(14);
      pdf.text(mLine, marginX, cursorY);
      cursorY += 14;
    }
    cursorY += 6;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 24;
  } else {
    pdf.setDrawColor(26, 46, 42);
    pdf.setLineWidth(0.75);
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 24;
  }

  // Sections
  for (const section of doc.sections) {
    ensureSpace(44);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13.5);
    pdf.setTextColor(26, 46, 42);
    const headingLines = pdf.splitTextToSize(section.heading || 'Section', maxWidth) as string[];
    for (const hLine of headingLines) {
      ensureSpace(20);
      pdf.text(hLine, marginX, cursorY);
      cursorY += 18;
    }
    cursorY += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(30, 41, 59);
    const paragraphs = (section.body || '').split(/\n{2,}/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      const singleLines = trimmed.split('\n');
      for (const rawLine of singleLines) {
        const wrapped = pdf.splitTextToSize(rawLine.trim(), maxWidth) as string[];
        for (const line of wrapped) {
          ensureSpace(16);
          pdf.text(line, marginX, cursorY);
          cursorY += 15;
        }
      }
      cursorY += 8;
    }
    cursorY += 10;
  }

  // Page numbers & document title in footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(marginX, pageHeight - 44, pageWidth - marginX, pageHeight - 44);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text((doc.title || 'VellumDesk Document').slice(0, 64), marginX, pageHeight - 30);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 30, {
      align: 'right',
    });
  }

  pdf.save(safeFileName(doc.title, 'pdf'));
}

export async function exportDocumentToDocx(doc: ManagedDocument): Promise<void> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${doc.category === 'contract' ? 'COMMERCIAL AGREEMENT' : 'EXECUTIVE REPORT'} · VERSION ${doc.currentVersion}.0 · ${doc.status.replace('_', ' ').toUpperCase()}`,
          size: 18,
          bold: true,
          color: '475569',
        }),
      ],
      spacing: { after: 160 },
    })
  );

  children.push(
    new Paragraph({
      text: doc.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
      border: {
        bottom: {
          color: 'CBD5E1',
          space: 8,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    })
  );

  const metaEntries = Object.entries(doc.metadata || {}).filter(
    ([, v]) => typeof v === 'string' && v.trim().length > 0
  );
  if (metaEntries.length > 0) {
    for (const [k, v] of metaEntries) {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 20, color: '334155' }),
            new TextRun({ text: String(v), size: 20, color: '0F172A' }),
          ],
          spacing: { after: 60 },
        })
      );
    }
    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
        border: {
          bottom: {
            color: 'E2E8F0',
            space: 6,
            style: BorderStyle.SINGLE,
            size: 4,
          },
        },
      })
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      })
    );

    const paragraphs = section.body.split(/\n{2,}/);
    for (const para of paragraphs) {
      const lines = para.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) continue;
      children.push(
        new Paragraph({
          children: lines.map(
            (line, idx) =>
              new TextRun({
                text: line,
                size: 22,
                color: '1E293B',
                break: idx > 0 ? 1 : 0,
              })
          ),
          spacing: { after: 140, line: 340 },
        })
      );
    }
  }

  const wordDoc = new Document({
    creator: doc.ownerName,
    title: doc.title,
    description: `${doc.templateName} exported from VellumDesk`,
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${doc.title}  ·  Page `, size: 18, color: '64748B' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '64748B' }),
                  new TextRun({ text: ' of ', size: 18, color: '64748B' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '64748B' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  triggerDownload(blob, safeFileName(doc.title, 'docx'));
}

export function exportDocumentToMarkdown(doc: ManagedDocument): void {
  const metaLines = Object.entries(doc.metadata || {})
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n');

  const sectionText = doc.sections
    .map((s) => `## ${s.heading}\n\n${s.body}`)
    .join('\n\n---\n\n');

  const content = [
    `# ${doc.title}`,
    `> Category: ${doc.category} | Template: ${doc.templateName} | Version: v${doc.currentVersion}.0 | Status: ${doc.status}`,
    metaLines,
    sectionText,
  ]
    .filter(Boolean)
    .join('\n\n');

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, safeFileName(doc.title, 'md'));
}
