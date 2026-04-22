import 'dart:math' as math;
import 'package:flutter/material.dart';

/// The MySmartStudy brand mark — bold "M" monogram with a gold sparkle.
///
/// Mirrors the Android adaptive launcher icon exactly.
/// Works at any size from 24 dp (nav-bar) up to 256 dp (splash screen).
///
/// Usage:
///   AppLogo(size: 80)
///   AppLogo(size: 48, showGlow: false)
class AppLogo extends StatelessWidget {
  final double size;

  /// Whether to paint the radial glow disc behind the logo.
  /// Disable for very small sizes (< 32) or on already-glowing surfaces.
  final bool showGlow;

  const AppLogo({super.key, this.size = 80, this.showGlow = true});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _AppLogoPainter(showGlow: showGlow)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated variant — gently pulses via an external AnimationController.
// ─────────────────────────────────────────────────────────────────────────────

class AnimatedAppLogo extends StatelessWidget {
  final double size;
  final bool showGlow;
  final Animation<double> pulseCtrl;

  const AnimatedAppLogo({
    super.key,
    required this.size,
    required this.pulseCtrl,
    this.showGlow = true,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulseCtrl,
      builder: (_, __) {
        final scale = 1.0 + 0.04 * math.sin(pulseCtrl.value * 2 * math.pi);
        return Transform.scale(
          scale: scale,
          child: AppLogo(size: size, showGlow: showGlow),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Painter — all coordinates in a 108×108 virtual canvas, then scaled.
// ─────────────────────────────────────────────────────────────────────────────

class _AppLogoPainter extends CustomPainter {
  final bool showGlow;
  const _AppLogoPainter({required this.showGlow});

  // ── Palette ────────────────────────────────────────────────────────────────
  static const _blue       = Color(0xFF3B82F6);
  static const _purple     = Color(0xFF8B5CF6);
  static const _starGold   = Color(0xFFFFD166);
  static const _starAmber  = Color(0xFFFFB300);

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 108; // scale factor
    canvas.save();
    canvas.scale(s, s);

    if (showGlow) _drawGlowDisc(canvas);
    _drawM(canvas);
    _drawStar(canvas);

    canvas.restore();
  }

  // ── Background glow disc ───────────────────────────────────────────────────
  void _drawGlowDisc(Canvas canvas) {
    // Outermost soft blue glow
    canvas.drawCircle(const Offset(54, 54), 44,
        Paint()..color = const Color(0xFF2255CC).withOpacity(0.20));
    // Mid blue-purple disc
    canvas.drawCircle(const Offset(54, 54), 35,
        Paint()..color = const Color(0xFF3366DD).withOpacity(0.28));
    // Bright core
    canvas.drawCircle(const Offset(54, 54), 27,
        Paint()..color = const Color(0xFF2244BB).withOpacity(0.38));
  }

  // ── Bold "M" letterform ────────────────────────────────────────────────────
  void _drawM(Canvas canvas) {
    // Coordinates match the Android vector exactly — 82 % scale from (54,54).
    // Bounding box: x 32–76, y 33–75. Corner distance ≈ 28 dp < circle r 33 dp.
    Path _buildMPath() => Path()
      ..moveTo(32, 72)
      ..lineTo(32, 36)
      ..quadraticBezierTo(32, 33, 34, 33)
      ..lineTo(39, 33)
      ..quadraticBezierTo(42, 33, 43, 35)
      ..lineTo(54, 53)
      ..lineTo(65, 35)
      ..quadraticBezierTo(66, 33, 69, 33)
      ..lineTo(74, 33)
      ..quadraticBezierTo(76, 33, 76, 36)
      ..lineTo(76, 72)
      ..quadraticBezierTo(76, 75, 74, 75)
      ..lineTo(70, 75)
      ..quadraticBezierTo(67, 75, 67, 72)
      ..lineTo(67, 50)
      ..lineTo(56, 65)
      ..quadraticBezierTo(55, 68, 54, 68)
      ..quadraticBezierTo(53, 68, 52, 65)
      ..lineTo(41, 50)
      ..lineTo(41, 72)
      ..quadraticBezierTo(41, 75, 38, 75)
      ..lineTo(34, 75)
      ..quadraticBezierTo(32, 75, 32, 72)
      ..close();

    // 1 — White base (high contrast on dark background)
    canvas.drawPath(_buildMPath(), Paint()..color = Colors.white);

    // 2 — Blue tint on right diagonal + right leg
    final rightTint = Path()
      ..moveTo(54, 53)
      ..lineTo(65, 35)
      ..quadraticBezierTo(66, 33, 69, 33)
      ..lineTo(74, 33)
      ..quadraticBezierTo(76, 33, 76, 36)
      ..lineTo(76, 72)
      ..quadraticBezierTo(76, 75, 74, 75)
      ..lineTo(70, 75)
      ..quadraticBezierTo(67, 75, 67, 72)
      ..lineTo(67, 50)
      ..lineTo(56, 65)
      ..quadraticBezierTo(55, 68, 54, 68)
      ..close();
    canvas.drawPath(rightTint,
        Paint()..color = _blue.withOpacity(0.65));

    // 3 — Deeper purple on the right leg only
    final rightLeg = Path()
      ..moveTo(67, 50)
      ..lineTo(67, 72)
      ..quadraticBezierTo(67, 75, 70, 75)
      ..lineTo(74, 75)
      ..quadraticBezierTo(76, 75, 76, 72)
      ..lineTo(76, 50)
      ..close();
    canvas.drawPath(rightLeg,
        Paint()..color = _purple.withOpacity(0.45));
  }

  // ── 4-pointed star sparkle (top-right) ────────────────────────────────────
  // Center (74, 29), outer radius 8, inner radius 3.1 — matches Android vector.
  void _drawStar(Canvas canvas) {
    const cx = 74.0;
    const cy = 29.0;
    const outer = 8.0;
    const inner = 3.1;

    // Glow halo
    if (showGlow) {
      canvas.drawCircle(
        const Offset(cx, cy),
        outer + 3,
        Paint()
          ..color = _starGold.withOpacity(0.22)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }

    // Star path — 8 vertices, alternating outer / inner radii, starting from top
    final starPath = Path();
    for (int i = 0; i < 8; i++) {
      final r     = i.isEven ? outer : inner;
      final angle = -math.pi / 2 + i * math.pi / 4;
      final x     = cx + r * math.cos(angle);
      final y     = cy + r * math.sin(angle);
      if (i == 0) starPath.moveTo(x, y);
      else        starPath.lineTo(x, y);
    }
    starPath.close();

    // Gold-to-amber radial fill
    canvas.drawPath(
      starPath,
      Paint()
        ..shader = RadialGradient(
          colors: const [_starGold, _starAmber],
          stops: const [0.3, 1.0],
        ).createShader(Rect.fromCircle(
          center: const Offset(cx, cy),
          radius: outer,
        )),
    );

    // Top-facet white sheen
    final sheenPath = Path()
      ..moveTo(cx, cy - outer)
      ..lineTo(cx + inner * math.cos(-math.pi / 4),
               cy + inner * math.sin(-math.pi / 4))
      ..lineTo(cx, cy - inner * 0.55)
      ..lineTo(cx - inner * math.cos(-math.pi / 4),
               cy + inner * math.sin(-math.pi / 4))
      ..close();

    canvas.drawPath(
      sheenPath,
      Paint()..color = Colors.white.withOpacity(0.40),
    );
  }

  @override
  bool shouldRepaint(_AppLogoPainter old) => old.showGlow != showGlow;
}
