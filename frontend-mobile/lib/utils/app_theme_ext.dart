import 'package:flutter/material.dart';
import 'app_colors.dart';

/// ThemeExtension that carries semantic color tokens on the ThemeData.
class AppThemeExt extends ThemeExtension<AppThemeExt> {
  final AppColorScheme colors;

  const AppThemeExt(this.colors);

  @override
  AppThemeExt copyWith({AppColorScheme? colors}) =>
      AppThemeExt(colors ?? this.colors);

  @override
  AppThemeExt lerp(covariant AppThemeExt? other, double t) {
    if (other == null) return this;
    return AppThemeExt(AppColorScheme(
      surface: Color.lerp(colors.surface, other.colors.surface, t)!,
      surfaceCard: Color.lerp(colors.surfaceCard, other.colors.surfaceCard, t)!,
      surfaceInput:
          Color.lerp(colors.surfaceInput, other.colors.surfaceInput, t)!,
      surfaceElevated:
          Color.lerp(colors.surfaceElevated, other.colors.surfaceElevated, t)!,
      textPrimary:
          Color.lerp(colors.textPrimary, other.colors.textPrimary, t)!,
      textSecondary:
          Color.lerp(colors.textSecondary, other.colors.textSecondary, t)!,
      textMuted: Color.lerp(colors.textMuted, other.colors.textMuted, t)!,
      border: Color.lerp(colors.border, other.colors.border, t)!,
      divider: Color.lerp(colors.divider, other.colors.divider, t)!,
    ));
  }
}

/// Convenient context accessors.
extension AppThemeX on BuildContext {
  AppColorScheme get colors =>
      Theme.of(this).extension<AppThemeExt>()!.colors;

  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}
