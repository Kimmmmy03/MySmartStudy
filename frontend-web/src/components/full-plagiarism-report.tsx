"use client";

import { useState, useEffect, useRef } from "react";
import { assignmentsApi, FullPlagiarismReport, PlagiarismPair, StudentRisk } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Users, FileText,
  Download, ChevronDown, ChevronUp, ArrowUpDown, BarChart3, Eye,
  Loader2, X, Filter, TrendingUp,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  assignmentId: string;
  assignmentTitle: string;
  onClose: () => void;
}

type SortField = "name" | "max" | "avg" | "pairs" | "risk";
type SortDir = "asc" | "desc";
type ViewTab = "overview" | "students" | "pairs";

const SEVERITY_COLORS = {
  high: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-400" },
  clear: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
};

export default function FullPlagiarismReportView({ assignmentId, assignmentTitle, onClose }: Props) {
  const [report, setReport] = useState<FullPlagiarismReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [sortField, setSortField] = useState<SortField>("max");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    assignmentsApi.fullPlagiarismReport(assignmentId)
      .then(data => {
        // Backend may return { error: "..." } if scikit-learn is missing
        if (data && (data as any).error) {
          setError((data as any).error);
        } else {
          setReport({
            ...data,
            flagged_pairs: data.flagged_pairs ?? [],
            student_risks: data.student_risks ?? [],
            skipped_details: data.skipped_details ?? [],
            overall_stats: data.overall_stats ?? {
              avg_similarity: 0, max_similarity: 0, flagged_count: 0,
              high_severity_count: 0, medium_severity_count: 0, low_severity_count: 0, students_at_risk: 0,
            },
          });
        }
      })
      .catch(e => setError(e.message || "Failed to generate report"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const handleExportPDF = async () => {
    if (!report) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = 0;

      const checkPage = (needed: number) => { if (y + needed > pageH - 22) { pdf.addPage(); y = 20; } };
      type C3 = [number, number, number];

      // ── Colors ──
      const navy: C3 = [30, 41, 59];
      const darkText: C3 = [15, 23, 42];
      const bodyText: C3 = [51, 65, 85];
      const mutedText: C3 = [100, 116, 139];
      const lightGray: C3 = [241, 245, 249];
      const borderGray: C3 = [226, 232, 240];
      const red: C3 = [220, 38, 38];
      const redBg: C3 = [254, 242, 242];
      const amber: C3 = [217, 119, 6];
      const amberBg: C3 = [255, 251, 235];
      const emerald: C3 = [5, 150, 105];
      const emeraldBg: C3 = [236, 253, 245];
      const blue: C3 = [37, 99, 235];
      const blueBg: C3 = [239, 246, 255];
      const purple: C3 = [109, 40, 217];

      const riskColor = (level: string): C3 =>
        level === "high" ? red : level === "medium" ? amber : level === "low" ? blue : emerald;
      const riskBg = (level: string): C3 =>
        level === "high" ? redBg : level === "medium" ? amberBg : level === "low" ? blueBg : emeraldBg;

      // ── Section heading ──
      const sectionNum = { n: 1 };
      const sectionHeading = (title: string) => {
        checkPage(16);
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navy);
        pdf.text(`${sectionNum.n}. ${title}`, margin, y);
        y += 1.5;
        pdf.setDrawColor(...purple);
        pdf.setLineWidth(0.7);
        pdf.line(margin, y, margin + 50, y);
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.line(margin + 50, y, margin + contentW, y);
        y += 6;
        sectionNum.n++;
      };

      // ══════════════════════════════════════════
      //  PAGE 1 — COVER HEADER
      // ══════════════════════════════════════════

      // Top purple banner
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageW, 44, "F");
      // Accent line
      pdf.setFillColor(...purple);
      pdf.rect(0, 44, pageW, 1.2, "F");

      // Institution / platform name
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(180, 190, 210);
      pdf.text("MySmartStudy  |  Academic Integrity Division", margin, 12);

      // Title
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("Plagiarism Analysis Report", margin, 26);

      // Subtitle
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(180, 190, 210);
      pdf.text("Cross-Submission Similarity Assessment", margin, 34);

      // Date on right
      pdf.setFontSize(8);
      pdf.setTextColor(180, 190, 210);
      pdf.text(new Date(report.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        pageW - margin, 12, { align: "right" });
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      const verdictLabel = stats.high_severity_count > 0 ? "HIGH RISK" : stats.medium_severity_count > 0 ? "MODERATE RISK" : "LOW RISK";
      pdf.text(verdictLabel, pageW - margin, 26, { align: "right" });

      y = 52;

      // ── Report info grid ──
      pdf.setFillColor(...lightGray);
      pdf.roundedRect(margin, y, contentW, 20, 2, 2, "F");
      pdf.setDrawColor(...borderGray);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(margin, y, contentW, 20, 2, 2, "S");

      const infoCols = [
        { label: "Assignment", value: report.assignment_title },
        { label: "Date Generated", value: new Date(report.generated_at).toLocaleString() },
        { label: "Submissions", value: `${report.analyzed_submissions} of ${report.total_submissions} analyzed` },
        { label: "Method", value: "TF-IDF Cosine Similarity" },
      ];
      const colW = contentW / 4;
      infoCols.forEach((col, i) => {
        const cx = margin + 5 + i * colW;
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...mutedText);
        pdf.text(col.label.toUpperCase(), cx, y + 7);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkText);
        const val = col.value.length > 24 ? col.value.substring(0, 24) + "..." : col.value;
        pdf.text(val, cx, y + 14);
        // Divider
        if (i < 3) {
          pdf.setDrawColor(...borderGray);
          pdf.line(margin + (i + 1) * colW, y + 3, margin + (i + 1) * colW, y + 17);
        }
      });

      y += 28;

      // ══════════════════════════════════════════
      //  1. EXECUTIVE SUMMARY
      // ══════════════════════════════════════════

      sectionHeading("Executive Summary");

      // Verdict banner
      const isHigh = stats.high_severity_count > 0;
      const isMedium = stats.medium_severity_count > 0;
      const vColor = isHigh ? red : isMedium ? amber : emerald;
      const vBg = isHigh ? redBg : isMedium ? amberBg : emeraldBg;
      const vBorder = isHigh ? [254, 202, 202] as C3 : isMedium ? [253, 230, 138] as C3 : [167, 243, 208] as C3;

      pdf.setFillColor(...vBg);
      pdf.roundedRect(margin, y, contentW, 18, 2, 2, "F");
      pdf.setDrawColor(...vBorder);
      pdf.roundedRect(margin, y, contentW, 18, 2, 2, "S");
      // Icon circle
      pdf.setFillColor(...vColor);
      pdf.circle(margin + 9, y + 9, 4, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text(isHigh ? "!" : isMedium ? "!" : "\u2713", margin + 7.2, y + 11.2);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...vColor);
      const vTitle = isHigh ? "High Plagiarism Risk Detected" : isMedium ? "Moderate Similarity Detected" : "No Significant Plagiarism Detected";
      pdf.text(vTitle, margin + 17, y + 7.5);

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...bodyText);
      const vDesc = stats.flagged_count === 0
        ? `All ${report.analyzed_submissions} analyzed submissions appear to be original work.`
        : `${stats.flagged_count} flagged pair${stats.flagged_count !== 1 ? "s" : ""} found across ${stats.students_at_risk} student${stats.students_at_risk !== 1 ? "s" : ""}. Peak similarity: ${Math.round(stats.max_similarity * 100)}%.`;
      pdf.text(vDesc, margin + 17, y + 14);
      y += 24;

      // ── KPI boxes ──
      const kpiW = (contentW - 9) / 4;
      const kpis = [
        { label: "Analyzed", value: String(report.analyzed_submissions), sub: `of ${report.total_submissions} total`, color: blue, bg: blueBg },
        { label: "Flagged Pairs", value: String(stats.flagged_count), sub: `above 30% threshold`, color: stats.flagged_count > 0 ? amber : emerald, bg: stats.flagged_count > 0 ? amberBg : emeraldBg },
        { label: "At Risk", value: String(stats.students_at_risk), sub: "students flagged", color: stats.students_at_risk > 0 ? red : emerald, bg: stats.students_at_risk > 0 ? redBg : emeraldBg },
        { label: "Peak Similarity", value: `${Math.round(stats.max_similarity * 100)}%`, sub: "highest pair score", color: stats.max_similarity >= 0.8 ? red : stats.max_similarity >= 0.6 ? amber : emerald, bg: stats.max_similarity >= 0.8 ? redBg : stats.max_similarity >= 0.6 ? amberBg : emeraldBg },
      ];

      kpis.forEach((k, i) => {
        const kx = margin + i * (kpiW + 3);
        pdf.setFillColor(...k.bg);
        pdf.roundedRect(kx, y, kpiW, 24, 2, 2, "F");
        pdf.setDrawColor(...borderGray);
        pdf.roundedRect(kx, y, kpiW, 24, 2, 2, "S");
        // Value
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...k.color);
        pdf.text(k.value, kx + kpiW / 2, y + 11, { align: "center" });
        // Label
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkText);
        pdf.text(k.label, kx + kpiW / 2, y + 17, { align: "center" });
        // Sub
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...mutedText);
        pdf.text(k.sub, kx + kpiW / 2, y + 21.5, { align: "center" });
      });
      y += 32;

      // ══════════════════════════════════════════
      //  2. SEVERITY DISTRIBUTION (Pie + Bar chart)
      // ══════════════════════════════════════════

      if (stats.flagged_count > 0) {
        sectionHeading("Severity Distribution");

        const chartBoxH = 50;
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, y, contentW, chartBoxH, 2, 2, "S");

        // ── Left: Donut chart ──
        const cx = margin + 35;
        const cy = y + chartBoxH / 2;
        const outerR = 18;
        const innerR = 10;
        const slices = [
          { count: stats.high_severity_count, color: red, label: "High" },
          { count: stats.medium_severity_count, color: amber, label: "Medium" },
          { count: stats.low_severity_count, color: blue, label: "Low" },
        ].filter(s => s.count > 0);
        const total = slices.reduce((s, v) => s + v.count, 0);

        let startAngle = -Math.PI / 2;
        slices.forEach(slice => {
          const sweepAngle = (slice.count / total) * 2 * Math.PI;
          const endAngle = startAngle + sweepAngle;
          // Draw filled arc using small triangle segments
          pdf.setFillColor(...slice.color);
          const steps = Math.max(20, Math.ceil(sweepAngle * 30));
          for (let s = 0; s < steps; s++) {
            const a1 = startAngle + (s / steps) * sweepAngle;
            const a2 = startAngle + ((s + 1) / steps) * sweepAngle;
            const points = [
              { x: cx + Math.cos(a1) * innerR, y: cy + Math.sin(a1) * innerR },
              { x: cx + Math.cos(a1) * outerR, y: cy + Math.sin(a1) * outerR },
              { x: cx + Math.cos(a2) * outerR, y: cy + Math.sin(a2) * outerR },
              { x: cx + Math.cos(a2) * innerR, y: cy + Math.sin(a2) * innerR },
            ];
            pdf.triangle(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y, "F");
            pdf.triangle(points[0].x, points[0].y, points[2].x, points[2].y, points[3].x, points[3].y, "F");
          }
          startAngle = endAngle;
        });

        // Center text
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkText);
        pdf.text(String(total), cx, cy + 1.5, { align: "center" });
        pdf.setFontSize(5.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...mutedText);
        pdf.text("PAIRS", cx, cy + 5.5, { align: "center" });

        // Legend
        let ly = y + 12;
        slices.forEach(slice => {
          pdf.setFillColor(...slice.color);
          pdf.roundedRect(margin + 58, ly, 4, 4, 1, 1, "F");
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...darkText);
          pdf.text(`${slice.label}`, margin + 65, ly + 3.2);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...mutedText);
          pdf.text(`${slice.count} pair${slice.count !== 1 ? "s" : ""} (${Math.round((slice.count / total) * 100)}%)`, margin + 80, ly + 3.2);
          ly += 9;
        });

        // ── Right: Horizontal bar chart of student risk levels ──
        const barStartX = margin + contentW / 2 + 8;
        const barAreaW = contentW / 2 - 14;
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkText);
        pdf.text("Student Risk Distribution", barStartX, y + 8);

        const riskCounts = [
          { label: "High Risk", count: report.student_risks.filter(s => s.risk_level === "high").length, color: red, bg: redBg },
          { label: "Medium Risk", count: report.student_risks.filter(s => s.risk_level === "medium").length, color: amber, bg: amberBg },
          { label: "Low Risk", count: report.student_risks.filter(s => s.risk_level === "low").length, color: blue, bg: blueBg },
          { label: "Clear", count: report.student_risks.filter(s => s.risk_level === "clear").length, color: emerald, bg: emeraldBg },
        ];
        const maxCount = Math.max(...riskCounts.map(r => r.count), 1);
        let by = y + 14;

        riskCounts.forEach(rc => {
          // Label
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...bodyText);
          pdf.text(rc.label, barStartX, by + 3);
          // Bar background
          const barX = barStartX + 24;
          const barW = barAreaW - 34;
          pdf.setFillColor(...lightGray);
          pdf.roundedRect(barX, by, barW, 5, 1.5, 1.5, "F");
          // Bar fill
          if (rc.count > 0) {
            const fillW = Math.max(3, (rc.count / maxCount) * barW);
            pdf.setFillColor(...rc.color);
            pdf.roundedRect(barX, by, fillW, 5, 1.5, 1.5, "F");
          }
          // Count
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...rc.color);
          pdf.text(String(rc.count), barX + barW + 3, by + 3.5);
          by += 9;
        });

        y += chartBoxH + 8;
      }

      // ══════════════════════════════════════════
      //  3. STUDENT RISK ASSESSMENT TABLE
      // ══════════════════════════════════════════

      sectionHeading("Student Risk Assessment");

      const studentRows = report.student_risks.map((s, i) => [
        String(i + 1),
        s.student_name,
        (s.submission_type || "n/a").charAt(0).toUpperCase() + (s.submission_type || "n/a").slice(1),
        `${Math.round(s.max_similarity * 100)}%`,
        `${Math.round(s.avg_similarity * 100)}%`,
        String(s.flagged_pairs_count),
        s.risk_level.toUpperCase(),
      ]);

      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["#", "Student Name", "Type", "Max Sim.", "Avg Sim.", "Flagged Pairs", "Risk Level"]],
        body: studentRows,
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          textColor: bodyText,
          lineColor: borderGray,
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: navy,
          textColor: [255, 255, 255] as C3,
          fontStyle: "bold",
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] as C3,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42 },
          2: { cellWidth: 18 },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 22, halign: "center" },
          6: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const level = data.cell.raw?.toString().toLowerCase() || "";
            data.cell.styles.textColor = riskColor(level);
            data.cell.styles.fillColor = riskBg(level);
          }
          if (data.section === "body" && data.column.index === 3) {
            const val = parseInt(data.cell.raw?.toString() || "0");
            if (val >= 80) data.cell.styles.textColor = red;
            else if (val >= 60) data.cell.styles.textColor = amber;
          }
        },
      });

      y = (pdf as any).lastAutoTable.finalY + 10;

      // ══════════════════════════════════════════
      //  4. FLAGGED PAIRS TABLE
      // ══════════════════════════════════════════

      if (report.flagged_pairs.length > 0) {
        sectionHeading("Flagged Submission Pairs");

        const pairRows = report.flagged_pairs.map((p, i) => [
          String(i + 1),
          p.student_a_name,
          p.student_b_name,
          `${Math.round(p.similarity * 100)}%`,
          p.severity.toUpperCase(),
          `${p.student_a_type} / ${p.student_b_type}`,
        ]);

        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Student A", "Student B", "Similarity", "Severity", "Submission Types"]],
          body: pairRows,
          theme: "grid",
          styles: {
            fontSize: 7.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: bodyText,
            lineColor: borderGray,
            lineWidth: 0.3,
          },
          headStyles: {
            fillColor: navy,
            textColor: [255, 255, 255] as C3,
            fontStyle: "bold",
            fontSize: 7,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252] as C3,
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            3: { cellWidth: 22, halign: "center", fontStyle: "bold" },
            4: { cellWidth: 22, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 30, halign: "center" },
          },
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 3) {
              const val = parseInt(data.cell.raw?.toString() || "0");
              data.cell.styles.textColor = val >= 80 ? red : val >= 60 ? amber : blue;
            }
            if (data.section === "body" && data.column.index === 4) {
              const sev = data.cell.raw?.toString().toLowerCase() || "";
              data.cell.styles.textColor = riskColor(sev);
              data.cell.styles.fillColor = riskBg(sev);
            }
          },
        });

        y = (pdf as any).lastAutoTable.finalY + 10;
      }

      // ══════════════════════════════════════════
      //  5. SIMILARITY SCORE CHART (bar chart per pair)
      // ══════════════════════════════════════════

      if (report.flagged_pairs.length > 0) {
        sectionHeading("Similarity Score Comparison");

        const chartH = Math.min(60, 8 + report.flagged_pairs.length * 9);
        checkPage(chartH + 10);

        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, y, contentW, chartH, 2, 2, "S");

        const chartMargin = 6;
        const labelW = 55;
        const barAreaStart = margin + labelW + 4;
        const barMaxW = contentW - labelW - chartMargin * 2 - 10;
        let cy = y + chartMargin;

        // Scale lines
        [0, 25, 50, 75, 100].forEach(pct => {
          const lx = barAreaStart + (pct / 100) * barMaxW;
          pdf.setDrawColor(240, 240, 240);
          pdf.setLineWidth(0.2);
          pdf.line(lx, y + 2, lx, y + chartH - 2);
          if (pct > 0) {
            pdf.setFontSize(5.5);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(...mutedText);
            pdf.text(`${pct}%`, lx, y + chartH - 1, { align: "center" });
          }
        });

        // Threshold line at 30%
        const threshX = barAreaStart + 0.3 * barMaxW;
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.4);
        pdf.setLineDashPattern([1.5, 1.5], 0);
        pdf.line(threshX, y + 2, threshX, y + chartH - 5);
        pdf.setLineDashPattern([], 0);

        report.flagged_pairs.slice(0, 6).forEach((p, i) => {
          const barY = cy + i * 9;
          const simPct = p.similarity;
          const barW = simPct * barMaxW;
          const c = riskColor(p.severity);

          // Label
          pdf.setFontSize(6.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...bodyText);
          const label = `${p.student_a_name.split(" ")[0]} vs ${p.student_b_name.split(" ")[0]}`;
          pdf.text(label.length > 28 ? label.substring(0, 28) + ".." : label, margin + chartMargin, barY + 4.5);

          // Bar
          pdf.setFillColor(...lightGray);
          pdf.roundedRect(barAreaStart, barY + 0.5, barMaxW, 5, 1.5, 1.5, "F");
          pdf.setFillColor(...c);
          if (barW > 3) pdf.roundedRect(barAreaStart, barY + 0.5, barW, 5, 1.5, 1.5, "F");

          // Score label
          pdf.setFontSize(6.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...c);
          pdf.text(`${Math.round(simPct * 100)}%`, barAreaStart + barW + 2, barY + 4.5);
        });

        y += chartH + 8;
      }

      // ══════════════════════════════════════════
      //  6. NOTES & METHODOLOGY
      // ══════════════════════════════════════════

      sectionHeading("Methodology & Notes");

      const notes = [
        "This report was generated using TF-IDF (Term Frequency-Inverse Document Frequency) vectorization with cosine similarity measurement.",
        `Similarity threshold: 30%. Pairs scoring above this threshold are flagged. Severity levels: High (\u226580%), Medium (60\u201380%), Low (30\u201360%).`,
        `${report.analyzed_submissions} of ${report.total_submissions} submissions contained sufficient text content for analysis.${report.skipped_submissions > 0 ? ` ${report.skipped_submissions} submission${report.skipped_submissions !== 1 ? "s were" : " was"} excluded due to insufficient text.` : ""}`,
        "High similarity scores do not automatically indicate plagiarism. Manual review is recommended for all flagged pairs before taking action.",
        "This analysis compares submissions within this assignment only. It does not check against external sources or the internet.",
      ];

      notes.forEach((note, i) => {
        checkPage(12);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...bodyText);
        const lines = pdf.splitTextToSize(`${i + 1}. ${note}`, contentW - 6);
        pdf.text(lines, margin + 3, y);
        y += lines.length * 3.8 + 2;
      });

      // Skipped students
      if (report.skipped_details.length > 0) {
        y += 3;
        checkPage(12);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...darkText);
        pdf.text("Excluded Submissions:", margin + 3, y);
        y += 5;
        report.skipped_details.forEach(s => {
          checkPage(6);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...mutedText);
          pdf.text(`\u2022  ${s.student_name} \u2014 ${s.reason}`, margin + 6, y);
          y += 4.5;
        });
      }

      // ══════════════════════════════════════════
      //  DISCLAIMER BOX
      // ══════════════════════════════════════════

      y += 5;
      checkPage(22);
      pdf.setFillColor(...lightGray);
      pdf.roundedRect(margin, y, contentW, 16, 2, 2, "F");
      pdf.setDrawColor(...borderGray);
      pdf.roundedRect(margin, y, contentW, 16, 2, 2, "S");
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...darkText);
      pdf.text("Disclaimer", margin + 5, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...mutedText);
      const discLines = pdf.splitTextToSize(
        "This report is generated automatically and is intended as a screening tool only. Similarity scores reflect textual overlap and do not constitute proof of academic misconduct. Instructors should review flagged submissions carefully and follow institutional policies before taking any disciplinary action.",
        contentW - 10
      );
      pdf.text(discLines, margin + 5, y + 9.5);

      // ══════════════════════════════════════════
      //  FOOTER ON EVERY PAGE
      // ══════════════════════════════════════════

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        // Top line (except page 1 which has banner)
        if (i > 1) {
          pdf.setDrawColor(...borderGray);
          pdf.setLineWidth(0.3);
          pdf.line(margin, 14, pageW - margin, 14);
          pdf.setFontSize(7);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(...mutedText);
          pdf.text("Plagiarism Analysis Report", margin, 11);
          pdf.text(report.assignment_title.length > 40 ? report.assignment_title.substring(0, 40) + "..." : report.assignment_title, pageW - margin, 11, { align: "right" });
        }
        // Bottom footer
        pdf.setDrawColor(...borderGray);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageH - 14, pageW - margin, pageH - 14);
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...mutedText);
        pdf.text("MySmartStudy  \u00B7  Academic Integrity Report", margin, pageH - 9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...navy);
        pdf.text("CONFIDENTIAL", pageW / 2, pageH - 9, { align: "center" });
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...mutedText);
        pdf.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 9, { align: "right" });
      }

      pdf.save(`plagiarism-report-${assignmentTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
      alert("Failed to export PDF. Please try again.");
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortedStudents = (report?.student_risks || [])
    .filter(s => filterRisk === "all" || s.risk_level === filterRisk)
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name": return dir * a.student_name.localeCompare(b.student_name);
        case "max": return dir * (a.max_similarity - b.max_similarity);
        case "avg": return dir * (a.avg_similarity - b.avg_similarity);
        case "pairs": return dir * (a.flagged_pairs_count - b.flagged_pairs_count);
        case "risk": {
          const order = { clear: 0, low: 1, medium: 2, high: 3 };
          return dir * (order[a.risk_level] - order[b.risk_level]);
        }
        default: return 0;
      }
    });

  const filteredPairs = (report?.flagged_pairs || [])
    .filter(p => !selectedStudent || p.student_a_id === selectedStudent || p.student_b_id === selectedStudent);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-10 h-10 text-accent-purple animate-spin" />
        <p className="text-sm text-gray-400 dark:text-dark-400">Analyzing submissions for plagiarism...</p>
        <p className="text-xs text-gray-500 dark:text-dark-500">Comparing all submissions using TF-IDF similarity</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const defaultStats = {
    avg_similarity: 0, max_similarity: 0, flagged_count: 0,
    high_severity_count: 0, medium_severity_count: 0, low_severity_count: 0, students_at_risk: 0,
  };
  const stats = report.overall_stats ?? defaultStats;

  return (
    <div className="flex flex-col h-full" ref={reportRef}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200/10 dark:border-white/5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-accent-purple" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Plagiarism Report</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-dark-400">
              {assignmentTitle} &middot; Generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/20 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
            <button onClick={onClose}
              className="p-2 rounded-xl text-gray-400 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4">
          <StatCard label="Total" value={report.total_submissions} icon={<Users className="w-4 h-4" />} color="text-gray-400 dark:text-dark-300" />
          <StatCard label="Analyzed" value={report.analyzed_submissions} icon={<Eye className="w-4 h-4" />} color="text-accent-blue" />
          <StatCard label="Skipped" value={report.skipped_submissions} icon={<FileText className="w-4 h-4" />} color="text-gray-500 dark:text-dark-500" />
          <StatCard label="Flagged Pairs" value={stats.flagged_count} icon={<AlertTriangle className="w-4 h-4" />}
            color={stats.flagged_count > 0 ? "text-amber-400" : "text-emerald-400"} />
          <StatCard label="High Risk" value={stats.high_severity_count} icon={<ShieldAlert className="w-4 h-4" />} color="text-red-400" />
          <StatCard label="Medium Risk" value={stats.medium_severity_count} icon={<Shield className="w-4 h-4" />} color="text-amber-400" />
          <StatCard label="Max Similarity" value={`${Math.round(stats.max_similarity * 100)}%`} icon={<TrendingUp className="w-4 h-4" />}
            color={stats.max_similarity >= 0.8 ? "text-red-400" : stats.max_similarity >= 0.6 ? "text-amber-400" : "text-emerald-400"} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 p-1 rounded-xl bg-gray-100/50 dark:bg-white/3 w-fit">
          {(["overview", "students", "pairs"] as ViewTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx("px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeTab === tab
                  ? "bg-white dark:bg-accent-purple/20 text-gray-900 dark:text-accent-purple shadow-sm"
                  : "text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white"
              )}>
              {tab === "overview" ? "Overview" : tab === "students" ? "Student Risks" : "Flagged Pairs"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <OverviewTab report={report} onViewStudent={(sid) => { setSelectedStudent(sid); setActiveTab("pairs"); }} />
            </motion.div>
          )}
          {activeTab === "students" && (
            <motion.div key="students" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100/50 dark:bg-white/3">
                  <Filter className="w-3 h-3 text-gray-400 dark:text-dark-500 ml-2" />
                  {["all", "high", "medium", "low", "clear"].map(f => (
                    <button key={f} onClick={() => setFilterRisk(f)}
                      className={clsx("px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                        filterRisk === f
                          ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 dark:text-dark-400 hover:text-gray-900 dark:hover:text-white"
                      )}>
                      {f}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400 dark:text-dark-500">{sortedStudents.length} students</span>
              </div>

              <div className="rounded-2xl border border-gray-200/10 dark:border-white/5 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_100px_100px_80px_90px] gap-2 px-4 py-3 bg-gray-50/50 dark:bg-white/2 text-xs font-semibold text-gray-500 dark:text-dark-400">
                  <SortHeader label="Student" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Max Sim." field="max" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Avg Sim." field="avg" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Pairs" field="pairs" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Risk" field="risk" current={sortField} dir={sortDir} onSort={toggleSort} />
                </div>

                {/* Table body */}
                {sortedStudents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-dark-400 text-sm">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    No students match this filter
                  </div>
                ) : (
                  sortedStudents.map((s, i) => (
                    <motion.div key={s.student_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => { setSelectedStudent(s.student_id); setActiveTab("pairs"); }}
                      className="grid grid-cols-[1fr_100px_100px_80px_90px] gap-2 px-4 py-3 border-t border-gray-100/50 dark:border-white/3 hover:bg-gray-50/50 dark:hover:bg-white/2 cursor-pointer transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          SEVERITY_COLORS[s.risk_level].bg, SEVERITY_COLORS[s.risk_level].text)}>
                          {s.student_name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.student_name}</p>
                          <p className="text-xs text-gray-400 dark:text-dark-500 capitalize">{s.submission_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <SimBar value={s.max_similarity} />
                      </div>
                      <div className="flex items-center">
                        <SimBar value={s.avg_similarity} />
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-dark-300 font-medium">
                        {s.flagged_pairs_count}
                      </div>
                      <div className="flex items-center">
                        <RiskBadge level={s.risk_level} />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          {activeTab === "pairs" && (
            <motion.div key="pairs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {selectedStudent && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-400 dark:text-dark-400">
                    Filtered by: <strong className="text-gray-900 dark:text-white">
                      {report.student_risks.find(s => s.student_id === selectedStudent)?.student_name}
                    </strong>
                  </span>
                  <button onClick={() => setSelectedStudent(null)}
                    className="text-xs text-accent-purple hover:underline">Clear filter</button>
                </div>
              )}

              {filteredPairs.length === 0 ? (
                <div className="text-center py-16">
                  <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-gray-900 dark:text-white font-semibold">No Flagged Pairs</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                    {selectedStudent ? "This student has no flagged similarity pairs" : "No submissions exceeded the similarity threshold"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPairs.map((p, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={clsx("rounded-2xl border transition-colors overflow-hidden",
                        SEVERITY_COLORS[p.severity].border,
                        expandedPair === i ? "bg-gray-50/30 dark:bg-white/2" : "bg-white/0 hover:bg-gray-50/30 dark:hover:bg-white/2"
                      )}>
                      <button onClick={() => setExpandedPair(expandedPair === i ? null : i)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left">
                        <div className={clsx("w-2 h-2 rounded-full shrink-0", SEVERITY_COLORS[p.severity].dot)} />
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.student_a_name}</span>
                          <span className="text-xs text-gray-400 dark:text-dark-500 shrink-0">vs</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.student_b_name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24">
                            <SimBar value={p.similarity} />
                          </div>
                          <span className={clsx("text-xs font-bold tabular-nums", SEVERITY_COLORS[p.severity].text)}>
                            {Math.round(p.similarity * 100)}%
                          </span>
                          <span className={clsx("px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                            SEVERITY_COLORS[p.severity].bg, SEVERITY_COLORS[p.severity].text)}>
                            {p.severity}
                          </span>
                          {expandedPair === i ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-dark-500" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-dark-500" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedPair === i && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-5 pb-4 pt-0 grid grid-cols-2 gap-4">
                              <StudentDetailCard name={p.student_a_name} type={p.student_a_type} />
                              <StudentDetailCard name={p.student_b_name} type={p.student_b_type} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function OverviewTab({ report, onViewStudent }: { report: FullPlagiarismReport; onViewStudent: (id: string) => void }) {
  const stats = report.overall_stats;
  const highRiskStudents = report.student_risks.filter(s => s.risk_level === "high");
  const mediumRiskStudents = report.student_risks.filter(s => s.risk_level === "medium");

  return (
    <div className="space-y-6">
      {/* Integrity verdict */}
      <div className={clsx("rounded-2xl border p-5 flex items-start gap-4",
        stats.high_severity_count > 0
          ? "border-red-500/20 bg-red-500/5"
          : stats.medium_severity_count > 0
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-emerald-500/20 bg-emerald-500/5"
      )}>
        {stats.high_severity_count > 0 ? (
          <ShieldAlert className="w-8 h-8 text-red-400 shrink-0 mt-0.5" />
        ) : stats.medium_severity_count > 0 ? (
          <Shield className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <div>
          <h3 className={clsx("text-base font-bold",
            stats.high_severity_count > 0 ? "text-red-400" :
            stats.medium_severity_count > 0 ? "text-amber-400" : "text-emerald-400"
          )}>
            {stats.high_severity_count > 0
              ? "High Plagiarism Risk Detected"
              : stats.medium_severity_count > 0
                ? "Moderate Similarity Found"
                : "No Significant Plagiarism Detected"
            }
          </h3>
          <p className="text-sm text-gray-600 dark:text-dark-300 mt-1">
            {stats.flagged_count === 0
              ? `All ${report.analyzed_submissions} analyzed submissions appear to be unique.`
              : `Found ${stats.flagged_count} flagged pair${stats.flagged_count !== 1 ? "s" : ""} across ${stats.students_at_risk} student${stats.students_at_risk !== 1 ? "s" : ""}. Maximum similarity: ${Math.round(stats.max_similarity * 100)}%.`
            }
          </p>
          {report.skipped_submissions > 0 && (
            <p className="text-xs text-gray-500 dark:text-dark-500 mt-2">
              Note: {report.skipped_submissions} submission{report.skipped_submissions !== 1 ? "s were" : " was"} skipped due to insufficient text content.
            </p>
          )}
        </div>
      </div>

      {/* Severity breakdown visual */}
      {stats.flagged_count > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <SeverityCard label="High Severity" count={stats.high_severity_count} total={stats.flagged_count}
            color="red" description="80%+ similarity" />
          <SeverityCard label="Medium Severity" count={stats.medium_severity_count} total={stats.flagged_count}
            color="amber" description="60-80% similarity" />
          <SeverityCard label="Low Severity" count={stats.low_severity_count} total={stats.flagged_count}
            color="blue" description="30-60% similarity" />
        </div>
      )}

      {/* At-risk students */}
      {(highRiskStudents.length > 0 || mediumRiskStudents.length > 0) && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Students Requiring Attention
          </h4>
          <div className="space-y-2">
            {[...highRiskStudents, ...mediumRiskStudents].map(s => (
              <button key={s.student_id} onClick={() => onViewStudent(s.student_id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/10 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/3 transition-colors text-left">
                <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                  SEVERITY_COLORS[s.risk_level].bg, SEVERITY_COLORS[s.risk_level].text)}>
                  {s.student_name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.student_name}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-500">
                    Max similarity: {Math.round(s.max_similarity * 100)}% &middot; {s.flagged_pairs_count} flagged pair{s.flagged_pairs_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <RiskBadge level={s.risk_level} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top flagged pairs preview */}
      {report.flagged_pairs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent-purple" /> Top Flagged Pairs
          </h4>
          <div className="space-y-2">
            {report.flagged_pairs.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/10 dark:border-white/5 bg-white/0">
                <span className="text-xs text-gray-500 dark:text-dark-500 font-mono w-5">{i + 1}.</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium truncate">{p.student_a_name}</span>
                <span className="text-xs text-gray-400 dark:text-dark-500 shrink-0">vs</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium truncate">{p.student_b_name}</span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <div className="w-20"><SimBar value={p.similarity} /></div>
                  <span className={clsx("text-xs font-bold tabular-nums", SEVERITY_COLORS[p.severity].text)}>
                    {Math.round(p.similarity * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200/10 dark:border-white/5 bg-white/0 p-3 text-center">
      <div className={clsx("flex items-center justify-center gap-1.5 mb-1", color)}>{icon}</div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-dark-500">{label}</p>
    </div>
  );
}

function SeverityCard({ label, count, total, color, description }: {
  label: string; count: number; total: number; color: "red" | "amber" | "blue"; description: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colorMap = {
    red: { bg: "bg-red-500/10", text: "text-red-400", bar: "bg-red-500" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", bar: "bg-amber-500" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", bar: "bg-blue-400" },
  };
  const c = colorMap[color];
  return (
    <div className={clsx("rounded-xl border p-4", c.bg, `border-${color === "red" ? "red" : color === "amber" ? "amber" : "blue"}-500/10`)}>
      <p className={clsx("text-2xl font-bold", c.text)}>{count}</p>
      <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{label}</p>
      <p className="text-xs text-gray-500 dark:text-dark-500">{description}</p>
      <div className="h-1 rounded-full bg-gray-200/20 dark:bg-white/5 mt-2 overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", c.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SimBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : pct >= 30 ? "bg-blue-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200/20 dark:bg-white/5 overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-dark-300 tabular-nums font-medium w-8 text-right">{pct}%</span>
    </div>
  );
}

function RiskBadge({ level }: { level: "clear" | "low" | "medium" | "high" }) {
  return (
    <span className={clsx("px-2.5 py-1 rounded-full text-xs font-semibold uppercase",
      SEVERITY_COLORS[level].bg, SEVERITY_COLORS[level].text)}>
      {level}
    </span>
  );
}

function SortHeader({ label, field, current, dir, onSort }: {
  label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void;
}) {
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
      {label}
      {current === field && (
        dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
      {current !== field && <ArrowUpDown className="w-3 h-3 opacity-30" />}
    </button>
  );
}

function StudentDetailCard({ name, type }: { name: string; type: string }) {
  return (
    <div className="rounded-xl border border-gray-200/10 dark:border-white/5 p-3 bg-white/0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-accent-purple/10 flex items-center justify-center text-xs font-bold text-accent-purple">
          {name?.charAt(0).toUpperCase() || "?"}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
          <p className="text-xs text-gray-500 dark:text-dark-500 capitalize">{type} submission</p>
        </div>
      </div>
    </div>
  );
}
