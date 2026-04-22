import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../models/assignment_model.dart';
import '../models/submission_model.dart';
import '../models/subject_model.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/app_background.dart';
import '../widgets/skeletons.dart';

// ── Pastel palette (matches rest of overhaul) ──
const _pSky        = Color(0xFFA9C9E8);
const _pLavender   = Color(0xFFBFA8D9);
const _pSage       = Color(0xFFA8C9A8);
const _pSand       = Color(0xFFF5D79E);
const _pMutedRose  = Color(0xFFE89988);
const _pPeriwinkle = Color(0xFFB4C2E0);

Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

Color _bandColor(double g) {
  if (g >= 80) return _pSage;
  if (g >= 60) return _pSky;
  if (g >= 50) return _pSand;
  return _pMutedRose;
}

String _bandLetter(double g) {
  if (g >= 80) return 'A';
  if (g >= 60) return 'B';
  if (g >= 50) return 'C';
  return 'F';
}

String _bandLabel(double g) {
  if (g >= 80) return 'Excellent';
  if (g >= 60) return 'Good';
  if (g >= 50) return 'Pass';
  return 'Needs work';
}

enum _Filter { all, graded, pending, missing }

class _CourseGrades {
  final SubjectModel course;
  final List<_AssignmentGrade> assignments;
  _CourseGrades({required this.course, required this.assignments});

  List<SubmissionModel> get graded =>
      assignments.where((a) => a.submission?.isGraded ?? false).map((a) => a.submission!).toList();

  double? get average {
    final g = graded;
    if (g.isEmpty) return null;
    final total = g.fold<double>(0, (sum, s) => sum + (s.grade ?? 0));
    return total / g.length;
  }

  int get pendingCount => assignments.where((a) {
        final s = a.submission;
        return s != null && !s.isGraded;
      }).length;

  int get missingCount => assignments.where((a) => a.submission == null).length;
}

class _AssignmentGrade {
  final AssignmentModel assignment;
  final SubmissionModel? submission;
  _AssignmentGrade({required this.assignment, this.submission});
}

class GradesScreen extends StatefulWidget {
  const GradesScreen({super.key});
  @override
  State<GradesScreen> createState() => _GradesScreenState();
}

class _GradesScreenState extends State<GradesScreen> {
  bool _loading = true;
  String? _error;
  List<_CourseGrades> _courseGrades = [];
  _Filter _filter = _Filter.all;
  final Set<String> _collapsed = {};

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
      final rawCourses = await ApiService.getEnrolledCourses();
      final courses = rawCourses
          .map((c) => SubjectModel.fromApi(Map<String, dynamic>.from(c)))
          .toList();

      final List<_CourseGrades> allGrades = [];
      for (final course in courses) {
        final rawAssignments = await ApiService.getAssignments(course.id);
        final assignments = rawAssignments
            .map((a) => AssignmentModel.fromApi(
                Map<String, dynamic>.from(a), subjectName: course.name))
            .toList();

        final List<_AssignmentGrade> assignmentGrades = [];
        for (final assignment in assignments) {
          SubmissionModel? submission;
          try {
            final rawSub = await ApiService.getMySubmission(assignment.id);
            if (rawSub != null) {
              submission = SubmissionModel.fromApi(
                  Map<String, dynamic>.from(rawSub));
            }
          } catch (_) {}
          assignmentGrades.add(_AssignmentGrade(
              assignment: assignment, submission: submission));
        }
        allGrades.add(_CourseGrades(
            course: course, assignments: assignmentGrades));
      }

