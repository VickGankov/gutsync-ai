// Draws a ReportModel as a PDF (Letter, built-in Helvetica so there are no font files to ship).
// Text is limited to characters Helvetica can draw (no arrows or fancy symbols).

import PDFDocument from "pdfkit";
import type { ReportModel } from "./model";

const GREEN = "#1d2128", INK = "#23302a", MUTED = "#5d6b63", LINE = "#d9d6cb", BAND = "#f3f1ea", WARN = "#a05a00";
const M = 48;

type Doc = InstanceType<typeof PDFDocument>;
interface Col { label: string; w: number; align?: "left" | "right" | "center" }

export function renderReportPdf(m: ReportModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc: Doc = new PDFDocument({ size: "LETTER", margin: M, bufferPages: true, info: { Title: m.title, Author: "Triggerplate", Subject: "Food, symptom and health log" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try { draw(doc, m); doc.end(); } catch (e) { reject(e); }
  });
}

const W = () => 612 - M * 2;
const bottom = (doc: Doc) => doc.page.height - 60;
function ensure(doc: Doc, h: number) { if (doc.y + h > bottom(doc)) doc.addPage(); }

function heading(doc: Doc, text: string) {
  ensure(doc, 60);
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(GREEN).text(text, M, doc.y, { width: W() });
  const y = doc.y + 2;
  doc.moveTo(M, y).lineTo(M + W(), y).strokeColor(LINE).lineWidth(0.8).stroke();
  doc.y = y + 6;
  doc.fillColor(INK);
}
function para(doc: Doc, text: string, o: { size?: number; color?: string; bold?: boolean; gap?: number } = {}) {
  doc.font(o.bold ? "Helvetica-Bold" : "Helvetica").fontSize(o.size ?? 9.5).fillColor(o.color ?? INK);
  ensure(doc, doc.heightOfString(text, { width: W() }) + 4);
  doc.text(text, M, doc.y, { width: W() });
  doc.moveDown(o.gap ?? 0.35);
}
function empty(doc: Doc, text: string) { para(doc, text, { color: MUTED, size: 9 }); }

function table(doc: Doc, cols: Col[], rows: string[][], o: { bars?: { col: number; values: number[]; max: number }; colorFn?: (r: number, c: number) => string | null } = {}) {
  const pad = 4, fs = 8.8;
  const heights = (cells: string[], bold: boolean) => Math.max(...cells.map((t, i) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).heightOfString(t, { width: cols[i].w - pad * 2 }))) + pad * 2;
  const drawRow = (cells: string[], bold: boolean, fill: string | null, ri: number) => {
    const h = heights(cells, bold);
    ensure(doc, h);
    const y = doc.y;
    if (fill) doc.rect(M, y, W(), h).fill(fill);
    let x = M;
    cells.forEach((t, i) => {
      const color = (!bold && o.colorFn?.(ri, i)) || INK;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(color).text(t, x + pad, y + pad, { width: cols[i].w - pad * 2, align: cols[i].align ?? "left" });
      x += cols[i].w;
    });
    if (!bold && o.bars) {
      const bx = M + cols.slice(0, o.bars.col).reduce((a, c) => a + c.w, 0);
      const bw = cols[o.bars.col].w - pad * 2;
      const frac = o.bars.max ? o.bars.values[ri] / o.bars.max : 0;
      doc.rect(bx + pad, y + h - pad - 3, bw, 3).fill("#e8e5da");
      doc.rect(bx + pad, y + h - pad - 3, Math.max(2, bw * frac), 3).fill(GREEN);
    }
    doc.y = y + h;
    doc.fillColor(INK);
  };
  drawRow(cols.map(c => c.label), true, BAND, -1);
  rows.forEach((r, i) => drawRow(r, false, null, i));
  doc.moveTo(M, doc.y).lineTo(M + W(), doc.y).strokeColor(LINE).lineWidth(0.6).stroke();
  doc.y += 6;
}

