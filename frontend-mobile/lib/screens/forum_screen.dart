import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/glass_card.dart';
import '../widgets/glass_bottom_sheet.dart';
import '../widgets/empty_state.dart';
import '../widgets/skeletons.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/confirmation_dialog.dart';

// ── Pastel palette (matches Courses / Announcements / Chat overhaul) ──────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pSand = Color(0xFFC9A86A);
const _pRose = Color(0xFFC99999);

class ForumScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  final bool isLecturer;
  const ForumScreen({super.key, required this.courseId, required this.courseName, this.isLecturer = false});
  @override
  State<ForumScreen> createState() => _ForumScreenState();
}

class _ForumScreenState extends State<ForumScreen> {
  List<Map<String, dynamic>> _topics = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getTopics(widget.courseId);
      if (!mounted) return;
      setState(() {
        _topics = raw.map((t) => Map<String, dynamic>.from(t)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: _glassAppBar(c),
      floatingActionButton: _glassFab(),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonList(itemCount: 5)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: _pSlate,
                  child: _topics.isEmpty
                      ? ListView(children: [
                          SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                          const EmptyState(
                            icon: Icons.forum_rounded,
                            title: 'No topics yet',
                            subtitle: 'Start a discussion to get things going!',
                          ),
                        ])
                      : AnimationLimiter(
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
                            itemCount: _topics.length,
                            itemBuilder: (_, i) => AnimatedListItem(
                              index: i,
                              child: _topicCard(_topics[i]),
                            ),
                          ),
                        ),
                ),
        ),
      ),
    );
  }

  PreferredSizeWidget _glassAppBar(dynamic c) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(kToolbarHeight),
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Forum', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text(widget.courseName, style: TextStyle(fontSize: 12, color: c.textSecondary)),
              ],
            ),
            backgroundColor: (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
            foregroundColor: c.textPrimary,
            elevation: 0,
            scrolledUnderElevation: 0,
            shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
          ),
        ),
      ),
    );
  }

  Widget _glassFab() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_pSlate, _pLavender],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _pSlate.withOpacity(0.35),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            HapticFeedback.lightImpact();
            _showCreateTopic();
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.add_rounded, color: Colors.white, size: 20),
                SizedBox(width: 6),
                Text('New Topic',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _topicCard(Map<String, dynamic> topic) {
    final c = context.colors;
    final title = topic['title']?.toString() ?? '';
    final author = topic['author_name']?.toString() ?? 'Unknown';
    final replyCount = topic['reply_count'] ?? 0;
    final pinned = topic['pinned'] == true;

    final accent = pinned ? _pSand : _pSlate;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => _TopicDetailScreen(
                courseId: widget.courseId,
                topicId: topic['id']?.toString() ?? '',
                topicTitle: title,
                isLecturer: widget.isLecturer,
              ),
            ),
          ).then((_) => _load());
        },
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [accent.withOpacity(0.22), accent.withOpacity(0.12)],
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: accent.withOpacity(0.3)),
              ),
              child: Icon(
                pinned ? Icons.push_pin_rounded : Icons.forum_rounded,
                color: accent,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (pinned) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: _pSand.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: _pSand.withOpacity(0.35)),
                          ),
                          child: const Text(
                            'Pinned',
                            style: TextStyle(color: _pSand, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Expanded(
                        child: Text(
                          title,
                          style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('by $author', style: TextStyle(color: c.textMuted, fontSize: 12)),
                      const Spacer(),
                      Icon(Icons.chat_bubble_outline_rounded, size: 14, color: c.textMuted),
                      const SizedBox(width: 4),
                      Text('$replyCount', style: TextStyle(color: c.textMuted, fontSize: 12)),
                    ],
                  ),
                ],
              ),
            ),
            if (widget.isLecturer) ...[
              const SizedBox(width: 4),
              _topicMenuButton(topic, pinned),
            ],
          ],
        ),
      ),
    );
  }

  Widget _topicMenuButton(Map<String, dynamic> topic, bool pinned) {
    final c = context.colors;
    return IconButton(
      icon: Icon(Icons.more_horiz_rounded, color: c.textMuted, size: 20),
      onPressed: () {
        HapticFeedback.lightImpact();
        _showTopicActionsSheet(topic, pinned);
      },
    );
  }

  void _showTopicActionsSheet(Map<String, dynamic> topic, bool pinned) {
    final topicId = topic['id']?.toString() ?? '';
    showGlassBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _sheetAction(
                icon: pinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
                label: pinned ? 'Unpin topic' : 'Pin topic',
                color: _pSand,
                onTap: () async {
                  Navigator.pop(ctx);
                  await ApiService.toggleTopicPin(widget.courseId, topicId);
                  _load();
                },
              ),
              _sheetAction(
                icon: Icons.delete_outline_rounded,
                label: 'Delete topic',
                color: _pRose,
                onTap: () async {
                  Navigator.pop(ctx);
                  final ok = await showConfirmationDialog(
                    context: context,
                    title: 'Delete Topic',
                    message: 'This topic and all its posts will be deleted.',
                    isDanger: true,
                    confirmLabel: 'Delete',
                  );
                  if (ok == true) {
                    await ApiService.deleteTopic(widget.courseId, topicId);
                    _load();
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sheetAction({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    final c = context.colors;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: color.withOpacity(0.3)),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(color: c.textPrimary, fontSize: 15, fontWeight: FontWeight.w500),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateTopic() {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();
    bool posting = false;

    showGlassBottomSheet(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final c = context.colors;
          return SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 4,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [_pSlate.withOpacity(0.28), _pLavender.withOpacity(0.22)],
                          ),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: _pSlate.withOpacity(0.35)),
                        ),
                        child: const Icon(Icons.forum_rounded, color: _pSlate, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'New Topic',
                        style: TextStyle(color: c.textPrimary, fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _glassField(
                    controller: titleCtrl,
                    hint: 'Title',
                    icon: Icons.title_rounded,
                    autofocus: true,
                  ),
                  const SizedBox(height: 10),
                  _glassField(
                    controller: bodyCtrl,
                    hint: 'First post (optional)',
                    icon: Icons.notes_rounded,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: c.textSecondary,
                            side: BorderSide(color: c.border),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: posting ? null : () => Navigator.pop(ctx),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: [_pSlate, _pLavender]),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: posting
                                ? null
                                : () async {
                                    if (titleCtrl.text.trim().isEmpty) return;
                                    setSheet(() => posting = true);
                                    try {
                                      await ApiService.createTopic(widget.courseId, {
                                        'title': titleCtrl.text.trim(),
                                        if (bodyCtrl.text.trim().isNotEmpty) 'body': bodyCtrl.text.trim(),
                                      });
                                      HapticFeedback.mediumImpact();
                                      if (ctx.mounted) Navigator.pop(ctx);
                                      _load();
                                    } catch (e) {
                                      setSheet(() => posting = false);
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
                                        );
                                      }
                                    }
                                  },
                            child: posting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Create',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _glassField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    int maxLines = 1,
    bool autofocus = false,
  }) {
    final c = context.colors;
    final isDark = context.isDark;
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withOpacity(0.06) : Colors.white.withOpacity(0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06),
        ),
      ),
      child: TextField(
        controller: controller,
        autofocus: autofocus,
        maxLines: maxLines,
        style: TextStyle(color: c.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
          prefixIcon: Icon(icon, color: _pSlate, size: 18),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }
}

// ── Topic Detail with Posts ──
class _TopicDetailScreen extends StatefulWidget {
  final String courseId;
  final String topicId;
  final String topicTitle;
  final bool isLecturer;
  const _TopicDetailScreen({required this.courseId, required this.topicId, required this.topicTitle, this.isLecturer = false});
  @override
  State<_TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends State<_TopicDetailScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();
  List<Map<String, dynamic>> _posts = [];
  String _myId = '';
  bool _loading = true;
  bool _sending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _init();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadPosts());
  }

  Future<void> _init() async {
    try {
      final me = await ApiService.getMe();
      _myId = (me['id'] ?? '').toString();
      await _loadPosts();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadPosts() async {
    try {
      final raw = await ApiService.getTopicPosts(widget.courseId, widget.topicId);
      if (!mounted) return;
      setState(() {
        _posts = raw.map((p) => Map<String, dynamic>.from(p)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendPost() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.lightImpact();
    setState(() => _sending = true);
    try {
      await ApiService.createTopicPost(widget.courseId, widget.topicId, {'text': text});
      _msgCtrl.clear();
      await _loadPosts();
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 60,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: _pRose),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deletePost(String postId) async {
    final ok = await showConfirmationDialog(
      context: context,
      title: 'Delete Post',
      message: 'This post will be deleted.',
      isDanger: true,
      confirmLabel: 'Delete',
    );
    if (ok == true) {
      await ApiService.deleteTopicPost(widget.courseId, widget.topicId, postId);
      _loadPosts();
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: AppBar(
              title: Text(widget.topicTitle,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis),
              backgroundColor: (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
              foregroundColor: c.textPrimary,
              elevation: 0,
              scrolledUnderElevation: 0,
              shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
            ),
          ),
        ),
      ),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonChat(bubbleCount: 6)
              : Column(
                  children: [
                    Expanded(
                      child: _posts.isEmpty
                          ? const Center(
                              child: EmptyState(
                                icon: Icons.chat_bubble_outline_rounded,
                                title: 'No posts yet',
                                subtitle: 'Be the first to reply',
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollCtrl,
                              physics: const BouncingScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              itemCount: _posts.length,
                              itemBuilder: (_, i) {
                                final p = _posts[i];
                                final isMe = (p['sender_id'] ?? '') == _myId;
                                final isLec = (p['sender_role'] ?? '') == 'lecturer';
                                final senderName = p['sender_name']?.toString() ?? 'Unknown';
                                return _postCard(p, senderName, isMe, isLec);
                              },
                            ),
                    ),
                    _inputBar(c),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _postCard(Map<String, dynamic> p, String senderName, bool isMe, bool isLec) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        borderRadius: 14,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AvatarWidget(
                  name: senderName,
                  imageUrl: p['sender_photo_url']?.toString() ?? '',
                  size: 28,
                  role: isLec ? 'lecturer' : 'student',
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          senderName,
                          style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isLec) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: _pLavender.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: _pLavender.withOpacity(0.35)),
                          ),
                          child: const Text(
                            'Lecturer',
                            style: TextStyle(color: _pLavender, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (isMe || widget.isLecturer)
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _deletePost(p['id']?.toString() ?? '');
                    },
                    child: Icon(Icons.delete_outline_rounded, size: 18, color: _pRose.withOpacity(0.8)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              p['text']?.toString() ?? '',
              style: TextStyle(color: c.textSecondary, fontSize: 14, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputBar(dynamic c) {
    final isDark = context.isDark;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withOpacity(0.04)
                : Colors.white.withOpacity(0.7),
            border: Border(top: BorderSide(color: c.border.withOpacity(0.6))),
          ),
          padding: EdgeInsets.only(
            left: 14,
            right: 12,
            top: 10,
            bottom: MediaQuery.of(context).padding.bottom + 10,
          ),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withOpacity(0.06)
                        : Colors.white.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                      color: _focusNode.hasFocus
                          ? _pSlate.withOpacity(0.45)
                          : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06)),
                    ),
                  ),
                  child: TextField(
                    controller: _msgCtrl,
                    focusNode: _focusNode,
                    style: TextStyle(color: c.textPrimary, fontSize: 14),
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Write a reply…',
                      hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendPost(),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_pSlate, _pLavender],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: _pSlate.withOpacity(0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: IconButton(
                  icon: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  onPressed: _sending ? null : _sendPost,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
