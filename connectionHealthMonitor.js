/**
 * WebSocket Connection Health Monitor
 * Monitors connection quality and provides metrics to prevent audio issues
 */

class ConnectionHealthMonitor {
  constructor(options = {}) {
    this.checkInterval = options.checkInterval || 5000; // Health check every 5 seconds
    this.pingInterval = options.pingInterval || 30000; // Ping every 30 seconds
    this.timeoutThreshold = options.timeoutThreshold || 10000; // 10 second timeout
    this.latencyThreshold = options.latencyThreshold || 200; // 200ms latency threshold
    
    this.connections = new Map(); // Track multiple connections
    this.healthCheckTimer = null;
    this.isMonitoring = false;
    
    // Global health metrics
    this.globalMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      averageLatency: 0,
      connectionErrors: 0,
      lastHealthCheck: null
    };
  }

  /**
   * Register a WebSocket connection for monitoring
   */
  registerConnection(connectionId, websocket, metadata = {}) {
    const connection = {
      id: connectionId,
      websocket: websocket,
      metadata: metadata,
      
      // Health metrics
      isHealthy: true,
      lastPing: null,
      lastPong: null,
      latency: 0,
      connectionTime: Date.now(),
      
      // Statistics
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errors: 0,
      reconnectCount: 0,
      
      // Quality metrics
      qualityScore: 100, // 0-100 scale
      stabilityScore: 100,
      performanceScore: 100
    };
    
    this.connections.set(connectionId, connection);
    this.globalMetrics.totalConnections++;
    this.globalMetrics.activeConnections++;
    
    // Set up WebSocket event listeners
    this.setupConnectionListeners(connection);
    
    console.log(`🔗 HEALTH_MONITOR: Registered connection ${connectionId} (${metadata.type || 'unknown'})`);
    
    // Start monitoring if this is the first connection
    if (!this.isMonitoring) {
      this.startMonitoring();
    }
    
    return connection;
  }

  /**
   * Set up WebSocket event listeners for health monitoring
   */
  setupConnectionListeners(connection) {
    const ws = connection.websocket;
    
    // Track messages
    const originalSend = ws.send.bind(ws);
    ws.send = (data) => {
      connection.messagesSent++;
      connection.bytesTransferred += data.length || data.byteLength || 0;
      return originalSend(data);
    };
    
    // Monitor connection events
    ws.on('message', (data) => {
      connection.messagesReceived++;
      connection.bytesTransferred += data.length || data.byteLength || 0;
      
      // Check for pong responses
      if (data.toString() === 'pong') {
        connection.lastPong = Date.now();
        if (connection.lastPing) {
          connection.latency = connection.lastPong - connection.lastPing;
        }
      }
    });
    
    ws.on('error', (error) => {
      connection.errors++;
      connection.isHealthy = false;
      this.globalMetrics.connectionErrors++;
      console.error(`❌ HEALTH_MONITOR: Connection ${connection.id} error:`, error.message);
    });
    
    ws.on('close', () => {
      connection.isHealthy = false;
      this.globalMetrics.activeConnections--;
      console.log(`🔌 HEALTH_MONITOR: Connection ${connection.id} closed`);
    });
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    console.log('🏥 HEALTH_MONITOR: Starting connection health monitoring');
    this.isMonitoring = true;
    
    // Start periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);
    
    // Start periodic ping checks
    setInterval(() => {
      this.performPingCheck();
    }, this.pingInterval);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    console.log('🛑 HEALTH_MONITOR: Stopping connection health monitoring');
    this.isMonitoring = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Perform comprehensive health check on all connections
   */
  performHealthCheck() {
    const timestamp = Date.now();
    let totalLatency = 0;
    let healthyConnections = 0;
    
    console.log(`🏥 HEALTH_MONITOR: Performing health check on ${this.connections.size} connections`);
    
    for (const [connectionId, connection] of this.connections) {
      // Check WebSocket state
      const wsState = connection.websocket.readyState;
      const isConnected = wsState === 1; // WebSocket.OPEN
      
      // Update connection health
      connection.isHealthy = isConnected && connection.errors < 5;
      
      if (connection.isHealthy) {
        healthyConnections++;
        totalLatency += connection.latency;
      }
      
      // Calculate quality scores
      this.calculateQualityScores(connection);
      
      // Log connection status
      const status = connection.isHealthy ? '✅' : '❌';
      console.log(
        `${status} HEALTH_MONITOR: ${connectionId} - ` +
        `Latency: ${connection.latency}ms, ` +
        `Quality: ${connection.qualityScore}%, ` +
        `Messages: ${connection.messagesSent}/${connection.messagesReceived}, ` +
        `Errors: ${connection.errors}`
      );
    }
    
    // Update global metrics
    this.globalMetrics.averageLatency = healthyConnections > 0 ? 
      totalLatency / healthyConnections : 0;
    this.globalMetrics.lastHealthCheck = timestamp;
    
    // Check for unhealthy connections
    this.handleUnhealthyConnections();
  }

  /**
   * Perform ping check on all connections
   */
  performPingCheck() {
    console.log('🏓 HEALTH_MONITOR: Performing ping check');
    
    for (const [connectionId, connection] of this.connections) {
      if (connection.websocket.readyState === 1) { // WebSocket.OPEN
        try {
          connection.lastPing = Date.now();
          connection.websocket.send('ping');
        } catch (error) {
          console.error(`❌ HEALTH_MONITOR: Failed to ping ${connectionId}:`, error.message);
          connection.errors++;
        }
      }
    }
  }

  /**
   * Calculate quality scores for a connection
   */
  calculateQualityScores(connection) {
    const now = Date.now();
    const connectionAge = now - connection.connectionTime;
    
    // Performance score based on latency
    if (connection.latency <= 50) {
      connection.performanceScore = 100;
    } else if (connection.latency <= 100) {
      connection.performanceScore = 90;
    } else if (connection.latency <= this.latencyThreshold) {
      connection.performanceScore = 70;
    } else {
      connection.performanceScore = 40;
    }
    
    // Stability score based on errors and uptime
    const errorRate = connectionAge > 0 ? (connection.errors / (connectionAge / 1000)) : 0;
    if (errorRate === 0) {
      connection.stabilityScore = 100;
    } else if (errorRate < 0.1) {
      connection.stabilityScore = 90;
    } else if (errorRate < 0.5) {
      connection.stabilityScore = 70;
    } else {
      connection.stabilityScore = 40;
    }
    
    // Overall quality score
    connection.qualityScore = Math.round(
      (connection.performanceScore + connection.stabilityScore) / 2
    );
  }

  /**
   * Handle unhealthy connections
   */
  handleUnhealthyConnections() {
    const unhealthyConnections = [];
    
    for (const [connectionId, connection] of this.connections) {
      if (!connection.isHealthy || connection.qualityScore < 50) {
        unhealthyConnections.push(connection);
      }
    }
    
    if (unhealthyConnections.length > 0) {
      console.warn(
        `⚠️ HEALTH_MONITOR: Found ${unhealthyConnections.length} unhealthy connections`
      );
      
      // Emit health warning event
      this.emitHealthWarning(unhealthyConnections);
    }
  }

  /**
   * Emit health warning event
   */
  emitHealthWarning(unhealthyConnections) {
    const warning = {
      timestamp: Date.now(),
      type: 'connection_health_warning',
      unhealthyConnections: unhealthyConnections.map(conn => ({
        id: conn.id,
        qualityScore: conn.qualityScore,
        latency: conn.latency,
        errors: conn.errors,
        isHealthy: conn.isHealthy
      })),
      globalMetrics: this.getGlobalMetrics()
    };
    
    // Log warning
    console.warn('⚠️ HEALTH_MONITOR: Health warning emitted:', warning);
    
    // Could emit to event system or callback here
    if (this.onHealthWarning) {
      this.onHealthWarning(warning);
    }
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }
    
    return {
      id: connection.id,
      isHealthy: connection.isHealthy,
      latency: connection.latency,
      qualityScore: connection.qualityScore,
      stabilityScore: connection.stabilityScore,
      performanceScore: connection.performanceScore,
      messagesSent: connection.messagesSent,
      messagesReceived: connection.messagesReceived,
      bytesTransferred: connection.bytesTransferred,
      errors: connection.errors,
      connectionAge: Date.now() - connection.connectionTime
    };
  }

  /**
   * Get global health metrics
   */
  getGlobalMetrics() {
    return {
      ...this.globalMetrics,
      healthyConnections: Array.from(this.connections.values())
        .filter(conn => conn.isHealthy).length,
      averageQualityScore: this.calculateAverageQualityScore()
    };
  }

  /**
   * Calculate average quality score across all connections
   */
  calculateAverageQualityScore() {
    const connections = Array.from(this.connections.values());
    if (connections.length === 0) return 100;
    
    const totalScore = connections.reduce((sum, conn) => sum + conn.qualityScore, 0);
    return Math.round(totalScore / connections.length);
  }

  /**
   * Set health warning callback
   */
  setHealthWarningCallback(callback) {
    this.onHealthWarning = callback;
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.globalMetrics.activeConnections--;
      console.log(`🔌 HEALTH_MONITOR: Unregistered connection ${connectionId}`);
      
      // Stop monitoring if no connections remain
      if (this.connections.size === 0) {
        this.stopMonitoring();
      }
    }
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses() {
    const statuses = {};
    for (const [connectionId, connection] of this.connections) {
      statuses[connectionId] = this.getConnectionHealth(connectionId);
    }
    return statuses;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    for (const connection of this.connections.values()) {
      connection.messagesSent = 0;
      connection.messagesReceived = 0;
      connection.bytesTransferred = 0;
      connection.errors = 0;
      connection.reconnectCount = 0;
    }
    
    this.globalMetrics.connectionErrors = 0;
    console.log('🔄 HEALTH_MONITOR: Metrics reset');
  }
}

export { ConnectionHealthMonitor };