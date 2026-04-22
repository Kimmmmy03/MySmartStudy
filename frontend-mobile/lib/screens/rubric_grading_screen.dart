import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/badge_chip.dart';
import '../widgets/section_header.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class RubricGradingScreen extends StatefulWidget {
  final String courseId;
  final String submissionId;
  final String studentName;
  const RubricGradingScreen({super.key, required this.courseId, required this.submissionId, required this.studentName});
  @override
  State<RubricGradingScreen> createState() => _RubricGradingScreenState();
}

class _RubricGradingScreenState extends State<RubricGradingScreen> {
  List<Map<String, dynamic>> _rubrics = [];
  Map<String, dynamic>? _selectedRubric;
  final Map<int, int> _scores = {}; // criteria index -> selected level
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getRubrics(widget.courseId);
      if (mounted) setState(() { _rubrics = raw.map((r) => Map<String, dynamic>.from(r)).toList(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedRubric == null) return;
    HapticFeedback.mediumImpact();
    setState(() => _submitting = true);
    try {
      await ApiService.gradeWithRubric(widget.submissionId, {
        'rubric_id': _selectedRubric!['id'],
        'scores': _scores.map((k, v) => MapEntry(k.toString(), v)),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Graded successfully!'), backgroundColor: AppColors.emerald),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  int get _totalScore {
    int total = 0;
    final criteria = (_selectedRubric?['criteria'] as List?) ?? [];
    for (final entry in _scores.entries) {
      if (entry.key < criteria.length) {
        final levels = (criteria[entry.key]['levels'] as List?) ?? [];
        if (entry.value < levels.length) {
          total += ((levels[entry.value]['points'] ?? 0) as num).toInt();
        }
      }
    }
    return total;
  }

  int get _maxScore {
    int max = 0;
    final criteria = (_selectedRubric?['criteria'] as List?) ?? [];
    for (final c in criteria) {
      final levels = (c['levels'] as List?) ?? [];
      int highest = 0;
      for (final l in levels) {
        final pts = ((l['points'] ?? 0) as num).toInt();
        if (pts > highest) highest = pts;
      }
      max += highest;
    }
    return max;
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
            const Text('Rubric Grading', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.studentName, style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : _rubrics.isEmpty
              ? const Center(child: EmptyState(icon: Icons.grading_rounded, title: 'No rubrics', subtitle: 'Create a rubric first'))
              : AnimationLimiter(
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                    children: [
                      // Rubric selector
                      AnimatedListItem(
                        index: 0,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SectionHeader(title: 'Select Rubric'),
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: _rubrics.map((r) {
                                  final isSelected = _selectedRubric?['id'] == r['id'];
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: GestureDetector(
                                      onTap: () {
                                        HapticFeedback.selectionClick();
                                        setState(() { _selectedRubric = r; _scores.clear(); });
                                      },
                                      child: AnimatedContainer(
                                        duration: const Duration(milliseconds: 200),
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                        decoration: BoxDecoration(
                                          color: isSelected ? AppColors.purple.withOpacity(0.15) : c.surfaceInput,
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(color: isSelected ? AppColors.purple : c.border, width: isSelected ? 2 : 1),
                                        ),
                                        child: Text(r['name']?.toString() ?? 'Rubric', style: TextStyle(color: isSelected ? AppColors.purple : c.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ),
                      ),

                      if (_selectedRubric != null) ...[
                        const SizedBox(height: 20),

                        // Score summary
                        AnimatedListItem(
                          index: 1,
                          child: GlassCard(
                            borderColor: AppColors.purple.withOpacity(0.3),
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text('$_totalScore', style: TextStyle(color: AppColors.purple, fontSize: 32, fontWeight: FontWeight.bold)),
                                Text(' / $_maxScore', style: TextStyle(color: c.textMuted, fontSize: 20)),
                                const SizedBox(width: 16),
                                if (_maxScore > 0)
                                  BadgeChip(label: '${(_totalScore / _maxScore * 100).round()}%', color: _totalScore / _maxScore >= 0.7 ? AppColors.emerald : AppColors.amber),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Criteria
                        ...((_selectedRubric!['criteria'] as List?) ?? []).asMap().entries.map((entry) {
                          final i = entry.key;
                          final criterion = Map<String, dynamic>.from(entry.value);
                          final name = criterion['name']?.toString() ?? 'Criterion ${i + 1}';
                          final levels = (criterion['levels'] as List?) ?? [];

                          return AnimatedListItem(
                            index: 2 + i,
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: GlassCard(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
                                    const SizedBox(height: 10),
                                    ...levels.asMap().entries.map((le) {
                                      final li = le.key;
                                      final level = Map<String, dynamic>.from(le.value);
                                      final isSelected = _scores[i] == li;
                                      final points = level['points'] ?? 0;
                                      final desc = level['description']?.toString() ?? '';

                                      return GestureDetector(
                                        onTap: () {
                                          HapticFeedback.selectionClick();
                                          setState(() => _scores[i] = li);
                                        },
                                        child: AnimatedContainer(
                                          duration: const Duration(milliseconds: 200),
                                          margin: const EdgeInsets.only(bottom: 6),
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: isSelected ? AppColors.purple.withOpacity(0.1) : Colors.transparent,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(color: isSelected ? AppColors.purple : c.border, width: isSelected ? 2 : 1),
                                          ),
                                          child: Row(
                                            children: [
                                              Container(
                                                width: 32,
                                                height: 32,
                                                decoration: BoxDecoration(
                                                  color: isSelected ? AppColors.purple.withOpacity(0.15) : c.surfaceInput,
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Center(child: Text('$points', style: TextStyle(color: isSelected ? AppColors.purple : c.textSecondary, fontWeight: FontWeight.bold, fontSize: 13))),
                                              ),
                                              const SizedBox(width: 10),
                                              Expanded(child: Text(desc, style: TextStyle(color: c.textPrimary, fontSize: 13))),
                                              if (isSelected) const Icon(Icons.check_circle_rounded, color: AppColors.purple, size: 20),
                                            ],
                                          ),
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),

                        // Submit button
                        const SizedBox(height: 8),
                        ElevatedButton.icon(
                          onPressed: _submitting ? null : _submit,
                          icon: _submitting
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Icon(Icons.check_rounded, size: 18),
                          label: Text(_submitting ? 'Submitting...' : 'Submit Grade'),
                          style: AppTheme.gradientButtonStyle(),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
