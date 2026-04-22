import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/skeletons.dart';

// ── Pastel palette (matches Courses / Attendance overhaul) ──────────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);
const _pPeach = Color(0xFFD8A28E);
const _pSky = Color(0xFF8BB5C9);

class PeerReviewsScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  const PeerReviewsScreen({
    super.key,
    required this.courseId,
    required this.courseName,
  });
  @override
  State<PeerReviewsScreen> createState() => _PeerReviewsScreenState();
}

class _PeerReviewsScreenState extends State<PeerReviewsScreen> {
  List<Map<String, dynamic>> _assignments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw =
          await ApiService.getEnabledPeerReviewAssignments(widget.courseId);
      if (!mounted) return;
      setState(() {
        _assignments =
            raw.map((a) => Map<String, dynamic>.from(a)).toList();
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
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: _glassAppBar(
        context,
        title: 'Peer Reviews',
        subtitle: widget.courseName,
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pLavender,
                  child: _assignments.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics()),
                          children: [
                            SizedBox(
                                height:
                                    MediaQuery.of(context).size.height * 0.15),
                            const EmptyState(
                              icon: Icons.rate_review_rounded,
                              title: 'No peer reviews open',
                              subtitle:
                                  'Your lecturer enables peer review per assignment. Check back later.',
                            ),
                          ],
                        )
                      : AnimationLimiter(
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                                parent: BouncingScrollPhysics()),
                            padding:
                                const EdgeInsets.fromLTRB(16, 12, 16, 100),
                            children: [
                              _headerCard(c),
                              const SizedBox(height: 14),
                              ...List.generate(
                                _assignments.length,
                                (i) => AnimatedListItem(
                                  index: i,
                                  child:
                                      _assignmentCard(_assignments[i], c),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
        ),
      ),
    );
  }

