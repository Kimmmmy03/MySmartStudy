import 'dart:ui';
import 'package:flutter/material.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../l10n/app_strings.dart';
import 'rive_nav_icon.dart';

// ── Constants ────────────────────────────────────────────────────────────────

const double _kBarHeight     = 68.0;
const double _kCornerRadius  = 28.0;
const double _kNotchDiameter = 72.0; // notch width at the top opening
const double _kNotchDepth    = 30.0; // how far down the cutout goes into the bar
const double _kBuddySize     = 56.0; // SmartBuddy circle diameter
const double _kBuddySink     = 8.0;  // how many px the button sits inside the notch

/// A floating, pill-shaped bottom navigation bar with glassmorphism effect.
///
/// **Regular mode** (lecturers / SmartBuddy disabled):
/// Five evenly-spaced tabs — Home, Courses, Schedule, Maps, Profile.
///
/// **Notch mode** (students with SmartBuddy enabled):
/// The pill gets a smooth bezier cutout at the top-centre; a raised gradient
/// SmartBuddy button sits inside that notch. Four tabs flank it: two on each
/// side — [Home, Schedule | 🧠 | Courses, Profile].
///
/// Active tab: coloured icon + label. Inactive tab: muted icon, no label.
class FloatingNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  /// When non-null the bar enters notch mode and this fires when the centre
  /// SmartBuddy button is tapped.
  final VoidCallback? onSmartBuddy;

  /// When true, the Courses tab is labelled "Class Management" (lecturer side).
  final bool isLecturer;

  /// Total height occupied by the floating nav bar (bar + bottom margin).
  static const double kNavBarHeight  = _kBarHeight;
  static const double kBottomMargin  = 12;
  static const double kTotalHeight   = kNavBarHeight + kBottomMargin + 16; // 96

  const FloatingNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.onSmartBuddy,
    this.isLecturer = false,
  });

  // ── Tab item lists ────────────────────────────────────────────────────────

  static List<_NavItem> _regularItems(S s, {bool isLecturer = false}) => [
    _NavItem(icon: Icons.home_rounded,           activeIcon: Icons.home_rounded,          label: s.navHome,     artboard: 'Home'),
    _NavItem(icon: Icons.school_rounded,         activeIcon: Icons.school_rounded,        label: isLecturer ? s.navClassManagement : s.navCourses,  artboard: 'Courses'),
    _NavItem(icon: Icons.event_note_rounded,     activeIcon: Icons.event_note_rounded,    label: s.navSchedule, artboard: 'Planner'),
    _NavItem(icon: Icons.account_tree_rounded,   activeIcon: Icons.account_tree_rounded,  label: isLecturer ? s.navReviewMaps : s.navMaps, artboard: 'Maps'),
    _NavItem(icon: Icons.person_rounded,         activeIcon: Icons.person_rounded,        label: s.navProfile,  artboard: 'Profile'),
  ];

  // Notch layout: [Home, Schedule] | notch | [Courses, Profile]
  static List<_NavItem> _notchItems(S s, {bool isLecturer = false}) => [
    _NavItem(icon: Icons.home_rounded,           activeIcon: Icons.home_rounded,          label: s.navHome,     artboard: 'Home'),
    _NavItem(icon: Icons.event_note_rounded,     activeIcon: Icons.event_note_rounded,    label: s.navSchedule, artboard: 'Planner'),
    _NavItem(icon: Icons.school_rounded,         activeIcon: Icons.school_rounded,        label: isLecturer ? s.navClassManagement : s.navCourses,  artboard: 'Courses'),
    _NavItem(icon: Icons.person_rounded,         activeIcon: Icons.person_rounded,        label: s.navProfile,  artboard: 'Profile'),
  ];

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final colors  = context.colors;
    final isDark  = context.isDark;
    final s       = S.of(context);
    final isNotch = onSmartBuddy != null;
    final items   = isNotch
        ? _notchItems(s, isLecturer: isLecturer)
        : _regularItems(s, isLecturer: isLecturer);

    final bgColor = isDark
        ? const Color(0xFF0A192F).withValues(alpha: 0.70)
        : Colors.white.withValues(alpha: 0.82);

    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.18)
        : Colors.black.withValues(alpha: 0.10);

    Widget bar;

    if (isNotch) {
      // ── Notch pill ──────────────────────────────────────────────────────
      final clipper = _NotchClipper();

      final glassContent = ClipPath(
        clipper: clipper,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: Container(
            height: _kBarHeight,
            decoration: BoxDecoration(color: bgColor),
            child: Padding(
              // Shift content down so icons aren't hidden behind the notch cutout
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  // Left side — Home, Schedule
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(2, (i) => _NavBarItem(
                        item:          items[i],
                        selected:      i == currentIndex,
                        activeColor:   AppTheme.accentBlue,
                        inactiveColor: colors.textMuted,
                        onTap:         () => onTap(i),
                      )),
                    ),
                  ),
                  // Centre gap for the SmartBuddy notch
                  const SizedBox(width: _kNotchDiameter + 8),
                  // Right side — Courses, Profile
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(2, (j) => _NavBarItem(
                        item:          items[j + 2],
                        selected:      (j + 2) == currentIndex,
                        activeColor:   AppTheme.accentBlue,
                        inactiveColor: colors.textMuted,
                        onTap:         () => onTap(j + 2),
                      )),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      // Draw the pill shape + notch border + shadow via CustomPaint behind the glass
      final painter = CustomPaint(
        painter: _NotchPainter(
          bgColor:     bgColor,
          borderColor: borderColor,
          isDark:      isDark,
        ),
        child: glassContent,
      );

      // Stack: pill + SmartBuddy button floating in the notch
      bar = SizedBox(
        height: _kBarHeight + (_kBuddySize / 2 - _kBuddySink),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Sit the pill at the bottom of the SizedBox
            Positioned(
              bottom: 0,
              left:   0,
              right:  0,
              child:  painter,
            ),
            // SmartBuddy centred, rising above the pill
            Positioned(
              top:  0,
              left: 0,
              right: 0,
              child: Center(
                child: _SmartBuddyButton(onTap: onSmartBuddy!),
              ),
            ),
          ],
        ),
      );
    } else {
      // ── Regular flat pill (no notch) ─────────────────────────────────────
      bar = ClipRRect(
        borderRadius: BorderRadius.circular(_kCornerRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Container(
            height: _kBarHeight,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(_kCornerRadius),
              border: Border.all(color: borderColor, width: 1.2),
              boxShadow: [
                // Primary lift shadow
                BoxShadow(
                  color:        Colors.black.withValues(alpha: isDark ? 0.55 : 0.18),
                  blurRadius:   32,
                  offset:       const Offset(0, 12),
                  spreadRadius: -2,
                ),
                // Soft ambient fill
                BoxShadow(
                  color:        Colors.black.withValues(alpha: isDark ? 0.28 : 0.08),
                  blurRadius:   12,
                  offset:       const Offset(0, 4),
                  spreadRadius: 0,
                ),
                // Top edge highlight (dark mode only)
                if (isDark)
                  BoxShadow(
                    color:        Colors.white.withValues(alpha: 0.04),
                    blurRadius:   0,
                    offset:       const Offset(0, -1),
                    spreadRadius: 0,
                  ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(items.length, (i) => _NavBarItem(
                item:          items[i],
                selected:      i == currentIndex,
                activeColor:   AppTheme.accentBlue,
                inactiveColor: colors.textMuted,
                onTap:         () => onTap(i),
              )),
            ),
          ),
        ),
      );
    }

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
        child: bar,
      ),
    );
  }
}

