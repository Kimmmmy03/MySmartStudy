import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/app_background.dart';
import '../widgets/floating_nav_bar.dart';
import '../services/api_service.dart';
import '../utils/companion_prefs.dart';
import 'ai_companion_screen.dart';
import 'home_screen.dart';
import 'subjects_screen.dart';
import 'lecturer_class_management_screen.dart';
import 'calendar_planner_screen.dart';
import 'mind_maps_screen.dart';
import 'review_maps_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  final VoidCallback? onReady;

  const MainShell({super.key, this.onReady});
  @override
  State<MainShell> createState() => MainShellState();
}

class MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _currentIndex = 0;
  // Pages are built lazily on first visit to avoid startup cost
  final Map<int, Widget> _builtPages = {};
  String _role = '';
  bool _companionEnabled = true;
  int _unreadNotifications = 0;

  Timer? _heartbeatTimer;
  bool _appForeground = true;

  // Key on the home screen so other tabs (e.g. Profile after avatar upload)
  // can imperatively refresh its banner without rebuilding the whole shell.
  final GlobalKey<HomeScreenState> _homeKey = GlobalKey<HomeScreenState>();

  Widget _getPage(int index) {
    return _builtPages.putIfAbsent(index, () {
      switch (index) {
        case 0: return HomeScreen(key: _homeKey, onLoaded: widget.onReady);
        case 1: return _role == 'lecturer'
            ? const LecturerClassManagementScreen()
            : const SubjectsScreen();
        case 2: return const CalendarPlannerScreen();
        case 3: return _role == 'lecturer'
            ? const ReviewMapsScreen()
            : const MindMapsScreen();
        case 4: return const ProfileScreen();
        default: return const SizedBox.shrink();
      }
    });
  }

  /// Ask the home tab to re-fetch the user profile.
  /// Used by Profile after an avatar upload so the home banner avatar updates.
  void refreshHomeProfile() {
    _homeKey.currentState?.refreshProfile();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Pre-build only the home screen at startup
    _getPage(0);
    _loadRole();
    _startHeartbeat();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _heartbeatTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appForeground = state == AppLifecycleState.resumed;
    if (_appForeground) _sendHeartbeat();
  }

  String _currentFeature() {
    switch (_currentIndex) {
      case 0: return 'dashboard';
      case 1: return 'courses';
      case 2: return 'planner';
      case 3: return 'maps';
      case 4: return 'profile';
      default: return 'other';
    }
  }

  void _sendHeartbeat() {
    if (!_appForeground) return;
    ApiService.activityHeartbeat(_currentFeature());
  }

  void _startHeartbeat() {
    // Fire one immediately so short sessions still register
    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (_) => _sendHeartbeat());
  }

  Future<void> _loadRole() async {
    try {
      final results = await Future.wait([
        ApiService.getMe(),
        CompanionPrefs.isEnabled(),
      ]);
      if (mounted) {
        setState(() {
          _role             = (results[0] as Map)['role']?.toString() ?? '';
          _companionEnabled = results[1] as bool;
          // Invalidate the Courses tab cache so it rebuilds with the correct
          // screen (SubjectsScreen vs LecturerClassManagementScreen) now that
          // the role has resolved.
          _builtPages.remove(1);
          // Same for Maps tab (MindMapsScreen vs ReviewMapsScreen).
          _builtPages.remove(3);
        });
      }
      _loadUnreadCount();
    } catch (_) {}
  }

  Future<void> _loadUnreadCount() async {
    try {
      final notifications = await ApiService.getNotifications();
      final unread = notifications.where((n) {
        final map = Map<String, dynamic>.from(n);
        return map['read'] != true && map['is_read'] != true;
      }).length;
      if (mounted) setState(() => _unreadNotifications = unread);
    } catch (_) {}
  }

  void setCompanionEnabled(bool value) {
    CompanionPrefs.setEnabled(value);
    if (mounted) setState(() => _companionEnabled = value);
  }

  // ── SmartBuddy notch helpers ──────────────────────────────────────────────

  /// True when the centre-notch SmartBuddy button should be shown.
  bool get _notchMode => _role == 'student' && _companionEnabled;

  // ── Notch page↔visual index maps ─────────────────────────────────────────
  //
  // Notch nav tabs (visual):  0=Home  1=Schedule  [buddy]  2=Courses  3=Profile
  // Shell pages:              0=Home  1=Courses   2=Schedule  3=Maps  4=Profile
  //
  // Maps (page 3) is not in the notch nav — accessed via Home → My Maps.

  static const List<int> _notchVisualToPage = [0, 2, 1, 4];

  int _pageToNotchVisual(int page) {
    switch (page) {
      case 0: return 0; // Home
      case 1: return 2; // Courses
      case 2: return 1; // Schedule
      case 4: return 3; // Profile
      default: return 0; // Maps / anything else → Home highlight
    }
  }

  int get _navIndex => _notchMode
      ? _pageToNotchVisual(_currentIndex)
      : _currentIndex;

  void _onNavTap(int visualIndex) {
    HapticFeedback.selectionClick();
    final page = _notchMode ? _notchVisualToPage[visualIndex] : visualIndex;
    if (page == _currentIndex) return;

    // Sync hook — keeps tab data fresh when the user returns to a tab.
    //
    // Each tab page is built once via `_builtPages` and kept alive (so tab
    // switches feel instant), but that same caching means a tab's data
    // ages indefinitely. If the user creates a mind map on web, switches
    // to mobile, and taps the Maps tab, MindMapsScreen.initState already
    // ran on app launch and the new map never shows up.
    //
    // Strategy:
    //   • Home (index 0): heavy state (news pager, animations) — call its
    //     public refresh() instead of rebuilding.
    //   • Other tabs: drop the cached entry so initState runs on next
    //     build and data is re-fetched. Cheap because their state is just
    //     scroll position + a fetched list.
    if (page == 0) {
      _homeKey.currentState?.refresh();
    } else {
      _builtPages.remove(page);
    }

    setState(() => _currentIndex = page);
  }

  /// Opens the AI companion screen with an expand-upward reveal animation.
  void _openSmartBuddy() {
    HapticFeedback.mediumImpact();
    Navigator.push(context, _SmartBuddyRoute());
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return AppBackground(
      applySafeArea: false,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        extendBody: true,
        body: Stack(
          children: List.generate(
            5,
            (i) {
              if (!_builtPages.containsKey(i) && i != _currentIndex) {
                return const SizedBox.shrink();
              }
              return AnimatedOpacity(
                opacity:  i == _currentIndex ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 250),
                curve:    Curves.easeOutCubic,
                child: IgnorePointer(
                  ignoring: i != _currentIndex,
                  child:    _getPage(i),
                ),
              );
            },
          ),
        ),
        bottomNavigationBar: FloatingNavBar(
          currentIndex: _navIndex,
          onTap:        _onNavTap,
          onSmartBuddy: _notchMode ? _openSmartBuddy : null,
          isLecturer:   _role == 'lecturer',
        ),
      ),
    );
  }
}

