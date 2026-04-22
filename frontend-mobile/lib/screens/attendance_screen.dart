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
import '../widgets/confirmation_dialog.dart';
import '../widgets/skeletons.dart';
import 'attendance_checkin_screen.dart';
import 'attendance_session_detail_screen.dart';

// ── Pastel palette (matches Courses / Chat overhaul) ─────────────────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSeafoam = Color(0xFF7BB5B0);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);
const _pSky = Color(0xFF8BB5C9);

class AttendanceScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const AttendanceScreen({
    super.key,
    required this.courseId,
    required this.courseName,
    this.isLecturer = false,
  });
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<Map<String, dynamic>> _sessions = [];
  Map<String, dynamic>? _studentAggregate;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      if (widget.isLecturer) {
        final raw = await ApiService.getCourseAttendance(widget.courseId);
        if (!mounted) return;
        setState(() {
          _sessions = raw.map((s) => Map<String, dynamic>.from(s)).toList();
          _loading = false;
        });
      } else {
        final results = await Future.wait<dynamic>([
          ApiService.getMe(),
          ApiService.getCourseAttendance(widget.courseId),
          ApiService.getMyAttendance(),
        ]);
        final me = Map<String, dynamic>.from(results[0] as Map);
        final sessions = (results[1] as List)
            .map((s) => Map<String, dynamic>.from(s))
            .toList();
        final myAttList = (results[2] as List)
            .map((s) => Map<String, dynamic>.from(s))
            .toList();
        final myId = me['id']?.toString() ?? '';
        // Enrich each session with this student's status
        for (final s in sessions) {
          final records = (s['records'] as List?) ?? [];
          String myStatus = 'absent';
          for (final r in records) {
            final rm = Map<String, dynamic>.from(r);
            if (rm['student_id']?.toString() == myId) {
              myStatus = rm['status']?.toString() ?? 'absent';
              break;
            }
          }
          s['status'] = myStatus;
        }
        final agg = myAttList.firstWhere(
          (a) => (a['course_id']?.toString() ?? '') == widget.courseId,
          orElse: () => <String, dynamic>{},
        );
        if (!mounted) return;
        setState(() {
          _sessions = sessions;
          _studentAggregate = agg.isEmpty ? null : agg;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'present':
        return _pSeafoam;
      case 'late':
        return _pSand;
      case 'excused':
        return _pSky;
      default:
        return _pRose;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'present':
        return Icons.check_circle_rounded;
      case 'late':
        return Icons.schedule_rounded;
      case 'excused':
        return Icons.shield_rounded;
      default:
        return Icons.cancel_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AppBar(
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Attendance',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(widget.courseName,
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
              actions: [
                if (!widget.isLecturer)
                  IconButton(
                    icon: const Icon(Icons.qr_code_scanner_rounded, color: _pSlate),
                    tooltip: 'QR Check-in',
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AttendanceCheckinScreen()),
                      ).then((_) => _load());
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: widget.isLecturer ? _fab() : null,
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pSlate,
                  child: _sessions.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics()),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.18),
                            EmptyState(
                              icon: Icons.fact_check_rounded,
                              title: widget.isLecturer
                                  ? 'No sessions yet'
                                  : 'No attendance records',
                              subtitle: widget.isLecturer
                                  ? 'Tap "New Session" to start tracking'
                                  : 'Sessions will appear once your lecturer creates one',
                            ),
                          ],
                        )
                      : AnimationLimiter(
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                                parent: BouncingScrollPhysics()),
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                            children: [
                              _statsCard(),
                              const SizedBox(height: 14),
                              ...List.generate(
                                _sessions.length,
                                (i) => AnimatedListItem(
                                  index: i,
                                  child: _sessionCard(_sessions[i]),
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

  Widget _fab() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_pSlate, _pLavender],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: _pSlate.withOpacity(0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: FloatingActionButton.extended(
        heroTag: 'fab_attendance',
        backgroundColor: Colors.transparent,
        elevation: 0,
        icon: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
        label: const Text('New Session',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        onPressed: _createSession,
      ),
    );
  }

  Widget _statsCard() {
    final c = context.colors;
    if (widget.isLecturer) {
      final totalSessions = _sessions.length;
      int totalPresent = 0;
      int totalSpots = 0;
      for (final s in _sessions) {
        totalPresent += ((s['present_count'] ?? 0) as num).toInt();
        totalSpots += ((s['total_count'] ?? 0) as num).toInt();
      }
      final avgPct = totalSpots > 0 ? ((totalPresent / totalSpots) * 100).round() : 0;
      return Row(
        children: [
          Expanded(child: _tile('Sessions', '$totalSessions', _pSlate, Icons.event_available_rounded)),
          const SizedBox(width: 8),
          Expanded(child: _tile('Avg Rate', '$avgPct%', _pSeafoam, Icons.trending_up_rounded)),
          const SizedBox(width: 8),
          Expanded(child: _tile('Present', '$totalPresent', _pLavender, Icons.check_circle_rounded)),
        ],
      );
    }
    final row = _studentAggregate;
    if (row != null) {
      final total = ((row['total_sessions'] ?? 0) as num).toInt();
      final present = ((row['present'] ?? 0) as num).toInt();
      final late = ((row['late'] ?? 0) as num).toInt();
      final absent = ((row['absent'] ?? 0) as num).toInt();
      final pct = ((row['attendance_percentage'] ?? 0) as num).toDouble();
      final rateColor = pct >= 80 ? _pSeafoam : (pct >= 60 ? _pSand : _pRose);
      return Column(
        children: [
          Row(
            children: [
              Expanded(child: _tile('Rate', '${pct.round()}%', rateColor, Icons.insights_rounded)),
              const SizedBox(width: 8),
              Expanded(child: _tile('Present', '$present', _pSeafoam, Icons.check_circle_rounded)),
              const SizedBox(width: 8),
              Expanded(child: _tile('Late', '$late', _pSand, Icons.schedule_rounded)),
              const SizedBox(width: 8),
              Expanded(child: _tile('Absent', '$absent', _pRose, Icons.cancel_rounded)),
            ],
          ),
          const SizedBox(height: 8),
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(
              children: [
                Text('Total sessions',
                    style: TextStyle(color: c.textMuted, fontSize: 12)),
                const Spacer(),
                Text('$total',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }

  Widget _tile(String label, String value, Color color, IconData icon) {
    final c = context.colors;
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      child: Column(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  color: color, fontSize: 15, fontWeight: FontWeight.bold)),
          Text(label,
              style: TextStyle(color: c.textMuted, fontSize: 10)),
        ],
      ),
    );
  }

  Widget _sessionCard(Map<String, dynamic> session) {
    final c = context.colors;
    final date = session['date']?.toString() ?? '';
    final title = session['title']?.toString() ?? 'Session';

    // ── Student view
    if (!widget.isLecturer) {
      final status = session['status']?.toString() ?? 'absent';
      final color = _statusColor(status);
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: GlassCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: color.withOpacity(0.3)),
                ),
                child: Icon(_statusIcon(status), color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: TextStyle(
                            color: c.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13),
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(date,
                        style: TextStyle(color: c.textMuted, fontSize: 11)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: color.withOpacity(0.35)),
                ),
                child: Text(
                  status[0].toUpperCase() + status.substring(1),
                  style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // ── Lecturer view
    final presentCount = ((session['present_count'] ?? 0) as num).toInt();
    final totalCount = ((session['total_count'] ?? 0) as num).toInt();
    final pct = totalCount > 0 ? ((presentCount / totalCount) * 100).round() : 0;
    final pctColor = pct >= 80 ? _pSeafoam : (pct >= 60 ? _pSand : _pRose);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => AttendanceSessionDetailScreen(
                  courseId: widget.courseId,
                  sessionId: session['id']?.toString() ?? '',
                  sessionTitle: title,
                  sessionDate: date,
                  sessionStartTime: session['start_time']?.toString(),
                  sessionEndTime: session['end_time']?.toString(),
                ),
              ),
            ).then((_) => _load());
          },
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_pSlate.withOpacity(0.22), _pLavender.withOpacity(0.18)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _pSlate.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.fact_check_rounded,
                      color: _pSlate, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13),
                          overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Builder(builder: (_) {
                        final st = session['start_time']?.toString() ?? '';
                        final et = session['end_time']?.toString() ?? '';
                        final timeRange = (st.isNotEmpty && et.isNotEmpty)
                            ? '$date  ·  $st – $et'
                            : date;
                        return Text(timeRange,
                            style:
                                TextStyle(color: c.textMuted, fontSize: 11));
                      }),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: pctColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: pctColor.withOpacity(0.35)),
                      ),
                      child: Text('$pct%',
                          style: TextStyle(
                              color: pctColor,
                              fontSize: 11,
                              fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 3),
                    Text('$presentCount/$totalCount',
                        style: TextStyle(color: c.textMuted, fontSize: 10)),
                  ],
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () async {
                    HapticFeedback.lightImpact();
                    final ok = await showConfirmationDialog(
                      context: context,
                      title: 'Delete Session',
                      message: 'Delete this attendance session?',
                      isDanger: true,
                      confirmLabel: 'Delete',
                    );
                    if (ok == true) {
                      try {
                        await ApiService.deleteAttendanceSession(
                            session['id']?.toString() ?? '');
                        _load();
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content: Text('Failed: $e'),
                            backgroundColor: _pRose,
                          ));
                        }
                      }
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: _pRose.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(7),
                      border: Border.all(color: _pRose.withOpacity(0.25)),
                    ),
                    child: const Icon(Icons.delete_outline_rounded,
                        size: 14, color: _pRose),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _createSession() async {
    HapticFeedback.lightImpact();
    final titleCtrl = TextEditingController(text: 'Session ${_sessions.length + 1}');
    DateTime selectedDate = DateTime.now();
    final nowTod = TimeOfDay.now();
    TimeOfDay startTime = nowTod;
    TimeOfDay endTime = TimeOfDay(
      hour: (nowTod.hour + 1) % 24,
      minute: nowTod.minute,
    );
    String fmtTOD(TimeOfDay t) =>
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

    await showGlassBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final c = context.colors;
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              _pSlate.withOpacity(0.22),
                              _pLavender.withOpacity(0.18),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _pSlate.withOpacity(0.3)),
                        ),
                        child: const Icon(Icons.fact_check_rounded,
                            color: _pSlate, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text('New Attendance Session',
                            style: TextStyle(
                                color: c.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 16)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _sheetField(
                    label: 'Title',
                    child: TextField(
                      controller: titleCtrl,
                      autofocus: true,
                      style: TextStyle(color: c.textPrimary, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Session title',
                        hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
                        prefixIcon: const Icon(Icons.title_rounded,
                            color: _pSlate, size: 18),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 4, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _sheetField(
                    label: 'Date',
                    child: InkWell(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: selectedDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                          builder: (ctx, child) => Theme(
                            data: Theme.of(ctx).copyWith(
                              colorScheme: Theme.of(ctx).colorScheme.copyWith(
                                    primary: _pSlate,
                                    onPrimary: Colors.white,
                                  ),
                            ),
                            child: child!,
                          ),
                        );
                        if (picked != null) {
                          setSheetState(() => selectedDate = picked);
                        }
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 14),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_rounded,
                                color: _pSlate, size: 16),
                            const SizedBox(width: 10),
                            Text(
                              selectedDate.toIso8601String().split('T')[0],
                              style: TextStyle(
                                  color: c.textPrimary, fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _sheetField(
                          label: 'Start time',
                          child: InkWell(
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: ctx,
                                initialTime: startTime,
                                builder: (ctx, child) => Theme(
                                  data: Theme.of(ctx).copyWith(
                                    colorScheme:
                                        Theme.of(ctx).colorScheme.copyWith(
                                              primary: _pSlate,
                                              onPrimary: Colors.white,
                                            ),
                                  ),
                                  child: child!,
                                ),
                              );
                              if (picked != null) {
                                setSheetState(() {
                                  startTime = picked;
                                  final sMin =
                                      picked.hour * 60 + picked.minute;
                                  final eMin =
                                      endTime.hour * 60 + endTime.minute;
                                  if (eMin <= sMin) {
                                    final newEnd = (sMin + 60) % (24 * 60);
                                    endTime = TimeOfDay(
                                        hour: newEnd ~/ 60,
                                        minute: newEnd % 60);
                                  }
                                });
                              }
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 14),
                              child: Row(
                                children: [
                                  const Icon(Icons.schedule_rounded,
                                      color: _pSlate, size: 16),
                                  const SizedBox(width: 10),
                                  Text(fmtTOD(startTime),
                                      style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _sheetField(
                          label: 'End time',
                          child: InkWell(
                            onTap: () async {
                              final picked = await showTimePicker(
                                context: ctx,
                                initialTime: endTime,
                                builder: (ctx, child) => Theme(
                                  data: Theme.of(ctx).copyWith(
                                    colorScheme:
                                        Theme.of(ctx).colorScheme.copyWith(
                                              primary: _pSlate,
                                              onPrimary: Colors.white,
                                            ),
                                  ),
                                  child: child!,
                                ),
                              );
                              if (picked != null) {
                                setSheetState(() => endTime = picked);
                              }
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 14),
                              child: Row(
                                children: [
                                  const Icon(Icons.timer_off_rounded,
                                      color: _pSlate, size: 16),
                                  const SizedBox(width: 10),
                                  Text(fmtTOD(endTime),
                                      style: TextStyle(
                                          color: c.textPrimary,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 4, right: 10),
                        child: Text('Duration',
                            style: TextStyle(
                                color: c.textMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5)),
                      ),
                      Expanded(
                        child: Wrap(
                          spacing: 6,
                          children: [30, 60, 90, 120, 180].map((mins) {
                            final sMin =
                                startTime.hour * 60 + startTime.minute;
                            final eMin = endTime.hour * 60 + endTime.minute;
                            final active = (eMin - sMin) == mins;
                            final label = mins < 60
                                ? '${mins}m'
                                : mins % 60 == 0
                                    ? '${mins ~/ 60}h'
                                    : '${mins ~/ 60}h${mins % 60}m';
                            return GestureDetector(
                              onTap: () {
                                HapticFeedback.selectionClick();
                                setSheetState(() {
                                  final newEnd =
                                      (sMin + mins) % (24 * 60);
                                  endTime = TimeOfDay(
                                      hour: newEnd ~/ 60,
                                      minute: newEnd % 60);
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: active
                                      ? _pSlate.withOpacity(0.22)
                                      : (context.isDark
                                          ? Colors.white.withOpacity(0.04)
                                          : Colors.white.withOpacity(0.7)),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: active
                                        ? _pSlate.withOpacity(0.5)
                                        : c.border.withOpacity(0.5),
                                  ),
                                ),
                                child: Text(
                                  label,
                                  style: TextStyle(
                                    color: active ? _pSlate : c.textMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [_pSlate, _pLavender],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: _pSlate.withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: const Icon(Icons.check_rounded,
                            color: Colors.white, size: 18),
                        label: const Text(
                          'Create Session',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600),
                        ),
                        onPressed: () async {
                          final title = titleCtrl.text.trim();
                          if (title.isEmpty) return;
                          Navigator.pop(ctx);
                          try {
                            await ApiService.createAttendanceSession(
                              widget.courseId,
                              {
                                'title': title,
                                'date': selectedDate
                                    .toIso8601String()
                                    .split('T')[0],
                                'start_time': fmtTOD(startTime),
                                'end_time': fmtTOD(endTime),
                              },
                            );
                            HapticFeedback.mediumImpact();
                            _load();
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                    content: Text('Failed: $e'),
                                    backgroundColor: _pRose),
                              );
                            }
                          }
                        },
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _sheetField({required String label, required Widget child}) {
    final c = context.colors;
    final isDark = context.isDark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 4),
          child: Text(label,
              style: TextStyle(
                  color: c.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5)),
        ),
        Container(
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withOpacity(0.06)
                : Colors.white.withOpacity(0.85),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark
                  ? Colors.white.withOpacity(0.08)
                  : Colors.black.withOpacity(0.06),
            ),
          ),
          child: child,
        ),
      ],
    );
  }
}
