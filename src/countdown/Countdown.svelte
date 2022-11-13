<script lang="ts">
    import * as PIXI from "pixi.js"
    import { onMount } from "svelte"
    import { Motion } from "svelte-motion"

    import { OBJECTS, randomTexture } from "./countdown"

    let canvas: HTMLCanvasElement

    let timer = 5
    let isDone = false
    let circle: HTMLDivElement

    // let i = setInterval(() => {
    //     timer--
    //     if (timer <= 0) {
    //         clearInterval(i)
    //     }
    // }, 1000)

    onMount(() => {
        let app = new PIXI.Application({
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
            resizeTo: canvas,
            backgroundColor: 0x060606,
            view: canvas,
            resolution: 1,
        })

        // for (let o of OBJECTS) {
        //     app.loader.add(`/gd/objects/main/${o}.png`)
        // }

        let container = new PIXI.Container()

        let gridGraph = new PIXI.Graphics()
        container.addChild(gridGraph)

        app.stage.addChild(container)

        const drawHorizontalLine = () => {
            for (let x = 0; x <= canvas.width; x += 30) {
                let sprite = new PIXI.Sprite(randomTexture())

                sprite.scale.set(0.25, 0.25)
                sprite.position.set(x, 30)
                sprite.alpha = 0.3

                container.addChild(sprite)
            }
        }

        const drawGrid = () => {
            for (let x = 0; x <= canvas.width; x += 30) {
                gridGraph
                    .lineStyle(1, 0xffffff, 0.03)
                    .moveTo(x, 0)
                    .lineTo(x, canvas.height)
            }
            for (let y = 0; y <= canvas.height; y += 30) {
                gridGraph
                    .lineStyle(1, 0xffffff, 0.03)
                    .moveTo(0, y)
                    .lineTo(canvas.width, y)
            }
        }

        drawGrid()

        //drawHorizontalLine()

        window.addEventListener("resize", () => {
            gridGraph.clear()
            drawGrid()
        })
    })
</script>

<Motion
    let:motion
    animate={isDone ? { transform: "translateY(100vh)" } : {}}
    transition={{ ease: "circIn", duration: 2 }}
>
    <div class="background" use:motion>
        <Motion
            let:motion
            initial={{ width: 0 }}
            animate={timer === 0 ? { width: "120vw" } : {}}
            transition={{ ease: "circOut", duration: 3.5 }}
            onAnimationComplete={() => {
                circle.style.width = "100vw"
                circle.style.height = "100vh"
                circle.style.borderRadius = "0%"
                isDone = true
            }}
        >
            <div class="black" use:motion bind:this={circle} />
        </Motion>

        <canvas class="pixi_canvas" bind:this={canvas} />
        <div class="all">
            <Motion
                let:motion
                initial={{
                    opacity: 0,
                    transform: "translateY(200%) scale(0.7)",
                }}
                animate={{ opacity: 1, transform: "translateY(0%) scale(1)" }}
                transition={{
                    opacity: {
                        duration: 1.5,
                    },
                    transform: {
                        duration: 2,
                    },
                    ease: "easeInOut",
                }}
            >
                <div class="countdown" use:motion>72:00:00</div>
            </Motion>

            <div class="extra">
                <Motion
                    let:motion
                    initial={{
                        opacity: 0,
                        transform: "translate(-200%, 200%)",
                    }}
                    animate={{
                        opacity: 1,
                        transform: "translate(0%, 0%)",
                    }}
                    transition={{
                        opacity: {
                            duration: 1.5,
                        },
                        transform: {
                            duration: 2,
                        },
                        ease: "backInOut",
                    }}
                >
                    <div class="time" use:motion>XX/YY/ZZ AA:BB TZ</div>
                </Motion>

                <Motion
                    let:motion
                    initial={{
                        opacity: 0,
                        transform: "translate(200%, 200%)",
                    }}
                    animate={{
                        opacity: 1,
                        transform: "translate(0%, 0%)",
                    }}
                    transition={{
                        opacity: {
                            duration: 1.5,
                        },
                        transform: {
                            duration: 2,
                        },
                        ease: "backInOut",
                    }}
                >
                    <div class="login" use:motion>
                        Get signed up now! {timer}
                    </div>
                </Motion>
            </div>
        </div>
    </div>
</Motion>

<style>
    :root {
        --shadow-color: #ff9e9e99;
        --shadow-color-light: white;
    }

    .background {
        background-color: #060606;
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .black {
        position: absolute;
        background: black;
        aspect-ratio: 1 / 1;
        /* width: 100px; */
        /* height: 100px; */
        border-radius: 50%;
        z-index: 50;
    }

    .pixi_canvas {
        position: absolute;
        width: 100%;
        height: 100%;
        transition: opacity;
        animation: fade-in 1s ease-in-out;
    }

    .all {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .countdown {
        font-family: "Archivo Black", "Archivo", sans-serif;
        font-size: 250px;
        color: white;
        z-index: 2;
        animation: neon 3s infinite;
    }

    .extra {
        display: flex;
        flex-direction: row;
        justify-content: space-evenly;
        width: 100%;
        z-index: 1;
    }

    .time,
    .login {
        font-family: Cabin;
        font-size: 40px;
        color: white;
    }

    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
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
</style>
