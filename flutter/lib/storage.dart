import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class HistoryEntry {
  final String ean;
  final String? name;
  final String? brand;
  final Grade? grade;
  final DateTime at;

  HistoryEntry({required this.ean, this.name, this.brand, this.grade, required this.at});

  Map<String, dynamic> toJson() =>
      {'ean': ean, 'name': name, 'brand': brand, 'grade': grade?.name, 'at': at.millisecondsSinceEpoch};

  factory HistoryEntry.fromJson(Map<String, dynamic> j) => HistoryEntry(
        ean: j['ean'] as String,
        name: j['name'] as String?,
        brand: j['brand'] as String?,
        grade: j['grade'] == null ? null : gradeFrom(j['grade'] as String),
        at: DateTime.fromMillisecondsSinceEpoch(j['at'] as int),
      );
}

/// Historique des scans et accès Premium simulé, stockés sur l'appareil.
class LocalStore {
  static const _historyKey = 'vt_history';
  static const _premiumKey = 'vt_premium_demo';

  static Future<List<HistoryEntry>> history() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_historyKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).map((e) => HistoryEntry.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> addToHistory(HistoryEntry entry) async {
    final list = (await history()).where((e) => e.ean != entry.ean).toList()..insert(0, entry);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_historyKey, jsonEncode(list.take(8).map((e) => e.toJson()).toList()));
  }

  static Future<bool> isPremium() async => (await SharedPreferences.getInstance()).getBool(_premiumKey) ?? false;

  static Future<void> setPremium(bool value) async =>
      (await SharedPreferences.getInstance()).setBool(_premiumKey, value);

  static Future<void> resetDemo() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_historyKey);
    await prefs.remove(_premiumKey);
  }
}

String timeAgo(DateTime at) {
  final minutes = DateTime.now().difference(at).inMinutes;
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return 'il y a $minutes min';
  final hours = (minutes / 60).round();
  if (hours < 24) return 'il y a $hours h';
  final days = (hours / 24).round();
  return days == 1 ? 'hier' : 'il y a $days jours';
}
