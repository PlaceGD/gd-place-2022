<script lang="ts">
    import * as PIXI from "pixi.js"
    import { Motion } from "svelte-motion"
    import { toast } from "@zerodevx/svelte-toast"
    //import Countup from "svelte-countup"
    import { CountUp } from "countup.js"
    import { onMount } from "svelte"

    import { toastSuccessTheme } from "../const"
    import Editor from "../editor/Editor.svelte"

    const variants = {
        editorHeight: {
            width: "100%",
            transition: { duration: "3s", ease: "easeInOut" },
        },
    }

    let fullscreen = false
    let isInAnim = false

    let totalPlacedEl
    let totalDeletedEl

    let canvas: HTMLCanvasElement

    const countupOptions = {
        duration: 5,
        useEasing: true,
    }

    const OBJECTS = [1, 2, 3, 4, 5, 6, 7]

    export function randomTexture() {
        let num = Math.floor(Math.random() * (OBJECTS.length - 1) + 1) // The maximum is exclusive and the minimum is inclusive
        return PIXI.Texture.from(`/gd/objects/main/${num}.png`)
    }

    const SHADER = `
        precision mediump float;
        uniform vec3 iResolution;
        uniform float iTime;
        uniform sampler2D iTexture;
        varying vec2 vTextureCoord;
        uniform vec4 filterArea;

        float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   

        float gold_noise(in vec2 xy, in float seed){
            return fract(tan(distance(xy*PHI, xy)*seed)*xy.x);
        }

        float Map(in float inV, in float inMin, in float inMax, in float outMin, in float outMax) {
            return (inV - inMin) / (inMax - inV) * (outMax - outMin) + outMin;
        }

        vec2 Translate(vec2 p, vec2 v) {
            return p - v;
        }

        float sdSphere(vec2 p, float size) {
            return length(p) - size;
        }

        float sdBox( in vec2 p, in vec2 b )
        {
            vec2 d = abs(p)-b;
            return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
        }

        float ndot(vec2 a, vec2 b ) { return a.x*b.x - a.y*b.y; }
        float sdRhombus( in vec2 p, in vec2 b ) 
        {
            p = abs(p);
            float h = clamp( ndot(b-2.0*p,b)/dot(b,b), -1.0, 1.0 );
            float d = length( p-0.5*b*vec2(1.0-h,1.0+h) );
            return d * sign( p.x*b.y + p.y*b.x - b.x*b.y );
        }

        void main()
        {
            vec2 center = iResolution.xy / 2.0;
            vec2 maskCenter = center;
            float maskMaxSize = iResolution.x / 1.7;
            float timeScale = 1.0;
            float maskSize = (sin(iTime * timeScale) + 1.0) * maskMaxSize;

            float voxelSize = 30.0;
            vec2 scaledP = gl_FragCoord.xy / voxelSize;
            vec2 voxelCoord = (floor(scaledP) + vec2(0.5)) * voxelSize;
            vec2 pRelaviteToVoxel = gl_FragCoord.xy - voxelCoord;
            
            // calculate mask factor at the voxel center
            maskCenter = Translate(voxelCoord, maskCenter);
            float maskFactor = sdRhombus(maskCenter, vec2(maskSize, maskSize)) / 250.0;
            
            float voxelScale = - maskFactor * voxelSize / 2.0;
            float c = sdBox(pRelaviteToVoxel, vec2(voxelScale));
            c = clamp(c,0.0, 1.0);
            
            vec2 swapped = vec2(pRelaviteToVoxel.x, pRelaviteToVoxel.y * -1.);
    
            vec3 colorA = texture2D(uSampler, vTextureCoord);
            // background
            vec3 colorB = vec3(6, 6, 6) / 255.0;
            vec3 color = mix(colorA, colorB, c);

            float seed = fract(iTime);

            vec2 mult = (2.0 * vTextureCoord - 1.0) / (2. * 1.);
            vec4 tex = texture2D(iTexture, mult);
            
            gl_FragColor = vec4(color, 1.0);
            //gl_FragColor = tex;
            //gl_FragColor = vec4(color, 1.0);
            //gl_FragColor = texture2D(iTexture, swapped);
        }`

    onMount(() => {
        if (totalDeletedEl && totalPlacedEl) {
            let placed = new CountUp(totalPlacedEl, test, countupOptions)
            let deleted = new CountUp(totalDeletedEl, test, countupOptions)

            if (!placed.error) {
                placed.start()
            } else {
                console.error(placed.error)
            }

            if (!deleted.error) {
                deleted.start()
            } else {
                console.error(deleted.error)
            }
        }

        const uniforms = {
            iResolution: [canvas.offsetWidth, canvas.offsetHeight],
            iTime: 350,
            iTexture: PIXI.Texture.from("/gd/objects/main/1.png"),
        }

        let app = new PIXI.Application({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            resizeTo: canvas,
            backgroundColor: 0x060606,
            view: canvas,
            resolution: 1,
        })

        let sprites = []

        let container = new PIXI.Container()

        // let testshader = new PIXI.Filter(undefined, SHADER, uniforms)

        // // const testshader = new PIXI.Shader(new PIXI.Program(null, SHADER), {
        // //     resolution: {
        // //         type: "v3i",
        // //         value: [0, 0, 0],
        // //     },
        // //     time: 0,
        // // })

        // container.addChild(sprite)

        // // container.pivot.set(1, 1)
        // // container.rotation = 1

        let gridGraph = new PIXI.Graphics()

        app.stage.addChild(container)
        container.addChild(gridGraph)

        // container.filters = [testshader]
        // container.filterArea = app.screen

        app.ticker.add((delta) => {
            //testshader.uniforms.iTime += 0.01 * delta
        })

        const drawRhoumbus = () => {
            for (let x = 0; x <= canvas.width / 30; x++) {
                for (let y = 0; y <= canvas.width / 30; y++) {}
            }
        }

        const drawGrid = () => {
            for (let x = 0; x <= canvas.width; x += 30) {
                gridGraph
                    .lineStyle(1, 0x060606, 0.5)
                    .moveTo(x, 0)
                    .lineTo(x, canvas.height)

                sprites.push(new PIXI.Sprite(randomTexture()))
            }
            for (let y = 0; y <= canvas.height; y += 30) {
                gridGraph
                    .lineStyle(1, 0x060606, 0.5)
                    .moveTo(0, y)
                    .lineTo(canvas.width, y)

                sprites.push(new PIXI.Sprite(randomTexture()))
            }
        }

        drawGrid()
    })

    let test = 1000000

    import "../blobz.min.css"
