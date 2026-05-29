import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/provenance_banner.dart';

// ── Pastel palette (used sparingly as accents) ──
const _pSky        = Color(0xFFA9C9E8);
const _pLavender   = Color(0xFFBFA8D9);
const _pSage       = Color(0xFFA8C9A8);
const _pPeach      = Color(0xFFF0A48C);
const _pSand       = Color(0xFFF5D79E);
const _pRose       = Color(0xFFF0B8A8);
const _pPeriwinkle = Color(0xFFB4C2E0);
const _pSeafoam    = Color(0xFF9FD4C0);

const _sectionPalette = <Color>[
  _pSky,
  _pLavender,
  _pSage,
  _pPeach,
  _pPeriwinkle,
  _pSeafoam,
  _pRose,
  _pSand,
];

Color _darken(Color color, [double amount = 0.18]) {
  final hsl = HSLColor.fromColor(color);
  final l = (hsl.lightness - amount).clamp(0.0, 1.0);
  final s = (hsl.saturation + amount * 0.35).clamp(0.0, 1.0);
  return hsl.withLightness(l).withSaturation(s).toColor();
}

// ── Reader theme modes (paper = cream sepia, night = dark, system = app theme) ──
enum _ReaderMode { system, paper, night }

class _ReaderPalette {
  final Color bg;
  final Color surface;
  final Color surfaceSoft;
  final Color primaryText;
  final Color secondaryText;
  final Color mutedText;
  final Color borderSoft;
  final Color heroBg;
  final bool isDark;
  const _ReaderPalette({
    required this.bg,
    required this.surface,
    required this.surfaceSoft,
    required this.primaryText,
    required this.secondaryText,
    required this.mutedText,
    required this.borderSoft,
    required this.heroBg,
    required this.isDark,
  });
}

// ── Parsed document structure ──
class _Section {
  final String heading;
  final List<String> lines;
  final Color accent;
  _Section(
      {required this.heading, required this.lines, required this.accent});
}

({String? intro, List<_Section> sections}) _parseDoc(String text) {
  final rawLines = text.split('\n');
  final intro = <String>[];
  final sections = <_Section>[];
  List<String>? cur;
  String? curHeading;
  int secIdx = 0;

  void flush() {
    final h = curHeading;
    if (h == null) return;
    sections.add(_Section(
      heading: h,
      lines: List.from(cur ?? const []),
      accent: _sectionPalette[secIdx % _sectionPalette.length],
    ));
    secIdx++;
  }

  for (final raw in rawLines) {
    final line = raw.trimRight();
    if (line.startsWith('## ')) {
      flush();
      curHeading = line.substring(3).trim();
      cur = <String>[];
    } else if (line.startsWith('# ') && curHeading == null && intro.isEmpty) {
      continue;
    } else {
      if (curHeading == null) {
        intro.add(line);
      } else {
        cur!.add(line);
      }
    }
  }
  flush();

  final introText = intro.join('\n').trim();
  return (
    intro: introText.isEmpty ? null : introText,
    sections: sections,
  );
}

class AiSummaryViewer extends StatefulWidget {
  final String title;
  final String content;
  /// Full material map — passed so the provenance banner can render at the top
  /// showing where the content came from (course / online / AI). Null = no banner.
  final Map<String, dynamic>? material;
  const AiSummaryViewer(
      {super.key, required this.title, required this.content, this.material});

  @override
  State<AiSummaryViewer> createState() => _AiSummaryViewerState();
}

class _AiSummaryViewerState extends State<AiSummaryViewer> {
  final ScrollController _scrollCtrl = ScrollController();
  bool _showBackToTop = false;
  double _readProgress = 0.0;
  double _fontScale = 1.0; // 0.9 / 1.0 / 1.15 / 1.3
  _ReaderMode _mode = _ReaderMode.system;
  bool _tocOpen = false;

  int get _wordCount => widget.content.trim().isEmpty
      ? 0
      : widget.content.trim().split(RegExp(r'\s+')).length;

  int get _readMinutes {
    if (_wordCount == 0) return 0;
    final m = (_wordCount / 200).ceil();
    return m < 1 ? 1 : m;
  }

