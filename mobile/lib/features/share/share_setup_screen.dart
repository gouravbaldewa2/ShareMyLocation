import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/location_service.dart';
import '../../core/share_manager.dart';

class ShareSetupScreen extends StatefulWidget {
  const ShareSetupScreen({super.key});

  @override
  State<ShareSetupScreen> createState() => _ShareSetupScreenState();
}

class _ShareSetupScreenState extends State<ShareSetupScreen> {
  final ApiClient _apiClient = ApiClient();
  final ShareManager _shareManager = ShareManager();
  bool isLive = false;
  int selectedExpiry = 60; // minutes
  final TextEditingController _nameController = TextEditingController();
  bool _isLoading = false;

  void _startSharing() async {
    setState(() => _isLoading = true);
    try {
      final position = await LocationService.determinePosition(context);
      if (position == null) {
        setState(() => _isLoading = false);
        return; // user didn't give permission or GPS is off
      }

      final loc = await _apiClient.createLocation(
        lat: position.latitude,
        lng: position.longitude,
        isLive: isLive,
        expiresInMinutes: isLive ? selectedExpiry : 15,
      );

      // Save the share locally
      await _shareManager.saveShare(
        locationId: loc.id,
        isLive: isLive,
      );

      if (mounted) {
         context.push('/sharing_active/${loc.id}?isLive=$isLive');
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')
            ? 'Unable to connect. Please check your internet connection and try again.'
            : 'Something went wrong. Please try again.';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Share Setup'),
        backgroundColor: Colors.transparent,
      ),
      body: Padding(
        padding: EdgeInsets.only(
          left: 24.0,
          right: 24.0,
          top: 24.0,
          bottom: 24.0 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ChoiceChip(
                  label: const Text('Snapshot'),
                  selected: !isLive,
                  onSelected: (val) {
                    HapticFeedback.lightImpact();
                    setState(() => isLive = false);
                  },
                  selectedColor: const Color(0xFF00B4D8),
                ),
                const SizedBox(width: 16),
                ChoiceChip(
                  label: const Text('Live'),
                  selected: isLive,
                  onSelected: (val) {
                    HapticFeedback.lightImpact();
                    setState(() => isLive = true);
                  },
                  selectedColor: const Color(0xFF00B4D8),
                ),
              ],
            ),
            const SizedBox(height: 32),
            if (isLive) ...[
              const Text('Expiry Options'),
              // simple chips for expiry
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [15, 30, 60, 360, 1440].map((mins) {
                    final isSelected = selectedExpiry == mins;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: ChoiceChip(
                        label: Text(mins < 60 ? '$mins min' : '${mins~/60} hr'),
                        selected: isSelected,
                        onSelected: (val) {
                          HapticFeedback.lightImpact();
                          setState(() => selectedExpiry = mins);
                        },
                        selectedColor: const Color(0xFF00B4D8),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 32),
            ],
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                hintText: 'Share Name (e.g. At office)',
                filled: true,
                fillColor: Color(0xFF1A1A24),
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00B4D8),
                  foregroundColor: Colors.white,
                ),
                onPressed: _isLoading ? null : () {
                  HapticFeedback.lightImpact();
                  _startSharing();
                },
                child: _isLoading 
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Start Sharing', style: TextStyle(fontSize: 18)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