</script>

<div class="background">
    <div class="editor_container">
        <Motion
            let:motion
            initial={{ height: "40%" }}
            animate={fullscreen ? { height: "100%" } : {}}
            transition={{ duration: 3, ease: "easeInOut" }}
            onAnimationStart={() => (isInAnim = true)}
            onAnimationComplete={() => (isInAnim = false)}
        >
            <div class="editor" use:motion>
                <Editor />

                <Motion
                    let:motion
                    initial={{
                        bottom: 0,
                        translateY: "-50%",
                        scale: 0,
                    }}
                    animate={fullscreen
                        ? { translateY: "-10%", scale: 1 }
                        : { translateY: "50%", scale: 1 }}
                    transition={{ ease: "easeInOut", duration: 3 }}
                >
                    <div class="blob" use:motion>
                        <div
                            class="tk-blob"
                            style="--fill: #030303; --speed: 50s"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 341.4 374.7"
                            >
                                <path
                                    d="M309.9 70.6c37.8 52.7 39.8 128.7 15.4 184.1-24.3 55.4-75 90.1-125.4 107.4-50.4 17.4-100.4 17.4-136.2-3.3-35.7-20.7-57.2-62-62.4-102.1-5.2-40.2 5.8-79 29.1-128.3C53.6 79.1 89.1 19.3 143.7 4.1 198.3-11.2 272 18 309.9 70.6z"
                                />
                            </svg>
                        </div>
                        <!-- svelte-ignore a11y-click-events-have-key-events -->
                        <img
                            alt="fullscreen"
                            draggable={false}
                            src={fullscreen
                                ? "/minimise.svg"
                                : "/fullscreen.svg"}
                            class="fullscreen_icon"
                            on:click={() => {
                                if (isInAnim) return
                                fullscreen = !fullscreen
                            }}
                        />
                    </div>
                </Motion>
            </div>
        </Motion>
    </div>

    <canvas class="canvas" bind:this={canvas} />

    <div class="text_container">
        <Motion
            let:motion
            initial={{ opacity: 0, translateY: "-50%" }}
            animate={{ opacity: 1, translateY: "0%" }}
            transition={{ ease: "easeInOut", duration: 3 }}
        >
            <div class="participating_text" use:motion>
                THANKS FOR PARTICIPATING!
            </div>
        </Motion>

        <Motion
            let:motion
            initial={{ opacity: 0, translateY: "200%" }}
            animate={{ opacity: 1, translateY: "0%" }}
            transition={{ ease: "easeInOut", duration: 4 }}
        >
            <div class="total_text_container" use:motion>
                <div class="total_placed_text">
                    Objects Placed:
                    <span bind:this={totalPlacedEl} />
                </div>
                <div class="total_deleted_text">
                    Objects Deleted:
                    <span bind:this={totalDeletedEl} />
                </div>
            </div>
        </Motion>

        <!-- <Motion
            let:motion
            initial={{ opacity: 0, translateY: "250%" }}
            animate={{ opacity: 0.5, translateY: "0%" }}
            transition={{ ease: "easeInOut", duration: 5 }}
        >
            <div class="total_users_text" use:motion>
                Users Registered: {test.toLocaleString()}
            </div>
        </Motion> -->

        <Motion
            let:motion
            initial={{ opacity: 0, translateY: "250%" }}
            animate={{ opacity: 0.7, translateY: "0%" }}
            transition={{ ease: "easeInOut", duration: 6 }}
        >
            <div
                class="level_id_text"
                use:motion
                on:click={() => {
                    toast.pop()
                    toast.push("Coped to clipboard!", toastSuccessTheme)
                }}
            >
                Play the level: 1234567
            </div>
        </Motion>
    </div>
