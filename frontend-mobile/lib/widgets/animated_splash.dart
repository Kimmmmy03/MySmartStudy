import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import 'fade_slide_in.dart';

/// Polished branded splash shown while the dashboard is loading.
///
/// Layout (top → bottom):
///   • Breathing gradient background (slowly rotating colors)
///   • AnimatedAppLogo inside a dual-arc loading ring
///   • "MySmartStudy" name in gradient
///   • "IPG Smart Learning Platform" tagline
///   • "Preparing your workspace…" status
///   • Daily motivational quote card
class AnimatedSplash extends StatefulWidget {
  const AnimatedSplash({super.key});

  @override
  State<AnimatedSplash> createState() => _AnimatedSplashState();
}

class _AnimatedSplashState extends State<AnimatedSplash>
    with TickerProviderStateMixin {
  /// 10 s cycle — drives background gradient shift + logo pulse
  late final AnimationController _bgCtrl;

  /// 2 s cycle — drives the dual-arc loading ring rotation
  late final AnimationController _ringCtrl;

  // ── Motivational quotes (rotated by day-of-year) ──────────────────────────
  static const _quotes = [
    'The expert in anything was once a beginner.',
    'Small steps every day lead to big results.',
    'Your mind is a garden — tend it well.',
    'Learning is a treasure that follows its owner everywhere.',
    'Don\'t watch the clock; do what it does — keep going.',
    'Success is the sum of small efforts repeated daily.',
    'The beautiful thing about learning is that no one can take it away.',
    'A little progress each day adds up to big results.',
    'Believe you can and you\'re halfway there.',
    'Start where you are. Use what you have. Do what you can.',
    'Every accomplishment starts with the decision to try.',
    'It always seems impossible until it\'s done.',
    'Push yourself, because no one else is going to do it for you.',
    'Great things never come from comfort zones.',
    'Dream big. Start small. Act now.',
    'You don\'t have to be great to start, but you have to start to be great.',
    'Focus on progress, not perfection.',
    'The secret of getting ahead is getting started.',
  ];

  String get _todayQuote {
    final dayOfYear = DateTime.now().difference(DateTime(DateTime.now().year)).inDays;
    return _quotes[dayOfYear % _quotes.length];
  }

  // ── Layout constants ───────────────────────────────────────────────────────
  static const double _logoSize    = 180;
  static const double _ringPadding = 18;
  static const double _totalSize   = _logoSize + _ringPadding * 2;

  @override
  void initState() {
    super.initState();
    _bgCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();
  }

  @override
  void dispose() {
    _bgCtrl.dispose();
    _ringCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark  = context.isDark;

    return Stack(
      children: [
        // ── Breathing gradient background ──────────────────────────────────
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _bgCtrl,
            builder: (_, __) => CustomPaint(
              painter: _BreathingGradientPainter(t: _bgCtrl.value, isDark: isDark),
            ),
          ),
        ),

        // ── Main content ───────────────────────────────────────────────────
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Logo inside dual-arc ring ──────────────────────────────
                FadeSlideIn(
                  child: SizedBox(
                    width: _totalSize,
                    height: _totalSize,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Gradient loading ring
                        Positioned.fill(
                          child: AnimatedBuilder(
                            animation: _ringCtrl,
                            builder: (_, __) => CustomPaint(
                              painter: _LoadingRingPainter(
                                t: _ringCtrl.value,
                                isDark: isDark,
                              ),
                            ),
                          ),
                        ),
                        // Lottie welcome animation
                        Lottie.asset(
                          'assets/welcome.json',
                          width: _logoSize,
                          height: _logoSize,
                          fit: BoxFit.contain,
                          repeat: true,
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 28),

                // ── App name ───────────────────────────────────────────────
                FadeSlideIn(
                  delay: const Duration(milliseconds: 200),
                  child: ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (bounds) =>
                        AppTheme.studentGradient.createShader(bounds),
                    child: const Text(
                      'MySmartStudy',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 6),

                // ── IPG tagline ────────────────────────────────────────────
                FadeSlideIn(
                  delay: const Duration(milliseconds: 280),
                  child: Text(
                    'IPG Smart Learning Platform',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.8,
                      color: colors.textSecondary,
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                // ── Loading status ─────────────────────────────────────────
                FadeSlideIn(
                  delay: const Duration(milliseconds: 340),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 10,
                        height: 10,
                        child: AnimatedBuilder(
                          animation: _ringCtrl,
                          builder: (_, __) => CircularProgressIndicator(
                            strokeWidth: 1.8,
                            value: null,
                            color: AppTheme.accentBlue.withOpacity(0.6),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Preparing your workspace…',
                        style: TextStyle(
                          fontSize: 12,
                          color: colors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 28),

                // ── Daily motivational quote ───────────────────────────────
                FadeSlideIn(
                  delay: const Duration(milliseconds: 500),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: (isDark ? Colors.white : Colors.black)
                          .withOpacity(isDark ? 0.05 : 0.03),
                      border: Border.all(
                        color: (isDark ? Colors.white : Colors.black)
                            .withOpacity(0.07),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Icon(
                            Icons.format_quote_rounded,
                            color: AppTheme.accentBlue.withOpacity(0.55),
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Text(
                            _todayQuote,
                            textAlign: TextAlign.start,
                            style: TextStyle(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: colors.textSecondary,
                              height: 1.55,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual-arc gradient loading ring
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingRingPainter extends CustomPainter {
  final double t;
  final bool isDark;

  const _LoadingRingPainter({required this.t, required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 3;

    // Background ring
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0
        ..color = (isDark ? Colors.white : Colors.black)
            .withOpacity(isDark ? 0.07 : 0.05),
    );

    // Primary arc — blue → cyan, clockwise
    _drawArc(
      canvas: canvas,
      center: center,
      radius: radius,
      startAngle: t * 2 * math.pi,
      sweepAngle: math.pi * 0.8,
      strokeWidth: 3.2,
      colors: [AppTheme.accentBlue, AppTheme.accentCyan],
      alpha: isDark ? 0.88 : 0.72,
    );

    // Secondary arc — purple → pink, counter-clockwise with pulse
    final pulse = 0.5 + 0.5 * math.sin(t * 2 * math.pi);
    _drawArc(
      canvas: canvas,
      center: center,
      radius: radius,
      startAngle: -(t * 1.6 * 2 * math.pi),
      sweepAngle: math.pi * 0.55,
      strokeWidth: 2.0,
      colors: [AppTheme.accentPurple, AppTheme.accentPink],
      alpha: (isDark ? 0.4 : 0.3) + 0.3 * pulse,
    );

    // Glowing leading dot on primary arc
    final dotAngle = t * 2 * math.pi + math.pi * 0.8;
    final dotPos = Offset(
      center.dx + radius * math.cos(dotAngle),
      center.dy + radius * math.sin(dotAngle),
    );

    canvas.drawCircle(
      dotPos,
      9,
      Paint()
        ..shader = RadialGradient(colors: [
          AppTheme.accentCyan.withOpacity(isDark ? 0.38 : 0.24),
          AppTheme.accentCyan.withOpacity(0),
        ]).createShader(Rect.fromCircle(center: dotPos, radius: 9)),
    );
    canvas.drawCircle(
      dotPos,
      3,
      Paint()..color = AppTheme.accentCyan.withOpacity(isDark ? 0.95 : 0.8),
    );
  }

  void _drawArc({
    required Canvas canvas,
    required Offset center,
    required double radius,
    required double startAngle,
    required double sweepAngle,
    required double strokeWidth,
    required List<Color> colors,
    required double alpha,
  }) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    canvas.drawArc(
      rect,
      startAngle,
      sweepAngle,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          startAngle: startAngle,
          endAngle: startAngle + sweepAngle,
          colors: [
            colors.first.withOpacity(0),
            colors.first.withOpacity(alpha),
            colors.last.withOpacity(alpha),
            colors.last.withOpacity(0),
          ],
          stops: const [0.0, 0.15, 0.85, 1.0],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_LoadingRingPainter old) => old.t != t || old.isDark != isDark;
}

// ─────────────────────────────────────────────────────────────────────────────
// Breathing gradient background
// ─────────────────────────────────────────────────────────────────────────────

class _BreathingGradientPainter extends CustomPainter {
  final double t;
  final bool isDark;

  const _BreathingGradientPainter({required this.t, required this.isDark});

  static const _darkPalettes = [
    [Color(0xFF0A0A1A), Color(0xFF0D1030), Color(0xFF0A1828)],
    [Color(0xFF0A0A1A), Color(0xFF120A28), Color(0xFF1A0A20)],
    [Color(0xFF0A0A1A), Color(0xFF0A1828), Color(0xFF081820)],
  ];

  static const _lightPalettes = [
    [Color(0xFFF0F4FF), Color(0xFFE8ECFA), Color(0xFFE0F0F8)],
    [Color(0xFFF2F0FF), Color(0xFFF0E8FA), Color(0xFFEDE0F8)],
    [Color(0xFFEEF8FF), Color(0xFFE0F4F8), Color(0xFFE8F0F0)],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final angle = t * 2 * math.pi;
    final begin = Alignment(math.cos(angle), math.sin(angle));
    final end   = Alignment(-math.cos(angle), -math.sin(angle));

    final palettes = isDark ? _darkPalettes : _lightPalettes;
    final cyclePos = t * palettes.length;
    final idx  = cyclePos.floor() % palettes.length;
    final next = (idx + 1) % palettes.length;
    final lerpT = cyclePos - cyclePos.floor();

    final colors = List.generate(
      3,
      (i) => Color.lerp(palettes[idx][i], palettes[next][i], lerpT)!,
    );

    final breath = 1.0 + 0.02 * math.sin(t * 2 * math.pi);
    final rect   = Rect.fromLTWH(0, 0, size.width, size.height);
    final scaled = Rect.fromCenter(
      center: rect.center,
      width:  rect.width  * breath,
      height: rect.height * breath,
    );

    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: begin,
          end: end,
          colors: colors,
          stops: const [0.0, 0.5, 1.0],
        ).createShader(scaled),
    );
  }

  @override
  bool shouldRepaint(_BreathingGradientPainter old) =>
      old.t != t || old.isDark != isDark;
}
