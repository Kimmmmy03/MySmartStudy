import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/app_background.dart';
import '../widgets/avatar_widget.dart';
import '../widgets/empty_state.dart';
import '../widgets/skeletons.dart';

// ── Pastel palette (matches Courses / Announcements overhaul) ─────────────
const _pSlate = Color(0xFF7C93C5);
const _pLavender = Color(0xFFA79FCD);
const _pRose = Color(0xFFC99999);

class DiscussionChatScreen extends StatefulWidget {
  final String courseId;
  final String courseName;
  const DiscussionChatScreen({super.key, required this.courseId, required this.courseName});
  @override
  State<DiscussionChatScreen> createState() => _DiscussionChatScreenState();
}

class _DiscussionChatScreenState extends State<DiscussionChatScreen> {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _focusNode = FocusNode();
  List<Map<String, dynamic>> _messages = [];
  String _myId = '';
  bool _loading = true;
  bool _sending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _init();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadMessages());
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
      final raw = await ApiService.getDiscussions(widget.courseId);
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
      final msg = await ApiService.createDiscussion(widget.courseId, text);
      _msgCtrl.clear();
      setState(() => _messages.insert(0, Map<String, dynamic>.from(msg)));
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
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
      appBar: _glassAppBar(),
      body: AppBackground(
        applySafeArea: false,
        child: SafeArea(
          child: _loading
              ? const SkeletonChat(bubbleCount: 6)
              : Column(
                  children: [
                    Expanded(
                      child: _messages.isEmpty
                          ? const Center(
                              child: EmptyState(
                                icon: Icons.forum_rounded,
                                title: 'Start the conversation!',
                                subtitle: 'Be the first to say something',
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollCtrl,
                              reverse: true,
                              physics: const BouncingScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                              itemCount: _messages.length,
                              itemBuilder: (_, i) {
                                final m = _messages[i];
                                final isMe = (m['sender_id'] ?? '') == _myId;
                                final isLec = (m['sender_role'] ?? '') == 'lecturer';
                                return _bubble(
                                  m['text']?.toString() ?? '',
                                  m['sender_name']?.toString() ?? '?',
                                  m['sender_photo_url']?.toString() ?? '',
                                  isMe,
                                  isLec,
                                );
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

  PreferredSizeWidget _glassAppBar() {
    final c = context.colors;
    return PreferredSize(
      preferredSize: const Size.fromHeight(kToolbarHeight),
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Class Chat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text(widget.courseName, style: TextStyle(fontSize: 12, color: c.textSecondary)),
              ],
            ),
            backgroundColor: (context.isDark ? Colors.black : Colors.white).withOpacity(0.25),
            foregroundColor: c.textPrimary,
            elevation: 0,
            scrolledUnderElevation: 0,
            shape: Border(bottom: BorderSide(color: c.border.withOpacity(0.5))),
            actions: [
              IconButton(
                icon: Icon(Icons.refresh_rounded, color: _pSlate),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  _loadMessages();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bubble(String text, String sender, String senderPhoto, bool isMe, bool isLec) {
    final c = context.colors;
    final isDark = context.isDark;

    // Own bubble: slate-blue tinted glass; Others: neutral glass
    final bubbleColor = isMe
        ? _pSlate.withOpacity(isDark ? 0.22 : 0.28)
        : (isDark ? Colors.white.withOpacity(0.05) : Colors.white.withOpacity(0.7));
    final bubbleBorder = isMe
        ? _pSlate.withOpacity(0.4)
        : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06));
    final textColor = isMe
        ? (isDark ? Colors.white : const Color(0xFF1F2A44))
        : c.textPrimary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            AvatarWidget(
              name: sender,
              imageUrl: senderPhoto,
              size: 28,
              role: isLec ? 'lecturer' : 'student',
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isMe)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 3),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          sender,
                          style: TextStyle(
                            fontSize: 11,
                            color: c.textMuted,
                            fontWeight: isLec ? FontWeight.bold : FontWeight.normal,
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
                ClipRRect(
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
                    bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
                  ),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                    child: Container(
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: bubbleColor,
                        border: Border.all(color: bubbleBorder),
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft: isMe ? const Radius.circular(16) : const Radius.circular(4),
                          bottomRight: isMe ? const Radius.circular(4) : const Radius.circular(16),
                        ),
                      ),
                      child: Text(
                        text,
                        style: TextStyle(color: textColor, fontSize: 14, height: 1.35),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
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
                      hintText: 'Type a message…',
                      hintStyle: TextStyle(color: c.textMuted, fontSize: 14),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
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
                  onPressed: _sending ? null : _send,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
