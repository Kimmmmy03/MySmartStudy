import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getNotifications();
      if (!mounted) return;
      setState(() {
        _notifications = raw.map((n) => Map<String, dynamic>.from(n)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  IconData _iconFor(String type) {
    switch (type) {
      case 'assignment':
        return Icons.assignment_rounded;
      case 'quiz':
        return Icons.quiz_rounded;
      case 'grade':
        return Icons.grade_rounded;
      case 'announcement':
        return Icons.campaign_rounded;
      case 'message':
        return Icons.mail_rounded;
      case 'badge':
        return Icons.emoji_events_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color _colorFor(String type) {
    switch (type) {
      case 'assignment':
        return AppColors.amber;
      case 'quiz':
        return AppColors.blue;
      case 'grade':
        return AppColors.emerald;
      case 'announcement':
        return AppColors.purple;
      case 'message':
        return AppColors.blue;
      case 'badge':
        return AppColors.purple;
      default:
        return AppColors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          TextButton(
            onPressed: () async {
              HapticFeedback.lightImpact();
              await ApiService.markAllNotificationsRead();
              _load();
            },
            child: const Text('Read all', style: TextStyle(color: AppColors.blue, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: _loading
          ? const SkeletonList(itemCount: 6)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.blue,
              child: _notifications.isEmpty
                  ? ListView(children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                      const EmptyState(
                        icon: Icons.notifications_off_rounded,
                        title: 'No notifications',
                        subtitle: 'You\'re all caught up!',
                      ),
                    ])
                  : AnimationLimiter(
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                        itemCount: _notifications.length,
                        itemBuilder: (_, i) => AnimatedListItem(
                          index: i,
                          child: _notifTile(_notifications[i]),
                        ),
                      ),
                    ),
            ),
    );
  }

  Widget _notifTile(Map<String, dynamic> notif) {
    final c = context.colors;
    final type = notif['type']?.toString() ?? '';
    final title = notif['title']?.toString() ?? '';
    final body = notif['body']?.toString() ?? '';
    final isRead = notif['is_read'] == true || notif['read'] == true;
    final createdAt = notif['created_at']?.toString() ?? '';
    final color = _colorFor(type);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        onTap: () async {
          if (!isRead) {
            HapticFeedback.lightImpact();
            await ApiService.markNotificationRead(notif['id']?.toString() ?? '');
            _load();
          }
        },
        borderColor: isRead ? null : color.withOpacity(0.3),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(_iconFor(type), color: color, size: 20),
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
                      fontWeight: isRead ? FontWeight.w500 : FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  if (body.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      body,
                      style: TextStyle(color: c.textSecondary, fontSize: 12),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      createdAt.length >= 10 ? createdAt.substring(0, 10) : createdAt,
                      style: TextStyle(color: c.textMuted, fontSize: 10),
                    ),
                  ],
                ],
              ),
            ),
            if (!isRead)
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
          ],
        ),
      ),
    );
  }
}
