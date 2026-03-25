import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/fleet_manager.dart';

class CreateFleetScreen extends StatefulWidget {
  const CreateFleetScreen({super.key});

  @override
  State<CreateFleetScreen> createState() => _CreateFleetScreenState();
}

class _CreateFleetScreenState extends State<CreateFleetScreen> {
  final ApiClient _api = ApiClient();
  final FleetManager _fleetManager = FleetManager();
  final TextEditingController _fleetNameController = TextEditingController();
  final TextEditingController _vehicleNameController = TextEditingController();
  
  List<String> _vehicles = [];
  bool _isCreating = false;

  void _addVehicle() {
    final name = _vehicleNameController.text.trim();
    if (name.isNotEmpty) {
      setState(() {
        _vehicles.add(name);
        _vehicleNameController.clear();
      });
    }
  }

  void _removeVehicle(int index) {
    setState(() {
      _vehicles.removeAt(index);
    });
  }

  Future<void> _createFleet() async {
    final name = _fleetNameController.text.trim();
    if (name.isEmpty) return;

    setState(() => _isCreating = true);
    try {
      final fleet = await _api.createFleet(
        name: name,
      );

      // Save to local storage for My Fleets tab
      await _fleetManager.saveFleet(fleet.id, fleet.adminCode);

      if (mounted) {
        context.pushReplacement('/fleet_admin/${fleet.adminCode}');
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().contains('SocketException') || e.toString().contains('Failed host lookup')
            ? 'Unable to connect. Please check your internet connection and try again.'
            : 'Something went wrong. Please try again.';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Fleet'),
        backgroundColor: Colors.transparent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _fleetNameController,
              decoration: const InputDecoration(
                labelText: 'Fleet Name',
                hintText: 'e.g. Resort Buggies',
                filled: true,
                fillColor: Color(0xFF1A1A24),
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00B4D8),
                  foregroundColor: Colors.white,
                ),
                onPressed: _isCreating ? null : () {
                  HapticFeedback.lightImpact();
                  _createFleet();
                },
                child: _isCreating 
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Create Fleet', style: TextStyle(fontSize: 18)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
