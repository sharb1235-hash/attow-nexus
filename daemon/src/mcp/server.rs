use crate::mcp::{resources, tools};

#[derive(Debug, Clone)]
pub struct McpBridgeInfo {
    pub tools: Vec<&'static str>,
    pub resources: Vec<&'static str>,
    pub local_only: bool,
}

pub fn bridge_info() -> McpBridgeInfo {
    McpBridgeInfo {
        tools: tools::TOOLS.to_vec(),
        resources: resources::RESOURCES.to_vec(),
        local_only: true,
    }
}
