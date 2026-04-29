import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class JoinGuestFleetScreen extends StatefulWidget {
  const JoinGuestFleetScreen({super.key});

  @override
  State<JoinGuestFleetScreen> createState() => _JoinGuestFleetScreenState();
}

class _JoinGuestFleetScreenState extends State<JoinGuestFleetScreen> {
  final TextEditingController _controller = TextEditingController();

  void _joinFleet() {
    String input = _controller.text.trim();
    if (input.isEmpty) return;

    // Handle full URL or just the ID
    // Example: https://sharemylocation.../fleet/xyz123
    String fleetId = input;
    if (input.contains('/fleet/')) {
      fleetId = input.split('/fleet/').last.split('?').first;
    }

    // Navigate to the guest screen
    context.push('/fleet/$fleetId');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Track Guest Fleet'),
        backgroundColor: Colors.transparent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.location_on, size: 64, color: Color(0xFF00B4D8)),
            const SizedBox(height: 24),
            const Text(
              'Enter a Fleet ID or Paste the Share Link',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: 'e.g. abc123xyz or https://...',
                filled: true,
                fillColor: const Color(0xFF1A1A24),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                prefixIcon: const Icon(Icons.link, color: Colors.grey),
              ),
              onSubmitted: (_) => _joinFleet(),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                HapticFeedback.lightImpact();
                _joinFleet();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00B4D8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Track Fleet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
