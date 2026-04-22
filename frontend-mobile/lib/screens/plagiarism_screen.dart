import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/skeletons.dart';

// ── Pastel palette (matches Peer Reviews / Courses / Attendance) ────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);
const _pPeach = Color(0xFFD8A28E);

class PlagiarismScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  const PlagiarismScreen({
    super.key,
    required this.courseId,
    required this.courseName,
  });

  @override
  State<PlagiarismScreen> createState() => _PlagiarismScreenState();
}

class _PlagiarismScreenState extends State<PlagiarismScreen> {
  List<Map<String, dynamic>> _assignments = [];
  String? _selectedAssignment;
  bool _loadingAssignments = true;

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    try {
      final raw = await ApiService.getAssignments(widget.courseId);
      if (!mounted) return;
      setState(() {
        _assignments =
            raw.map((a) => Map<String, dynamic>.from(a)).toList();
        _loadingAssignments = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingAssignments = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: _glassAppBar(
        context,
        title: 'Plagiarism',
        subtitle: widget.courseName,
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loadingAssignments
              ? const SkeletonList(itemCount: 3)
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics()),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  children: [
                    _headerCard(c),
                    const SizedBox(height: 14),
                    _assignmentPicker(c),
                    const SizedBox(height: 14),
                    if (_selectedAssignment == null)
                      const Padding(
                        padding: EdgeInsets.only(top: 40),
                        child: EmptyState(
                          icon: Icons.shield_outlined,
                          title: 'Select an assignment',
                          subtitle:
                              'Pick an assignment above to analyse submissions for AI-generated content and similarity across your class.',
                        ),
                      )
                    else
                      _AnalysisPanel(
                        key: ValueKey(_selectedAssignment),
                        assignmentId: _selectedAssignment!,
                        assignmentTitle: _titleFor(_selectedAssignment!),
                      ),
                  ],
                ),
        ),
      ),
    );
  }

  String _titleFor(String aid) {
    final a = _assignments.firstWhere(
      (e) => e['id'] == aid,
      orElse: () => {},
    );
    return a['title']?.toString() ?? '';
  }

  Widget _headerCard(dynamic c) {
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_pSlate, _pLavender],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: _pSlate.withOpacity(0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(Icons.shield_rounded,
                color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI Plagiarism Detection',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Detect AI-generated content and similarity across submissions.',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _assignmentPicker(dynamic c) {
    return GlassCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Assignment',
            style: TextStyle(
              color: c.textMuted,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 8),
          if (_assignments.isEmpty)
            Text(
              'No assignments yet in this course.',
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 13,
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              decoration: BoxDecoration(
                color: c.surfaceInput.withOpacity(0.65),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: c.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedAssignment,
                  isExpanded: true,
                  hint: Text(
                    'Choose an assignment…',
                    style: TextStyle(color: c.textMuted, fontSize: 13.5),
                  ),
                  icon: Icon(Icons.keyboard_arrow_down_rounded,
                      color: c.textMuted),
                  dropdownColor: c.surfaceCard,
                  borderRadius: BorderRadius.circular(12),
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                  items: _assignments.map((a) {
                    return DropdownMenuItem<String>(
                      value: a['id']?.toString(),
                      child: Text(
                        a['title']?.toString() ?? 'Untitled',
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (v) {
                    HapticFeedback.selectionClick();
                    setState(() => _selectedAssignment = v);
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Analysis Panel — tabs + individual + network
// ═══════════════════════════════════════════════════════════════════════════

class _AnalysisPanel extends StatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  const _AnalysisPanel({
    super.key,
    required this.assignmentId,
    required this.assignmentTitle,
  });

  @override
  State<_AnalysisPanel> createState() => _AnalysisPanelState();
}

class _AnalysisPanelState extends State<_AnalysisPanel> {
  int _tab = 0; // 0 = individual, 1 = network

  // Individual
  List<Map<String, dynamic>> _submissions = [];
  final Map<String, Map<String, dynamic>> _reports = {};
  final Set<String> _analyzing = {};
  String? _expanded;
  bool _loadingSubs = true;

  // Network
  Map<String, dynamic>? _networkReport;
  bool _analyzingNetwork = false;
  String? _networkError;

  @override
  void initState() {
    super.initState();
    _loadSubs();
  }

  Future<void> _loadSubs() async {
    try {
      final raw = await ApiService.getSubmissions(widget.assignmentId);
      if (!mounted) return;
      setState(() {
        _submissions =
            raw.map((s) => Map<String, dynamic>.from(s)).toList();
        _loadingSubs = false;
        _reports.clear();
        _expanded = null;
      });
      // Prefetch any existing reports
      for (final s in _submissions) {
        final sid = s['id']?.toString();
        if (sid == null) continue;
        final existing = await ApiService.aiGetPlagiarismReport(sid);
        if (!mounted) return;
        if (existing is Map) {
          setState(() => _reports[sid] = Map<String, dynamic>.from(existing));
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loadingSubs = false);
    }
  }

  Future<void> _analyze(String sid) async {
    setState(() => _analyzing.add(sid));
    try {
      final report = await ApiService.aiAnalyzePlagiarism(sid);
      if (!mounted) return;
      setState(() {
        _reports[sid] = report;
        _expanded = sid;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Analysis failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _analyzing.remove(sid));
    }
  }

  Future<void> _analyzeNetwork() async {
    setState(() {
      _analyzingNetwork = true;
      _networkError = null;
    });
    try {
      final report =
          await ApiService.aiAnalyzeAssignmentPlagiarism(widget.assignmentId);
      if (!mounted) return;
      setState(() => _networkReport = report);
    } catch (e) {
      if (!mounted) return;
      setState(() => _networkError = e.toString());
    } finally {
      if (mounted) setState(() => _analyzingNetwork = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _tabBar(c),
        const SizedBox(height: 14),
        if (_tab == 0) _individualTab(c) else _networkTab(c),
      ],
    );
  }

  Widget _tabBar(dynamic c) {
    Widget pill(int i, String label, IconData icon, Color accent) {
      final active = _tab == i;
      return Expanded(
        child: GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _tab = i);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active
                  ? accent.withOpacity(0.18)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: active
                    ? accent.withOpacity(0.35)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon,
                    size: 15, color: active ? accent : c.textMuted),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: active ? accent : c.textSecondary,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: c.surfaceCard.withOpacity(0.6),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          pill(0, 'Individual', Icons.person_search_rounded, _pSlate),
          const SizedBox(width: 4),
          pill(1, 'Network', Icons.hub_rounded, _pLavender),
        ],
      ),
    );
  }

  // ── Individual tab ───────────────────────────────────────────────────────

  Widget _individualTab(dynamic c) {
    if (_loadingSubs) return const SkeletonList(itemCount: 4);
    if (_submissions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 30),
        child: EmptyState(
          icon: Icons.inbox_rounded,
          title: 'No submissions',
          subtitle:
              'Once students submit, you can analyse each for AI-generated content.',
        ),
      );
    }
    return AnimationLimiter(
      child: Column(
        children: List.generate(_submissions.length, (i) {
          return AnimatedListItem(
            index: i,
            child: _submissionCard(_submissions[i], c),
          );
        }),
      ),
    );
  }

  Widget _submissionCard(Map<String, dynamic> s, dynamic c) {
    final sid = s['id']?.toString() ?? '';
    final name = s['student_name']?.toString() ?? 'Anonymous';
    final submittedAt = s['submitted_at']?.toString() ?? '';
    final grade = s['grade'];
    final report = _reports[sid];
    final isExpanded = _expanded == sid;
    final isAnalyzing = _analyzing.contains(sid);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  AvatarWidget(
                    name: name,
                    imageUrl: s['student_photo_url']?.toString() ?? '',
                    size: 38,
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            if (submittedAt.isNotEmpty)
                              Text(
                                _formatDate(submittedAt),
                                style: TextStyle(
                                  color: c.textMuted,
                                  fontSize: 11,
                                ),
                              ),
                            if (grade is num) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _gradeColor(grade.toDouble())
                                      .withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: _gradeColor(grade.toDouble())
                                        .withOpacity(0.35),
                                  ),
                                ),
                                child: Text(
                                  '${grade.toStringAsFixed(0)}%',
                                  style: TextStyle(
                                    color: _gradeColor(grade.toDouble()),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (report != null)
                    _PlagiarismRing(
                      percentage:
                          ((report['plagiarism_percentage'] ?? 0) as num)
                              .toDouble(),
                      size: 46,
                    )
                  else
                    Container(
                      width: 46,
                      height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: c.surfaceInput.withOpacity(0.5),
                        border: Border.all(color: c.border),
                      ),
                      child: Icon(Icons.help_outline_rounded,
                          size: 18, color: c.textMuted),
                    ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  if (report == null)
                    Expanded(
                      child: _ActionButton(
                        label: isAnalyzing ? 'Analyzing…' : 'Analyze',
                        icon: isAnalyzing
                            ? Icons.hourglass_top_rounded
                            : Icons.shield_rounded,
                        color: _pSlate,
                        filled: true,
                        loading: isAnalyzing,
                        onPressed:
                            isAnalyzing ? null : () => _analyze(sid),
                      ),
                    )
                  else ...[
                    Expanded(
                      child: _ActionButton(
                        label: isExpanded ? 'Hide details' : 'View details',
                        icon: isExpanded
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: _pLavender,
                        onPressed: () => setState(() {
                          _expanded = isExpanded ? null : sid;
                        }),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _ActionButton(
                      label: 'Re-run',
                      icon: Icons.refresh_rounded,
                      color: _pSeafoam,
                      onPressed:
                          isAnalyzing ? null : () => _analyze(sid),
                    ),
                  ],
                ],
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              child: (isExpanded && report != null)
                  ? _ReportDetails(report: report, c: c)
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  // ── Network tab ──────────────────────────────────────────────────────────

  Widget _networkTab(dynamic c) {
    if (_analyzingNetwork) {
      return Padding(
        padding: const EdgeInsets.only(top: 20),
        child: GlassCard(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              SizedBox(
                width: 34,
                height: 34,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  valueColor: AlwaysStoppedAnimation<Color>(_pLavender),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Analyzing cross-submission similarity…',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                'Large classes may take up to a minute.',
                style: TextStyle(
                    color: c.textSecondary, fontSize: 11.5),
              ),
            ],
          ),
        ),
      );
    }

    if (_networkReport == null) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: GlassCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_pLavender, _pSlate],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _pLavender.withOpacity(0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child:
                    const Icon(Icons.hub_rounded, color: Colors.white, size: 26),
              ),
              const SizedBox(height: 12),
              Text(
                'Run Network Analysis',
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                'Builds a similarity graph across all submissions and flags clusters of copied work.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 12,
                    height: 1.35),
              ),
              const SizedBox(height: 14),
              _ActionButton(
                label: 'Run Analysis',
                icon: Icons.play_arrow_rounded,
                color: _pLavender,
                filled: true,
                onPressed: _analyzeNetwork,
              ),
              if (_networkError != null) ...[
                const SizedBox(height: 10),
                Text(
                  _networkError!,
                  style: TextStyle(
                      color: _pRose, fontSize: 11.5),
                ),
              ],
            ],
          ),
        ),
      );
    }

    final report = _networkReport!;
    final total = ((report['total_submissions'] ?? 0) as num).toInt();
    final clusters = List<Map<String, dynamic>>.from(
      (report['flagged_clusters'] ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final graph = Map<String, dynamic>.from(report['network_graph'] ?? {});
    final nodes = List<Map<String, dynamic>>.from(
      (graph['nodes'] ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final edges = List<Map<String, dynamic>>.from(
      (graph['edges'] ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final summary = report['summary']?.toString() ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _statCard(
                label: 'Submissions',
                value: '$total',
                color: _pSlate,
                icon: Icons.inbox_rounded,
                c: c,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _statCard(
                label: 'Clusters',
                value: '${clusters.length}',
                color: clusters.isEmpty ? _pSeafoam : _pPeach,
                icon: Icons.group_work_rounded,
                c: c,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _statCard(
                label: 'Edges',
                value: '${edges.length}',
                color: _pLavender,
                icon: Icons.polyline_rounded,
                c: c,
              ),
            ),
          ],
        ),
        if (summary.isNotEmpty) ...[
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SUMMARY',
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.7,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  summary,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
        if (nodes.length >= 2) ...[
          const SizedBox(height: 12),
          GlassCard(
            padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.hub_rounded, size: 15, color: _pLavender),
                    const SizedBox(width: 6),
                    Text(
                      'Similarity Network',
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                AspectRatio(
                  aspectRatio: 1.05,
                  child: CustomPaint(
                    painter: _NetworkPainter(
                      nodes: nodes,
                      edges: edges,
                      isDark: context.isDark,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                _networkLegend(c),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        if (clusters.isEmpty)
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _pSeafoam.withOpacity(0.18),
                    border: Border.all(color: _pSeafoam.withOpacity(0.35)),
                  ),
                  child: const Icon(Icons.verified_rounded,
                      color: _pSeafoam, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'No suspicious clusters',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'All submissions appear sufficiently unique.',
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 11.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 2, 0, 8),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded,
                          size: 15, color: _pPeach),
                      const SizedBox(width: 6),
                      Text(
                        'Flagged Clusters',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              ...List.generate(clusters.length,
                  (i) => _clusterCard(clusters[i], i, c)),
            ],
          ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: _ActionButton(
            label: 'Re-run analysis',
            icon: Icons.refresh_rounded,
            color: _pSlate,
            onPressed: _analyzeNetwork,
          ),
        ),
      ],
    );
  }

  Widget _clusterCard(Map<String, dynamic> cluster, int i, dynamic c) {
    final maxSim = ((cluster['max_similarity'] ?? 0) as num).toDouble();
    final students = List<Map<String, dynamic>>.from(
      (cluster['students'] ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final analysis = cluster['analysis']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _pRose.withOpacity(0.18),
                    border: Border.all(color: _pRose.withOpacity(0.35)),
                  ),
                  child: Text(
                    '${i + 1}',
                    style: const TextStyle(
                      color: _pRose,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Cluster ${i + 1}',
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _pRose.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: _pRose.withOpacity(0.35)),
                  ),
                  child: Text(
                    'Max ${(maxSim * 100).round()}%',
                    style: const TextStyle(
                      color: _pRose,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: students.map((st) {
                final name = st['name']?.toString() ??
                    st['id']?.toString() ??
                    'student';
                final sim = ((st['similarity_to_cluster'] ?? 0) as num)
                    .toDouble();
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.surfaceInput.withOpacity(0.65),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: c.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${(sim * 100).round()}%',
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
            if (analysis.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: c.surfaceInput.withOpacity(0.45),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.border),
                ),
                child: Text(
                  analysis,
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 11.8,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _networkLegend(dynamic c) {
    Widget swatch(Color col, String label) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 18, height: 2.5, color: col),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(color: c.textMuted, fontSize: 10.5),
          ),
        ],
      );
    }

    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        swatch(_pRose, 'High (>70%)'),
        swatch(_pSand, 'Med (>40%)'),
        swatch(c.textMuted.withOpacity(0.5), 'Low'),
      ],
    );
  }

  Widget _statCard({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
    required dynamic c,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              color: c.textSecondary,
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Report details (individual)
// ═══════════════════════════════════════════════════════════════════════════

class _ReportDetails extends StatelessWidget {
  final Map<String, dynamic> report;
  final dynamic c;
  const _ReportDetails({required this.report, required this.c});

  IconData _sourceIcon(String type) {
    switch (type) {
      case 'ai_generated':
        return Icons.smart_toy_rounded;
      case 'web':
        return Icons.public_rounded;
      case 'book':
        return Icons.menu_book_rounded;
      case 'article':
        return Icons.article_rounded;
      default:
        return Icons.description_rounded;
    }
  }

  String _sourceLabel(String type) {
    switch (type) {
      case 'ai_generated':
        return 'AI Generated';
      case 'web':
        return 'Web Source';
      case 'book':
        return 'Book';
      case 'article':
        return 'Article';
      default:
        return type;
    }
  }

  Color _confColor(double conf) {
    if (conf > 0.7) return _pRose;
    if (conf > 0.4) return _pSand;
    return _pSeafoam;
  }

  @override
  Widget build(BuildContext context) {
    final sources = List<Map<String, dynamic>>.from(
      (report['sources'] ?? []).map((e) => Map<String, dynamic>.from(e)),
    );
    final summary = report['summary']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surfaceInput.withOpacity(0.45),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (sources.isNotEmpty) ...[
            Text(
              'SOURCES DETECTED',
              style: TextStyle(
                color: c.textMuted,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
              ),
            ),
            const SizedBox(height: 8),
            ...sources.map((src) {
              final type = src['type']?.toString() ?? '';
              final conf = ((src['confidence'] ?? 0) as num).toDouble();
              final evidence = src['evidence']?.toString() ?? '';
              final cColor = _confColor(conf);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: c.surfaceCard.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(_sourceIcon(type),
                              size: 14, color: cColor),
                          const SizedBox(width: 6),
                          Text(
                            _sourceLabel(type),
                            style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${(conf * 100).round()}%',
                            style: TextStyle(
                              color: cColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value: conf.clamp(0, 1).toDouble(),
                          minHeight: 4,
                          backgroundColor: c.surfaceInput.withOpacity(0.6),
                          valueColor:
                              AlwaysStoppedAnimation<Color>(cColor),
                        ),
                      ),
                      if (evidence.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          evidence,
                          style: TextStyle(
                            color: c.textSecondary,
                            fontSize: 11.5,
                            fontStyle: FontStyle.italic,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
          if (summary.isNotEmpty) ...[
            if (sources.isNotEmpty) const SizedBox(height: 4),
            Text(
              'SUMMARY',
              style: TextStyle(
                color: c.textMuted,
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              summary,
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 12.2,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Plagiarism ring
// ═══════════════════════════════════════════════════════════════════════════

class _PlagiarismRing extends StatelessWidget {
  final double percentage;
  final double size;
  const _PlagiarismRing({required this.percentage, this.size = 46});

  Color _color(double pct) {
    if (pct > 50) return _pRose;
    if (pct > 20) return _pSand;
    return _pSeafoam;
  }

  @override
  Widget build(BuildContext context) {
    final pct = percentage.clamp(0, 100).toDouble();
    final color = _color(pct);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: pct / 100,
              strokeWidth: 4,
              backgroundColor: Colors.white.withOpacity(0.08),
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          Text(
            '${pct.round()}%',
            style: TextStyle(
              color: color,
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Network graph painter
// ═══════════════════════════════════════════════════════════════════════════

class _NetworkPainter extends CustomPainter {
  final List<Map<String, dynamic>> nodes;
  final List<Map<String, dynamic>> edges;
  final bool isDark;
  _NetworkPainter({
    required this.nodes,
    required this.edges,
    required this.isDark,
  });

  Color _edgeColor(double sim) {
    if (sim > 0.7) return _pRose;
    if (sim > 0.4) return _pSand;
    return (isDark ? Colors.white : Colors.black).withOpacity(0.25);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (nodes.isEmpty) return;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = math.min(size.width, size.height) * 0.38;

    final positions = <String, Offset>{};
    for (var i = 0; i < nodes.length; i++) {
      final n = nodes[i];
      final id = n['id']?.toString() ?? '$i';
      final angle = 2 * math.pi * i / nodes.length - math.pi / 2;
      positions[id] = Offset(cx + r * math.cos(angle), cy + r * math.sin(angle));
    }

    // Edges
    for (final e in edges) {
      final s = positions[e['source']?.toString()];
      final t = positions[e['target']?.toString()];
      if (s == null || t == null) continue;
      final sim = ((e['similarity'] ?? 0) as num).toDouble();
      final paint = Paint()
        ..color = _edgeColor(sim)
        ..strokeWidth = math.max(1.0, sim * 3.2)
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(s, t, paint);
    }

    // Nodes
    for (var i = 0; i < nodes.length; i++) {
      final n = nodes[i];
      final id = n['id']?.toString() ?? '$i';
      final p = positions[id];
      if (p == null) continue;
      final name = n['name']?.toString() ?? '';
      final initials = _initials(name.isNotEmpty ? name : id);

      final nodePaint = Paint()..color = _pLavender.withOpacity(0.22);
      final borderPaint = Paint()
        ..color = _pLavender.withOpacity(0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      canvas.drawCircle(p, 18, nodePaint);
      canvas.drawCircle(p, 18, borderPaint);

      final tp = TextPainter(
        text: TextSpan(
          text: initials,
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF1f2937),
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, p - Offset(tp.width / 2, tp.height / 2));

      // Label below node (first word / short id)
      final lbl = name.isNotEmpty
          ? name.split(' ').first
          : id.substring(0, id.length.clamp(0, 6));
      final lp = TextPainter(
        text: TextSpan(
          text: lbl,
          style: TextStyle(
            color: (isDark ? Colors.white : Colors.black).withOpacity(0.55),
            fontSize: 9,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
        ellipsis: '…',
      )..layout(maxWidth: 60);
      lp.paint(canvas, p + Offset(-lp.width / 2, 20));
    }
  }

  String _initials(String s) {
    final parts = s.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    final letters = parts.map((p) => p.isNotEmpty ? p[0] : '').join();
    return letters.isEmpty ? '?' : letters.substring(0, math.min(2, letters.length)).toUpperCase();
  }

  @override
  bool shouldRepaint(covariant _NetworkPainter old) =>
      old.nodes != nodes || old.edges != edges || old.isDark != isDark;
}

// ═══════════════════════════════════════════════════════════════════════════
// Action button
// ═══════════════════════════════════════════════════════════════════════════

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool filled;
  final bool loading;
  final VoidCallback? onPressed;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onPressed,
    this.filled = false,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final bg = filled
        ? color.withOpacity(disabled ? 0.3 : 1)
        : color.withOpacity(0.12);
    final fg = filled ? Colors.white : color;
    return GestureDetector(
      onTap: disabled
          ? null
          : () {
              HapticFeedback.lightImpact();
              onPressed!();
            },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: filled ? color : color.withOpacity(0.30),
          ),
          boxShadow: filled && !disabled
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (loading)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(fg),
                ),
              )
            else
              Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: fg,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

Color _gradeColor(double g) {
  if (g >= 80) return _pSeafoam;
  if (g >= 50) return _pSand;
  return _pRose;
}

PreferredSizeWidget _glassAppBar(
  BuildContext context, {
  required String title,
  String? subtitle,
}) {
  final c = context.colors;
  return PreferredSize(
    preferredSize: const Size.fromHeight(kToolbarHeight),
    child: ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.bold)),
              if (subtitle != null && subtitle.isNotEmpty)
                Text(subtitle,
                    style: TextStyle(fontSize: 12, color: c.textSecondary),
                    overflow: TextOverflow.ellipsis),
            ],
          ),
          backgroundColor:
              (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
          foregroundColor: c.textPrimary,
          elevation: 0,
          scrolledUnderElevation: 0,
          shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
        ),
      ),
    ),
  );
}

String _formatDate(String raw) {
  try {
    final d = DateTime.parse(raw).toLocal();
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  } catch (_) {
    return raw;
  }
}
