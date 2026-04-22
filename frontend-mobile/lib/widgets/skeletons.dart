import 'package:flutter/material.dart';
import 'shimmer_box.dart';

// Reusable skeletal loading primitives.
//
// These replace `CircularProgressIndicator` full-screen spinners with
// content-shaped shimmer placeholders. Each skeleton mimics the rough
// layout of the real content so the page doesn't pop when data lands.

// ── List of stacked rows ─────────────────────────────────────────────────────

class SkeletonList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final double gap;
  final EdgeInsetsGeometry padding;
  final bool withLeading;
  final bool withTrailing;

  const SkeletonList({
    super.key,
    this.itemCount = 6,
    this.itemHeight = 72,
    this.gap = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    this.withLeading = true,
    this.withTrailing = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => SizedBox(height: gap),
      itemBuilder: (_, __) => _SkeletonRow(
        height: itemHeight,
        withLeading: withLeading,
        withTrailing: withTrailing,
      ),
    );
  }
}

class _SkeletonRow extends StatelessWidget {
  final double height;
  final bool withLeading;
  final bool withTrailing;
  const _SkeletonRow({
    required this.height,
    required this.withLeading,
    required this.withTrailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? Colors.white.withValues(alpha: 0.03)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.dark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          if (withLeading) ...[
            const ShimmerBox(width: 44, height: 44, borderRadius: 12),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                ShimmerBox(height: 14, borderRadius: 6),
                SizedBox(height: 8),
                ShimmerBox(width: 140, height: 10, borderRadius: 5),
              ],
            ),
          ),
          if (withTrailing) ...[
            const SizedBox(width: 12),
            const ShimmerBox(width: 28, height: 28, borderRadius: 8),
          ],
        ],
      ),
    );
  }
}

// ── Grid of cards (Courses, Mind Maps, Resources) ────────────────────────────

class SkeletonGrid extends StatelessWidget {
  final int itemCount;
  final int crossAxisCount;
  final double aspectRatio;
  final EdgeInsetsGeometry padding;

  const SkeletonGrid({
    super.key,
    this.itemCount = 6,
    this.crossAxisCount = 2,
    this.aspectRatio = 0.82,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  });

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        childAspectRatio: aspectRatio,
        mainAxisSpacing: 14,
        crossAxisSpacing: 14,
      ),
      itemCount: itemCount,
      itemBuilder: (_, __) => const SkeletonCard(),
    );
  }
}

// ── Single card (used inside grids or standalone) ────────────────────────────

class SkeletonCard extends StatelessWidget {
  final double? height;
  final bool withHeaderTint;

  const SkeletonCard({super.key, this.height, this.withHeaderTint = true});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.03)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.06)
              : Colors.black.withValues(alpha: 0.06),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (withHeaderTint)
            const Expanded(
              flex: 5,
              child: ShimmerBox(borderRadius: 0, height: double.infinity),
            ),
          Expanded(
            flex: 6,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  ShimmerBox(height: 14, borderRadius: 6),
                  SizedBox(height: 8),
                  ShimmerBox(width: 120, height: 10, borderRadius: 5),
                  SizedBox(height: 10),
                  ShimmerBox(width: 80, height: 10, borderRadius: 5),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail page (header + sections) ──────────────────────────────────────────

class SkeletonDetail extends StatelessWidget {
  final EdgeInsetsGeometry padding;
  final int sectionCount;

  const SkeletonDetail({
    super.key,
    this.padding = const EdgeInsets.all(16),
    this.sectionCount = 3,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerBox(height: 120, borderRadius: 16),
          const SizedBox(height: 16),
          const ShimmerBox(height: 20, borderRadius: 6),
          const SizedBox(height: 8),
          const ShimmerBox(width: 180, height: 14, borderRadius: 5),
          const SizedBox(height: 20),
          for (int i = 0; i < sectionCount; i++) ...[
            const ShimmerBox(height: 86, borderRadius: 14),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

// ── Chat (alternating bubbles) ───────────────────────────────────────────────

class SkeletonChat extends StatelessWidget {
  final int bubbleCount;
  final EdgeInsetsGeometry padding;

  const SkeletonChat({
    super.key,
    this.bubbleCount = 5,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
  });

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: bubbleCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) {
        final mine = i.isOdd;
        final w = (i % 3 == 0) ? 220.0 : (i % 3 == 1 ? 160.0 : 280.0);
        return Row(
          mainAxisAlignment:
              mine ? MainAxisAlignment.end : MainAxisAlignment.start,
          children: [
            if (!mine) ...[
              const ShimmerBox(width: 32, height: 32, borderRadius: 16),
              const SizedBox(width: 8),
            ],
            ShimmerBox(width: w, height: 56, borderRadius: 14),
          ],
        );
      },
    );
  }
}

// ── Stat row (dashboard-style 2-3 metric cards) ──────────────────────────────

class SkeletonStats extends StatelessWidget {
  final int count;
  final double height;
  final EdgeInsetsGeometry padding;

  const SkeletonStats({
    super.key,
    this.count = 3,
    this.height = 88,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          for (int i = 0; i < count; i++) ...[
            Expanded(child: ShimmerBox(height: height, borderRadius: 14)),
            if (i != count - 1) const SizedBox(width: 12),
          ],
        ],
      ),
    );
  }
}

// ── Profile (avatar + name + rows) ───────────────────────────────────────────

class SkeletonProfile extends StatelessWidget {
  final EdgeInsetsGeometry padding;
  const SkeletonProfile({
    super.key,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const ShimmerBox(width: 96, height: 96, borderRadius: 48),
          const SizedBox(height: 14),
          const ShimmerBox(width: 160, height: 18, borderRadius: 6),
          const SizedBox(height: 8),
          const ShimmerBox(width: 120, height: 12, borderRadius: 5),
          const SizedBox(height: 24),
          const ShimmerBox(height: 68, borderRadius: 14),
          const SizedBox(height: 12),
          const ShimmerBox(height: 68, borderRadius: 14),
          const SizedBox(height: 12),
          const ShimmerBox(height: 68, borderRadius: 14),
        ],
      ),
    );
  }
}

// ── Centered fallback (when no specific shape fits) ──────────────────────────

class SkeletonFallback extends StatelessWidget {
  const SkeletonFallback({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          ShimmerBox(height: 88, borderRadius: 14),
          SizedBox(height: 12),
          ShimmerBox(height: 120, borderRadius: 14),
          SizedBox(height: 12),
          ShimmerBox(height: 88, borderRadius: 14),
          SizedBox(height: 12),
          ShimmerBox(height: 120, borderRadius: 14),
        ],
      ),
    );
  }
}
