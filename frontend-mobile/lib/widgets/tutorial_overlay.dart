import 'package:flutter/material.dart';
import '../utils/app_theme.dart';
import '../l10n/app_strings.dart';

class TutorialStep {
  final GlobalKey? targetKey;
  final String title;
  final String description;
  final IconData icon;

  const TutorialStep({
    this.targetKey,
    required this.title,
    required this.description,
    required this.icon,
  });
}

class TutorialOverlay extends StatefulWidget {
  final List<TutorialStep> steps;
  final VoidCallback onComplete;

  const TutorialOverlay({
    super.key,
    required this.steps,
    required this.onComplete,
  });

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay>
    with SingleTickerProviderStateMixin {
  int _current = 0;
  late final AnimationController _ctrl;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _next() {
    if (_current < widget.steps.length - 1) {
      _ctrl.reverse().then((_) {
        setState(() => _current++);
        _ctrl.forward();
      });
    } else {
      _ctrl.reverse().then((_) => widget.onComplete());
    }
  }

  void _skip() {
    _ctrl.reverse().then((_) => widget.onComplete());
  }

  Rect? _getTargetRect() {
    final key = widget.steps[_current].targetKey;
    if (key == null) return null;
    final box = key.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return null;
    final pos = box.localToGlobal(Offset.zero);
    return pos & box.size;
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final step = widget.steps[_current];
    final isLast = _current == widget.steps.length - 1;
    final targetRect = _getTargetRect();

    return Material(
      color: Colors.transparent,
      child: FadeTransition(
        opacity: _fade,
        child: Stack(
          children: [
            // Dark overlay with spotlight hole
            Positioned.fill(
              child: CustomPaint(
                painter: _SpotlightPainter(targetRect: targetRect),
              ),
            ),
            // Tap overlay to advance
            Positioned.fill(
              child: GestureDetector(
                onTap: _next,
                behavior: HitTestBehavior.translucent,
              ),
            ),
            // Tooltip card — only ONE branch renders at a time to avoid duplication.
            if (targetRect != null)
              Positioned(
                left: 24,
                right: 24,
                bottom: targetRect.top > MediaQuery.of(context).size.height * 0.5
                    ? MediaQuery.of(context).size.height - targetRect.top + 24
                    : null,
                top: targetRect.top <= MediaQuery.of(context).size.height * 0.5
                    ? targetRect.bottom + 24
                    : null,
                child: _tooltipCard(step, isLast, s),
              )
            else
              Center(child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: _tooltipCard(step, isLast, s),
              )),
            // Skip button
            Positioned(
              top: MediaQuery.of(context).padding.top + 12,
              right: 16,
              child: TextButton(
                onPressed: _skip,
                child: Text(s.skip, style: const TextStyle(color: Colors.white70, fontSize: 14)),
              ),
            ),
            // Step indicator dots
            Positioned(
              bottom: MediaQuery.of(context).padding.bottom + 30,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(widget.steps.length, (i) => Container(
                  width: i == _current ? 24 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    color: i == _current ? AppTheme.accentBlue : Colors.white30,
                    borderRadius: BorderRadius.circular(4),
                  ),
                )),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tooltipCard(TutorialStep step, bool isLast, S s) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.accentBlue.withOpacity(0.3)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.accentBlue.withOpacity(0.1),
            blurRadius: 24,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.accentBlue.withOpacity(0.2), AppTheme.accentPurple.withOpacity(0.2)],
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(step.icon, color: AppTheme.accentBlue, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            step.title,
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            step.description,
            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14, height: 1.4),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _next,
              style: AppTheme.gradientButtonStyle(),
              child: Text(isLast ? s.getStarted : s.next),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpotlightPainter extends CustomPainter {
  final Rect? targetRect;
  _SpotlightPainter({this.targetRect});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black.withOpacity(0.75);
    final path = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    if (targetRect != null) {
      final spotlight = RRect.fromRectAndRadius(
        targetRect!.inflate(8),
        const Radius.circular(12),
      );
      path.addRRect(spotlight);
      path.fillType = PathFillType.evenOdd;
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter old) =>
      old.targetRect != targetRect;
}
