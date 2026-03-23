export const CLIENT_EVENTS = Object.freeze({
    JOIN_SOLO: 'join_solo',
    JOIN_SITNGO: 'join_sitngo',
    JOIN_TEAM_BR: 'join_team_br',
    JOIN_PAIR: 'join_pair',
    JOIN_PRIVATE_PAIR: 'join_private_pair',
    INPUT: 'input',
});

export const SERVER_EVENTS = Object.freeze({
    CONNECTED: 'connected',
    INIT: 'init',
    STATE: 'state',
    WAITING_FOR_PARTNER: 'waiting_for_partner',
    WAITING_FOR_SITNGO: 'waiting_for_sitngo',
    PRIVATE_PAIR_CREATED: 'private_pair_created',
    JOIN_ERROR: 'join_error',
});