function lineChart(doc: Doc, pts: Array<{ t: number; v: number }>, label: (t: number) => string, unit: string) {
  const h = 110, w = W();
  ensure(doc, h + 30);
  const x0 = M + 36, y0 = doc.y + 6, cw = w - 44, ch = h - 28;
  const vs = pts.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.15, 0.5), vmin = lo - pad, vmax = hi + pad;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const X = (t: number) => x0 + (t1 === t0 ? cw / 2 : ((t - t0) / (t1 - t0)) * cw);
  const Y = (v: number) => y0 + ch - ((v - vmin) / (vmax - vmin)) * ch;
  doc.rect(x0, y0, cw, ch).strokeColor(LINE).lineWidth(0.6).stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
  doc.text(`${vmax.toFixed(1)}`, M, y0 - 3, { width: 32, align: "right" });
  doc.text(`${vmin.toFixed(1)}`, M, y0 + ch - 6, { width: 32, align: "right" });
  doc.text(label(t0), x0, y0 + ch + 4, { width: 120, align: "left" });
  doc.text(label(t1), x0 + cw - 120, y0 + ch + 4, { width: 120, align: "right" });
  doc.text(unit, M, y0 + ch / 2 - 4, { width: 32, align: "right" });
  doc.strokeColor(GREEN).lineWidth(1.4);
  pts.forEach((p, i) => (i === 0 ? doc.moveTo(X(p.t), Y(p.v)) : doc.lineTo(X(p.t), Y(p.v))));
  doc.stroke();
  pts.forEach(p => doc.circle(X(p.t), Y(p.v), 1.8).fill(GREEN));
  doc.y = y0 + h;
  doc.fillColor(INK);
}

