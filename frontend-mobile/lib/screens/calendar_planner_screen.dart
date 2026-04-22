import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../models/task_model.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../l10n/app_strings.dart';
import '../widgets/floating_nav_bar.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';

/// Unified Schedule screen — weekly strip + expandable full-month calendar,
/// filter pills, and a merged list of calendar events + reminder tasks for
/// the selected day.
///
/// Data sources
/// ─────────────
/// • getCalendarEvents(month) → assignments, quizzes, classes, study_time,
///   attendance, and calendar-reminders.  Fetched once per month; cached in
///   [_allMonthEvents].  Filtering to the selected day is done in-memory so
///   switching days doesn't trigger extra network calls.
///
/// • getReminders(date) → user-created reminder/task items with interactive
///   controls (checkbox + delete).  Re-fetched on every day change.
///
/// Display
/// ────────
/// Calendar events (read-only) are shown first, then reminder tasks
/// (interactive, with filter pills).  The filter pills apply only to the
/// reminder section.
class CalendarPlannerScreen extends StatefulWidget {
  const CalendarPlannerScreen({super.key});
  @override
  State<CalendarPlannerScreen> createState() => _CalendarPlannerScreenState();
}

class _CalendarPlannerScreenState extends State<CalendarPlannerScreen> {
  // ── State ──────────────────────────────────────────────────────────────────
  DateTime _selectedDate = DateTime.now();
  DateTime _focusMonth =
      DateTime(DateTime.now().year, DateTime.now().month);
  bool _calendarExpanded = false;

  /// Full month's worth of calendar events (assignments, classes, study time …)
  /// cached so we can filter by day without extra API calls.
  List<Map<String, dynamic>> _allMonthEvents = [];

  /// User-created reminder tasks for [_selectedDate] (interactive).
  List<TaskModel> _tasks = [];

  bool _loading     = true;
  bool _listLoading = false;

  String _filter = 'All';
  final List<String> _filters = ['All', 'Urgent', 'Normal', 'Low', 'Done'];