// ── Notch shape path helper ────────────────────────────────────────────────────

Path _buildNotchPath(Size size) {
  final w   = size.width;
  final h   = size.height;
  final r   = _kCornerRadius;
  final cx  = w / 2;
  final nr  = _kNotchDiameter / 2; // half-width of notch opening
  final nd  = _kNotchDepth;        // depth
  // Bezier control-point offset — higher = smoother shoulder curve
  const cp = 18.0;

  final path = Path()
    // Start just after top-left corner
    ..moveTo(r, 0)
    // Top edge to the notch left shoulder
    ..lineTo(cx - nr - cp, 0)
    // Left shoulder curve INTO the notch (cubic bezier)
    ..cubicTo(
      cx - nr + cp * 0.2, 0,   // ctrl 1 — hug the edge
      cx - nr * 0.4,     nd,   // ctrl 2 — pull into depth
      cx,                nd,   // end at notch bottom-centre
    )
    // Right shoulder curve OUT of the notch
    ..cubicTo(
      cx + nr * 0.4,     nd,   // ctrl 1
      cx + nr - cp * 0.2, 0,   // ctrl 2
      cx + nr + cp,      0,    // end — back to top edge
    )
    // Top edge to top-right corner
    ..lineTo(w - r, 0)
    // Top-right rounded corner
    ..arcToPoint(Offset(w, r), radius: Radius.circular(r))
    // Right edge
    ..lineTo(w, h - r)
    // Bottom-right rounded corner
    ..arcToPoint(Offset(w - r, h), radius: Radius.circular(r))
    // Bottom edge
    ..lineTo(r, h)
    // Bottom-left rounded corner
    ..arcToPoint(Offset(0, h - r), radius: Radius.circular(r))
    // Left edge
    ..lineTo(0, r)
    // Top-left rounded corner
    ..arcToPoint(Offset(r, 0), radius: Radius.circular(r))
    ..close();

  return path;
}

