import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/stat_card.dart';
import '../widgets/section_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class CompletionScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  const CompletionScreen({super.key, required this.courseId, required this.courseName});
  @override
  State<CompletionScreen> createState() => _CompletionScreenState();
}

class _CompletionScreenState extends State<CompletionScreen> {
  List<Map<String, dynamic>> _students = [];
  Map<String, dynamic>? _summary;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiService.getCourseCompletion(widget.courseId),
        ApiService.getCompletionSummary(widget.courseId),
      ]);
      if (!mounted) return;
      setState(() {
        _students = (results[0] as List).map((s) => Map<String, dynamic>.from(s)).toList();
        _summary = Map<String, dynamic>.from(results[1] as Map);
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _pctColor(num pct) {
    if (pct >= 80) return AppColors.emerald;
    if (pct >= 50) return AppColors.amber;
    return AppColors.red;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Completion Tracking', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.courseName, style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.emerald,
              child: AnimationLimiter(
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                  children: [
                    if (_summary != null) ...[
                      AnimatedListItem(index: 0, child: _summaryCards(c)),
                      const SizedBox(height: 12),
                      AnimatedListItem(index: 1, child: _categoryBars(c)),
                      const SizedBox(height: 20),
                    ],
                    AnimatedListItem(
                      index: 2,
                      child: SectionHeader(
                        title: 'Students',
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_students.isEmpty)
                      AnimatedListItem(
                        index: 3,
                        child: const EmptyState(
                          icon: Icons.people_outline_rounded,
                          title: 'No students enrolled',
                          subtitle: 'Students will appear here',
                        ),
                      )
                    else
                      ..._students.asMap().entries.map((e) => AnimatedListItem(
                        index: 3 + e.key,
                        child: _studentRow(e.value, c),
                      )),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _summaryCards(AppColorScheme c) {
    final avg = _summary!['avg_completion'] ?? 0;
    final complete = _summary!['fully_complete'] ?? 0;
    final atRisk = _summary!['at_risk'] ?? 0;
    final total = _summary!['total_students'] ?? 0;

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: StatCard(label: 'Avg Completion', value: '$avg%', icon: Icons.trending_up_rounded, accentColor: _pctColor(avg))),
            const SizedBox(width: 10),
            Expanded(child: StatCard(label: 'Fully Complete', value: '$complete/$total', icon: Icons.check_circle_rounded, accentColor: AppColors.emerald)),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: StatCard(label: 'At Risk (<30%)', value: '$atRisk', icon: Icons.warning_amber_rounded, accentColor: AppColors.red)),
            const SizedBox(width: 10),
            Expanded(child: StatCard(label: 'Total Students', value: '$total', icon: Icons.people_rounded, accentColor: AppColors.blue)),
          ],
        ),
      ],
    );
  }

  Widget _categoryBars(AppColorScheme c) {
    final assignPct = _summary!['assignment_completion_rate'] ?? 0;
    final quizPct = _summary!['quiz_completion_rate'] ?? 0;
    final resPct = _summary!['resource_completion_rate'] ?? 0;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _barRow('Assignments', assignPct, AppColors.blue, c),
          const SizedBox(height: 14),
          _barRow('Quizzes', quizPct, AppColors.blue, c),
          const SizedBox(height: 14),
          _barRow('Resources', resPct, AppColors.amber, c),
        ],
      ),
    );
  }

  Widget _barRow(String label, num pct, Color color, AppColorScheme c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: c.textSecondary, fontSize: 12)),
            Text('$pct%', style: TextStyle(color: _pctColor(pct), fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct / 100,
            minHeight: 8,
            backgroundColor: c.surfaceElevated,
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
      ],
    );
  }

  Widget _studentRow(Map<String, dynamic> s, AppColorScheme c) {
    final name = s['student_name']?.toString() ?? 'Student';
    final pct = s['overall_percentage'] ?? 0;
    final assignments = '${s['submitted_assignments'] ?? 0}/${s['total_assignments'] ?? 0}';
    final quizzes = '${s['completed_quizzes'] ?? 0}/${s['total_quizzes'] ?? 0}';
    final resources = '${s['opened_resources'] ?? 0}/${s['total_resources'] ?? 0}';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            AvatarWidget(
              name: name,
              imageUrl: (s['photo_url'] ?? s['student_photo_url'] ?? '').toString(),
              size: 38,
              role: 'student',
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(
                    'A: $assignments  Q: $quizzes  R: $resources',
                    style: TextStyle(color: c.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _pctColor(pct).withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _pctColor(pct).withOpacity(0.3)),
              ),
              child: Text(
                '$pct%',
                style: TextStyle(color: _pctColor(pct), fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
