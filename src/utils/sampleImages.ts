import { computeImageHash } from './imageProcessing';
import { EnhancedImageItem } from '../types';

/**
 * Creates high-fidelity programmatic test images with realistic noise, gradients, and shapes
 */
export async function generateSampleImages(): Promise<EnhancedImageItem[]> {
  const samples: { name: string; type: string; width: number; height: number; generator: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }[] = [
    {
      name: 'misty_mountain_view.jpg',
      type: 'image/jpeg',
      width: 480,
      height: 320,
      generator: (ctx, w, h) => {
        // Sunset gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.4, '#fb923c');
        grad.addColorStop(0.7, '#cbd5e1');
        grad.addColorStop(1, '#475569');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Sun disc
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.35, 36, 0, Math.PI * 2);
        ctx.fill();

        // Mountain peaks
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.25, h * 0.45);
        ctx.lineTo(w * 0.5, h * 0.7);
        ctx.lineTo(w * 0.8, h * 0.38);
        ctx.lineTo(w, h * 0.65);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Near mountain silhouette
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w * 0.4, h * 0.62);
        ctx.lineTo(w * 0.7, h * 0.8);
        ctx.lineTo(w, h * 0.55);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Add simulated high-ISO digital camera sensor noise & compression grain
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 42;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
    {
      name: 'urban_architecture.jpg',
      type: 'image/jpeg',
      width: 440,
      height: 330,
      generator: (ctx, w, h) => {
        // Sky
        const sky = ctx.createLinearGradient(0, 0, w, h);
        sky.addColorStop(0, '#0ea5e9');
        sky.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Buildings
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(40, 90, 90, h - 90);

        ctx.fillStyle = '#334155';
        ctx.fillRect(150, 60, 110, h - 60);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(280, 110, 120, h - 110);

        // Windows
        ctx.fillStyle = '#fef08a';
        for (let y = 110; y < h - 40; y += 24) {
          for (let x = 60; x < 110; x += 22) {
            if (Math.random() > 0.3) ctx.fillRect(x, y, 12, 14);
          }
          for (let x = 170; x < 240; x += 22) {
            if (Math.random() > 0.25) ctx.fillRect(x, y, 12, 14);
          }
          for (let x = 300; x < 380; x += 24) {
            if (Math.random() > 0.35) ctx.fillRect(x, y, 14, 14);
          }
        }

        // Noise & blur simulation
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 35;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
    {
      name: 'urban_architecture_copy.jpg', // Duplicate candidate with slight crop/shift
      type: 'image/jpeg',
      width: 440,
      height: 330,
      generator: (ctx, w, h) => {
        // Same composition with tiny variation (near duplicate to demonstrate detection!)
        const sky = ctx.createLinearGradient(0, 0, w, h);
        sky.addColorStop(0, '#0284c7');
        sky.addColorStop(1, '#bae6fd');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(38, 92, 90, h - 92);

        ctx.fillStyle = '#334155';
        ctx.fillRect(148, 62, 110, h - 62);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(278, 112, 120, h - 112);

        ctx.fillStyle = '#fef08a';
        for (let y = 110; y < h - 40; y += 24) {
          for (let x = 60; x < 110; x += 22) {
            ctx.fillRect(x, y, 12, 14);
          }
          for (let x = 170; x < 240; x += 22) {
            ctx.fillRect(x, y, 12, 14);
          }
        }

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 25;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
    {
      name: 'botanical_fern_macro.jpg',
      type: 'image/jpeg',
      width: 400,
      height: 300,
      generator: (ctx, w, h) => {
        // Deep forest background
        const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
        grad.addColorStop(0, '#14532d');
        grad.addColorStop(0.7, '#064e3b');
        grad.addColorStop(1, '#022c22');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Fern fronds
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(30, h - 30);
        ctx.quadraticCurveTo(w * 0.4, h * 0.3, w - 40, 50);
        ctx.stroke();

        // Leaves
        ctx.fillStyle = '#4ade80';
        for (let t = 0.1; t <= 0.9; t += 0.08) {
          const px = 30 + (w - 70) * t;
          const py = h - 30 - (h - 80) * Math.sin(t * Math.PI * 0.7);
          ctx.beginPath();
          ctx.ellipse(px + 15, py - 10, 16, 6, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(px - 15, py + 10, 16, 6, -Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Noise
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 38;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
    {
      name: 'receipt_invoice_document.png',
      type: 'image/png',
      width: 420,
      height: 380,
      generator: (ctx, w, h) => {
        // Off-white paper background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);

        // Header
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('COLUMBIA ROAD STUDIOS', 25, 38);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('TAX INVOICE #88492-B', 25, 58);
        ctx.fillText('DATE: 2026-09-07   TIME: 10:14 AM', 25, 74);

        // Divider
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(25, 86);
        ctx.lineTo(w - 25, 86);
        ctx.stroke();

        // Itemized lines
        ctx.font = '11px monospace';
        ctx.fillStyle = '#1e293b';
        ctx.fillText('ITEM DESCR             QTY    PRICE', 25, 108);

        ctx.font = '11px monospace';
        ctx.fillStyle = '#334155';
        ctx.fillText('High-Res Studio Lens     1   $420.00', 25, 132);
        ctx.fillText('Tripod Carbon Fiber      2   $180.00', 25, 154);
        ctx.fillText('Multi-Coated UV Filter   1    $45.00', 25, 176);
        ctx.fillText('SDXC Pro Card 256GB      2    $98.00', 25, 198);

        // Divider
        ctx.beginPath();
        ctx.moveTo(25, 214);
        ctx.lineTo(w - 25, 214);
        ctx.stroke();

        // Totals
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#0f172a';
        ctx.fillText('SUBTOTAL:                  $743.00', 25, 238);
        ctx.fillText('VAT / TAX (10%):            $74.30', 25, 258);
        ctx.fillText('TOTAL DUE:                 $817.30', 25, 282);

        // Barcode lines
        ctx.fillStyle = '#0f172a';
        let barX = 25;
        for (let b = 0; b < 46; b++) {
          const barW = (b % 3 === 0 ? 3 : b % 2 === 0 ? 2 : 1);
          ctx.fillRect(barX, 310, barW, 30);
          barX += barW + (b % 4 === 0 ? 3 : 2);
        }
        ctx.font = '9px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText('* 8 8 4 9 2 - B 9 0 2 1 *', 25, 355);

        // Add typical low-res scanner blur & compression noise
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 28;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
    {
      name: 'swedish_grammar_textbook.png',
      type: 'image/png',
      width: 440,
      height: 360,
      generator: (ctx, w, h) => {
        // Cream-white textbook paper
        ctx.fillStyle = '#fbfcfd';
        ctx.fillRect(0, 0, w, h);

        // Printed text paragraphs
        ctx.font = '12px serif';
        ctx.fillStyle = '#2c3338';
        ctx.fillText('– I Skåne. I södra Sverige.', 20, 30);
        ctx.fillText('– engelska och lite svenska.', 20, 50);
        ctx.fillText('– Chris heter jag. Varifrån kommer du?', 20, 70);
        ctx.fillText('– Ja, okej. Vad talar du för språk, Josefin?', 20, 90);
        ctx.fillText('– Lund? Var ligger det?', 20, 110);

        // Right column dialogue
        ctx.fillText('– Vad bra!', 240, 30);
        ctx.fillText('– Jag kommer från...', 240, 50);
        ctx.fillText('– Jag talar engelska.', 240, 70);
        ctx.fillText('Och svenska?', 240, 90);
        ctx.fillText('– Hej! Jag heter...', 240, 110);

        // Red handwriting student annotations (preserved in fidelity)
        ctx.fillStyle = '#dc2626';
        ctx.font = 'italic bold 13px sans-serif';
        ctx.fillText('3', 180, 28);
        ctx.fillText('8', 180, 48);
        ctx.fillText('2', 215, 68);
        ctx.fillText('6', 230, 88);
        ctx.fillText('4', 165, 108);

        // Headline title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Ordföljd: verbets och subjektets position', 20, 155);

        // Grammar Exercise Table (Light blue background with cell borders)
        const tableY = 175;
        const tableH = 160;
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(15, tableY, w - 30, tableH);

        // Table Header
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(15, tableY, w - 30, 26);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Fundament', 25, tableY + 18);
        ctx.fillText('Verb', 150, tableY + 18);
        ctx.fillText('Subjekt', 270, tableY + 18);

        // Table Grid lines
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, tableY, w - 30, tableH);
        ctx.beginPath();
        ctx.moveTo(140, tableY);
        ctx.lineTo(140, tableY + tableH);
        ctx.moveTo(260, tableY);
        ctx.lineTo(260, tableY + tableH);
        for (let r = 1; r <= 4; r++) {
          ctx.moveTo(15, tableY + 26 + r * 28);
          ctx.lineTo(w - 15, tableY + 26 + r * 28);
        }
        ctx.stroke();

        // Row 1: Jag (circled) | heter (yellow highlight) | Yildiz
        ctx.fillStyle = '#1e293b';
        ctx.font = '12px sans-serif';
        ctx.fillText('1', 20, tableY + 46);

        // Circled 'Jag'
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(55, tableY + 42, 16, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText('Jag', 45, tableY + 46);

        // Yellow highlight on 'heter'
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(152, tableY + 34, 38, 16);
        ctx.fillStyle = '#0f172a';
        ctx.font = '12px sans-serif';
        ctx.fillText('heter', 155, tableY + 46);

        ctx.fillStyle = '#334155';
        ctx.fillText('Yildiz', 275, tableY + 46);

        // Row 2
        ctx.fillText('2', 20, tableY + 74);
        ctx.fillText('Nu', 45, tableY + 74);
        // Yellow highlight on 'talar'
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(152, tableY + 62, 38, 16);
        ctx.fillStyle = '#0f172a';
        ctx.fillText('talar', 156, tableY + 74);
        ctx.fillStyle = '#334155';
        ctx.fillText('hon', 275, tableY + 74);

        // Add typical textbook scan grain & low-res lens blur
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 32;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      },
    },
  ];

  const items: EnhancedImageItem[] = [];

  for (let idx = 0; idx < samples.length; idx++) {
    const s = samples[idx];
    const canvas = document.createElement('canvas');
    canvas.width = s.width;
    canvas.height = s.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    s.generator(ctx, s.width, s.height);
    const dataUrl = canvas.toDataURL(s.type, 0.85);
    const base64Len = dataUrl.length - (dataUrl.indexOf(',') + 1);
    const byteSize = Math.round(base64Len * 0.75);

    const { dHash } = await computeImageHash(dataUrl);

    const isTextbook = s.name.includes('textbook') || s.name.includes('swedish');
    const isDocument = s.name.includes('receipt') || s.name.includes('document') || isTextbook;

    items.push({
      id: `sample-${idx + 1}-${Date.now()}`,
      name: s.name,
      fileType: s.type,
      originalUrl: dataUrl,
      originalWidth: s.width,
      originalHeight: s.height,
      originalSize: byteSize,
      status: 'idle',
      progress: 0,
      dHash,
      createdAt: Date.now() + idx,
    });
  }

  return items;
}
