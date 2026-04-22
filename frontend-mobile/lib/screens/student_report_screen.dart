import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/glass_card.dart';
import '../widgets/skeletons.dart';

// ── Pastel palette ──
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);
const _pSky = Color(0xFF8BB5C9);

Color _gradeColor(double pct) {
  if (pct >= 80) return _pSeafoam;
  if (pct >= 60) return _pSky;
  if (pct >= 50) return _pSand;
  return _pRose;
}

String _gradeLabel(double pct) {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 50) return 'Pass';
  return 'Needs work';
}

class StudentReportScreen extends StatefulWidget {
  final String studentId;
  final String courseId;
  final String courseName;
  final String studentName;
  final String? studentPhotoUrl;
  const StudentReportScreen({
    super.key,
    required this.studentId,
    required this.courseId,
    required this.courseName,
    required this.studentName,
    this.studentPhotoUrl,
  });

  @override
  State<StudentReportScreen> createState() => _StudentReportScreenState();
}

class _StudentReportScreenState extends State<StudentReportScreen> {
  Map<String, dynamic>? _report;
  bool _loading = true;
  bool _exporting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ApiService.getStudentReport(widget.studentId, widget.courseId);
      if (!mounted) return;
      setState(() {
        _report = r;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _exportPdf() async {
    if (_report == null) return;
    setState(() => _exporting = true);
    HapticFeedback.lightImpact();
    try {
      final pdf = await _buildPdf(_report!);
      final bytes = await pdf.save();
      await Printing.sharePdf(
        bytes: bytes,
        filename:
            'report_${widget.studentName.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_')}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: _pRose),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AppBar(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Student Report',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(widget.courseName,
                      style: TextStyle(fontSize: 11, color: c.textSecondary),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
              backgroundColor:
                  (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
              actions: [
                IconButton(
                  icon: Icon(Icons.refresh_rounded, color: c.textSecondary, size: 22),
                  tooltip: 'Refresh',
                  onPressed: _loading
                      ? null
                      : () {
                          HapticFeedback.lightImpact();
                          _load();
                        },
                ),
                IconButton(
                  tooltip: 'Download PDF',
                  icon: _exporting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _pSlate))
                      : const Icon(Icons.picture_as_pdf_rounded, color: _pSlate),
                  onPressed:
                      (_loading || _report == null || _exporting) ? null : _exportPdf,
                ),
                const SizedBox(width: 4),
              ],
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 6)
              : _error != null
                  ? _buildError()
                  : _report == null
                      ? _buildEmpty()
                      : RefreshIndicator(
                          color: _pSlate,
                          onRefresh: _load,
                          child: _buildBody(_report!),
                        ),
        ),
      ),
    );
  }

  // ── Body ────────────────────────────────────────────────────────────────
  Widget _buildBody(Map<String, dynamic> report) {
    final student = Map<String, dynamic>.from(report['student'] ?? {});
    final gradebook = report['gradebook'] == null
        ? null
        : Map<String, dynamic>.from(report['gradebook']);
    final attendance = Map<String, dynamic>.from(report['attendance'] ?? {});
    final activityCount = ((report['activity_count'] ?? 0) as num).toInt();
    final reviewsGiven = ((report['reviews_given'] ?? 0) as num).toInt();

    final avgRaw = gradebook?['average'];
    final avg = avgRaw is num ? avgRaw.toDouble() : null;
    final totalSessions = ((attendance['total_sessions'] ?? 0) as num).toInt();
    final attPct = ((attendance['percentage'] ?? 0) as num).toDouble();
    final entries = (gradebook?['entries'] as List?) ?? [];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      children: [
        _studentHeader(student),
        const SizedBox(height: 14),
        _quickStats(
          avg: avg,
          attPct: attPct,
          totalSessions: totalSessions,
          activity: activityCount,
          reviews: reviewsGiven,
        ),
        const SizedBox(height: 18),
        _attendanceSection(attendance),
        const SizedBox(height: 18),
        _gradesSection(entries),
      ],
    );
  }

  // ── Header ──────────────────────────────────────────────────────────────
  Widget _studentHeader(Map<String, dynamic> student) {
    final c = context.colors;
    final name = student['name']?.toString().isNotEmpty == true
        ? student['name'].toString()
        : widget.studentName;
    final email = student['email']?.toString() ?? '';
    final points = ((student['points'] ?? 0) as num).toInt();
    final streak = ((student['streak'] ?? 0) as num).toInt();
    final badges = (student['badges'] as List?)?.length ?? 0;
    final photo = ApiService.resolvePhotoUrl(
            student['photo_url']?.toString() ?? student['photoURL']?.toString()) ??
        widget.studentPhotoUrl;

    return GlassCard(
      gradient: LinearGradient(
        colors: [
          _pSlate.withOpacity(context.isDark ? 0.18 : 0.10),
          _pLavender.withOpacity(context.isDark ? 0.14 : 0.06),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          AvatarWidget(name: name, imageUrl: photo, size: 60, role: 'student'),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis),
                if (email.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(email,
                      style: TextStyle(color: c.textMuted, fontSize: 12),
                      overflow: TextOverflow.ellipsis),
                ],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _pill(Icons.star_rounded, '$points pts', _pSand),
                    _pill(Icons.local_fire_department_rounded,
                        streak > 0 ? '$streak day streak' : 'No streak', _pRose),
                    _pill(Icons.workspace_premium_rounded,
                        badges > 0 ? '$badges badges' : 'No badges', _pLavender),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  color: color, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ── Quick stats ─────────────────────────────────────────────────────────
  Widget _quickStats({
    required double? avg,
    required double attPct,
    required int totalSessions,
    required int activity,
    required int reviews,
  }) {
    return Row(
      children: [
        Expanded(
          child: _statTile(
            label: 'Grade Avg',
            value: avg != null ? '${avg.toStringAsFixed(1)}%' : '0',
            subtitle: avg != null ? _gradeLabel(avg) : 'No grades yet',
            color: avg != null ? _gradeColor(avg) : _pSlate,
            icon: Icons.trending_up_rounded,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statTile(
            label: 'Attendance',
            value: totalSessions == 0 ? '—' : '${attPct.round()}%',
            subtitle: totalSessions == 0
                ? 'No sessions'
                : '$totalSessions session${totalSessions == 1 ? "" : "s"}',
            color: totalSessions == 0
                ? _pSlate
                : (attPct >= 80 ? _pSeafoam : (attPct >= 60 ? _pSand : _pRose)),
            icon: Icons.fact_check_rounded,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statTile(
            label: 'Activity',
            value: '$activity',
            subtitle: activity == 0 ? 'No activity' : 'events',
            color: _pSky,
            icon: Icons.bolt_rounded,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statTile(
            label: 'Reviews',
            value: '$reviews',
            subtitle: reviews == 0 ? 'None given' : 'given',
            color: _pSand,
            icon: Icons.rate_review_rounded,
          ),
        ),
      ],
    );
  }

  Widget _statTile({
    required String label,
    required String value,
    required String subtitle,
    required Color color,
    required IconData icon,
  }) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: Column(
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(height: 5),
          Text(value,
              style: TextStyle(
                  color: color, fontSize: 15, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 10,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 1),
          Text(subtitle,
              style: TextStyle(color: c.textMuted, fontSize: 9),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center),
        ],
      ),
    );
  }

  // ── Attendance section ──────────────────────────────────────────────────
  Widget _attendanceSection(Map<String, dynamic> attendance) {
    final c = context.colors;
    final total = ((attendance['total_sessions'] ?? 0) as num).toInt();
    final present = ((attendance['present'] ?? 0) as num).toInt();
    final late = ((attendance['late'] ?? 0) as num).toInt();
    final absent = ((attendance['absent'] ?? 0) as num).toInt();
    final pct = ((attendance['percentage'] ?? 0) as num).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(Icons.event_available_rounded, 'Attendance', _pSeafoam),
        const SizedBox(height: 8),
        GlassCard(
          padding: const EdgeInsets.all(14),
          child: total == 0
              ? Row(
                  children: [
                    Icon(Icons.event_busy_rounded,
                        size: 18, color: c.textMuted),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'No attendance sessions yet. Sessions will appear here once the lecturer creates them.',
                        style: TextStyle(color: c.textSecondary, fontSize: 12, height: 1.4),
                      ),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${pct.round()}% attendance rate',
                            style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600)),
                        Text('${present + late} / $total',
                            style: TextStyle(
                                color: c.textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w500)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: (pct / 100.0).clamp(0, 1),
                        minHeight: 6,
                        backgroundColor: context.isDark
                            ? Colors.white.withOpacity(0.06)
                            : Colors.black.withOpacity(0.05),
                        valueColor: AlwaysStoppedAnimation<Color>(
                            pct >= 80
                                ? _pSeafoam
                                : (pct >= 60 ? _pSand : _pRose)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        _attCell(present, 'Present', _pSeafoam, Icons.check_rounded),
                        _attCell(late, 'Late', _pSand, Icons.schedule_rounded),
                        _attCell(absent, 'Absent', _pRose, Icons.close_rounded),
                        _attCell(total, 'Total', _pSlate, Icons.event_rounded),
                      ],
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _attCell(int value, String label, Color color, IconData icon) {
    final c = context.colors;
    return Expanded(
      child: Column(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withOpacity(0.3)),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(height: 5),
          Text('$value',
              style: TextStyle(
                  color: color, fontSize: 16, fontWeight: FontWeight.bold)),
          Text(label, style: TextStyle(color: c.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  // ── Grades section ──────────────────────────────────────────────────────
  Widget _gradesSection(List entries) {
    final c = context.colors;
    if (entries.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader(Icons.grading_rounded, 'Grades', _pSlate),
          const SizedBox(height: 8),
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Icon(Icons.menu_book_rounded, size: 18, color: c.textMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'No assignments or quizzes published for this course yet.',
                    style: TextStyle(color: c.textSecondary, fontSize: 12, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(Icons.grading_rounded, 'Grades · ${entries.length}', _pSlate),
        const SizedBox(height: 8),
        ...entries.map((e) => _gradeEntry(Map<String, dynamic>.from(e))),
      ],
    );
  }

  Widget _gradeEntry(Map<String, dynamic> entry) {
    final c = context.colors;
    final title = entry['title']?.toString() ?? 'Item';
    final type = entry['item_type']?.toString() ?? 'assignment';
    final pctRaw = entry['percentage'];
    final pct = pctRaw is num ? pctRaw.toDouble() : null;
    final submitted = entry['submitted_at'] != null;
    final feedback = entry['feedback']?.toString() ?? '';
    final typeColor = type == 'quiz' ? _pLavender : _pSlate;

    // Status computation
    final (String statusLabel, String statusDetail, Color statusColor, IconData statusIcon) = () {
      if (pct != null) {
        return ('${pct.round()}%', _gradeLabel(pct), _gradeColor(pct), Icons.check_circle_rounded);
      }
      if (submitted) {
        return ('Pending', 'Awaiting grade', _pSand, Icons.hourglass_bottom_rounded);
      }
      if (type == 'quiz') {
        return ('Not attempted', 'Quiz not yet taken', _pRose, Icons.quiz_rounded);
      }
      return ('Not submitted', 'No submission yet', _pRose, Icons.assignment_late_rounded);
    }();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: typeColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: typeColor.withOpacity(0.3)),
                  ),
                  child: Icon(
                    type == 'quiz' ? Icons.quiz_rounded : Icons.assignment_rounded,
                    color: typeColor,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: typeColor.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: typeColor.withOpacity(0.3)),
                            ),
                            child: Text(type.toUpperCase(),
                                style: TextStyle(
                                    color: typeColor,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5)),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(statusDetail,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: c.textMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: statusColor.withOpacity(0.35)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 11, color: statusColor),
                      const SizedBox(width: 4),
                      Text(statusLabel,
                          style: TextStyle(
                              color: statusColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
            if (feedback.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _pLavender.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(9),
                  border: Border(
                    left: BorderSide(color: _pLavender.withOpacity(0.5), width: 3),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.format_quote_rounded,
                        color: _pLavender, size: 14),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(feedback,
                          style: TextStyle(
                              color: c.textSecondary,
                              fontSize: 12,
                              height: 1.4,
                              fontStyle: FontStyle.italic)),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(IconData icon, String label, Color color) {
    final c = context.colors;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withOpacity(0.15),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Icon(icon, size: 14, color: color),
        ),
        const SizedBox(width: 8),
        Text(label,
            style: TextStyle(
                color: c.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.3)),
      ],
    );
  }

  // ── Error / empty ────────────────────────────────────────────────────────
  Widget _buildError() {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: _pRose.withOpacity(0.15),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _pRose.withOpacity(0.3)),
              ),
              child: const Icon(Icons.error_outline_rounded,
                  color: _pRose, size: 30),
            ),
            const SizedBox(height: 14),
            Text('Could not load report',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(_error ?? '',
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: c.textSecondary, fontSize: 12)),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _load,
              style: ElevatedButton.styleFrom(
                backgroundColor: _pSlate,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.refresh_rounded, size: 17),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    final c = context.colors;
    return Center(
      child: Text('No report data available',
          style: TextStyle(color: c.textMuted, fontSize: 13)),
    );
  }

  Future<pw.MemoryImage?> _fetchAvatarImage(String? url) async {
    if (url == null || url.isEmpty) return null;
    try {
      final res = await http.get(Uri.parse(url));
      if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
        return pw.MemoryImage(res.bodyBytes);
      }
    } catch (_) {}
    return null;
  }

  // ── PDF generation ──────────────────────────────────────────────────────
  Future<pw.Document> _buildPdf(Map<String, dynamic> report) async {
    final pdf = pw.Document();
    final student = Map<String, dynamic>.from(report['student'] ?? {});
    final gradebook = report['gradebook'] == null
        ? null
        : Map<String, dynamic>.from(report['gradebook']);
    final attendance = Map<String, dynamic>.from(report['attendance'] ?? {});
    final entries = (gradebook?['entries'] as List?) ?? [];

    final name = student['name']?.toString().isNotEmpty == true
        ? student['name'].toString()
        : widget.studentName;
    final email = student['email']?.toString() ?? '';
    final photoUrl = ApiService.resolvePhotoUrl(
            student['photo_url']?.toString() ?? student['photoURL']?.toString()) ??
        widget.studentPhotoUrl;
    final pw.MemoryImage? avatarImage = await _fetchAvatarImage(photoUrl);
    final avg = gradebook?['average'] is num
        ? (gradebook!['average'] as num).toDouble()
        : null;

    final totalSessions = ((attendance['total_sessions'] ?? 0) as num).toInt();
    final present = ((attendance['present'] ?? 0) as num).toInt();
    final late = ((attendance['late'] ?? 0) as num).toInt();
    final absent = ((attendance['absent'] ?? 0) as num).toInt();
    final attPct = ((attendance['percentage'] ?? 0) as num).toDouble();

    final generatedOn = DateFormat('dd MMM yyyy · HH:mm').format(DateTime.now());

    const accent = PdfColor.fromInt(0xFF7C93C5);
    const accentSoft = PdfColor.fromInt(0xFFA79FCD);
    const ink = PdfColor.fromInt(0xFF1F2937);
    const muted = PdfColor.fromInt(0xFF6B7280);
    const border = PdfColor.fromInt(0xFFE5E7EB);

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        header: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('MySmartStudy',
                    style: pw.TextStyle(
                        color: accent,
                        fontSize: 10,
                        fontWeight: pw.FontWeight.bold,
                        letterSpacing: 1.2)),
                pw.Text(generatedOn,
                    style: const pw.TextStyle(color: muted, fontSize: 9)),
              ],
            ),
            pw.SizedBox(height: 4),
            pw.Container(height: 1, color: border),
          ],
        ),
        footer: (ctx) => pw.Column(children: [
          pw.Container(height: 1, color: border),
          pw.SizedBox(height: 4),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('Student Performance Report',
                  style: const pw.TextStyle(color: muted, fontSize: 9)),
              pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                  style: const pw.TextStyle(color: muted, fontSize: 9)),
            ],
          ),
        ]),
        build: (ctx) => [
          // Title block
          pw.SizedBox(height: 10),
          pw.Text('Student Performance Report',
              style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                  color: ink)),
          pw.SizedBox(height: 4),
          pw.Text(widget.courseName,
              style: const pw.TextStyle(fontSize: 12, color: muted)),
          pw.SizedBox(height: 18),

          // Student header card
          pw.Container(
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              color: const PdfColor.fromInt(0xFFF4F6FB),
              borderRadius: pw.BorderRadius.circular(10),
              border: pw.Border.all(color: border, width: 0.5),
            ),
            child: pw.Row(
              children: [
                avatarImage != null
                    ? pw.ClipOval(
                        child: pw.Image(avatarImage,
                            width: 46, height: 46, fit: pw.BoxFit.cover),
                      )
                    : pw.Container(
                        width: 46,
                        height: 46,
                        decoration: pw.BoxDecoration(
                          gradient: const pw.LinearGradient(
                              colors: [accent, accentSoft]),
                          shape: pw.BoxShape.circle,
                        ),
                        alignment: pw.Alignment.center,
                        child: pw.Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: pw.TextStyle(
                                color: PdfColors.white,
                                fontSize: 20,
                                fontWeight: pw.FontWeight.bold)),
                      ),
                pw.SizedBox(width: 12),
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(name,
                          style: pw.TextStyle(
                              fontSize: 14,
                              fontWeight: pw.FontWeight.bold,
                              color: ink)),
                      if (email.isNotEmpty)
                        pw.Text(email,
                            style: const pw.TextStyle(
                                fontSize: 10, color: muted)),
                      pw.SizedBox(height: 4),
                      pw.Row(
                        children: [
                          _pdfMetric('Points',
                              '${student['points'] ?? 0}', ink, muted),
                          pw.SizedBox(width: 12),
                          _pdfMetric('Streak',
                              '${student['streak'] ?? 0} days', ink, muted),
                          pw.SizedBox(width: 12),
                          _pdfMetric(
                              'Badges',
                              '${(student['badges'] as List?)?.length ?? 0}',
                              ink,
                              muted),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 16),

          // Overview
          _pdfSection('Performance Overview', accent),
          pw.SizedBox(height: 8),
          pw.Row(
            children: [
              _pdfStatBox('Grade Average',
                  avg != null ? '${avg.toStringAsFixed(1)}%' : 'No grades yet',
                  accent, ink, muted),
              pw.SizedBox(width: 8),
              _pdfStatBox(
                  'Attendance',
                  totalSessions == 0
                      ? 'No sessions'
                      : '${attPct.round()}%',
                  accent,
                  ink,
                  muted),
              pw.SizedBox(width: 8),
              _pdfStatBox(
                  'Activity',
                  '${((report['activity_count'] ?? 0) as num).toInt()} events',
                  accent,
                  ink,
                  muted),
              pw.SizedBox(width: 8),
              _pdfStatBox(
                  'Reviews given',
                  '${((report['reviews_given'] ?? 0) as num).toInt()}',
                  accent,
                  ink,
                  muted),
            ],
          ),
          pw.SizedBox(height: 18),

          // Attendance
          _pdfSection('Attendance Breakdown', accent),
          pw.SizedBox(height: 8),
          if (totalSessions == 0)
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFFF9FAFB),
                borderRadius: pw.BorderRadius.circular(8),
                border: pw.Border.all(color: border, width: 0.5),
              ),
              child: pw.Text('No attendance sessions recorded yet.',
                  style: const pw.TextStyle(fontSize: 10, color: muted)),
            )
          else
            pw.Table(
              border: pw.TableBorder.all(color: border, width: 0.5),
              columnWidths: const {
                0: pw.FlexColumnWidth(1),
                1: pw.FlexColumnWidth(1),
                2: pw.FlexColumnWidth(1),
                3: pw.FlexColumnWidth(1),
                4: pw.FlexColumnWidth(1.2),
              },
              children: [
                pw.TableRow(
                  decoration:
                      const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF4F6FB)),
                  children: [
                    _pdfTh('Present'),
                    _pdfTh('Late'),
                    _pdfTh('Absent'),
                    _pdfTh('Total'),
                    _pdfTh('Rate'),
                  ],
                ),
                pw.TableRow(children: [
                  _pdfTd('$present'),
                  _pdfTd('$late'),
                  _pdfTd('$absent'),
                  _pdfTd('$totalSessions'),
                  _pdfTd('${attPct.round()}%'),
                ]),
              ],
            ),
          pw.SizedBox(height: 18),

          // Grades table
          _pdfSection('Grades · ${entries.length} item${entries.length == 1 ? "" : "s"}', accent),
          pw.SizedBox(height: 8),
          if (entries.isEmpty)
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(12),
              decoration: pw.BoxDecoration(
                color: const PdfColor.fromInt(0xFFF9FAFB),
                borderRadius: pw.BorderRadius.circular(8),
                border: pw.Border.all(color: border, width: 0.5),
              ),
              child: pw.Text('No assignments or quizzes published yet.',
                  style: const pw.TextStyle(fontSize: 10, color: muted)),
            )
          else
            pw.Table(
              border: pw.TableBorder.all(color: border, width: 0.5),
              columnWidths: const {
                0: pw.FlexColumnWidth(0.8),
                1: pw.FlexColumnWidth(3),
                2: pw.FlexColumnWidth(1.2),
                3: pw.FlexColumnWidth(1.3),
              },
              children: [
                pw.TableRow(
                  decoration:
                      const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF4F6FB)),
                  children: [
                    _pdfTh('Type'),
                    _pdfTh('Title'),
                    _pdfTh('Score'),
                    _pdfTh('Status'),
                  ],
                ),
                ...entries.map((e) {
                  final entry = Map<String, dynamic>.from(e);
                  final t = entry['item_type']?.toString() ?? '';
                  final title = entry['title']?.toString() ?? '';
                  final p = entry['percentage'];
                  final pct = p is num ? p.toDouble() : null;
                  final submitted = entry['submitted_at'] != null;
                  final scoreText =
                      pct != null ? '${pct.round()}%' : '—';
                  final statusText = pct != null
                      ? _gradeLabel(pct)
                      : submitted
                          ? 'Awaiting grade'
                          : (t == 'quiz' ? 'Not attempted' : 'Not submitted');
                  return pw.TableRow(children: [
                    _pdfTd(t),
                    _pdfTd(title),
                    _pdfTd(scoreText),
                    _pdfTd(statusText),
                  ]);
                }),
              ],
            ),
        ],
      ),
    );
    return pdf;
  }

  pw.Widget _pdfSection(String label, PdfColor color) {
    return pw.Container(
      padding: const pw.EdgeInsets.only(bottom: 4),
      decoration: pw.BoxDecoration(
        border: pw.Border(
          bottom: pw.BorderSide(color: color, width: 1.5),
        ),
      ),
      child: pw.Text(label.toUpperCase(),
          style: pw.TextStyle(
              fontSize: 10,
              fontWeight: pw.FontWeight.bold,
              color: color,
              letterSpacing: 1)),
    );
  }

  pw.Widget _pdfStatBox(String label, String value, PdfColor accent,
      PdfColor ink, PdfColor muted) {
    return pw.Expanded(
      child: pw.Container(
        padding: const pw.EdgeInsets.all(10),
        decoration: pw.BoxDecoration(
          color: const PdfColor.fromInt(0xFFF9FAFB),
          borderRadius: pw.BorderRadius.circular(8),
          border: pw.Border.all(
              color: const PdfColor.fromInt(0xFFE5E7EB), width: 0.5),
        ),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(label.toUpperCase(),
                style: pw.TextStyle(
                    color: muted,
                    fontSize: 8,
                    fontWeight: pw.FontWeight.bold,
                    letterSpacing: 0.8)),
            pw.SizedBox(height: 3),
            pw.Text(value,
                style: pw.TextStyle(
                    color: ink,
                    fontSize: 12,
                    fontWeight: pw.FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  pw.Widget _pdfMetric(String label, String value, PdfColor ink, PdfColor muted) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Text(label,
            style: pw.TextStyle(
                color: muted,
                fontSize: 7,
                letterSpacing: 0.8,
                fontWeight: pw.FontWeight.bold)),
        pw.Text(value,
            style: pw.TextStyle(
                color: ink,
                fontSize: 10,
                fontWeight: pw.FontWeight.bold)),
      ],
    );
  }

  pw.Widget _pdfTh(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Text(text,
          style: pw.TextStyle(
              fontSize: 9,
              fontWeight: pw.FontWeight.bold,
              color: const PdfColor.fromInt(0xFF374151))),
    );
  }

  pw.Widget _pdfTd(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: pw.Text(text,
          style: const pw.TextStyle(
              fontSize: 9, color: PdfColor.fromInt(0xFF1F2937))),
    );
  }
}
