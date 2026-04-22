import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/register_screen.dart';
import 'screens/welcome_screen.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'utils/app_theme.dart';
import 'utils/app_theme_ext.dart';
import 'utils/auth_events.dart';
import 'utils/theme_provider.dart';
import 'utils/locale_provider.dart';
import 'widgets/animated_splash.dart';
import 'widgets/theme_switcher.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Make status bar fully transparent and default to light icons
  // (dark theme is the app default; AppBarTheme.systemOverlayStyle handles per-theme switching)
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  await Firebase.initializeApp();
  // Init notifications in background — don't block runApp
  NotificationService.instance.init().catchError((_) {});
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _themeProvider = ThemeProvider();
  final _localeProvider = LocaleProvider();

  @override
  void initState() {
    super.initState();
    _themeProvider.addListener(_rebuild);
    _localeProvider.addListener(_rebuild);
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _themeProvider.removeListener(_rebuild);
    _localeProvider.removeListener(_rebuild);
    _themeProvider.dispose();
    _localeProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ThemeScope(
      provider: _themeProvider,
      child: LocaleScope(
        provider: _localeProvider,
        child: ThemeSwitcher(
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'MySmartStudy',
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: _themeProvider.mode,
            locale: _localeProvider.locale,
            supportedLocales: const [Locale('en'), Locale('ms')],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: const AuthGate(),
          ),
        ),
      ),
    );
  }
}

/// Listens to Firebase auth state.
/// When user signs in, syncs profile with FastAPI backend before showing MainShell.
/// The splash overlay stays visible until the dashboard is fully loaded.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _synced = false;
  bool _syncing = false;
  String? _lastUid;

  /// True when the signed-in Firebase user has no backend profile
  /// (e.g. first-time Google user, or account deleted admin-side).
  /// The gate shows the googleMode register screen in this state.
  bool _needsRegistration = false;

  /// Controls splash overlay visibility: true = visible, fading or full.
  bool _showSplash = true;

  /// When true, the splash fades out. When animation ends, _showSplash → false.
  bool _fadingOut = false;

  /// Timestamp when the splash was first shown, used for minimum display time.
  DateTime? _splashShownAt;

  /// Whether the welcome/onboarding screen has been shown.
  bool? _hasSeenWelcome;

  /// Minimum time the splash stays visible so animations play out.
  static const _minSplashDuration = Duration(milliseconds: 500);

  /// Duration of the fade-out transition.
  static const _fadeOutDuration = Duration(milliseconds: 600);

  @override
  void initState() {
    super.initState();
    _checkWelcome();
    authProfileRefresh.addListener(_handleProfileRefresh);
  }

  @override
  void dispose() {
    authProfileRefresh.removeListener(_handleProfileRefresh);
    super.dispose();
  }

  /// Called when the register screen finishes creating a backend profile.
  /// Re-runs the profile check so the gate can transition to MainShell.
  void _handleProfileRefresh() {
    if (!mounted) return;
    setState(() {
      _synced = false;
      _syncing = false;
      _needsRegistration = false;
    });
  }

  Future<void> _checkWelcome() async {
    final seen = await WelcomeScreen.hasSeenWelcome();
    if (mounted) setState(() => _hasSeenWelcome = seen);
  }

  @override
  Widget build(BuildContext context) {
    // Still checking welcome state
    if (_hasSeenWelcome == null) {
      return _splashScreen(context);
    }

    // Show welcome screen on first launch
    if (_hasSeenWelcome == false) {
      return WelcomeScreen(
        onGetStarted: () {
          setState(() => _hasSeenWelcome = true);
        },
      );
    }

    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _splashScreen(context);
        }

        final user = snapshot.data;

        // Logged out
        if (user == null) {
          _synced = false;
          _syncing = false;
          _needsRegistration = false;
          _lastUid = null;
          _showSplash = true;
          _fadingOut = false;
          _splashShownAt = null;
          return const LoginScreen();
        }

        // New user detected (login/register just happened)
        if (_lastUid != user.uid) {
          _lastUid = user.uid;
          _synced = false;
          _syncing = false;
          _needsRegistration = false;
          _showSplash = true;
          _fadingOut = false;
          _splashShownAt = DateTime.now();
        }

        // Firebase user signed in but no backend profile — take them through
        // registration (googleMode: pick role + fill required details only).
        if (_needsRegistration) {
          return const RegisterScreen(googleMode: true);
        }

        // Need to check backend profile
        if (!_synced && !_syncing) {
          _syncing = true;
          _checkProfile(user);
          return _splashScreen(context);
        }

        // Currently checking — show only splash
        if (_syncing) {
          return _splashScreen(context);
        }

        // Synced — build MainShell underneath, overlay splash until dashboard ready
        return _buildWithSplashOverlay(context);
      },
    );
  }

  Widget _buildWithSplashOverlay(BuildContext context) {
    final colors = context.colors;
    return Stack(
      children: [
        MainShell(onReady: _onDashboardReady),
        if (_showSplash)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: _fadingOut,
              child: AnimatedOpacity(
                opacity: _fadingOut ? 0.0 : 1.0,
                duration: _fadeOutDuration,
                curve: Curves.easeInOut,
                onEnd: () {
                  if (_fadingOut && mounted) {
                    setState(() {
                      _showSplash = false;
                      _fadingOut = false;
                    });
                  }
                },
                child: Scaffold(
                  backgroundColor: colors.surface,
                  body: const AnimatedSplash(),
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _onDashboardReady() {
    if (!mounted || _fadingOut || !_showSplash) return;
    final elapsed = DateTime.now().difference(_splashShownAt ?? DateTime.now());
    final remaining = _minSplashDuration - elapsed;
    if (remaining > Duration.zero) {
      Future.delayed(remaining, _startFadeOut);
    } else {
      _startFadeOut();
    }
  }

  void _startFadeOut() {
    if (mounted && _showSplash && !_fadingOut) {
      setState(() => _fadingOut = true);
    }
  }

  /// Checks if the signed-in Firebase user has a backend profile.
  /// Retries up to 3× (800ms apart) to cover the brief window during which a
  /// just-completed /auth/sync call hasn't finished yet.
  ///
  /// - Profile found → MainShell.
  /// - Profile missing → googleMode register screen (lets new Google users
  ///   and admin-deleted users go through registration instead of silently
  ///   getting auto-created as default-role students).
  Future<void> _checkProfile(User user) async {
    bool profileFound = false;
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        await ApiService.getMe();
        profileFound = true;
        break;
      } catch (_) {
        if (attempt < 2) {
          await Future.delayed(const Duration(milliseconds: 800));
        }
      }
    }
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _syncing = false;
        if (profileFound) {
          _synced = true;
          _splashShownAt ??= DateTime.now();
          debugPrint("[AuthGate] Profile found for ${user.email}");
        } else {
          _needsRegistration = true;
          debugPrint("[AuthGate] No backend profile for ${user.email} — routing to register");
        }
      });
    });
  }

  Widget _splashScreen(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      backgroundColor: colors.surface,
      body: const AnimatedSplash(),
    );
  }
}
