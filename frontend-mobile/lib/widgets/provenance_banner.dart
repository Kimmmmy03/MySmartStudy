import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/ai_chat.dart';

/// Banner shown at the top of an AI-generated Study Material so the student
/// always sees where it was sourced from: their lecturer's course notes,
/// peer-reviewed papers from the last 6 years, or AI general knowledge.
///
/// Reads `evidence_tier` + `citations` (+ optional `provenance_banner` markdown
/// fallback) from the material map and renders the right tier-coloured card.
class ProvenanceBanner extends StatelessWidget {
  /// The raw material map as returned by /ai/study-materials/. Older materials
  /// without these fields render nothing (graceful no-op).
  final Map<String, dynamic> material;

  const ProvenanceBanner({super.key, required this.material});

  @override
  Widget build(BuildContext context) {
    final tierStr = material['evidence_tier'] as String?;
    final tier = evidenceTierFromString(tierStr);
    if (tier == null) {
      // Back-compat: pre-tier materials simply don't show a banner.
      return const SizedBox.shrink();
    }

    final citationsRaw = (material['citations'] as List?) ?? const [];
    final citations = citationsRaw
        .whereType<Map>()
        .map((m) => ChatSource.fromJson(Map<String, dynamic>.from(m)))
        .toList();

    final theme = Theme.of(context);
    Color borderColor;
    Color bgColor;
    Color textColor;
    String heading;
    IconData icon;

    switch (tier) {
      case EvidenceTier.course:
        borderColor = Colors.green.shade300;
        bgColor = Colors.green.shade50;
        textColor = Colors.green.shade900;
        heading = '🎓 Generated from your lecturer\'s course notes';
        icon = Icons.school;
        break;
      case EvidenceTier.online:
        borderColor = Colors.blue.shade300;
        bgColor = Colors.blue.shade50;
        textColor = Colors.blue.shade900;
        heading =
            '⚠️ NOT from your course notes. Sourced from academic literature (last 6 years).';
        icon = Icons.article_outlined;
        break;
      case EvidenceTier.generalKnowledge:
      case EvidenceTier.mixed:
        borderColor = Colors.amber.shade400;
        bgColor = Colors.amber.shade50;
        textColor = Colors.amber.shade900;
        heading =
            '⚠️ NOT from your course notes. AI general knowledge with no verifiable academic sources for this topic.';
        icon = Icons.smart_toy_outlined;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: textColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  heading,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (citations.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...citations.take(5).map((c) => _CitationLine(citation: c, color: textColor)),
          ],
          if (tier == EvidenceTier.generalKnowledge) ...[
            const SizedBox(height: 6),
            Text(
              'Cross-check key facts before relying on them.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: textColor.withValues(alpha: 0.8),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Alternative renderer that uses the raw `provenance_banner` markdown
  /// string stored on the material — useful when the backend updates the
  /// banner copy without us shipping a new mobile build.
  ///
  /// Currently unused; we render structured tiles above for better mobile UX,
  /// but kept here so future banner copy changes can be picked up.
  // ignore: unused_element
  Widget _renderRawMarkdown(String md) {
    return MarkdownBody(data: md, selectable: false);
  }
}

class _CitationLine extends StatelessWidget {
  final ChatSource citation;
  final Color color;
  const _CitationLine({required this.citation, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = citation;
    final head = (c.authors?.isNotEmpty ?? false)
        ? '${c.authors} (${c.year ?? 'n.d.'}). ${c.title}.'
        : c.title;
    final venue = (c.venue?.isNotEmpty ?? false) ? ' ${c.venue}.' : '';
    final unverified =
        c.tier == EvidenceTier.generalKnowledge && c.verified == false;
    final theme = Theme.of(context);

    final body = Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '– '),
          TextSpan(
            text: head,
            style: TextStyle(
              decoration:
                  (c.url?.isNotEmpty ?? false) ? TextDecoration.underline : null,
            ),
          ),
          TextSpan(text: venue),
          if (unverified)
            TextSpan(
              text: '  (unverified)',
              style: TextStyle(
                fontStyle: FontStyle.italic,
                color: color.withValues(alpha: 0.7),
              ),
            ),
        ],
      ),
      style: theme.textTheme.bodySmall?.copyWith(color: color),
    );

    if ((c.url?.isNotEmpty ?? false)) {
      return InkWell(
        onTap: () => launchUrl(Uri.parse(c.url!),
            mode: LaunchMode.externalApplication),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 1),
          child: body,
        ),
      );
    }
    return Padding(padding: const EdgeInsets.symmetric(vertical: 1), child: body);
  }
}
