import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../config/app_theme.dart';
import '../services/admob_service.dart';

class BannerAdCard extends StatefulWidget {
  final String? userId;
  const BannerAdCard({super.key, this.userId});

  @override
  State<BannerAdCard> createState() => _BannerAdCardState();
}

class _BannerAdCardState extends State<BannerAdCard> {
  BannerAd? _ad;
  bool _loaded = false;
  bool _customImageFailed = false;

  bool get _customAvailable {
    final url = AdMobService.instance.customBannerImageUrl.trim();
    if (!AdMobService.instance.customBannerEnabled || url.isEmpty) return false;
    final uri = Uri.tryParse(url);
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
  }

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    if (widget.userId != null) {
      await AdMobService.instance.loadUserAdConfig();
    }
    if (!mounted || AdMobService.instance.adsSuppressed) return;
    if (_customAvailable) {
      if (mounted) setState(() {});
      return;
    }
    _loadAdMobBanner();
  }

  void _loadAdMobBanner() {
    if (!mounted || !AdMobService.instance.bannerEnabled || _ad != null) return;
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
    if (AdMobService.instance.adsSuppressed) return const SizedBox.shrink();
    final customUrl = AdMobService.instance.customBannerImageUrl;
    if (_customAvailable && !_customImageFailed) {
      final link = AdMobService.instance.customBannerLinkUrl;
      return GestureDetector(
        onTap: link.isEmpty ? null : () => launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            border: const Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              customUrl,
              width: double.infinity,
              height: 72,
              fit: BoxFit.cover,
              filterQuality: FilterQuality.medium,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return const SizedBox(
                  height: 72,
                  child: Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                );
              },
              errorBuilder: (_, __, ___) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && !_customImageFailed) {
                    setState(() => _customImageFailed = true);
                    _loadAdMobBanner();
                  }
                });
                return const SizedBox(height: 72);
              },
            ),
          ),
        ),
      );
    }
    if (!_loaded || _ad == null || !AdMobService.instance.bannerEnabled) {
      return const SizedBox.shrink();
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SizedBox(
        width: _ad!.size.width.toDouble(),
        height: _ad!.size.height.toDouble(),
        child: AdWidget(ad: _ad!),
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
    if (!AdMobService.instance.nativeEnabled) return;
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
