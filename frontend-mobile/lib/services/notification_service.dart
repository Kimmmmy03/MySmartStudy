import 'dart:developer' as dev;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:flutter_timezone/flutter_timezone.dart';

class NotificationService {
  NotificationService._();
  static final instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static const int _dailyReminderId = 900001;

  Future<void> init() async {
    tzdata.initializeTimeZones();
    final tzName = await FlutterTimezone.getLocalTimezone();
    tz.setLocalLocation(tz.getLocation(tzName));

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);

    await _plugin.initialize(initSettings);

    // Android 13+ permission
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  /// Stable int ID from Firestore doc id (does NOT change between app runs)
  int stableIdFromDocId(String docId) {
    // FNV-1a 32-bit
    const int fnvPrime = 16777619;
    int hash = 2166136261;
    for (final unit in docId.codeUnits) {
      hash ^= unit;
      hash = (hash * fnvPrime) & 0xFFFFFFFF;
    }
    return hash & 0x7FFFFFFF;
  }

  // -------------------------
  // Task reminder (one-time)
  // -------------------------

  Future<void> cancelTaskReminder(String taskDocId) async {
    await _plugin.cancel(stableIdFromDocId(taskDocId));
  }

  Future<void> scheduleTaskReminder({
    required String taskDocId,
    required String title,
    required String body,
    required DateTime scheduledAt,
  }) async {
    final id = stableIdFromDocId(taskDocId);

    // Avoid scheduling in the past
    if (scheduledAt.isBefore(DateTime.now())) return;

    const androidDetails = AndroidNotificationDetails(
      'task_reminders',
      'Task Reminders',
      channelDescription: 'Reminders for upcoming due tasks',
      importance: Importance.max,
      priority: Priority.high,
    );

    try {
      await _plugin.zonedSchedule(
        id,
        title,
        body,
        tz.TZDateTime.from(scheduledAt, tz.local),
        const NotificationDetails(android: androidDetails),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      );
    } catch (e) {
      // Exact alarms may not be permitted on some Android 12+ devices/emulators.
      // Fall back to inexact scheduling which is always allowed.
      dev.log('Exact alarm failed, falling back to inexact: $e',
          name: 'NotificationService');
      try {
        await _plugin.zonedSchedule(
          id,
          title,
          body,
          tz.TZDateTime.from(scheduledAt, tz.local),
          const NotificationDetails(android: androidDetails),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        );
      } catch (e2) {
        dev.log('Notification scheduling failed entirely: $e2',
            name: 'NotificationService');
      }
    }
  }

  /// Keep reminder correct based on current task state
  Future<void> syncTaskReminder({
    required String taskDocId,
    required String title,
    required DateTime? dueAt,
    required bool isDone,
  }) async {
    // If completed OR no due date → no reminder
    if (isDone || dueAt == null) {
      await cancelTaskReminder(taskDocId);
      return;
    }

    // Always cancel then reschedule (keeps it correct)
    await cancelTaskReminder(taskDocId);

    await scheduleTaskReminder(
      taskDocId: taskDocId,
      title: "Task due: $title",
      body: "Reminder: your task is due soon.",
      scheduledAt: dueAt,
    );
  }

  // -------------------------
  // Daily study reminder (8PM)
  // -------------------------

  Future<void> cancelDailyStudyReminder() async {
    await _plugin.cancel(_dailyReminderId);
  }

  Future<void> scheduleDailyStudyReminder({
    required int hour,
    required int minute,
  }) async {
    await cancelDailyStudyReminder();

    final now = tz.TZDateTime.now(tz.local);
    var next = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      hour,
      minute,
    );

    // If already passed today, schedule for tomorrow
    if (next.isBefore(now)) {
      next = next.add(const Duration(days: 1));
    }

    const androidDetails = AndroidNotificationDetails(
      'daily_study',
      'Daily Study Reminder',
      channelDescription: 'Daily reminder to study',
      importance: Importance.max,
      priority: Priority.high,
    );

    try {
      await _plugin.zonedSchedule(
        _dailyReminderId,
        "8PM Study Time",
        "Open MySmartStudy and do your tasks 💪",
        next,
        const NotificationDetails(android: androidDetails),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        matchDateTimeComponents: DateTimeComponents.time, // repeats daily
      );
    } catch (e) {
      // Exact alarms may not be permitted; fall back to inexact.
      dev.log('Exact daily alarm failed, falling back to inexact: $e',
          name: 'NotificationService');
      try {
        await _plugin.zonedSchedule(
          _dailyReminderId,
          "8PM Study Time",
          "Open MySmartStudy and do your tasks 💪",
          next,
          const NotificationDetails(android: androidDetails),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          matchDateTimeComponents: DateTimeComponents.time,
        );
      } catch (e2) {
        dev.log('Daily notification scheduling failed entirely: $e2',
            name: 'NotificationService');
      }
    }
  }
}
