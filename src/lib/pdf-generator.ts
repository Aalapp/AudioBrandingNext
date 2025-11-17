import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RigidJSONResponse } from './perplexity-rigid';

/**
 * Generate PDF from rigid JSON data (jingle report)
 */
export async function generateJingleReportPDF(
  data: RigidJSONResponse,
  brandName: string
): Promise<Buffer> {
  const html = generateJingleReportHTML(data, brandName);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Generate HTML template for jingle report
 */
function generateJingleReportHTML(data: RigidJSONResponse, brandName: string): string {
  const { brand_findings, artistic_rationale, jingle } = data;
  const generationDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const generationTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Read logo SVG
  let logoSvg = '';
  try {
    const logoPath = join(process.cwd(), 'public', 'assets', 'logo.svg');
    logoSvg = readFileSync(logoPath, 'utf-8');
    // Encode for data URI
    logoSvg = encodeURIComponent(logoSvg);
  } catch (error) {
    console.error('Error reading logo SVG:', error);
    // Fallback to empty string if logo can't be read
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName} - Jingle Report</title>
  <style>
    @page {
      size: A4;
      margin: 1in;
    }
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .cover-page {
      page-break-after: always;
      height: 100vh;
      max-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d1f0e 50%, #8b4513 100%);
      color: white;
      padding: 1.5rem;
      position: relative;
      box-sizing: border-box;
    }
    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 100%;
      margin-bottom: 1rem;
    }
    .cover-logo {
      width: 100px;
      height: auto;
    }
    .cover-brand {
      text-align: right;
    }
    .cover-brand-name {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.2rem;
    }
    .cover-brand-subtitle {
      font-size: 0.75rem;
      opacity: 0.9;
    }
    .cover-divider {
      width: 100%;
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0.75rem 0;
    }
    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 0;
    }
    .brand-name {
      font-size: 2.2rem;
      font-weight: bold;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 2px;
      line-height: 1.2;
    }
    .report-title {
      font-size: 1.5rem;
      margin-bottom: 1.25rem;
      font-weight: 300;
    }
    .content-page {
      page-break-after: always;
    }
    .section {
      margin-bottom: 2rem;
    }
    .section-title {
      font-size: 1.5rem;
      font-weight: bold;
      color: #000;
      border-bottom: 2px solid #FF8C00;
      padding-bottom: 0.5rem;
      margin-bottom: 1rem;
    }
    .data-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .data-item {
      background: #f8f9fa;
      padding: 0.75rem;
      border-left: 3px solid #FF8C00;
    }
    .data-label {
      font-weight: bold;
      color: #000;
      margin-bottom: 0.25rem;
    }
    .content-text {
      margin-bottom: 0.75rem;
      text-align: justify;
    }
    .pill {
      display: inline-block;
      background: #FF8C00;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      margin-right: 6px;
      margin-bottom: 6px;
      font-size: 0.85rem;
    }
    .list-item {
      margin-bottom: 0.4rem;
      padding-left: 1rem;
    }
    .list-item::before {
      content: "•";
      color: #FF8C00;
      font-weight: bold;
      margin-right: 0.5rem;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="cover-logo">
        ${logoSvg ? `<img src="data:image/svg+xml,${logoSvg}" alt="aalap.ai" style="width: 100%; height: auto;" />` : ''}
      </div>
      <div class="cover-brand">
        <div class="cover-brand-name">Aalap</div>
        <div class="cover-brand-subtitle">Brand Intelligence</div>
      </div>
    </div>
    <div class="cover-divider"></div>
    <div class="cover-content">
      <div class="brand-name">${escapeHtml(brandName)}</div>
      <div class="report-title">Jingle Report</div>
      <div style="font-size: 0.95rem; margin-top: 1.25rem; max-width: 550px; line-height: 1.4;">
        Creative rationale and production guidance for a premium sonic signature
      </div>
    </div>
    <div style="font-size: 0.8rem; text-align: center; margin-top: 1rem;">
      Generated on ${generationDate} at ${generationTime}
    </div>
    <div style="text-align: center; margin-top: 0.75rem; opacity: 0.6;">
      ${logoSvg ? `<img src="data:image/svg+xml,${logoSvg}" alt="aalap.ai" style="width: 60px; height: auto; opacity: 0.5;" />` : ''}
    </div>
  </div>

  <!-- Brand Findings -->
  <div class="content-page">
    <div class="section">
      <div class="section-title">1) Brand Findings</div>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">Positioning</div>
          <div class="content-text">${escapeHtml(brand_findings.positioning || '—')}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Target Audience</div>
          <div class="content-text">${escapeHtml(brand_findings.target_audience || '—')}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Tone & Personality</div>
          <div class="content-text">${escapeHtml(brand_findings.tone_personality || '—')}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Visual & Tactile Cues</div>
          <div class="content-text">${escapeHtml(brand_findings.visual_tactile_cues || '—')}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Brand Promise</div>
          <div class="content-text">${escapeHtml(brand_findings.brand_promise || '—')}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Practical Constraints</div>
          <div class="content-text">${escapeHtml(brand_findings.practical_constraints || '—')}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Artistic Rationale -->
  <div class="content-page">
    <div class="section">
      <div class="section-title">2) Artistic Rationale</div>
      <div class="content-text">${formatHTML(artistic_rationale || '—')}</div>
    </div>
  </div>

  <!-- Final Jingle -->
  <div class="content-page">
    <div class="section">
      <div class="section-title">3) Final Jingle — Concept, Palette, Production</div>
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: bold; color: #FF8C00; margin-bottom: 0.25rem;">Concept Statement</div>
        <div class="content-text">${escapeHtml(jingle.concept_statement || '—')}</div>
      </div>
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: bold; color: #FF8C00; margin-bottom: 0.75rem;">Musical Description</div>
        ${renderMusicalDescription(jingle.description1, 1)}
        ${renderMusicalDescription(jingle.description2, 2)}
        ${renderMusicalDescription(jingle.description3, 3)}
        ${renderMusicalDescription(jingle.description4, 4)}
        ${renderMusicalDescription(jingle.description5, 5)}
      </div>
      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; color: #FF8C00; margin-bottom: 0.25rem;">Keywords</div>
        <div>
          ${(jingle.keywords || []).map((kw) => `<span class="pill">${escapeHtml(kw)}</span>`).join('')}
          ${(!jingle.keywords || jingle.keywords.length === 0) ? '<span style="font-style: italic; color: #666;">—</span>' : ''}
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; color: #FF8C00; margin-bottom: 0.25rem;">How It Sounds (Imagery)</div>
        <div class="content-text">${escapeHtml(jingle.imagery || '—')}</div>
      </div>
      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; color: #FF8C00; margin-bottom: 0.25rem;">Why This Will Work</div>
        ${(jingle.why_it_works || []).map((reason) => `<div class="list-item">${escapeHtml(reason)}</div>`).join('')}
        ${(!jingle.why_it_works || jingle.why_it_works.length === 0) ? '<div style="font-style: italic; color: #666;">—</div>' : ''}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatHTML(html: string): string {
  if (!html) return '—';
  // Allow basic HTML tags but escape the rest
  return html
    .replace(/<p>/g, '<p>')
    .replace(/<\/p>/g, '</p>')
    .replace(/<strong>/g, '<strong>')
    .replace(/<\/strong>/g, '</strong>')
    .replace(/<em>/g, '<em>')
    .replace(/<\/em>/g, '</em>')
    .replace(/<br\s*\/?>/g, '<br>');
}

