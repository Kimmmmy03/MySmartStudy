import 'package:flutter/material.dart';
import '../models/submission_model.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/skeletons.dart';

// ─── Shared pastel palette ──────────────────────────────────────────────
const _pSlate    = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam  = Color(0xFF7BB5B0);
const _pSand     = Color(0xFFC9A86A);
const _pRose     = Color(0xFFC99999);
const _pSky      = Color(0xFF8BB5C9);

Color _darken(Color c, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(c);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

Color _gradeColor(double g) {
  if (g >= 80) return _pSeafoam;
  if (g >= 60) return _pSky;
  if (g >= 50) return _pSand;
  return _pRose;
}

class LecturerSubmissionsScreen extends StatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  const LecturerSubmissionsScreen({
    super.key,
    required this.assignmentId,
    required this.assignmentTitle,
  });

  @override
  State<LecturerSubmissionsScreen> createState() =>
      _LecturerSubmissionsScreenState();
}

class _LecturerSubmissionsScreenState extends State<LecturerSubmissionsScreen> {
  List<SubmissionModel> _subs = [];
  bool _loading = true;
  bool _gradesReleased = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getSubmissions(widget.assignmentId);
      if (!mounted) return;
      setState(() {
        _subs = raw
            .map((s) => SubmissionModel.fromApi(Map<String, dynamic>.from(s)))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _aiPlagiarismCheck(SubmissionModel s) async {
    final c = context.colors;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: GlassCard(
          padding: const EdgeInsets.all(22),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 22, height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4, color: _pLavender,
                ),
              ),
              const SizedBox(width: 14),
              Text('Analyzing…',
                  style: TextStyle(
                      color: c.textPrimary, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
    try {
      final report = await ApiService.aiAnalyzePlagiarism(s.id);
      if (!mounted) return;
      Navigator.pop(context);
      _showPlagiarismReport(report);
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed: $e'),
          backgroundColor: _pRose,
        ),
      );
    }
  }

  void _showPlagiarismReport(Map<String, dynamic> report) {
    final score = (report['similarity_score'] ?? report['score'] ?? 0);
    final details = report['details']?.toString() ??
        report['analysis']?.toString() ??
        'No details available';
    final flagged = (report['flagged_sections'] as List?) ?? [];
    final highRisk = score is num && score > 50;
    final accent = highRisk ? _pRose : _pSeafoam;

    showGlassBottomSheet(
      context: context,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.65,
        maxChildSize: 0.92,
        minChildSize: 0.35,
        builder: (_, ctrl) {
          final c = context.colors;
          return ListView(
            controller: ctrl,
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            children: [
              Row(
                children: [
                  _GradientGlyph(
                    icon: Icons.plagiarism_rounded,
                    colors: [_pLavender, _darken(_pLavender)],
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Plagiarism Report',
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _GlassStatTile(
                color: accent,
                icon: highRisk
                    ? Icons.warning_amber_rounded
                    : Icons.verified_rounded,
                label: 'Similarity Score',
                value: '$score%',
                subtitle: highRisk
                    ? 'High overlap — please review flagged sections below.'
                    : 'Low similarity — submission looks original.',
              ),
              const SizedBox(height: 16),
              Text(
                'ANALYSIS',
                style: TextStyle(
                  color: c.textMuted,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                details,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
              if (flagged.isNotEmpty) ...[
                const SizedBox(height: 18),
                const Text(
                  'FLAGGED SECTIONS',
                  style: TextStyle(
                    color: _pRose,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 8),
                ...flagged.map(
                  (f) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                    decoration: BoxDecoration(
                      color: _pRose.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(12),
                      border: const Border(
                        left: BorderSide(color: _pRose, width: 3),
                      ),
                    ),
                    child: Text(
                      f.toString(),
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 12.5,
                        height: 1.45,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  void _openGradingPanel() {
    showGlassBottomSheet(
      context: context,
      builder: (_) => _GradingPanel(
        assignmentId: widget.assignmentId,
        assignmentTitle: widget.assignmentTitle,
        submissions: _subs,
        onSaved: _load,
        gradesReleased: _gradesReleased,
        onReleased: () => setState(() => _gradesReleased = true),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final gradedCount = _subs.where((s) => s.isGraded).length;
    final pendingCount = _subs.length - gradedCount;

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: c.textPrimary,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Submissions',
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              widget.assignmentTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
              ),
            ),
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
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                          child: _buildSummary(
                            total: _subs.length,
                            graded: gradedCount,
                            pending: pendingCount,
                          ),
                        ),
                      ),
                      if (_subs.isEmpty)
                        SliverFillRemaining(
                          hasScrollBody: false,
                          child: _buildEmpty(),
                        )
                      else
                        SliverList.separated(
                          itemCount: _subs.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) => Padding(
                            padding: EdgeInsets.fromLTRB(
                                16, i == 0 ? 0 : 0, 16, 0),
                            child: _buildCard(_subs[i]),
                          ),
                        ),
                      const SliverToBoxAdapter(child: SizedBox(height: 110)),
                    ],
                  ),
                ),
        ),
      ),
      floatingActionButton: _subs.isEmpty
          ? null
          : _GradientFab(
              label: 'Grade All',
              icon: Icons.edit_note_rounded,
              colors: const [_pSlate, _pLavender],
              onPressed: _openGradingPanel,
            ),
    );
  }

  // ─── Summary header ─────────────────────────────────────────────────
  Widget _buildSummary({
    required int total,
    required int graded,
    required int pending,
  }) {
    final c = context.colors;
    final progress = total == 0 ? 0.0 : graded / total;
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Row(
        children: [
          _ProgressRing(
            value: progress,
            label: total == 0 ? '—' : '${(progress * 100).round()}%',
            color: _pSeafoam,
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'GRADING PROGRESS',
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  total == 0
                      ? 'No submissions yet'
                      : '$graded of $total graded',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _MiniStat(
                        label: 'Total',
                        value: total.toString(),
                        color: _pSlate,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniStat(
                        label: 'Graded',
                        value: graded.toString(),
                        color: _pSeafoam,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniStat(
                        label: 'Pending',
                        value: pending.toString(),
                        color: _pSand,
                      ),
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

  // ─── Empty state ────────────────────────────────────────────────────
  Widget _buildEmpty() {
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
                child: const Icon(
                  Icons.people_outline_rounded,
                  size: 30,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'No submissions yet',
                style: TextStyle(
                  color: c.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Student submissions will appear here once they turn them in.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 12.5,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Submission card ────────────────────────────────────────────────
  Widget _buildCard(SubmissionModel s) {
    final c = context.colors;
    final name = s.studentName.isEmpty ? s.studentUid : s.studentName;
    final initial =
        (name.isNotEmpty ? name[0] : '?').toUpperCase();
    final accent =
        s.isGraded ? _pSeafoam : _pSand;

    return GlassCard(
      padding: EdgeInsets.zero,
      onTap: _openGradingPanel,
      child: IntrinsicHeight(
        child: Row(
          children: [
            // Left accent stripe
            Container(
              width: 4,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [accent, _darken(accent, 0.08)],
                ),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                child: Row(
                  children: [
                    _Avatar(letter: initial, accent: accent),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              _PastelBadge(
                                label: s.isGraded ? 'GRADED' : 'PENDING',
                                color: accent,
                              ),
                              if (s.submittedAt != null) ...[
                                const SizedBox(width: 8),
                                Icon(Icons.schedule_rounded,
                                    size: 11, color: c.textMuted),
                                const SizedBox(width: 3),
                                Text(
                                  _shortDate(s.submittedAt!),
                                  style: TextStyle(
                                    color: c.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _GradePill(grade: s.grade),
                        const SizedBox(height: 6),
                        _AiCheckButton(
                          onTap: () => _aiPlagiarismCheck(s),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _shortDate(DateTime d) =>
      '${d.day}/${d.month} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

// ════════════════════════════════════════════════════════════════════════
// Grading panel — glass bottom sheet with inline grade/feedback editors
// ════════════════════════════════════════════════════════════════════════

class _GradingPanel extends StatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  final List<SubmissionModel> submissions;
  final VoidCallback onSaved;
  final bool gradesReleased;
  final VoidCallback onReleased;

  const _GradingPanel({
    required this.assignmentId,
    required this.assignmentTitle,
    required this.submissions,
    required this.onSaved,
    required this.gradesReleased,
    required this.onReleased,
  });

  @override
  State<_GradingPanel> createState() => _GradingPanelState();
}

class _GradingPanelState extends State<_GradingPanel> {
  late List<TextEditingController> _gradeCtrls;
  late List<TextEditingController> _fbCtrls;
  late List<bool> _aiLoading;
  bool _saving = false;
  bool _releasing = false;

  @override
  void initState() {
    super.initState();
    _gradeCtrls = widget.submissions
        .map((s) => TextEditingController(
            text: s.grade?.toStringAsFixed(0) ?? ''))
        .toList();
    _fbCtrls = widget.submissions
        .map((s) => TextEditingController(text: s.feedback))
        .toList();
    _aiLoading = List.filled(widget.submissions.length, false);
  }

  @override
  void dispose() {
    for (final c in _gradeCtrls) {
      c.dispose();
    }
    for (final c in _fbCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _aiGrade(int index, {bool showPreview = true}) async {
    setState(() => _aiLoading[index] = true);
    try {
      final rec =
          await ApiService.aiRecommendGrade(widget.submissions[index].id);
      if (!mounted) return;
      setState(() => _aiLoading[index] = false);

      final grade =
          ((rec['recommended_grade'] ?? rec['grade'] ?? 0) as num).toDouble();
      final feedback = rec['justification']?.toString() ??
          rec['feedback']?.toString() ??
          rec['explanation']?.toString() ??
          '';

      if (showPreview) {
        final apply = await _showRecommendationPreview(
          studentName: widget.submissions[index].studentName,
          rec: rec,
        );
        if (apply != true) return;
      }

      setState(() {
        _gradeCtrls[index].text = grade.toStringAsFixed(0);
        if (feedback.isNotEmpty) _fbCtrls[index].text = feedback;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _aiLoading[index] = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('AI grading failed: $e'),
          backgroundColor: _pRose,
        ),
      );
    }
  }

  Future<void> _aiGradeAll() async {
    for (int i = 0; i < widget.submissions.length; i++) {
      if (_gradeCtrls[i].text.trim().isEmpty) {
        await _aiGrade(i, showPreview: false);
      }
    }
  }

  Future<bool?> _showRecommendationPreview({
    required String studentName,
    required Map<String, dynamic> rec,
  }) {
    final grade =
        ((rec['recommended_grade'] ?? rec['grade'] ?? 0) as num).toDouble();
    final confidence =
        ((rec['confidence'] ?? 0) as num).toDouble().clamp(0.0, 1.0);
    final justification = rec['justification']?.toString() ??
        rec['feedback']?.toString() ??
        rec['explanation']?.toString() ??
        '';
    final rawCriteria = rec['criterion_scores'];
    final criterionEntries = <MapEntry<String, num>>[];
    if (rawCriteria is Map) {
      rawCriteria.forEach((k, v) {
        if (v is num) criterionEntries.add(MapEntry(k.toString(), v));
      });
    }
    final accent = _gradeColor(grade);

    return showGlassBottomSheet<bool>(
      context: context,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.72,
        maxChildSize: 0.92,
        minChildSize: 0.40,
        builder: (_, ctrl) {
          final c = context.colors;
          return Column(
            children: [
              Expanded(
                child: ListView(
                  controller: ctrl,
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                  children: [
                    Row(
                      children: [
                        _GradientGlyph(
                          icon: Icons.auto_awesome_rounded,
                          colors: [_pLavender, _darken(_pLavender)],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'AI Grade Recommendation',
                                style: TextStyle(
                                  color: c.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (studentName.isNotEmpty)
                                Text(
                                  studentName,
                                  style: TextStyle(
                                    color: c.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Container(
                          width: 88, height: 88,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [accent, _darken(accent)],
                            ),
                            borderRadius: BorderRadius.circular(22),
                            boxShadow: [
                              BoxShadow(
                                color: _darken(accent)
                                    .withValues(alpha: 0.30),
                                blurRadius: 14,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                grade.toStringAsFixed(0),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 30,
                                  fontWeight: FontWeight.w900,
                                  height: 1.0,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '/ 100',
                                style: TextStyle(
                                  color: Colors.white
                                      .withValues(alpha: 0.92),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'CONFIDENCE',
                                    style: TextStyle(
                                      color: c.textMuted,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '${(confidence * 100).round()}%',
                                    style: TextStyle(
                                      color: c.textPrimary,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: LinearProgressIndicator(
                                  value: confidence,
                                  minHeight: 7,
                                  backgroundColor: c.surfaceInput,
                                  valueColor: AlwaysStoppedAnimation(
                                      _darken(_pLavender, 0.08)),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                confidence >= 0.75
                                    ? 'High confidence — strong signal.'
                                    : confidence >= 0.5
                                        ? 'Moderate — worth reviewing.'
                                        : 'Low — please verify manually.',
                                style: TextStyle(
                                  color: c.textMuted,
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (criterionEntries.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text(
                        'CRITERIA BREAKDOWN',
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        decoration: BoxDecoration(
                          color: c.surfaceInput.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          children: criterionEntries
                              .asMap()
                              .entries
                              .map((e) {
                            final i = e.key;
                            final entry = e.value;
                            final score = entry.value.toDouble();
                            final cc = _gradeColor(score);
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                border: i == criterionEntries.length - 1
                                    ? null
                                    : Border(
                                        bottom: BorderSide(
                                          color: c.border,
                                          width: 1,
                                        ),
                                      ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      entry.key,
                                      style: TextStyle(
                                        color: c.textPrimary,
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: cc.withValues(alpha: 0.18),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                          color: cc.withValues(alpha: 0.42),
                                          width: 1),
                                    ),
                                    child: Text(
                                      '${score.toStringAsFixed(0)}%',
                                      style: TextStyle(
                                        color: _darken(cc, 0.22),
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                    if (justification.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(
                        'JUSTIFICATION',
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(
                          color: _pLavender.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(12),
                          border: Border(
                            left: BorderSide(
                              color: _darken(_pLavender, 0.08),
                              width: 3,
                            ),
                          ),
                        ),
                        child: Text(
                          justification,
                          style: TextStyle(
                            color: c.textSecondary,
                            fontSize: 12.5,
                            height: 1.55,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              // Bottom action bar
              Container(
                padding: EdgeInsets.fromLTRB(
                    20, 10, 20, MediaQuery.of(context).padding.bottom + 12),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: c.divider)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _PastelOutlineButton(
                        label: 'Cancel',
                        onPressed: () => Navigator.pop(ctx, false),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: _PastelButton(
                        label: 'Apply Recommendation',
                        icon: Icons.check_rounded,
                        colors: [accent, _darken(accent)],
                        onPressed: () => Navigator.pop(ctx, true),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _saveAll() async {
    setState(() => _saving = true);
    try {
      final grades = <Map<String, dynamic>>[];
      for (int i = 0; i < widget.submissions.length; i++) {
        final t = _gradeCtrls[i].text.trim();
        if (t.isEmpty) continue;
        final g = double.tryParse(t);
        if (g == null || g < 0 || g > 100) continue;
        grades.add({
          'submission_id': widget.submissions[i].id,
          'grade': g,
          'feedback': _fbCtrls[i].text.trim(),
        });
      }
      if (grades.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No valid grades to save')),
          );
        }
        setState(() => _saving = false);
        return;
      }
      await ApiService.bulkGradeSubmissions(widget.assignmentId, grades);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${grades.length} grade(s) saved'),
          backgroundColor: _pSeafoam,
        ),
      );
      widget.onSaved();
      setState(() => _saving = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: _pRose),
      );
    }
  }

  Future<void> _releaseGrades() async {
    final c = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: GlassCard(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const _GradientGlyph(
                    icon: Icons.publish_rounded,
                    colors: [_pSlate, _pLavender],
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Release Grades',
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'Students will be notified and can view their grades. '
                'This action cannot be undone.',
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _PastelOutlineButton(
                      label: 'Cancel',
                      onPressed: () => Navigator.pop(ctx, false),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _PastelButton(
                      label: 'Release',
                      icon: Icons.publish_rounded,
                      colors: const [_pSlate, _pLavender],
                      onPressed: () => Navigator.pop(ctx, true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed != true) return;
    setState(() => _releasing = true);
    try {
      await ApiService.releaseGrades(widget.assignmentId);
      if (!mounted) return;
      widget.onReleased();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Grades released'),
          backgroundColor: _pSeafoam,
        ),
      );
      setState(() => _releasing = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _releasing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: _pRose),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final graded =
        _gradeCtrls.where((cc) => cc.text.trim().isNotEmpty).length;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (_, scrollCtrl) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: Row(
              children: [
                const _GradientGlyph(
                  icon: Icons.grading_rounded,
                  colors: [_pSlate, _pLavender],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Grade Submissions',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '$graded / ${widget.submissions.length} graded',
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                _PastelButton(
                  label: 'AI All',
                  icon: Icons.auto_awesome_rounded,
                  colors: [_pLavender, _darken(_pLavender)],
                  compact: true,
                  onPressed: _aiGradeAll,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Divider(color: c.divider, height: 1),
          Expanded(
            child: ListView.separated(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
              itemCount: widget.submissions.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _submissionRow(i),
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
                16, 10, 16, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.divider)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _PastelOutlineButton(
                    label: widget.gradesReleased ? 'Released' : 'Release',
                    icon: widget.gradesReleased
                        ? Icons.check_circle_rounded
                        : Icons.publish_rounded,
                    color: widget.gradesReleased ? _pSeafoam : _pSlate,
                    busy: _releasing,
                    onPressed: _releasing ? null : _releaseGrades,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: _PastelButton(
                    label: _saving ? 'Saving…' : 'Save All Grades',
                    icon: Icons.save_rounded,
                    colors: const [_pSlate, _pLavender],
                    busy: _saving,
                    onPressed: _saving ? null : _saveAll,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Per-student grading row ────────────────────────────────────────
  Widget _submissionRow(int i) {
    final c = context.colors;
    final s = widget.submissions[i];
    final name = s.studentName.isEmpty ? s.studentUid : s.studentName;
    final initial = (name.isNotEmpty ? name[0] : '?').toUpperCase();
    final isGraded = s.isGraded || _gradeCtrls[i].text.trim().isNotEmpty;
    final accent = isGraded ? _pSeafoam : _pSand;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surfaceInput.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Avatar(letter: initial, accent: accent, radius: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (s.submittedAt != null)
                      Text(
                        'Submitted ${_formatDate(s.submittedAt!)}',
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
              SizedBox(
                height: 30,
                child: _aiLoading[i]
                    ? const SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: _pLavender,
                        ),
                      )
                    : _AiButton(onTap: () => _aiGrade(i)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 96,
                child: _GlassNumField(
                  controller: _gradeCtrls[i],
                  label: 'Grade',
                  suffix: '/100',
                  accent: accent,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _GlassFbField(
                  controller: _fbCtrls[i],
                  accent: _pLavender,
                ),
              ),
            ],
          ),
          if (s.submissionType.isNotEmpty ||
              s.externalLink.isNotEmpty ||
              s.comments.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (s.submissionType.isNotEmpty)
                  _InfoChip(
                    icon: Icons.category_rounded,
                    label: s.submissionType,
                  ),
                if (s.comments.isNotEmpty)
                  _InfoChip(
                    icon: Icons.chat_bubble_outline_rounded,
                    label: '"${s.comments}"',
                    maxWidth: 220,
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

// ════════════════════════════════════════════════════════════════════════
// Small reusable widgets (pastel-themed)
// ════════════════════════════════════════════════════════════════════════

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6, height: 6,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  color: c.textMuted,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressRing extends StatelessWidget {
  final double value;
  final String label;
  final Color color;
  const _ProgressRing({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      width: 62, height: 62,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: 62, height: 62,
            child: CircularProgressIndicator(
              value: value.clamp(0.0, 1.0),
              strokeWidth: 6,
              backgroundColor: c.surfaceInput,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String letter;
  final Color accent;
  final double radius;
  const _Avatar({
    required this.letter,
    required this.accent,
    this.radius = 20,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.92),
            _darken(accent, 0.10),
          ],
        ),
        borderRadius: BorderRadius.circular(radius * 0.55),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.28),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: radius * 0.72,
        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
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

class _GradePill extends StatelessWidget {
  final double? grade;
  const _GradePill({required this.grade});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final hasGrade = grade != null;
    final accent = hasGrade ? _gradeColor(grade!) : c.textMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: hasGrade
            ? LinearGradient(colors: [accent, _darken(accent, 0.10)])
            : null,
        color: hasGrade ? null : c.surfaceInput,
        borderRadius: BorderRadius.circular(10),
        border: hasGrade
            ? null
            : Border.all(color: c.border),
        boxShadow: hasGrade
            ? [
                BoxShadow(
                  color: accent.withValues(alpha: 0.32),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Text(
        hasGrade ? '${grade!.toStringAsFixed(0)}/100' : '— / 100',
        style: TextStyle(
          color: hasGrade ? Colors.white : c.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _AiCheckButton extends StatelessWidget {
  final VoidCallback onTap;
  const _AiCheckButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: _pLavender.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _pLavender.withValues(alpha: 0.36)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.plagiarism_rounded,
                color: _pLavender, size: 11),
            SizedBox(width: 3),
            Text(
              'AI Check',
              style: TextStyle(
                color: _pLavender,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AiButton extends StatelessWidget {
  final VoidCallback onTap;
  const _AiButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _pLavender.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _pLavender.withValues(alpha: 0.35)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome_rounded,
                color: _pLavender, size: 13),
            SizedBox(width: 4),
            Text(
              'AI',
              style: TextStyle(
                color: _pLavender,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final double? maxWidth;
  const _InfoChip({
    required this.icon,
    required this.label,
    this.maxWidth,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth ?? double.infinity),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: c.surfaceInput.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: c.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 11, color: c.textMuted),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.textSecondary,
                  fontSize: 10.5,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GradientGlyph extends StatelessWidget {
  final IconData icon;
  final List<Color> colors;
  const _GradientGlyph({required this.icon, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38, height: 38,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
        borderRadius: BorderRadius.circular(11),
        boxShadow: [
          BoxShadow(
            color: colors.first.withValues(alpha: 0.30),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Icon(icon, color: Colors.white, size: 19),
    );
  }
}

class _GlassStatTile extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String label;
  final String value;
  final String subtitle;
  const _GlassStatTile({
    required this.color,
    required this.icon,
    required this.label,
    required this.value,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color, _darken(color, 0.12)]),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
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

class _GlassNumField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String suffix;
  final Color accent;
  const _GlassNumField({
    required this.controller,
    required this.label,
    required this.suffix,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      style: TextStyle(
        color: c.textPrimary,
        fontWeight: FontWeight.w800,
        fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: c.textMuted, fontSize: 12),
        suffixText: suffix,
        suffixStyle: TextStyle(color: c.textMuted, fontSize: 11.5),
        filled: true,
        fillColor: c.surfaceInput.withValues(alpha: 0.55),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: accent, width: 1.5),
        ),
      ),
    );
  }
}

class _GlassFbField extends StatelessWidget {
  final TextEditingController controller;
  final Color accent;
  const _GlassFbField({
    required this.controller,
    required this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return TextField(
      controller: controller,
      maxLines: 2,
      style: TextStyle(color: c.textPrimary, fontSize: 13),
      decoration: InputDecoration(
        labelText: 'Feedback',
        labelStyle: TextStyle(color: c.textMuted, fontSize: 12),
        hintText: 'Optional feedback…',
        hintStyle: TextStyle(color: c.textMuted, fontSize: 12),
        filled: true,
        fillColor: c.surfaceInput.withValues(alpha: 0.55),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: accent, width: 1.5),
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

class _PastelButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final List<Color> colors;
  final VoidCallback? onPressed;
  final bool busy;
  final bool compact;
  const _PastelButton({
    required this.label,
    this.icon,
    required this.colors,
    this.onPressed,
    this.busy = false,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 12 : 16,
            vertical: compact ? 8 : 13,
          ),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: colors),
            borderRadius: BorderRadius.circular(12),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: colors.first.withValues(alpha: 0.34),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy)
                const SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white,
                  ),
                )
              else if (icon != null)
                Icon(icon, color: Colors.white, size: compact ? 14 : 17),
              if (busy || icon != null)
                SizedBox(width: compact ? 5 : 7),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: compact ? 12 : 13.5,
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
  final IconData? icon;
  final VoidCallback? onPressed;
  final Color? color;
  final bool busy;
  const _PastelOutlineButton({
    required this.label,
    this.icon,
    this.onPressed,
    this.color,
    this.busy = false,
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
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: accent.withValues(alpha: 0.40)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy)
                SizedBox(
                  width: 14, height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2, color: accent,
                  ),
                )
              else if (icon != null)
                Icon(icon, color: accent, size: 16),
              if (busy || icon != null) const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: accent,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
