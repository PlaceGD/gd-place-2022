const toastSuccessTheme = {
    theme: {
        "--toastColor": "mintcream",
        "--toastBackground": "rgba(72, 187, 120, 0.9)",
        "--toastBarBackground": "#2F855A",
    },
}
const toastErrorTheme = {
    theme: {
        "--toastColor": "mintcream",
        "--toastBackground": "rgba(187, 72, 72, 0.9)",
        "--toastBarBackground": "#852F2F",
    },
}

const MAX_ZOOM = -10
const MIN_ZOOM = 24

export { toastSuccessTheme, toastErrorTheme, MAX_ZOOM, MIN_ZOOM }
