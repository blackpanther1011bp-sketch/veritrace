import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/product_screen.dart';

/// Ouvre la fiche d'un code-barres scanné ou saisi.
Future<void> openProduct(BuildContext context, String ean, {bool countScan = true}) {
  if (countScan) Api.instance.track('scan', ean: ean);
  return Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductScreen(ean: ean)));
}
