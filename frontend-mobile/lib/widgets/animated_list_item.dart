import 'package:flutter/material.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';

/// Wraps a list item with staggered fade + slide animation.
class AnimatedListItem extends StatelessWidget {
  final int index;
  final Widget child;
  final double verticalOffset;
  final Duration duration;

  const AnimatedListItem({
    super.key,
    required this.index,
    required this.child,
    this.verticalOffset = 30.0,
    this.duration = const Duration(milliseconds: 350),
  });

  @override
  Widget build(BuildContext context) {
    return AnimationConfiguration.staggeredList(
      position: index,
      duration: duration,
      child: SlideAnimation(
        verticalOffset: verticalOffset,
        child: FadeInAnimation(child: child),
      ),
    );
  }
}

/// Wraps a grid item with staggered scale + fade animation.
class AnimatedGridItem extends StatelessWidget {
  final int index;
  final int columnCount;
  final Widget child;
  final Duration duration;

  const AnimatedGridItem({
    super.key,
    required this.index,
    required this.columnCount,
    required this.child,
    this.duration = const Duration(milliseconds: 375),
  });

  @override
  Widget build(BuildContext context) {
    return AnimationConfiguration.staggeredGrid(
      position: index,
      columnCount: columnCount,
      duration: duration,
      child: ScaleAnimation(
        scale: 0.9,
        child: FadeInAnimation(child: child),
      ),
    );
  }
}
