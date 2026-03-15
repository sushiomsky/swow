import { m } from './constants.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { GameEngine } from './engine/GameEngine.js';
import { UIManager } from './ui/UIManager.js';
import { x, q, F, z } from './utils.js';

class App {
    constructor() {
        this.options = {};
        this.pressedKeys = [];
        this.enableKeys = !1;
        this.spriteImage = new Image();
        this.spriteWidth = 248;
        this.spriteHeight = 355;
        this.scale = 3;
        this.scanFPS = 50;
        this.scanFrameTime = 1E3 / this.scanFPS;
        this.animationFrameCounter = 0;
        this.scanFrameCounter = 0;
    }

    init() {
        x(".j", (c) => { c.remove() });
        this.checkSystemRequirements(() => {
            this.audio = new AudioEngine();
            this.audio.init();
            this.setOptions();
            this.loadResources(() => {
                this.engine = new GameEngine(this);
                this.ui = new UIManager(this.engine, this);
                this.ui.refreshActiveOptions();
                F("menuToggler");
                this.initKeyHandling();
                this.initEngine();
                this.applyVisualFilter();
                F("screen");
                this.audio.loadAudioResource(0, () => {});
            });
        }, () => {
            alert("System requirements not met.");
        });
    }

    checkSystemRequirements(success, failure) {
        var f = !0;
        !1 === (window.AudioContext || window.webkitAudioContext || !1) && (f = !1);
        window.animFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame;
        if (!window.animFrame) f = !1;
        f ? success() : failure();
    }

    setOptions() {
        if ("4.0" !== localStorage.getItem("ver")) {
            localStorage.removeItem("palette");
            localStorage.setItem("ver", "4.0");
        }
        this.options = {
            visualFilter: localStorage.getItem("visualFilter") || "scanlines",
            palette: localStorage.getItem("palette") || "default",
            sound: localStorage.getItem("sound") || "on",
            yellowControl: localStorage.getItem("yellowControl") || "keyboardArrows",
            blueControl: localStorage.getItem("blueControl") || "keyboardWasd",
            highScores: localStorage.getItem("highScores") || "0,0,0,0,0"
        };
        var a = this.options.highScores.split(",");
        this.options.highScores = [];
        for (var c = 0; c < a.length; c++) this.options.highScores[c] = +a[c];
    }

