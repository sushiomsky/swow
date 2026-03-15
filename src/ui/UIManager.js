import { x, q, F } from '../utils.js';

export class UIManager {
    constructor(engine, app) {
        this.engine = engine;
        this.app = app;
        this.init();
    }

    init() {
        q("menuOverlay").onclick = () => {
            q("menu").classList.contains("opened") && this.closeMenu();
        };

        q("menuToggler").onclick = () => {
            this.openMenu();
        };

        x("#menu .l1", (h) => {
            h.onclick = (k) => {
                if (k.target.classList.contains("l1")) {
                    const items = h.querySelector(".items");
                    if (items) {
                        items.style.height = items.scrollHeight + "px";
                        items.classList.toggle("closed");
                        this.closeOtherMenuItems(items);
                    }
                }
            };
        });

        q("menu .back").onclick = () => {
            this.closeMenu();
        };

        q("toggleFullscreen").onclick = () => {
            var h = window.document, k = h.documentElement,
                n = k.requestFullscreen || k.mozRequestFullScreen || k.webkitRequestFullScreen || k.msRequestFullscreen,
                A = h.exitFullscreen || h.mozCancelFullScreen || h.webkitExitFullscreen || h.msExitFullscreen;
            h.fullscreenElement || h.mozFullScreenElement || h.webkitFullscreenElement || h.msFullscreenElement ? A.call(h) : n.call(k)
        };

        x("#visualFilterSelect > div", (h) => {
            h.onclick = () => {
                var k = this.getDataValue(h);
                this.app.options.visualFilter = k;
                localStorage.setItem("visualFilter", k);
                this.refreshActiveOptions();
                this.app.applyVisualFilter();
                "none" == k && this.engine.clearVisualFilter();
                this.engine.resetAnimateSkips();
                this.engine.animationRoutine();
            }
        });

        x("#soundSelect > div", (h) => {
            h.onclick = () => {
                var k = this.getDataValue(h);
                "off" == k ? this.app.audio.stopAllSound(!0) : this.app.audio.queue = [];
                this.app.options.sound = k;
                localStorage.setItem("sound", k);
                this.refreshActiveOptions();
            }
        });

        x("#yellowControlSelect > div", (h) => {
            h.onclick = () => {
                var k = this.getDataValue(h);
                this.app.options.yellowControl = k;
                localStorage.setItem("yellowControl", k);
                this.refreshActiveOptions();
                if ("keyboardArrows" == this.app.options.yellowControl && "keyboardArrows" == this.app.options.blueControl)
                    q('blueControlSelect > div[data-value="keyboardWasd"]').click();
                else if ("keyboardWasd" == this.app.options.yellowControl && "keyboardWasd" == this.app.options.blueControl)
                    q('blueControlSelect > div[data-value="keyboardArrows"]').click();
            }
        });

        x("#blueControlSelect > div", (h) => {
            h.onclick = () => {
                var k = this.getDataValue(h);
                this.app.options.blueControl = k;
                localStorage.setItem("blueControl", k);
                this.refreshActiveOptions();
                if ("keyboardArrows" == this.app.options.blueControl && "keyboardArrows" == this.app.options.yellowControl)
                    q('yellowControlSelect > div[data-value="keyboardWasd"]').click();
                else if ("keyboardWasd" == this.app.options.blueControl && "keyboardWasd" == this.app.options.yellowControl)
                    q('yellowControlSelect > div[data-value="keyboardArrows"]').click();
            }
        });
    }

    openMenu() {
        this.engine.togglePause(!0);
        F("menuOverlay");
        q("menuToggler").classList.add("hide");
        q("menu").classList.add("opened");
        q("body").classList.add("menu");
        setTimeout(() => { window.onresize() }, 220);
    }

    closeMenu() {
        this.closeOtherMenuItems();
        q("menu").classList.remove("opened");
        q("body").classList.remove("menu");
        F("menuToggler");
        q("menuOverlay").classList.add("hide");
        this.engine.togglePause(!1);
        setTimeout(() => { window.onresize() }, 220);
    }

    closeOtherMenuItems(except) {
        x("#menu .l1 .items", (k) => {
            if (except && except === k) return;
            k.classList.add("closed");
        });
    }

    refreshActiveOptions() {
        x("#menu .items > div", (n) => { n.classList.remove("active") });
        for (var h = ["visualFilter", "sound", "yellowControl", "blueControl"], k = 0; k < h.length; k++) {
            const selector = `${h[k]}Select div[data-value="${this.app.options[h[k]]}"]`;
            const el = q(selector);
            if (el) el.classList.add("active");
        }
    }

    getDataValue(el) {
        return el.getAttribute("data-value") || "";
    }

    isVisible() {
        return q("menu").classList.contains("opened");
    }

    setToggler(h) {
        "small" === h ? q("menuToggler").classList.add("small") : q("menuToggler").classList.remove("small");
    }
}
