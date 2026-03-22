import { SERVER_EVENTS } from './multiplayerEvents.js';

export class MultiplayerMessageController {
    constructor({
        effectsController,
    }) {
        this.effectsController = effectsController;
    }

    handle(msg) {
        switch (msg.type) {
            case SERVER_EVENTS.CONNECTED:
                this.effectsController.handleConnected(msg);
                break;

            case SERVER_EVENTS.WAITING_FOR_PARTNER:
                this.effectsController.handleWaitingForPartner();
                break;

            case SERVER_EVENTS.WAITING_FOR_SITNGO:
                this.effectsController.handleWaitingForSitNGo(msg);
                break;

            case SERVER_EVENTS.PRIVATE_PAIR_CREATED:
                this.effectsController.handlePrivatePairCreated(msg);
                break;

            case SERVER_EVENTS.JOIN_ERROR:
                this.effectsController.handleJoinError(msg);
                break;

            case SERVER_EVENTS.INIT:
                this.effectsController.handleInit(msg);
                break;

            case SERVER_EVENTS.STATE:
                this.effectsController.handleState(msg);
                break;
        }
    }
}
