import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/app_background.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/glass_card.dart';
import '../widgets/skeletons.dart';

// ─── Shared pastel palette ──────────────────────────────────────────────
const _pSlate    = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam  = Color(0xFF7BB5B0);
const _pPeach    = Color(0xFFD8A28E);
const _pSand     = Color(0xFFC9A86A);
const _pRose     = Color(0xFFC99999);
const _pSky      = Color(0xFF8BB5C9);

Color _darken(Color c, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(c);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

Color _scoreColor(int pct) {
  if (pct >= 80) return _pSeafoam;
  if (pct >= 50) return _pSand;
  return _pRose;
}

// ════════════════════════════════════════════════════════════════════════
// Main Quizzes screen
// ════════════════════════════════════════════════════════════════════════
class QuizzesScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const QuizzesScreen({
    super.key,
    required this.courseId,
    required this.courseName,
    this.isLecturer = false,
  });
  @override
  State<QuizzesScreen> createState() => _QuizzesScreenState();
}

class _QuizzesScreenState extends State<QuizzesScreen> {
  List<Map<String, dynamic>> _quizzes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getQuizzes(widget.courseId);
      if (!mounted) return;
      setState(() {
        _quizzes = raw.map((q) => Map<String, dynamic>.from(q)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _publishedCount =>
      _quizzes.where((q) => q['is_published'] == true).length;
  int get _draftCount => _quizzes.length - _publishedCount;
  int get _totalQuestions => _quizzes.fold<int>(
      0, (acc, q) => acc + ((q['question_count'] as num?)?.toInt() ?? 0));

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Quizzes',
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                )),
            Text(widget.courseName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                )),
          ],
        ),
      ),
      floatingActionButton: widget.isLecturer
          ? _GradientFab(
              label: 'New Quiz',
              icon: Icons.add_rounded,
              colors: const [_pSlate, _pLavender],
              onPressed: _openCreateSheet,
            )
          : null,
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  color: _pSlate,
                  onRefresh: _load,
                  child: _buildBody(),
                ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
            child: _summaryCard(),
          ),
        ),
        if (_quizzes.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _emptyState(),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 110),
            sliver: SliverList.builder(
              itemCount: _quizzes.length,
              itemBuilder: (_, i) => AnimationConfiguration.staggeredList(
                position: i,
                duration: const Duration(milliseconds: 360),
                child: SlideAnimation(
                  verticalOffset: 20,
                  child: FadeInAnimation(child: _quizCard(_quizzes[i])),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _summaryCard() {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          _pSlate.withValues(alpha: context.isDark ? 0.14 : 0.08),
          _pLavender.withValues(alpha: context.isDark ? 0.10 : 0.05),
        ],
      ),
      borderColor: _pSlate.withValues(alpha: 0.25),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_pSlate, _pLavender],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: _pSlate.withValues(alpha: 0.35),
                  blurRadius: 12,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: const Icon(Icons.quiz_rounded,
                color: Colors.white, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_quizzes.length} Quiz${_quizzes.length == 1 ? '' : 'zes'}',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (widget.isLecturer) ...[
                      _StatChip(
                          label: 'Published',
                          value: _publishedCount.toString(),
                          color: _pSeafoam),
                      const SizedBox(width: 6),
                      _StatChip(
                          label: 'Drafts',
                          value: _draftCount.toString(),
                          color: _pSand),
                    ] else
                      _StatChip(
                          label: 'Questions',
                          value: _totalQuestions.toString(),
                          color: _pLavender),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _quizCard(Map<String, dynamic> quiz) {
    final c = context.colors;
    final title = quiz['title']?.toString() ?? 'Untitled';
    final questionCount = quiz['question_count'] ?? 0;
    final timeLimit = quiz['time_limit_minutes'];
    final isPublished = quiz['is_published'] == true;
    final statusColor =
        widget.isLecturer ? (isPublished ? _pSeafoam : _pSand) : _pSlate;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        borderColor: statusColor.withValues(alpha: 0.26),
        onTap: () {
          HapticFeedback.lightImpact();
          if (widget.isLecturer) {
            _showLecturerQuizActions(quiz);
          } else {
            _takeQuiz(quiz);
          }
        },
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [statusColor, _darken(statusColor, 0.08)],
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
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
                              statusColor.withValues(alpha: 0.88),
                              _darken(statusColor, 0.10),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withValues(alpha: 0.30),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(Icons.quiz_rounded,
                            color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 14.5,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: [
                                _MetaChip(
                                  icon: Icons.help_outline_rounded,
                                  label: '$questionCount Q',
                                  color: _pLavender,
                                ),
                                if (timeLimit != null)
                                  _MetaChip(
                                    icon: Icons.timer_outlined,
                                    label: '${timeLimit}m',
                                    color: _pPeach,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      if (widget.isLecturer)
                        _PastelBadge(
                          label: isPublished ? 'PUBLISHED' : 'DRAFT',
                          color: statusColor,
                        )
                      else
                        Icon(Icons.chevron_right_rounded,
                            color: c.textMuted),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _emptyState() {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 40, 24, 80),
        child: Text(
          widget.isLecturer ? 'No quizzes created' : 'No quizzes yet',
          style: TextStyle(
            color: c.textMuted,
            fontSize: 13.5,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  // ─── Flows ──────────────────────────────────────────────────────────
  void _takeQuiz(Map<String, dynamic> quiz) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _QuizAttemptScreen(
          quizId: quiz['id']?.toString() ?? '',
          quizTitle: quiz['title']?.toString() ?? '',
        ),
      ),
    );
  }

  void _showLecturerQuizActions(Map<String, dynamic> quiz) {
    final questionCount = (quiz['question_count'] as num?)?.toInt() ?? 0;
    // If the quiz has no questions yet, skip the menu and jump straight to
    // the questions screen — that's what the lecturer needs next.
    if (questionCount == 0) {
      _manageQuestions(quiz);
      return;
    }
    showGlassBottomSheet<void>(
      context: context,
      builder: (ctx) {
        final c = ctx.colors;
        final title = quiz['title']?.toString() ?? 'Quiz';
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 0, 4, 14),
                child: Text(
                  title,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _LecturerActionTile(
                icon: Icons.help_outline_rounded,
                label: 'Manage questions',
                sub: '$questionCount question${questionCount == 1 ? '' : 's'}',
                color: _pLavender,
                onTap: () {
                  Navigator.pop(ctx);
                  _manageQuestions(quiz);
                },
              ),
              const SizedBox(height: 8),
              _LecturerActionTile(
                icon: Icons.assessment_rounded,
                label: 'View results',
                sub: 'Student attempts & scores',
                color: _pSlate,
                onTap: () {
                  Navigator.pop(ctx);
                  _showQuizResults(quiz);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _manageQuestions(Map<String, dynamic> quiz) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _QuizQuestionsScreen(
          quizId: quiz['id']?.toString() ?? '',
          quizTitle: quiz['title']?.toString() ?? 'Quiz',
        ),
      ),
    );
    if (mounted) _load();
  }

  void _showQuizResults(Map<String, dynamic> quiz) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _QuizResultsScreen(
          quizId: quiz['id']?.toString() ?? '',
          quizTitle: quiz['title']?.toString() ?? '',
        ),
      ),
    );
  }

  Future<void> _openCreateSheet() async {
    final created = await showGlassBottomSheet<Map<String, dynamic>>(
      context: context,
      builder: (_) => _CreateQuizSheet(courseId: widget.courseId),
    );
    if (!mounted || created == null) return;
    await _load();
    if (!mounted) return;
    final quizId = created['id']?.toString() ?? '';
    final quizTitle = created['title']?.toString() ?? 'Quiz';
    if (quizId.isEmpty) return;
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _QuizQuestionsScreen(
          quizId: quizId,
          quizTitle: quizTitle,
        ),
      ),
    );
    if (mounted) _load();
  }
}

