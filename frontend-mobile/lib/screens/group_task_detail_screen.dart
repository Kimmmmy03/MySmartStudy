import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/skeletons.dart';

/// Detail screen for a single group task. Shows the task header + all its
/// groups, and lets the lecturer manage groups and memberships.
/// Students see a read-only view with their own group highlighted.
class GroupTaskDetailScreen extends StatefulWidget {
  final String courseId;
  final String taskId;
  final bool isLecturer;
  const GroupTaskDetailScreen({
    super.key,
    required this.courseId,
    required this.taskId,
    this.isLecturer = false,
  });

  @override
  State<GroupTaskDetailScreen> createState() => _GroupTaskDetailScreenState();
}

class _GroupTaskDetailScreenState extends State<GroupTaskDetailScreen> {
  Map<String, dynamic>? _task;
  List<Map<String, dynamic>> _groups = [];
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  bool _dirty = false;

  String? get _myId => FirebaseAuth.instance.currentUser?.uid;

  @override
  void initState() {
    super.initState();
    _load(initial: true);
  }

  Future<void> _load({bool initial = false}) async {
    try {
      final results = await Future.wait<dynamic>([
        ApiService.getGroupTask(widget.courseId, widget.taskId),
        if (widget.isLecturer) ApiService.getCourseStudents(widget.courseId),
      ]);
      if (!mounted) return;
      final task = Map<String, dynamic>.from(results[0] as Map);
      final rawGroups =
          (task['groups'] as List?)?.cast<dynamic>() ?? const <dynamic>[];
      setState(() {
        _task = task;
        _groups = rawGroups.map((g) => Map<String, dynamic>.from(g)).toList();
        if (widget.isLecturer && results.length > 1) {
          _students = (results[1] as List)
              .map((s) => Map<String, dynamic>.from(s))
              .toList();
        }
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

  Map<String, dynamic>? get _myGroup {
    final id = _myId;
    if (id == null) return null;
    for (final g in _groups) {
      final members = (g['members'] as List?)?.cast<Map<String, dynamic>>() ??
          const <Map<String, dynamic>>[];
      if (members.any((m) => m['student_id'] == id)) return g;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return WillPopScope(
      onWillPop: () async {
        Navigator.pop(context, _dirty);
        return false;
      },
      child: Scaffold(
        backgroundColor: c.surface,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.pop(context, _dirty),
          ),
          title: Text(
            _task?['title']?.toString() ?? 'Group Task',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            overflow: TextOverflow.ellipsis,
          ),
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
          actions: widget.isLecturer && !_loading
              ? [
                  IconButton(
                    icon: Icon(Icons.auto_awesome_rounded,
                        color: c.textSecondary),
                    tooltip: 'Auto-assign',
                    onPressed: _autoAssign,
                  ),
                ]
              : null,
        ),
        floatingActionButton: widget.isLecturer && !_loading
            ? FloatingActionButton.extended(
                heroTag: 'fab_task_groups',
                backgroundColor: AppColors.purple,
                foregroundColor: Colors.white,
                icon: const Icon(Icons.group_add_rounded, size: 20),
                label: const Text('New Group',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                onPressed: _createGroup,
              )
            : null,
        body: _loading
            ? const SkeletonList(itemCount: 4)
            : RefreshIndicator(
                onRefresh: _load,
                color: AppColors.purple,
                child: _buildBody(),
              ),
      ),
    );
  }

  Widget _buildBody() {
    final c = context.colors;
    final task = _task;
    if (task == null) {
      return ListView(children: const [
        SizedBox(height: 80),
        EmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Task not found',
            subtitle: 'This task may have been deleted.'),
      ]);
    }

    final desc = task['description']?.toString() ?? '';
    final dueDate = _formatDueDate(task['due_date']?.toString());
    final memberCount =
        _groups.fold<int>(0, (sum, g) => sum + ((g['members'] as List?)?.length ?? 0));
    final myGroup = _myGroup;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics()),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.purple.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.checklist_rounded,
                        color: AppColors.purple, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task['title']?.toString() ?? 'Task',
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (dueDate != null) ...[
                          const SizedBox(height: 2),
                          Row(children: [
                            Icon(Icons.event_rounded,
                                size: 13, color: c.textMuted),
                            const SizedBox(width: 4),
                            Text('Due $dueDate',
                                style: TextStyle(
                                    fontSize: 12, color: c.textSecondary)),
                          ]),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (desc.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  desc,
                  style: TextStyle(
                      color: c.textSecondary, fontSize: 13, height: 1.4),
                ),
              ],
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  _miniBadge(Icons.groups_2_rounded,
                      '${_groups.length} group${_groups.length == 1 ? '' : 's'}',
                      AppColors.purple),
                  _miniBadge(Icons.person_rounded, '$memberCount assigned',
                      AppColors.blue),
                  if (!widget.isLecturer && myGroup != null)
                    _miniBadge(Icons.check_circle_rounded,
                        'You: ${myGroup['name'] ?? 'Group'}', AppColors.emerald),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('Groups',
            style: TextStyle(
                color: c.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),
        if (_groups.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: EmptyState(
              icon: Icons.group_rounded,
              title: 'No groups yet',
              subtitle: widget.isLecturer
                  ? 'Create a group or use auto-assign to distribute students.'
                  : 'Your lecturer hasn’t created groups for this task yet.',
            ),
          )
        else
          AnimationLimiter(
            child: Column(
              children: List.generate(_groups.length, (i) {
                return AnimatedListItem(
                  index: i,
                  child: _groupCard(_groups[i]),
                );
              }),
            ),
          ),
      ],
    );
  }

  Widget _groupCard(Map<String, dynamic> g) {
    final c = context.colors;
    final name = g['name']?.toString() ?? 'Group';
    final desc = g['description']?.toString() ?? '';
    final members = (g['members'] as List?)?.cast<Map<String, dynamic>>() ??
        const <Map<String, dynamic>>[];
    final id = _myId;
    final isMine = id != null && members.any((m) => m['student_id'] == id);

    final accent = isMine ? AppColors.emerald : AppColors.purple;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isMine
                        ? Icons.verified_rounded
                        : Icons.group_rounded,
                    color: accent,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600)),
                      if (desc.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(desc,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: c.textSecondary, fontSize: 11.5)),
                      ],
                    ],
                  ),
                ),
                Text('${members.length} member${members.length == 1 ? '' : 's'}',
                    style: TextStyle(color: c.textMuted, fontSize: 11)),
                if (widget.isLecturer) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => _openGroupActions(g),
                    child: Icon(Icons.more_horiz_rounded,
                        color: c.textSecondary, size: 20),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 10),
            if (members.isEmpty)
              Text('No members yet',
                  style: TextStyle(
                      color: c.textMuted,
                      fontSize: 12,
                      fontStyle: FontStyle.italic))
            else
              Column(
                children: members.map((m) {
                  final mid = m['student_id']?.toString() ?? '';
                  final nameStr = m['student_name']?.toString() ??
                      m['student_email']?.toString() ??
                      '?';
                  final photo = m['student_photo']?.toString();
                  final isMe = mid == id;
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                      children: [
                        AvatarWidget(
                          imageUrl: photo,
                          name: nameStr,
                          size: 28,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            isMe ? '$nameStr (you)' : nameStr,
                            style: TextStyle(
                                color: c.textPrimary,
                                fontSize: 13,
                                fontWeight:
                                    isMe ? FontWeight.w600 : FontWeight.w400),
                          ),
                        ),
                        if (widget.isLecturer)
                          GestureDetector(
                            onTap: () => _removeMember(g, mid),
                            child: Icon(Icons.close_rounded,
                                size: 16, color: c.textMuted),
                          ),
                      ],
                    ),
                  );
                }).toList(),
              ),
          ],
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

  void _openGroupActions(Map<String, dynamic> g) {
    final c = context.colors;
    showGlassBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading:
                    const Icon(Icons.person_add_rounded, color: AppColors.blue),
                title: Text('Add Members',
                    style: TextStyle(
                        color: c.textPrimary, fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(ctx);
                  _addMembers(g);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.delete_outline_rounded, color: AppColors.red),
                title: const Text('Delete Group',
                    style: TextStyle(
                        color: AppColors.red, fontWeight: FontWeight.w600)),
                onTap: () async {
                  Navigator.pop(ctx);
                  final ok = await showConfirmationDialog(
                    context: context,
                    title: 'Delete Group',
                    message:
                        'Delete "${g['name'] ?? 'Group'}"? Members will be unassigned.',
                    isDanger: true,
                    confirmLabel: 'Delete',
                  );
                  if (ok == true) {
                    try {
                      await ApiService.deleteGroupInTask(
                        widget.courseId,
                        widget.taskId,
                        g['id']?.toString() ?? '',
                      );
                      _dirty = true;
                      _load();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text('Failed: $e'),
                            backgroundColor: AppColors.red));
                      }
                    }
                  }
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _removeMember(Map<String, dynamic> g, String studentId) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Remove Member',
      message: 'Remove this student from the group?',
      isDanger: true,
      confirmLabel: 'Remove',
    );
    if (ok != true) return;
    try {
      await ApiService.removeGroupTaskMember(
        widget.courseId,
        widget.taskId,
        g['id']?.toString() ?? '',
        studentId,
      );
      _dirty = true;
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed: $e'), backgroundColor: AppColors.red));
      }
    }
  }

  void _createGroup() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final c = context.colors;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.surfaceCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('New Group',
            style: TextStyle(
                color: c.textPrimary, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              style: TextStyle(color: c.textPrimary),
              decoration: AppTheme.inputDecoration(context,
                  label: 'Group Name', prefixIcon: Icons.group_rounded),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: descCtrl,
              style: TextStyle(color: c.textPrimary),
              decoration: AppTheme.inputDecoration(context,
                  label: 'Description (optional)',
                  prefixIcon: Icons.notes_rounded),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel',
                  style: TextStyle(color: c.textSecondary))),
          ElevatedButton(
            style: AppTheme.gradientButtonStyle(isLecturer: true),
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              HapticFeedback.mediumImpact();
              try {
                await ApiService.createGroupInTask(
                  widget.courseId,
                  widget.taskId,
                  {
                    'name': nameCtrl.text.trim(),
                    'description': descCtrl.text.trim(),
                  },
                );
                _dirty = true;
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
    );
  }

  void _addMembers(Map<String, dynamic> g) {
    final existingIds = ((g['members'] as List?) ?? const [])
        .map((m) => (m as Map)['student_id']?.toString() ?? '')
        .where((s) => s.isNotEmpty)
        .toSet();
    final selected = <String>{};
    final c = context.colors;

    // Flatten all assigned IDs across the task so we can flag "will be moved"
    final assignedIds = <String>{
      for (final grp in _groups)
        for (final m in (grp['members'] as List? ?? const []))
          (m as Map)['student_id']?.toString() ?? '',
    }..removeWhere((s) => s.isEmpty);

    showGlassBottomSheet(
      context: context,
      maxHeight: MediaQuery.of(context).size.height * 0.8,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Add to ${g['name'] ?? 'Group'}',
                      style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Each student can only be in one group per task — picking someone already in another group will move them here.',
                    style: TextStyle(color: c.textMuted, fontSize: 11),
                  ),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: _students.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('No enrolled students.'),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          itemCount: _students.length,
                          itemBuilder: (_, i) {
                            final s = _students[i];
                            final sid = s['id']?.toString() ?? '';
                            if (existingIds.contains(sid)) {
                              return const SizedBox.shrink();
                            }
                            final nameStr = s['display_name']?.toString() ??
                                s['email']?.toString() ??
                                '?';
                            final photo = s['photo_url']?.toString();
                            final willMove = assignedIds.contains(sid);
                            final isSel = selected.contains(sid);
                            return InkWell(
                              borderRadius: BorderRadius.circular(10),
                              onTap: () {
                                setSt(() {
                                  if (isSel) {
                                    selected.remove(sid);
                                  } else {
                                    selected.add(sid);
                                  }
                                });
                              },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: 6, horizontal: 4),
                                child: Row(
                                  children: [
                                    Checkbox(
                                      value: isSel,
                                      activeColor: AppColors.purple,
                                      onChanged: (v) => setSt(() {
                                        if (v == true) {
                                          selected.add(sid);
                                        } else {
                                          selected.remove(sid);
                                        }
                                      }),
                                    ),
                                    AvatarWidget(
                                        imageUrl: photo,
                                        name: nameStr,
                                        size: 32),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(nameStr,
                                              style: TextStyle(
                                                  color: c.textPrimary,
                                                  fontSize: 13.5,
                                                  fontWeight:
                                                      FontWeight.w500)),
                                          if (willMove)
                                            Text('will be moved here',
                                                style: TextStyle(
                                                    color: AppColors.amber,
                                                    fontSize: 11)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: Text('Cancel',
                            style: TextStyle(color: c.textSecondary)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        style: AppTheme.gradientButtonStyle(isLecturer: true),
                        onPressed: selected.isEmpty
                            ? null
                            : () async {
                                Navigator.pop(ctx);
                                HapticFeedback.mediumImpact();
                                try {
                                  await ApiService.addGroupTaskMembers(
                                    widget.courseId,
                                    widget.taskId,
                                    g['id']?.toString() ?? '',
                                    selected.toList(),
                                  );
                                  _dirty = true;
                                  _load();
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                            content: Text('Failed: $e'),
                                            backgroundColor: AppColors.red));
                                  }
                                }
                              },
                        child: Text(
                            'Add ${selected.length} student${selected.length == 1 ? '' : 's'}'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _autoAssign() {
    final countCtrl = TextEditingController(text: '4');
    final c = context.colors;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: c.surfaceCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Auto-assign Groups',
            style:
                TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Randomly distribute all enrolled students into groups for this task. This replaces any existing groups within this task only.',
              style: TextStyle(color: c.textSecondary, fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: countCtrl,
              keyboardType: TextInputType.number,
              style: TextStyle(color: c.textPrimary),
              decoration: AppTheme.inputDecoration(context,
                  label: 'Number of Groups',
                  prefixIcon: Icons.groups_rounded),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel',
                  style: TextStyle(color: c.textSecondary))),
          ElevatedButton(
            style: AppTheme.gradientButtonStyle(isLecturer: true),
            onPressed: () async {
              final n = int.tryParse(countCtrl.text.trim()) ?? 4;
              Navigator.pop(ctx);
              HapticFeedback.mediumImpact();
              try {
                await ApiService.autoAssignGroupTask(
                  widget.courseId,
                  widget.taskId,
                  n,
                );
                _dirty = true;
                _load();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Failed: $e'),
                      backgroundColor: AppColors.red));
                }
              }
            },
            child: const Text('Auto-assign'),
          ),
        ],
      ),
    );
  }
}
