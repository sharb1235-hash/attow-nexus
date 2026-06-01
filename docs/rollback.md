# Rollback

Rollback moves a NexusLedger head pointer to an older commit and creates a rollback marker event.

Rollback does not delete history. Rollback applies only to captured logical state.

If the rolled-back range contains external side effects, the daemon returns warnings. Those side effects remain logged as irreversible unless an adapter provides a compensating action.

