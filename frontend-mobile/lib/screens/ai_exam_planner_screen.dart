import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/section_header.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';

class AiExamPlannerScreen extends StatefulWidget {
  const AiExamPlannerScreen({super.key});
  @override
  State<AiExamPlannerScreen> createState() => _AiExamPlannerScreenState();
}

class _AiExamPlannerScreenState extends State<AiExamPlannerScreen> {
  final List<_ExamEntry> _exams = [_ExamEntry()];
  bool _generating = false;
  Map<String, dynamic>? _plan;
  List<Map<String, dynamic>> _savedPlans = [];
  bool _loadingPlans = true;

  @override
  void initState() {
    super.initState();
    _loadSavedPlans();
  }

  Future<void> _loadSavedPlans() async {
    try {
      final raw = await ApiService.aiGetExamPlans();
      if (mounted) setState(() { _savedPlans = raw.map((p) => Map<String, dynamic>.from(p)).toList(); _loadingPlans = false; });
    } catch (e) {
      if (mounted) setState(() => _loadingPlans = false);
    }
  }

  void _addExam() {
    HapticFeedback.lightImpact();
    setState(() => _exams.add(_ExamEntry()));
  }

  void _removeExam(int i) {
    if (_exams.length > 1) setState(() => _exams.removeAt(i));
  }

  Future<void> _pickDate(int i) async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date != null) {
      setState(() => _exams[i].date = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}');
    }
  }

  Future<void> _generate() async {
    for (final exam in _exams) {
      if (exam.courseCtrl.text.trim().isEmpty || exam.date == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill in course name and date for all exams'), backgroundColor: AppColors.red),
        );
        return;
      }
    }

    HapticFeedback.mediumImpact();
    setState(() => _generating = true);

    final examsList = _exams.map((e) => {
      'course_name': e.courseCtrl.text.trim(),
      'exam_date': e.date!,
      'topics': e.topicsCtrl.text.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList(),
    }).toList();

    try {
      final result = await ApiService.aiCreateExamPlan(examsList);
      if (mounted) {
        setState(() { _plan = result; _generating = false; });
        _loadSavedPlans();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _generating = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red));
      }
    }
  }

  Future<void> _deletePlan(String id) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Plan',
      message: 'Delete this exam plan?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.aiDeleteExamPlan(id);
      _loadSavedPlans();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('AI Exam Planner', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: AnimationLimiter(
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
          children: [
            // Header
            AnimatedListItem(
              index: 0,
              child: GlassCard(
                gradient: LinearGradient(
                  colors: [
                    AppColors.blue.withOpacity(context.isDark ? 0.2 : 0.08),
                    AppColors.purple.withOpacity(context.isDark ? 0.1 : 0.04),
                  ],
                ),
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.blue.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.school_rounded, color: AppColors.blue, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Plan Your Exams', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                          const SizedBox(height: 4),
                          Text('Add your exams and AI will create a study schedule', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Exam entries
            ...List.generate(_exams.length, (i) => AnimatedListItem(
              index: 1 + i,
              child: _buildExamEntry(i, c),
            )),

            // Add exam button
            TextButton.icon(
              onPressed: _addExam,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add Another Exam'),
              style: TextButton.styleFrom(foregroundColor: AppColors.blue),
            ),
            const SizedBox(height: 12),

            // Generate button
            ElevatedButton.icon(
              onPressed: _generating ? null : _generate,
              icon: _generating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.auto_awesome_rounded, size: 18),
              label: Text(_generating ? 'Generating Plan...' : 'Generate Study Plan'),
              style: AppTheme.gradientButtonStyle(),
            ),

            // Generated plan
            if (_plan != null) ...[
              const SizedBox(height: 24),
              const SectionHeader(title: 'Your Study Plan'),
              const SizedBox(height: 12),
              ...((_plan!['plan'] as List?) ?? []).asMap().entries.map((entry) {
                final d = Map<String, dynamic>.from(entry.value);
                return AnimatedListItem(
                  index: _exams.length + 2 + entry.key,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GlassCard(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: AppColors.blue.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.calendar_today_rounded, color: AppColors.blue, size: 16),
                              ),
                              const SizedBox(width: 10),
                              Text(d['date']?.toString() ?? '', style: const TextStyle(color: AppColors.blue, fontWeight: FontWeight.bold, fontSize: 14)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ...((d['sessions'] as List?) ?? []).map((session) {
                            final s = Map<String, dynamic>.from(session);
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    margin: const EdgeInsets.only(top: 6),
                                    decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.purple),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('${s['course'] ?? ''} — ${s['topic'] ?? ''}',
                                            style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                                        Text('${s['activity'] ?? ''} (${s['duration_minutes'] ?? '?'} min)',
                                            style: TextStyle(color: c.textMuted, fontSize: 12)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
                );
              }),

              // Tips
              if ((_plan!['tips'] as List?)?.isNotEmpty == true) ...[
                const SizedBox(height: 16),
                const SectionHeader(title: 'Tips'),
                const SizedBox(height: 8),
                ...(_plan!['tips'] as List).map((tip) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.lightbulb_rounded, color: AppColors.amber, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(tip.toString(), style: TextStyle(color: c.textSecondary, fontSize: 13))),
                    ],
                  ),
                )),
              ],
            ],

            // Saved plans
            if (_savedPlans.isNotEmpty) ...[
              const SizedBox(height: 24),
              const SectionHeader(title: 'Saved Plans'),
              const SizedBox(height: 12),
              ..._savedPlans.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: GlassCard(
                  onTap: () => setState(() => _plan = p),
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.blue.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: const Icon(Icons.description_rounded, color: AppColors.blue, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Plan from ${p['created_at']?.toString().substring(0, 10) ?? ''}',
                              style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            BadgeChip(label: '${(p['exams'] as List?)?.length ?? 0} exams', color: AppColors.blue),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () => _deletePlan(p['id']?.toString() ?? ''),
                        child: Icon(Icons.delete_outline_rounded, size: 20, color: c.textMuted),
                      ),
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

  Widget _buildExamEntry(int i, AppColorScheme c) {
    final exam = _exams[i];
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                BadgeChip(label: 'Exam ${i + 1}', color: AppColors.purple),
                const Spacer(),
                if (_exams.length > 1)
                  GestureDetector(
                    onTap: () => _removeExam(i),
                    child: const Icon(Icons.close_rounded, size: 18, color: AppColors.red),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: exam.courseCtrl,
              style: TextStyle(color: c.textPrimary, fontSize: 13),
              decoration: AppTheme.inputDecoration(context, label: 'Course Name', prefixIcon: Icons.book_rounded),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => _pickDate(i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: c.surfaceInput,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_rounded, color: c.textMuted, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      exam.date ?? 'Select exam date',
                      style: TextStyle(color: exam.date != null ? c.textPrimary : c.textMuted, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: exam.topicsCtrl,
              style: TextStyle(color: c.textPrimary, fontSize: 13),
              decoration: AppTheme.inputDecoration(context, label: 'Topics (comma-separated)', prefixIcon: Icons.topic_rounded),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    for (final e in _exams) { e.courseCtrl.dispose(); e.topicsCtrl.dispose(); }
    super.dispose();
  }
}

class _ExamEntry {
  final courseCtrl = TextEditingController();
  final topicsCtrl = TextEditingController();
  String? date;
}
