#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BackpressurePolicy {
    #[default]
    DropOldest,
    DropNewest,
    Disconnect,
    DurableOnly,
}
