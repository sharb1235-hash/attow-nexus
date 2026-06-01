use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::Context;
use prost::Message;
use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension};

use crate::config::Config;
use crate::generated::nexus::v1::{ArtifactRef, Commit, LoopWarning, RunSummary, Timestamp};
use crate::ledger::head::head_key;
use crate::ledger::store::Store;
use crate::util::compression::{maybe_compress, maybe_decompress};
use crate::util::hash::blake3_hex;
use crate::util::time::millis;

#[derive(Debug)]
pub struct SqliteStore {
    conn: Mutex<Connection>,
    artifact_dir: PathBuf,
    compression_threshold_bytes: usize,
}

impl SqliteStore {
    pub fn open(config: &Config) -> anyhow::Result<Self> {
        let conn = Connection::open(&config.sqlite_path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS commits (
              commit_id TEXT PRIMARY KEY,
              delta_id TEXT NOT NULL,
              run_id TEXT NOT NULL,
              thread_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              channel TEXT NOT NULL,
              logical_clock INTEGER NOT NULL,
              wall_time_seconds INTEGER NOT NULL,
              tags_json TEXT NOT NULL,
              content_hash TEXT NOT NULL,
              proto BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS commit_parents (
              commit_id TEXT NOT NULL,
              parent_commit_id TEXT NOT NULL,
              PRIMARY KEY (commit_id, parent_commit_id)
            );
            CREATE TABLE IF NOT EXISTS heads (
              head_key TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              thread_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              channel TEXT NOT NULL,
              commit_id TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS runs (
              run_id TEXT PRIMARY KEY,
              last_commit_at INTEGER NOT NULL,
              commit_count INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS agents (
              agent_id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              last_seen INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS channels (
              channel TEXT PRIMARY KEY,
              durable_count INTEGER NOT NULL DEFAULT 0,
              ephemeral_count INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS deltas (
              delta_id TEXT PRIMARY KEY,
              commit_id TEXT,
              run_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              channel TEXT NOT NULL,
              durable INTEGER NOT NULL,
              wall_time_seconds INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS artifacts (
              artifact_id TEXT PRIMARY KEY,
              content_hash TEXT NOT NULL,
              path TEXT NOT NULL,
              size_bytes INTEGER NOT NULL,
              media_type TEXT NOT NULL,
              compressed INTEGER NOT NULL,
              metadata_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tool_calls (
              tool_call_id TEXT PRIMARY KEY,
              commit_id TEXT NOT NULL,
              name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tool_results (
              tool_call_id TEXT NOT NULL,
              commit_id TEXT NOT NULL,
              has_error INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS side_effects (
              side_effect_id TEXT PRIMARY KEY,
              commit_id TEXT NOT NULL,
              kind TEXT NOT NULL,
              reversible INTEGER NOT NULL,
              compensating_action_available INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS loop_warnings (
              warning_id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              channel TEXT NOT NULL,
              severity INTEGER NOT NULL,
              last_seen_seconds INTEGER NOT NULL,
              proto BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rollback_events (
              event_id INTEGER PRIMARY KEY AUTOINCREMENT,
              payload_json TEXT NOT NULL,
              created_ms INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_events (
              event_id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_type TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_ms INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_commits_run ON commits(run_id, logical_clock, wall_time_seconds);
            CREATE INDEX IF NOT EXISTS idx_commits_agent ON commits(agent_id);
            CREATE INDEX IF NOT EXISTS idx_commits_channel ON commits(channel);
            CREATE INDEX IF NOT EXISTS idx_commits_wall_time ON commits(wall_time_seconds);
            CREATE INDEX IF NOT EXISTS idx_deltas_channel ON deltas(channel, wall_time_seconds);
            "#,
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
            artifact_dir: config.artifact_dir.clone(),
            compression_threshold_bytes: config.compression_threshold_bytes,
        })
    }
}

impl Store for SqliteStore {
    fn append_commit(&self, commit: &Commit) -> anyhow::Result<()> {
        let bytes = commit.encode_to_vec();
        let tags_json = serde_json::to_string(&commit.tags)?;
        let wall_time = commit
            .wall_time
            .as_ref()
            .map(|timestamp| timestamp.seconds)
            .unwrap_or_default();
        let mut conn = self.conn.lock().expect("sqlite lock");
        let tx = conn.transaction()?;
        tx.execute(
            r#"
            INSERT OR IGNORE INTO commits
            (commit_id, delta_id, run_id, thread_id, agent_id, channel, logical_clock,
             wall_time_seconds, tags_json, content_hash, proto)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                commit.commit_id,
                commit.delta_id,
                commit.run_id,
                commit.thread_id,
                commit.agent_id,
                commit.channel,
                commit.logical_clock as i64,
                wall_time,
                tags_json,
                commit.content_hash,
                bytes
            ],
        )?;
        for parent in &commit.parent_commit_ids {
            tx.execute(
                "INSERT OR IGNORE INTO commit_parents (commit_id, parent_commit_id) VALUES (?1, ?2)",
                params![commit.commit_id, parent],
            )?;
        }
        tx.execute(
            r#"
            INSERT INTO runs (run_id, last_commit_at, commit_count)
            VALUES (?1, ?2, 1)
            ON CONFLICT(run_id) DO UPDATE SET
              last_commit_at=excluded.last_commit_at,
              commit_count=commit_count + 1
            "#,
            params![commit.run_id, wall_time],
        )?;
        tx.execute(
            "INSERT OR IGNORE INTO channels (channel, durable_count, ephemeral_count) VALUES (?1, 0, 0)",
            params![commit.channel],
        )?;
        tx.execute(
            "UPDATE channels SET durable_count=durable_count + 1 WHERE channel=?1",
            params![commit.channel],
        )?;
        tx.execute(
            r#"
            INSERT OR IGNORE INTO deltas
            (delta_id, commit_id, run_id, agent_id, channel, durable, wall_time_seconds)
            VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)
            "#,
            params![
                commit.delta_id,
                commit.commit_id,
                commit.run_id,
                commit.agent_id,
                commit.channel,
                wall_time
            ],
        )?;
        for tool_call in &commit.tool_calls {
            tx.execute(
                "INSERT OR REPLACE INTO tool_calls (tool_call_id, commit_id, name) VALUES (?1, ?2, ?3)",
                params![tool_call.tool_call_id, commit.commit_id, tool_call.name],
            )?;
        }
        for tool_result in &commit.tool_results {
            tx.execute(
                "INSERT INTO tool_results (tool_call_id, commit_id, has_error) VALUES (?1, ?2, ?3)",
                params![
                    tool_result.tool_call_id,
                    commit.commit_id,
                    i64::from(tool_result.error.is_some())
                ],
            )?;
        }
        for side_effect in &commit.external_side_effects {
            tx.execute(
                r#"
                INSERT OR REPLACE INTO side_effects
                (side_effect_id, commit_id, kind, reversible, compensating_action_available)
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
                params![
                    side_effect.side_effect_id,
                    commit.commit_id,
                    side_effect.kind,
                    i64::from(side_effect.reversible),
                    i64::from(side_effect.compensating_action_available)
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    fn get_commit(&self, commit_id: &str) -> anyhow::Result<Option<Commit>> {
        let conn = self.conn.lock().expect("sqlite lock");
        let bytes = conn
            .query_row(
                "SELECT proto FROM commits WHERE commit_id=?1",
                params![commit_id],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()?;
        bytes
            .map(|blob| decode_commit(&blob))
            .transpose()
            .context("decode commit")
    }

    fn list_all_commits(&self) -> anyhow::Result<Vec<Commit>> {
        self.list_commits(None, None, None)
    }

    fn list_commits(
        &self,
        run_id: Option<&str>,
        thread_id: Option<&str>,
        channel: Option<&str>,
    ) -> anyhow::Result<Vec<Commit>> {
        let conn = self.conn.lock().expect("sqlite lock");
        let mut statement = conn.prepare(
            "SELECT proto FROM commits ORDER BY logical_clock ASC, wall_time_seconds ASC, commit_id ASC",
        )?;
        let commits = statement
            .query_map([], |row| {
                let bytes: Vec<u8> = row.get(0)?;
                decode_commit(&bytes).map_err(|err| {
                    rusqlite::Error::FromSqlConversionFailure(0, Type::Blob, Box::new(err))
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(commits
            .into_iter()
            .filter(|commit| run_id.map(|value| value == commit.run_id).unwrap_or(true))
            .filter(|commit| {
                thread_id
                    .map(|value| value == commit.thread_id)
                    .unwrap_or(true)
            })
            .filter(|commit| channel.map(|value| value == commit.channel).unwrap_or(true))
            .collect())
    }

    fn list_runs(&self) -> anyhow::Result<Vec<RunSummary>> {
        let conn = self.conn.lock().expect("sqlite lock");
        let mut statement = conn.prepare(
            "SELECT run_id, commit_count, last_commit_at FROM runs ORDER BY last_commit_at DESC",
        )?;
        let rows = statement.query_map([], |row| {
            let seconds: i64 = row.get(2)?;
            Ok(RunSummary {
                run_id: row.get(0)?,
                commit_count: row.get::<_, i64>(1)? as u64,
                last_commit_at: Some(Timestamp { seconds, nanos: 0 }),
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    fn get_head(
        &self,
        run_id: &str,
        thread_id: &str,
        agent_id: &str,
        channel: &str,
    ) -> anyhow::Result<Option<String>> {
        let key = head_key(run_id, thread_id, agent_id, channel);
        let conn = self.conn.lock().expect("sqlite lock");
        Ok(conn
            .query_row(
                "SELECT commit_id FROM heads WHERE head_key=?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?)
    }

    fn set_head(
        &self,
        run_id: &str,
        thread_id: &str,
        agent_id: &str,
        channel: &str,
        commit_id: &str,
    ) -> anyhow::Result<()> {
        let key = head_key(run_id, thread_id, agent_id, channel);
        self.conn.lock().expect("sqlite lock").execute(
            r#"
            INSERT INTO heads (head_key, run_id, thread_id, agent_id, channel, commit_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(head_key) DO UPDATE SET commit_id=excluded.commit_id
            "#,
            params![key, run_id, thread_id, agent_id, channel, commit_id],
        )?;
        Ok(())
    }

    fn append_event(&self, event_type: &str, payload_json: &str) -> anyhow::Result<()> {
        self.conn.lock().expect("sqlite lock").execute(
            "INSERT INTO audit_events (event_type, payload_json, created_ms) VALUES (?1, ?2, ?3)",
            params![event_type, payload_json, millis() as i64],
        )?;
        if event_type == "rollback" {
            self.conn.lock().expect("sqlite lock").execute(
                "INSERT INTO rollback_events (payload_json, created_ms) VALUES (?1, ?2)",
                params![payload_json, millis() as i64],
            )?;
        }
        Ok(())
    }

    fn put_artifact(&self, bytes: &[u8], media_type: &str) -> anyhow::Result<ArtifactRef> {
        std::fs::create_dir_all(&self.artifact_dir)?;
        let content_hash = blake3_hex(bytes);
        let artifact_id = format!("artifact_{content_hash}");
        let (stored_bytes, compressed) = maybe_compress(bytes, self.compression_threshold_bytes)?;
        let path = self.artifact_dir.join(&artifact_id);
        std::fs::write(&path, stored_bytes)?;
        self.conn.lock().expect("sqlite lock").execute(
            r#"
            INSERT OR REPLACE INTO artifacts
            (artifact_id, content_hash, path, size_bytes, media_type, compressed, metadata_json)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}')
            "#,
            params![
                artifact_id,
                content_hash,
                path.to_string_lossy(),
                bytes.len() as i64,
                media_type,
                i64::from(compressed)
            ],
        )?;
        Ok(ArtifactRef {
            artifact_id,
            content_hash,
            size_bytes: bytes.len() as u64,
            media_type: media_type.to_string(),
            compressed,
            metadata: None,
        })
    }

    fn get_artifact(&self, artifact_id: &str) -> anyhow::Result<Option<Vec<u8>>> {
        let conn = self.conn.lock().expect("sqlite lock");
        let row = conn
            .query_row(
                "SELECT path, compressed FROM artifacts WHERE artifact_id=?1",
                params![artifact_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? != 0)),
            )
            .optional()?;
        let Some((path, compressed)) = row else {
            return Ok(None);
        };
        let bytes = std::fs::read(path)?;
        Ok(Some(maybe_decompress(&bytes, compressed)?))
    }

    fn search_by_tag(&self, tag: &str) -> anyhow::Result<Vec<Commit>> {
        Ok(self
            .list_all_commits()?
            .into_iter()
            .filter(|commit| commit.tags.iter().any(|value| value == tag))
            .collect())
    }

    fn append_loop_warning(&self, warning: &LoopWarning) -> anyhow::Result<()> {
        let bytes = warning.encode_to_vec();
        let last_seen = warning
            .last_seen
            .as_ref()
            .map(|timestamp| timestamp.seconds)
            .unwrap_or_default();
        self.conn.lock().expect("sqlite lock").execute(
            r#"
            INSERT OR REPLACE INTO loop_warnings
            (warning_id, run_id, agent_id, channel, severity, last_seen_seconds, proto)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#,
            params![
                warning.warning_id,
                warning.run_id,
                warning.agent_id,
                warning.channel,
                warning.severity,
                last_seen,
                bytes
            ],
        )?;
        Ok(())
    }

    fn list_loop_warnings(&self) -> anyhow::Result<Vec<LoopWarning>> {
        let conn = self.conn.lock().expect("sqlite lock");
        let mut statement =
            conn.prepare("SELECT proto FROM loop_warnings ORDER BY last_seen_seconds DESC")?;
        let rows = statement.query_map([], |row| {
            let bytes: Vec<u8> = row.get(0)?;
            LoopWarning::decode(bytes.as_slice()).map_err(|err| {
                rusqlite::Error::FromSqlConversionFailure(0, Type::Blob, Box::new(err))
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}

fn decode_commit(bytes: &[u8]) -> Result<Commit, prost::DecodeError> {
    Commit::decode(bytes)
}
