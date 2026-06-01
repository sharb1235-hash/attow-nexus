use crate::generated::nexus::v1::{server_event, Ack, ServerEvent};

pub fn ack(id: impl Into<String>, message: impl Into<String>) -> ServerEvent {
    ServerEvent {
        event: Some(server_event::Event::Ack(Ack {
            id: id.into(),
            message: message.into(),
        })),
    }
}
