import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_theme.dart';
import '../utils/app_theme_ext.dart';
import '../widgets/glass_card.dart';
import '../widgets/badge_chip.dart';

class AiImageGeneratorScreen extends StatefulWidget {
  const AiImageGeneratorScreen({super.key});
  @override
  State<AiImageGeneratorScreen> createState() => _AiImageGeneratorScreenState();
}

class _AiImageGeneratorScreenState extends State<AiImageGeneratorScreen> {
  final _promptCtrl = TextEditingController();
  String? _selectedStyle;
  List<String> _styles = [];
  bool _generating = false;
  Map<String, dynamic>? _result;

  // Quota state
  int _quotaUsed = 0;
  int _quotaLimit = 1;
  bool _quotaLoaded = false;

  bool get _canGenerate => !_quotaLoaded || _quotaUsed < _quotaLimit;

  @override
  void initState() {
    super.initState();
    _loadStyles();
    _loadQuota();
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStyles() async {
    try {
      final raw = await ApiService.aiGetImageStyles();
      if (mounted) {
        setState(() { _styles = raw.map((s) => s.toString()).toList(); });
      }
    } catch (_) {}
  }

  Future<void> _loadQuota() async {
    try {
      final data = await ApiService.aiGetImageQuota();
      if (mounted) {
        setState(() {
          _quotaUsed = (data['used'] as num?)?.toInt() ?? 0;
          _quotaLimit = (data['limit'] as num?)?.toInt() ?? 1;
          _quotaLoaded = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _quotaLoaded = true);
    }
  }

  Future<void> _generate() async {
    if (_promptCtrl.text.trim().isEmpty) return;
    if (!_canGenerate) return;
    HapticFeedback.mediumImpact();
    setState(() { _generating = true; _result = null; });
    try {
      final data = await ApiService.aiGenerateImage(_promptCtrl.text.trim(), style: _selectedStyle);
      if (mounted) {
        setState(() {
          _result = data;
          _generating = false;
          // Update quota from response
          final quota = data['quota'];
          if (quota is Map) {
            _quotaUsed = (quota['used'] as num?)?.toInt() ?? _quotaUsed;
            _quotaLimit = (quota['limit'] as num?)?.toInt() ?? _quotaLimit;
          } else if (data['cached'] != true) {
            // Not cached → consumed one credit
            _quotaUsed = (_quotaUsed + 1).clamp(0, _quotaLimit);
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _generating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.red),
        );
        // Re-fetch quota in case of limit error
        _loadQuota();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isCached = _result?['cached'] == true;

    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        title: const Text('AI Image Generator', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        foregroundColor: c.textPrimary,
        scrolledUnderElevation: 0,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          // Header
          GlassCard(
            gradient: LinearGradient(
              colors: [
                AppColors.purple.withOpacity(context.isDark ? 0.15 : 0.08),
                AppColors.blue.withOpacity(context.isDark ? 0.08 : 0.04),
              ],
            ),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.purple.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.image_rounded, color: AppColors.purple, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Generate Images', style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 2),
                      Text('Create AI-generated images for mind map nodes', style: TextStyle(color: c.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Quota indicator
          if (_quotaLoaded) _buildQuotaBanner(c),
          const SizedBox(height: 12),

          // Prompt
          TextField(
            controller: _promptCtrl,
            maxLines: 3,
            style: TextStyle(color: c.textPrimary, fontSize: 13),
            decoration: AppTheme.inputDecoration(context, label: 'Describe the image...', prefixIcon: Icons.auto_awesome_rounded),
          ),
          const SizedBox(height: 12),

          // Style selector
          if (_styles.isNotEmpty) ...[
            Text('Style', style: TextStyle(color: c.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _styles.map((style) {
                  final isSelected = _selectedStyle == style;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _selectedStyle = isSelected ? null : style);
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.purple.withOpacity(0.15) : c.surfaceInput,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: isSelected ? AppColors.purple : c.border),
                        ),
                        child: Text(style, style: TextStyle(color: isSelected ? AppColors.purple : c.textSecondary, fontSize: 13)),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Generate button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_generating || !_canGenerate) ? null : _generate,
              icon: _generating
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.auto_awesome_rounded, size: 18),
              label: Text(
                _generating
                    ? 'Generating...'
                    : !_canGenerate
                        ? 'Daily Limit Reached'
                        : 'Generate Image',
              ),
              style: AppTheme.gradientButtonStyle(),
            ),
          ),

          // Result
          if (_result != null) ...[
            const SizedBox(height: 24),
            GlassCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (_result!['image_url'] != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        _result!['image_url'].toString(),
                        fit: BoxFit.cover,
                        loadingBuilder: (_, child, progress) => progress == null
                            ? child
                            : SizedBox(
                                height: 200,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    color: AppColors.purple,
                                    value: progress.expectedTotalBytes != null
                                        ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                                        : null,
                                  ),
                                ),
                              ),
                        errorBuilder: (_, __, ___) => SizedBox(
                          height: 200,
                          child: Center(child: Icon(Icons.broken_image_rounded, color: c.textMuted, size: 48)),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (isCached)
                        BadgeChip(label: 'Cached', color: AppColors.emerald),
                      if (isCached) const SizedBox(width: 8),
                      if (_result!['style'] != null)
                        BadgeChip(label: _result!['style'].toString(), color: AppColors.purple),
                      const SizedBox(width: 8),
                      BadgeChip(label: 'AI Generated', color: AppColors.blue),
                    ],
                  ),
                  if (isCached) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Reused from cache — no credit deducted',
                      style: TextStyle(color: AppColors.emerald, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQuotaBanner(dynamic c) {
    final remaining = _quotaLimit - _quotaUsed;
    final exhausted = remaining <= 0;
    final color = exhausted ? AppColors.red : AppColors.emerald;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Icon(
            exhausted ? Icons.block_rounded : Icons.bolt_rounded,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              exhausted
                  ? 'Daily limit reached ($_quotaUsed/$_quotaLimit). Try again tomorrow.'
                  : '$remaining generation${remaining == 1 ? "" : "s"} remaining today ($_quotaUsed/$_quotaLimit used)',
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
