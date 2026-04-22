import 'package:flutter/material.dart';

/// Semantic color tokens for dark and light themes.
class AppColorScheme {
  final Color surface;
  final Color surfaceCard;
  final Color surfaceInput;
  final Color surfaceElevated;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color border;
  final Color divider;

  const AppColorScheme({
    required this.surface,
    required this.surfaceCard,
    required this.surfaceInput,
    required this.surfaceElevated,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.divider,
  });
}

class AppColors {
  // ── Dark scheme — matches web's dark-900 through dark-100 ──
  static const dark = AppColorScheme(
    surface: Color(0xFF080c1a),       // dark-900
    surfaceCard: Color(0xFF0e1429),   // dark-800
    surfaceInput: Color(0xFF151d38),  // dark-700
    surfaceElevated: Color(0xFF1c2648), // dark-600
    textPrimary: Color(0xFFb8bdd4),   // dark-100
    textSecondary: Color(0xFF8a92b2), // dark-200
    textMuted: Color(0xFF5c6590),     // dark-300
    border: Color(0x14FFFFFF),        // white/8
    divider: Color(0xFF1c2648),
  );

  // ── Light scheme — matches web's light mode ──
  static const light = AppColorScheme(
    surface: Color(0xFFF4F6FB),
    surfaceCard: Colors.white,
    surfaceInput: Color(0xFFF0F0F5),
    surfaceElevated: Color(0xFFE8E8F0),
    textPrimary: Color(0xFF1a1a2e),
    textSecondary: Color(0xFF5A5A7A),
    textMuted: Color(0xFF9A9AB0),
    border: Color(0x14000000),
    divider: Color(0xFFE0E0EA),
  );

  // ── IPG Brand palette (matches web's accent-blue/purple/cyan) ──
  static const Color ipgNavy  = Color(0xFF1B2A80);
  static const Color ipgRoyal = Color(0xFF2E4DA7);
  static const Color ipgSky   = Color(0xFF5B9BD5);
  static const Color ipgLight = Color(0xFF7BB3E0);

  // ── Accent palette ──
  static const Color blue = Color(0xFF3B82F6);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color cyan = Color(0xFF06B6D4);
  static const Color pink = Color(0xFFEC4899);
  static const Color emerald = Color(0xFF10B981);
  static const Color amber = Color(0xFFF59E0B);
  static const Color red = Color(0xFFEF4444);
  static const Color indigo = Color(0xFF6366F1);
  static const Color teal = Color(0xFF14B8A6);
  static const Color orange = Color(0xFFF97316);

  // ── Grade palette ──
  static const Color gradeA = emerald;
  static const Color gradeB = blue;
  static const Color gradeC = amber;
  static const Color gradeF = red;

  // ── Priority palette ──
  static const Color priorityHigh = red;
  static const Color priorityMedium = amber;
  static const Color priorityLow = emerald;

  // ── Status palette ──
  static const Color statusSuccess = emerald;
  static const Color statusWarning = amber;
  static const Color statusError = red;
  static const Color statusInfo = blue;

  // ── Role gradients ──
  static const LinearGradient studentGradient = LinearGradient(
    colors: [blue, cyan],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient lecturerGradient = LinearGradient(
    colors: [purple, pink],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient adminGradient = LinearGradient(
    colors: [amber, orange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static LinearGradient gradientForRole(String role) {
    switch (role) {
      case 'lecturer':
        return lecturerGradient;
      case 'admin':
        return adminGradient;
      default:
        return studentGradient;
    }
  }

  static Color accentForRole(String role) {
    switch (role) {
      case 'lecturer':
        return purple;
      case 'admin':
        return amber;
      default:
        return blue;
    }
  }
}
