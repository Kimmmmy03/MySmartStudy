import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/skeletons.dart';

class AiLearningStyleScreen extends StatefulWidget {
  final void Function(String style) onComplete;
  const AiLearningStyleScreen({super.key, required this.onComplete});
  @override
  State<AiLearningStyleScreen> createState() => _AiLearningStyleScreenState();
}

class _AiLearningStyleScreenState extends State<AiLearningStyleScreen> {
  List<Map<String, dynamic>> _questions = [];
  final Map<String, String> _answers = {};
  int _currentQ = 0;
  bool _loading = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    try {
      final data = await ApiService.aiAssessStyle();
      final qs = (data['questions'] as List?) ?? [];
      if (mounted) setState(() { _questions = qs.map((q) => Map<String, dynamic>.from(q)).toList(); _loading = false; });
    } catch (e) {
      if (mounted) {
        setState(() {
          _questions = [
            {
              'id': 'q1',
              'text': 'When learning something new, I prefer to:',
              'options': [
                {'value': 'visual', 'text': 'See diagrams, charts, or videos'},
                {'value': 'auditory', 'text': 'Listen to explanations'},
                {'value': 'reading', 'text': 'Read textbooks or written notes'},
                {'value': 'kinesthetic', 'text': 'Try hands-on activities'},
              ],
            }
          ];
          _loading = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final counts = <String, int>{};
    for (final v in _answers.values) {
      counts[v] = (counts[v] ?? 0) + 1;
    }
    String style = 'general';
    int maxCount = 0;
    counts.forEach((k, v) { if (v > maxCount) { maxCount = v; style = k; } });

    try {
      await ApiService.aiUpdateLearningProfile(style, [], []);
      widget.onComplete(style);
    } catch (e) {
      widget.onComplete(style);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    if (_loading) {
      return const SkeletonDetail();
    }

    if (_questions.isEmpty) {
      return Center(child: Text('No questions available', style: TextStyle(color: c.textSecondary)));
    }

    final q = _questions[_currentQ];
    final options = (q['options'] as List?) ?? [];
    final qId = q['id']?.toString() ?? '$_currentQ';
    final isLast = _currentQ == _questions.length - 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          GlassCard(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.purple.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(child: Image.asset('assets/images/ai-brain-logo.png', width: 50, height: 50)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Learning Style Assessment', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 4),
                      Text('Help me understand how you learn best!', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Progress
          Row(
            children: [
              Text('Question ${_currentQ + 1} of ${_questions.length}', style: TextStyle(color: c.textMuted, fontSize: 12)),
              const Spacer(),
              Text('${((_currentQ + 1) / _questions.length * 100).round()}%', style: const TextStyle(color: AppColors.purple, fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (_currentQ + 1) / _questions.length,
              minHeight: 6,
              backgroundColor: c.surfaceElevated,
              valueColor: const AlwaysStoppedAnimation(AppColors.purple),
            ),
          ),
          const SizedBox(height: 24),

          // Question
          Text(q['text']?.toString() ?? '', style: TextStyle(color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),

          // Options
          Expanded(
            child: ListView.builder(
              physics: const BouncingScrollPhysics(),
              itemCount: options.length,
              itemBuilder: (_, i) {
                final opt = Map<String, dynamic>.from(options[i]);
                final value = opt['value']?.toString() ?? '';
                final selected = _answers[qId] == value;
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _answers[qId] = value);
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.only(bottom: 10),
                    child: GlassCard(
                      borderColor: selected ? AppColors.purple : null,
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: selected ? AppColors.purple : Colors.transparent,
                              border: Border.all(color: selected ? AppColors.purple : c.textMuted, width: 2),
                            ),
                            child: selected ? const Icon(Icons.check, color: Colors.white, size: 14) : null,
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(opt['text']?.toString() ?? '', style: TextStyle(color: c.textPrimary, fontSize: 14))),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // Navigation
          Row(
            children: [
              if (_currentQ > 0)
                TextButton.icon(
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    setState(() => _currentQ--);
                  },
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('Back'),
                  style: TextButton.styleFrom(foregroundColor: c.textSecondary),
                ),
              const Spacer(),
              ElevatedButton(
                onPressed: _answers[qId] == null
                    ? null
                    : () {
                        HapticFeedback.mediumImpact();
                        if (isLast) { _submit(); } else { setState(() => _currentQ++); }
                      },
                style: AppTheme.gradientButtonStyle(),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(isLast ? 'Complete' : 'Next'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
