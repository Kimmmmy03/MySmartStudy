import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';
import 'app_theme_ext.dart';

/// Dark glassmorphism theme matching the web frontend, with light mode support.
class AppTheme {
  // -- Core dark palette — matches web's CSS custom properties --
  static const Color dark900 = Color(0xFF080c1a);
  static const Color dark800 = Color(0xFF0e1429);
  static const Color dark700 = Color(0xFF151d38);
  static const Color dark600 = Color(0xFF1c2648);
  static const Color dark500 = Color(0xFF253058);
  static const Color dark400 = Color(0xFF3a4570);
  static const Color dark300 = Color(0xFF5c6590);
  static const Color dark200 = Color(0xFF8a92b2);
  static const Color dark100 = Color(0xFFb8bdd4);

  // -- Accent colors (delegate to AppColors) --
  static const Color accentBlue = AppColors.blue;
  static const Color accentPurple = AppColors.purple;
  static const Color accentCyan = AppColors.cyan;
  static const Color accentPink = AppColors.pink;
  static const Color accentEmerald = AppColors.emerald;
  static const Color accentAmber = AppColors.amber;

  // -- Grade colors --
  static const Color gradeA = AppColors.gradeA;
  static const Color gradeB = AppColors.gradeB;
  static const Color gradeC = AppColors.gradeC;
  static const Color gradeF = AppColors.gradeF;

  static Color gradeColor(BuildContext context, double? grade) {
    if (grade == null) return context.colors.textMuted;
    if (grade >= 80) return gradeA;
    if (grade >= 60) return gradeB;
    if (grade >= 50) return gradeC;
    return gradeF;
  }

  // -- Student / Lecturer / Admin gradients --
  static const LinearGradient studentGradient = AppColors.studentGradient;
  static const LinearGradient lecturerGradient = AppColors.lecturerGradient;
  static const LinearGradient adminGradient = AppColors.adminGradient;

  static LinearGradient gradientForRole(String role) =>
      AppColors.gradientForRole(role);

  static Color accentForRole(String role) => AppColors.accentForRole(role);

