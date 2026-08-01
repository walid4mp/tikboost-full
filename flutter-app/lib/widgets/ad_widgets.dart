import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import '../config/app_theme.dart';
import '../services/admob_service.dart';

class BannerAdCard extends StatefulWidget {
  const BannerAdCard({super.key});

  @override
  State<BannerAdCard> createState() => _BannerAdCardState();
}

class _BannerAdCardState extends State<BannerAdCard> {
  BannerAd? _ad;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _ad = AdMobService.instance.createBannerAd(
      onLoaded: () => mounted ? setState(() => _loaded = true) : null,
      onFailed: (_) => mounted ? setState(() => _loaded = false) : null,
    )..load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _ad == null) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: SizedBox(
          width: _ad!.size.width.toDouble(),
          height: _ad!.size.height.toDouble(),
          child: AdWidget(ad: _ad!),
        ),
      ),
    );
  }
}

class NativeAdCard extends StatefulWidget {
  const NativeAdCard({super.key});

  @override
  State<NativeAdCard> createState() => _NativeAdCardState();
}

class _NativeAdCardState extends State<NativeAdCard> {
  NativeAd? _ad;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _ad = AdMobService.instance.createNativeAd(
      onLoaded: () => mounted ? setState(() => _loaded = true) : null,
      onFailed: (_) => mounted ? setState(() => _loaded = false) : null,
    )..load();
  }

  @override
  void dispose() {
    _ad?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _ad == null) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(14, 14, 14, 0),
            child: Text(
              'إعلان ممول',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(height: 320, child: AdWidget(ad: _ad!)),
        ],
      ),
    );
  }
}
