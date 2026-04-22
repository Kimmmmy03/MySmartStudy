import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import 'student_report_screen.dart';

// ── Pastel palette ─────────────────────────────────────────────────────────
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

class GradebookScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const GradebookScreen({
    super.key,
    required this.courseId,
    required this.courseName,
    this.isLecturer = false,
  });
  @override
  State<GradebookScreen> createState() => _GradebookScreenState();
}

class _GradebookScreenState extends State<GradebookScreen> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  bool _exporting = false;
  double _assignmentWeight = 60;
  double _quizWeight = 40;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      if (widget.isLecturer) {
        final results = await Future.wait<dynamic>([
          ApiService.getCourseGradebook(widget.courseId),
          ApiService.getGradebookSettings(widget.courseId),
        ]);
        final rows = (results[0] as List)
            .map((g) => Map<String, dynamic>.from(g))
            .toList();
        final settings = Map<String, dynamic>.from(results[1] as Map);
        if (!mounted) return;
        setState(() {
          _rows = rows;
          _assignmentWeight = ((settings['assignment_weight'] ?? 60) as num).toDouble();
          _quizWeight = ((settings['quiz_weight'] ?? 40) as num).toDouble();
          _loading = false;
        });
      } else {
        final raw = await ApiService.getMyGrades(widget.courseId);
        if (!mounted) return;
        // Student endpoint returns list<CourseGradebook>. Take first (this course).
        final courseData = raw.isNotEmpty
            ? Map<String, dynamic>.from(raw.first as Map)
            : <String, dynamic>{};
        final entries = (courseData['entries'] as List?) ?? [];
        setState(() {
          _rows = entries.map((e) => Map<String, dynamic>.from(e)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
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
                  Text(widget.isLecturer ? 'Gradebook' : 'My Grades',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(widget.courseName,
                      style: TextStyle(fontSize: 12, color: c.textSecondary),
                      overflow: TextOverflow.ellipsis),
                ],
              ),
              backgroundColor:
                  (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
              actions: widget.isLecturer
                  ? [
                      IconButton(
                        icon: const Icon(Icons.tune_rounded, color: _pSlate),
                        tooltip: 'Weights',
                        onPressed: _openWeights,
                      ),
                      IconButton(
                        icon: _exporting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: _pSlate))
                            : const Icon(Icons.download_rounded, color: _pSlate),
                        tooltip: 'Export CSV',
                        onPressed: _exporting ? null : _exportCsv,
                      ),
                    ]
                  : null,
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pSlate,
                  child: _rows.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics()),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.18),
                            EmptyState(
                              icon: Icons.grading_rounded,
                              title: widget.isLecturer
                                  ? 'No students enrolled'
                                  : 'No grades yet',
                              subtitle: widget.isLecturer
                                  ? 'Gradebook will populate once students join'
                                  : 'Grades appear once assignments/quizzes are marked',
                            ),
                          ],
                        )
                      : AnimationLimiter(
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                                parent: BouncingScrollPhysics()),
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                            children: [
                              _statsRow(),
                              const SizedBox(height: 14),
                              ...List.generate(
                                _rows.length,
                                (i) => AnimatedListItem(
                                  index: i,
                                  child: widget.isLecturer
                                      ? _lecturerRow(_rows[i])
                                      : _studentEntry(_rows[i]),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
        ),
      ),
    );
  }

  Widget _statsRow() {
    if (widget.isLecturer) {
      final n = _rows.length;
      final graded = _rows
          .where((r) => r['average'] != null)
          .map((r) => ((r['average'] ?? 0) as num).toDouble())
          .toList();
      final avg = graded.isEmpty
          ? null
          : graded.reduce((a, b) => a + b) / graded.length;
      final itemsCount = _rows.isNotEmpty
          ? ((_rows.first['entries'] as List?)?.length ?? 0)
          : 0;
      return Row(
        children: [
          Expanded(child: _tile('Students', '$n', _pSlate, Icons.people_rounded)),
          const SizedBox(width: 8),
          Expanded(
            child: _tile(
              'Class Avg',
              avg != null ? '${avg.toStringAsFixed(1)}%' : '—',
              avg != null ? _gradeColor(avg) : _pSlate,
              Icons.trending_up_rounded,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(child: _tile('Items', '$itemsCount', _pLavender, Icons.list_alt_rounded)),
        ],
      );
    }
    // Student stats — overall avg of this course
    final graded = _rows
        .where((r) => r['percentage'] != null)
        .map((r) => ((r['percentage'] ?? 0) as num).toDouble())
        .toList();
    final avg = graded.isEmpty ? null : graded.reduce((a, b) => a + b) / graded.length;
    final submitted = _rows.where((r) => r['submitted_at'] != null).length;
    final total = _rows.length;
    return Row(
      children: [
        Expanded(
          child: _tile(
            'Average',
            avg != null ? '${avg.toStringAsFixed(1)}%' : '—',
            avg != null ? _gradeColor(avg) : _pSlate,
            Icons.trending_up_rounded,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: _tile('Submitted', '$submitted', _pSeafoam, Icons.check_circle_rounded)),
        const SizedBox(width: 8),
        Expanded(child: _tile('Total', '$total', _pLavender, Icons.list_alt_rounded)),
      ],
    );
  }

  Widget _tile(String label, String value, Color color, IconData icon) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Column(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  color: color, fontSize: 15, fontWeight: FontWeight.bold)),
          Text(label,
              style: TextStyle(color: c.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _studentEntry(Map<String, dynamic> e) {
    final c = context.colors;
    final title = e['title']?.toString() ?? 'Item';
    final type = e['item_type']?.toString() ?? 'assignment';
    final pctRaw = e['percentage'];
    final pct = pctRaw is num ? pctRaw.toDouble() : null;
    final submitted = e['submitted_at'] != null;
    final typeColor = type == 'quiz' ? _pLavender : _pSlate;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [typeColor.withOpacity(0.22), typeColor.withOpacity(0.12)],
                ),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: typeColor.withOpacity(0.3)),
              ),
              child: Icon(
                type == 'quiz' ? Icons.quiz_rounded : Icons.assignment_rounded,
                color: typeColor,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: typeColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: typeColor.withOpacity(0.3)),
                        ),
                        child: Text(
                          type,
                          style: TextStyle(
                              color: typeColor, fontSize: 9, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  if (pct != null) ...[
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct / 100.0,
                        minHeight: 4,
                        backgroundColor:
                            context.isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.05),
                        valueColor: AlwaysStoppedAnimation<Color>(_gradeColor(pct)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            pct != null
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _gradeColor(pct).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _gradeColor(pct).withOpacity(0.35)),
                    ),
                    child: Text('${pct.round()}%',
                        style: TextStyle(
                            color: _gradeColor(pct),
                            fontWeight: FontWeight.bold,
                            fontSize: 13)),
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: context.isDark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(submitted ? 'Pending' : '—',
                        style: TextStyle(
                            color: c.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.w500)),
                  ),
          ],
        ),
      ),
    );
  }

  Widget _lecturerRow(Map<String, dynamic> row) {
    final c = context.colors;
    final name = row['student_name']?.toString() ?? 'Student';
    final email = row['student_email']?.toString() ?? '';
    final photo = ApiService.resolvePhotoUrl(row['student_photo']?.toString());
    final avgRaw = row['average'];
    final avg = avgRaw is num ? avgRaw.toDouble() : null;
    final entries = (row['entries'] as List?) ?? [];
    final studentId = row['student_id']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            HapticFeedback.lightImpact();
            _openStudentReport(studentId, name, photo);
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                AvatarWidget(
                    name: name, imageUrl: photo, size: 40, role: 'student'),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13),
                          overflow: TextOverflow.ellipsis),
                      if (email.isNotEmpty)
                        Text(email,
                            style: TextStyle(color: c.textMuted, fontSize: 11),
                            overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Icon(Icons.list_alt_rounded, size: 10, color: c.textMuted),
                          const SizedBox(width: 4),
                          Text('${entries.length} items',
                              style: TextStyle(color: c.textMuted, fontSize: 10)),
                          if (avg != null) ...[
                            const SizedBox(width: 10),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(3),
                              child: SizedBox(
                                width: 60,
                                child: LinearProgressIndicator(
                                  value: avg / 100.0,
                                  minHeight: 4,
                                  backgroundColor: context.isDark
                                      ? Colors.white.withOpacity(0.06)
                                      : Colors.black.withOpacity(0.05),
                                  valueColor:
                                      AlwaysStoppedAnimation<Color>(_gradeColor(avg)),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                avg != null
                    ? Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: _gradeColor(avg).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _gradeColor(avg).withOpacity(0.35)),
                        ),
                        child: Text('${avg.round()}%',
                            style: TextStyle(
                                color: _gradeColor(avg),
                                fontWeight: FontWeight.bold,
                                fontSize: 13)),
                      )
                    : Text('—',
                        style: TextStyle(color: c.textMuted, fontSize: 14)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Weights sheet ────────────────────────────────────────────────────────
  void _openWeights() {
    HapticFeedback.lightImpact();
    double a = _assignmentWeight;
    double q = _quizWeight;

    showGlassBottomSheet<void>(
      context: context,
      builder: (ctx) {
        final c = context.colors;
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              _pSlate.withOpacity(0.22),
                              _pLavender.withOpacity(0.18),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _pSlate.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.tune_rounded,
                            color: _pSlate, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Grade Weights',
                                style: TextStyle(
                                    color: c.textPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15)),
                            const SizedBox(height: 2),
                            Text('How assignments & quizzes contribute',
                                style: TextStyle(
                                    color: c.textSecondary, fontSize: 11)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _weightSlider(
                    label: 'Assignment Weight',
                    value: a,
                    color: _pSlate,
                    onChange: (v) => setSheetState(() {
                      a = v;
                      q = 100 - v;
                    }),
                  ),
                  const SizedBox(height: 14),
                  _weightSlider(
                    label: 'Quiz Weight',
                    value: q,
                    color: _pLavender,
                    onChange: (v) => setSheetState(() {
                      q = v;
                      a = 100 - v;
                    }),
                  ),
                  const SizedBox(height: 10),
                  Center(
                    child: Text('Total: ${(a + q).round()}%',
                        style: TextStyle(color: c.textMuted, fontSize: 11)),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_pSlate, _pLavender],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: _pSlate.withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.save_rounded,
                            color: Colors.white, size: 18),
                        label: const Text('Save Weights',
                            style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w600)),
                        onPressed: () async {
                          Navigator.pop(ctx);
                          try {
                            await ApiService.saveGradebookSettings(
                              widget.courseId,
                              {
                                'assignment_weight': a.round(),
                                'quiz_weight': q.round(),
                              },
                            );
                            if (!mounted) return;
                            setState(() {
                              _assignmentWeight = a;
                              _quizWeight = q;
                            });
                            HapticFeedback.mediumImpact();
                            _load();
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                    content: Text('Failed: $e'),
                                    backgroundColor: _pRose),
                              );
                            }
                          }
                        },
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _weightSlider({
    required String label,
    required double value,
    required Color color,
    required ValueChanged<double> onChange,
  }) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(label,
                  style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: color.withOpacity(0.35)),
              ),
              child: Text('${value.round()}%',
                  style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: color,
            thumbColor: color,
            inactiveTrackColor: color.withOpacity(0.18),
            overlayColor: color.withOpacity(0.12),
          ),
          child: Slider(
            value: value,
            min: 0,
            max: 100,
            divisions: 100,
            onChanged: onChange,
          ),
        ),
      ],
    );
  }

  // ── Student report (full-screen) ─────────────────────────────────────────
  void _openStudentReport(String studentId, String studentName, String? photoUrl) {
    if (studentId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: const Text('Student ID missing — cannot open report'),
            backgroundColor: _pRose),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => StudentReportScreen(
          studentId: studentId,
          courseId: widget.courseId,
          courseName: widget.courseName,
          studentName: studentName,
          studentPhotoUrl: photoUrl,
        ),
      ),
    );
  }

  // ── CSV Export ───────────────────────────────────────────────────────────
  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    HapticFeedback.lightImpact();
    try {
      final csv = await ApiService.exportGradebookCsv(widget.courseId);
      final dir = await getTemporaryDirectory();
      final safeName = widget.courseName.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
      final file = File('${dir.path}/gradebook_$safeName.csv');
      await file.writeAsString(csv);
      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'text/csv')],
        subject: 'Gradebook: ${widget.courseName}',
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
}