      setState(() {
        _courseGrades = allGrades;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // ── Aggregate stats ──
  List<SubmissionModel> get _allGraded =>
      _courseGrades.expand((c) => c.graded).toList();

  double? get _overall {
    final g = _allGraded;
    if (g.isEmpty) return null;
    final total = g.fold<double>(0, (s, x) => s + (x.grade ?? 0));
    return total / g.length;
  }

  int get _totalAssignments =>
      _courseGrades.fold(0, (s, c) => s + c.assignments.length);
  int get _totalGraded => _allGraded.length;
  int get _totalPending =>
      _courseGrades.fold(0, (s, c) => s + c.pendingCount);
  int get _totalMissing =>
      _courseGrades.fold(0, (s, c) => s + c.missingCount);

  List<_AssignmentGrade> _applyFilter(List<_AssignmentGrade> src) {
    switch (_filter) {
      case _Filter.all:
        return src;
      case _Filter.graded:
        return src.where((a) => a.submission?.isGraded ?? false).toList();
      case _Filter.pending:
        return src.where((a) {
          final s = a.submission;
          return s != null && !s.isGraded;
        }).toList();
      case _Filter.missing:
        return src.where((a) => a.submission == null).toList();
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
              title: Text('Grades',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    letterSpacing: -0.2,
                  )),
              backgroundColor:
                  (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              surfaceTintColor: Colors.transparent,
              scrolledUnderElevation: 0,
              elevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
              actions: [
                IconButton(
                  icon: Icon(Icons.refresh_rounded,
                      color: c.textSecondary, size: 22),
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    _load();
                  },
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
              ? const SkeletonList(itemCount: 5)
              : _error != null
                  ? _buildError()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: _darken(_pSky, 0.15),
                      child: _courseGrades.isEmpty
                          ? _buildEmpty()
                          : _buildList(),
                    ),
        ),
      ),
    );
  }

