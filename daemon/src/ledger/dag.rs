use std::collections::{HashMap, HashSet};
use std::sync::RwLock;

use anyhow::bail;

use crate::generated::nexus::v1::Commit;

#[derive(Debug, Default)]
pub struct DagIndex {
    parents: RwLock<HashMap<String, Vec<String>>>,
    children: RwLock<HashMap<String, Vec<String>>>,
}

impl DagIndex {
    pub fn from_commits(commits: &[Commit]) -> anyhow::Result<Self> {
        let index = Self::default();
        for commit in commits {
            index.append(commit)?;
        }
        Ok(index)
    }

    pub fn append(&self, commit: &Commit) -> anyhow::Result<()> {
        if commit.commit_id.is_empty() {
            bail!("commit_id is required");
        }
        if commit
            .parent_commit_ids
            .iter()
            .any(|parent| parent == &commit.commit_id)
        {
            bail!("commit cannot parent itself");
        }

        {
            let parents = self.parents.read().expect("dag parents");
            for parent in &commit.parent_commit_ids {
                if !parents.contains_key(parent) {
                    bail!("parent commit {parent} is unknown");
                }
                if self.reachable_locked(&parents, parent, &commit.commit_id) {
                    bail!("commit would introduce a DAG cycle");
                }
            }
        }

        self.parents
            .write()
            .expect("dag parents")
            .insert(commit.commit_id.clone(), commit.parent_commit_ids.clone());
        let mut children = self.children.write().expect("dag children");
        for parent in &commit.parent_commit_ids {
            children
                .entry(parent.clone())
                .or_default()
                .push(commit.commit_id.clone());
        }
        Ok(())
    }

    pub fn is_ancestor(&self, ancestor: &str, commit_id: &str) -> bool {
        if ancestor == commit_id {
            return true;
        }
        let parents = self.parents.read().expect("dag parents");
        self.reachable_locked(&parents, commit_id, ancestor)
    }

    pub fn ancestry(&self, commit_id: &str) -> Vec<String> {
        let parents = self.parents.read().expect("dag parents");
        let mut out = Vec::new();
        let mut seen = HashSet::new();
        collect_ancestry(&parents, commit_id, &mut seen, &mut out);
        out
    }

    pub fn nearest_common_ancestor(&self, a: &str, b: &str) -> Option<String> {
        let a_ancestry = self.ancestry(a).into_iter().collect::<HashSet<_>>();
        self.ancestry(b)
            .into_iter()
            .find(|commit_id| a_ancestry.contains(commit_id))
    }

    pub fn export_edges(&self) -> Vec<(String, String)> {
        self.parents
            .read()
            .expect("dag parents")
            .iter()
            .flat_map(|(child, parents)| {
                parents
                    .iter()
                    .map(|parent| (parent.clone(), child.clone()))
                    .collect::<Vec<_>>()
            })
            .collect()
    }

    fn reachable_locked(
        &self,
        parents: &HashMap<String, Vec<String>>,
        from: &str,
        target: &str,
    ) -> bool {
        let mut stack = vec![from.to_string()];
        let mut seen = HashSet::new();
        while let Some(current) = stack.pop() {
            if current == target {
                return true;
            }
            if !seen.insert(current.clone()) {
                continue;
            }
            if let Some(next) = parents.get(&current) {
                stack.extend(next.iter().cloned());
            }
        }
        false
    }
}

fn collect_ancestry(
    parents: &HashMap<String, Vec<String>>,
    commit_id: &str,
    seen: &mut HashSet<String>,
    out: &mut Vec<String>,
) {
    if !seen.insert(commit_id.to_string()) {
        return;
    }
    if let Some(parent_ids) = parents.get(commit_id) {
        for parent in parent_ids {
            collect_ancestry(parents, parent, seen, out);
        }
    }
    out.push(commit_id.to_string());
}
