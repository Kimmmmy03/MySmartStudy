import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_staggered_animations/flutter_staggered_animations.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/animated_list_item.dart';
import '../widgets/skeletons.dart';
import '../widgets/avatar_widget.dart';

class MessagingScreen extends StatefulWidget {
  const MessagingScreen({super.key});
  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  List<Map<String, dynamic>> _conversations = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final raw = await ApiService.getConversations();
      if (!mounted) return;
      setState(() {
        _conversations = raw.map((c) => Map<String, dynamic>.from(c)).toList();
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
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('Messages'),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.person_add_rounded, color: c.textSecondary),
            onPressed: _newConversation,
          ),
        ],
      ),
      body: _loading
          ? const SkeletonList(itemCount: 6)
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.blue,
              child: _conversations.isEmpty
                  ? ListView(children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                      EmptyState(
                        icon: Icons.chat_rounded,
                        title: 'No conversations yet',
                        subtitle: 'Start a conversation with a classmate',
                        action: TextButton.icon(
                          onPressed: _newConversation,
                          icon: const Icon(Icons.chat_bubble_outline_rounded),
                          label: const Text('Start Chat'),
                        ),
                      ),
                    ])
                  : AnimationLimiter(
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                        itemCount: _conversations.length,
                        itemBuilder: (_, i) => AnimatedListItem(
                          index: i,
                          child: _convTile(_conversations[i]),
                        ),
                      ),
                    ),
            ),
    );
  }

  Widget _convTile(Map<String, dynamic> conv) {
    final c = context.colors;
    final names = (conv['participant_names'] as List?) ?? const [];
    final photos = (conv['participant_photos'] as List?) ?? const [];
    final otherName = names.isNotEmpty
        ? (names.first?.toString() ?? 'User')
        : (conv['other_user_name']?.toString() ?? 'User');
    final otherPhoto = photos.isNotEmpty ? (photos.first?.toString() ?? '') : '';
    final lastMsg = conv['last_message']?.toString() ?? '';
    final unread = conv['unread_count'] ?? 0;
    final hasUnread = unread > 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => _ChatScreen(
                convId: conv['id']?.toString() ?? '',
                otherName: otherName,
                otherPhoto: otherPhoto,
              ),
            ),
          ).then((_) => _load());
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.surfaceCard.withOpacity(context.isDark ? 0.55 : 0.85),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: hasUnread ? AppColors.blue.withOpacity(0.3) : c.border,
              width: hasUnread ? 1.5 : 1,
            ),
            boxShadow: hasUnread
                ? [
                    BoxShadow(
                      color: AppColors.blue.withOpacity(0.08),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              Stack(
                children: [
                  AvatarWidget(name: otherName, imageUrl: otherPhoto, size: 48),
                  if (hasUnread)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.blue, AppColors.blue],
                          ),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      otherName,
                      style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: hasUnread ? FontWeight.bold : FontWeight.w600,
                        fontSize: 14,
                        letterSpacing: -0.1,
                      ),
                    ),
                    if (lastMsg.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        lastMsg,
                        style: TextStyle(
                          color: hasUnread ? c.textSecondary : c.textMuted,
                          fontSize: 12,
                          fontWeight: hasUnread ? FontWeight.w500 : FontWeight.normal,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              if (hasUnread)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.blue, AppColors.blue],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.blue.withOpacity(0.3),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    '$unread',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                )
              else
                Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  void _newConversation() {
    final searchCtrl = TextEditingController();
    final c = context.colors;
    List<Map<String, dynamic>> results = [];
    bool searching = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: c.surfaceCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.6,
            maxChildSize: 0.9,
            builder: (_, scrollCtrl) => Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(color: c.textMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'New Conversation',
                    style: TextStyle(color: c.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: searchCtrl,
                    autofocus: true,
                    style: TextStyle(color: c.textPrimary),
                    decoration: AppTheme.inputDecoration(context, label: 'Search users...', prefixIcon: Icons.search_rounded),
                    onChanged: (q) async {
                      if (q.length < 2) {
                        setSheetState(() => results = []);
                        return;
                      }
                      setSheetState(() => searching = true);
                      try {
                        final raw = await ApiService.searchUsers(q);
                        setSheetState(() {
                          results = raw.map((r) => Map<String, dynamic>.from(r)).toList();
                          searching = false;
                        });
                      } catch (_) {
                        setSheetState(() => searching = false);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  if (searching)
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: CircularProgressIndicator(color: AppColors.blue),
                    ),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollCtrl,
                      itemCount: results.length,
                      itemBuilder: (_, i) {
                        final u = results[i];
                        final name = u['display_name']?.toString() ?? u['email']?.toString() ?? 'User';
                        final email = u['email']?.toString() ?? '';
                        final photo = u['photo_url']?.toString() ?? '';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: GlassCard(
                            onTap: () async {
                              Navigator.pop(ctx);
                              try {
                                final conv = await ApiService.startConversation(u['id']?.toString() ?? '');
                                if (!mounted) return;
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => _ChatScreen(
                                      convId: conv['id']?.toString() ?? '',
                                      otherName: name,
                                      otherPhoto: photo,
                                    ),
                                  ),
                                ).then((_) => _load());
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red),
                                  );
                                }
                              }
                            },
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                AvatarWidget(name: name, imageUrl: photo, size: 36),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(name, style: TextStyle(color: c.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                                      if (email.isNotEmpty)
                                        Text(email, style: TextStyle(color: c.textMuted, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Icon(Icons.chat_bubble_outline_rounded, size: 18, color: c.textMuted),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Private Chat Screen ──
class _ChatScreen extends StatefulWidget {
  final String convId;
  final String otherName;
  final String otherPhoto;
  const _ChatScreen({required this.convId, required this.otherName, this.otherPhoto = ''});
  @override
  State<_ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<_ChatScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  String _myId = '';
  bool _loading = true;
  bool _sending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _init();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _loadMessages());
  }

  Future<void> _init() async {
    try {
      final me = await ApiService.getMe();
      _myId = (me['id'] ?? '').toString();
      await _loadMessages();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMessages() async {
    try {
      final raw = await ApiService.getMessages(widget.convId);
      if (!mounted) return;
      setState(() {
        _messages = raw.map((m) => Map<String, dynamic>.from(m)).toList().reversed.toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.lightImpact();
    setState(() => _sending = true);
    try {
      await ApiService.sendMessage(widget.convId, {'text': text});
      _msgCtrl.clear();
      await _loadMessages();
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: Row(
          children: [
            AvatarWidget(name: widget.otherName, imageUrl: widget.otherPhoto, size: 32),
            const SizedBox(width: 10),
            Text(widget.otherName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const SkeletonChat(bubbleCount: 6)
          : Column(
              children: [
                Expanded(
                  child: _messages.isEmpty
                      ? const Center(
                          child: EmptyState(
                            icon: Icons.chat_rounded,
                            title: 'Start chatting!',
                            subtitle: 'Send the first message',
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollCtrl,
                          reverse: true,
                          physics: const BouncingScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (_, i) {
                            final m = _messages[i];
                            final isMe = (m['sender_id'] ?? '') == _myId;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Align(
                                alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                                child: Container(
                                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    gradient: isMe
                                        ? const LinearGradient(
                                            colors: [AppColors.blue, AppColors.blue],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          )
                                        : null,
                                    color: isMe ? null : c.surfaceCard,
                                    borderRadius: BorderRadius.only(
                                      topLeft: const Radius.circular(16),
                                      topRight: const Radius.circular(16),
                                      bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
                                      bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: isMe
                                            ? AppColors.blue.withOpacity(0.2)
                                            : Colors.black.withOpacity(0.06),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Text(
                                    m['text']?.toString() ?? '',
                                    style: TextStyle(
                                      color: isMe ? Colors.white : c.textPrimary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                _inputBar(),
              ],
            ),
    );
  }

  Widget _inputBar() {
    final c = context.colors;
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          color: c.surfaceInput.withOpacity(0.9),
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 10,
            bottom: MediaQuery.of(context).padding.bottom + 10,
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  style: TextStyle(color: c.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Type a message...',
                    hintStyle: TextStyle(color: c.textMuted),
                    filled: true,
                    fillColor: c.surfaceCard,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                decoration: BoxDecoration(
                  gradient: AppColors.studentGradient,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: _sending
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  onPressed: _send,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
