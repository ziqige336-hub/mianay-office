import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Generate a rich, realistic sample PDF document with intentional watermarks,
 * multiple pages, and formatted headers to test all Lumina Office PDF features immediately.
 */
export async function createSamplePdfDocument(sampleType: 'contract-watermark' | 'invoice' | 'report' = 'contract-watermark'): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (sampleType === 'contract-watermark') {
    // Page 1: Commercial Contract with Watermark
    const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page1.getSize();

    // Background Watermark (diagonal)
    page1.drawText('WPS CONFIDENTIAL SAMPLE', {
      x: 80,
      y: 400,
      size: 42,
      font: boldFont,
      color: rgb(0.85, 0.85, 0.88),
      rotate: degrees(35),
    });

    page1.drawText('VIP TRIAL ONLY', {
      x: 140,
      y: 280,
      size: 32,
      font: boldFont,
      color: rgb(0.88, 0.85, 0.85),
      rotate: degrees(35),
    });

    // Header
    page1.drawText('SOFTWARE DEVELOPMENT & COOPERATION AGREEMENT', {
      x: 50,
      y: height - 60,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });

    page1.drawText('Agreement No: LUMINA-2026-X092 | Confidentiality: Tier 1', {
      x: 50,
      y: height - 80,
      size: 9,
      font: font,
      color: rgb(0.45, 0.45, 0.5),
    });

    // Divider
    page1.drawLine({
      start: { x: 50, y: height - 90 },
      end: { x: width - 50, y: height - 90 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.85),
    });

    // Section 1
    page1.drawText('1. Parties & Purpose', {
      x: 50,
      y: height - 120,
      size: 12,
      font: boldFont,
      color: rgb(0.15, 0.25, 0.6),
    });

    const bodyText1 = [
      'This Software Cooperation Agreement ("Agreement") is made effective as of August 27, 2026,',
      'by and between Lumina Office Studio ("Party A") and Open Ecosystem Partner ("Party B").',
      '',
      'WHEREAS, Party A is developing high-efficiency, privacy-first desktop office software suites;',
      'WHEREAS, Party B agrees to provide local-first algorithm acceleration and standard compatibility;',
      '',
      'NOW, THEREFORE, both parties agree to the following terms and mutual covenants:',
    ];

    let currentY = height - 145;
    for (const line of bodyText1) {
      page1.drawText(line, {
        x: 50,
        y: currentY,
        size: 10,
        font: font,
        color: rgb(0.2, 0.2, 0.25),
      });
      currentY -= 16;
    }

    // Section 2
    currentY -= 15;
    page1.drawText('2. Core Commitments & No-VIP Free Policy', {
      x: 50,
      y: currentY,
      size: 12,
      font: boldFont,
      color: rgb(0.15, 0.25, 0.6),
    });

    const bodyText2 = [
      '2.1 Zero Subscription Paywall: All PDF editing, OCR extraction, and page management remain 100% free.',
      '2.2 Clean Export Guarantee: No forced digital watermarks, advertising tags, or company badges shall be injected.',
      '2.3 Local Privacy: All computational workloads (rendering, parsing, compression) execute within local memory.',
      '2.4 Cross-Platform Native Acceleration: Optimized for macOS Sequoia Apple Silicon & Windows 11.',
    ];

    currentY -= 25;
    for (const line of bodyText2) {
      page1.drawText(line, {
        x: 50,
        y: currentY,
        size: 9.5,
        font: font,
        color: rgb(0.2, 0.2, 0.25),
      });
      currentY -= 18;
    }

    // Table / Box Preview
    currentY -= 20;
    page1.drawRectangle({
      x: 50,
      y: currentY - 70,
      width: width - 100,
      height: 70,
      borderColor: rgb(0.8, 0.85, 0.95),
      borderWidth: 1,
      color: rgb(0.97, 0.98, 1.0),
    });

    page1.drawText('Deliverables & Milestone Timeline', {
      x: 65,
      y: currentY - 20,
      size: 10,
      font: boldFont,
      color: rgb(0.1, 0.3, 0.7),
    });

    page1.drawText('M1: PDF.js + pdf-lib Local Vector Engine - Ready for Deployment', {
      x: 65,
      y: currentY - 38,
      size: 9,
      font: font,
      color: rgb(0.25, 0.3, 0.35),
    });

    page1.drawText('M2: Electronic & Scanned Watermark Scrubber Engine - Pass Validation', {
      x: 65,
      y: currentY - 54,
      size: 9,
      font: font,
      color: rgb(0.25, 0.3, 0.35),
    });

    // Page 2: Signatures & Appendix
    const page2 = pdfDoc.addPage([595.28, 841.89]);

    // Background watermark on page 2
    page2.drawText('WPS DRAFT WATERMARK', {
      x: 80,
      y: 420,
      size: 38,
      font: boldFont,
      color: rgb(0.87, 0.87, 0.9),
      rotate: degrees(35),
    });

    page2.drawText('3. Execution & Signature Block', {
      x: 50,
      y: height - 60,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });

    page2.drawText('IN WITNESS WHEREOF, the parties hereto have executed this Agreement on the date first written.', {
      x: 50,
      y: height - 85,
      size: 9.5,
      font: font,
      color: rgb(0.3, 0.3, 0.35),
    });

    // Signature boxes
    const boxY = height - 220;
    // Party A box
    page2.drawRectangle({
      x: 50,
      y: boxY,
      width: 220,
      height: 110,
      borderColor: rgb(0.8, 0.8, 0.85),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 0.99),
    });
    page2.drawText('PARTY A: Lumina Office', {
      x: 65,
      y: boxY + 85,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.25),
    });
    page2.drawText('Authorized Signature: ____________', {
      x: 65,
      y: boxY + 30,
      size: 9,
      font: font,
      color: rgb(0.4, 0.4, 0.45),
    });

    // Party B box
    page2.drawRectangle({
      x: 320,
      y: boxY,
      width: 220,
      height: 110,
      borderColor: rgb(0.8, 0.8, 0.85),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 0.99),
    });
    page2.drawText('PARTY B: Client Partner', {
      x: 335,
      y: boxY + 85,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.25),
    });
    page2.drawText('Authorized Signature: ____________', {
      x: 335,
      y: boxY + 30,
      size: 9,
      font: font,
      color: rgb(0.4, 0.4, 0.45),
    });

    // Page 3: Appendix
    const page3 = pdfDoc.addPage([595.28, 841.89]);
    page3.drawText('APPENDIX A: TECHNICAL BENCHMARK SPECIFICATIONS', {
      x: 50,
      y: height - 60,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.15),
    });

    page3.drawText('Features Matrix comparison with traditional paid office software:', {
      x: 50,
      y: height - 85,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.35),
    });

    page3.drawText('- PDF Text Inline Edit: Free (Local Rendering)', { x: 70, y: height - 120, size: 10, font: font, color: rgb(0.1, 0.5, 0.2) });
    page3.drawText('- PDF Watermark Eraser: Free (Vector + Raster Masking)', { x: 70, y: height - 145, size: 10, font: font, color: rgb(0.1, 0.5, 0.2) });
    page3.drawText('- PDF Page Reorder/Merge/Split: Free (Unlimited Pages)', { x: 70, y: height - 170, size: 10, font: font, color: rgb(0.1, 0.5, 0.2) });
    page3.drawText('- Local OCR Engine: Free (Zero Network Required)', { x: 70, y: height - 195, size: 10, font: font, color: rgb(0.1, 0.5, 0.2) });
  }

  return await pdfDoc.save();
}
