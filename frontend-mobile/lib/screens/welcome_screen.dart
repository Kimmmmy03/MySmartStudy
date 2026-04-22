import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/fade_slide_in.dart';

/// Welcome / onboarding screen shown on first app launch.
/// Shows a greeting with a "Get Started" button that navigates to login.
class WelcomeScreen extends StatefulWidget {
  final VoidCallback onGetStarted;
  const WelcomeScreen({super.key, required this.onGetStarted});

  /// Check if the user has seen the welcome screen before.
  static Future<bool> hasSeenWelcome() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('mss_seen_welcome') ?? false;
  }

  /// Mark the welcome screen as seen.
  static Future<void> markSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('mss_seen_welcome', true);
  }

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _bgCtrl;
  int _currentPage = 0;
  final _pageCtrl = PageController();

  static const _pages = [
    _PageData(
      icon: Icons.school_rounded,
      title: 'Welcome to MySmartStudy',
      subtitle:
          'Your all-in-one smart learning companion. Study smarter, not harder.',
      gradient: [AppTheme.accentBlue, AppTheme.accentCyan],
    ),
    _PageData(
      icon: Icons.auto_awesome_rounded,
      title: 'AI-Powered Learning',
      subtitle:
          'Meet SmartBuddy — your personal AI tutor that adapts to your learning style.',
      gradient: [AppTheme.accentPurple, AppTheme.accentPink],
    ),
    _PageData(
      icon: Icons.hub_rounded,
      title: 'Mind Maps & More',
      subtitle:
          'Create beautiful mind maps, track your progress, and collaborate with peers.',
      gradient: [AppTheme.accentCyan, AppTheme.accentEmerald],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _bgCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 15),
    )..repeat();
  }

  @override
  void dispose() {
    _bgCtrl.dispose();
    _pageCtrl.dispose();
    super.dispose();
  }

  void _onGetStarted() {
    WelcomeScreen.markSeen();
    widget.onGetStarted();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = context.isDark;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: colors.surface,
      body: Stack(
        children: [
          // Animated gradient background
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _bgCtrl,
              builder: (context, _) {
                return Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: isDark
                          ? [
                              const Color(0xFF0A0A1A),
                              Color.lerp(
                                const Color(0xFF0D1030),
                                const Color(0xFF120A28),
                                _bgCtrl.value,
                              )!,
                              const Color(0xFF0A1828),
                            ]
                          : [
                              const Color(0xFFF0F4FF),
                              Color.lerp(
                                const Color(0xFFE8ECFA),
                                const Color(0xFFF2F0FF),
                                _bgCtrl.value,
                              )!,
                              const Color(0xFFE0F0F8),
                            ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Content
          SafeArea(
            child: Column(
              children: [
                // Skip button
                Align(
                  alignment: Alignment.topRight,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: TextButton(
                      onPressed: _onGetStarted,
                      child: Text(
                        'Skip',
                        style: TextStyle(
                          color: colors.textMuted,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ),
                ),

                // Page View
                Expanded(
                  child: PageView.builder(
                    controller: _pageCtrl,
                    onPageChanged: (i) => setState(() => _currentPage = i),
                    itemCount: _pages.length,
                    itemBuilder: (context, index) {
                      final page = _pages[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Icon with gradient circle
                            FadeSlideIn(
                              child: Container(
                                width: 120,
                                height: 120,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    colors: [
                                      page.gradient[0].withValues(alpha: 0.2),
                                      page.gradient[1].withValues(alpha: 0.1),
                                    ],
                                  ),
                                  border: Border.all(
                                    color: page.gradient[0].withValues(alpha: 0.3),
                                    width: 2,
                                  ),
                                ),
                                child: Icon(
                                  page.icon,
                                  size: 50,
                                  color: page.gradient[0],
                                ),
                              ),
                            ),
                            const SizedBox(height: 40),

                            // Title
                            FadeSlideIn(
                              delay: const Duration(milliseconds: 200),
                              child: Text(
                                page.title,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  foreground: Paint()
                                    ..shader = LinearGradient(
                                      colors: page.gradient,
                                    ).createShader(
                                      Rect.fromLTWH(0, 0, size.width * 0.7, 30),
                                    ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Subtitle
                            FadeSlideIn(
                              delay: const Duration(milliseconds: 400),
                              child: Text(
                                page.subtitle,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 15,
                                  color: colors.textSecondary,
                                  height: 1.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                // Page indicators
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      final isActive = i == _currentPage;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: isActive ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          color: isActive
                              ? _pages[_currentPage].gradient[0]
                              : (isDark ? Colors.white : Colors.black)
                                  .withValues(alpha: 0.15),
                        ),
                      );
                    }),
                  ),
                ),

                // Get Started button
                Padding(
                  padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
                  child: SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            _pages[_currentPage].gradient[0],
                            _pages[_currentPage].gradient[1],
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: _pages[_currentPage]
                                .gradient[0]
                                .withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _currentPage == _pages.length - 1
                            ? _onGetStarted
                            : () {
                                _pageCtrl.nextPage(
                                  duration: const Duration(milliseconds: 400),
                                  curve: Curves.easeInOut,
                                );
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: Text(
                          _currentPage == _pages.length - 1
                              ? 'Get Started'
                              : 'Next',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
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

class _PageData {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> gradient;

  const _PageData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
  });
}
