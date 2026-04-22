import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/stat_card.dart';
import '../widgets/section_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import '../widgets/charts/submission_trends_chart.dart';
import '../widgets/charts/engagement_heatmap.dart';

class LecturerAnalyticsScreen extends StatefulWidget {
  final String? courseId;
  const LecturerAnalyticsScreen({super.key, this.courseId});
  @override
  State<LecturerAnalyticsScreen> createState() => _LecturerAnalyticsScreenState();
}

class _LecturerAnalyticsScreenState extends State<LecturerAnalyticsScreen> {
  bool _loading = true;
  int _totalStudents = 0;
  int _totalCourses = 0;
  double _avgRate = 0;
  List<dynamic> _stats = [];
  List<Map<String, dynamic>> _submissionTrends = [];
  Map<String, dynamic> _heatmap = {};
  List<Map<String, dynamic>> _atRisk = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.getAnalytics(),
        if (widget.courseId != null) ApiService.getSubmissionTrends(widget.courseId!) else Future.value(<dynamic>[]),
        if (widget.courseId != null) ApiService.getEngagementHeatmap(widget.courseId!) else Future.value(<String, dynamic>{}),
        if (widget.courseId != null) ApiService.getAtRiskStudents(widget.courseId!) else Future.value(<dynamic>[]),
      ]);
      if (!mounted) return;
      final data = results[0] as Map<String, dynamic>;
      setState(() {
        _totalStudents = data['total_students'] ?? 0;
        _totalCourses = data['total_courses'] ?? 0;
        _avgRate = (data['avg_submission_rate'] ?? 0).toDouble();
        _stats = data['assignment_stats'] ?? [];
        _submissionTrends = (results[1] as List).map((e) => Map<String, dynamic>.from(e)).toList();
        _heatmap = results[2] is Map ? Map<String, dynamic>.from(results[2] as Map) : {};
        _atRisk = (results[3] as List).map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonDetail()
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.purple,
              child: AnimationLimiter(
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                  children: [
                    // Overview
                    AnimatedListItem(index: 0, child: const SectionHeader(title: 'Overview')),
                    const SizedBox(height: 12),
                    AnimatedListItem(
                      index: 1,
                      child: Row(children: [
                        Expanded(child: StatCard(label: 'Courses', value: '$_totalCourses', icon: Icons.menu_book_rounded, accentColor: AppColors.purple)),
                        const SizedBox(width: 10),
                        Expanded(child: StatCard(label: 'Students', value: '$_totalStudents', icon: Icons.people_rounded, accentColor: AppColors.purple)),
                      ]),
                    ),
                    const SizedBox(height: 10),

                    // Avg submission rate
                    AnimatedListItem(
                      index: 2,
                      child: GlassCard(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: (_avgRate >= 80 ? AppColors.emerald : AppColors.blue).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(Icons.analytics_rounded, color: _avgRate >= 80 ? AppColors.emerald : AppColors.blue, size: 22),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('Avg Submission Rate', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                                const SizedBox(height: 2),
                                Text('${_avgRate.toStringAsFixed(1)}%', style: TextStyle(color: c.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                              ]),
                            ),
                            SizedBox(
                              width: 60, height: 60,
                              child: Stack(alignment: Alignment.center, children: [
                                CircularProgressIndicator(value: _avgRate / 100, strokeWidth: 5, backgroundColor: c.surfaceElevated, valueColor: AlwaysStoppedAnimation(_avgRate >= 80 ? AppColors.emerald : AppColors.blue)),
                                Text('${_avgRate.round()}%', style: TextStyle(color: c.textPrimary, fontSize: 11, fontWeight: FontWeight.bold)),
                              ]),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Submission Trends Chart
                    if (_submissionTrends.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      AnimatedListItem(index: 3, child: const SectionHeader(title: 'Submission Trends')),
                      const SizedBox(height: 12),
                      AnimatedListItem(
                        index: 4,
                        child: GlassCard(
                          padding: const EdgeInsets.all(16),
                          child: SubmissionTrendsChart(data: _submissionTrends),
                        ),
                      ),
                    ],

                    // Engagement Heatmap
                    if (_heatmap.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      AnimatedListItem(index: 5, child: const SectionHeader(title: 'Engagement Heatmap')),
                      const SizedBox(height: 12),
                      AnimatedListItem(
                        index: 6,
                        child: GlassCard(
                          padding: const EdgeInsets.all(16),
                          child: EngagementHeatmap(data: _heatmap),
                        ),
                      ),
                    ],

                    // At-risk students
                    if (_atRisk.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      AnimatedListItem(index: 7, child: const SectionHeader(title: 'At-Risk Students')),
                      const SizedBox(height: 12),
                      ..._atRisk.asMap().entries.map((entry) {
                        final s = entry.value;
                        return AnimatedListItem(
                          index: 8 + entry.key,
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: GlassCard(
                              borderColor: AppColors.red.withOpacity(0.2),
                              padding: const EdgeInsets.all(14),
                              child: Row(children: [
                                Container(
                                  width: 36, height: 36,
                                  decoration: BoxDecoration(color: AppColors.red.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                                  child: const Icon(Icons.warning_rounded, color: AppColors.red, size: 18),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(s['student_name']?.toString() ?? 'Unknown', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                                  Text(s['reason']?.toString() ?? 'Low engagement', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                                ])),
                              ]),
                            ),
                          ),
                        );
                      }),
                    ],

                    // Assignment Breakdown
                    const SizedBox(height: 24),
                    AnimatedListItem(index: 8 + _atRisk.length, child: const SectionHeader(title: 'Assignment Breakdown')),
                    const SizedBox(height: 12),

                    if (_stats.isEmpty)
                      AnimatedListItem(
                        index: 9 + _atRisk.length,
                        child: const EmptyState(icon: Icons.assignment_outlined, title: 'No assignments yet', subtitle: 'Assignment stats will appear here'),
                      )
                    else
                      ..._stats.asMap().entries.map((entry) {
                        final i = entry.key;
                        final s = entry.value;
                        return AnimatedListItem(index: 9 + _atRisk.length + i, child: _assignmentRow(s, c));
                      }),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _assignmentRow(dynamic s, AppColorScheme c) {
    final title = s['title'] ?? 'Unknown';
    final submitted = s['submitted'] ?? 0;
    final total = s['total'] ?? 0;
    final progress = total > 0 ? (submitted / total) : 0.0;
    final pct = (progress * 100).round();
    final color = pct >= 80 ? AppColors.emerald : pct >= 50 ? AppColors.amber : AppColors.red;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: AppColors.purple.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.assignment_rounded, color: AppColors.purple, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14))),
            Text('$submitted / $total', style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
          ]),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(value: progress, minHeight: 8, backgroundColor: c.surfaceElevated, valueColor: AlwaysStoppedAnimation<Color>(color)),
          ),
        ]),
      ),
    );
  }
}