    loadResources(callback) {
        this.spriteImage.src = "/images/v3.0/sprite.png";
        this.spriteImage.onerror = (e) => console.error("Sprite load failed", e);
        this.spriteImage.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = this.spriteWidth;
            canvas.height = this.spriteHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(this.spriteImage, 0, 0);
            this.originalSpriteImageData = ctx.getImageData(0, 0, this.spriteWidth, this.spriteHeight);
            this.changeGameSpriteColors();
            callback();
        };
    }

    initKeyHandling() {
        document.onkeydown = (a) => {
            var c = a.which;
            if (27 == c) this.engine.resetGame();
            if (!this.enableKeys) a.preventDefault();
            if (16 == c && 1 < a.location) c = 0;
            else if (17 == c && 2 > a.location) c = 0;
            if (13 == c) c = 17;
            if (!1 === this.pressedKeys[c] || void 0 === this.pressedKeys[c]) this.pressedKeys[c] = !0;
        };
        document.onkeyup = (a) => {
            var c = a.which;
            if (!this.enableKeys) a.preventDefault();
            if (16 == c && 1 < a.location) c = 0;
            else if (17 == c && 2 > a.location) c = 0;
            if (13 == c) c = 17;
            this.pressedKeys[c] = !1;
        };
        window.onblur = () => {
            for (var a = 0; a < this.pressedKeys.length; a++)
                if (!0 === this.pressedKeys[a] || "hold" === this.pressedKeys[a]) this.pressedKeys[a] = !1;
        };
    }

    initEngine() {
        this.canvasElement = q("screen");
        this.canvas = this.canvasElement.getContext("2d");
        this.canvas.imageSmoothingEnabled = !1;
        this.canvas.mozImageSmoothingEnabled = !1;
        this.visualFilter = q("visualFilterLayer");
        this.visualFilterContext = this.visualFilter.getContext("2d");
        this.visualFilterContext.imageSmoothingEnabled = !1;
        this.visualFilterContext.mozImageSmoothingEnabled = !1;

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) this.engine.togglePause(!0);
            else if (!this.ui.isVisible()) this.engine.togglePause(!1);
        });

        window.onresize = () => {
            const border = q("border");
            this.fullWidth = border.offsetWidth;
            this.fullHeight = border.offsetHeight;
            var a = 0;
            if (this.fullWidth > 320 * this.scale && this.fullHeight > 200 * this.scale) {
                a = 100; this.fullWidth -= a; this.fullHeight -= a;
            }
            var c = Math.min(this.fullWidth / this.canvasElement.width, this.fullHeight / this.canvasElement.height);
            this.canvasElement.style.transform = "scale(" + c + ")";
            this.canvasElement.style.webkitTransform = "scale(" + c + ")";
            var f = Math.round((this.fullWidth - 320 * this.scale * c) / 2) + a / 2;
            this.canvasElement.style.margin = Math.round((this.fullHeight - 200 * this.scale * c) / 2) + a / 2 + "px " + f + "px 0px " + f + "px";
            this.visualFilter.width = window.innerWidth;
            this.visualFilter.height = window.innerHeight;
        };
        window.onresize();
        this.animationLoop();
        this.startScan();
    }

    changeGameSpriteColors(palette) {
        palette = palette || this.options.palette;
        const canvas = document.createElement("canvas");
        canvas.width = this.spriteWidth;
        canvas.height = this.spriteHeight;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.getImageData(0, 0, this.spriteWidth, this.spriteHeight);

        for (var g = 0; g < this.originalSpriteImageData.data.length; g += 4) {
            if (0 === this.originalSpriteImageData.data[g + 3]) {
                imageData.data[g] = 0; imageData.data[g + 1] = 0; imageData.data[g + 2] = 0; imageData.data[g + 3] = 0;
            } else {
                var h = m.colors[palette][this.originalSpriteImageData.data[g]];
                imageData.data[g] = parseInt(h[0] + h[1], 16);
                imageData.data[g + 1] = parseInt(h[2] + h[3], 16);
                imageData.data[g + 2] = parseInt(h[4] + h[5], 16);
                imageData.data[g + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        this.makeSpriteImageBitmap(canvas);
    }

    makeSpriteImageBitmap(canvas) {
        this.sprite = canvas;
        if ("function" === typeof window.createImageBitmap) {
            createImageBitmap(canvas).then((bitmap) => {
                this.sprite = bitmap;
            });
        }
    }

    applyVisualFilter() {
        var a = this.options.visualFilter;
        if ("none" == a) {
            this.vfImageRendering("pixelated"); this.vfFilter("blur(0px)"); this.options.palette = "default";
        } else if ("scanlines" == a) {
            this.vfImageRendering("pixelated"); this.vfFilter("blur(0px)"); this.options.palette = "default";
        } else if ("bwTv" == a) {
            this.vfImageRendering("initial"); this.vfFilter("blur(1.5px) brightness(2.5)"); this.options.palette = "grayscale";
        } else if ("colorTv" == a) {
            this.vfImageRendering("initial"); this.vfFilter("contrast(1.7) brightness(1.5) saturate(0.8) blur(1.5px)"); this.options.palette = "vice";
        } else if ("greenC64monitor" == a) {
            this.vfImageRendering("initial"); this.vfFilter("brightness(1.3) blur(1px)"); this.options.palette = "green";
        }
        localStorage.setItem("palette", this.options.palette);
        this.changeGameSpriteColors();
        z(this.engine.borderColor);
    }

    vfImageRendering(a) {
        this.canvasElement.style.imageRendering = a;
        this.visualFilter.style.imageRendering = a;
    }

    vfFilter(a) {
        const border = q("border");
        border.style.webkitFilter = a;
        border.style.filter = a;
    }

    animationLoop() {
        window.animFrame(() => {
            if (!this.engine.paused) {
                this.animationFrameCounter++;
                this.engine.animationRoutine();
            }
            this.animationLoop();
        });
    }

    startScan() {
        setInterval(() => {
            if (!this.engine.paused) {
                this.refreshPressedKeysByGamepad();
                this.scanFrameCounter++;
                this.engine.scanRoutine();
                this.audio.playQueue();
            }
        }, this.scanFrameTime);
    }

    refreshPressedKeysByGamepad() {
        // Simplified gamepad support from original w.js
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
        for (let i = 0; i < gamepads.length && i < 2; i++) {
            const gp = gamepads[i];
            if (gp) {
                // Map buttons to virtual keys or handle directly
                // This is a placeholder for the more complex mapping in the original
            }
        }
    }

    getControls(num) {
        // Implementation of J() logically moves here
        const engineIdx = this.getEngineControlIndex(num);
        return {
            up: this.pressedKeys[m.keys[engineIdx].up],
            down: this.pressedKeys[m.keys[engineIdx].down],
            left: this.pressedKeys[m.keys[engineIdx].left],
            right: this.pressedKeys[m.keys[engineIdx].right],
            fire: this.pressedKeys[m.keys[engineIdx].fire]
        };
    }

    getEngineControlIndex(num) {
        if (0 == num && "keyboardArrows" == this.options.yellowControl) return 0;
        if (0 == num && "keyboardWasd" == this.options.yellowControl) return 1;
        if (1 == num && "keyboardArrows" == this.options.blueControl) return 0;
        if (1 == num && "keyboardWasd" == this.options.blueControl) return 1;
        // Gamepad logic simplified for now
        return num;
    }

    setPressedKeyHold(key, num) {
        if (typeof key === "number") this.pressedKeys[key] = "hold";
        else {
            const idx = this.getEngineControlIndex(num);
            this.pressedKeys[m.keys[idx][key]] = "hold";
        }
    }
}

const app = new App();
app.init();
export default app;
