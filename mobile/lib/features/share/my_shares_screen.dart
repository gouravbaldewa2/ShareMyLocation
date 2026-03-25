import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/share_manager.dart';
import '../../core/models.dart';
import '../../core/api.dart';

class MySharesScreen extends StatefulWidget {
  final bool showAppBar;
  const MySharesScreen({super.key, this.showAppBar = false});

  @override
  State<MySharesScreen> createState() => MySharesScreenState();
}

class MySharesScreenState extends State<MySharesScreen> {
  final ShareManager _shareManager = ShareManager();
  List<LocationModel> _shares = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    loadShares();
  }

  Future<void> loadShares() async {
    setState(() => _isLoading = true);
    final shares = await _shareManager.fetchMyShares();
    if (mounted) {
      setState(() {
        _shares = shares;
        _isLoading = false;
      });
    }
  }

  Future<void> _confirmDeleteShare(LocationModel share) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A24),
        title: const Text(
          'Stop Sharing?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'This will stop sharing and delete this location share.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      setState(() => _isLoading = true);
      try {
        await ApiClient().deleteLocation(share.id);
        await _shareManager.removeShare(share.id);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Error deleting share')));
        }
      }
      loadShares();
    }
  }

  String _formatTimeRemaining(DateTime expiresAt) {
    final remaining = expiresAt.difference(DateTime.now());
    if (remaining.isNegative) return 'Expired';
    if (remaining.inMinutes < 60) return '${remaining.inMinutes}m left';
    if (remaining.inHours < 24) return '${remaining.inHours}h left';
    return '${remaining.inDays}d left';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.showAppBar
          ? AppBar(
              title: const Text('My Shares'),
              backgroundColor: Colors.transparent,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: () => loadShares(),
                ),
              ],
            )
          : null,
      body: RefreshIndicator(
        onRefresh: loadShares,
        color: const Color(0xFF00B4D8),
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF00B4D8)),
              )
            : _shares.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 300),
                  Center(
                    child: Text(
                      "No Active Shares. Tap '+' to share your location.",
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _shares.length,
                itemBuilder: (context, index) {
                  final share = _shares[index];
                  return Card(
                    color: const Color(0xFF1A1A24),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      onTap: () async {
                        HapticFeedback.lightImpact();
                        await context.push(
                          '/sharing_active/${share.id}?isLive=${share.isLive}',
                        );
                        loadShares();
                      },
                      leading: Icon(
                        share.isLive ? Icons.my_location : Icons.location_on,
                        color: share.isLive
                            ? const Color(0xFF2ECC71)
                            : const Color(0xFF00B4D8),
                      ),
                      title: Text(
                        share.isLive ? 'Live Share' : 'Snapshot',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        _formatTimeRemaining(share.expiresAt),
                        style: TextStyle(
                          color:
                              share.expiresAt
                                      .difference(DateTime.now())
                                      .inMinutes <
                                  5
                              ? Colors.redAccent
                              : Colors.grey,
                        ),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.grey),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          _confirmDeleteShare(share);
                        },
                      ),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 100),
        child: FloatingActionButton(
          backgroundColor: const Color(0xFF00B4D8),
          onPressed: () async {
            HapticFeedback.lightImpact();
            await context.push('/share_setup');
            loadShares();
          },
          child: const Icon(Icons.add, color: Colors.white),
        ),
      ),
    );
  }
}