  Widget _headerCard(dynamic c) {
    final total = _assignments.length;
    final reviewed = _assignments.fold<int>(
      0,
      (sum, a) => sum + ((a['my_reviewed_count'] ?? 0) as num).toInt(),
    );
    final reviewable = _assignments.fold<int>(
      0,
      (sum, a) => sum + ((a['reviewable_count'] ?? 0) as num).toInt(),
    );
    final pending = (reviewable - reviewed).clamp(0, reviewable);
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Expanded(
            child: _miniStat(
              label: 'Open',
              value: '$total',
              color: _pLavender,
              icon: Icons.rate_review_rounded,
              c: c,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _miniStat(
              label: 'Done',
              value: '$reviewed',
              color: _pSeafoam,
              icon: Icons.check_circle_rounded,
              c: c,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _miniStat(
              label: 'Pending',
              value: '$pending',
              color: pending > 0 ? _pPeach : _pSlate,
              icon: Icons.pending_actions_rounded,
              c: c,
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniStat({
    required String label,
    required String value,
    required Color color,
    required IconData icon,
    required dynamic c,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
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
              fontSize: 16,
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

  Widget _assignmentCard(Map<String, dynamic> a, dynamic c) {
    final title = a['title']?.toString() ?? 'Assignment';
    final desc = a['description']?.toString() ?? '';
    final aid = a['id']?.toString() ?? '';
    final subCount = ((a['submission_count'] ?? 0) as num).toInt();
    final reviewable = ((a['reviewable_count'] ?? 0) as num).toInt();
    final myReviewed = ((a['my_reviewed_count'] ?? 0) as num).toInt();
    final pending = (reviewable - myReviewed).clamp(0, reviewable);
    final deadline = a['deadline']?.toString() ?? '';
    final hasDeadline = deadline.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: EdgeInsets.zero,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => _ReviewableSubmissionsScreen(
                assignmentId: aid,
                assignmentTitle: title,
              ),
            ),
          ).then((_) => _load());
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Gradient header strip
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _pLavender.withOpacity(0.14),
                    _pSlate.withOpacity(0.10),
                  ],
                ),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [_pLavender, _pSlate],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: _pLavender.withOpacity(0.35),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.rate_review_rounded,
                        color: Colors.white, size: 20),
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
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            height: 1.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (hasDeadline) ...[
                          const SizedBox(height: 3),
                          Text(
                            'Due ${_formatDate(deadline)}',
                            style: TextStyle(
                              color: c.textSecondary,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded,
                      color: c.textMuted, size: 22),
                ],
              ),
            ),
            // Body — description + counts + progress
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (desc.isNotEmpty) ...[
                    Text(
                      desc,
                      style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                  ],
                  Row(
                    children: [
                      _chip(
                        icon: Icons.inbox_rounded,
                        label: '$subCount submission${subCount == 1 ? '' : 's'}',
                        color: _pSlate,
                      ),
                      const SizedBox(width: 6),
                      _chip(
                        icon: Icons.groups_rounded,
                        label: '$reviewable to review',
                        color: _pSky,
                      ),
                      const Spacer(),
                      if (reviewable > 0)
                        _progressBadge(
                          done: myReviewed,
                          total: reviewable,
                        ),
                    ],
                  ),
                  if (reviewable > 0) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: reviewable > 0
                            ? myReviewed / reviewable
                            : 0,
                        minHeight: 5,
                        backgroundColor: c.surfaceInput.withOpacity(0.6),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          pending == 0 ? _pSeafoam : _pLavender,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _progressBadge({required int done, required int total}) {
    final complete = done >= total;
    final color = complete ? _pSeafoam : _pPeach;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            complete ? Icons.check_circle_rounded : Icons.schedule_rounded,
            color: color,
            size: 12,
          ),
          const SizedBox(width: 4),
          Text(
            '$done/$total',
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Reviewable Submissions Screen
// ═══════════════════════════════════════════════════════════════════════════

class _ReviewableSubmissionsScreen extends StatefulWidget {
  final String assignmentId;
  final String assignmentTitle;
  const _ReviewableSubmissionsScreen({
    required this.assignmentId,
    required this.assignmentTitle,
  });
  @override
  State<_ReviewableSubmissionsScreen> createState() =>
      _ReviewableSubmissionsScreenState();
}

class _ReviewableSubmissionsScreenState
    extends State<_ReviewableSubmissionsScreen> {
  List<Map<String, dynamic>> _submissions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getPeerReviews(widget.assignmentId);
      if (!mounted) return;
      setState(() {
        _submissions = raw.map((s) => Map<String, dynamic>.from(s)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final pending = _submissions
        .where((s) => s['already_reviewed'] != true)
        .length;

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: _glassAppBar(
        context,
        title: 'Submissions',
        subtitle: widget.assignmentTitle,
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pLavender,
                  child: _submissions.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics()),
                          children: [
                            SizedBox(
                                height: MediaQuery.of(context).size.height *
                                    0.18),
                            const EmptyState(
                              icon: Icons.inbox_rounded,
                              title: 'No submissions yet',
                              subtitle:
                                  'Once classmates submit, their work will appear here for review.',
                            ),
                          ],
                        )
                      : AnimationLimiter(
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                                parent: BouncingScrollPhysics()),
                            padding:
                                const EdgeInsets.fromLTRB(16, 12, 16, 100),
                            children: [
                              _summaryBar(c, pending),
                              const SizedBox(height: 12),
                              ...List.generate(
                                _submissions.length,
                                (i) => AnimatedListItem(
                                  index: i,
                                  child:
                                      _submissionCard(_submissions[i], c),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
        ),
      ),
    );
  }

  Widget _summaryBar(dynamic c, int pending) {
    final done = _submissions.length - pending;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: c.surfaceCard.withOpacity(0.55),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, size: 16, color: _pSlate),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              pending == 0
                  ? 'All caught up — you reviewed $done submission${done == 1 ? '' : 's'}.'
                  : '$pending awaiting your review • $done done',
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _submissionCard(Map<String, dynamic> s, dynamic c) {
    final sid = s['submission_id']?.toString() ?? '';
    final name = s['student_name']?.toString() ?? 'Anonymous';
    final type = s['submission_type']?.toString() ?? '';
    final comments = s['comments']?.toString() ?? '';
    final submittedAt = s['submitted_at']?.toString() ?? '';
    final alreadyReviewed = s['already_reviewed'] == true;
    final reviewCount = ((s['review_count'] ?? 0) as num).toInt();
    final avgRating = s['avg_rating'];

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          _typeBadge(type),
                          const SizedBox(width: 6),
                          if (submittedAt.isNotEmpty)
                            Text(
                              _formatDate(submittedAt),
                              style: TextStyle(
                                color: c.textMuted,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (alreadyReviewed)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _pSeafoam.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _pSeafoam.withOpacity(0.30)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.check_rounded, size: 12, color: _pSeafoam),
                        SizedBox(width: 3),
                        Text(
                          'Reviewed',
                          style: TextStyle(
                            color: _pSeafoam,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            if (comments.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: c.surfaceInput.withOpacity(0.55),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.border),
                ),
                child: Text(
                  '“$comments”',
                  style: TextStyle(
                    color: c.textSecondary,
                    fontSize: 12.5,
                    fontStyle: FontStyle.italic,
                    height: 1.4,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
            const SizedBox(height: 11),
            Row(
              children: [
                if (avgRating != null) ...[
                  Icon(Icons.star_rounded, size: 14, color: _pSand),
                  const SizedBox(width: 3),
                  Text(
                    '${(avgRating as num).toStringAsFixed(1)} / 5',
                    style: TextStyle(
                      color: _pSand,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Icon(Icons.reviews_rounded, size: 13, color: c.textMuted),
                const SizedBox(width: 3),
                Text(
                  '$reviewCount review${reviewCount == 1 ? '' : 's'}',
                  style: TextStyle(
                    color: c.textMuted,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                if (reviewCount > 0)
                  _SmallButton(
                    label: 'View',
                    icon: Icons.visibility_rounded,
                    color: _pSlate,
                    onPressed: () => _openViewReviews(sid, name),
                  ),
                if (!alreadyReviewed) ...[
                  const SizedBox(width: 6),
                  _SmallButton(
                    label: 'Review',
                    icon: Icons.edit_rounded,
                    color: _pLavender,
                    filled: true,
                    onPressed: () => _openReviewSheet(s),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _typeBadge(String type) {
    final label = type == 'map'
        ? 'Mind Map'
        : type == 'link'
            ? 'Link'
            : type == 'file'
                ? 'File'
                : 'Submission';
    final color = type == 'map'
        ? _pLavender
        : type == 'link'
            ? _pSky
            : _pSand;
    final icon = type == 'map'
        ? Icons.account_tree_rounded
        : type == 'link'
            ? Icons.link_rounded
            : Icons.insert_drive_file_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.13),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withOpacity(0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // ── Sheets ────────────────────────────────────────────────────────────
  void _openReviewSheet(Map<String, dynamic> s) {
    HapticFeedback.lightImpact();
    showGlassBottomSheet(
      context: context,
      builder: (ctx) => _SubmitReviewSheet(
        submission: s,
        onSubmitted: () {
          Navigator.pop(ctx);
          _load();
        },
      ),
    );
  }

  void _openViewReviews(String submissionId, String name) {
    HapticFeedback.lightImpact();
    showGlassBottomSheet(
      context: context,
      builder: (ctx) => _ViewReviewsSheet(
        submissionId: submissionId,
        studentName: name,
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Submit Review Sheet
// ═══════════════════════════════════════════════════════════════════════════

class _SubmitReviewSheet extends StatefulWidget {
  final Map<String, dynamic> submission;
  final VoidCallback onSubmitted;
  const _SubmitReviewSheet({
    required this.submission,
    required this.onSubmitted,
  });
  @override
  State<_SubmitReviewSheet> createState() => _SubmitReviewSheetState();
}

class _SubmitReviewSheetState extends State<_SubmitReviewSheet> {
  int _rating = 0;
  final _commentCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating < 1) {
      setState(() => _error = 'Pick a rating (1–5 stars).');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final sid = widget.submission['submission_id']?.toString() ?? '';
      await ApiService.submitPeerReview(sid, {
        'rating': _rating,
        'comment': _commentCtrl.text.trim(),
      });
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      widget.onSubmitted();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Could not submit. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final name =
        widget.submission['student_name']?.toString() ?? 'Anonymous';
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_pLavender, _pSlate],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.edit_rounded,
                    color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Review submission',
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'By $name',
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
          const SizedBox(height: 16),
          Text(
            'RATING',
            style: TextStyle(
              color: c.textMuted,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(5, (i) {
              final n = i + 1;
              final active = n <= _rating;
              return GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _rating = n);
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: active
                        ? _pSand.withOpacity(0.18)
                        : c.surfaceInput.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: active
                          ? _pSand.withOpacity(0.45)
                          : c.border,
                      width: 1.3,
                    ),
                  ),
                  child: Icon(
                    active ? Icons.star_rounded : Icons.star_border_rounded,
                    color: active ? _pSand : c.textMuted,
                    size: 26,
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              _rating == 0
                  ? 'Tap a star'
                  : _ratingLabel(_rating),
              style: TextStyle(
                color: _rating == 0 ? c.textMuted : _pSand,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'COMMENT (OPTIONAL)',
            style: TextStyle(
              color: c.textMuted,
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _commentCtrl,
            maxLines: 4,
            maxLength: 500,
            style: TextStyle(color: c.textPrimary, fontSize: 13.5),
            decoration: InputDecoration(
              hintText: 'Share constructive feedback…',
              hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
              filled: true,
              fillColor: c.surfaceInput.withOpacity(0.55),
              contentPadding: const EdgeInsets.all(12),
              counterStyle: TextStyle(color: c.textMuted, fontSize: 10),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: _pLavender.withOpacity(0.6),
                    width: 1.4),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded,
                    size: 14, color: _pRose),
                const SizedBox(width: 6),
                Text(
                  _error!,
                  style: const TextStyle(
                    color: _pRose,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: _submitting ? null : () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    decoration: BoxDecoration(
                      color: c.textSecondary.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: c.textSecondary.withOpacity(0.30)),
                    ),
                    child: Center(
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: _submitting ? null : _submit,
                  child: Opacity(
                    opacity: _submitting ? 0.6 : 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_pSlate, _pLavender],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: _pSlate.withOpacity(0.36),
                            blurRadius: 12,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (_submitting)
                            const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: Colors.white,
                              ),
                            )
                          else
                            const Icon(Icons.send_rounded,
                                color: Colors.white, size: 16),
                          const SizedBox(width: 7),
                          const Text(
                            'Submit Review',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _ratingLabel(int n) {
    switch (n) {
      case 1:
        return 'Needs work';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Great';
      case 5:
        return 'Outstanding';
      default:
        return '';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// View Reviews Sheet
// ═══════════════════════════════════════════════════════════════════════════

class _ViewReviewsSheet extends StatefulWidget {
  final String submissionId;
  final String studentName;
  const _ViewReviewsSheet({
    required this.submissionId,
    required this.studentName,
  });
  @override
  State<_ViewReviewsSheet> createState() => _ViewReviewsSheetState();
}

class _ViewReviewsSheetState extends State<_ViewReviewsSheet> {
  List<Map<String, dynamic>> _reviews = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw =
          await ApiService.getSubmissionReviews(widget.submissionId);
      if (!mounted) return;
      setState(() {
        _reviews = raw.map((r) => Map<String, dynamic>.from(r)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    double avg = 0;
    if (_reviews.isNotEmpty) {
      avg = _reviews.fold<double>(
              0, (sum, r) => sum + ((r['rating'] ?? 0) as num).toDouble()) /
          _reviews.length;
    }
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [_pSlate, _pSky],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.visibility_rounded,
                      color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Peer reviews',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'For ${widget.studentName}',
                        style: TextStyle(
                          color: c.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_reviews.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _pSand.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _pSand.withOpacity(0.30)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star_rounded,
                            color: _pSand, size: 14),
                        const SizedBox(width: 3),
                        Text(
                          '${avg.toStringAsFixed(1)} · ${_reviews.length}',
                          style: const TextStyle(
                            color: _pSand,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Flexible(
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: _pLavender,
                          strokeWidth: 2.2,
                        ),
                      ),
                    )
                  : _reviews.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 32),
                          child: Column(
                            children: [
                              Icon(
                                Icons.rate_review_outlined,
                                color: c.textMuted,
                                size: 34,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'No reviews yet.',
                                style: TextStyle(
                                  color: c.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          padding: EdgeInsets.zero,
                          itemCount: _reviews.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) => _reviewTile(_reviews[i], c),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reviewTile(Map<String, dynamic> r, dynamic c) {
    final reviewer = r['reviewer_name']?.toString() ?? 'Anonymous';
    final rating = ((r['rating'] ?? 0) as num).toInt();
    final comment = r['comment']?.toString() ?? '';
    final created = r['created_at']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surfaceCard.withOpacity(0.55),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AvatarWidget(
                name: reviewer,
                imageUrl: r['reviewer_photo_url']?.toString() ?? '',
                size: 28,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reviewer,
                      style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (created.isNotEmpty)
                      Text(
                        _formatDate(created),
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < rating ? Icons.star_rounded : Icons.star_border_rounded,
                    size: 14,
                    color: i < rating ? _pSand : c.textMuted,
                  ),
                ),
              ),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 9),
            Text(
              comment,
              style: TextStyle(
                color: c.textSecondary,
                fontSize: 12.5,
                height: 1.45,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

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
                    style:
                        TextStyle(fontSize: 12, color: c.textSecondary),
                    overflow: TextOverflow.ellipsis),
            ],
          ),
          backgroundColor:
              (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
          foregroundColor: c.textPrimary,
          elevation: 0,
          scrolledUnderElevation: 0,
          shape:
              Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
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

class _SmallButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool filled;
  final VoidCallback onPressed;

  const _SmallButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onPressed,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: filled ? color : color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(
            color: filled ? color : color.withOpacity(0.30),
          ),
          boxShadow: filled
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
          children: [
            Icon(icon, size: 12, color: filled ? Colors.white : color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: filled ? Colors.white : color,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
