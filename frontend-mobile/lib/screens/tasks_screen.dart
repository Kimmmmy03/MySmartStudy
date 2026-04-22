import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/task_model.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  DateTime _selectedDate = DateTime.now();
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);
  List<TaskModel> _tasks = [];
  bool _loading = true;
  String _filter = 'All';

  final List<String> _filters = ['All', 'Urgent', 'Normal', 'Low', 'Done'];

  @override
  void initState() {
    super.initState();
    _fetchTasks();
  }

  String _dateStr(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _fetchTasks() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService.getReminders(_dateStr(_selectedDate));
      if (!mounted) return;
      setState(() {
        _tasks = raw.map((e) => TaskModel.fromApi(Map<String, dynamic>.from(e))).toList();
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<TaskModel> get _filteredTasks {
    if (_filter == 'All') return _tasks;
    if (_filter == 'Done') return _tasks.where((t) => t.isDone).toList();
    return _tasks.where((t) => t.priority.toLowerCase() == _filter.toLowerCase() && !t.isDone).toList();
  }

  Future<void> _toggleTask(TaskModel task) async {
    HapticFeedback.lightImpact();
    try {
      await ApiService.updateReminder(task.id, {'is_completed': !task.isDone});
      _fetchTasks();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update task: $e'), backgroundColor: AppColors.red),
        );
      }
    }
  }

  Future<void> _deleteTask(TaskModel task) async {
    final confirmed = await showConfirmationDialog(
      context: context,
      title: 'Delete Task',
      message: 'Delete "${task.title}"?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (confirmed == true) {
      try {
        await ApiService.deleteReminder(task.id);
        _fetchTasks();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete: $e'), backgroundColor: AppColors.red),
          );
        }
      }
    }
  }

  void _showAddDialog() {
    final c = context.colors;
    final titleCtrl = TextEditingController();
    String category = 'Study';
    String priority = 'normal';
    final categories = ['Assignment', 'Exam', 'Study', 'Personal'];
    final priorities = ['urgent', 'normal', 'low'];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx2, setDlg) => AlertDialog(
          backgroundColor: c.surfaceCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text('Add Task', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  autofocus: true,
                  style: TextStyle(color: c.textPrimary),
                  decoration: AppTheme.inputDecoration(context, label: 'Title', prefixIcon: Icons.title_rounded),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: category,
                  dropdownColor: c.surfaceElevated,
                  decoration: AppTheme.inputDecoration(context, label: 'Category', prefixIcon: Icons.category_rounded),
                  style: TextStyle(color: c.textPrimary),
                  items: categories.map((ct) => DropdownMenuItem(value: ct, child: Text(ct))).toList(),
                  onChanged: (v) => setDlg(() => category = v ?? category),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: priority,
                  dropdownColor: c.surfaceElevated,
                  decoration: AppTheme.inputDecoration(context, label: 'Priority', prefixIcon: Icons.flag_rounded),
                  style: TextStyle(color: c.textPrimary),
                  items: priorities
                      .map((p) => DropdownMenuItem(value: p, child: Text(p[0].toUpperCase() + p.substring(1))))
                      .toList(),
                  onChanged: (v) => setDlg(() => priority = v ?? priority),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel', style: TextStyle(color: c.textSecondary)),
            ),
            ElevatedButton(
              style: AppTheme.gradientButtonStyle(),
              onPressed: () async {
                if (titleCtrl.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ApiService.createReminder(
                    date: _dateStr(_selectedDate),
                    title: titleCtrl.text.trim(),
                    type: category,
                    priority: priority,
                  );
                  HapticFeedback.mediumImpact();
                  _fetchTasks();
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to create: $e'), backgroundColor: AppColors.red),
                    );
                  }
                }
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  Color _priorityColor(String p) {
    switch (p.toLowerCase()) {
      case 'urgent':
        return AppColors.red;
      case 'low':
        return AppColors.blue.withOpacity(0.6);
      default:
        return AppColors.blue;
    }
  }

  IconData _priorityIcon(String p) {
    switch (p.toLowerCase()) {
      case 'urgent':
        return Icons.priority_high_rounded;
      case 'low':
        return Icons.arrow_downward_rounded;
      default:
        return Icons.remove_rounded;
    }
  }

  Color _categoryColor(String c) {
    switch (c.toLowerCase()) {
      case 'exam':
        return AppColors.red;
      default:
        return AppColors.blue;
    }
  }

  void _prevMonth() => setState(() => _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1));
  void _nextMonth() => setState(() => _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1));

  void _selectDay(int day) {
    HapticFeedback.selectionClick();
    setState(() => _selectedDate = DateTime(_currentMonth.year, _currentMonth.month, day));
    _fetchTasks();
  }

  Widget _buildCalendar() {
    final c = context.colors;
    final year = _currentMonth.year;
    final month = _currentMonth.month;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstWeekday = DateTime(year, month, 1).weekday % 7;
    final monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return GlassCard(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
      child: Column(
        children: [
          // Month navigation with gradient month name
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                InkWell(
                  onTap: _prevMonth,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: c.surfaceElevated,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.chevron_left_rounded, color: c.textPrimary, size: 20),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: Column(
                      children: [
                        Text(
                          monthNames[month],
                          style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          '$year',
                          style: TextStyle(color: c.textMuted, fontSize: 11, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
                InkWell(
                  onTap: _nextMonth,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: c.surfaceElevated,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.chevron_right_rounded, color: c.textPrimary, size: 20),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Day-of-week headers
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                .map((d) => SizedBox(
                      width: 36,
                      child: Center(
                        child: Text(
                          d,
                          style: TextStyle(
                            color: c.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 7,
            childAspectRatio: 1.0,
            children: [
              ...List.generate(firstWeekday, (_) => const SizedBox()),
              ...List.generate(daysInMonth, (i) {
                final day = i + 1;
                final isSelected = _selectedDate.year == year && _selectedDate.month == month && _selectedDate.day == day;
                final isToday = DateTime.now().year == year && DateTime.now().month == month && DateTime.now().day == day;
                return GestureDetector(
                  onTap: () => _selectDay(day),
                  child: Container(
                    margin: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      gradient: isSelected
                          ? const LinearGradient(
                              colors: [AppColors.blue, AppColors.indigo],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: isSelected
                          ? null
                          : isToday
                              ? AppColors.blue.withOpacity(0.15)
                              : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      border: isToday && !isSelected
                          ? Border.all(color: AppColors.blue.withOpacity(0.5), width: 1.5)
                          : null,
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: AppColors.blue.withOpacity(0.35),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Center(
                      child: Text(
                        '$day',
                        style: TextStyle(
                          color: isSelected ? Colors.white : isToday ? AppColors.blue : c.textSecondary,
                          fontSize: 12,
                          fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final filtered = _filteredTasks;
    return Scaffold(
      backgroundColor: c.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 0),
              child: Row(
                children: [
                  Text(
                    'Planner',
                    style: TextStyle(color: c.textPrimary, fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: -0.3),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.add_rounded, color: AppColors.blue, size: 28),
                    onPressed: _showAddDialog,
                  ),
                ],
              ),
            ),

            // Calendar
            _buildCalendar(),

            // Filter chips
            SizedBox(
              height: 42,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _filters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final f = _filters[i];
                  final selected = _filter == f;
                  return ChoiceChip(
                    label: Text(f),
                    selected: selected,
                    onSelected: (_) {
                      HapticFeedback.selectionClick();
                      setState(() => _filter = f);
                    },
                    selectedColor: AppColors.blue.withOpacity(0.2),
                    backgroundColor: c.surfaceElevated,
                    labelStyle: TextStyle(
                      color: selected ? AppColors.blue : c.textSecondary,
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                    ),
                    side: BorderSide(color: selected ? AppColors.blue.withOpacity(0.4) : c.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  );
                },
              ),
            ),

            const SizedBox(height: 8),

            // Tasks list
            Expanded(
              child: _loading
                  ? const SkeletonList(itemCount: 5)
                  : RefreshIndicator(
                      onRefresh: _fetchTasks,
                      color: AppColors.blue,
                      child: filtered.isEmpty
                          ? ListView(children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.08),
                              EmptyState(
                                icon: Icons.task_alt_rounded,
                                title: 'No tasks for ${_dateStr(_selectedDate)}',
                                subtitle: 'Tap + to add a new task',
                              ),
                            ])
                          : AnimationLimiter(
                              child: ListView.builder(
                                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                                padding: EdgeInsets.fromLTRB(20, 0, 20, FloatingNavBar.kTotalHeight + 80),
                                itemCount: filtered.length,
                                itemBuilder: (_, i) => AnimatedListItem(
                                  index: i,
                                  child: _taskCard(filtered[i]),
                                ),
                              ),
                            ),
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: FloatingNavBar.kTotalHeight),
        child: FloatingActionButton.extended(
          heroTag: 'fab_tasks',
          onPressed: _showAddDialog,
          backgroundColor: AppColors.blue,
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_rounded, size: 20),
          label: const Text('Add Task', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }

  Widget _taskCard(TaskModel task) {
    final c = context.colors;
    final priorityColor = _priorityColor(task.priority);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Row(
            children: [
              // Priority accent bar
              Container(
                width: 4,
                height: 72,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [priorityColor, priorityColor.withOpacity(0.5)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Checkbox
              GestureDetector(
                onTap: () => _toggleTask(task),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: task.isDone
                        ? const LinearGradient(
                            colors: [AppColors.emerald, AppColors.emerald],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: task.isDone ? null : Colors.transparent,
                    border: task.isDone
                        ? null
                        : Border.all(color: c.textMuted, width: 2),
                  ),
                  child: task.isDone
                      ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                      : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.title,
                        style: TextStyle(
                          color: task.isDone ? c.textMuted : c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          decoration: task.isDone ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          BadgeChip(
                            label: task.priority[0].toUpperCase() + task.priority.substring(1),
                            color: priorityColor,
                            icon: _priorityIcon(task.priority),
                          ),
                          const SizedBox(width: 6),
                          BadgeChip(
                            label: task.category,
                            color: _categoryColor(task.category),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  _deleteTask(task);
                },
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Icon(Icons.delete_outline_rounded, color: AppColors.red.withOpacity(0.7), size: 20),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
