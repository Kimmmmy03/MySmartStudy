import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Wraps the app and provides an expanding-circle reveal animation
/// when the theme switches between light and dark mode.
class ThemeSwitcher extends StatefulWidget {
  final Widget child;
  const ThemeSwitcher({super.key, required this.child});

  static ThemeSwitcherState of(BuildContext context) {
    return context.findAncestorStateOfType<ThemeSwitcherState>()!;
  }

  @override
  State<ThemeSwitcher> createState() => ThemeSwitcherState();
}

class ThemeSwitcherState extends State<ThemeSwitcher>
    with SingleTickerProviderStateMixin {
  final _boundaryKey = GlobalKey();
  ui.Image? _snapshot;
  Offset? _origin;
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
    _ctrl.addStatusListener((s) {
      if (s == AnimationStatus.completed) {
        setState(() {
          _snapshot?.dispose();
          _snapshot = null;
          _origin = null;
        });
        _ctrl.reset();
      }
    });
  }

  @override
  void dispose() {
    _snapshot?.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  /// Call this *before* toggling the theme. Pass the global tap position.
  Future<void> captureAndAnimate(Offset tapGlobal, VoidCallback toggleTheme) async {
    final boundary = _boundaryKey.currentContext?.findRenderObject()
        as RenderRepaintBoundary?;
    if (boundary == null) {
      toggleTheme();
      return;
    }
    try {
      final image = await boundary.toImage(pixelRatio: 1.0);
      _snapshot = image;
      _origin = tapGlobal;
      toggleTheme();
      setState(() {});
      _ctrl.forward();
    } catch (_) {
      toggleTheme();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Stack(
        children: [
          RepaintBoundary(
            key: _boundaryKey,
            child: widget.child,
          ),
          if (_snapshot != null && _origin != null)
            _SnapshotReveal(
              listenable: _anim,
              snapshot: _snapshot!,
              origin: _origin!,
            ),
        ],
      ),
    );
  }
}

class _SnapshotReveal extends AnimatedWidget {
  final ui.Image snapshot;
  final Offset origin;

  const _SnapshotReveal({
    required super.listenable,
    required this.snapshot,
    required this.origin,
  });

  @override
  Widget build(BuildContext context) {
    final animation = listenable as Animation<double>;
    final size = MediaQuery.of(context).size;
    // Max radius = distance from origin to farthest corner
    final maxRadius = _maxDistanceToCorner(origin, size);
    final currentRadius = maxRadius * animation.value;

    return Positioned.fill(
      child: ClipPath(
        clipper: _InvertedCircleClipper(origin, currentRadius),
        child: IgnorePointer(
          child: CustomPaint(
            painter: _SnapshotPainter(snapshot),
            size: size,
          ),
        ),
      ),
    );
  }

  static double _maxDistanceToCorner(Offset origin, Size size) {
    final corners = [
      Offset.zero,
      Offset(size.width, 0),
      Offset(0, size.height),
      Offset(size.width, size.height),
    ];
    double max = 0;
    for (final c in corners) {
      final d = (c - origin).distance;
      if (d > max) max = d;
    }
    return max;
  }
}

/// Clips to everything OUTSIDE the circle (old theme shows through the hole,
/// which is actually the new theme underneath).
class _InvertedCircleClipper extends CustomClipper<Path> {
  final Offset center;
  final double radius;
  _InvertedCircleClipper(this.center, this.radius);

  @override
  Path getClip(Size size) {
    return Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addOval(Rect.fromCircle(center: center, radius: radius))
      ..fillType = PathFillType.evenOdd;
  }

  @override
  bool shouldReclip(covariant _InvertedCircleClipper old) =>
      old.radius != radius || old.center != center;
}

class _SnapshotPainter extends CustomPainter {
  final ui.Image image;
  _SnapshotPainter(this.image);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawImage(image, Offset.zero, Paint());
  }

  @override
  bool shouldRepaint(covariant _SnapshotPainter old) => old.image != image;
}