function draw(doc: Doc, m: ReportModel) {
  // Title block
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text(m.title, M, M);
  doc.font("Helvetica").fontSize(10.5).fillColor(MUTED);
  if (m.name) doc.text(`Patient: ${m.name}`);
  doc.text(`Period: ${m.periodLabel}`);
  doc.text(`Prepared: ${m.generatedLabel}, from the patient's own entries in Triggerplate`);
  doc.moveDown(0.6);
  para(doc, "This is a summary of what the patient logged. It is not a diagnosis and not a medical record. Patterns shown are counts from self-reported entries, and a pattern is not proof that a food or substance caused a symptom.", { size: 8.8, color: MUTED });

  // Overview
  heading(doc, "Overview");
  const o = m.overview;
  ensure(doc, 52);
  const boxW = (W() - 18) / 4, by = doc.y;
  [[String(o.daysLogged), `of ${o.periodDays} days with entries`], [String(o.meals), "meals logged"], [String(o.symptomEntries), "symptom entries"], [m.symptoms.length ? String(m.symptoms.length) : "0", "symptom types"]].forEach(([big, small], i) => {
    const x = M + i * (boxW + 6);
    doc.roundedRect(x, by, boxW, 46, 6).fill(BAND);
    doc.font("Helvetica-Bold").fontSize(17).fillColor(GREEN).text(big, x, by + 7, { width: boxW, align: "center" });
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(small, x, by + 29, { width: boxW, align: "center" });
  });
  doc.y = by + 54;

  // Symptoms
  heading(doc, "Symptoms in this period");
  if (m.symptoms.length === 0) empty(doc, "No symptoms were logged in this period.");
  else {
    const max = Math.max(...m.symptoms.map(s => s.count));
    table(doc, [{ label: "Symptom", w: 190 }, { label: "Times logged", w: 110 }, { label: "Days", w: 60, align: "right" }, { label: "Avg severity (1-5)", w: 90, align: "right" }, { label: "Worst", w: 66, align: "right" }],
      m.symptoms.map(s => [s.label, String(s.count), String(s.days), s.avg.toFixed(1), `${s.max}/5`]),
      { bars: { col: 1, values: m.symptoms.map(s => s.count), max } });
  }
  if (m.positives.length) para(doc, `Positive effects also logged: ${m.positives.map(p => `${p.label} (${p.count})`).join(", ")}.`, { size: 9, color: MUTED });

  // Possible triggers
  heading(doc, "Foods that may be linked to symptoms");
  para(doc, `Based on the last ${m.triggerLookbackDays} days of entries (not only this period). A food is listed as "Possible" only after it appeared in at least 5 meals on at least 4 different days and symptoms followed it clearly more often than other meals. Foods eaten in most meals cannot be compared and are left out. The range shows how uncertain the rate is with this many meals.`, { size: 8.8, color: MUTED });
  if (m.triggers.length === 0) empty(doc, "No food has enough entries yet to list.");
  else {
    table(doc, [{ label: "Food", w: 120 }, { label: "Symptom", w: 74 }, { label: "Followed by symptom", w: 96 }, { label: "Other meals", w: 56, align: "right" }, { label: "Plausible range", w: 78, align: "right" }, { label: "Status", w: 92 }],
      m.triggers.map(t => [t.names, t.symptom, `${t.hits} of ${t.exposures} meals (${t.rate}), ${t.days} days`, t.otherRate, `${t.range} (${t.sample})`, t.status]),
      { colorFn: (r, c) => (c === 5 && m.triggers[r].status === "Possible" ? WARN : null) });
    m.triggers.filter(t => t.note).forEach(t => para(doc, `${t.names}: ${t.note}.`, { size: 8.8 }));
  }

  // Reintroduction
  heading(doc, "Reintroduction tests");
  if (m.reintro.length === 0) empty(doc, "No completed reintroduction tests.");
  else {
    para(doc, "Structured 3-day challenges, one food group at a time, with daily symptom check-ins.", { size: 8.8, color: MUTED });
    table(doc, [{ label: "Food group", w: 150 }, { label: "Test food", w: 130 }, { label: "Result", w: 150 }, { label: "Finished", w: 86 }], m.reintro.map(r => [r.group, r.food, r.result, r.date]));
  }

  // Body
  const w = m.body.weight, wa = m.body.waist;
  if (w || wa || m.nutrition || m.strength.length) {
    heading(doc, "Body, nutrition and training");
    if (w) {
      ensure(doc, 190);
      para(doc, `Weight: ${w.start.toFixed(1)} lb to ${w.end.toFixed(1)} lb (${w.change > 0 ? "+" : ""}${w.change.toFixed(1)} lb) across ${w.entries} entries. Range ${w.min.toFixed(1)} to ${w.max.toFixed(1)} lb.`, { bold: true });
      if (w.points.length > 1) lineChart(doc, w.points, t => new Date(t).toISOString().slice(0, 10), "lb");
    }
    if (wa) para(doc, `Waist: ${wa.start.toFixed(1)} in to ${wa.end.toFixed(1)} in (${wa.change > 0 ? "+" : ""}${wa.change.toFixed(1)} in), ${wa.entries} entries.`);
    if (m.nutrition) {
      const n = m.nutrition;
      if (n.proteinAvgG != null) para(doc, `Protein: about ${n.proteinAvgG} g per day, averaged over the ${n.proteinDays} days with entries.`);
      if (n.waterAvgOz != null) para(doc, `Water logged: about ${n.waterAvgOz} oz per day, averaged over the ${n.waterDays} days with entries.`);
    }
    if (m.strength.length) {
      para(doc, "Strength (estimated one-rep max from logged sets, first to latest entry in the period):", { bold: true });
      table(doc, [{ label: "Exercise", w: 200 }, { label: "First (lb)", w: 90, align: "right" }, { label: "Latest (lb)", w: 90, align: "right" }, { label: "Change", w: 70, align: "right" }, { label: "Entries", w: 66, align: "right" }],
        m.strength.map(s => [s.exercise, String(s.first), String(s.last), `${s.change > 0 ? "+" : ""}${s.change}`, String(s.entries)]));
    }
  }

  // Labs
  if (m.labs) {
    heading(doc, "Lab results");
    if (m.labs.length === 0) empty(doc, "No lab results entered.");
    else {
      para(doc, "Most recent result for each marker, entered by the patient. Reference ranges are the ones printed on the patient's own lab report.", { size: 8.8, color: MUTED });
      table(doc, [{ label: "Marker", w: 130 }, { label: "Result", w: 82, align: "right" }, { label: "Date", w: 74 }, { label: "Lab range", w: 80 }, { label: "Flag", w: 50 }, { label: "Previous", w: 100 }],
        m.labs.map(l => [l.marker, `${l.value} ${l.unit}`, l.drawnOn, l.range ?? "none printed", l.status === "above" ? "Above" : l.status === "below" ? "Below" : l.status === "in" ? "In range" : "", l.previous ? `${l.previous.value} (${l.previous.drawnOn})` : ""]),
        { colorFn: (r, c) => (c === 4 && (m.labs![r].status === "above" || m.labs![r].status === "below") ? WARN : null) });
    }
  }

  // Protocol
  if (m.protocol) {
    heading(doc, "Medications and supplements logged");
    if (!m.protocol.compounds.length && !m.protocol.supplements.length) empty(doc, "No doses or supplements logged in this period.");
    if (m.protocol.compounds.length) {
      para(doc, "Doses the patient logged (as entered by the patient; the app does not verify them).", { size: 8.8, color: MUTED });
      table(doc, [{ label: "Compound", w: 150 }, { label: "Doses", w: 50, align: "right" }, { label: "First", w: 80 }, { label: "Latest", w: 80 }, { label: "Typical dose", w: 156 }], m.protocol.compounds.map(c => [c.name, String(c.count), c.first, c.last, c.typical]));
    }
    if (m.protocol.supplements.length) {
      para(doc, "Supplements taken:", { bold: true });
      table(doc, [{ label: "Supplement", w: 220 }, { label: "Dose", w: 150 }, { label: "Days taken", w: 146, align: "right" }], m.protocol.supplements.map(s => [s.name, s.dose ?? "", String(s.daysTaken)]));
    }
  }

  // Diary
  heading(doc, "Daily diary");
  if (m.diary.days.length === 0) empty(doc, "No meals or symptoms were logged in this period.");
  else {
    if (m.diary.truncatedFrom) para(doc, `Showing the most recent ${m.diary.days.length} logged days (from ${m.diary.truncatedFrom}). The full history can be exported from the app.`, { size: 8.8, color: MUTED });
    for (const d of m.diary.days) {
      ensure(doc, 34);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(GREEN).text(d.date, M, doc.y);
      for (const line of d.lines) {
        doc.font("Helvetica").fontSize(8.8).fillColor(INK);
        ensure(doc, doc.heightOfString(line, { width: W() - 10 }) + 2);
        doc.text(line, M + 10, doc.y, { width: W() - 10 });
      }
      doc.moveDown(0.4);
    }
  }

  // Method
  ensure(doc, 150);
  heading(doc, "How to read this report");
  para(doc, "All entries are made by the patient. Photo-based meal logging suggests foods and ingredients that the patient then confirms or edits, so ingredient lists can be incomplete. Food-to-symptom patterns are found by counting how often a symptom followed a food within a few hours, compared with other meals; no model estimates cause. Small samples are uncertain, which is why a range is shown. Symptoms can appear up to 48 hours after eating, so a pattern may point at the wrong meal. Please use this as a conversation starter with the patient, not as a diagnostic tool.", { size: 8.8, color: MUTED });

  // Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const prev = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    doc.text(`Triggerplate (triggerplate.com)  |  ${m.title}  |  Generated ${m.generatedLabel}`, M, doc.page.height - 36, { width: W() - 60, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, M + W() - 60, doc.page.height - 36, { width: 60, align: "right", lineBreak: false });
    doc.page.margins.bottom = prev;
  }
}
