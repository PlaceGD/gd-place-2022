<script lang="ts">
    import { Motion } from "svelte-motion"

    import Editor from "../editor/Editor.svelte"

    import "../blobz.min.css"
</script>

<div class="background">
    <div class="editor">
        <Editor />
    </div>
    <!-- <Motion
        let:motion
        initial={{}}
        animate={{}}
        transition={{ ease: "linear", duration: 1 }}
    > -->
    <div class="blob">
        <div class="tk-blob" style="--fill: #030303; --speed: 50s">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 341.4 374.7">
                <path
                    filter="url(#sofGlow)"
                    d="M309.9 70.6c37.8 52.7 39.8 128.7 15.4 184.1-24.3 55.4-75 90.1-125.4 107.4-50.4 17.4-100.4 17.4-136.2-3.3-35.7-20.7-57.2-62-62.4-102.1-5.2-40.2 5.8-79 29.1-128.3C53.6 79.1 89.1 19.3 143.7 4.1 198.3-11.2 272 18 309.9 70.6z"
                />
            </svg>
        </div>
    </div>
    <!-- </Motion> -->
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
        align-items: center;
        justify-content: center;
    }

    .editor {
        width: 100%;
        height: 45%;
        position: absolute;
        top: 0;
        animation: clip ease-in-out 1.5s;
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
        animation: scale 3s ease-in-out forwards;
        will-change: transform;
    }

    .blob .tk-blob {
        margin: 20px;
        width: 100px;
    }

    @keyframes scale {
        from {
            transform: scale(0) translateY(-50vh);
        }
        to {
            transform: scale(1) translateY(-50%);
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
