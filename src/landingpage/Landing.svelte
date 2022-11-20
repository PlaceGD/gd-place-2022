<script lang="ts">
    import * as PIXI from "pixi.js"
    import { Motion } from "svelte-motion"
    import { toast } from "@zerodevx/svelte-toast"
    //import Countup from "svelte-countup"
    import { CountUp } from "countup.js"
    import { onMount } from "svelte"
    import debounce from "lodash.debounce"

    import { toastSuccessTheme } from "../const"
    import Editor from "../editor/Editor.svelte"
    import { streamLink } from "../firebase/database"
    import { database } from "../firebase/init"

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

    let totalPlaced = 1000000
    let totalDeleted = 1000000

    onValue(ref(database, "totalPlaced"), (snapshot) => {
        totalPlaced = snapshot.val()
    })

    onValue(ref(database, "totalDeleted"), (snapshot) => {
        totalDeleted = snapshot.val()
    })

    let canvas: HTMLCanvasElement

    const countupOptions = {
        duration: 5,
        useEasing: true,
    }

    const OBJECTS = [
        1, 2, 3, 4, 5, 6, 7, 476, 477, 478, 479, 480, 481, 482, 641, 642, 739,
        643, 644, 645, 646, 647, 648, 649, 650, 211, 1825, 259, 266, 273, 658,
        722, 659, 734,
    ]

    export function randomTexture() {
        let num = Math.floor(Math.random() * (OBJECTS.length - 1) + 1) // The maximum is exclusive and the minimum is inclusive

        return PIXI.Texture.from(`/gd/objects/main/${OBJECTS[num]}.png`)
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
    
            vec3 colorA = vec3(255, 255, 255) / 255.0;//texture2D(iTexture, vTextureCoord).xyz;
            // background
            vec3 colorB = vec3(0, 0, 0) / 255.0;
            vec3 color = colorA * c; //mix(colorA, colorB, c);

            float seed = fract(iTime);

            vec2 mult = (2.0 * vTextureCoord - 1.0) / (2. * 1.);
            vec4 tex = texture2D(iTexture, mult);
            
            gl_FragColor = vec4(color, 1.0);
            //gl_FragColor = tex;
            //gl_FragColor = vec4(color, 1.0);
            //gl_FragColor = texture2D(iTexture, swapped);
        }`

    $: if (
        totalPlaced > 0 &&
        totalDeleted > 0 &&
        totalDeletedEl &&
        totalPlacedEl
    ) {
        let placed = new CountUp(totalPlacedEl, totalPlaced, countupOptions)
        let deleted = new CountUp(totalDeletedEl, totalDeleted, countupOptions)

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

    onMount(() => {
        const uniforms = {
            iResolution: [canvas.offsetWidth, canvas.offsetHeight],
            iTime: 350,
        }

        let app = new PIXI.Application({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            resizeTo: canvas,
            backgroundColor: 0x060606,
            view: canvas,
            resolution: 1,
        })

        let container = new PIXI.Container()

        let sprites = []

        for (let x = 0; x < canvas.width; x += 30) {
            for (let y = 0; y < canvas.height; y += 30) {
                let sprite = new PIXI.Sprite(randomTexture())
                sprite.scale.set(0.25, 0.25)
                sprite.alpha = 0.1
                sprite.position.set(x, y)
                app.stage.addChild(sprite)
                sprites.push(sprite)
            }
        }

        let shader = new PIXI.Filter(undefined, SHADER, uniforms)
        shader.blendMode = PIXI.BLEND_MODES.SUBTRACT

        let gridGraph = new PIXI.Graphics()

        app.stage.addChild(container)
        app.stage.addChild(gridGraph)

        container.filters = [shader]
        container.filterArea = app.screen

        app.ticker.add((delta) => {
            shader.uniforms.iTime += 0.01 * delta
        })

        const drawGrid = () => {
            for (let x = 0; x <= canvas.width; x += 30) {
                gridGraph
                    .lineStyle(1, 0x090909, 0.5)
                    .moveTo(x, 0)
                    .lineTo(x, canvas.height)
            }
            for (let y = 0; y <= canvas.height; y += 30) {
                gridGraph
                    .lineStyle(1, 0x090909, 0.5)
                    .moveTo(0, y)
                    .lineTo(canvas.width, y)
            }
        }

        drawGrid()

        let resizeFn = debounce(() => {
            gridGraph.clear()
            drawGrid()
            container.filterArea = app.screen
        }, 300)

        canvas.onresize = resizeFn
    })

    import "../blobz.min.css"
    import { onValue, ref } from "firebase/database"
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

    <Motion
        let:motion
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ease: "easeInOut", duration: 3 }}
    >
        <canvas class="canvas" bind:this={canvas} use:motion />
    </Motion>

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

        {#if totalPlaced > 0 && totalDeleted > 0}
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
        {/if}

        <!-- <Motion
            let:motion
            initial={{ opacity: 0, translateY: "250%" }}
            animate={{ opacity: 0.5, translateY: "0%" }}
            transition={{ ease: "easeInOut", duration: 5 }}
        >
            <div class="total_users_text" use:motion>
                Users Registered: {test.toLocaleString()}
            </div>
        </Motion>  -->

        <!-- <Motion
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
        </Motion> -->

        {#if $streamLink && totalPlaced > 0 && totalDeleted > 0}
            <Motion
                let:motion
                initial={{ opacity: 0, translateY: "250%" }}
                animate={{ opacity: 0.7, translateY: "0%" }}
                transition={{ ease: "easeInOut", duration: 6 }}
            >
                <div class="watch_stream_text" use:motion>
                    Watch the stream: <a
                        class="stream_link"
                        href={$streamLink}
                        target="_blank"
                        rel="noreferrer">{$streamLink || ""}</a
                    >
                </div>
            </Motion>
        {/if}
    </div>
</div>

<style>
    :root {
        --shadow-color: #ff9e9e77;
        --shadow-color-light: white;

        --text-large: 75px;
        --text-medium: 45px;
        --text-small: 30px;
    }

    @media (max-width: 800px) {
        :root {
            --text-large: 55px;
            --text-medium: 35px;
            --text-small: 25px;
        }
    }

    @media (max-width: 600px) {
        :root {
            --text-large: 40px;
            --text-medium: 25px;
            --text-small: 15px;
        }
    }

    @media (max-width: 500px) {
        :root {
            --text-large: 25px;
            --text-medium: 15px;
            --text-small: 15px;
        }
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
        padding: 20px;
    }

    .canvas {
        position: absolute;
        width: 100%;
        height: 65%;
        bottom: 0;
    }

    .participating_text {
        font-family: "Archivo Black", "Archivo", sans-serif;
        font-size: var(--text-large);
        color: white;
        z-index: 1;
        text-shadow: 0px 0px 20px #000, 0px 0px 20px #000;
        animation: neon 5s infinite;
        text-align: center;
    }

    .total_text_container {
        width: 100%;
        display: flex;
        justify-content: space-evenly;
        align-items: center;
        /* opacity: 0.7; */
        text-shadow: 0px 0px 20px #000, 0px 0px 20px #000;
        text-align: center;
        gap: 10px;
    }

    .total_placed_text {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: var(--text-medium);
        text-shadow: 0px 0px 20px #000, 0px 0px 20px #000;
        text-align: center;
    }

    .total_deleted_text {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: var(--text-medium);
        text-align: center;
    }

    .total_users_text,
    .level_id_text,
    .watch_stream_text,
    .stream_link {
        font-family: Cabin;
        color: white;
        z-index: 1;
        font-size: var(--text-small);
        text-decoration: underline;
        text-decoration-color: #0000;
        text-shadow: 0px 0px 20px #000;
        text-align: center;
    }

    .stream_link:hover {
        text-decoration-color: #ffff;
        transition: text-decoration-color 0.5s ease-in-out;
        cursor: pointer;
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
