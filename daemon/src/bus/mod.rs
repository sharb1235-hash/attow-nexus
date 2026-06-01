pub mod backpressure;
pub mod broadcast;
pub mod channel;
pub mod presence;
pub mod registry;
pub mod snapshot;
pub mod subscription;

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tokio::sync::mpsc;

use crate::generated::nexus::v1::{
    AgentPresence, BroadcastDelta, ChannelSnapshotResponse, RegisterAgentRequest, StateDelta,
    SubscriptionFilter,
};
use crate::observability::metrics::Metrics;
use crate::util::time::now;

#[derive(Debug, Clone, Serialize)]
pub struct ChannelInfo {
    pub name: String,
    pub durable_count: u64,
    pub ephemeral_count: u64,
    pub publishers: Vec<String>,
    pub subscribers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentInfo {
    pub agent_id: String,
    pub run_id: String,
    pub thread_id: String,
    pub status: String,
    pub framework: String,
    pub language: String,
    pub capabilities: Vec<String>,
    pub last_seen_seconds: i64,
    pub active_channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeltaInfo {
    pub delta_id: String,
    pub commit_id: String,
    pub channel: String,
    pub agent_id: String,
    pub run_id: String,
    pub durable: bool,
    pub summary: String,
    pub wall_time_seconds: i64,
}

#[derive(Debug, Clone)]
struct ChannelState {
    latest: Option<StateDelta>,
    durable_count: u64,
    ephemeral_count: u64,
    publishers: Vec<String>,
}

#[derive(Debug)]
struct Subscription {
    subscriber_id: String,
    filter: SubscriptionFilter,
    sender: mpsc::Sender<BroadcastDelta>,
    dropped_count: u64,
}

#[derive(Debug)]
pub struct Bus {
    channels: Mutex<HashMap<String, ChannelState>>,
    subscriptions: Mutex<HashMap<String, Subscription>>,
    presence: Mutex<HashMap<String, AgentPresence>>,
    recent_deltas: Mutex<VecDeque<DeltaInfo>>,
    metrics: Arc<Metrics>,
}

impl Bus {
    pub fn new(metrics: Arc<Metrics>) -> Self {
        Self {
            channels: Mutex::new(HashMap::new()),
            subscriptions: Mutex::new(HashMap::new()),
            presence: Mutex::new(HashMap::new()),
            recent_deltas: Mutex::new(VecDeque::with_capacity(256)),
            metrics,
        }
    }

    pub fn register_agent(&self, request: &RegisterAgentRequest) -> AgentPresence {
        let presence = AgentPresence {
            agent_id: request.agent_id.clone(),
            run_id: request.run_id.clone(),
            thread_id: request.thread_id.clone(),
            status: "online".to_string(),
            last_seen: Some(now()),
            metadata: request.metadata.clone(),
            capabilities: request.capabilities.clone(),
            active_channels: Vec::new(),
        };
        self.presence
            .lock()
            .expect("presence lock")
            .insert(request.agent_id.clone(), presence.clone());
        self.metrics
            .agents_connected
            .store(self.agent_count() as u64);
        presence
    }

    pub fn heartbeat(&self, agent_id: &str) {
        if let Some(agent) = self
            .presence
            .lock()
            .expect("presence lock")
            .get_mut(agent_id)
        {
            agent.status = "online".to_string();
            agent.last_seen = Some(now());
        }
    }

    pub fn subscribe(
        &self,
        subscriber_id: String,
        filter: SubscriptionFilter,
        capacity: usize,
    ) -> mpsc::Receiver<BroadcastDelta> {
        let capacity = capacity.clamp(1, 8192);
        let (sender, receiver) = mpsc::channel(capacity);
        self.subscriptions
            .lock()
            .expect("subscription lock")
            .insert(
                subscriber_id.clone(),
                Subscription {
                    subscriber_id,
                    filter,
                    sender,
                    dropped_count: 0,
                },
            );
        self.metrics
            .subscriptions_total
            .store(self.subscription_count() as u64);
        receiver
    }

    pub async fn broadcast(&self, delta: StateDelta, commit_id: String) {
        self.update_channel(&delta);
        self.push_recent(&delta, &commit_id);

        let broadcast = BroadcastDelta {
            delta: Some(delta.clone()),
            commit_id,
            redacted: true,
        };
        let targets = {
            let subscriptions = self.subscriptions.lock().expect("subscription lock");
            subscriptions
                .values()
                .filter(|sub| subscription_matches(sub, &delta))
                .map(|sub| (sub.subscriber_id.clone(), sub.sender.clone()))
                .collect::<Vec<_>>()
        };

        for (subscriber_id, sender) in targets {
            match sender.try_send(broadcast.clone()) {
                Ok(()) => {}
                Err(mpsc::error::TrySendError::Full(message)) if delta.durable => {
                    let _ = sender.send(message).await;
                }
                Err(mpsc::error::TrySendError::Full(_)) => {
                    self.record_drop(&subscriber_id);
                }
                Err(mpsc::error::TrySendError::Closed(_)) => {
                    self.subscriptions
                        .lock()
                        .expect("subscription lock")
                        .remove(&subscriber_id);
                }
            }
        }
        self.metrics.deltas_total.inc();
        if delta.durable {
            self.metrics.durable_deltas_total.inc();
        } else {
            self.metrics.ephemeral_deltas_total.inc();
        }
    }

    pub fn snapshot(&self, channel: &str) -> ChannelSnapshotResponse {
        let channels = self.channels.lock().expect("channel lock");
        let Some(state) = channels.get(channel) else {
            return ChannelSnapshotResponse {
                channel: channel.to_string(),
                latest_payload: None,
                durable_count: 0,
                ephemeral_count: 0,
            };
        };
        ChannelSnapshotResponse {
            channel: channel.to_string(),
            latest_payload: state
                .latest
                .as_ref()
                .and_then(|delta| delta.payload.clone()),
            durable_count: state.durable_count,
            ephemeral_count: state.ephemeral_count,
        }
    }

    pub fn channels(&self) -> Vec<ChannelInfo> {
        let subscriptions = self.subscriptions.lock().expect("subscription lock");
        let channels = self.channels.lock().expect("channel lock");
        channels
            .iter()
            .map(|(name, state)| ChannelInfo {
                name: name.clone(),
                durable_count: state.durable_count,
                ephemeral_count: state.ephemeral_count,
                publishers: state.publishers.clone(),
                subscribers: subscriptions
                    .values()
                    .filter(|sub| filter_matches(&sub.filter, name, false))
                    .map(|sub| sub.subscriber_id.clone())
                    .collect(),
            })
            .collect()
    }

    pub fn agents(&self) -> Vec<AgentInfo> {
        self.presence
            .lock()
            .expect("presence lock")
            .values()
            .map(|presence| AgentInfo {
                agent_id: presence.agent_id.clone(),
                run_id: presence.run_id.clone(),
                thread_id: presence.thread_id.clone(),
                status: presence.status.clone(),
                framework: presence
                    .metadata
                    .as_ref()
                    .map(|metadata| metadata.framework.clone())
                    .unwrap_or_default(),
                language: presence
                    .metadata
                    .as_ref()
                    .map(|metadata| metadata.language.clone())
                    .unwrap_or_default(),
                capabilities: presence
                    .capabilities
                    .as_ref()
                    .map(|caps| caps.capabilities.clone())
                    .unwrap_or_default(),
                last_seen_seconds: presence
                    .last_seen
                    .as_ref()
                    .map(|timestamp| timestamp.seconds)
                    .unwrap_or_default(),
                active_channels: presence.active_channels.clone(),
            })
            .collect()
    }

    pub fn recent_deltas(&self, channel: Option<&str>) -> Vec<DeltaInfo> {
        self.recent_deltas
            .lock()
            .expect("recent lock")
            .iter()
            .filter(|delta| channel.map(|value| value == delta.channel).unwrap_or(true))
            .cloned()
            .collect()
    }

    pub fn dropped_for(&self, subscriber_id: &str) -> u64 {
        self.subscriptions
            .lock()
            .expect("subscription lock")
            .get(subscriber_id)
            .map(|sub| sub.dropped_count)
            .unwrap_or_default()
    }

    pub fn agent_count(&self) -> usize {
        self.presence.lock().expect("presence lock").len()
    }

    pub fn channel_count(&self) -> usize {
        self.channels.lock().expect("channel lock").len()
    }

    pub fn subscription_count(&self) -> usize {
        self.subscriptions.lock().expect("subscription lock").len()
    }

    fn update_channel(&self, delta: &StateDelta) {
        let mut channels = self.channels.lock().expect("channel lock");
        let state = channels
            .entry(delta.channel.clone())
            .or_insert(ChannelState {
                latest: None,
                durable_count: 0,
                ephemeral_count: 0,
                publishers: Vec::new(),
            });
        state.latest = Some(delta.clone());
        if delta.durable {
            state.durable_count += 1;
        } else {
            state.ephemeral_count += 1;
        }
        if !state.publishers.contains(&delta.agent_id) {
            state.publishers.push(delta.agent_id.clone());
        }
        self.metrics.channels_total.store(channels.len() as u64);
    }

    fn push_recent(&self, delta: &StateDelta, commit_id: &str) {
        let mut recent = self.recent_deltas.lock().expect("recent lock");
        if recent.len() == 256 {
            recent.pop_front();
        }
        recent.push_back(DeltaInfo {
            delta_id: delta.delta_id.clone(),
            commit_id: commit_id.to_string(),
            channel: delta.channel.clone(),
            agent_id: delta.agent_id.clone(),
            run_id: delta.run_id.clone(),
            durable: delta.durable,
            summary: delta.summary.clone(),
            wall_time_seconds: delta
                .wall_time
                .as_ref()
                .map(|timestamp| timestamp.seconds)
                .unwrap_or_default(),
        });
    }

    fn record_drop(&self, subscriber_id: &str) {
        if let Some(subscription) = self
            .subscriptions
            .lock()
            .expect("subscription lock")
            .get_mut(subscriber_id)
        {
            subscription.dropped_count += 1;
        }
        self.metrics.backpressure_events_total.inc();
        self.metrics.dropped_ephemeral_total.inc();
    }
}

fn subscription_matches(subscription: &Subscription, delta: &StateDelta) -> bool {
    filter_matches(&subscription.filter, &delta.channel, delta.durable)
}

fn filter_matches(filter: &SubscriptionFilter, channel: &str, durable: bool) -> bool {
    if filter.durable_only && !durable {
        return false;
    }
    filter
        .channel_patterns
        .iter()
        .any(|pattern| channel_pattern_matches(pattern, channel))
}

pub fn channel_pattern_matches(pattern: &str, channel: &str) -> bool {
    if pattern == "*" || pattern == channel {
        return true;
    }
    if let Some(prefix) = pattern.strip_suffix('*') {
        return channel.starts_with(prefix);
    }
    false
}