</div>

<style>
    :root {
        --shadow-color: #ff9e9e77;
        --shadow-color-light: white;
    }

    .background {
        background-color: #060606;
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .editor_container {
        width: 100%;
        height: 100%;
    }

    .editor {
        width: 100%;
        position: absolute;
        top: 0;
        z-index: 2;
        animation: clip ease-in-out 1.5s;
        display: flex;
        justify-content: center;
    }

    @keyframes clip {
        from {
            opacity: 0;
            clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%);
        }
        to {
            opacity: 1;
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        }
    }

    .blob {
        display: flex;
        position: absolute;
        justify-content: center;
        align-items: center;
        z-index: 3;
    }

    .blob .tk-blob {
        width: 100px;
    }

    .fullscreen_icon {
        position: absolute;
        width: 56px;
        height: 56px;
        color: white;
        cursor: pointer;
    }

    .text_container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: 50px;
    }

    .canvas {
        position: absolute;
        width: 100%;
        height: 65%;
        bottom: 0;
    }

    .participating_text {
        font-family: "Archivo Black", "Archivo", sans-serif;
        font-size: 75px;
        color: white;
        z-index: 1;
        /* animation: neon 5s infinite; */
    }

    .total_text_container {
        width: 100%;
        display: flex;
        justify-content: space-evenly;
        align-items: center;
        /* opacity: 0.7; */
    }

    .total_placed_text {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: 45px;
    }
    /* 
    .total_placed_text:hover {
        animation: fade-in-neon 2s ease-in-out forwards reverse;
    }
    .total_placed_text:not(:hover) {
        animation: fade-out-neon 2s ease-in-out;
    } */

    .total_deleted_text {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: 40px;
    }

    .total_users_text,
    .level_id_text {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: 30px;
        text-decoration: underline;
        text-decoration-color: #0000;
    }

    .level_id_text:hover {
        text-decoration-color: #ffff;
        transition: text-decoration-color 0.5s ease-in-out;
        cursor: copy;
    }

    .level_id_text:active {
        color: red;
    }

    @keyframes fade-in-neon {
        0% {
            text-shadow: -1px -1px 1px #0000, -1px 1px 1px #0000,
                1px -1px 1px #0000, 1px 1px 1px #0000, 0 0 3px #0000,
                0 0 10px #0000, 0 0 20px #0000, 0 0 30px #0000, 0 0 40px #0000,
                0 0 50px #0000, 0 0 70px #0000, 0 0 100px #0000, 0 0 200px #0000;
        }

        100% {
            text-shadow: -1px -1px 1px var(--shadow-color-light),
                -1px 1px 1px var(--shadow-color-light),
                1px -1px 1px var(--shadow-color-light),
                1px 1px 1px var(--shadow-color-light),
                0 0 3px var(--shadow-color-light),
                0 0 10px var(--shadow-color-light),
                0 0 20px var(--shadow-color-light), 0 0 30px var(--shadow-color),
                0 0 40px var(--shadow-color), 0 0 50px var(--shadow-color),
                0 0 70px var(--shadow-color), 0 0 100px var(--shadow-color),
                0 0 200px var(--shadow-color);
        }
    }

    @keyframes neon {
        0% {
            text-shadow: -1px -1px 1px var(--shadow-color-light),
                -1px 1px 1px var(--shadow-color-light),
                1px -1px 1px var(--shadow-color-light),
                1px 1px 1px var(--shadow-color-light),
                0 0 3px var(--shadow-color-light),
                0 0 10px var(--shadow-color-light),
                0 0 20px var(--shadow-color-light), 0 0 30px var(--shadow-color),
                0 0 40px var(--shadow-color), 0 0 50px var(--shadow-color),
                0 0 70px var(--shadow-color), 0 0 100px var(--shadow-color),
                0 0 200px var(--shadow-color);
        }
        50% {
            text-shadow: -1px -1px 1px var(--shadow-color-light),
                -1px 1px 1px var(--shadow-color-light),
                1px -1px 1px var(--shadow-color-light),
                1px 1px 1px var(--shadow-color-light),
                0 0 5px var(--shadow-color-light),
                0 0 15px var(--shadow-color-light),
                0 0 25px var(--shadow-color-light), 0 0 40px var(--shadow-color),
                0 0 50px var(--shadow-color), 0 0 60px var(--shadow-color),
                0 0 80px var(--shadow-color), 0 0 110px var(--shadow-color),
                0 0 210px var(--shadow-color);
        }
        100% {
            text-shadow: -1px -1px 1px var(--shadow-color-light),
                -1px 1px 1px var(--shadow-color-light),
                1px -1px 1px var(--shadow-color-light),
                1px 1px 1px var(--shadow-color-light),
                0 0 3px var(--shadow-color-light),
                0 0 10px var(--shadow-color-light),
                0 0 20px var(--shadow-color-light), 0 0 30px var(--shadow-color),
                0 0 40px var(--shadow-color), 0 0 50px var(--shadow-color),
                0 0 70px var(--shadow-color), 0 0 100px var(--shadow-color),
                0 0 200px var(--shadow-color);
        }
    }

    @keyframes fade-out-neon {
        0% {
            text-shadow: -1px -1px 1px var(--shadow-color-light),
                -1px 1px 1px var(--shadow-color-light),
                1px -1px 1px var(--shadow-color-light),
                1px 1px 1px var(--shadow-color-light),
                0 0 3px var(--shadow-color-light),
                0 0 10px var(--shadow-color-light),
                0 0 20px var(--shadow-color-light), 0 0 30px var(--shadow-color),
                0 0 40px var(--shadow-color), 0 0 50px var(--shadow-color),
                0 0 70px var(--shadow-color), 0 0 100px var(--shadow-color),
                0 0 200px var(--shadow-color);
        }

        100% {
            text-shadow: -1px -1px 1px #0000, -1px 1px 1px #0000,
                1px -1px 1px #0000, 1px 1px 1px #0000, 0 0 3px #0000,
                0 0 10px #0000, 0 0 20px #0000, 0 0 30px #0000, 0 0 40px #0000,
                0 0 50px #0000, 0 0 70px #0000, 0 0 100px #0000, 0 0 200px #0000;
        }
    }
</style>
