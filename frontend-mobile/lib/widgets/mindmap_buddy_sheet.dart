import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_theme_ext.dart';
import 'glass_card.dart';
import 'badge_chip.dart';

// ── Pastel accent palette — matches Mindmaps / Courses ─────────────────────
const _kSlateBlue = Color(0xFF7C93C5);
const _kLavender = Color(0xFFA79FCD);

class MindmapBuddySheet extends StatefulWidget {
  final String mapId;
  const MindmapBuddySheet({super.key, required this.mapId});

  static Future<void> show(BuildContext context, String mapId) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MindmapBuddySheet(mapId: mapId),
    );
  }

  @override
  State<MindmapBuddySheet> createState() => _MindmapBuddySheetState();
}

class _MindmapBuddySheetState extends State<MindmapBuddySheet> {
  final _chatCtrl = TextEditingController();
  Map<String, dynamic>? _analysis;
  List<Map<String, dynamic>> _suggestions = [];
  List<Map<String, dynamic>> _chatMessages = [];
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _analyze();
  }

  @override
  void dispose() {
    _chatCtrl.dispose();
    super.dispose();
  }

  Future<void> _analyze() async {
    try {
      final data = await ApiService.aiBuddyAnalyze(widget.mapId);
      if (mounted) setState(() { _analysis = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _getSuggestions() async {
    HapticFeedback.lightImpact();
    try {
      final data = await ApiService.aiBuddySuggestAll(widget.mapId);
      if (mounted) {
        setState(() {
          _suggestions = ((data['suggestions'] ?? data['nodes'] ?? []) as List)
              .map((s) => Map<String, dynamic>.from(s))
              .toList();
        });
      }
    } catch (_) {}
  }

  Future<void> _sendChat() async {
    if (_chatCtrl.text.trim().isEmpty) return;
    final msg = _chatCtrl.text.trim();
    _chatCtrl.clear();
    HapticFeedback.lightImpact();

    setState(() {
      _chatMessages.add({'role': 'user', 'text': msg});
      _sending = true;
    });

    try {
      final data = await ApiService.aiBuddyChat(widget.mapId, msg);
      if (mounted) {
        setState(() {
          _chatMessages.add({'role': 'assistant', 'text': data['response']?.toString() ?? ''});
          _sending = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _chatMessages.add({'role': 'assistant', 'text': 'Error: $e'});
          _sending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: BoxDecoration(
          color: c.surfaceCard,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: c.divider, borderRadius: BorderRadius.circular(2))),
            ),
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: _kLavender.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _kLavender.withOpacity(0.30)),
                    ),
                    child: Center(child: Image.asset('assets/images/ai-brain-logo.png', width: 50, height: 50)),
                  ),
                  const SizedBox(width: 10),
                  Text('Mind Map Buddy', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _getSuggestions,
                    icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                    label: const Text('Suggest'),
                    style: TextButton.styleFrom(foregroundColor: _kSlateBlue),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Body
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                children: [
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator(color: _kSlateBlue)),
                    )
                  else ...[
                    // Analysis
                    if (_analysis != null) ...[
                      GlassCard(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Analysis', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                            const SizedBox(height: 8),
                            if (_analysis!['node_count'] != null)
                              Row(children: [
                                BadgeChip(label: '${_analysis!['node_count']} nodes', color: _kSlateBlue),
                                const SizedBox(width: 8),
                                if (_analysis!['depth'] != null) BadgeChip(label: 'Depth: ${_analysis!['depth']}', color: _kLavender),
                              ]),
                            if (_analysis!['feedback'] != null) ...[
                              const SizedBox(height: 8),
                              Text(_analysis!['feedback'].toString(), style: TextStyle(color: c.textSecondary, fontSize: 13, height: 1.4)),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Suggestions
                    if (_suggestions.isNotEmpty) ...[
                      Text('Suggested Nodes', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                      const SizedBox(height: 8),
                      ..._suggestions.map((s) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: GlassCard(
                          borderColor: _kLavender.withOpacity(0.30),
                          padding: const EdgeInsets.all(10),
                          child: Row(
                            children: [
                              const Icon(Icons.add_circle_rounded, color: _kLavender, size: 18),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(s['label']?.toString() ?? s['text']?.toString() ?? '', style: TextStyle(color: c.textPrimary, fontSize: 13, fontWeight: FontWeight.w500)),
                                    if (s['reason'] != null)
                                      Text(s['reason'].toString(), style: TextStyle(color: c.textMuted, fontSize: 11)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                      const SizedBox(height: 12),
                    ],

                    // Chat messages
                    ..._chatMessages.map((m) {
                      final isUser = m['role'] == 'user';
                      return Align(
                        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
                          decoration: BoxDecoration(
                            color: isUser ? _kSlateBlue.withOpacity(0.15) : c.surfaceInput,
                            borderRadius: BorderRadius.circular(14),
                            border: isUser
                                ? Border.all(color: _kSlateBlue.withOpacity(0.30))
                                : null,
                          ),
                          child: Text(m['text']?.toString() ?? '', style: TextStyle(color: c.textPrimary, fontSize: 13, height: 1.4)),
                        ),
                      );
                    }),
                    if (_sending)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: SizedBox(width: 40, height: 20, child: CircularProgressIndicator(color: _kSlateBlue, strokeWidth: 2)),
                        ),
                      ),
                  ],
                ],
              ),
            ),

            // Chat input
            Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              decoration: BoxDecoration(
                color: c.surfaceCard,
                border: Border(top: BorderSide(color: c.divider)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _chatCtrl,
                      style: TextStyle(color: c.textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Ask about your mind map...',
                        hintStyle: TextStyle(color: c.textMuted),
                        filled: true,
                        fillColor: c.surfaceInput,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      ),
                      onSubmitted: (_) => _sendChat(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _sendChat,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _kSlateBlue,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                    ),
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
