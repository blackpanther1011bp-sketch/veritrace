import 'package:flutter/material.dart';

import 'models.dart';
import 'theme.dart';

class GradeBadge extends StatelessWidget {
  final Grade? grade;
  final double size;
  final bool round;

  const GradeBadge({super.key, required this.grade, this.size = 44, this.round = false});

  @override
  Widget build(BuildContext context) {
    final g = grade;
    return Semantics(
      label: g == null ? 'Pas de note' : 'Note ${g.name}',
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: g == null ? const Color(0xFFDDE3DE) : gradeColor[g],
          borderRadius: BorderRadius.circular(round ? size / 2 : size * 0.28),
        ),
        child: Text(
          g?.name ?? '?',
          style: TextStyle(fontSize: size * 0.46, fontWeight: FontWeight.w700, color: VT.ink),
        ),
      ),
    );
  }
}

class GradeScale extends StatelessWidget {
  final Grade grade;
  const GradeScale({super.key, required this.grade});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Note ${grade.name} sur une échelle de A à E',
      excludeSemantics: true,
      child: Row(
        children: [
          for (final g in Grade.values) ...[
            Expanded(
              child: Container(
                height: g == grade ? 12 : 8,
                decoration: BoxDecoration(
                  color: gradeColor[g]!.withValues(alpha: g == grade ? 1 : 0.3),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            if (g != Grade.E) const SizedBox(width: 4),
          ],
        ],
      ),
    );
  }
}

class CardBox extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final VoidCallback? onTap;

  const CardBox({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color = VT.card, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class MethodNote extends StatelessWidget {
  final String text;
  const MethodNote({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFB7C2BA)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 20, color: VT.muted),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, height: 1.45, color: VT.muted))),
        ],
      ),
    );
  }
}

class SampleTag extends StatelessWidget {
  const SampleTag({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: VT.line, borderRadius: BorderRadius.circular(999)),
      child: const Text('Exemple', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: VT.muted)),
    );
  }
}

class ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Connexion impossible', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            const Text('Vérifiez votre connexion internet, puis réessayez.',
                textAlign: TextAlign.center, style: TextStyle(color: VT.muted)),
            const SizedBox(height: 20),
            FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}
