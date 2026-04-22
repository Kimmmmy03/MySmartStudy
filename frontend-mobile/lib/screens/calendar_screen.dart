import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/badge_chip.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _selectedMonth = DateTime.now();
  DateTime? _selectedDay;
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final monthStr = '${_selectedMonth.year}-${_selectedMonth.month.toString().padLeft(2, '0')}';
    try {
      final raw = await ApiService.getCalendarEvents(monthStr);
      if (!mounted) return;
      setState(() {
        _events = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Set<int> get _daysWithEvents {
    final days = <int>{};
    for (final e in _events) {
      final date = e['date']?.toString() ?? '';
      if (date.length >= 10) {
        final day = int.tryParse(date.substring(8, 10));
        if (day != null) days.add(day);
      }
    }
    return days;
  }

  List<Map<String, dynamic>> get _selectedDayEvents {
    if (_selectedDay == null) return _events;
    final dayStr = '${_selectedDay!.year}-${_selectedDay!.month.toString().padLeft(2, '0')}-${_selectedDay!.day.toString().padLeft(2, '0')}';
    return _events.where((e) => (e['date']?.toString() ?? '').startsWith(dayStr)).toList();
  }

  Color _eventColor(String type) {
    switch (type) {
      case 'assignment': return AppColors.amber;
      case 'quiz': return AppColors.purple;
      case 'reminder': return AppColors.amber;
      case 'class': return AppColors.emerald;
      case 'study_time': return AppColors.blue;
      case 'attendance': return AppColors.purple;
      default: return AppColors.blue;
    }
  }

  IconData _eventIcon(String type) {
    switch (type) {
      case 'assignment': return Icons.assignment_rounded;
      case 'quiz': return Icons.quiz_rounded;
      case 'reminder': return Icons.notifications_rounded;
      case 'class': return Icons.school_rounded;
      case 'study_time': return Icons.psychology_rounded;
      case 'attendance': return Icons.fact_check_rounded;
      default: return Icons.event_rounded;
    }
  }

  String _eventTypeLabel(String type) {
    switch (type) {
      case 'study_time': return 'study time';
      default: return type;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Calendar', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonList(itemCount: 5)
          : Column(
              children: [
                _monthNavigator(c),
                _calendarGrid(c),
                const SizedBox(height: 8),
                Expanded(child: _eventsList(c)),
              ],
            ),
    );
  }

  Widget _monthNavigator(AppColorScheme c) {
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: Icon(Icons.chevron_left_rounded, color: c.textPrimary),
              onPressed: () {
                HapticFeedback.selectionClick();
                setState(() {
                  _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month - 1);
                  _selectedDay = null;
                  _loading = true;
                });
                _load();
              },
            ),
            Text(
              '${months[_selectedMonth.month]} ${_selectedMonth.year}',
              style: TextStyle(color: c.textPrimary, fontSize: 16, fontWeight: FontWeight.w600),
            ),
            IconButton(
              icon: Icon(Icons.chevron_right_rounded, color: c.textPrimary),
              onPressed: () {
                HapticFeedback.selectionClick();
                setState(() {
                  _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1);
                  _selectedDay = null;
                  _loading = true;
                });
                _load();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _calendarGrid(AppColorScheme c) {
    final daysInMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0).day;
    final firstWeekday = DateTime(_selectedMonth.year, _selectedMonth.month, 1).weekday % 7;
    final eventDays = _daysWithEvents;
    final today = DateTime.now();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  .map((d) => Expanded(
                        child: Center(
                          child: Text(d, style: TextStyle(color: c.textMuted, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: 4),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, mainAxisSpacing: 2, crossAxisSpacing: 2),
              itemCount: firstWeekday + daysInMonth,
              itemBuilder: (_, i) {
                if (i < firstWeekday) return const SizedBox();
                final day = i - firstWeekday + 1;
                final isToday = today.year == _selectedMonth.year && today.month == _selectedMonth.month && today.day == day;
                final hasEvent = eventDays.contains(day);
                final isSelected = _selectedDay?.day == day;

                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _selectedDay = DateTime(_selectedMonth.year, _selectedMonth.month, day));
                  },
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
                      color: isSelected ? null : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      border: isToday && !isSelected
                          ? Border.all(color: AppColors.blue.withOpacity(0.6), width: 1.5)
                          : null,
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: AppColors.blue.withOpacity(0.35),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ]
                          : null,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$day',
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : isToday
                                    ? AppColors.blue
                                    : c.textPrimary,
                            fontSize: 13,
                            fontWeight: isToday || isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        if (hasEvent)
                          Container(
                            width: 5,
                            height: 5,
                            margin: const EdgeInsets.only(top: 2),
                            decoration: BoxDecoration(
                              color: isSelected ? Colors.white.withOpacity(0.8) : AppColors.emerald,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _eventsList(AppColorScheme c) {
    final events = _selectedDayEvents;
    if (events.isEmpty) {
      return Center(
        child: EmptyState(
          icon: Icons.event_rounded,
          title: _selectedDay != null ? 'No events on this day' : 'No events this month',
          subtitle: 'Events will appear here',
        ),
      );
    }
    return AnimationLimiter(
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        itemCount: events.length,
        itemBuilder: (_, i) {
          final e = events[i];
          final title = e['title']?.toString() ?? '';
          final type = e['type']?.toString() ?? '';
          final date = e['date']?.toString() ?? '';
          final time = e['time']?.toString() ?? '';
          final location = e['location']?.toString() ?? '';
          final courseName = e['course_name']?.toString() ?? '';
          final color = _eventColor(type);

          return AnimatedListItem(
            index: i,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GlassCard(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [color, color.withOpacity(0.4)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [color, color.withOpacity(0.65)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: color.withOpacity(0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Icon(_eventIcon(type), color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              BadgeChip(label: _eventTypeLabel(type), color: color),
                              if (courseName.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                Flexible(child: Text(courseName, style: TextStyle(color: c.textMuted, fontSize: 11), overflow: TextOverflow.ellipsis)),
                              ],
                            ],
                          ),
                          if (time.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Row(children: [
                              Icon(Icons.access_time_rounded, color: c.textMuted, size: 12),
                              const SizedBox(width: 4),
                              Text(time, style: TextStyle(color: c.textSecondary, fontSize: 11)),
                            ]),
                          ],
                          if (location.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Row(children: [
                              Icon(Icons.location_on_rounded, color: c.textMuted, size: 12),
                              const SizedBox(width: 4),
                              Flexible(child: Text(location, style: TextStyle(color: c.textSecondary, fontSize: 11), overflow: TextOverflow.ellipsis)),
                            ]),
                          ],
                          if (_selectedDay == null && date.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(date, style: TextStyle(color: c.textMuted, fontSize: 10)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
