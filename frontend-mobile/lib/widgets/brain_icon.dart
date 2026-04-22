import 'package:flutter/material.dart';

/// Custom-painted brain logo for SmartBuddy / AI Companion.
///
/// Shape: front-facing brain — two full rounded hemispheres joined at the
/// bottom with a narrow centre groove, matching the reference icon style.
class BrainIcon extends StatelessWidget {
  final double size;
  final Color color;

  const BrainIcon({super.key, required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _BrainPainter(color: color)),
    );
  }
}

class _BrainPainter extends CustomPainter {
  final Color color;
  const _BrainPainter({required this.color});

  // Virtual 100×100 canvas — everything is scaled to actual size at paint time.
  static const double _vc = 100;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / _vc, size.height / _vc);

    // saveLayer lets BlendMode.clear punch transparent holes through the fill.
    canvas.saveLayer(const Rect.fromLTWH(0, 0, _vc, _vc), Paint());

    final fill = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // ── Unified brain outline ────────────────────────────────────────────
    // Front-facing view: two rounded lobes that taper and join at the bottom.
    // The top has a shallow V-notch between the hemispheres.
    //
    //       ( L )( R )        ← two rounded tops
    //      (       )          ← wide middle
    //       (     )           ← taper
    //         ( )             ← joined bottom / brainstem nub
    //
    canvas.drawPath(
      Path()
        // Start at top of LEFT lobe (just left of centre groove)
        ..moveTo(50, 16)
        // Sweep left lobe top
        ..cubicTo(44, 6, 20, 4,  8, 22)
        // Down the left side
        ..cubicTo(0, 36,  0, 60, 10, 74)
        // Bottom-left arc toward centre
        ..cubicTo(18, 84, 34, 90, 46, 87)
        // Brainstem / bottom nub
        ..cubicTo(48, 92, 52, 92, 54, 87)
        // Bottom-right arc from centre
        ..cubicTo(66, 90, 82, 84, 90, 74)
        // Up the right side
        ..cubicTo(100, 60, 100, 36, 92, 22)
        // Sweep right lobe top back to centre
        ..cubicTo(80, 4, 56, 6, 50, 16)
        ..close(),
      fill,
    );

    // ── Centre groove (teardrop cut from top, fades ~55% down) ──────────
    final cut = Paint()
      ..blendMode = BlendMode.clear
      ..style = PaintingStyle.fill;

    canvas.drawPath(
      Path()
        ..moveTo(50, 16)               // top tip of groove
        ..cubicTo(47, 24, 46, 38, 47, 55)  // left wall
        ..cubicTo(47, 58, 53, 58, 53, 55)  // rounded bottom
        ..cubicTo(54, 38, 53, 24, 50, 16)  // right wall
        ..close(),
      cut,
    );

    // ── Sulci — cut curved fold-lines into each hemisphere ───────────────
    final sulcus = Paint()
      ..blendMode = BlendMode.clear
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 4.5;

    // Left hemisphere — 3 arching grooves
    for (final p in [
      // Upper arc (near top of lobe)
      Path()..moveTo(12, 26)..cubicTo(20, 14, 34, 14, 42, 24),
      // Middle arc
      Path()..moveTo( 6, 50)..cubicTo(16, 38, 32, 38, 40, 50),
      // Lower arc
      Path()..moveTo(12, 72)..cubicTo(22, 62, 34, 62, 40, 72),
    ]) {
      canvas.drawPath(p, sulcus);
    }

    // Right hemisphere — mirror of the left (x′ = 100 − x)
    for (final p in [
      Path()..moveTo(88, 26)..cubicTo(80, 14, 66, 14, 58, 24),
      Path()..moveTo(94, 50)..cubicTo(84, 38, 68, 38, 60, 50),
      Path()..moveTo(88, 72)..cubicTo(78, 62, 66, 62, 60, 72),
    ]) {
      canvas.drawPath(p, sulcus);
    }

    canvas.restore(); // pop saveLayer
    canvas.restore(); // pop scale
  }

  @override
  bool shouldRepaint(covariant _BrainPainter old) => old.color != color;
}
