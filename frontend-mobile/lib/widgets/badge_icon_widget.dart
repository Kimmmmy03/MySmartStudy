import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import '../utils/badge_utils.dart';

/// Custom decoder for dotlottie (.lottie) files.
///
/// A .lottie file is a ZIP archive structured as:
///   manifest.json          — dotlottie metadata (NOT a Lottie animation)
///   animations/XXXXX.json  — the actual Lottie animation JSON
///
/// The default lottie package decoder calls `firstWhere(endsWith('.json'))`
/// which picks manifest.json (alphabetically first) and fails to parse it.
/// This decoder explicitly looks inside animations/ to find the real JSON.
Future<LottieComposition?> _dotLottieDecoder(List<int> bytes) {
  return LottieComposition.decodeZip(
    bytes,
    filePicker: (files) {
      // First pass: prefer files in the animations/ subdirectory
      for (final f in files) {
        if (f.name.startsWith('animations/') && f.name.endsWith('.json')) {
          return f;
        }
      }
      // Second pass: any .json that is not manifest.json
      for (final f in files) {
        if (f.name.endsWith('.json') && f.name != 'manifest.json') {
          return f;
        }
      }
      return null;
    },
  );
}

/// Renders a badge icon using:
/// 1. Local .lottie asset with correct dotlottie decoder (if available)
/// 2. Animated/colored Flutter icon fallback
///
/// Matches the web's `BadgeIcon` component behaviour.
class BadgeIconWidget extends StatelessWidget {
  final BadgeInfo badge;
  final double size;
  final bool animated;
  final bool earned;

  const BadgeIconWidget({
    super.key,
    required this.badge,
    this.size = 64,
    this.animated = true,
    this.earned = true,
  });

  @override
  Widget build(BuildContext context) {
    final lottie = badge.lottieAsset;
    if (lottie != null) {
      return SizedBox(
        width: size,
        height: size,
        child: Lottie.asset(
          lottie,
          width: size,
          height: size,
          fit: BoxFit.contain,
          animate: animated && earned,
          decoder: _dotLottieDecoder,
          errorBuilder: (_, error, __) {
            debugPrint('Lottie load error for $lottie: $error');
            return _fallbackIcon();
          },
        ),
      );
    }
    return _fallbackIcon();
  }

  Widget _fallbackIcon() {
    final icon = _resolveIcon(badge.icon);
    return Icon(icon, size: size * 0.65, color: Colors.white);
  }

  static IconData _resolveIcon(String name) {
    switch (name) {
      case 'map': return Icons.map_rounded;
      case 'trophy': return Icons.emoji_events_rounded;
      case 'flame': return Icons.local_fire_department_rounded;
      case 'zap': return Icons.bolt_rounded;
      case 'star': return Icons.star_rounded;
      case 'bird': return Icons.flutter_dash_rounded;
      case 'brain': return Icons.psychology_rounded;
      case 'handshake': return Icons.handshake_rounded;
      case 'check-circle': return Icons.check_circle_rounded;
      case 'compass': return Icons.explore_rounded;
      case 'users': return Icons.people_rounded;
      case 'target': return Icons.gps_fixed_rounded;
      case 'gem': return Icons.diamond_rounded;
      case 'rocket': return Icons.rocket_launch_rounded;
      case 'graduation-cap': return Icons.school_rounded;
      case 'book-open': return Icons.menu_book_rounded;
      case 'lightbulb': return Icons.lightbulb_rounded;
      case 'palette': return Icons.palette_rounded;
      case 'medal': return Icons.military_tech_rounded;
      case 'crown': return Icons.workspace_premium_rounded;
      case 'sparkles': return Icons.auto_awesome_rounded;
      case 'clock': return Icons.access_time_rounded;
      case 'shield-check': return Icons.verified_user_rounded;
      case 'award': return Icons.card_giftcard_rounded;
      case 'heart': return Icons.favorite_rounded;
      default: return Icons.emoji_events_rounded;
    }
  }
}
