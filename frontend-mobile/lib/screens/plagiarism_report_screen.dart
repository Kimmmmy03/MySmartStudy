import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/badge_chip.dart';
import '../widgets/section_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class PlagiarismReportScreen extends StatefulWidget {
  final String submissionId;
  final String studentName;
  const PlagiarismReportScreen({super.key, required this.submissionId, required this.studentName});
  @override
  State<PlagiarismReportScreen> createState() => _PlagiarismReportScreenState();
}

class _PlagiarismReportScreenState extends State<PlagiarismReportScreen> {
  Map<String, dynamic>? _report;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.aiGetPlagiarismReport(widget.submissionId);
      if (mounted) setState(() { _report = data is Map ? Map<String, dynamic>.from(data) : null; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Color _similarityColor(double pct) {
    if (pct >= 50) return AppColors.red;
    if (pct >= 25) return AppColors.amber;
    return AppColors.emerald;
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
            const Text('Plagiarism Report', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.studentName, style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonDetail()
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: c.textSecondary), textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                )
              : _report == null
                  ? const Center(child: EmptyState(icon: Icons.find_in_page_rounded, title: 'No report available'))
                  : AnimationLimiter(
                      child: ListView(
                        physics: const BouncingScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                        children: [
                          // Overall score
                          AnimatedListItem(
                            index: 0,
                            child: _buildOverallScore(c),
                          ),
                          const SizedBox(height: 20),

                          // Similarity pairs
                          if ((_report!['pairs'] as List?)?.isNotEmpty == true) ...[
                            AnimatedListItem(
                              index: 1,
                              child: const SectionHeader(title: 'Similar Submissions'),
                            ),
                            const SizedBox(height: 12),
                            ...((_report!['pairs'] as List?) ?? []).asMap().entries.map((entry) {
                              final pair = Map<String, dynamic>.from(entry.value);
                              final similarity = (pair['similarity'] ?? 0).toDouble();
                              final otherStudent = pair['student_name']?.toString() ?? 'Unknown';
                              final details = pair['details']?.toString() ?? '';

                              return AnimatedListItem(
                                index: 2 + entry.key,
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: GlassCard(
                                    borderColor: _similarityColor(similarity).withOpacity(0.3),
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(children: [
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              color: _similarityColor(similarity).withOpacity(0.12),
                                              borderRadius: BorderRadius.circular(11),
                                            ),
                                            child: Center(
                                              child: Text(
                                                '${similarity.round()}%',
                                                style: TextStyle(color: _similarityColor(similarity), fontWeight: FontWeight.bold, fontSize: 12),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(otherStudent, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                                                const SizedBox(height: 2),
                                                BadgeChip(label: '${similarity.round()}% similar', color: _similarityColor(similarity)),
                                              ],
                                            ),
                                          ),
                                        ]),
                                        if (details.isNotEmpty) ...[
                                          const SizedBox(height: 10),
                                          Text(details, style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.4)),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ],

                          // Flagged sections
                          if ((_report!['flagged_sections'] as List?)?.isNotEmpty == true) ...[
                            const SizedBox(height: 16),
                            const SectionHeader(title: 'Flagged Sections'),
                            const SizedBox(height: 12),
                            ...((_report!['flagged_sections'] as List?) ?? []).map((section) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: GlassCard(
                                borderColor: AppColors.amber.withOpacity(0.2),
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.flag_rounded, color: AppColors.amber, size: 18),
                                    const SizedBox(width: 10),
                                    Expanded(child: Text(section.toString(), style: TextStyle(color: c.textPrimary, fontSize: 13, height: 1.4))),
                                  ],
                                ),
                              ),
                            )),
                          ],
                        ],
                      ),
                    ),
    );
  }

  Widget _buildOverallScore(AppColorScheme c) {
    final similarity = (_report!['overall_similarity'] ?? _report!['similarity'] ?? 0).toDouble();
    final color = _similarityColor(similarity);
    final verdict = _report!['verdict']?.toString() ?? (similarity >= 50 ? 'High Similarity' : similarity >= 25 ? 'Moderate Similarity' : 'Low Similarity');

    return GlassCard(
      borderColor: color.withOpacity(0.3),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withOpacity(0.12),
            ),
            child: Center(
              child: Text(
                '${similarity.round()}%',
                style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(verdict, style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('Overall Similarity Score', style: TextStyle(color: c.textSecondary, fontSize: 13)),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: similarity / 100,
              minHeight: 8,
              backgroundColor: c.surfaceElevated,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
}
