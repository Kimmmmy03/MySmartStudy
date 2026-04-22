import 'package:flutter/material.dart';
import 'package:animations/animations.dart';

/// Thin wrapper around [OpenContainer] preserving the glass-card aesthetic.
class OpenContainerWrapper<T> extends StatelessWidget {
  final Widget Function(BuildContext context, VoidCallback openContainer) closedBuilder;
  final Widget Function(BuildContext context, VoidCallback close) openBuilder;
  final Color closedColor;
  final Color openColor;
  final BorderRadius closedBorderRadius;
  final Duration transitionDuration;
  final void Function(T?)? onClosed;

  const OpenContainerWrapper({
    super.key,
    required this.closedBuilder,
    required this.openBuilder,
    this.closedColor = Colors.transparent,
    this.openColor = Colors.transparent,
    this.closedBorderRadius = const BorderRadius.all(Radius.circular(16)),
    this.transitionDuration = const Duration(milliseconds: 280),
    this.onClosed,
  });

  @override
  Widget build(BuildContext context) {
    return OpenContainer<T>(
      closedBuilder: closedBuilder,
      openBuilder: openBuilder,
      closedColor: closedColor,
      openColor: openColor,
      closedElevation: 0,
      openElevation: 0,
      closedShape: RoundedRectangleBorder(borderRadius: closedBorderRadius),
      transitionDuration: transitionDuration,
      transitionType: ContainerTransitionType.fadeThrough,
      onClosed: onClosed,
    );
  }
}