// ── CustomClipper for ClipPath ────────────────────────────────────────────────

class _NotchClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) => _buildNotchPath(size);

  @override
  bool shouldReclip(_NotchClipper old) => false;
}

// ── CustomPainter for shadow + border ────────────────────────────────────────

class _NotchPainter extends CustomPainter {
  final Color bgColor;
  final Color borderColor;
  final bool  isDark;

  const _NotchPainter({
    required this.bgColor,
    required this.borderColor,
    required this.isDark,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final path = _buildNotchPath(size);

    // Wide soft ambient shadow (bottom layer)
    canvas.drawShadow(
      path,
      Colors.black.withValues(alpha: isDark ? 0.32 : 0.10),
      isDark ? 28 : 18,
      true,
    );
    // Tight primary lift shadow (top layer, stronger)
    canvas.drawShadow(
      path,
      Colors.black.withValues(alpha: isDark ? 0.55 : 0.18),
      isDark ? 12 : 8,
      true,
    );

    // Border
    canvas.drawPath(
      path,
      Paint()
        ..color       = borderColor
        ..style       = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );
  }

  @override
  bool shouldRepaint(_NotchPainter old) =>
      old.bgColor != bgColor || old.borderColor != borderColor || old.isDark != isDark;
}

// ── Data ─────────────────────────────────────────────────────────────────────

class _NavItem {
  final IconData icon;        // inactive (outline) icon
  final IconData activeIcon;  // active (filled) icon
  final String   label;
  final String   artboard;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.artboard,
  });
}

// ── Tab item widget ───────────────────────────────────────────────────────────

class _NavBarItem extends StatelessWidget {
  final _NavItem     item;
  final bool         selected;
  final Color        activeColor;
  final Color        inactiveColor;
  final VoidCallback onTap;

  const _NavBarItem({
    required this.item,
    required this.selected,
    required this.activeColor,
    required this.inactiveColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 60,
        child: Column(
          mainAxisSize:     MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve:    Curves.easeOutCubic,
              padding:  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: selected
                    ? activeColor.withValues(alpha: 0.14)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: RiveNavIcon(
                artboardName:    item.artboard,
                fallbackIcon:    selected ? item.activeIcon : item.icon,
                selected:        selected,
                size:            22,
                selectedColor:   activeColor,
                unselectedColor: inactiveColor,
              ),
            ),
            // Show label only when selected — animates in/out
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve:    Curves.easeOutCubic,
              child: selected
                  ? Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        item.label,
                        maxLines:  1,
                        overflow:  TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color:      activeColor,
                          fontSize:   10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Elevated SmartBuddy centre button ────────────────────────────────────────

class _SmartBuddyButton extends StatefulWidget {
  final VoidCallback onTap;
  const _SmartBuddyButton({required this.onTap});

  @override
  State<_SmartBuddyButton> createState() => _SmartBuddyButtonState();
}

class _SmartBuddyButtonState extends State<_SmartBuddyButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double>   _scale;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _scale = Tween<double>(begin: 1.0, end: 1.07).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          width:  _kBuddySize,
          height: _kBuddySize,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end:   Alignment.bottomRight,
              colors: [AppColors.blue, AppColors.indigo],
            ),
            boxShadow: [
              BoxShadow(
                color:        AppColors.blue.withValues(alpha: 0.45),
                blurRadius:   18,
                spreadRadius: 0,
                offset:       const Offset(0, 4),
              ),
              BoxShadow(
                color:        AppColors.indigo.withValues(alpha: 0.20),
                blurRadius:   8,
                spreadRadius: -2,
              ),
            ],
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.30),
              width: 1.5,
            ),
          ),
          child: Center(
            child: Image.asset(
              'assets/images/ai-brain-logo.png',
              width: 48,
              height: 48,
            ),
          ),
        ),
      ),
    );
  }
}
