import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Badge info matching the backend DEFAULT_BADGES list exactly.
class BadgeInfo {
  final String id;
  final String name;
  final String description;
  final String icon;       // lucide icon name / emoji
  final Gradient gradient; // matches web `color` field (from-X to-Y)
  final String? lottieAsset; // local asset path if a .lottie file exists

  const BadgeInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.gradient,
    this.lottieAsset,
  });
}

class BadgeUtils {
  static const String _base = 'assets/lottie/badges';

  static final List<BadgeInfo> allBadges = [
    BadgeInfo(
      id: 'cartographer',
      name: 'Cartographer',
      description: 'Create your first mind map',
      icon: 'map',
      gradient: const LinearGradient(
        colors: [AppColors.blue, AppColors.cyan],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/map.lottie',
    ),
    BadgeInfo(
      id: 'map_master',
      name: 'Map Master',
      description: 'Create 5 mind maps',
      icon: 'trophy',
      gradient: const LinearGradient(
        colors: [Color(0xFFF59E0B), Color(0xFFEAB308)], // amber-500 → yellow-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/trophy.lottie',
    ),
    BadgeInfo(
      id: 'on_fire',
      name: 'On Fire',
      description: 'Maintain a 3-day streak',
      icon: 'flame',
      gradient: const LinearGradient(
        colors: [Color(0xFFF97316), Color(0xFFEF4444)], // orange-500 → red-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/flame.lottie',
    ),
    BadgeInfo(
      id: 'unstoppable',
      name: 'Unstoppable',
      description: 'Maintain a 7-day streak',
      icon: 'zap',
      gradient: const LinearGradient(
        colors: [AppColors.purple, AppColors.pink],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/zap.lottie',
    ),
    BadgeInfo(
      id: 'top_marks',
      name: 'Top Marks',
      description: 'Score 90%+ on any assignment or quiz',
      icon: 'star',
      gradient: const LinearGradient(
        colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)], // yellow-400 → amber-500
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/star.lottie',
    ),
    BadgeInfo(
      id: 'early_bird',
      name: 'Early Bird',
      description: 'Submit 24+ hours before deadline',
      icon: 'bird',
      gradient: const LinearGradient(
        colors: [Color(0xFF38BDF8), AppColors.blue], // sky-400 → blue-500
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/bird.lottie',
    ),
    BadgeInfo(
      id: 'quiz_whiz',
      name: 'Quiz Whiz',
      description: 'Complete 5 quizzes',
      icon: 'brain',
      gradient: const LinearGradient(
        colors: [AppColors.pink, AppColors.purple],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/brain.lottie',
    ),
    BadgeInfo(
      id: 'helper',
      name: 'Helper',
      description: 'Write 3 peer reviews',
      icon: 'handshake',
      gradient: const LinearGradient(
        colors: [AppColors.emerald, Color(0xFF14B8A6)], // emerald-500 → teal-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      lottieAsset: '$_base/handshake.lottie',
    ),
    BadgeInfo(
      id: 'completionist',
      name: 'Completionist',
      description: 'Complete all activities in a course',
      icon: 'check-circle',
      gradient: const LinearGradient(
        colors: [Color(0xFF6366F1), AppColors.blue], // indigo-500 → blue-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    BadgeInfo(
      id: 'explorer',
      name: 'Explorer',
      description: 'Join your first course',
      icon: 'compass',
      gradient: const LinearGradient(
        colors: [Color(0xFF14B8A6), AppColors.emerald], // teal-500 → emerald-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    BadgeInfo(
      id: 'team_player',
      name: 'Team Player',
      description: 'Collaborate on 3 mind maps',
      icon: 'users',
      gradient: const LinearGradient(
        colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)], // violet-500 → fuchsia-400
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
  ];

  /// Returns [BadgeInfo] for a badge ID, or null if not found in the default list.
  static BadgeInfo? getInfo(String badgeId) {
    try {
      return allBadges.firstWhere((b) => b.id == badgeId);
    } catch (_) {
      return null;
    }
  }

  /// Build a [BadgeInfo] from a raw API badge definition map.
  /// Falls back to a local lottie asset if the icon name matches one.
  static BadgeInfo fromApi(Map<String, dynamic> raw) {
    final id = (raw['id'] ?? '').toString();
    final icon = (raw['icon'] ?? 'award').toString();
    final colorStr = (raw['color'] ?? '').toString();

    // Try to find matching local lottie asset
    const lottieIcons = {'map', 'trophy', 'flame', 'zap', 'star', 'bird', 'brain', 'handshake'};
    final lottieAsset = lottieIcons.contains(icon) ? 'assets/lottie/badges/$icon.lottie' : null;

    return BadgeInfo(
      id: id,
      name: (raw['name'] ?? id).toString(),
      description: (raw['description'] ?? '').toString(),
      icon: icon,
      gradient: _gradientFromColorString(colorStr),
      lottieAsset: raw['lottie_url'] == null ? lottieAsset : null,
    );
  }

  /// Parses Tailwind-style "from-X to-Y" gradient strings into a Flutter gradient.
  static LinearGradient _gradientFromColorString(String colorStr) {
    const colorMap = {
      'blue-500': Color(0xFF3B82F6),
      'cyan-400': AppColors.cyan,
      'amber-500': Color(0xFFF59E0B),
      'yellow-400': Color(0xFFFBBF24),
      'orange-500': Color(0xFFF97316),
      'red-400': Color(0xFFF87171),
      'purple-500': AppColors.purple,
      'pink-400': AppColors.pink,
      'yellow-400b': Color(0xFFFBBF24),
      'sky-400': Color(0xFF38BDF8),
      'pink-500': AppColors.pink,
      'emerald-500': AppColors.emerald,
      'teal-400': Color(0xFF2DD4BF),
      'indigo-500': Color(0xFF6366F1),
      'teal-500': Color(0xFF14B8A6),
      'violet-500': Color(0xFF8B5CF6),
      'fuchsia-400': Color(0xFFE879F9),
    };

    // Extract "from-X" and "to-Y" tokens
    final fromMatch = RegExp(r'from-([a-z]+-\d+)').firstMatch(colorStr);
    final toMatch = RegExp(r'to-([a-z]+-\d+)').firstMatch(colorStr);
    final fromColor = colorMap[fromMatch?.group(1)] ?? AppColors.blue;
    final toColor = colorMap[toMatch?.group(1)] ?? AppColors.cyan;

    return LinearGradient(
      colors: [fromColor, toColor],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }

  static String displayName(String badgeId) => getInfo(badgeId)?.name ?? badgeId;
  static String description(String badgeId) => getInfo(badgeId)?.description ?? '';

  /// Returns an emoji character for the badge icon — used in legacy UI that
  /// still shows emoji text (home screen badge chips, profile screen, etc.)
  static String emoji(String badgeId) {
    final info = getInfo(badgeId);
    if (info == null) return '🏅';
    return _iconEmoji(info.icon);
  }

  /// Returns an emoji for an icon name — used for custom badges defined on
  /// the web where we only have the icon string, not a built-in badge ID.
  static String emojiForIcon(String icon) => _iconEmoji(icon);

  static String _iconEmoji(String icon) {
    switch (icon) {
      case 'map': return '🗺️';
      case 'trophy': return '🏆';
      case 'flame': return '🔥';
      case 'zap': return '⚡';
      case 'star': return '🌟';
      case 'bird': return '🐦';
      case 'brain': return '🧠';
      case 'handshake': return '🤝';
      case 'check-circle': return '✅';
      case 'compass': return '🧭';
      case 'users': return '👥';
      case 'target': return '🎯';
      case 'gem': return '💎';
      case 'rocket': return '🚀';
      case 'graduation-cap': return '🎓';
      case 'book-open': return '📖';
      case 'lightbulb': return '💡';
      case 'palette': return '🎨';
      case 'medal': return '🥇';
      case 'crown': return '👑';
      case 'sparkles': return '✨';
      case 'clock': return '⏰';
      case 'shield-check': return '🛡️';
      case 'award': return '🏅';
      case 'heart': return '❤️';
      default: return '🏅';
    }
  }
}
