import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';
import 'group_task_detail_screen.dart';

/// Lists group tasks (projects/assignments) for a course. Inside each task
/// the lecturer can create and manage groups, and students can see which
/// group they're in.
class GroupsScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const GroupsScreen({
    super.key,
    required this.courseId,
    required this.courseName,
    this.isLecturer = false,
  });

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  List<Map<String, dynamic>> _tasks = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getGroupTasks(widget.courseId);
      if (!mounted) return;
      setState(() {
        _tasks = raw.map((t) => Map<String, dynamic>.from(t)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _formatDueDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    try {
      final d = DateTime.parse(iso);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return iso;
    }
  }

  bool _isOverdue(String? iso) {
    if (iso == null || iso.isEmpty) return false;
    try {
      final d = DateTime.parse(iso);
      final today = DateTime.now();
      final midnight = DateTime(today.year, today.month, today.day);
      return d.isBefore(midnight);
    } catch (_) {
      return false;
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
            const Text('Group Tasks',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(widget.courseName,
                style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      floatingActionButton: widget.isLecturer
          ? FloatingActionButton.extended(
              heroTag: 'fab_group_tasks',
              backgroundColor: AppColors.purple,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.playlist_add_rounded, size: 20),
              label: const Text('New Task',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              onPressed: _createTask,
            )
          : null,
      body: _loading
          ? const SkeletonList(itemCount: 4)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.purple,
              child: _tasks.isEmpty
                  ? ListView(children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.18),
                      EmptyState(
                        icon: Icons.checklist_rounded,
                        title: widget.isLecturer
                            ? 'No group tasks yet'
                            : 'No group tasks yet',
                        subtitle: widget.isLecturer
                            ? 'Create a task or project to start organising students into groups.'
                            : 'Your lecturer hasn’t created any group tasks for this course.',
                      ),
                    ])
                  : AnimationLimiter(
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(
                            parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                        itemCount: _tasks.length,
                        itemBuilder: (_, i) => AnimatedListItem(
                          index: i,
                          child: _taskCard(_tasks[i]),
                        ),
                      ),
                    ),
            ),
    );
  }

  Widget _taskCard(Map<String, dynamic> task) {
    final c = context.colors;
    final title = task['title']?.toString() ?? 'Task';
    final desc = task['description']?.toString() ?? '';
    final groupCount = (task['group_count'] as num?)?.toInt() ?? 0;
    final memberCount = (task['member_count'] as num?)?.toInt() ?? 0;
    final dueDate = task['due_date']?.toString();
    final formattedDue = _formatDueDate(dueDate);
    final overdue = _isOverdue(dueDate);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () async {
            HapticFeedback.selectionClick();
            final changed = await Navigator.push<bool>(
              context,
              MaterialPageRoute(
                builder: (_) => GroupTaskDetailScreen(
                  courseId: widget.courseId,
                  taskId: task['id']?.toString() ?? '',
                  isLecturer: widget.isLecturer,
                ),
              ),
            );
            if (changed == true) _load();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.purple.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: const Icon(Icons.checklist_rounded,
                          color: AppColors.purple, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    if (widget.isLecturer)
                      GestureDetector(
                        onTap: () async {
                          HapticFeedback.lightImpact();
                          final ok = await showConfirmationDialog(
                            context: context,
                            title: 'Delete Task',
                            message:
                                'Delete "$title"? All groups inside this task will also be removed.',
                            isDanger: true,
                            confirmLabel: 'Delete',
                          );
                          if (ok == true) {
                            try {
                              await ApiService.deleteGroupTask(
                                  widget.courseId,
                                  task['id']?.toString() ?? '');
                              _load();
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        content: Text('Failed: $e'),
                                        backgroundColor: AppColors.red));
                              }
                            }
                          }
                        },
                        child: Icon(Icons.delete_outline_rounded,
                            size: 18, color: c.textMuted),
                      ),
                    const SizedBox(width: 6),
                    Icon(Icons.chevron_right_rounded,
                        color: c.textMuted, size: 20),
                  ],
                ),
                if (desc.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.only(left: 52),
                    child: Text(
                      desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 12.5,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.only(left: 52),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _miniBadge(
                        Icons.groups_2_rounded,
                        '$groupCount group${groupCount == 1 ? '' : 's'}',
                        AppColors.purple,
                      ),
                      _miniBadge(
                        Icons.person_rounded,
                        '$memberCount assigned',
                        AppColors.blue,
                      ),
                      if (formattedDue != null)
                        _miniBadge(
                          Icons.event_rounded,
                          'Due $formattedDue',
                          overdue ? AppColors.red : c.textSecondary,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _miniBadge(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  void _createTask() {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    DateTime? dueDate;
    final c = context.colors;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          backgroundColor: c.surfaceCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text('New Group Task',
              style: TextStyle(
                  color: c.textPrimary, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  autofocus: true,
                  style: TextStyle(color: c.textPrimary),
                  decoration: AppTheme.inputDecoration(context,
                      label: 'Title',
                      prefixIcon: Icons.checklist_rounded),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  style: TextStyle(color: c.textPrimary),
                  maxLines: 2,
                  decoration: AppTheme.inputDecoration(context,
                      label: 'Description (optional)',
                      prefixIcon: Icons.notes_rounded),
                ),
                const SizedBox(height: 12),
                InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: dueDate ?? now.add(const Duration(days: 7)),
                      firstDate: now,
                      lastDate: now.add(const Duration(days: 365 * 3)),
                    );
                    if (picked != null) setSt(() => dueDate = picked);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 14),
                    decoration: BoxDecoration(
                      border: Border.all(color: c.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.event_rounded,
                            color: c.textMuted, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            dueDate == null
                                ? 'Due date (optional)'
                                : '${_formatDueDate(dueDate!.toIso8601String().split('T').first)}',
                            style: TextStyle(
                              color: dueDate == null
                                  ? c.textMuted
                                  : c.textPrimary,
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                        if (dueDate != null)
                          GestureDetector(
                            onTap: () => setSt(() => dueDate = null),
                            child: Icon(Icons.close_rounded,
                                color: c.textMuted, size: 16),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('Cancel',
                    style: TextStyle(color: c.textSecondary))),
            ElevatedButton(
              style: AppTheme.gradientButtonStyle(isLecturer: true),
              onPressed: () async {
                if (titleCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                HapticFeedback.mediumImpact();
                try {
                  await ApiService.createGroupTask(widget.courseId, {
                    'title': titleCtrl.text.trim(),
                    'description': descCtrl.text.trim(),
                    if (dueDate != null)
                      'due_date':
                          dueDate!.toIso8601String().split('T').first,
                  });
                  _load();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text('Failed: $e'),
                        backgroundColor: AppColors.red));
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }
}
