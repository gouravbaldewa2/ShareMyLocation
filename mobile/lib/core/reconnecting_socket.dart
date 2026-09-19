import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'api.dart';

enum SocketStatus { connecting, connected, reconnecting, closed }

/// A WebSocket that rebuilds itself after a drop.
///
/// The server keeps its association per connection — which location a socket is
/// sharing, which fleet it is watching — so a reconnect is only useful if the
/// registration message is replayed on the new socket. [registration] is sent
/// as the first frame of every connection attempt, including reconnects.
///
/// Mobile sockets drop constantly (tower handoff, wifi/cellular switch, doze),
/// and without this a live share goes silently dead while the UI still claims
/// it is broadcasting.
class ReconnectingSocket {
  ReconnectingSocket({
    required this.registration,
    this.onMessage,
    this.onStatusChange,
    this.onReconnected,
  });

  /// Sent as the first frame on every (re)connect.
  final Map<String, dynamic> registration;

  final void Function(Map<String, dynamic> message)? onMessage;
  final void Function(SocketStatus status)? onStatusChange;

  /// Called after a *re*connect (not the initial connect), so callers can
  /// resend state the server lost with the old connection.
  final void Function()? onReconnected;

  static const Duration _baseBackoff = Duration(seconds: 1);
  static const Duration _maxBackoff = Duration(seconds: 30);

  final Random _random = Random();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _retryTimer;
  int _attempt = 0;
  bool _hasConnectedBefore = false;
  bool _disposed = false;
  SocketStatus _status = SocketStatus.closed;

  SocketStatus get status => _status;
  bool get isConnected => _status == SocketStatus.connected;

  Future<void> connect() async {
    if (_disposed) return;

    _retryTimer?.cancel();
    _setStatus(
      _hasConnectedBefore ? SocketStatus.reconnecting : SocketStatus.connecting,
    );

    try {
      final channel = WebSocketChannel.connect(Uri.parse(ApiClient.wsUrl));
      _channel = channel;

      _subscription = channel.stream.listen(
        _handleFrame,
        onError: (Object e) {
          debugPrint('ReconnectingSocket: stream error: $e');
          _scheduleReconnect();
        },
        onDone: _scheduleReconnect,
        cancelOnError: true,
      );

      // Surfaces a failed handshake instead of letting it look connected.
      await channel.ready;
      if (_disposed) {
        await channel.sink.close();
        return;
      }

      channel.sink.add(jsonEncode(registration));

      final isReconnect = _hasConnectedBefore;
      _attempt = 0;
      _hasConnectedBefore = true;
      _setStatus(SocketStatus.connected);
      if (isReconnect) onReconnected?.call();
    } catch (e) {
      debugPrint('ReconnectingSocket: connect failed: $e');
      _scheduleReconnect();
    }
  }

  void _handleFrame(dynamic raw) {
    if (_disposed) return;
    try {
      final decoded = jsonDecode(raw as String);
      if (decoded is Map<String, dynamic>) {
        onMessage?.call(decoded);
      }
    } catch (e) {
      debugPrint('ReconnectingSocket: unreadable frame: $e');
    }
  }

  /// Sends [message] if the socket is up.
  ///
  /// Returns false when it was dropped. Queueing is deliberately not done: these
  /// are location updates, and a backlog of stale coordinates replayed after a
  /// reconnect is worse than the gap itself.
  bool send(Map<String, dynamic> message) {
    if (_disposed || !isConnected || _channel == null) return false;
    try {
      _channel!.sink.add(jsonEncode(message));
      return true;
    } catch (e) {
      debugPrint('ReconnectingSocket: send failed: $e');
      _scheduleReconnect();
      return false;
    }
  }

  void _scheduleReconnect() {
    if (_disposed || _retryTimer?.isActive == true) return;

    _teardownChannel();
    _setStatus(SocketStatus.reconnecting);

    // Exponential backoff with jitter, so a server restart doesn't get a
    // synchronised stampede from every client at once.
    final exponent = min(_attempt, 5);
    final backoffMs = _baseBackoff.inMilliseconds * pow(2, exponent).toInt();
    final cappedMs = min(backoffMs, _maxBackoff.inMilliseconds);
    final jitterMs = _random.nextInt((cappedMs ~/ 2) + 1);
    _attempt++;

    _retryTimer = Timer(Duration(milliseconds: cappedMs ~/ 2 + jitterMs), () {
      connect();
    });
  }

  void _teardownChannel() {
    _subscription?.cancel();
    _subscription = null;
    try {
      _channel?.sink.close();
    } catch (_) {
      // Already gone; nothing to close.
    }
    _channel = null;
  }

  void _setStatus(SocketStatus status) {
    if (_status == status) return;
    _status = status;
    onStatusChange?.call(status);
  }

  /// Sends a final message (best effort) and closes for good.
  void dispose({Map<String, dynamic>? farewell}) {
    if (_disposed) return;

    if (farewell != null && isConnected && _channel != null) {
      try {
        _channel!.sink.add(jsonEncode(farewell));
      } catch (_) {
        // Connection already gone — the server's close handler covers this.
      }
    }

    _disposed = true;
    _retryTimer?.cancel();
    _retryTimer = null;
    _teardownChannel();
    _status = SocketStatus.closed;
  }
}
