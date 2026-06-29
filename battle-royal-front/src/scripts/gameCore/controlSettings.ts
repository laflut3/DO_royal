export interface ControlSettings {
    up: string
    left: string
    down: string
    right: string
    sprint: string
    shoot: string
}

export interface ControlAction {
    id: keyof ControlSettings
    label: string
}

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
    up: "Z",
    left: "Q",
    down: "S",
    right: "D",
    sprint: "SHIFT",
    shoot: "LEFT_CLICK"
};

export const CONTROL_ACTIONS: Array<ControlAction> = [
    { id: "up", label: "Avancer" },
    { id: "left", label: "Gauche" },
    { id: "down", label: "Reculer" },
    { id: "right", label: "Droite" },
    { id: "sprint", label: "Courir" },
    { id: "shoot", label: "Tirer" }
];

const STORAGE_KEY = "battleRoyalControlSettings";

export function loadControlSettings(): ControlSettings {
    try {
        const rawSettings = window.localStorage.getItem(STORAGE_KEY);
        if (!rawSettings) {
            return { ...DEFAULT_CONTROL_SETTINGS };
        }
        return { ...DEFAULT_CONTROL_SETTINGS, ...JSON.parse(rawSettings) };
    } catch (error) {
        return { ...DEFAULT_CONTROL_SETTINGS };
    }
}

export function saveControlSettings(settings: ControlSettings) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetControlSettings(): ControlSettings {
    const settings = { ...DEFAULT_CONTROL_SETTINGS };
    saveControlSettings(settings);
    return settings;
}

export function keyboardCodeToLabel(key: string): string {
    if (key === "SHIFT") {
        return "Shift";
    }
    if (key === "RIGHT_CLICK") {
        return "Clic droit";
    }
    if (key === "LEFT_CLICK") {
        return "Clic gauche";
    }
    if (key === "SPACE") {
        return "Espace";
    }
    return key.toUpperCase();
}

export function normalizeKeyboardEventKey(event: KeyboardEvent): string {
    if (event.key === " ") {
        return "SPACE";
    }
    if (event.key.toUpperCase() === "SHIFT") {
        return "SHIFT";
    }
    return event.key.toUpperCase();
}
