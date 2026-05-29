import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/provenance_banner.dart';

const _pLavender    = Color(0xFFBFA8D9);
const _pSky         = Color(0xFFA9C9E8);
const _pSage        = Color(0xFFA8C9A8);
const _pPeach       = Color(0xFFF0A48C);
const _pSand        = Color(0xFFF5D79E);
const _pRose        = Color(0xFFF0B8A8);
const _pPeriwinkle  = Color(0xFFB4C2E0);
const _pSeafoam     = Color(0xFF9FD4C0);

// Front → Back pastel pairs, rotated by card index.
const _cardPalette = <({Color front, Color back})>[
  (front: _pLavender,   back: _pSky),
  (front: _pPeach,      back: _pSand),
  (front: _pSeafoam,    back: _pSage),
  (front: _pSky,        back: _pPeriwinkle),
  (front: _pRose,       back: _pSand),
  (front: _pPeriwinkle, back: _pLavender),
  (front: _pSage,       back: _pSeafoam),
  (front: _pSand,       back: _pPeach),
];

({Color front, Color back}) _paletteFor(int i) =>
    _cardPalette[i % _cardPalette.length];

Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

class AiFlashcardViewer extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> cards;
  /// Full material map — passed so the provenance banner can render at the top.
  final Map<String, dynamic>? material;
  const AiFlashcardViewer({super.key, required this.title, required this.cards, this.material});

  @override
  State<AiFlashcardViewer> createState() => _AiFlashcardViewerState();
}