function renderMusicalDescription(desc: any, number: number): string {
  if (!desc || !desc.title || !desc.musical_elements) {
    return '';
  }

  let html = `<div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e0e0e0;">
    <div style="font-weight: bold; color: #000; font-size: 1.1rem; margin-bottom: 0.5rem;">
      ${number}) ${escapeHtml(desc.title)}
    </div>
    <div style="margin-bottom: 0.5rem;">
      <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem; font-size: 0.95rem;">Musical Elements:</div>
      <div class="content-text" style="margin-left: 0.5rem;">${formatHTML(desc.musical_elements)}</div>
    </div>`;

  if (desc.hook) {
    html += `
    <div style="margin-bottom: 0.5rem;">
      <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem; font-size: 0.95rem;">Hook:</div>
      <div style="margin-left: 0.5rem; font-style: italic; color: #555;">${escapeHtml(desc.hook)}</div>
    </div>`;
  }

  if (desc.feel) {
    html += `
    <div style="margin-bottom: 0.5rem;">
      <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem; font-size: 0.95rem;">Feel:</div>
      <div style="margin-left: 0.5rem; color: #555;">${escapeHtml(desc.feel)}</div>
    </div>`;
  }

  if (desc.emotional_effect) {
    html += `
    <div style="margin-bottom: 0.5rem;">
      <div style="font-weight: 600; color: #333; margin-bottom: 0.25rem; font-size: 0.95rem;">Emotional Effect:</div>
      <div style="margin-left: 0.5rem; color: #555; font-style: italic;">${escapeHtml(desc.emotional_effect)}</div>
    </div>`;
  }

  html += `</div>`;
  return html;
}

