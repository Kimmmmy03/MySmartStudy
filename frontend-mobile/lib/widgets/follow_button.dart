import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';

/// One-way follow/unfollow button with optimistic toggle + error rollback.
/// Mirrors the web `FollowButton` component. Parent receives [onChange]
/// after the server confirms so it can reconcile cached follower counts.
class FollowButton extends StatefulWidget {
  final String targetUserId;
  final bool initialFollowing;
  final bool disabled;
  final bool compact;
  final ValueChanged<bool>? onChange;

  const FollowButton({
    super.key,
    required this.targetUserId,
    required this.initialFollowing,
    this.disabled = false,
    this.compact = false,
    this.onChange,
  });

  @override
  State<FollowButton> createState() => _FollowButtonState();
}

class _FollowButtonState extends State<FollowButton> {
  late bool _following = widget.initialFollowing;
  bool _loading = false;

  Future<void> _toggle() async {
    if (widget.disabled || _loading) return;
    HapticFeedback.lightImpact();
    final prev = _following;
    final next = !prev;
    setState(() {
      _following = next;
      _loading = true;
    });
    try {
      if (next) {
        await ApiService.followUser(widget.targetUserId);
      } else {
        await ApiService.unfollowUser(widget.targetUserId);
      }
      widget.onChange?.call(next);
    } catch (_) {
      if (mounted) setState(() => _following = prev);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final padH = widget.compact ? 10.0 : 16.0;
    final padV = widget.compact ? 6.0 : 9.0;
    final fontSize = widget.compact ? 11.0 : 13.0;
    final iconSize = widget.compact ? 12.0 : 14.0;
    final isDisabled = widget.disabled || _loading;

    return Opacity(
      opacity: isDisabled ? 0.6 : 1.0,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isDisabled ? null : _toggle,
          borderRadius: BorderRadius.circular(10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
            decoration: BoxDecoration(
              gradient: _following
                  ? null
                  : const LinearGradient(
                      colors: [AppColors.blue, AppColors.purple],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
              color: _following ? Colors.white.withOpacity(0.06) : null,
              border: _following
                  ? Border.all(color: Colors.white.withOpacity(0.12))
                  : null,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_loading)
                  SizedBox(
                    width: iconSize,
                    height: iconSize,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(
                        _following ? Colors.white70 : Colors.white,
                      ),
                    ),
                  )
                else
                  Icon(
                    _following ? Icons.check_rounded : Icons.person_add_alt_1_rounded,
                    size: iconSize,
                    color: _following ? Colors.white70 : Colors.white,
                  ),
                const SizedBox(width: 6),
                Text(
                  _following ? 'Following' : 'Follow',
                  style: TextStyle(
                    color: _following ? Colors.white70 : Colors.white,
                    fontSize: fontSize,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
