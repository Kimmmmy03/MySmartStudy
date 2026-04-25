import 'dart:async';
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
import 'mind_map_viewer.dart';
import 'public_profile_screen.dart';

/// Mobile parity for /student/explore — discover trending public maps,
/// suggested users, and search by display name. Trending has a 7d/30d
/// window toggle (matches the web view).
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  // Trending window
  int _trendingDays = 30;
  List<Map<String, dynamic>> _trending = [];
  bool _trendingLoading = true;

  // Suggested users
  List<Map<String, dynamic>> _suggested = [];
  bool _suggestedLoading = true;

  // Search
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _searchResults = [];
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _loadTrending();
    _loadSuggested();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadTrending() async {
    setState(() => _trendingLoading = true);
    try {
      final raw = await ApiService.getTrending(days: _trendingDays, limit: 12);
      if (!mounted) return;
      setState(() {
        _trending = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _trendingLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _trending = [];
        _trendingLoading = false;
      });
    }
  }

  Future<void> _loadSuggested() async {
    setState(() => _suggestedLoading = true);
    try {
      final raw = await ApiService.getSuggestedUsers(limit: 8);
      if (!mounted) return;
      setState(() {
        _suggested = raw.map((e) => Map<String, dynamic>.from(e)).toList();
        _suggestedLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _suggested = [];
        _suggestedLoading = false;
      });
    }
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    final trimmed = q.trim();
    if (trimmed.length < 2) {
      setState(() {
        _searchResults = [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final raw = await ApiService.searchSocialUsers(trimmed, limit: 15);
        if (!mounted) return;
        setState(() {
          _searchResults = raw.map((e) => Map<String, dynamic>.from(e)).toList();
          _searching = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _searchResults = [];
          _searching = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final showingSearch = _searchCtrl.text.trim().length >= 2;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(c),
              _buildSearchBar(c),
              const SizedBox(height: 4),
              Expanded(
                child: showingSearch ? _buildSearchResults(c) : _buildDiscover(c),
              ),
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
                AppColors.purple.withOpacity(0.25),
                AppColors.pink.withOpacity(0.25),
              ]),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.purple.withOpacity(0.25)),
            ),
            child: const Icon(Icons.explore_rounded,
                color: AppColors.purple, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Explore',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 18)),
                Text('Trending maps + people to follow',
                    style: TextStyle(color: c.textMuted, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(AppColorScheme c) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: TextField(
        controller: _searchCtrl,
        onChanged: _onSearchChanged,
        style: TextStyle(color: c.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search students by name…',
          hintStyle: TextStyle(color: c.textMuted, fontSize: 13),
          prefixIcon: Icon(Icons.search_rounded, color: c.textMuted, size: 20),
          suffixIcon: _searchCtrl.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close_rounded, color: c.textMuted, size: 18),
                  onPressed: () {
                    _searchCtrl.clear();
                    _onSearchChanged('');
                  },
                )
              : null,
          filled: true,
          fillColor: Colors.white.withOpacity(0.04),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: c.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: c.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: AppColors.purple),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildSearchResults(AppColorScheme c) {
    if (_searching) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.purple));
    }
    if (_searchResults.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 30),
        child: EmptyState(
          icon: Icons.person_search_rounded,
          title: 'No matches',
          subtitle: 'Try a different name or display handle.',
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
      physics: const BouncingScrollPhysics(),
      itemCount: _searchResults.length,
      itemBuilder: (_, i) => _buildUserRow(_searchResults[i], c),
    );
  }

  Widget _buildDiscover(AppColorScheme c) {
    return RefreshIndicator(
      color: AppColors.purple,
      onRefresh: () async {
        await Future.wait([_loadTrending(), _loadSuggested()]);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(0, 12, 0, 100),
        physics:
            const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        children: [
          _buildTrendingSection(c),
          const SizedBox(height: 24),
          _buildSuggestedSection(c),
        ],
      ),
    );
  }

  Widget _buildTrendingSection(AppColorScheme c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(
            children: [
              const Icon(Icons.trending_up_rounded,
                  size: 16, color: AppColors.pink),
              const SizedBox(width: 6),
              Text('Trending',
                  style: TextStyle(
                      color: c.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14)),
              const Spacer(),
              _buildWindowToggle(c),
            ],
          ),
        ),
        if (_trendingLoading)
          const SizedBox(
            height: 200,
            child: Center(
                child: CircularProgressIndicator(color: AppColors.purple)),
          )
        else if (_trending.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: EmptyState(
              icon: Icons.auto_awesome_rounded,
              title: 'Nothing trending yet',
              subtitle: 'Check back after classmates start posting public maps.',
            ),
          )
        else
          SizedBox(
            height: 200,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: _trending.length,
              itemBuilder: (_, i) => _buildTrendingTile(_trending[i]),
            ),
          ),
      ],
    );
  }

  Widget _buildWindowToggle(AppColorScheme c) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _windowChip(c, 7, '7d'),
          _windowChip(c, 30, '30d'),
        ],
      ),
    );
  }

  Widget _windowChip(AppColorScheme c, int days, String label) {
    final selected = _trendingDays == days;
    return GestureDetector(
      onTap: () {
        if (_trendingDays == days) return;
        HapticFeedback.selectionClick();
        setState(() => _trendingDays = days);
        _loadTrending();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? AppColors.purple.withOpacity(0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? AppColors.purple : c.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildTrendingTile(Map<String, dynamic> m) {
    final c = context.colors;
    final id = (m['id'] ?? '').toString();
    final title = (m['title'] ?? 'Untitled').toString();
    final ownerName = (m['owner_name'] ?? '').toString();
    final likeCount = m['like_count'] is int ? m['like_count'] as int : 0;
    final thumb = (m['thumbnail'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: SizedBox(
        width: 160,
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
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Could not open this map.')));
            }
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 16 / 10,
                child: Container(
                  decoration: BoxDecoration(
                    image: thumb.startsWith('data:image')
                        ? DecorationImage(
                            image: NetworkImage(thumb), fit: BoxFit.cover)
                        : null,
                    gradient: !thumb.startsWith('data:image')
                        ? LinearGradient(colors: [
                            AppColors.purple.withOpacity(0.18),
                            AppColors.pink.withOpacity(0.18),
                          ])
                        : null,
                  ),
                  child: !thumb.startsWith('data:image')
                      ? const Center(
                          child: Icon(Icons.auto_awesome_rounded,
                              color: AppColors.purple, size: 30))
                      : null,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: c.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700)),
                    if (ownerName.isNotEmpty)
                      Text(ownerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: c.textMuted, fontSize: 10)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.favorite_rounded,
                            size: 11, color: AppColors.pink),
                        const SizedBox(width: 3),
                        Text('$likeCount',
                            style: TextStyle(
                                color: c.textSecondary, fontSize: 10)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuggestedSection(AppColorScheme c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Row(
            children: [
              const Icon(Icons.auto_awesome_rounded,
                  size: 16, color: AppColors.blue),
              const SizedBox(width: 6),
              Text('Suggested for you',
                  style: TextStyle(
                      color: c.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14)),
            ],
          ),
        ),
        if (_suggestedLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child:
                Center(child: CircularProgressIndicator(color: AppColors.blue)),
          )
        else if (_suggested.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: EmptyState(
              icon: Icons.people_outline_rounded,
              title: 'Nobody to suggest yet',
              subtitle: 'Suggestions appear when classmates post public maps.',
            ),
          )
        else
          ..._suggested.map((u) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _buildUserRow(u, c),
              )),
      ],
    );
  }

  Widget _buildUserRow(Map<String, dynamic> u, AppColorScheme c) {
    final uid = (u['id'] ?? '').toString();
    final name = (u['display_name'] ?? 'Unknown').toString();
    final followers =
        u['follower_count'] is int ? u['follower_count'] as int : 0;
    final isFollowing = u['is_followed_by_me'] == true;
    final photoUrl =
        ApiService.resolvePhotoUrl((u['photo_url'] ?? '').toString());
    final bio = (u['bio'] ?? '').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => PublicProfileScreen(uid: uid))),
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            AvatarWidget(imageUrl: photoUrl, name: name, size: 42),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: TextStyle(
                          color: c.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13),
                      overflow: TextOverflow.ellipsis),
                  if (bio.isNotEmpty)
                    Text(bio,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.textSecondary, fontSize: 11)),
                  Text('$followers follower${followers == 1 ? '' : 's'}',
                      style: TextStyle(color: c.textMuted, fontSize: 11)),
                ],
              ),
            ),
            FollowButton(
              targetUserId: uid,
              initialFollowing: isFollowing,
              compact: true,
            ),
          ],
        ),
      ),
    );
  }
}