  // ── Empty / error ────────────────────────────────────────
  Widget _buildEmpty() {
    final c = context.colors;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.18),
        Center(
          child: Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_darken(_pSky, 0.06), _darken(_pSky, 0.22)],
              ),
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(
                  color: _darken(_pSky, 0.18).withOpacity(0.30),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: const Icon(Icons.school_rounded,
                color: Colors.white, size: 38),
          ),
        ),
        const SizedBox(height: 18),
        Text('No enrolled courses yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            )),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Join a course to see your assignments and grades here.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.textSecondary,
              fontSize: 13.5,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: _pMutedRose.withOpacity(0.15),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(Icons.error_outline_rounded,
                  color: _darken(_pMutedRose, 0.15), size: 32),
            ),
            const SizedBox(height: 14),
            Text('Couldn\'t load grades',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(_error ?? '',
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: c.textSecondary, fontSize: 13)),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _darken(_pSky, 0.10),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Main list ────────────────────────────────────────────
  Widget _buildList() {
    final visibleCourses = _courseGrades
        .map((cg) => _CourseGrades(
            course: cg.course, assignments: _applyFilter(cg.assignments)))
        .where((cg) => cg.assignments.isNotEmpty || _filter == _Filter.all)
        .toList();

    return AnimationLimiter(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
        children: [
          _buildHero(),
          const SizedBox(height: 14),
          _buildStatRow(),
          const SizedBox(height: 16),
          _buildFilterTabs(),
          const SizedBox(height: 16),
          if (visibleCourses.isEmpty)
            _buildFilterEmpty()
          else
            ...visibleCourses.asMap().entries.map(
                  (e) => AnimatedListItem(
                    index: e.key,
                    child: _buildCourseSection(e.value),
                  ),
                ),
        ],
      ),
    );
  }

  // ── Hero: overall average ────────────────────────────────
  Widget _buildHero() {
    final avg = _overall;
    final accent = avg == null ? _pPeriwinkle : _bandColor(avg);
    final letter = avg == null ? '—' : _bandLetter(avg);
    final label = avg == null ? 'No graded work yet' : _bandLabel(avg);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent,
            accent.withOpacity(0.85),
            _darken(accent, 0.06),
          ],
          stops: const [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _darken(accent, 0.18).withOpacity(0.35),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -30,
            right: -20,
            child: Container(
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.14),
              ),
            ),
          ),
          Positioned(
            bottom: -30,
            left: -20,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.08),
              ),
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Grade circle
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.92),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _darken(accent, 0.20).withOpacity(0.30),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    letter,
                    style: TextStyle(
                      color: _darken(accent, 0.30),
                      fontSize: 42,
                      fontWeight: FontWeight.w900,
                      height: 1.0,
                      letterSpacing: -1,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        'OVERALL AVERAGE',
                        style: TextStyle(
                          color: _darken(accent, 0.30),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.9,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          avg == null ? '—' : avg.toStringAsFixed(1),
                          style: TextStyle(
                            color: _darken(accent, 0.40),
                            fontSize: 34,
                            fontWeight: FontWeight.w900,
                            height: 1.0,
                            letterSpacing: -1,
                          ),
                        ),
                        if (avg != null)
                          Padding(
                            padding: const EdgeInsets.only(
                                left: 4, bottom: 5),
                            child: Text(
                              '%',
                              style: TextStyle(
                                color: _darken(accent, 0.35),
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      label,
                      style: TextStyle(
                        color: _darken(accent, 0.42),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (avg != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Based on $_totalGraded graded assignment${_totalGraded == 1 ? "" : "s"}',
                        style: TextStyle(
                          color: _darken(accent, 0.34),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Stat row ─────────────────────────────────────────────
  Widget _buildStatRow() {
    return Row(
      children: [
        Expanded(child: _statTile(_pSage, Icons.check_circle_rounded, 'Graded', '$_totalGraded')),
        const SizedBox(width: 10),
        Expanded(child: _statTile(_pSand, Icons.hourglass_bottom_rounded, 'Pending', '$_totalPending')),
        const SizedBox(width: 10),
        Expanded(child: _statTile(_pMutedRose, Icons.assignment_late_rounded, 'Missing', '$_totalMissing')),
      ],
    );
  }

  Widget _statTile(Color accent, IconData icon, String label, String value) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: c.surfaceCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: _darken(accent, 0.15), size: 15),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              height: 1.0,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }

  // ── Filter tabs ──────────────────────────────────────────
  Widget _buildFilterTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          _tab(_Filter.all, 'All', _totalAssignments, _pSky),
          const SizedBox(width: 8),
          _tab(_Filter.graded, 'Graded', _totalGraded, _pSage),
          const SizedBox(width: 8),
          _tab(_Filter.pending, 'Pending', _totalPending, _pSand),
          const SizedBox(width: 8),
          _tab(_Filter.missing, 'Missing', _totalMissing, _pMutedRose),
        ],
      ),
    );
  }

  Widget _tab(_Filter f, String label, int count, Color accent) {
    final c = context.colors;
    final active = _filter == f;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _filter = f);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: active ? accent.withOpacity(0.18) : c.surfaceCard,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: active ? accent.withOpacity(0.55) : c.border,
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: TextStyle(
                color: active ? _darken(accent, 0.25) : c.textSecondary,
                fontSize: 13,
                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: active
                    ? _darken(accent, 0.10)
                    : c.surfaceElevated,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: active ? Colors.white : c.textMuted,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterEmpty() {
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: c.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border, width: 1),
      ),
      child: Column(
        children: [
          Icon(Icons.filter_list_off_rounded, color: c.textMuted, size: 34),
          const SizedBox(height: 10),
          Text(
            'Nothing here',
            style: TextStyle(
                color: c.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'No assignments match this filter.',
            style: TextStyle(color: c.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ── Course section ───────────────────────────────────────
  Widget _buildCourseSection(_CourseGrades cg) {
    final c = context.colors;
    final collapsed = _collapsed.contains(cg.course.id);
    final avg = cg.average;
    final courseAccent = avg == null ? _pPeriwinkle : _bandColor(avg);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        decoration: BoxDecoration(
          color: c.surfaceCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header — tap to collapse/expand
            InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: cg.assignments.isEmpty
                  ? null
                  : () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        if (collapsed) {
                          _collapsed.remove(cg.course.id);
                        } else {
                          _collapsed.add(cg.course.id);
                        }
                      });
                    },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            courseAccent,
                            _darken(courseAccent, 0.12),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: _darken(courseAccent, 0.15)
                                .withOpacity(0.28),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.menu_book_rounded,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cg.course.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 14.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            cg.course.courseCode.isNotEmpty
                                ? '${cg.course.courseCode} · ${cg.assignments.length} assignment${cg.assignments.length == 1 ? "" : "s"}'
                                : '${cg.assignments.length} assignment${cg.assignments.length == 1 ? "" : "s"}',
                            style: TextStyle(
                              color: c.textMuted,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    if (avg != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: courseAccent.withOpacity(0.18),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: courseAccent.withOpacity(0.40),
                              width: 1),
                        ),
                        child: Row(
                          children: [
                            Text(
                              _bandLetter(avg),
                              style: TextStyle(
                                color: _darken(courseAccent, 0.25),
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${avg.toStringAsFixed(0)}%',
                              style: TextStyle(
                                color: _darken(courseAccent, 0.30),
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (cg.assignments.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      AnimatedRotation(
                        turns: collapsed ? -0.25 : 0.0,
                        duration: const Duration(milliseconds: 200),
                        child: Icon(Icons.keyboard_arrow_down_rounded,
                            color: c.textMuted, size: 22),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            // Body
            if (!collapsed && cg.assignments.isNotEmpty) ...[
              Divider(color: c.border, height: 1, thickness: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
                child: Column(
                  children: cg.assignments
                      .map((ag) => _buildAssignmentTile(ag))
                      .toList(),
                ),
              ),
            ],
            if (cg.assignments.isEmpty)
              Padding(
                padding:
                    const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: Text(
                  'No assignments yet',
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Assignment tile ──────────────────────────────────────
  Widget _buildAssignmentTile(_AssignmentGrade ag) {
    final c = context.colors;
    final a = ag.assignment;
    final s = ag.submission;

    Color accent;
    IconData statusIcon;
    String statusText;
    Widget? trailing;

    if (s == null) {
      accent = _pMutedRose;
      statusIcon = Icons.assignment_late_rounded;
      statusText = 'Not submitted';
      trailing = Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: accent.withOpacity(0.15),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: accent.withOpacity(0.35), width: 1),
        ),
        child: Text(
          'Missing',
          style: TextStyle(
            color: _darken(accent, 0.20),
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    } else if (!s.isGraded) {
      accent = _pSand;
      statusIcon = Icons.hourglass_bottom_rounded;
      statusText = 'Awaiting grade';
      trailing = Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: accent.withOpacity(0.20),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: accent.withOpacity(0.40), width: 1),
        ),
        child: Text(
          'Pending',
          style: TextStyle(
            color: _darken(accent, 0.25),
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    } else {
      final g = s.grade!;
      accent = _bandColor(g);
      statusIcon = Icons.check_circle_rounded;
      statusText = 'Graded';
      trailing = Container(
        width: 54,
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [accent, _darken(accent, 0.10)],
          ),
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            BoxShadow(
              color: _darken(accent, 0.15).withOpacity(0.30),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          children: [
            Text(
              _bandLetter(g),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w900,
                height: 1.0,
              ),
            ),
            const SizedBox(height: 1),
            Text(
              '${g.toStringAsFixed(0)}%',
              style: TextStyle(
                color: Colors.white.withOpacity(0.95),
                fontSize: 10,
                fontWeight: FontWeight.w800,
                height: 1.1,
              ),
            ),
          ],
        ),
      );
    }

    final hasFeedback =
        s != null && s.isGraded && s.feedback.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(statusIcon,
                    color: _darken(accent, 0.15), size: 17),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.circle,
                            size: 5, color: _darken(accent, 0.10)),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            a.dueAt != null
                                ? '$statusText · Due ${_formatDate(a.dueAt!)}'
                                : statusText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.textMuted,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              trailing,
            ],
          ),
          if (hasFeedback) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _pLavender.withOpacity(0.10),
                borderRadius: BorderRadius.circular(10),
                border: Border(
                  left: BorderSide(
                      color: _darken(_pLavender, 0.08), width: 3),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.format_quote_rounded,
                      color: _darken(_pLavender, 0.18), size: 15),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      s.feedback,
                      style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 12.5,
                        height: 1.45,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${date.day} ${months[date.month - 1]}';
  }
}
