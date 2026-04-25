import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/mind_map_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/empty_state.dart';
import '../widgets/follow_button.dart';
import '../widgets/glass_card.dart';
import '../widgets/skeletons.dart';
import 'explore_screen.dart';
import 'mind_map_viewer.dart';
import 'public_profile_screen.dart';

/// Mobile parity for /student/feed — public mind maps from people the
/// viewer follows, newest-first. When the feed is empty we surface a
/// "suggested people" inline list so brand-new accounts have a path
/// out of the dead-end.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  List<Map<String, dynamic>> _maps = [];
  List<Map<String, dynamic>> _suggested = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = false;
      _loading = true;
    });
    try {
      final raw = await ApiService.getFeed(limit: 30);
      final maps = raw.map((e) => Map<String, dynamic>.from(e)).toList();
      if (!mounted) return;
      setState(() {
        _maps = maps;
        _loading = false;
      });
      if (maps.isEmpty) {
        try {
          final s = await ApiService.getSuggestedUsers(limit: 3);
          if (!mounted) return;
          setState(() {
            _suggested = s.map((e) => Map<String, dynamic>.from(e)).toList();
          });
        } catch (_) {/* ignore — suggestions are best-effort */}
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(c),
              Expanded(child: _buildBody(c)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [
                AppColors.blue.withOpacity(0.25),
                AppColors.purple.withOpacity(0.25),
              ]),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.blue.withOpacity(0.25)),
            ),
            child: const Icon(Icons.people_alt_rounded,
                color: AppColors.blue, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Feed',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 18)),
                Text('Public maps from people you follow',
                    style: TextStyle(color: c.textMuted, fontSize: 11)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded, size: 20),
            color: AppColors.blue,
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppColorScheme c) {
    if (_loading) return const SkeletonList(itemCount: 4);
    if (_error) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: GlassCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded,
                    color: AppColors.red, size: 28),
                const SizedBox(height: 8),
                Text('Couldn\'t load your feed.',
                    style: TextStyle(color: c.textPrimary)),
                TextButton(
                    onPressed: _load,
                    child: const Text('Try again',
                        style: TextStyle(color: AppColors.blue))),
              ],
            ),
          ),
        ),
      );
    }
    if (_maps.isEmpty) return _buildEmptyWithSuggestions(c);

    return RefreshIndicator(
      color: AppColors.blue,
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
        itemCount: _maps.length,
        itemBuilder: (_, i) => _buildMapCard(_maps[i]),
      ),
    );
  }

  Widget _buildEmptyWithSuggestions(AppColorScheme c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 100),
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      children: [
        const EmptyState(
          icon: Icons.groups_rounded,
          title: 'Your feed is empty',
          subtitle: 'Follow classmates to see their public mind maps here.',
        ),
        if (_suggested.isNotEmpty) ...[
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome_rounded,
                    size: 14, color: AppColors.purple),
                const SizedBox(width: 6),
                Text('SUGGESTED FOR YOU',
                    style: TextStyle(
                        color: c.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          ..._suggested.map((u) => _buildSuggestedRow(u, c)),
        ],
        const SizedBox(height: 14),
        Center(
          child: ElevatedButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const ExploreScreen()));
            },
            icon: const Icon(Icons.explore_rounded, size: 16),
            label: const Text('Explore more students'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.blue,
              foregroundColor: Colors.white,
              padding:
                  const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuggestedRow(Map<String, dynamic> u, AppColorScheme c) {
    final uid = (u['id'] ?? '').toString();
    final name = (u['display_name'] ?? 'Unknown').toString();
    final followers =
        u['follower_count'] is int ? u['follower_count'] as int : 0;
    final isFollowing = u['is_followed_by_me'] == true;
    final photoUrl =
        ApiService.resolvePhotoUrl((u['photo_url'] ?? '').toString());

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => PublicProfileScreen(uid: uid))),
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            AvatarWidget(imageUrl: photoUrl, name: name, size: 38),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                      overflow: TextOverflow.ellipsis),
                  Text('$followers follower${followers == 1 ? '' : 's'}',
                      style:
                          TextStyle(color: c.textMuted, fontSize: 11)),
                ],
              ),
            ),
            FollowButton(
              targetUserId: uid,
              initialFollowing: isFollowing,
              compact: true,
              onChange: (next) {
                if (next) {
                  setState(() => _suggested.removeWhere((x) => x['id'] == uid));
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapCard(Map<String, dynamic> m) {
    final c = context.colors;
    final id = (m['id'] ?? '').toString();
    final title = (m['title'] ?? 'Untitled').toString();
    final ownerId = (m['owner_id'] ?? '').toString();
    final ownerName = (m['owner_name'] ?? m['owner_email'] ?? '').toString();
    final ownerPhoto =
        ApiService.resolvePhotoUrl((m['owner_photo_url'] ?? '').toString());
    final likeCount = m['like_count'] is int ? m['like_count'] as int : 0;
    final commentCount =
        m['comment_count'] is int ? m['comment_count'] as int : 0;
    final thumb = (m['thumbnail'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: GlassCard(
        padding: const EdgeInsets.all(0),
        onTap: () async {
          try {
            final data = await ApiService.getMap(id);
            if (!mounted) return;
            final model = MindMapModel.fromApi(data);
            Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => MindMapViewerScreen(mindMap: model)));
          } catch (_) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Could not open this map.')));
          }
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Author row
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: GestureDetector(
                onTap: () {
                  if (ownerId.isEmpty) return;
                  Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => PublicProfileScreen(uid: ownerId)));
                },
                behavior: HitTestBehavior.opaque,
                child: Row(
                  children: [
                    AvatarWidget(
                        imageUrl: ownerPhoto, name: ownerName, size: 32),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(ownerName,
                          style: TextStyle(
                              color: c.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
            ),
            // Thumbnail (or gradient fallback)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.purple.withOpacity(0.08),
                  image: thumb.startsWith('data:image')
                      ? DecorationImage(
                          image: NetworkImage(thumb), fit: BoxFit.cover)
                      : null,
                  gradient: !thumb.startsWith('data:image')
                      ? LinearGradient(colors: [
                          AppColors.blue.withOpacity(0.18),
                          AppColors.purple.withOpacity(0.18),
                        ])
                      : null,
                ),
                child: !thumb.startsWith('data:image')
                    ? const Center(
                        child: Icon(Icons.auto_awesome_rounded,
                            color: AppColors.purple, size: 36))
                    : null,
              ),
            ),
            // Footer: title + like/comment counts
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          color: c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.bold),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.favorite_rounded,
                          size: 13, color: AppColors.pink),
                      const SizedBox(width: 4),
                      Text('$likeCount',
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 12)),
                      const SizedBox(width: 14),
                      const Icon(Icons.mode_comment_rounded,
                          size: 13, color: AppColors.cyan),
                      const SizedBox(width: 4),
                      Text('$commentCount',
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