// ── SmartBuddy reveal route ───────────────────────────────────────────────────
//
// A circular clip-reveal that grows from the SmartBuddy notch button and
// fills the screen. The origin sits at the horizontal centre, just above the
// floating nav bar where the button lives. The circle expands to cover the
// screen diagonal, then the body fades in over the last half of the transition.

class _SmartBuddyRoute extends PageRouteBuilder<void> {
  _SmartBuddyRoute()
      : super(
          opaque: false,
          barrierColor: Colors.transparent,
          pageBuilder: (context, animation, secondaryAnimation) =>
              const AiCompanionScreen(),
          transitionDuration:        const Duration(milliseconds: 520),
          reverseTransitionDuration: const Duration(milliseconds: 380),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final mq = MediaQuery.of(context);
            // Centre of the SmartBuddy button, in screen coordinates.
            // ~72px above the bottom of the visible area covers the button
            // regardless of device insets.
            final origin = Offset(
              mq.size.width / 2,
              mq.size.height - mq.viewPadding.bottom - 72,
            );
            final curved = CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
              reverseCurve: Curves.easeInCubic,
            );
            return AnimatedBuilder(
              animation: curved,
              builder: (ctx, _) {
                return ClipPath(
                  clipper: _CircleRevealClipper(
                    centre: origin,
                    fraction: curved.value,
                  ),
                  child: child,
                );
              },
            );
          },
        );
}

class _CircleRevealClipper extends CustomClipper<Path> {
  final Offset centre;
  final double fraction;
  const _CircleRevealClipper({required this.centre, required this.fraction});

  @override
  Path getClip(Size size) {
    // Max distance from centre to the furthest corner = fully covers the screen.
    final dx = math.max(centre.dx, size.width - centre.dx);
    final dy = math.max(centre.dy, size.height - centre.dy);
    final maxRadius = math.sqrt(dx * dx + dy * dy);
    final r = maxRadius * fraction;
    return Path()..addOval(Rect.fromCircle(center: centre, radius: r));
  }

  @override
  bool shouldReclip(_CircleRevealClipper old) =>
      old.fraction != fraction || old.centre != centre;
}
