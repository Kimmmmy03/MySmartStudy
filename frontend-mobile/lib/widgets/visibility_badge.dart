import 'package:flutter/material.dart';
import '../models/mind_map_model.dart';
import '../utils/app_colors.dart';

/// Small pill badge showing a map's visibility tier. Mirrors the web
/// `VisibilityBadge` component — private (lock/muted), unlisted (link/blue),
/// public (globe/purple). Used on map cards, map viewer header, and public
/// profile grid.
class VisibilityBadge extends StatelessWidget {
  final MapVisibility visibility;
  final bool compact;

  const VisibilityBadge({
    super.key,
    required this.visibility,
    this.compact = false,
  });

  _BadgeMeta get _meta {
    switch (visibility) {
      case MapVisibility.public:
        return const _BadgeMeta(
          label: 'Public',
          icon: Icons.public_rounded,
          tint: AppColors.purple,
        );
      case MapVisibility.unlisted:
        return const _BadgeMeta(
          label: 'Unlisted',
          icon: Icons.link_rounded,
          tint: AppColors.blue,
        );
      case MapVisibility.private:
        return const _BadgeMeta(
          label: 'Private',
          icon: Icons.lock_rounded,
          tint: Colors.white70,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _meta;
    final padH = compact ? 6.0 : 8.0;
    final padV = compact ? 2.0 : 3.0;
    final iconSize = compact ? 10.0 : 12.0;
    final textSize = compact ? 9.0 : 10.5;
    final isPrivate = visibility == MapVisibility.private;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: isPrivate
            ? Colors.white.withOpacity(0.06)
            : m.tint.withOpacity(0.12),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(
          color: isPrivate
              ? Colors.white.withOpacity(0.12)
              : m.tint.withOpacity(0.25),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(m.icon, size: iconSize, color: m.tint),
          SizedBox(width: compact ? 3 : 4),
          Text(
            m.label,
            style: TextStyle(
              color: m.tint,
              fontSize: textSize,
              fontWeight: FontWeight.w600,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeMeta {
  final String label;
  final IconData icon;
  final Color tint;
  const _BadgeMeta({required this.label, required this.icon, required this.tint});
}