  int get _minutesLeft {
    final remaining = (1.0 - _readProgress) * _readMinutes;
    final rounded = remaining.ceil();
    if (rounded < 0) return 0;
    if (rounded > _readMinutes) return _readMinutes;
    return rounded;
  }

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    final max = _scrollCtrl.position.maxScrollExtent;
    final pos = _scrollCtrl.position.pixels;
    final pct = max <= 0 ? 0.0 : (pos / max).clamp(0.0, 1.0);
    final showTop = pos > 260;
    if ((pct - _readProgress).abs() > 0.01 || showTop != _showBackToTop) {
      setState(() {
        _readProgress = pct;
        _showBackToTop = showTop;
      });
    }
  }

  void _backToTop() {
    HapticFeedback.lightImpact();
    _scrollCtrl.animateTo(0,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutCubic);
  }

  void _cycleFont() {
    HapticFeedback.selectionClick();
    setState(() {
      if (_fontScale == 0.9) {
        _fontScale = 1.0;
      } else if (_fontScale == 1.0) {
        _fontScale = 1.15;
      } else if (_fontScale == 1.15) {
        _fontScale = 1.3;
      } else {
        _fontScale = 0.9;
      }
    });
  }

  void _cycleMode() {
    HapticFeedback.selectionClick();
    setState(() {
      _mode = switch (_mode) {
        _ReaderMode.system => _ReaderMode.paper,
        _ReaderMode.paper => _ReaderMode.night,
        _ReaderMode.night => _ReaderMode.system,
      };
    });
  }

  IconData get _modeIcon => switch (_mode) {
        _ReaderMode.system => Icons.brightness_auto_rounded,
        _ReaderMode.paper => Icons.menu_book_rounded,
        _ReaderMode.night => Icons.nightlight_round,
      };

  String get _modeLabel => switch (_mode) {
        _ReaderMode.system => 'Auto',
        _ReaderMode.paper => 'Paper',
        _ReaderMode.night => 'Night',
      };

  _ReaderPalette _palette(AppColorScheme c) {
    switch (_mode) {
      case _ReaderMode.paper:
        return const _ReaderPalette(
          bg: Color(0xFFF6EEDA),
          surface: Color(0xFFFBF4E2),
          surfaceSoft: Color(0xFFEDE1C4),
          primaryText: Color(0xFF2B2720),
          secondaryText: Color(0xFF5A5247),
          mutedText: Color(0xFF8A7F6E),
          borderSoft: Color(0xFFE4D9BF),
          heroBg: Color(0xFFEDE1C4),
          isDark: false,
        );
      case _ReaderMode.night:
        return const _ReaderPalette(
          bg: Color(0xFF14161C),
          surface: Color(0xFF1D2028),
          surfaceSoft: Color(0xFF24272F),
          primaryText: Color(0xFFE8E4DC),
          secondaryText: Color(0xFFB0A99C),
          mutedText: Color(0xFF7A7366),
          borderSoft: Color(0xFF2B2E36),
          heroBg: Color(0xFF1D2028),
          isDark: true,
        );
      case _ReaderMode.system:
        return _ReaderPalette(
          bg: c.surface,
          surface: c.surfaceCard,
          surfaceSoft: c.surfaceElevated,
          primaryText: c.textPrimary,
          secondaryText: c.textSecondary,
          mutedText: c.textMuted,
          borderSoft: c.border,
          heroBg: c.surfaceCard,
          isDark: Theme.of(context).brightness == Brightness.dark,
        );
    }
  }

  Future<void> _copy() async {
    HapticFeedback.lightImpact();
    await Clipboard.setData(ClipboardData(text: widget.content));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle_rounded,
                  color: _darken(_pSage, 0.20), size: 18),
              const SizedBox(width: 8),
              const Text('Summary copied to clipboard'),
            ],
          ),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = _palette(c);
    final parsed = _parseDoc(widget.content);

    if (widget.content.trim().isEmpty) {
      return Scaffold(
        backgroundColor: p.bg,
        appBar: _buildAppBar(p),
        body: _emptyState(p),
      );
    }

    return Scaffold(
      backgroundColor: p.bg,
      appBar: _buildAppBar(p),
      body: Stack(
        children: [
          ListView(
            controller: _scrollCtrl,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(22, 4, 22, 120),
            children: [
              _buildHero(p),
              const SizedBox(height: 12),
              if (widget.material != null) ProvenanceBanner(material: widget.material!),
              const SizedBox(height: 6),
              if (parsed.sections.isNotEmpty) ...[
                _buildToc(parsed.sections, p),
                const SizedBox(height: 22),
              ],
              if (parsed.intro != null) ...[
                ..._renderLines(parsed.intro!.split('\n'), _pSky, p,
                    startsInSection: false),
                const SizedBox(height: 24),
              ],
              ...parsed.sections.asMap().entries.map(
                    (e) => _buildSection(e.value, p, isFirst: e.key == 0),
                  ),
              const SizedBox(height: 28),
              _buildFooter(p),
            ],
          ),
          // Floating back-to-top + minutes-left chip
          Positioned(
            right: 16,
            bottom: 20 + MediaQuery.of(context).padding.bottom,
            child: AnimatedSlide(
              offset: _showBackToTop ? Offset.zero : const Offset(0, 2),
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              child: AnimatedOpacity(
                opacity: _showBackToTop ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 200),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (_readProgress > 0.05 && _readProgress < 0.98)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: p.surface,
                          borderRadius: BorderRadius.circular(20),
                          border:
                              Border.all(color: p.borderSoft, width: 1),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.schedule_rounded,
                                size: 13, color: p.secondaryText),
                            const SizedBox(width: 5),
                            Text(
                              '$_minutesLeft min left',
                              style: TextStyle(
                                color: p.secondaryText,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    GestureDetector(
                      onTap: _backToTop,
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: p.surface,
                          borderRadius: BorderRadius.circular(16),
                          border:
                              Border.all(color: p.borderSoft, width: 1),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.12),
                              blurRadius: 14,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Icon(Icons.arrow_upward_rounded,
                            color: p.primaryText, size: 22),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── AppBar ──────────────────────────────────────────────
  PreferredSizeWidget _buildAppBar(_ReaderPalette p) {
    return AppBar(
      title: Text(widget.title,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 16,
            color: p.primaryText,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis),
      backgroundColor: p.bg,
      foregroundColor: p.primaryText,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      iconTheme: IconThemeData(color: p.primaryText),
      actions: [
        _appBarIcon(
          icon: _modeIcon,
          tooltip: 'Reading mode: $_modeLabel',
          onTap: _cycleMode,
          color: p.secondaryText,
        ),
        _appBarIcon(
          icon: Icons.format_size_rounded,
          tooltip: 'Text size',
          onTap: _cycleFont,
          color: p.secondaryText,
        ),
        _appBarIcon(
          icon: Icons.copy_rounded,
          tooltip: 'Copy summary',
          onTap: _copy,
          color: p.secondaryText,
          size: 20,
        ),
        const SizedBox(width: 4),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(3),
        child: SizedBox(
          height: 3,
          child: LinearProgressIndicator(
            value: _readProgress,
            minHeight: 3,
            backgroundColor: Colors.transparent,
            valueColor: AlwaysStoppedAnimation(_darken(_pSky, 0.12)),
          ),
        ),
      ),
    );
  }

  Widget _appBarIcon({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    required Color color,
    double size = 22,
  }) {
    return IconButton(
      icon: Icon(icon, color: color, size: size),
      tooltip: tooltip,
      onPressed: onTap,
    );
  }

  Widget _emptyState(_ReaderPalette p) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
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
                  colors: [_darken(_pSky, 0.06), _darken(_pSky, 0.22)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.article_rounded,
                  color: Colors.white, size: 36),
            ),
            const SizedBox(height: 16),
            Text('No summary content',
                style: TextStyle(
                    color: p.primaryText,
                    fontSize: 16,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('The generated summary appears to be empty.',
                style: TextStyle(color: p.secondaryText, fontSize: 13),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  // ── Hero header (compact, article-style) ────────────────
  Widget _buildHero(_ReaderPalette p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category label
        Row(
          children: [
            Container(
              width: 16,
              height: 2,
              decoration: BoxDecoration(
                color: _darken(_pSky, 0.20),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'AI SUMMARY',
              style: TextStyle(
                color: _darken(_pSky, 0.20),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Title
        Text(
          widget.title,
          style: TextStyle(
            color: p.primaryText,
            fontSize: 26,
            fontWeight: FontWeight.w800,
            height: 1.25,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 14),
        // Meta row
        Row(
          children: [
            Icon(Icons.schedule_rounded, size: 13, color: p.mutedText),
            const SizedBox(width: 4),
            Text(
              '$_readMinutes min read',
              style: TextStyle(
                color: p.mutedText,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 10),
              width: 3,
              height: 3,
              decoration: BoxDecoration(
                color: p.mutedText,
                shape: BoxShape.circle,
              ),
            ),
            Icon(Icons.description_rounded, size: 13, color: p.mutedText),
            const SizedBox(width: 4),
            Text(
              '$_wordCount words',
              style: TextStyle(
                color: p.mutedText,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Subtle divider
        Container(
          height: 1,
          color: p.borderSoft,
        ),
      ],
    );
  }

  // ── Table of contents (collapsible) ─────────────────────
  Widget _buildToc(List<_Section> sections, _ReaderPalette p) {
    return Container(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: p.borderSoft, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _tocOpen = !_tocOpen);
            },
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.list_alt_rounded,
                      color: p.secondaryText, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Contents',
                    style: TextStyle(
                      color: p.primaryText,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: p.surfaceSoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${sections.length}',
                      style: TextStyle(
                        color: p.secondaryText,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const Spacer(),
                  AnimatedRotation(
                    turns: _tocOpen ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.keyboard_arrow_down_rounded,
                        color: p.secondaryText, size: 20),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            crossFadeState: _tocOpen
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            duration: const Duration(milliseconds: 240),
            firstChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                children: sections.asMap().entries.map((e) {
                  final i = e.key;
                  final s = e.value;
                  return Padding(
                    padding: EdgeInsets.only(top: i == 0 ? 4 : 10),
                    child: Row(
                      children: [
                        Container(
                          width: 3,
                          height: 18,
                          decoration: BoxDecoration(
                            color: _darken(s.accent, 0.08),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '${i + 1}',
                          style: TextStyle(
                            color: p.mutedText,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                            fontFeatures: const [
                              FontFeature.tabularFigures()
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            s.heading,
                            style: TextStyle(
                              color: p.primaryText,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              height: 1.35,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
            secondChild: const SizedBox(
              width: double.infinity,
              height: 0,
            ),
          ),
        ],
      ),
    );
  }

  // ── Section block (article-style, no gradient pill) ─────
  Widget _buildSection(_Section s, _ReaderPalette p, {required bool isFirst}) {
    return Padding(
      padding: EdgeInsets.only(bottom: 26, top: isFirst ? 0 : 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Subtle accent bar + heading
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 3,
                height: 24 * _fontScale,
                decoration: BoxDecoration(
                  color: _darken(s.accent, 0.08),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  s.heading,
                  style: TextStyle(
                    color: p.primaryText,
                    fontSize: 20 * _fontScale,
                    fontWeight: FontWeight.w800,
                    height: 1.3,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Body lines — proper reading column
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children:
                _renderLines(s.lines, s.accent, p, startsInSection: true),
          ),
        ],
      ),
    );
  }

  // ── Render paragraph lines ──────────────────────────────
  List<Widget> _renderLines(List<String> lines, Color accent, _ReaderPalette p,
      {required bool startsInSection}) {
    final widgets = <Widget>[];

    for (int idx = 0; idx < lines.length; idx++) {
      final raw = lines[idx];
      final line = raw.trimRight();

      final callout = _detectCallout(line);
      if (callout != null) {
        widgets.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: _buildCallout(callout.$1, callout.$2, callout.$3, p),
        ));
        continue;
      }

      if (line.startsWith('### ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 6),
          child: Text(
            line.substring(4),
            style: TextStyle(
              color: p.primaryText,
              fontSize: 16 * _fontScale,
              fontWeight: FontWeight.w700,
              height: 1.35,
              letterSpacing: -0.1,
            ),
          ),
        ));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: EdgeInsets.only(
                    top: 11 * _fontScale, right: 12, left: 4),
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                  color: _darken(accent, 0.10),
                  shape: BoxShape.circle,
                ),
              ),
              Expanded(child: _richLine(line.substring(2), accent, p)),
            ],
          ),
        ));
      } else if (RegExp(r'^\d+\.\s').hasMatch(line)) {
        final match = RegExp(r'^(\d+)\.\s(.*)$').firstMatch(line);
        final num = match?.group(1) ?? '';
        final rest = match?.group(2) ?? '';
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 22,
                child: Text(
                  '$num.',
                  style: TextStyle(
                    color: _darken(accent, 0.15),
                    fontSize: 15 * _fontScale,
                    fontWeight: FontWeight.w800,
                    height: 1.75,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(child: _richLine(rest, accent, p)),
            ],
          ),
        ));
      } else if (line.startsWith('> ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: BoxDecoration(
              color: p.surfaceSoft,
              borderRadius: BorderRadius.circular(10),
              border: Border(
                left: BorderSide(color: _darken(accent, 0.08), width: 3),
              ),
            ),
            child: _richLine(line.substring(2), accent, p,
                italic: true, colorOverride: p.secondaryText),
          ),
        ));
      } else if (line.trim().isEmpty) {
        widgets.add(const SizedBox(height: 12));
      } else {
        widgets.add(Padding(
          padding: const EdgeInsets.only(top: 6),
          child: _richLine(line, accent, p),
        ));
      }
    }
    return widgets;
  }

  /// Renders a line with inline **bold** and `code` spans.
  Widget _richLine(String line, Color accent, _ReaderPalette p,
      {bool italic = false, Color? colorOverride}) {
    final spans = <InlineSpan>[];
    final base = TextStyle(
      color: colorOverride ?? p.primaryText,
      fontSize: 16 * _fontScale,
      height: 1.75,
      letterSpacing: 0.15,
      fontWeight: FontWeight.w400,
      fontStyle: italic ? FontStyle.italic : FontStyle.normal,
    );

    final pattern = RegExp(r'(\*\*[^*]+\*\*|`[^`]+`)');
    int last = 0;
    for (final match in pattern.allMatches(line)) {
      if (match.start > last) {
        spans.add(TextSpan(
            text: line.substring(last, match.start), style: base));
      }
      final token = match.group(0)!;
      if (token.startsWith('**')) {
        spans.add(TextSpan(
          text: token.substring(2, token.length - 2),
          style: base.copyWith(
            fontWeight: FontWeight.w800,
            color: p.primaryText,
          ),
        ));
      } else {
        spans.add(TextSpan(
          text: token.substring(1, token.length - 1),
          style: base.copyWith(
            fontFamily: 'monospace',
            fontSize: 14 * _fontScale,
            color: _darken(accent, 0.25),
            backgroundColor: accent.withOpacity(p.isDark ? 0.18 : 0.14),
          ),
        ));
      }
      last = match.end;
    }
    if (last < line.length) {
      spans.add(TextSpan(text: line.substring(last), style: base));
    }
    return Text.rich(TextSpan(children: spans));
  }

  // ── Callouts ────────────────────────────────────────────
  (Color, IconData, String)? _detectCallout(String line) {
    final trimmed = line.trim();
    final match = RegExp(
            r'^(Note|Tip|Important|Key|Warning|Remember|Example)\s*[:：]\s*(.*)$',
            caseSensitive: false)
        .firstMatch(trimmed);
    if (match == null) return null;
    final tag = match.group(1)!.toLowerCase();
    final body = match.group(2) ?? '';

    switch (tag) {
      case 'important':
      case 'warning':
        return (_pPeach, Icons.priority_high_rounded, body);
      case 'tip':
      case 'example':
        return (_pSage, Icons.lightbulb_rounded, body);
      case 'key':
      case 'remember':
        return (_pLavender, Icons.star_rounded, body);
      case 'note':
      default:
        return (_pSky, Icons.info_rounded, body);
    }
  }

  Widget _buildCallout(
      Color accent, IconData icon, String body, _ReaderPalette p) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: accent.withOpacity(p.isDark ? 0.14 : 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: _darken(accent, 0.08), width: 3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: _darken(accent, 0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: Colors.white, size: 15),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _richLine(body, accent, p),
          ),
        ],
      ),
    );
  }

  // ── Footer / end marker ────────────────────────────────
  Widget _buildFooter(_ReaderPalette p) {
    return Center(
      child: Column(
        children: [
          Container(
            width: 48,
            height: 2,
            decoration: BoxDecoration(
              color: p.borderSoft,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.auto_awesome_rounded,
                  color: p.mutedText, size: 13),
              const SizedBox(width: 6),
              Text(
                'End of summary',
                style: TextStyle(
                  color: p.mutedText,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
