import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
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
import 'mind_map_viewer.dart';

/// Public profile view for any user. Mirrors the web `/student/profile/[uid]`
/// page — cover + avatar + name + role + bio + follower/following counts +
/// FollowButton + grid of the user's public mind maps. If the uid matches the
/// current user we pop and let the caller route to the self-profile editor,
/// keeping a single source of truth for edits.
class PublicProfileScreen extends StatefulWidget {
  final String uid;
  const PublicProfileScreen({super.key, required this.uid});

  @override
  State<PublicProfileScreen> createState() => _PublicProfileScreenState();
}

class _PublicProfileScreenState extends State<PublicProfileScreen> {
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _maps = [];
  bool _loadingProfile = true;
  bool _loadingMaps = true;
  bool _notFound = false;
  int _followerCount = 0;

  @override
  void initState() {
    super.initState();
    final me = FirebaseAuth.instance.currentUser;
    if (me != null && me.uid == widget.uid) {
      // Self-view — pop back so caller can route to the editable profile tab.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
      return;
    }
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loadingProfile = true;
      _loadingMaps = true;
      _notFound = false;
    });
    try {
      final data = await ApiService.getPublicProfile(widget.uid);
      if (!mounted) return;
      setState(() {
        _profile = data;
        _followerCount =
            (data['follower_count'] is int ? data['follower_count'] as int : 0);
        _loadingProfile = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _notFound = true;
        _loadingProfile = false;
      });
    }

    try {
      final raw = await ApiService.getPublicMapsByUser(widget.uid, limit: 30);
      if (!mounted) return;
      setState(() {
        _maps = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _loadingMaps = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _maps = [];
        _loadingMaps = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: context.colors.textPrimary),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: _loadingProfile
            ? const SkeletonList(itemCount: 6)
            : _notFound || _profile == null
                ? _buildNotFound()
                : _buildContent(),
      ),
    );
  }

  Widget _buildNotFound() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassCard(
          padding: const EdgeInsets.all(28),
          child: const EmptyState(
            icon: Icons.person_off_rounded,
            title: 'Profile not found',
            subtitle: 'This account may have been deleted.',
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final p = _profile!;
    final c = context.colors;
    final displayName = (p['display_name'] ?? 'Unknown').toString();
    final role = (p['role'] ?? 'student').toString();
    final bio = (p['bio'] ?? '').toString();
    final photoUrl = ApiService.resolvePhotoUrl((p['photo_url'] ?? '').toString());
    final coverUrl =
        ApiService.resolvePhotoUrl((p['cover_photo_url'] ?? '').toString());
    final followingCount =
        (p['following_count'] is int ? p['following_count'] as int : 0);
    final isFollowing = p['is_followed_by_me'] == true;
    final uid = (p['id'] ?? widget.uid).toString();

    return RefreshIndicator(
      color: AppColors.blue,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(0, 0, 0, 100),
        children: [
          // Cover strip — image if present, otherwise a soft gradient placeholder.
          Container(
            height: 180,
            decoration: BoxDecoration(
              image: coverUrl != null
                  ? DecorationImage(
                      image: NetworkImage(coverUrl),
                      fit: BoxFit.cover,
                    )
                  : null,
              gradient: coverUrl == null
                  ? LinearGradient(
                      colors: [
                        AppColors.purple.withOpacity(0.4),
                        AppColors.blue.withOpacity(0.25),
                        AppColors.cyan.withOpacity(0.2),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
            ),
            foregroundDecoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.transparent, Colors.black.withOpacity(0.45)],
              ),
            ),
          ),

          // Avatar overlapping cover
          Transform.translate(
            offset: const Offset(0, -48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: c.surface, width: 4),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.25),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: AvatarWidget(
                            imageUrl: photoUrl,
                            name: displayName,
                            size: 88,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: FollowButton(
                          targetUserId: uid,
                          initialFollowing: isFollowing,
                          onChange: (next) {
                            if (!mounted) return;
                            setState(() {
                              _followerCount += next ? 1 : -1;
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    displayName,
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.alternate_email_rounded,
                          size: 12, color: c.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        role,
                        style: TextStyle(
                          color: c.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  if (bio.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      bio,
                      style: TextStyle(
                        color: c.textSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      _counterPill(
                        icon: Icons.people_alt_rounded,
                        tint: AppColors.purple,
                        value: _followerCount,
                        label:
                            _followerCount == 1 ? 'follower' : 'followers',
                      ),
                      const SizedBox(width: 10),
                      _counterPill(
                        icon: Icons.person_add_alt_rounded,
                        tint: AppColors.blue,
                        value: followingCount,
                        label: 'following',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Maps section
          Transform.translate(
            offset: const Offset(0, -32),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.auto_awesome_mosaic_rounded,
                          size: 16, color: AppColors.blue),
                      const SizedBox(width: 6),
                      Text(
                        'Public mind maps',
                        style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      if (_maps.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text(
                          '(${_maps.length})',
                          style: TextStyle(color: c.textMuted, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (_loadingMaps)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: CircularProgressIndicator(
                            color: AppColors.purple, strokeWidth: 2),
                      ),
                    )
                  else if (_maps.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 30),
                      child: EmptyState(
                        icon: Icons.map_outlined,
                        title: 'No public maps yet',
                        subtitle:
                            '$displayName hasn\'t posted any public mind maps yet.',
                      ),
                    )
                  else
                    ..._maps.map(_buildMapTile),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _counterPill({
    required IconData icon,
    required Color tint,
    required int value,
    required String label,
  }) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tint.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tint.withOpacity(0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: tint),
          const SizedBox(width: 6),
          Text(
            '$value',
            style: TextStyle(
              color: c.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: c.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapTile(Map<String, dynamic> m) {
    final c = context.colors;
    final title = (m['title'] ?? 'Untitled map').toString();
    final thumb = (m['thumbnail'] ?? '').toString();
    final likeCount =
        m['like_count'] is int ? m['like_count'] as int : 0;
    final commentCount =
        m['comment_count'] is int ? m['comment_count'] as int : 0;
    final id = (m['id'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(12),
        onTap: id.isEmpty
            ? null
            : () async {
                // Viewer screen needs a full MindMapModel — fetch it first,
                // then push. The public endpoint already enforces visibility
                // so unauthorized reads surface as the generic error dialog.
                try {
                  final data = await ApiService.getMap(id);
                  if (!mounted) return;
                  final model = MindMapModel.fromApi(data);
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => MindMapViewerScreen(mindMap: model),
                  ));
                } catch (_) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Could not open this map.')),
                  );
                }
              },
        child: Row(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.purple.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              clipBehavior: Clip.antiAlias,
              child: thumb.startsWith('data:image')
                  ? Image.network(
                      thumb,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(
                          Icons.auto_awesome_rounded,
                          color: AppColors.purple),
                    )
                  : const Icon(Icons.auto_awesome_rounded,
                      color: AppColors.purple, size: 28),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: c.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.favorite_rounded,
                          size: 12, color: AppColors.pink),
                      const SizedBox(width: 3),
                      Text('$likeCount',
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 11)),
                      const SizedBox(width: 10),
                      Icon(Icons.mode_comment_rounded,
                          size: 12, color: AppColors.cyan),
                      const SizedBox(width: 3),
                      Text('$commentCount',
                          style: TextStyle(
                              color: c.textSecondary, fontSize: 11)),
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.textMuted),
          ],
        ),
      ),
    );
  }
}
