import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/ai_chat.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import 'ai_study_materials_screen.dart';

/// Mobile SmartBuddy chat — feature-parity with the web's chat panel:
///   • Three source tiers: course / online (OpenAlex, last 6 years) /
///     AI general knowledge.
///   • Tier-coloured source chips beneath each buddy message.
///   • "Generate flashcards", "Make a summary", "Build a quiz" CTAs that hit
///     the topic-based study-material endpoint and route the student to the
///     AI Study Materials screen.
///   • Markdown rendering of buddy messages (bold, bullets, ###headings).
class SmartBuddyChatScreen extends StatefulWidget {
  const SmartBuddyChatScreen({super.key});

  @override
  State<SmartBuddyChatScreen> createState() => _SmartBuddyChatScreenState();
}

class _ChatMessage {
  final String role; // 'user' | 'buddy'
  final String text;
  final EvidenceTier? evidenceLevel;
  final List<ChatSource> sources;
  final List<ChatSuggestedAction> suggestedActions;

  const _ChatMessage({
    required this.role,
    required this.text,
    this.evidenceLevel,
    this.sources = const [],
    this.suggestedActions = const [],
  });
}

class _SmartBuddyChatScreenState extends State<SmartBuddyChatScreen> {
  final List<_ChatMessage> _messages = [];
  final TextEditingController _inputCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  bool _sending = false;
  // Tracks which CTA is currently generating (messageIdx:actionIdx) → spinner.
  String? _busyActionKey;

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final msg = _inputCtrl.text.trim();
    if (msg.isEmpty || _sending) return;
    HapticFeedback.lightImpact();
    setState(() {
      _messages.add(_ChatMessage(role: 'user', text: msg));
      _inputCtrl.clear();
      _sending = true;
    });
    _scrollToEnd();
    try {
      final raw = await ApiService.aiMindmapBuddyChat(msg);
      final resp = ChatResponse.fromJson(raw);
      setState(() {
        _messages.add(_ChatMessage(
          role: 'buddy',
          text: resp.response,
          evidenceLevel: resp.evidenceLevel,
          sources: resp.sources,
          suggestedActions: resp.suggestedActions,
        ));
      });
    } catch (e) {
      setState(() {
        _messages.add(_ChatMessage(
          role: 'buddy',
          text: "Sorry, I couldn't process that. Try again in a moment.",
        ));
      });
    } finally {
      setState(() => _sending = false);
      _scrollToEnd();
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Generate a study material from a chat CTA, then jump to the Study
  /// Materials screen where the new entry is now saved.
  Future<void> _onActionTap(ChatSuggestedAction a, int msgIdx, int actionIdx) async {
    final key = '$msgIdx:$actionIdx';
    setState(() => _busyActionKey = key);
    try {
      await ApiService.aiGenerateStudyMaterialByTopic(
        topic: a.topic,
        type: a.type,
        courseId: a.courseId ?? '',
        evidenceTier: evidenceTierToString(a.evidenceTier),
      );
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const AiStudyMaterialsScreen()),
      );
    } catch (e) {
      final msg = e.toString().replaceAll('Exception: ', '');
      setState(() {
        _messages.add(_ChatMessage(
          role: 'buddy',
          text: "Couldn't generate that: $msg",
        ));
      });
      _scrollToEnd();
    } finally {
      if (mounted) setState(() => _busyActionKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text(
          'SmartBuddy',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty ? _emptyState(c) : _messageList(c),
          ),
          _inputBar(c),
        ],
      ),
    );
  }

  Widget _emptyState(dynamic c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF6366F1), Color(0xFFA855F7)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.chat_bubble_outline,
                  color: Colors.white, size: 32),
            ),
            const SizedBox(height: 16),
            Text(
              'Ask me anything',
              style: TextStyle(
                color: c.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              "I'll cite where the info comes from — your course notes, "
              "peer-reviewed papers (last 6 years), or general knowledge.",
              textAlign: TextAlign.center,
              style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _messageList(dynamic c) {
    return ListView.separated(
      controller: _scrollCtrl,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      itemCount: _messages.length + (_sending ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (ctx, i) {
        if (_sending && i == _messages.length) return _typingBubble();
        return _messageBubble(_messages[i], i, c);
      },
    );
  }

  Widget _messageBubble(_ChatMessage m, int idx, dynamic c) {
    final isUser = m.role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.85,
        ),
        child: Column(
          crossAxisAlignment:
              isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: isUser
                    ? const LinearGradient(
                        colors: [Color(0xFF6366F1), Color(0xFFA855F7)],
                      )
                    : null,
                color: isUser ? null : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isUser ? 16 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 16),
                ),
                border: isUser
                    ? null
                    : Border.all(color: const Color(0xFFE5E7EB), width: 1),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x14000000),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: isUser
                  ? Text(
                      m.text,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        height: 1.45,
                      ),
                    )
                  : MarkdownBody(
                      data: m.text,
                      styleSheet: MarkdownStyleSheet(
                        p: const TextStyle(
                          color: Color(0xFF1F2937),
                          fontSize: 14,
                          height: 1.5,
                        ),
                        strong: const TextStyle(
                          color: Color(0xFF111827),
                          fontWeight: FontWeight.w700,
                        ),
                        listBullet: const TextStyle(
                          color: Color(0xFF1F2937),
                          fontSize: 14,
                          height: 1.5,
                        ),
                        h1: const TextStyle(
                          color: Color(0xFF111827),
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                        h2: const TextStyle(
                          color: Color(0xFF111827),
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                        h3: const TextStyle(
                          color: Color(0xFF111827),
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                        code: const TextStyle(
                          backgroundColor: Color(0xFFF3F4F6),
                          color: Color(0xFF1F2937),
                          fontFamily: 'monospace',
                          fontSize: 13,
                        ),
                        a: const TextStyle(
                          color: Color(0xFF6366F1),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      onTapLink: (text, href, title) {
                        if (href != null) {
                          launchUrl(Uri.parse(href),
                              mode: LaunchMode.externalApplication);
                        }
                      },
                    ),
            ),
            if (!isUser && (m.sources.isNotEmpty || m.suggestedActions.isNotEmpty))
              Padding(
                padding: const EdgeInsets.only(top: 6, left: 2, right: 2),
                child: _sourcesAndActions(m, idx),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sourcesAndActions(_ChatMessage m, int idx) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (m.evidenceLevel == EvidenceTier.online)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 2),
            child: Text(
              'No course materials matched — using peer-reviewed academic literature.',
              style: TextStyle(
                color: Color(0xFF6B7280),
                fontSize: 11,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        if (m.evidenceLevel == EvidenceTier.generalKnowledge)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 2),
            child: Text(
              '⚠️ No course materials or open-access papers from the last 6 years. Verify before relying on the answer.',
              style: TextStyle(
                color: Color(0xFFB45309),
                fontSize: 11,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        if (m.sources.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: m.sources.map(_sourceChip).toList(),
            ),
          ),
        if (m.suggestedActions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: m.suggestedActions.asMap().entries.map((e) {
                final aIdx = e.key;
                final a = e.value;
                return _actionChip(a, idx, aIdx);
              }).toList(),
            ),
          ),
      ],
    );
  }

  Widget _sourceChip(ChatSource s) {
    final isCourse = s.tier == EvidenceTier.course;
    final isOnline = s.tier == EvidenceTier.online;
    final isUnverified =
        s.tier == EvidenceTier.generalKnowledge && s.verified == false;
    Color bg, border, fg;
    IconData icon;
    if (isCourse) {
      bg = const Color(0xFFECFDF5);
      border = const Color(0xFF6EE7B7);
      fg = const Color(0xFF065F46);
      icon = Icons.school;
    } else if (isOnline) {
      bg = const Color(0xFFF0F9FF);
      border = const Color(0xFF7DD3FC);
      fg = const Color(0xFF075985);
      icon = Icons.article_outlined;
    } else if (isUnverified) {
      bg = const Color(0xFFFFFBEB);
      border = const Color(0xFFFCD34D);
      fg = const Color(0xFF92400E);
      icon = Icons.smart_toy_outlined;
    } else {
      bg = const Color(0xFFF9FAFB);
      border = const Color(0xFFE5E7EB);
      fg = const Color(0xFF374151);
      icon = Icons.smart_toy_outlined;
    }

    String label;
    if (isCourse) {
      label = 'Course — ${s.title}${s.docType != null ? ' (${s.docType})' : ''}';
    } else {
      final yr = s.year?.toString() ?? 'n.d.';
      final venue = (s.venue?.isNotEmpty ?? false) ? ' — ${s.venue}' : '';
      final unv = isUnverified ? ' — unverified' : '';
      label = '${s.authors ?? ''} ($yr). ${s.title}$venue$unv';
    }

    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: fg),
          const SizedBox(width: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10.5, color: fg, fontWeight: FontWeight.w500),
            ),
          ),
          if (s.url?.isNotEmpty ?? false) ...[
            const SizedBox(width: 3),
            Icon(Icons.open_in_new, size: 9, color: fg.withValues(alpha: 0.7)),
          ],
        ],
      ),
    );

    if (s.url?.isNotEmpty ?? false) {
      return InkWell(
        onTap: () => launchUrl(Uri.parse(s.url!), mode: LaunchMode.externalApplication),
        child: chip,
      );
    }
    return chip;
  }

  Widget _actionChip(ChatSuggestedAction a, int msgIdx, int actionIdx) {
    final key = '$msgIdx:$actionIdx';
    final busy = _busyActionKey == key;
    final label = a.type == 'flashcards'
        ? 'Generate flashcards'
        : a.type == 'summary'
            ? 'Make a summary'
            : 'Build a quiz';
    return InkWell(
      onTap: _busyActionKey == null ? () => _onActionTap(a, msgIdx, actionIdx) : null,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFEEF2FF),
          border: Border.all(color: const Color(0xFFC7D2FE)),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              const SizedBox(
                width: 11,
                height: 11,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  valueColor: AlwaysStoppedAnimation(Color(0xFF4338CA)),
                ),
              )
            else
              const Icon(Icons.auto_awesome, size: 11, color: Color(0xFF4338CA)),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF3730A3),
                fontWeight: FontWeight.w600,
              ),
            ),
            if (a.evidenceTier != EvidenceTier.course) ...[
              const SizedBox(width: 4),
              Text(
                '⚠ not course',
                style: TextStyle(
                  fontSize: 9,
                  color: const Color(0xFF3730A3).withValues(alpha: 0.7),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _typingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: const Color(0xFFE5E7EB), width: 1),
        ),
        child: const _TypingDots(),
      ),
    );
  }

  Widget _inputBar(dynamic c) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFE5E7EB), width: 1)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputCtrl,
                decoration: InputDecoration(
                  hintText: 'Ask me anything...',
                  filled: true,
                  fillColor: const Color(0xFFF9FAFB),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFA5B4FC), width: 1.5),
                  ),
                ),
                style: const TextStyle(fontSize: 14),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _sending ? null : _send,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFFA855F7)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.send_rounded, size: 18, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();
  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final phase = ((_ctrl.value + i * 0.15) % 1.0);
            final scale = 0.7 + 0.6 * (1 - (phase - 0.5).abs() * 2).clamp(0.0, 1.0);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Transform.scale(
                scale: scale,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: Color(0xFF6366F1),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
