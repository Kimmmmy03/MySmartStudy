import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/assignment_model.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';
import 'assignment_form_screen.dart';
import 'student_submit_screen.dart';
import 'lecturer_submissions_screen.dart';

// Pastel palette (shared with Courses / Resources / Subjects aesthetic)
const _pSlate    = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam  = Color(0xFF7BB5B0);
const _pPeach    = Color(0xFFD8A28E);
const _pSand     = Color(0xFFC9A86A);
const _pRose     = Color(0xFFC99999);
const _pSage     = Color(0xFF8FA68E);

enum _StudentFilter { all, todo, submitted, overdue }
enum _LecturerFilter { all, upcoming, past }

class AssignmentsTab extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const AssignmentsTab({
    super.key,
    required this.courseId,
    required this.courseName,
    required this.isLecturer,
  });
  @override
  State<AssignmentsTab> createState() => _AssignmentsTabState();
}

class _AssignmentsTabState extends State<AssignmentsTab> {
  List<AssignmentModel> _assignments = [];
  Map<String, String> _submissionStatus = {};
  bool _loading = true;

  _StudentFilter _studentFilter = _StudentFilter.all;
  _LecturerFilter _lecturerFilter = _LecturerFilter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getAssignments(widget.courseId);
      final assignments = raw
          .map((a) => AssignmentModel.fromApi(
              Map<String, dynamic>.from(a),
              subjectName: widget.courseName))
          .toList();
      final statuses = <String, String>{};
      if (!widget.isLecturer) {
        for (final a in assignments) {
          try {
            final sub = await ApiService.getMySubmission(a.id);
            statuses[a.id] =
                sub != null ? 'Submitted' : (a.isOverdue ? 'Overdue' : 'To Do');
          } catch (_) {
            statuses[a.id] = a.isOverdue ? 'Overdue' : 'To Do';
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _assignments = assignments;
        _submissionStatus = statuses;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ─── Status helpers ────────────────────────────────────────────────────────

  Color _statusColor(String s) {
    if (s == 'Submitted') return _pSeafoam;
    if (s == 'Overdue') return _pRose;
    return _pSand; // To Do
  }

  IconData _statusIcon(String s) {
    if (s == 'Submitted') return Icons.check_circle_rounded;
    if (s == 'Overdue') return Icons.warning_amber_rounded;
    return Icons.pending_rounded;
  }

  // ─── Counts for summary header ─────────────────────────────────────────────

  int get _submittedCount =>
      _submissionStatus.values.where((v) => v == 'Submitted').length;
  int get _overdueCount =>
      _submissionStatus.values.where((v) => v == 'Overdue').length;
  int get _todoCount =>
      _submissionStatus.values.where((v) => v == 'To Do').length;
  int get _upcomingCount => _assignments.where((a) {
        final d = a.dueAt;
        return d != null && !a.isOverdue;
      }).length;
  int get _pastCount =>
      _assignments.where((a) => a.isOverdue).length;

  // ─── Filtering ─────────────────────────────────────────────────────────────

  List<AssignmentModel> get _filtered {
    if (widget.isLecturer) {
      switch (_lecturerFilter) {
        case _LecturerFilter.all: return _assignments;
        case _LecturerFilter.upcoming:
          return _assignments.where((a) => !a.isOverdue).toList();
        case _LecturerFilter.past:
          return _assignments.where((a) => a.isOverdue).toList();
      }
    } else {
      switch (_studentFilter) {
        case _StudentFilter.all: return _assignments;
        case _StudentFilter.todo:
          return _assignments
              .where((a) => (_submissionStatus[a.id] ?? 'To Do') == 'To Do')
              .toList();
        case _StudentFilter.submitted:
          return _assignments
              .where((a) => _submissionStatus[a.id] == 'Submitted')
              .toList();
        case _StudentFilter.overdue:
          return _assignments
              .where((a) => _submissionStatus[a.id] == 'Overdue')
              .toList();
      }
    }
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c = context.colors;

    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Assignments',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
              Text(
                widget.courseName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 12,
                    color: c.textMuted,
                    fontWeight: FontWeight.w500),
              ),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: IconButton(
                icon: Icon(Icons.refresh_rounded, color: c.textSecondary),
                onPressed: _load,
                tooltip: 'Refresh',
              ),
            ),
          ],
        ),
        floatingActionButton: widget.isLecturer ? _buildFab() : null,
        body: _loading
            ? const SkeletonList(itemCount: 5)
            : RefreshIndicator(
                onRefresh: _load,
                color: _pSlate,
                child: _assignments.isEmpty
                    ? _buildEmpty()
                    : _buildList(),
              ),
      ),
    );
  }

  Widget _buildFab() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_pSlate, _pLavender],
        ),
        boxShadow: [
          BoxShadow(
            color: _pSlate.withValues(alpha: 0.35),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () async {
            HapticFeedback.lightImpact();
            final saved = await showAssignmentFormSheet(
              context: context,
              courseId: widget.courseId,
            );
            if (saved == true) _load();
          },
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.add_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text('New Assignment',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.1)),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.12),
        EmptyState(
          icon: Icons.assignment_rounded,
          title: widget.isLecturer ? 'No assignments yet' : 'Nothing due here yet',
          subtitle: widget.isLecturer
              ? 'Create your first assignment for this course.'
              : 'Assignments will appear here when your lecturer creates them.',
          action: widget.isLecturer
              ? _PastelButton(
                  icon: Icons.add_rounded,
                  label: 'Create First Assignment',
                  onTap: () async {
                    final saved = await showAssignmentFormSheet(
                      context: context,
                      courseId: widget.courseId,
                    );
                    if (saved == true) _load();
                  },
                )
              : null,
        ),
      ],
    );
  }

  Widget _buildList() {
    final list = _filtered;
    return CustomScrollView(
      physics:
          const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          sliver: SliverToBoxAdapter(child: _buildSummaryHeader()),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          sliver: SliverToBoxAdapter(child: _buildFilterRow()),
        ),
        if (list.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 40),
              child: Center(
                child: Text(
                  'Nothing matches this filter',
                  style: TextStyle(color: context.colors.textMuted),
                ),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
            sliver: SliverList.builder(
              itemCount: list.length,
              itemBuilder: (_, i) => AnimationConfiguration.staggeredList(
                position: i,
                duration: const Duration(milliseconds: 380),
                child: SlideAnimation(
                  verticalOffset: 18,
                  child: FadeInAnimation(
                    child: AnimatedListItem(
                      index: i,
                      child: _buildCard(list[i]),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  // ─── Summary header ────────────────────────────────────────────────────────

  Widget _buildSummaryHeader() {
    final c = context.colors;
    final total = _assignments.length;

    if (widget.isLecturer) {
      return GlassCard(
        padding: EdgeInsets.zero,
        child: Stack(children: [
          Positioned(
            right: 0, top: 0,
            child: Container(
              width: 160, height: 110,
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(16)),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    _pSlate.withValues(alpha: 0),
                    _pLavender.withValues(alpha: 0.16),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_pSlate, _pLavender],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _pSlate.withValues(alpha: 0.28),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(Icons.assignment_rounded,
                    color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Assignments',
                        style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2)),
                    const SizedBox(height: 2),
                    Text(
                      '$total total · $_upcomingCount upcoming · $_pastCount past',
                      style: TextStyle(color: c.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ]),
          ),
        ]),
      );
    }

    // Student summary with progress
    final progress = total == 0 ? 0.0 : _submittedCount / total;
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            _ProgressRing(value: progress, color: _pSeafoam),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your Progress',
                      style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2)),
                  const SizedBox(height: 4),
                  Text(
                    '$_submittedCount of $total submitted',
                    style: TextStyle(color: c.textMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            _MiniStat(
              label: 'To Do',
              value: '$_todoCount',
              color: _pSand,
              icon: Icons.pending_rounded,
            ),
            const SizedBox(width: 8),
            _MiniStat(
              label: 'Submitted',
              value: '$_submittedCount',
              color: _pSeafoam,
              icon: Icons.check_circle_rounded,
            ),
            const SizedBox(width: 8),
            _MiniStat(
              label: 'Overdue',
              value: '$_overdueCount',
              color: _pRose,
              icon: Icons.warning_amber_rounded,
            ),
          ]),
        ],
      ),
    );
  }

  // ─── Filter row ────────────────────────────────────────────────────────────

  Widget _buildFilterRow() {
    if (widget.isLecturer) {
      return SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(children: [
          _FilterChip(
            label: 'All',
            count: _assignments.length,
            color: _pSlate,
            active: _lecturerFilter == _LecturerFilter.all,
            onTap: () =>
                setState(() => _lecturerFilter = _LecturerFilter.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Upcoming',
            count: _upcomingCount,
            color: _pSeafoam,
            active: _lecturerFilter == _LecturerFilter.upcoming,
            onTap: () =>
                setState(() => _lecturerFilter = _LecturerFilter.upcoming),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Past',
            count: _pastCount,
            color: _pSage,
            active: _lecturerFilter == _LecturerFilter.past,
            onTap: () =>
                setState(() => _lecturerFilter = _LecturerFilter.past),
          ),
        ]),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(children: [
        _FilterChip(
          label: 'All',
          count: _assignments.length,
          color: _pSlate,
          active: _studentFilter == _StudentFilter.all,
          onTap: () => setState(() => _studentFilter = _StudentFilter.all),
        ),
        const SizedBox(width: 8),
        _FilterChip(
          label: 'To Do',
          count: _todoCount,
          color: _pSand,
          active: _studentFilter == _StudentFilter.todo,
          onTap: () => setState(() => _studentFilter = _StudentFilter.todo),
        ),
        const SizedBox(width: 8),
        _FilterChip(
          label: 'Submitted',
          count: _submittedCount,
          color: _pSeafoam,
          active: _studentFilter == _StudentFilter.submitted,
          onTap: () =>
              setState(() => _studentFilter = _StudentFilter.submitted),
        ),
        const SizedBox(width: 8),
        _FilterChip(
          label: 'Overdue',
          count: _overdueCount,
          color: _pRose,
          active: _studentFilter == _StudentFilter.overdue,
          onTap: () =>
              setState(() => _studentFilter = _StudentFilter.overdue),
        ),
      ]),
    );
  }

  // ─── Assignment card ───────────────────────────────────────────────────────

  Widget _buildCard(AssignmentModel a) {
    final c = context.colors;
    final status = _submissionStatus[a.id] ?? 'To Do';
    final due = a.dueAt;
    final dueText = due != null ? _formatDue(due) : null;
    final countdown = due != null ? _countdown(due) : null;
    final isLate = a.isOverdue;

    // Accent = status for students, slate for lecturers (neutral header);
    // for lecturers with overdue assignments, use sage (past).
    Color accent;
    if (widget.isLecturer) {
      accent = isLate ? _pSage : _pSlate;
    } else {
      accent = _statusColor(status);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        padding: EdgeInsets.zero,
        onTap: () async {
          HapticFeedback.selectionClick();
          if (widget.isLecturer) {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => LecturerSubmissionsScreen(
                  assignmentId: a.id,
                  assignmentTitle: a.title,
                ),
              ),
            );
          } else {
            await Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => StudentSubmitScreen(
                  assignmentId: a.id,
                  assignmentTitle: a.title,
                  courseId: widget.courseId,
                ),
              ),
            );
          }
          _load();
        },
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Accent stripe
              Container(
                width: 4,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.horizontal(
                      left: Radius.circular(16)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [accent, accent.withValues(alpha: 0.60)],
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(11),
                              gradient: LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [accent, accent.withValues(alpha: 0.75)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: accent.withValues(alpha: 0.26),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(Icons.assignment_rounded,
                                color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  a.title,
                                  style: TextStyle(
                                    color: c.textPrimary,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: -0.1,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (a.details.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    a.details,
                                    style: TextStyle(
                                        color: c.textSecondary, fontSize: 13),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (!widget.isLecturer)
                            _PastelBadge(
                              label: status,
                              color: _statusColor(status),
                              icon: _statusIcon(status),
                            ),
                          if (widget.isLecturer)
                            _buildLecturerMenu(a),
                        ],
                      ),
                      if (due != null) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: [
                            _MetaChip(
                              icon: Icons.event_rounded,
                              label: dueText!,
                              color: c.textMuted,
                            ),
                            if (countdown != null)
                              _MetaChip(
                                icon: Icons.schedule_rounded,
                                label: countdown,
                                color: _countdownColor(due),
                                filled: true,
                              ),
                          ],
                        ),
                      ],
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

  Widget _buildLecturerMenu(AssignmentModel a) {
    final c = context.colors;
    return PopupMenuButton<String>(
      iconColor: c.textSecondary,
      iconSize: 20,
      color: c.surfaceCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      onSelected: (v) async {
        if (v == 'view') {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => LecturerSubmissionsScreen(
                assignmentId: a.id,
                assignmentTitle: a.title,
              ),
            ),
          );
          _load();
        } else if (v == 'edit') {
          final saved = await showAssignmentFormSheet(
            context: context,
            courseId: widget.courseId,
            existingAssignment: {
              'id': a.id,
              'title': a.title,
              'description': a.details,
              'deadline': a.dueAt?.toIso8601String(),
            },
          );
          if (saved == true) _load();
        } else if (v == 'delete') {
          final confirm = await showConfirmationDialog(
            context: context,
            title: 'Delete Assignment',
            message: 'Are you sure you want to delete "${a.title}"?',
            isDanger: true,
            confirmLabel: 'Delete',
          );
          if (confirm == true) {
            await ApiService.deleteAssignment(a.id);
            _load();
          }
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem(
            value: 'view',
            child: Row(children: [
              const Icon(Icons.visibility_rounded, color: _pSlate, size: 18),
              const SizedBox(width: 10),
              Text('View Submissions',
                  style: TextStyle(color: c.textPrimary)),
            ])),
        PopupMenuItem(
            value: 'edit',
            child: Row(children: [
              const Icon(Icons.edit_rounded, color: _pSeafoam, size: 18),
              const SizedBox(width: 10),
              Text('Edit', style: TextStyle(color: c.textPrimary)),
            ])),
        const PopupMenuItem(
          value: 'delete',
          child: Row(children: [
            Icon(Icons.delete_outline_rounded,
                color: _pRose, size: 18),
            SizedBox(width: 10),
            Text('Delete',
                style: TextStyle(
                    color: _pRose, fontWeight: FontWeight.w600)),
          ]),
        ),
      ],
    );
  }

  String _formatDue(DateTime d) {
    return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  String? _countdown(DateTime due) {
    final diff = due.difference(DateTime.now());
    if (diff.isNegative) return 'Overdue';
    if (diff.inDays > 0) return '${diff.inDays}d left';
    if (diff.inHours > 0) return '${diff.inHours}h left';
    return '${diff.inMinutes}m left';
  }

  Color _countdownColor(DateTime due) {
    final diff = due.difference(DateTime.now());
    if (diff.isNegative) return _pRose;
    if (diff.inHours < 24) return _pPeach;
    if (diff.inDays < 3) return _pSand;
    return _pSeafoam;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Reusable pastel widgets
// ════════════════════════════════════════════════════════════════════════════

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final bool active;
  final VoidCallback onTap;
  const _FilterChip({
    required this.label,
    required this.count,
    required this.color,
    required this.active,
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
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: active
              ? color.withValues(alpha: 0.16)
              : (context.isDark
                  ? Colors.white.withValues(alpha: 0.04)
                  : Colors.white.withValues(alpha: 0.55)),
          border: Border.all(
            color: active
                ? color.withValues(alpha: 0.40)
                : (context.isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.06)),
            width: active ? 1.4 : 1,
          ),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 7, height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
            ),
          ),
          const SizedBox(width: 8),
          Text(label,
              style: TextStyle(
                  color: active ? color : c.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.1)),
          const SizedBox(width: 6),
          Text('$count',
              style: TextStyle(
                  color: active ? color : c.textMuted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: color.withValues(alpha: 0.10),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, color: color, size: 13),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: color,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(value,
                style: TextStyle(
                    color: c.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3)),
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final bool filled;
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: filled
            ? color.withValues(alpha: 0.14)
            : (context.isDark
                ? Colors.white.withValues(alpha: 0.03)
                : Colors.white.withValues(alpha: 0.55)),
        border: Border.all(
          color: filled
              ? color.withValues(alpha: 0.30)
              : (context.isDark
                  ? Colors.white.withValues(alpha: 0.06)
                  : Colors.black.withValues(alpha: 0.05)),
        ),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 13),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                color: color, fontSize: 11.5, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _PastelBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;
  const _PastelBadge({
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 13),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.1)),
      ]),
    );
  }
}

class _ProgressRing extends StatelessWidget {
  final double value;
  final Color color;
  const _ProgressRing({required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      width: 54, height: 54,
      child: Stack(alignment: Alignment.center, children: [
        SizedBox(
          width: 54, height: 54,
          child: CircularProgressIndicator(
            value: value == 0 ? null : value,
            strokeWidth: 5,
            backgroundColor:
                context.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
        Text('${(value * 100).round()}%',
            style: TextStyle(
                color: c.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2)),
      ]),
    );
  }
}

class _PastelButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _PastelButton(
      {required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [_pSlate, _pLavender],
            ),
            boxShadow: [
              BoxShadow(
                color: _pSlate.withValues(alpha: 0.28),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text(label,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.1)),
          ]),
        ),
      ),
    );
  }
}