  // -- Glass / Card decoration (context-aware) --
  static BoxDecoration glassCard(
    BuildContext context, {
    double borderRadius = 16,
    Color? borderColor,
  }) {
    final isDark = context.isDark;
    if (isDark) {
      return BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: borderColor ?? Colors.white.withOpacity(0.08)),
      );
    }
    return BoxDecoration(
      color: Colors.white.withOpacity(0.65),
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(color: borderColor ?? Colors.black.withOpacity(0.06)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.06),
          blurRadius: 16,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  static BoxDecoration glassInput(BuildContext context) {
    final isDark = context.isDark;
    return BoxDecoration(
      color: isDark ? Colors.white.withOpacity(0.05) : Colors.white.withOpacity(0.8),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: isDark ? Colors.white.withOpacity(0.10) : Colors.black.withOpacity(0.08)),
    );
  }

  // -- Elevated glass (for modals/sheets) --
  static BoxDecoration glassElevated(BuildContext context, {double borderRadius = 20}) {
    final c = context.colors;
    final isDark = context.isDark;
    return BoxDecoration(
      color: isDark ? c.surfaceElevated.withOpacity(0.9) : c.surfaceCard,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(color: c.border),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(isDark ? 0.3 : 0.08),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ],
    );
  }

  // -- Input decoration (context-aware) --
  static InputDecoration inputDecoration(
    BuildContext context, {
    required String label,
    IconData? prefixIcon,
    Widget? suffix,
    String? hintText,
  }) {
    final c = context.colors;
    return InputDecoration(
      labelText: label,
      hintText: hintText,
      labelStyle: TextStyle(color: c.textSecondary, fontSize: 14),
      hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
      prefixIcon: prefixIcon != null
          ? Icon(prefixIcon, color: c.textMuted, size: 20)
          : null,
      suffix: suffix,
      filled: true,
      fillColor: c.surfaceInput,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.blue, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.red, width: 1),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.red, width: 1.5),
      ),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  // -- Button styles --
  static ButtonStyle gradientButtonStyle({String role = 'student', bool isLecturer = false}) {
    final effectiveRole = isLecturer ? 'lecturer' : role;
    return ElevatedButton.styleFrom(
      backgroundColor: AppColors.accentForRole(effectiveRole),
      foregroundColor: Colors.white,
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    );
  }

  static ButtonStyle outlinedButtonStyle(BuildContext context) {
    final c = context.colors;
    return OutlinedButton.styleFrom(
      foregroundColor: c.textPrimary,
      side: BorderSide(color: c.border),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
    );
  }

  static ButtonStyle dangerButtonStyle() {
    return ElevatedButton.styleFrom(
      backgroundColor: AppColors.red,
      foregroundColor: Colors.white,
      elevation: 0,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
    );
  }

  // -- Inter text theme --
  static TextTheme _interTextTheme(Brightness brightness) {
    const base = TextTheme(
      headlineLarge: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: -0.5),
      headlineMedium: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: -0.3),
      headlineSmall: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      titleLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
      titleSmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
      bodyLarge: TextStyle(fontSize: 15, height: 1.5),
      bodyMedium: TextStyle(fontSize: 13, height: 1.4),
      bodySmall: TextStyle(fontSize: 12, height: 1.4),
      labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: 0.5),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
      labelSmall: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.5),
    );
    // Use system sans-serif — avoids Google Fonts network download on startup
    return base;
  }

  // -- Dark ThemeData --
  static ThemeData get darkTheme {
    final txt = _interTextTheme(Brightness.dark);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: dark900,
      extensions: const [AppThemeExt(AppColors.dark)],
      colorScheme: ColorScheme.dark(
        surface: dark900,
        primary: accentBlue,
        secondary: accentPurple,
        tertiary: accentCyan,
        error: AppColors.red,
        onSurface: dark100,
      ),
      cardColor: dark700,
      dividerColor: Colors.white.withOpacity(0.08),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light, // white icons on dark bg
          statusBarBrightness: Brightness.dark,       // iOS
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
        ),
        titleTextStyle: txt.titleLarge?.copyWith(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: dark800,
        selectedItemColor: accentBlue,
        unselectedItemColor: dark200,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: accentBlue,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: dark600,
        selectedColor: accentBlue.withOpacity(0.3),
        labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: dark700,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: dark700,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: dark600,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: Colors.white,
        unselectedLabelColor: dark200,
        indicatorColor: accentBlue,
        dividerColor: Colors.transparent,
      ),
      textTheme: txt.apply(
        bodyColor: Colors.white,
        displayColor: Colors.white,
      ),
    );
  }

  // -- Light ThemeData --
  static ThemeData get lightTheme {
    const lc = AppColors.light;
    final txt = _interTextTheme(Brightness.light);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: lc.surface,
      extensions: const [AppThemeExt(AppColors.light)],
      colorScheme: ColorScheme.light(
        surface: lc.surface,
        primary: accentBlue,
        secondary: accentPurple,
        tertiary: accentCyan,
        error: AppColors.red,
        onSurface: lc.textPrimary,
      ),
      cardColor: lc.surfaceCard,
      dividerColor: lc.divider,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,  // dark icons on light bg
          statusBarBrightness: Brightness.light,      // iOS
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
        titleTextStyle: txt.titleLarge?.copyWith(
          color: lc.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
        iconTheme: IconThemeData(color: lc.textPrimary),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: lc.surfaceCard,
        selectedItemColor: accentBlue,
        unselectedItemColor: lc.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: accentBlue,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: lc.surfaceElevated,
        selectedColor: accentBlue.withOpacity(0.15),
        labelStyle: TextStyle(color: lc.textPrimary, fontSize: 12),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: lc.border),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: lc.surfaceCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: lc.surfaceCard,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: lc.textPrimary,
        contentTextStyle: TextStyle(color: lc.surfaceCard),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: lc.textPrimary,
        unselectedLabelColor: lc.textMuted,
        indicatorColor: accentBlue,
        dividerColor: Colors.transparent,
      ),
      textTheme: txt.apply(
        bodyColor: lc.textPrimary,
        displayColor: lc.textPrimary,
      ),
    );
  }
}