class _AiFlashcardViewerState extends State<AiFlashcardViewer>
    with SingleTickerProviderStateMixin {
  late List<Map<String, dynamic>> _cards;
  final Set<int> _known = {};
  int _current = 0;
  bool _showBack = false;
  late AnimationController _flipController;
  late Animation<double> _flipAnimation;

  @override
  void initState() {
    super.initState();
    _cards = List.from(widget.cards);
    _flipController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 420));
    _flipAnimation = Tween<double>(begin: 0, end: 1).animate(
        CurvedAnimation(parent: _flipController, curve: Curves.easeInOutCubic));
  }

  @override
  void dispose() {
    _flipController.dispose();
    super.dispose();
  }

  void _flip() {
    HapticFeedback.lightImpact();
    if (_showBack) {
      _flipController.reverse();
    } else {
      _flipController.forward();
    }
    setState(() => _showBack = !_showBack);
  }

  void _next() {
    if (_current < _cards.length - 1) {
      HapticFeedback.selectionClick();
      _flipController.reset();
      setState(() {
        _current++;
        _showBack = false;
      });
    }
  }

  void _prev() {
    if (_current > 0) {
      HapticFeedback.selectionClick();
      _flipController.reset();
      setState(() {
        _current--;
        _showBack = false;
      });
    }
  }

  void _shuffle() {
    HapticFeedback.mediumImpact();
    _flipController.reset();
    setState(() {
      _cards.shuffle(Random());
      _current = 0;
      _showBack = false;
      _known.clear();
    });
  }

  void _toggleKnown() {
    HapticFeedback.mediumImpact();
    setState(() {
      if (_known.contains(_current)) {
        _known.remove(_current);
      } else {
        _known.add(_current);
        if (_current < _cards.length - 1) {
          Future.delayed(const Duration(milliseconds: 200), _next);
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final material = widget.material;

    if (_cards.isEmpty) {
      return Scaffold(
        backgroundColor: c.surface,
        appBar: AppBar(
          title: Text(widget.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          backgroundColor: Colors.transparent,
          foregroundColor: c.textPrimary,
          scrolledUnderElevation: 0,
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_darken(_pLavender, 0.06), _darken(_pLavender, 0.22)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.style_rounded, color: Colors.white, size: 36),
              ),
              const SizedBox(height: 16),
              Text('No flashcards to show',
                  style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      );
    }

    final card = _cards[_current];
    final front = card['front']?.toString() ?? '';
    final back = card['back']?.toString() ?? '';
    final knownCount = _known.length;
    final progress = (_current + 1) / _cards.length;
    final isKnown = _known.contains(_current);

    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: Text(widget.title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.shuffle_rounded,
                color: c.textSecondary, size: 20),
            onPressed: _shuffle,
            tooltip: 'Shuffle',
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        child: Column(
          children: [
            if (material != null) ProvenanceBanner(material: material),
            // Progress header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: _pLavender.withOpacity(0.16),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: _pLavender.withOpacity(0.45), width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.style_rounded,
                          size: 13, color: _darken(_pLavender, 0.25)),
                      const SizedBox(width: 5),
                      Text('${_current + 1} / ${_cards.length}',
                          style: TextStyle(
                              color: _darken(_pLavender, 0.25),
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const Spacer(),
                if (knownCount > 0)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _pSage.withOpacity(0.16),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: _pSage.withOpacity(0.45), width: 1),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_rounded,
                            size: 13, color: _darken(_pSage, 0.25)),
                        const SizedBox(width: 5),
                        Text('$knownCount known',
                            style: TextStyle(
                                color: _darken(_pSage, 0.25),
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress),
                duration: const Duration(milliseconds: 400),
                builder: (_, v, __) => LinearProgressIndicator(
                  value: v,
                  minHeight: 6,
                  backgroundColor: c.surfaceElevated,
                  valueColor: AlwaysStoppedAnimation(_darken(_pLavender, 0.12)),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Card
            Expanded(
              child: GestureDetector(
                onTap: _flip,
                onHorizontalDragEnd: (details) {
                  final v = details.primaryVelocity ?? 0;
                  if (v < -250) {
                    _next();
                  } else if (v > 250) {
                    _prev();
                  }
                },
                child: AnimatedBuilder(
                  animation: _flipAnimation,
                  builder: (_, __) {
                    final angle = _flipAnimation.value * pi;
                    final isFront = angle < pi / 2;
                    final palette = _paletteFor(_current);
                    return Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..setEntry(3, 2, 0.001)
                        ..rotateY(angle),
                      child: isFront
                          ? _buildCardFace(
                              front, 'QUESTION', palette.front, c,
                              isKnown: isKnown)
                          : Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()..rotateY(pi),
                              child: _buildCardFace(
                                  back, 'ANSWER', palette.back, c,
                                  isKnown: isKnown),
                            ),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _showBack
                  ? 'Tap to see question  •  Swipe to navigate'
                  : 'Tap to reveal answer  •  Swipe to navigate',
              style: TextStyle(color: c.textMuted, fontSize: 11.5),
            ),
            const SizedBox(height: 14),

            // Action row: prev / mark known / next
            Row(
              children: [
                _navBtn(
                  icon: Icons.arrow_back_rounded,
                  enabled: _current > 0,
                  onTap: _prev,
                  color: _pLavender,
                  c: c,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: GestureDetector(
                    onTap: _toggleKnown,
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: isKnown
                              ? [_darken(_pSage, 0.06), _darken(_pSage, 0.22)]
                              : [
                                  _darken(_pLavender, 0.06),
                                  _darken(_pLavender, 0.22),
                                ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: (isKnown
                                    ? _darken(_pSage, 0.18)
                                    : _darken(_pLavender, 0.18))
                                .withOpacity(0.55),
                            blurRadius: 14,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isKnown
                                ? Icons.check_circle_rounded
                                : Icons.psychology_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isKnown ? 'Marked as known' : 'I know this',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                _navBtn(
                  icon: Icons.arrow_forward_rounded,
                  enabled: _current < _cards.length - 1,
                  onTap: _next,
                  color: _pLavender,
                  c: c,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _navBtn({
    required IconData icon,
    required bool enabled,
    required VoidCallback onTap,
    required Color color,
    required dynamic c,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: enabled ? 1.0 : 0.35,
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withOpacity(0.14),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.45), width: 1),
          ),
          child: Icon(icon, color: _darken(color, 0.20), size: 22),
        ),
      ),
    );
  }

  Widget _buildCardFace(
    String text,
    String label,
    Color accent,
    dynamic c, {
    required bool isKnown,
  }) {
    // Real pastel card: saturated accent gradient fill + darker accent text/icon.
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent,
            accent.withOpacity(0.78),
            _darken(accent, 0.05),
          ],
          stops: const [0.0, 0.55, 1.0],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: Colors.white.withOpacity(0.35), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: _darken(accent, 0.15).withOpacity(0.45),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative soft blobs for visual interest
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.14),
              ),
            ),
          ),
          Positioned(
            bottom: -30,
            left: -20,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.08),
              ),
            ),
          ),
          // Known indicator
          if (isKnown)
            Positioned(
              top: 14,
              right: 14,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Icon(Icons.check_circle_rounded,
                    color: _darken(_pSage, 0.20), size: 16),
              ),
            ),
          // Content
          Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 5,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        label,
                        style: TextStyle(
                          color: _darken(accent, 0.30),
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Center(
                  child: SingleChildScrollView(
                    child: Text(
                      text,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: _darken(accent, 0.48),
                        fontSize: 20,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.1,
                        shadows: [
                          Shadow(
                            color: Colors.white.withOpacity(0.35),
                            blurRadius: 6,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const Spacer(),
                Center(
                  child: Icon(
                    Icons.touch_app_rounded,
                    color: _darken(accent, 0.35).withOpacity(0.55),
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AnimatedBuilder extends AnimatedWidget {
  final Widget Function(BuildContext, Widget?) builder;
  const AnimatedBuilder(
      {super.key, required Animation<double> animation, required this.builder})
      : super(listenable: animation);
  @override
  Widget build(BuildContext context) => builder(context, null);
}
