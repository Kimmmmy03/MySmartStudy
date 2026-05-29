import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../screens/ai_companion_screen.dart';
import '../screens/smart_buddy_chat_screen.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';

/// Floating brain icon that opens the AI study companion.
/// Shows animated hovering bubbles around the icon when active.
/// User can dismiss the bubbles (persisted via SharedPreferences).
class AiCompanionFab extends StatefulWidget {
  const AiCompanionFab({super.key});

  @override
  State<AiCompanionFab> createState() => _AiCompanionFabState();
}

class _AiCompanionFabState extends State<AiCompanionFab>
    with TickerProviderStateMixin {
  static const _prefKey = 'smartbuddy_bubbles_dismissed';

  late final AnimationController _pulseController;
  late final AnimationController _orbitController;
  bool _bubblesVisible = true;
  bool _loaded = false;

  // Bubble definitions: angle offset, radius factor, size, color
  static const _bubbleCount = 6;
  late final List<_BubbleConfig> _bubbles;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    final rng = Random(42);
    final colors = [
      AppTheme.accentPurple,
      AppTheme.accentCyan,
      AppTheme.accentBlue,
      AppTheme.accentPink,
      AppTheme.accentEmerald,
      AppTheme.accentAmber,
    ];
    _bubbles = List.generate(_bubbleCount, (i) {
      return _BubbleConfig(
        angleOffset: (2 * pi / _bubbleCount) * i + rng.nextDouble() * 0.4,
        radiusFactor: 0.85 + rng.nextDouble() * 0.35,
        size: 6.0 + rng.nextDouble() * 6.0,
        color: colors[i % colors.length],
        speedFactor: 0.7 + rng.nextDouble() * 0.6,
      );
    });

    _loadPref();
  }

  Future<void> _loadPref() async {
    final prefs = await SharedPreferences.getInstance();
    final dismissed = prefs.getBool(_prefKey) ?? false;
    if (mounted) {
      setState(() {
        _bubblesVisible = !dismissed;
        _loaded = true;
      });
    }
  }

  Future<void> _dismissBubbles() async {
    setState(() => _bubblesVisible = false);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, true);
  }

  /// Bottom sheet chooser — tapping the brain FAB opens this so the student
  /// can pick between the Daily Guide hub and the new SmartBuddy chat.
  void _showCompanionMenu(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetCtx) {
        return SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(22),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 24,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Theme.of(context).dividerColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                _CompanionMenuItem(
                  icon: Icons.auto_awesome,
                  title: 'SmartBuddy Chat',
                  subtitle: 'Ask anything — cited from course, papers, or AI.',
                  gradient: const [Color(0xFF6366F1), Color(0xFFA855F7)],
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const SmartBuddyChatScreen()));
                  },
                ),
                const SizedBox(height: 10),
                _CompanionMenuItem(
                  icon: Icons.dashboard_customize_outlined,
                  title: 'Daily Guide & Plan',
                  subtitle: 'Learning style, exam plan, timetable.',
                  gradient: const [Color(0xFF06B6D4), Color(0xFF3B82F6)],
                  onTap: () {
                    Navigator.pop(sheetCtx);
                    Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const AiCompanionScreen()));
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Positioned(
      right: 16,
      bottom: 108,
      child: SizedBox(
        width: 90,
        height: 90,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Animated bubbles
            if (_loaded && _bubblesVisible)
              AnimatedBuilder(
                animation: _orbitController,
                builder: (context, _) {
                  return CustomPaint(
                    size: const Size(90, 90),
                    painter: _BubblePainter(
                      bubbles: _bubbles,
                      orbitProgress: _orbitController.value,
                      pulseProgress: _pulseController.value,
                    ),
                  );
                },
              ),

            // Main FAB button
            GestureDetector(
              onTap: () => _showCompanionMenu(context),
              onLongPress: _bubblesVisible ? _dismissBubbles : null,
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  final scale = _bubblesVisible
                      ? 1.0 + _pulseController.value * 0.05
                      : 1.0;
                  return Transform.scale(scale: scale, child: child);
                },
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: isDark
                          ? [AppTheme.accentPurple, AppTheme.accentCyan]
                          : [AppTheme.accentBlue, AppTheme.accentPurple],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: (isDark ? AppTheme.accentPurple : AppTheme.accentBlue)
                            .withOpacity(isDark ? 0.4 : 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Image.asset(
                      'assets/images/ai-brain-logo.png',
                      width: 56,
                      height: 56,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BubbleConfig {
  final double angleOffset;
  final double radiusFactor;
  final double size;
  final Color color;
  final double speedFactor;

  const _BubbleConfig({
    required this.angleOffset,
    required this.radiusFactor,
    required this.size,
    required this.color,
    required this.speedFactor,
  });
}

class _BubblePainter extends CustomPainter {
  final List<_BubbleConfig> bubbles;
  final double orbitProgress;
  final double pulseProgress;

  _BubblePainter({
    required this.bubbles,
    required this.orbitProgress,
    required this.pulseProgress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final baseRadius = size.width / 2 - 4;

    for (final b in bubbles) {
      final angle = b.angleOffset + orbitProgress * 2 * pi * b.speedFactor;
      final r = baseRadius * b.radiusFactor * (0.9 + pulseProgress * 0.1);
      final dx = center.dx + cos(angle) * r;
      final dy = center.dy + sin(angle) * r;
      final opacity = 0.5 + pulseProgress * 0.3;

      final paint = Paint()
        ..color = b.color.withOpacity(opacity)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(dx, dy), b.size / 2, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _BubblePainter old) => true;
}

class _CompanionMenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> gradient;
  final VoidCallback onTap;
  const _CompanionMenuItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: gradient),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).hintColor,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right,
                  color: Theme.of(context).hintColor),
            ],
          ),
        ),
      ),
    );
  }
}
