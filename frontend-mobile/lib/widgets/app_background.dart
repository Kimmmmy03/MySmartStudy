import 'dart:math';
import 'package:flutter/material.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';

/// Animated background matching the web's AnimatedBg component.
/// Three floating IPG-branded orbs + subtle dot grid pattern.
class AppBackground extends StatefulWidget {
  final Widget child;
  final bool applySafeArea;
  const AppBackground({
    super.key,
    required this.child,
    this.applySafeArea = true,
  });

  @override
  State<AppBackground> createState() => _AppBackgroundState();
}

class _AppBackgroundState extends State<AppBackground>
    with TickerProviderStateMixin {
  late final List<AnimationController> _ctrls;

  static const _durations = [6000, 8000, 10000];

  @override
  void initState() {
    super.initState();
    _ctrls = _durations
        .map((ms) => AnimationController(
              vsync: this,
              duration: Duration(milliseconds: ms),
            )..repeat(reverse: true))
        .toList();
  }

  @override
  void dispose() {
    for (final c in _ctrls) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final child =
        widget.applySafeArea ? SafeArea(child: widget.child) : widget.child;

    return Stack(
      children: [
        // Base gradient — dark-900 or light bg
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: isDark
                    ? const [
                        Color(0xFF080c1a),
                        Color(0xFF0e1429),
                        Color(0xFF080c1a),
                      ]
                    : const [
                        Color(0xFFF4F6FB),
                        Color(0xFFEEF0FA),
                        Color(0xFFF4F6FB),
                      ],
              ),
            ),
          ),
        ),

        // Dot grid pattern
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _DotGridPainter(
                dotColor: isDark
                    ? const Color(0xFF2a2a3a)
                    : const Color(0xFFD8D8E8),
                spacing: 24,
                dotRadius: 0.6,
              ),
            ),
          ),
        ),

        // Orb 1 — top-left, IPG Navy (matches web's first orb)
        _FloatingOrb(
          ctrl: _ctrls[0],
          top: -120,
          left: -100,
          size: 500,
          color: AppColors.ipgNavy,
          opacity: isDark ? 0.20 : 0.08,
          floatRange: 8,
        ),

        // Orb 2 — bottom-right, IPG Royal (matches web's second orb)
        _FloatingOrb(
          ctrl: _ctrls[1],
          bottom: -100,
          right: -80,
          size: 420,
          color: AppColors.ipgRoyal,
          opacity: isDark ? 0.15 : 0.05,
          floatRange: 6,
        ),

        // Orb 3 — center-right, IPG Sky (matches web's third orb)
        _FloatingOrb(
          ctrl: _ctrls[2],
          top: 200,
          right: -60,
          size: 260,
          color: AppColors.ipgSky,
          opacity: isDark ? 0.12 : 0.04,
          floatRange: 5,
        ),

        // Content
        child,
      ],
    );
  }
}

/// Floating orb with Y-axis oscillation (matches web's float keyframe).
class _FloatingOrb extends StatelessWidget {
  final AnimationController ctrl;
  final double? top, bottom, left, right;
  final double size;
  final Color color;
  final double opacity;
  final double floatRange;

  const _FloatingOrb({
    required this.ctrl,
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.size,
    required this.color,
    required this.opacity,
    this.floatRange = 6,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: ctrl,
          builder: (_, __) {
            final yOffset = (ctrl.value - 0.5) * 2 * floatRange;
            final alpha = opacity * (0.8 + ctrl.value * 0.2);
            return Transform.translate(
              offset: Offset(0, yOffset),
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      color.withOpacity(alpha),
                      color.withOpacity(alpha * 0.35),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Subtle dot grid pattern matching the web's canvas dot grid.
class _DotGridPainter extends CustomPainter {
  final Color dotColor;
  final double spacing;
  final double dotRadius;

  _DotGridPainter({
    required this.dotColor,
    this.spacing = 24,
    this.dotRadius = 0.6,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = dotColor
      ..style = PaintingStyle.fill;

    for (double x = spacing; x < size.width; x += spacing) {
      for (double y = spacing; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), dotRadius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotGridPainter old) =>
      old.dotColor != dotColor ||
      old.spacing != spacing ||
      old.dotRadius != dotRadius;
}