// ════════════════════════════════════════════════════════════════════════
// Create Quiz sheet (lecturer) — replaces AlertDialog
// ════════════════════════════════════════════════════════════════════════
class _CreateQuizSheet extends StatefulWidget {
  final String courseId;
  const _CreateQuizSheet({required this.courseId});
  @override
  State<_CreateQuizSheet> createState() => _CreateQuizSheetState();
}

class _CreateQuizSheetState extends State<_CreateQuizSheet> {
  final _titleCtrl = TextEditingController();
  final _timeCtrl = TextEditingController(text: '30');
  final _titleFocus = FocusNode();
  final _timeFocus = FocusNode();
  bool _loading = false;
  String? _titleErr;

  @override
  void initState() {
    super.initState();
    _titleFocus.addListener(() => setState(() {}));
    _timeFocus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _timeCtrl.dispose();
    _titleFocus.dispose();
    _timeFocus.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _titleErr = 'Title is required');
      return;
    }
    setState(() => _loading = true);
    try {
      final created = await ApiService.createQuiz({
        'course_id': widget.courseId,
        'title': title,
        'time_limit_minutes': int.tryParse(_timeCtrl.text.trim()) ?? 30,
      });
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      Navigator.pop(context, Map<String, dynamic>.from(created));
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 12, 10),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_pSlate, _pLavender],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: _pSlate.withValues(alpha: 0.34),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.quiz_rounded,
                      color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Create Quiz',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          )),
                      Text('You will add questions next.',
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 11.5)),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: c.textSecondary),
                  onPressed:
                      _loading ? null : () => Navigator.pop(context, false),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              children: [
                _GlassField(
                  controller: _titleCtrl,
                  focusNode: _titleFocus,
                  label: 'Quiz title',
                  hint: 'e.g. Week 4 knowledge check',
                  icon: Icons.quiz_rounded,
                  accent: _pSlate,
                  autofocus: true,
                  errorText: _titleErr,
                  onChanged: (_) {
                    if (_titleErr != null) setState(() => _titleErr = null);
                  },
                ),
                const SizedBox(height: 12),
                _GlassField(
                  controller: _timeCtrl,
                  focusNode: _timeFocus,
                  label: 'Time limit (minutes)',
                  hint: '30',
                  icon: Icons.timer_rounded,
                  accent: _pPeach,
                  keyboardType: TextInputType.number,
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
                16, 0, 16, MediaQuery.of(context).padding.bottom + 12),
            child: Row(
              children: [
                Expanded(
                  child: _PastelOutlineButton(
                    label: 'Cancel',
                    onPressed: _loading
                        ? null
                        : () => Navigator.pop(context, false),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: _PastelButton(
                    label: _loading ? 'Creating…' : 'Create Quiz',
                    icon: Icons.add_task_rounded,
                    colors: const [_pSlate, _pLavender],
                    busy: _loading,
                    onPressed: _loading ? null : _create,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Quiz Attempt screen (student)
// ════════════════════════════════════════════════════════════════════════
class _QuizAttemptScreen extends StatefulWidget {
  final String quizId;
  final String quizTitle;
  const _QuizAttemptScreen(
      {required this.quizId, required this.quizTitle});
  @override
  State<_QuizAttemptScreen> createState() => _QuizAttemptScreenState();
}

class _QuizAttemptScreenState extends State<_QuizAttemptScreen> {
  List<Map<String, dynamic>> _questions = [];
  Map<String, dynamic>? _existingAttempt;
  final Map<String, String> _answers = {};
  bool _loading = true;
  bool _submitting = false;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final attempt = await ApiService.getMyQuizAttempt(widget.quizId);
      if (attempt != null) {
        if (!mounted) return;
        setState(() {
          _existingAttempt = Map<String, dynamic>.from(attempt);
          _loading = false;
          _submitted = true;
        });
        return;
      }
    } catch (_) {}

    try {
      final qs = await ApiService.getQuizQuestions(widget.quizId);
      if (!mounted) return;
      setState(() {
        _questions = qs.map((q) => Map<String, dynamic>.from(q)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _answeredCount => _answers.values.where((v) => v.isNotEmpty).length;

  Future<void> _confirmAndSubmit() async {
    if (_answeredCount < _questions.length) {
      final proceed = await _showConfirmSheet();
      if (proceed != true) return;
    }
    _submit();
  }

  Future<bool?> _showConfirmSheet() {
    final remaining = _questions.length - _answeredCount;
    return showGlassBottomSheet<bool>(
      context: context,
      builder: (_) {
        final c = context.colors;
        return Padding(
          padding: EdgeInsets.fromLTRB(
              20, 4, 20, MediaQuery.of(context).padding.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 54, height: 54,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [_pSand, _pPeach]),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: _pSand.withValues(alpha: 0.30),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: const Icon(Icons.info_outline_rounded,
                    color: Colors.white, size: 26),
              ),
              const SizedBox(height: 14),
              Text(
                'Submit with unanswered questions?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'You have $remaining unanswered question${remaining == 1 ? '' : 's'}. Submitting now will mark them as incorrect.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: c.textSecondary, fontSize: 12.5, height: 1.5),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _PastelOutlineButton(
                      label: 'Keep editing',
                      onPressed: () => Navigator.pop(context, false),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _PastelButton(
                      label: 'Submit anyway',
                      icon: Icons.send_rounded,
                      colors: const [_pSlate, _pLavender],
                      onPressed: () => Navigator.pop(context, true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submit() async {
    HapticFeedback.mediumImpact();
    setState(() => _submitting = true);
    try {
      final result = await ApiService.submitQuizAttempt(
          widget.quizId, {'answers': _answers});
      if (!mounted) return;
      setState(() {
        _existingAttempt = result;
        _submitted = true;
        _submitting = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _submitted ? 'Quiz Result' : 'Answer',
              style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800),
            ),
            Text(
              widget.quizTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : _submitted
                  ? _resultView()
                  : _questionView(),
        ),
      ),
    );
  }

  // ─── Result view ────────────────────────────────────────────────────
  Widget _resultView() {
    final c = context.colors;
    final score = _existingAttempt?['score'] ?? 0;
    final total = _existingAttempt?['total'] ?? 0;
    final pct = total > 0 ? (score / total * 100).round() : 0;
    final color = _scoreColor(pct);
    final passed = pct >= 50;
    final verdict = pct >= 80
        ? 'Excellent work'
        : pct >= 50
            ? 'Solid effort'
            : 'Keep practising';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
          child: Column(
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 128, height: 128,
                    child: CircularProgressIndicator(
                      value: pct / 100,
                      strokeWidth: 10,
                      backgroundColor: c.surfaceInput,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$pct%',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 30,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        '$score of $total',
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _PastelBadge(
                label: passed ? 'PASSED' : 'REVIEW NEEDED',
                color: passed ? _pSeafoam : _pRose,
              ),
              const SizedBox(height: 10),
              Text(
                verdict,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                passed
                    ? 'Your attempt has been recorded.'
                    : 'Take another look at the topics you missed.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 18),
              _PastelButton(
                label: 'Back to Quizzes',
                icon: Icons.arrow_back_rounded,
                colors: const [_pSlate, _pLavender],
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Question view ──────────────────────────────────────────────────
  Widget _questionView() {
    final progress = _questions.isEmpty
        ? 0.0
        : _answeredCount / _questions.length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
          child: _progressCard(progress),
        ),
        Expanded(
          child: ListView.builder(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            itemCount: _questions.length,
            itemBuilder: (_, i) => _questionCard(i),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
              16, 0, 16, MediaQuery.of(context).padding.bottom + 14),
          child: _PastelButton(
            label: _submitting ? 'Submitting…' : 'Submit Quiz',
            icon: Icons.check_circle_rounded,
            colors: const [_pSlate, _pLavender],
            busy: _submitting,
            onPressed: _submitting ? null : _confirmAndSubmit,
          ),
        ),
      ],
    );
  }

  Widget _progressCard(double progress) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.task_alt_rounded, size: 16, color: _pSlate),
              const SizedBox(width: 6),
              Text(
                '$_answeredCount of ${_questions.length} answered',
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                '${(progress * 100).round()}%',
                style: TextStyle(
                  color: _pSlate,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 7,
              backgroundColor: c.surfaceInput,
              valueColor: const AlwaysStoppedAnimation(_pSlate),
            ),
          ),
        ],
      ),
    );
  }

  Widget _questionCard(int i) {
    final c = context.colors;
    final q = _questions[i];
    final qid = q['id']?.toString() ?? '$i';
    final qType = q['type']?.toString() ?? 'mcq';
    final options = (q['options'] as List?)?.cast<String>() ?? [];
    final answered = (_answers[qid] ?? '').isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        borderColor:
            answered ? _pSeafoam.withValues(alpha: 0.28) : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_pSlate, _pLavender],
                    ),
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: [
                      BoxShadow(
                        color: _pSlate.withValues(alpha: 0.28),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${i + 1}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    q['text']?.toString() ?? '',
                    style: TextStyle(
                      color: c.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ),
                if (answered)
                  const Padding(
                    padding: EdgeInsets.only(left: 6, top: 4),
                    child: Icon(Icons.check_circle_rounded,
                        color: _pSeafoam, size: 18),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if (qType == 'mcq' || qType == 'true_false')
              ...options.map(
                (opt) {
                  final selected = _answers[qid] == opt;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _OptionTile(
                      label: opt,
                      selected: selected,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _answers[qid] = opt);
                      },
                    ),
                  );
                },
              )
            else
              TextField(
                onChanged: (v) => setState(() => _answers[qid] = v),
                style: TextStyle(color: c.textPrimary, fontSize: 13.5),
                decoration: InputDecoration(
                  hintText: 'Type your answer…',
                  hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
                  filled: true,
                  fillColor: c.surfaceInput.withValues(alpha: 0.55),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: c.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: c.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide:
                        const BorderSide(color: _pSlate, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Quiz Results screen (lecturer)
// ════════════════════════════════════════════════════════════════════════
class _QuizResultsScreen extends StatefulWidget {
  final String quizId;
  final String quizTitle;
  const _QuizResultsScreen(
      {required this.quizId, required this.quizTitle});
  @override
  State<_QuizResultsScreen> createState() => _QuizResultsScreenState();
}

class _QuizResultsScreenState extends State<_QuizResultsScreen> {
  List<Map<String, dynamic>> _attempts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getQuizAttempts(widget.quizId);
      if (!mounted) return;
      setState(() {
        _attempts =
            raw.map((a) => Map<String, dynamic>.from(a)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _pctOf(Map<String, dynamic> a) {
    final score = (a['score'] as num?)?.toInt() ?? 0;
    final total = (a['total'] as num?)?.toInt() ?? 0;
    return total > 0 ? (score / total * 100).round() : 0;
  }

  double get _avgPct {
    if (_attempts.isEmpty) return 0;
    final sum = _attempts.fold<int>(0, (acc, a) => acc + _pctOf(a));
    return sum / _attempts.length;
  }

  int get _highScoreCount => _attempts.where((a) => _pctOf(a) >= 80).length;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Results',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w800)),
            Text(widget.quizTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500)),
          ],
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  color: _pSlate,
                  onRefresh: _load,
                  child: CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                          child: _summary(),
                        ),
                      ),
                      if (_attempts.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: _empty(),
                        )
                      else
                        SliverPadding(
                          padding:
                              const EdgeInsets.fromLTRB(16, 4, 16, 24),
                          sliver: SliverList.builder(
                            itemCount: _attempts.length,
                            itemBuilder: (_, i) =>
                                AnimationConfiguration.staggeredList(
                              position: i,
                              duration:
                                  const Duration(milliseconds: 340),
                              child: SlideAnimation(
                                verticalOffset: 18,
                                child: FadeInAnimation(
                                    child: _attemptCard(_attempts[i])),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _summary() {
    final c = context.colors;
    final avg = _avgPct.round();
    final avgColor = _scoreColor(avg);
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Row(
        children: [
          SizedBox(
            width: 64, height: 64,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 64, height: 64,
                  child: CircularProgressIndicator(
                    value: _attempts.isEmpty ? 0 : avg / 100,
                    strokeWidth: 6,
                    backgroundColor: c.surfaceInput,
                    valueColor: AlwaysStoppedAnimation(avgColor),
                  ),
                ),
                Text(
                  _attempts.isEmpty ? '—' : '$avg%',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('CLASS AVERAGE',
                    style: TextStyle(
                      color: c.textMuted,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    )),
                const SizedBox(height: 4),
                Text(
                  _attempts.isEmpty
                      ? 'No attempts yet'
                      : 'Across ${_attempts.length} attempt${_attempts.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _StatChip(
                      label: 'Attempts',
                      value: _attempts.length.toString(),
                      color: _pSlate,
                    ),
                    const SizedBox(width: 6),
                    _StatChip(
                      label: '≥ 80%',
                      value: _highScoreCount.toString(),
                      color: _pSeafoam,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _empty() {
    final c = context.colors;
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
        child: GlassCard(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 60, height: 60,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_pSlate, _pLavender],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: _pSlate.withValues(alpha: 0.30),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(Icons.assessment_rounded,
                    size: 30, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text('No attempts yet',
                  style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Student results will appear here after they submit.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: c.textSecondary, fontSize: 12.5, height: 1.4)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _attemptCard(Map<String, dynamic> a) {
    final c = context.colors;
    final score = a['score'] ?? 0;
    final total = a['total'] ?? 0;
    final pct = _pctOf(a);
    final name = a['student_name']?.toString() ?? 'Student';
    final color = _scoreColor(pct);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        borderColor: color.withValues(alpha: 0.24),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(
                width: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [color, _darken(color, 0.08)],
                  ),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  child: Row(
                    children: [
                      AvatarWidget(
                        name: name,
                        imageUrl: a['student_photo_url']?.toString() ?? '',
                        size: 36,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if ((a['student_email']?.toString() ?? '')
                                .isNotEmpty)
                              Text(
                                a['student_email'].toString(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: c.textMuted, fontSize: 11.5),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [
                            color,
                            _darken(color, 0.10),
                          ]),
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: color.withValues(alpha: 0.28),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '$pct%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              '$score / $total',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Reusable widgets
// ════════════════════════════════════════════════════════════════════════

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _StatChip(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6, height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            value,
            style: TextStyle(
              color: _darken(color, 0.22),
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: _darken(color, 0.20),
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: _darken(color, 0.22)),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: _darken(color, 0.22),
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _PastelBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _PastelBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: _darken(color, 0.22),
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _OptionTile({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: selected
              ? _pSlate.withValues(alpha: 0.14)
              : c.surfaceInput.withValues(alpha: 0.50),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? _pSlate.withValues(alpha: 0.55)
                : c.border,
            width: 1.3,
          ),
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 20, height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? _pSlate : c.textMuted,
                  width: 2,
                ),
                color: selected ? _pSlate : Colors.transparent,
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      color: Colors.white, size: 13)
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 13.5,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final String? hint;
  final IconData icon;
  final Color accent;
  final TextInputType? keyboardType;
  final bool autofocus;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  const _GlassField({
    required this.controller,
    required this.focusNode,
    required this.label,
    this.hint,
    required this.icon,
    required this.accent,
    this.keyboardType,
    this.autofocus = false,
    this.errorText,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final focused = focusNode.hasFocus;
    return TextField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      autofocus: autofocus,
      onChanged: onChanged,
      style: TextStyle(
        color: c.textPrimary,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: errorText,
        labelStyle: TextStyle(
          color: focused ? accent : c.textMuted,
          fontWeight: FontWeight.w700,
        ),
        hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 12, right: 10),
          child:
              Icon(icon, size: 18, color: focused ? accent : c.textMuted),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 40),
        filled: true,
        fillColor: focused
            ? accent.withValues(alpha: 0.08)
            : c.surfaceInput.withValues(alpha: 0.55),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _pRose),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _pRose, width: 1.5),
        ),
      ),
    );
  }
}

class _PastelButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final List<Color> colors;
  final VoidCallback? onPressed;
  final bool busy;
  const _PastelButton({
    required this.label,
    this.icon,
    required this.colors,
    this.onPressed,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: colors),
            borderRadius: BorderRadius.circular(14),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: colors.first.withValues(alpha: 0.36),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                const SizedBox(
                  width: 17, height: 17,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2, color: Colors.white,
                  ),
                )
              else if (icon != null)
                Icon(icon, color: Colors.white, size: 17),
              if (busy || icon != null) const SizedBox(width: 7),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PastelOutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color? color;
  const _PastelOutlineButton({
    required this.label,
    this.onPressed,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final accent = color ?? c.textSecondary;
    final disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: accent.withValues(alpha: 0.40)),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: accent,
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}


class _GradientFab extends StatelessWidget {
  final String label;
  final IconData icon;
  final List<Color> colors;
  final VoidCallback onPressed;
  const _GradientFab({
    required this.label,
    required this.icon,
    required this.colors,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: colors),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: colors.first.withValues(alpha: 0.38),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Lecturer action tile (used in the quiz actions sheet)
// ════════════════════════════════════════════════════════════════════════
class _LecturerActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final Color color;
  final VoidCallback onTap;
  const _LecturerActionTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.24)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        )),
                    Text(sub,
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 11.5,
                        )),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Quiz Questions management screen (lecturer) — add / list / delete
// ════════════════════════════════════════════════════════════════════════
class _QuizQuestionsScreen extends StatefulWidget {
  final String quizId;
  final String quizTitle;
  const _QuizQuestionsScreen({
    required this.quizId,
    required this.quizTitle,
  });
  @override
  State<_QuizQuestionsScreen> createState() => _QuizQuestionsScreenState();
}

class _QuizQuestionsScreenState extends State<_QuizQuestionsScreen> {
  List<Map<String, dynamic>> _questions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getQuizQuestions(widget.quizId);
      if (!mounted) return;
      setState(() {
        _questions = raw.map((q) => Map<String, dynamic>.from(q)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _totalPoints => _questions.fold<int>(
      0, (acc, q) => acc + ((q['points'] as num?)?.toInt() ?? 1));

  Future<void> _openAddSheet() async {
    final added = await showGlassBottomSheet<bool>(
      context: context,
      builder: (_) => _AddQuestionSheet(quizId: widget.quizId),
    );
    if (added == true) _load();
  }

  Future<void> _deleteQuestion(Map<String, dynamic> q) async {
    final qid = q['id']?.toString() ?? '';
    if (qid.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final c = ctx.colors;
        return AlertDialog(
          backgroundColor: c.surfaceCard,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18)),
          title: Text('Delete question?',
              style: TextStyle(color: c.textPrimary)),
          content: Text(
            'This cannot be undone.',
            style: TextStyle(color: c.textSecondary),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel',
                  style: TextStyle(color: c.textSecondary)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete',
                  style: TextStyle(color: _pRose)),
            ),
          ],
        );
      },
    );
    if (ok != true) return;
    try {
      await ApiService.deleteQuizQuestion(widget.quizId, qid);
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Questions',
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                )),
            Text(widget.quizTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                )),
          ],
        ),
      ),
      floatingActionButton: _GradientFab(
        label: 'Add Question',
        icon: Icons.add_rounded,
        colors: const [_pSlate, _pLavender],
        onPressed: _openAddSheet,
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 4)
              : RefreshIndicator(
                  color: _pSlate,
                  onRefresh: _load,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics()),
                    slivers: [
                      SliverToBoxAdapter(
                        child: Padding(
                          padding:
                              const EdgeInsets.fromLTRB(16, 6, 16, 10),
                          child: _summaryCard(),
                        ),
                      ),
                      if (_questions.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(
                                  24, 40, 24, 80),
                              child: Text(
                                'No questions yet',
                                style: TextStyle(
                                  color: c.textMuted,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding:
                              const EdgeInsets.fromLTRB(16, 4, 16, 110),
                          sliver: SliverList.builder(
                            itemCount: _questions.length,
                            itemBuilder: (_, i) =>
                                AnimationConfiguration.staggeredList(
                              position: i,
                              duration:
                                  const Duration(milliseconds: 340),
                              child: SlideAnimation(
                                verticalOffset: 18,
                                child: FadeInAnimation(
                                  child: _questionCard(
                                      i + 1, _questions[i]),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _summaryCard() {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          _pSlate.withValues(alpha: context.isDark ? 0.14 : 0.08),
          _pLavender.withValues(alpha: context.isDark ? 0.10 : 0.05),
        ],
      ),
      borderColor: _pSlate.withValues(alpha: 0.25),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_pSlate, _pLavender],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.help_outline_rounded,
                color: Colors.white, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_questions.length} Question${_questions.length == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                _StatChip(
                  label: 'Total points',
                  value: _totalPoints.toString(),
                  color: _pSand,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _questionCard(int index, Map<String, dynamic> q) {
    final c = context.colors;
    final type = q['type']?.toString() ?? 'mcq';
    final text = q['text']?.toString() ?? '';
    final points = (q['points'] as num?)?.toInt() ?? 1;
    final options = (q['options'] as List?)?.cast<dynamic>() ?? const [];
    final correctAnswer = q['correct_answer']?.toString() ?? '';
    final typeLabel = type == 'mcq'
        ? 'MCQ'
        : type == 'true_false'
            ? 'True / False'
            : 'Short answer';
    final typeColor = type == 'mcq'
        ? _pLavender
        : type == 'true_false'
            ? _pSeafoam
            : _pPeach;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        borderColor: typeColor.withValues(alpha: 0.24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: typeColor.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text('$index',
                        style: TextStyle(
                          color: typeColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        )),
                  ),
                ),
                const SizedBox(width: 10),
                _PastelBadge(label: typeLabel, color: typeColor),
                const SizedBox(width: 6),
                _PastelBadge(
                    label: '$points pt${points == 1 ? '' : 's'}',
                    color: _pSand),
                const Spacer(),
                IconButton(
                  icon: Icon(Icons.delete_outline_rounded,
                      color: _pRose, size: 20),
                  tooltip: 'Delete',
                  onPressed: () => _deleteQuestion(q),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              text,
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
            if (type == 'mcq' && options.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...List.generate(options.length, (i) {
                final isCorrect = correctAnswer == '$i';
                final opt = options[i]?.toString() ?? '';
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    children: [
                      Icon(
                        isCorrect
                            ? Icons.check_circle_rounded
                            : Icons.radio_button_unchecked,
                        size: 16,
                        color: isCorrect ? _pSeafoam : c.textMuted,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(opt,
                            style: TextStyle(
                              color: isCorrect
                                  ? c.textPrimary
                                  : c.textSecondary,
                              fontSize: 12.5,
                              fontWeight: isCorrect
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                            )),
                      ),
                    ],
                  ),
                );
              }),
            ] else if (type == 'true_false') ...[
              const SizedBox(height: 6),
              Text(
                'Answer: ${correctAnswer.isEmpty ? '—' : correctAnswer.toUpperCase()}',
                style: TextStyle(
                  color: _pSeafoam,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ] else if (type == 'short_answer') ...[
              const SizedBox(height: 6),
              Text(
                'Answer: ${correctAnswer.isEmpty ? '—' : correctAnswer}',
                style: TextStyle(
                  color: _pSeafoam,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
// Add Question sheet (MCQ / True-False / Short answer)
// ════════════════════════════════════════════════════════════════════════
class _AddQuestionSheet extends StatefulWidget {
  final String quizId;
  const _AddQuestionSheet({required this.quizId});
  @override
  State<_AddQuestionSheet> createState() => _AddQuestionSheetState();
}

class _AddQuestionSheetState extends State<_AddQuestionSheet> {
  String _type = 'mcq';
  final _textCtrl = TextEditingController();
  final _pointsCtrl = TextEditingController(text: '1');
  final _shortAnswerCtrl = TextEditingController();
  final _textFocus = FocusNode();
  final _pointsFocus = FocusNode();
  final _shortFocus = FocusNode();
  final List<TextEditingController> _optionCtrls =
      List.generate(4, (_) => TextEditingController());
  final List<FocusNode> _optionFocus = List.generate(4, (_) => FocusNode());
  int _correctOption = 0;
  String _tfAnswer = 'true';
  bool _saving = false;
  String? _textErr;

  @override
  void initState() {
    super.initState();
    _textFocus.addListener(() => setState(() {}));
    _pointsFocus.addListener(() => setState(() {}));
    _shortFocus.addListener(() => setState(() {}));
    for (final f in _optionFocus) {
      f.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _pointsCtrl.dispose();
    _shortAnswerCtrl.dispose();
    _textFocus.dispose();
    _pointsFocus.dispose();
    _shortFocus.dispose();
    for (final ctrl in _optionCtrls) {
      ctrl.dispose();
    }
    for (final f in _optionFocus) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) {
      setState(() => _textErr = 'Question text is required');
      return;
    }

    final points = double.tryParse(_pointsCtrl.text.trim()) ?? 1.0;
    List<String> options = [];
    String correctAnswer = '';

    if (_type == 'mcq') {
      options = _optionCtrls
          .map((c) => c.text.trim())
          .where((t) => t.isNotEmpty)
          .toList();
      if (options.length < 2) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: const Text('Add at least 2 options'),
              backgroundColor: _pRose),
        );
        return;
      }
      if (_correctOption >= options.length) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: const Text('Pick a correct option'),
              backgroundColor: _pRose),
        );
        return;
      }
      correctAnswer = '$_correctOption';
    } else if (_type == 'true_false') {
      correctAnswer = _tfAnswer;
    } else {
      correctAnswer = _shortAnswerCtrl.text.trim();
      if (correctAnswer.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: const Text('Provide the correct answer'),
              backgroundColor: _pRose),
        );
        return;
      }
    }

    setState(() => _saving = true);
    try {
      await ApiService.addQuizQuestion(widget.quizId, {
        'type': _type,
        'text': text,
        'options': options,
        'correct_answer': correctAnswer,
        'points': points,
      });
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 10),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [_pSlate, _pLavender],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.help_outline_rounded,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('Add Question',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        )),
                  ),
                  IconButton(
                    icon: Icon(Icons.close_rounded, color: c.textSecondary),
                    onPressed:
                        _saving ? null : () => Navigator.pop(context, false),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: _TypePill(
                      label: 'MCQ',
                      active: _type == 'mcq',
                      color: _pLavender,
                      onTap: () => setState(() => _type = 'mcq'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _TypePill(
                      label: 'True / False',
                      active: _type == 'true_false',
                      color: _pSeafoam,
                      onTap: () => setState(() => _type = 'true_false'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _TypePill(
                      label: 'Short',
                      active: _type == 'short_answer',
                      color: _pPeach,
                      onTap: () => setState(() => _type = 'short_answer'),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Column(
                children: [
                  _GlassField(
                    controller: _textCtrl,
                    focusNode: _textFocus,
                    label: 'Question',
                    hint: 'Type the question text',
                    icon: Icons.short_text_rounded,
                    accent: _pSlate,
                    autofocus: true,
                    errorText: _textErr,
                    onChanged: (_) {
                      if (_textErr != null) setState(() => _textErr = null);
                    },
                  ),
                  const SizedBox(height: 12),
                  if (_type == 'mcq')
                    Column(
                      children: List.generate(4, (i) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              GestureDetector(
                                onTap: () =>
                                    setState(() => _correctOption = i),
                                child: Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: _correctOption == i
                                        ? _pSeafoam.withValues(alpha: 0.18)
                                        : c.surfaceInput
                                            .withValues(alpha: 0.55),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: _correctOption == i
                                          ? _pSeafoam
                                          : c.border,
                                    ),
                                  ),
                                  child: Icon(
                                    _correctOption == i
                                        ? Icons.check_rounded
                                        : Icons.circle_outlined,
                                    color: _correctOption == i
                                        ? _pSeafoam
                                        : c.textMuted,
                                    size: 16,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _GlassField(
                                  controller: _optionCtrls[i],
                                  focusNode: _optionFocus[i],
                                  label: 'Option ${String.fromCharCode(65 + i)}',
                                  hint: _correctOption == i
                                      ? 'Correct answer'
                                      : null,
                                  icon: Icons.short_text_rounded,
                                  accent: _correctOption == i
                                      ? _pSeafoam
                                      : _pLavender,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    )
                  else if (_type == 'true_false')
                    Row(
                      children: [
                        Expanded(
                          child: _TypePill(
                            label: 'TRUE',
                            active: _tfAnswer == 'true',
                            color: _pSeafoam,
                            onTap: () => setState(() => _tfAnswer = 'true'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _TypePill(
                            label: 'FALSE',
                            active: _tfAnswer == 'false',
                            color: _pRose,
                            onTap: () => setState(() => _tfAnswer = 'false'),
                          ),
                        ),
                      ],
                    )
                  else
                    _GlassField(
                      controller: _shortAnswerCtrl,
                      focusNode: _shortFocus,
                      label: 'Correct answer',
                      hint: 'Expected student response',
                      icon: Icons.check_rounded,
                      accent: _pSeafoam,
                    ),
                  const SizedBox(height: 12),
                  _GlassField(
                    controller: _pointsCtrl,
                    focusNode: _pointsFocus,
                    label: 'Points',
                    hint: '1',
                    icon: Icons.stars_rounded,
                    accent: _pSand,
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, 4, 16, MediaQuery.of(context).padding.bottom + 12),
              child: Row(
                children: [
                  Expanded(
                    child: _PastelOutlineButton(
                      label: 'Cancel',
                      onPressed:
                          _saving ? null : () => Navigator.pop(context, false),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _PastelButton(
                      label: _saving ? 'Saving…' : 'Save Question',
                      icon: Icons.check_rounded,
                      colors: const [_pSlate, _pLavender],
                      busy: _saving,
                      onPressed: _saving ? null : _save,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  final String label;
  final bool active;
  final Color color;
  final VoidCallback onTap;
  const _TypePill({
    required this.label,
    required this.active,
    required this.color,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? color.withValues(alpha: 0.18)
              : c.surfaceInput.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: active ? color.withValues(alpha: 0.50) : c.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? color : c.textSecondary,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
