export const CLIENT_EVENTS = Object.freeze({
    JOIN_PAIR: 'join_pair',
    JOIN_PRIVATE_PAIR: 'join_private_pair',
    INPUT: 'input',
});

export const SERVER_EVENTS = Object.freeze({
    CONNECTED: 'connected',
    INIT: 'init',
    STATE: 'state',
    WAITING_FOR_PARTNER: 'waiting_for_partner',
    PRIVATE_PAIR_CREATED: 'private_pair_created',
    JOIN_ERROR: 'join_error',
});
