import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';
import 'ai_summary_viewer.dart';
import 'ai_flashcard_viewer.dart';
import 'ai_practice_quiz_screen.dart';
import 'subjects_screen.dart';

// ── Pastel palette — matches home screen "Sunrise" theme ──
const _pSlate     = Color(0xFF8BB5DC); // soft sky (default)
const _pLavender  = Color(0xFFBFA8D9); // flashcards
const _pSky       = Color(0xFFA9C9E8); // summary
const _pSage      = Color(0xFFA8C9A8); // mindmap
const _pPeach     = Color(0xFFF0A48C); // quiz

Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

class AiStudyMaterialsScreen extends StatefulWidget {
  final String? courseId;
  final String? courseName;
  const AiStudyMaterialsScreen({super.key, this.courseId, this.courseName});
  @override
  State<AiStudyMaterialsScreen> createState() => _AiStudyMaterialsScreenState();
}

class _AiStudyMaterialsScreenState extends State<AiStudyMaterialsScreen> {
  List<Map<String, dynamic>> _materials = [];
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
      final raw = await ApiService.aiGetStudyMaterials(courseId: widget.courseId);
      if (!mounted) return;
      setState(() { _materials = raw.map((m) => Map<String, dynamic>.from(m)).toList(); _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _delete(String id) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Material',
      message: 'Delete this study material?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok != true) return;
    try {
      await ApiService.aiDeleteStudyMaterial(id);
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to delete: $e'), backgroundColor: AppColors.red));
    }
  }

  /// Backend stores flashcards/quiz/mindmap as a JSON-serialized string
  /// (via `json.dumps(...)`) and summaries as plain markdown text. Normalise
  /// both shapes here so the viewers always receive real lists / strings.
  List<Map<String, dynamic>> _parseList(dynamic raw) {
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (raw is String && raw.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          return decoded
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
        // Some backends wrap the list under a key (e.g. {"questions": [...]})
        if (decoded is Map) {
          for (final key in const ['questions', 'cards', 'flashcards', 'items', 'data']) {
            final v = decoded[key];
            if (v is List) {
              return v
                  .whereType<Map>()
                  .map((e) => Map<String, dynamic>.from(e))
                  .toList();
            }
          }
        }
      } catch (_) {}
    }
    return const [];
  }

  void _openMaterial(Map<String, dynamic> m) {
    HapticFeedback.lightImpact();
    final type = m['type']?.toString() ?? '';
    final content = m['content'];
    final title = m['title']?.toString() ?? 'Study Material';

    Widget screen;
    if (type == 'flashcards') {
      screen = AiFlashcardViewer(title: title, cards: _parseList(content), material: m);
    } else if (type == 'quiz') {
      screen = AiPracticeQuizScreen(title: title, questions: _parseList(content), material: m);
    } else {
      // summary / mindmap / default → plain text
      screen = AiSummaryViewer(title: title, content: content?.toString() ?? '', material: m);
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'flashcards': return Icons.style_rounded;
      case 'quiz': return Icons.quiz_rounded;
      case 'mindmap': return Icons.account_tree_rounded;
      case 'summary': return Icons.article_rounded;
      default: return Icons.auto_awesome_rounded;
    }
  }

  Color _colorForType(String type) {
    switch (type) {
      case 'flashcards': return _pLavender;
      case 'quiz': return _pPeach;
      case 'mindmap': return _pSage;
      case 'summary': return _pSky;
      default: return _pSlate;
    }
  }

  String _labelForType(String type) {
    switch (type) {
      case 'flashcards': return 'FLASHCARDS';
      case 'quiz': return 'QUIZ';
      case 'mindmap': return 'MIND MAP';
      case 'summary': return 'SUMMARY';
      default: return type.toUpperCase();
    }
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
            const Text('AI Study Materials', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            if (widget.courseName != null)
              Text(widget.courseName!, style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(icon: Icon(Icons.refresh_rounded, color: c.textSecondary), onPressed: _load),
        ],
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!, style: TextStyle(color: c.textSecondary)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _load, style: AppTheme.gradientButtonStyle(), child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pLavender,
                  child: _materials.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                          padding: const EdgeInsets.fromLTRB(20, 40, 20, 100),
                          children: [_buildEmptyState(c)],
                        )
                      : AnimationLimiter(
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                            itemCount: _materials.length,
                            itemBuilder: (_, i) => AnimatedListItem(
                              index: i,
                              child: _buildCard(_materials[i]),
                            ),
                          ),
                        ),
                ),
    );
  }

  Widget _buildCard(Map<String, dynamic> m) {
    final c = context.colors;
    final type = m['type']?.toString() ?? 'summary';
    final title = m['title']?.toString() ?? 'Untitled';
    final color = _colorForType(type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        onTap: () => _openMaterial(m),
        borderColor: color.withOpacity(0.35),
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _darken(color, 0.06),
                    _darken(color, 0.22),
                  ],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: Colors.white.withOpacity(0.35), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: _darken(color, 0.18).withOpacity(0.55),
                    blurRadius: 12,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Icon(_iconForType(type), color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14)),
                  const SizedBox(height: 4),
                  BadgeChip(label: _labelForType(type), color: color),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => _delete(m['id']?.toString() ?? ''),
              child: Icon(Icons.delete_outline_rounded,
                  size: 20, color: c.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(dynamic c) {
    const types = [
      ('summary', 'Summaries', _pSky, Icons.article_rounded),
      ('flashcards', 'Flashcards', _pLavender, Icons.style_rounded),
      ('quiz', 'Quizzes', _pPeach, Icons.quiz_rounded),
      ('mindmap', 'Mind Maps', _pSage, Icons.account_tree_rounded),
    ];

    return Column(
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _darken(_pLavender, 0.05),
                _darken(_pLavender, 0.22),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: _darken(_pLavender, 0.18).withOpacity(0.55),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(Icons.auto_awesome_rounded,
              color: Colors.white, size: 40),
        ),
        const SizedBox(height: 20),
        Text(
          widget.courseId == null
              ? 'No study materials yet'
              : 'Nothing generated for this course yet',
          style: TextStyle(
            color: c.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            widget.courseId == null
                ? 'AI materials are generated from your course resources. Open a course and tap the "Generate" button on any resource to create summaries, flashcards, quizzes, or mind maps.'
                : 'Open a resource inside this course and tap "Generate" to create a summary, flashcards, a quiz, or a mind map.',
            style: TextStyle(
              color: c.textSecondary,
              fontSize: 13,
              height: 1.45,
            ),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 22),
        // Type legend — shows what can be generated
        Wrap(
          spacing: 10,
          runSpacing: 10,
          alignment: WrapAlignment.center,
          children: types.map((t) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: t.$3.withOpacity(0.16),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: t.$3.withOpacity(0.45), width: 1),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: _darken(t.$3, 0.15),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Icon(t.$4, color: Colors.white, size: 14),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    t.$2,
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 28),
        if (widget.courseId == null)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                HapticFeedback.lightImpact();
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const SubjectsScreen()),
                );
              },
              icon: const Icon(Icons.school_rounded,
                  color: Colors.white, size: 20),
              label: const Text(
                'Browse My Courses',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _darken(_pLavender, 0.12),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 4,
                shadowColor: _darken(_pLavender, 0.18).withOpacity(0.55),
              ),
            ),
          ),
      ],
    );
  }
}
