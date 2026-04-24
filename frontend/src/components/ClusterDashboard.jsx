import React, { useState, useEffect } from 'react';
import socket from '../socket';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Server, 
  Crown, 
  Database, 
  Activity, 
  AlertCircle, 
  CheckCircle2,
  Unlink2,
  Link2
} from 'lucide-react';

const ClusterDashboard = () => {
  const [clusterStatus, setClusterStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partitions, setPartitions] = useState({});

  const gatewayUrl = process.env.REACT_APP_GATEWAY_URL || 'http://localhost:3000';

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${gatewayUrl}/cluster-status`);
      const data = await res.json();
      setClusterStatus(data);

      // Fetch partition status for each replica
      const newPartitions = {};
      for (const replica of data.replicas) {
        if (replica.healthy) {
          try {
            const pRes = await fetch(`${replica.url}/partition/status`);
            const pData = await pRes.json();
            newPartitions[replica.url] = new Set(pData.blocked);
          } catch (_) {}
        }
      }
      setPartitions(newPartitions);
    } catch (err) {
      console.error('Failed to fetch cluster status:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePartition = async (replicaUrl, targetUrl, shouldBlock) => {
    try {
      const endpoint = shouldBlock ? 'block' : 'unblock';
      await fetch(`${replicaUrl}/partition/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      fetchStatus();
    } catch (err) {
      console.error('Failed to toggle partition:', err);
    }
  };

  const unblockAll = async () => {
    try {
      for (const replica of clusterStatus?.replicas || []) {
        if (replica.healthy) {
          try {
            await fetch(`${replica.url}/partition/unblock-all`, { method: 'POST' });
          } catch (_) {}
        }
      }
      fetchStatus();
    } catch (err) {
      console.error('Failed to unblock all:', err);
    }
  };

  const createTwoPartitionSplit = async () => {
    if (!clusterStatus?.replicas) return;
    const replicas = clusterStatus.replicas;
    if (replicas.length < 4) return;
    
    // Split into (1,2) and (3,4)
    const group1 = [replicas[0].url, replicas[1].url];
    const group2 = [replicas[2].url, replicas[3].url];

    for (const r1 of group1) {
      for (const r2 of group2) {
        await togglePartition(r1, r2, true);
        await togglePartition(r2, r1, true);
      }
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="cluster-dashboard">
        <div className="dashboard-loading">Loading cluster status...</div>
      </div>
    );
  }

  return (
    <div className="cluster-dashboard">
      <div className="dashboard-header">
        <Server size={20} />
        <h3>RAFT Cluster</h3>
      </div>

      <div className="partition-controls">
        <button className="partition-btn" onClick={createTwoPartitionSplit}>
          <Unlink2 size={14} />
          Split 2‑Way
        </button>
        <button className="partition-btn unblock-all" onClick={unblockAll}>
          <Link2 size={14} />
          Heal All
        </button>
      </div>
      
      <div className="dashboard-content">
        {clusterStatus?.replicas?.map((replica, index) => (
          <motion.div
            key={replica.url}
            className={`replica-card ${replica.url === clusterStatus.leader ? 'leader' : ''} ${!replica.healthy ? 'unhealthy' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="replica-header">
              <span className="replica-id">
                Replica {replica.id}
              </span>
              {replica.url === clusterStatus.leader && <Crown size={16} className="leader-icon" />}
              {replica.healthy ? (
                <CheckCircle2 size={14} className="status-icon healthy" />
              ) : (
                <AlertCircle size={14} className="status-icon unhealthy" />
              )}
            </div>

            <div className="replica-metrics">
              <div className="metric">
                <Activity size={12} />
                <span>Role: {replica.role || 'Unknown'}</span>
              </div>
              <div className="metric">
                <Database size={12} />
                <span>Term: {replica.term ?? 'N/A'}</span>
              </div>
              <div className="metric">
                <Database size={12} />
                <span>Log: {replica.logLength ?? 0} entries</span>
              </div>
              <div className="metric">
                <Database size={12} />
                <span>Commit: {replica.commitIndex ?? -1}</span>
              </div>
            </div>

            <div className="partition-toggle">
              <span className="toggle-label">Block:</span>
              {clusterStatus.replicas
                .filter(r => r.url !== replica.url)
                .map(other => {
                  const isBlocked = partitions[replica.url]?.has(other.url);
                  return (
                    <button
                      key={other.url}
                      className={`toggle-btn ${isBlocked ? 'blocked' : ''}`}
                      onClick={() => togglePartition(replica.url, other.url, !isBlocked)}
                    >
                      R{other.id}
                    </button>
                  );
                })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ClusterDashboard;