  static const _monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _fetchAll(initial: true);
  }

  // ── Date helpers ───────────────────────────────────────────────────────────

  String _dateStr(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';

  String _monthStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}';

  /// Sunday-aligned first day of the week containing [_selectedDate].
  DateTime get _weekStart {
    final dow = _selectedDate.weekday % 7; // 0 = Sun
    return DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day)
        .subtract(Duration(days: dow));
  }

  List<DateTime> get _weekDays =>
      List.generate(7, (i) => _weekStart.add(Duration(days: i)));

  // ── Computed lists ─────────────────────────────────────────────────────────

  /// Calendar events (not plain reminders) for the selected day, derived
  /// from the cached month data — no extra network call needed.
  List<Map<String, dynamic>> get _dayCalendarItems {
    final prefix = _dateStr(_selectedDate);
    return _allMonthEvents.where((e) {
      final d    = (e['date'] ?? '').toString();
      final type = (e['type'] ?? '').toString();
      // Exclude bare 'reminder' type — those come from getReminders instead
      return d.startsWith(prefix) && type != 'reminder';
    }).toList();
  }

  /// Dot dates for the calendar grid — any day that has an event or a task.
  Set<String> get _dotDates {
    final dates = <String>{};
    for (final e in _allMonthEvents) {
      final d = (e['date'] ?? '').toString();
      if (d.length >= 10) dates.add(d.substring(0, 10));
    }
    return dates;
  }

  List<TaskModel> get _filteredTasks {
    if (_filter == 'All')  return _tasks;
    if (_filter == 'Done') return _tasks.where((t) => t.isDone).toList();
    return _tasks.where((t) =>
        t.priority.toLowerCase() == _filter.toLowerCase() && !t.isDone).toList();
  }

  // ── API calls ──────────────────────────────────────────────────────────────

  /// Fetches BOTH endpoints simultaneously but independently.
  /// A failure in one does NOT prevent the other from populating.
  /// Call on initial load and whenever [_focusMonth] changes.
  Future<void> _fetchAll({bool initial = false}) async {
    if (!mounted) return;
    setState(() => initial ? _loading = true : _listLoading = true);

    List<dynamic> reminders = [];
    List<dynamic> allEvents = [];

    await Future.wait([
      Future(() async {
        try { reminders = await ApiService.getReminders(_dateStr(_selectedDate)); } catch (_) {}
      }),
      Future(() async {
        try { allEvents = await ApiService.getCalendarEvents(_monthStr(_focusMonth)); } catch (_) {}
      }),
    ]);

    if (!mounted) return;
    setState(() {
      _tasks = reminders
          .map((e) => TaskModel.fromApi(Map<String, dynamic>.from(e)))
          .toList();
      _allMonthEvents = allEvents
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      _loading     = false;
      _listLoading = false;
    });
  }

  /// Light refresh — only reloads reminders for the selected day.
  /// Call when switching days within the same month.
  Future<void> _fetchReminders({bool lighter = false}) async {
    if (!mounted) return;
    if (lighter) setState(() => _listLoading = true);
    try {
      final raw = await ApiService.getReminders(_dateStr(_selectedDate));
      if (!mounted) return;
      setState(() {
        _tasks = raw
            .map((e) => TaskModel.fromApi(Map<String, dynamic>.from(e)))
            .toList();
        _listLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _listLoading = false);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  Future<void> _toggleTask(TaskModel task) async {
    HapticFeedback.lightImpact();
    try {
      await ApiService.updateReminder(task.id, {'is_completed': !task.isDone});
      _fetchReminders(lighter: false);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to update: $e'),
          backgroundColor: AppColors.red,
        ));
      }
    }
  }

  Future<void> _deleteTask(TaskModel task) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Task',
      message: 'Delete "${task.title}"?',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      try {
        await ApiService.deleteReminder(task.id);
        _fetchReminders(lighter: false);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Failed to delete: $e'),
            backgroundColor: AppColors.red,
          ));
        }
      }
    }
  }

  void _showAddDialog() {
    final c = context.colors;
    final titleCtrl = TextEditingController();
    String category = 'Study';
    String priority = 'normal';
    const categories = ['Assignment', 'Exam', 'Study', 'Personal'];
    const priorities = ['urgent', 'normal', 'low'];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (_, setDlg) => AlertDialog(
          backgroundColor: c.surfaceCard,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text('Add Task',
              style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                controller: titleCtrl,
                autofocus: true,
                style: TextStyle(color: c.textPrimary),
                decoration: AppTheme.inputDecoration(context,
                    label: 'Title', prefixIcon: Icons.title_rounded),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: category,
                dropdownColor: c.surfaceElevated,
                decoration: AppTheme.inputDecoration(context,
                    label: 'Category', prefixIcon: Icons.category_rounded),
                style: TextStyle(color: c.textPrimary),
                items: categories
                    .map((ct) => DropdownMenuItem(value: ct, child: Text(ct)))
                    .toList(),
                onChanged: (v) => setDlg(() => category = v ?? category),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: priority,
                dropdownColor: c.surfaceElevated,
                decoration: AppTheme.inputDecoration(context,
                    label: 'Priority', prefixIcon: Icons.flag_rounded),
                style: TextStyle(color: c.textPrimary),
                items: priorities
                    .map((p) => DropdownMenuItem(
                        value: p,
                        child: Text(p[0].toUpperCase() + p.substring(1))))
                    .toList(),
                onChanged: (v) => setDlg(() => priority = v ?? priority),
              ),
            ]),
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
                    date:     _dateStr(_selectedDate),
                    title:    titleCtrl.text.trim(),
                    type:     category,
                    priority: priority,
                  );
                  HapticFeedback.mediumImpact();
                  _fetchReminders(lighter: false);
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Failed to create: $e'),
                      backgroundColor: AppColors.red,
                    ));
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

  // ── Color / icon helpers ───────────────────────────────────────────────────

  Color _priorityColor(String p) {
    switch (p.toLowerCase()) {
      case 'urgent': return AppColors.red;
      case 'low':    return AppColors.emerald;
      default:       return AppColors.blue;
    }
  }

  IconData _priorityIcon(String p) {
    switch (p.toLowerCase()) {
      case 'urgent': return Icons.priority_high_rounded;
      case 'low':    return Icons.arrow_downward_rounded;
      default:       return Icons.remove_rounded;
    }
  }

  Color _categoryColor(String cat) {
    switch (cat.toLowerCase()) {
      case 'exam':       return AppColors.red;
      default:           return AppColors.blue;
    }
  }

  Color _eventColor(String type) {
    switch (type) {
      case 'exam':        return AppColors.red;
      case 'quiz':        return AppColors.purple;
      default:            return AppColors.blue;
    }
  }

  IconData _eventIcon(String type) {
    switch (type) {
      case 'assignment':  return Icons.assignment_rounded;
      case 'quiz':        return Icons.quiz_rounded;
      case 'class':       return Icons.school_rounded;
      case 'study_time':  return Icons.psychology_rounded;
      case 'attendance':  return Icons.fact_check_rounded;
      default:            return Icons.event_rounded;
    }
  }

  String _eventLabel(String type) =>
      type == 'study_time' ? 'study time' : type;

  // ── Calendar navigation ────────────────────────────────────────────────────

  void _selectDay(DateTime d) {
    HapticFeedback.selectionClick();
    final newMonth = DateTime(d.year, d.month);
    final sameMonth = newMonth.year == _focusMonth.year &&
        newMonth.month == _focusMonth.month;
    setState(() {
      _selectedDate = d;
      _focusMonth   = newMonth;
    });
    if (sameMonth) {
      // Just re-fetch reminders; calendar events already cached
      _fetchReminders(lighter: true);
    } else {
      // Month changed → need fresh calendar events too
      _fetchAll();
    }
  }

  void _prevPeriod() {
    HapticFeedback.selectionClick();
    if (_calendarExpanded) {
      final newMonth = DateTime(_focusMonth.year, _focusMonth.month - 1);
      setState(() => _focusMonth = newMonth);
      // Re-fetch everything for the new month
      _fetchAll();
    } else {
      final newDate = _selectedDate.subtract(const Duration(days: 7));
      final newMonth = DateTime(newDate.year, newDate.month);
      final sameMonth = newMonth.year == _focusMonth.year &&
          newMonth.month == _focusMonth.month;
      setState(() {
        _selectedDate = newDate;
        _focusMonth   = newMonth;
      });
      if (sameMonth) {
        _fetchReminders(lighter: true);
      } else {
        _fetchAll();
      }
    }
  }

  void _nextPeriod() {
    HapticFeedback.selectionClick();
    if (_calendarExpanded) {
      final newMonth = DateTime(_focusMonth.year, _focusMonth.month + 1);
      setState(() => _focusMonth = newMonth);
      _fetchAll();
    } else {
      final newDate = _selectedDate.add(const Duration(days: 7));
      final newMonth = DateTime(newDate.year, newDate.month);
      final sameMonth = newMonth.year == _focusMonth.year &&
          newMonth.month == _focusMonth.month;
      setState(() {
        _selectedDate = newDate;
        _focusMonth   = newMonth;
      });
      if (sameMonth) {
        _fetchReminders(lighter: true);
      } else {
        _fetchAll();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Build
  // ══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(c),
            _buildCalendarCard(c),
            const SizedBox(height: 4),
            _buildFilterRow(c),
            const SizedBox(height: 4),
            Expanded(child: _buildCombinedList(c)),
          ],
        ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  Widget _buildHeader(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 4),
      child: Row(
        children: [
          Text(
            S.of(context).navSchedule,
            style: TextStyle(
              color:        c.textPrimary,
              fontSize:     24,
              fontWeight:   FontWeight.bold,
              letterSpacing: -0.3,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: _showAddDialog,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.blue, AppColors.blue],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color:      AppColors.blue.withOpacity(0.35),
                    blurRadius: 10,
                    offset:     const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.add_rounded, color: Colors.white, size: 22),
            ),
          ),
        ],
      ),
    );
  }

  // ── Calendar card ──────────────────────────────────────────────────────────

  Widget _buildCalendarCard(AppColorScheme c) {
    return GlassCard(
      margin:  const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      child: Column(children: [
        Row(children: [
          _navBtn(Icons.chevron_left_rounded,  _prevPeriod, c),
          Expanded(
            child: Center(
              child: Column(children: [
                Text(
                  _monthNames[_focusMonth.month],
                  style: TextStyle(
                    color:        c.textPrimary,
                    fontSize:     16,
                    fontWeight:   FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
                Text('${_focusMonth.year}',
                    style: TextStyle(
                        color:      c.textSecondary,
                        fontSize:   11,
                        fontWeight: FontWeight.w500)),
              ]),
            ),
          ),
          _navBtn(Icons.chevron_right_rounded, _nextPeriod, c),
        ]),

        const SizedBox(height: 10),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              .map((d) => SizedBox(
                    width: 36,
                    child: Center(
                      child: Text(d,
                          style: TextStyle(
                            color:        c.textMuted,
                            fontSize:     10,
                            fontWeight:   FontWeight.w700,
                            letterSpacing: 0.3,
                          )),
                    ),
                  ))
              .toList(),
        ),

        const SizedBox(height: 6),

        AnimatedSize(
          duration:  const Duration(milliseconds: 280),
          curve:     Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          child: _calendarExpanded ? _buildMonthGrid(c) : _buildWeekStrip(c),
        ),

        GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _calendarExpanded = !_calendarExpanded);
          },
          child: Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedRotation(
                  turns:    _calendarExpanded ? 0.5 : 0.0,
                  duration: const Duration(milliseconds: 240),
                  child:    Icon(Icons.keyboard_arrow_down_rounded,
                      color: c.textSecondary, size: 20),
                ),
                const SizedBox(width: 4),
                Text(
                  _calendarExpanded ? 'Show less' : 'Show full month',
                  style: TextStyle(
                      color:      c.textSecondary,
                      fontSize:   11,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap, AppColorScheme c) =>
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
              color: c.surfaceElevated, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: c.textPrimary, size: 20),
        ),
      );

  // ── Weekly strip ───────────────────────────────────────────────────────────

  Widget _buildWeekStrip(AppColorScheme c) {
    final today = DateTime.now();
    final dots  = _dotDates;
    return Row(
      key: const ValueKey('strip'),
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: _weekDays.map((d) {
        final sel = d.year == _selectedDate.year &&
            d.month == _selectedDate.month &&
            d.day == _selectedDate.day;
        final isToday = d.year == today.year &&
            d.month == today.month &&
            d.day == today.day;
        return _dayCell(c, d.day, sel, isToday, dots.contains(_dateStr(d)),
            onTap: () => _selectDay(d));
      }).toList(),
    );
  }

  // ── Full-month grid ────────────────────────────────────────────────────────

  Widget _buildMonthGrid(AppColorScheme c) {
    final year         = _focusMonth.year;
    final month        = _focusMonth.month;
    final daysInMonth  = DateTime(year, month + 1, 0).day;
    final firstWeekday = DateTime(year, month, 1).weekday % 7;
    final today        = DateTime.now();
    final dots         = _dotDates;

    return GridView.count(
      key: const ValueKey('month'),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 7,
      childAspectRatio: 1.0,
      children: [
        ...List.generate(firstWeekday, (_) => const SizedBox()),
        ...List.generate(daysInMonth, (i) {
          final day  = i + 1;
          final date = DateTime(year, month, day);
          final sel  = _selectedDate.year == year &&
              _selectedDate.month == month &&
              _selectedDate.day == day;
          final isToday =
              today.year == year && today.month == month && today.day == day;
          return _dayCell(c, day, sel, isToday, dots.contains(_dateStr(date)),
              onTap: () => _selectDay(date));
        }),
      ],
    );
  }

  // ── Shared day cell ────────────────────────────────────────────────────────

  Widget _dayCell(
    AppColorScheme c,
    int day,
    bool isSelected,
    bool isToday,
    bool hasEvent, {
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          gradient: isSelected
              ? const LinearGradient(
                  colors: [AppColors.blue, AppColors.blue],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: isSelected
              ? null
              : isToday
                  ? AppColors.blue.withOpacity(0.12)
                  : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isToday && !isSelected
              ? Border.all(color: AppColors.blue.withOpacity(0.5), width: 1.5)
              : null,
          boxShadow: isSelected
              ? [BoxShadow(
                  color: AppColors.blue.withOpacity(0.35),
                  blurRadius: 6, offset: const Offset(0, 2))]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('$day',
                style: TextStyle(
                  color: isSelected
                      ? Colors.white
                      : isToday
                          ? AppColors.blue
                          : c.textSecondary,
                  fontSize:   12,
                  fontWeight: isSelected || isToday
                      ? FontWeight.bold
                      : FontWeight.normal,
                )),
            if (hasEvent)
              Container(
                width:  5, height: 5,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withOpacity(0.85)
                      : AppColors.emerald,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── Filter pills (apply to reminder tasks only) ────────────────────────────

  Widget _buildFilterRow(AppColorScheme c) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding:  const EdgeInsets.symmetric(horizontal: 20),
        physics:  const BouncingScrollPhysics(),
        itemCount: _filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final f        = _filters[i];
          final selected = _filter == f;
          return ChoiceChip(
            label:    Text(f),
            selected: selected,
            onSelected: (_) {
              HapticFeedback.selectionClick();
              setState(() => _filter = f);
            },
            selectedColor:   AppColors.blue.withOpacity(0.2),
            backgroundColor: c.surfaceElevated,
            labelStyle: TextStyle(
              color:      selected ? AppColors.blue : c.textSecondary,
              fontSize:   12,
              fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
            ),
            side: BorderSide(
                color: selected ? AppColors.blue.withOpacity(0.4) : c.border),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20)),
          );
        },
      ),
    );
  }

  // ── Combined list ──────────────────────────────────────────────────────────

  Widget _buildCombinedList(AppColorScheme c) {
    if (_loading) {
      return const SkeletonList(itemCount: 5);
    }

    final calItems = _dayCalendarItems;
    final tasks    = _filteredTasks;
    final isEmpty  = calItems.isEmpty && tasks.isEmpty;

    if (_listLoading && isEmpty) {
      return const SkeletonList(itemCount: 5);
    }

    return RefreshIndicator(
      onRefresh: () => _fetchAll(),
      color: AppColors.blue,
      child: isEmpty
          ? ListView(children: [
              SizedBox(height: MediaQuery.of(context).size.height * 0.06),
              EmptyState(
                icon:     Icons.event_note_rounded,
                title:    'No items for ${_dateStr(_selectedDate)}',
                subtitle: 'Tap + above to add a task',
              ),
            ])
          : AnimationLimiter(
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                padding: EdgeInsets.fromLTRB(
                    20, 4, 20, FloatingNavBar.kTotalHeight + 80),
                // Layout: calendar events first, then reminder tasks
                itemCount: calItems.length + tasks.length +
                    // section headers when both sections have items
                    (calItems.isNotEmpty ? 1 : 0) +
                    (tasks.isNotEmpty    ? 1 : 0),
                itemBuilder: (_, idx) {
                  // ── Calendar events section ──────────────────────────
                  if (calItems.isNotEmpty) {
                    if (idx == 0) return _sectionLabel('Events', c);
                    final ci = idx - 1;
                    if (ci < calItems.length) {
                      return AnimatedListItem(
                        index: ci,
                        child: _eventCard(calItems[ci], c),
                      );
                    }
                  }

                  // ── Reminder tasks section ───────────────────────────
                  final taskSectionStart = calItems.isNotEmpty
                      ? calItems.length + 1  // +1 for events header
                      : 0;

                  if (tasks.isNotEmpty && idx == taskSectionStart) {
                    return _sectionLabel('Tasks', c);
                  }

                  final ti = idx - taskSectionStart - (tasks.isNotEmpty ? 1 : 0);
                  if (ti >= 0 && ti < tasks.length) {
                    return AnimatedListItem(
                      index: calItems.length + ti,
                      child: _taskCard(tasks[ti]),
                    );
                  }

                  return const SizedBox.shrink();
                },
              ),
            ),
    );
  }

  Widget _sectionLabel(String text, AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 6, 0, 6),
      child: Row(children: [
        Container(
          width: 3, height: 14,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [AppColors.blue, AppColors.blue],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(text,
            style: TextStyle(
              color:      c.textSecondary,
              fontSize:   12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            )),
      ]),
    );
  }

  // ── Calendar event card (read-only) ───────────────────────────────────────

  Widget _eventCard(Map<String, dynamic> e, AppColorScheme c) {
    final title      = (e['title']       ?? '').toString();
    final type       = (e['type']        ?? '').toString();
    final time       = (e['time']        ?? '').toString();
    final location   = (e['location']    ?? '').toString();
    final courseName = (e['course_name'] ?? '').toString();
    final color      = _eventColor(type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          // Left accent bar
          Container(
            width: 4, height: 48,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withOpacity(0.4)],
                begin: Alignment.topCenter,
                end:   Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          // Icon
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withOpacity(0.65)],
                begin: Alignment.topLeft,
                end:   Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(
                  color: color.withOpacity(0.25),
                  blurRadius: 8, offset: const Offset(0, 3))],
            ),
            child: Icon(_eventIcon(type), color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        color:      c.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize:   13)),
                const SizedBox(height: 4),
                Row(children: [
                  BadgeChip(label: _eventLabel(type), color: color),
                  if (courseName.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(courseName,
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 11),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ]),
                if (time.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Row(children: [
                    Icon(Icons.access_time_rounded,
                        color: c.textMuted, size: 12),
                    const SizedBox(width: 4),
                    Text(time,
                        style: TextStyle(
                            color: c.textSecondary, fontSize: 11)),
                  ]),
                ],
                if (location.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(children: [
                    Icon(Icons.location_on_rounded,
                        color: c.textMuted, size: 12),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(location,
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 11),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ]),
                ],
              ],
            ),
          ),
        ]),
      ),
    );
  }

  // ── Reminder task card (interactive) ─────────────────────────────────────

  Widget _taskCard(TaskModel task) {
    final c             = context.colors;
    final priorityColor = _priorityColor(task.priority);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Row(children: [
            Container(
              width: 4, height: 72,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [priorityColor, priorityColor.withOpacity(0.5)],
                  begin: Alignment.topCenter,
                  end:   Alignment.bottomCenter,
                ),
              ),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: () => _toggleTask(task),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: 28, height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: task.isDone
                      ? const LinearGradient(
                          colors: [AppColors.emerald, AppColors.blue],
                          begin: Alignment.topLeft,
                          end:   Alignment.bottomRight,
                        )
                      : null,
                  color:  task.isDone ? null : Colors.transparent,
                  border: task.isDone
                      ? null
                      : Border.all(color: c.textMuted, width: 2),
                ),
                child: task.isDone
                    ? const Icon(Icons.check_rounded,
                        color: Colors.white, size: 16)
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
                    Text(task.title,
                        style: TextStyle(
                          color:      task.isDone ? c.textMuted : c.textPrimary,
                          fontSize:   14,
                          fontWeight: FontWeight.w600,
                          decoration: task.isDone
                              ? TextDecoration.lineThrough
                              : null,
                        )),
                    const SizedBox(height: 6),
                    Row(children: [
                      BadgeChip(
                        label: task.priority[0].toUpperCase() +
                            task.priority.substring(1),
                        color: priorityColor,
                        icon:  _priorityIcon(task.priority),
                      ),
                      const SizedBox(width: 6),
                      BadgeChip(
                          label: task.category,
                          color: _categoryColor(task.category)),
                    ]),
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
                child: Icon(Icons.delete_outline_rounded,
                    color: AppColors.red.withOpacity(0.7), size: 20),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
